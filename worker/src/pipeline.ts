import type {
  Env,
  Agent,
  NetworkGoal,
  OnboardCredit,
  SwapEvent,
  CrossHoldingEdge,
  NetworkState,
  FlaunchHolder,
  FlaunchSwap,
  FlaunchTokenDetails,
  PowerScore,
} from './types';
import { fetchTokens, fetchTokenDetails, fetchHolders, fetchSwaps, batchedFetch } from './flaunch';
import { batchReadBalances, batchFetchMemos, fetchWalletSwaps } from './rpc';
import { computePowerScore, computeOnboardGoalScore } from './scoring';
import { resolveBanners } from './banners';

const MIN_HOLDERS = 5;
const WHALE_ETH = 0.1; // only include non-agent swaps above this size

const DEFAULT_POWER_SCORE: PowerScore = { total: 0, revenue: 0, market: 0, network: 0, vitality: 0 };

interface TokenEnrichment {
  details: FlaunchTokenDetails | null;
  holders: FlaunchHolder[];
  totalHolders: number;
  swaps: FlaunchSwap[];
}

/**
 * Full pipeline: discover -> filter -> enrich -> balances -> relate -> memos -> score -> store
 * Runs on cron every 2 minutes.
 */
export async function runPipeline(env: Env): Promise<void> {
  console.log('[pipeline] starting...');

  try {
    await executePipeline(env);
  } catch (err) {
    console.error('[pipeline] failed:', err instanceof Error ? err.stack ?? err.message : String(err));
  }
}

async function executePipeline(env: Env): Promise<void> {
  // 0. Read active goal from KV (if any)
  const goalRaw = await env.NETWORK_KV.get('network:goal');
  const goal: NetworkGoal | null = goalRaw ? JSON.parse(goalRaw) : null;
  const goalWeight = goal ? goal.weight : 0;

  // 1. Discover tokens
  const tokens = await fetchTokens(env);
  console.log(`[pipeline] discovered ${tokens.length} tokens`);

  if (tokens.length === 0) {
    await storeState(env, { agents: [], swaps: [], crossEdges: [], goal: null, timestamp: Date.now() });
    return;
  }

  // Filter by minimum market cap
  const candidates = tokens.filter(
    (t) => Number(t.marketCapETH || '0') / 1e18 > 0.01,
  );
  console.log(`[pipeline] ${candidates.length} candidates above mcap threshold`);

  if (candidates.length === 0) {
    await storeState(env, { agents: [], swaps: [], crossEdges: [], goal: null, timestamp: Date.now() });
    return;
  }

  // 2. Pre-filter by holders
  const holderPreMap = new Map<string, { holders: FlaunchHolder[]; totalHolders: number }>();

  await batchedFetch(candidates, async (t) => {
    const result = await fetchHolders(env, t.tokenAddress);
    holderPreMap.set(t.tokenAddress.toLowerCase(), result);
  });

  const qualified = candidates.filter((t) => {
    const h = holderPreMap.get(t.tokenAddress.toLowerCase());
    return (h?.totalHolders ?? 0) >= MIN_HOLDERS;
  });

  console.log(`[pipeline] ${qualified.length}/${candidates.length} have >= ${MIN_HOLDERS} holders`);

  if (qualified.length === 0) {
    await storeState(env, { agents: [], swaps: [], crossEdges: [], goal: null, timestamp: Date.now() });
    return;
  }

  // 3. Enrich qualified tokens (details + swaps)
  const enrichMap = new Map<string, TokenEnrichment>();

  await batchedFetch(qualified, async (t) => {
    const key = t.tokenAddress.toLowerCase();
    const holderData = holderPreMap.get(key) ?? { holders: [], totalHolders: 0 };
    const [details, swaps] = await Promise.all([
      fetchTokenDetails(env, t.tokenAddress),
      fetchSwaps(env, t.tokenAddress),
    ]);
    enrichMap.set(key, {
      details,
      holders: holderData.holders,
      totalHolders: holderData.totalHolders,
      swaps,
    });
  });

  console.log(`[pipeline] enriched ${enrichMap.size} tokens`);

  // 4. Read on-chain balances (single Multicall3 call)
  const owners = [...new Set(
    [...enrichMap.values()]
      .map((e) => e.details?.status.owner ?? '')
      .filter(Boolean),
  )];

  const { claimableMap, walletMap } = await batchReadBalances(env, owners);
  console.log(`[pipeline] read balances for ${owners.length} owners`);

  // 5. Compute relationships
  // Build creator->name/token lookups
  const creatorToName = new Map<string, { name: string; symbol: string }>();
  const creatorToToken = new Map<string, string>();
  for (const t of qualified) {
    const enrich = enrichMap.get(t.tokenAddress.toLowerCase());
    const owner = enrich?.details?.status.owner ?? '';
    if (owner) {
      const ownerLower = owner.toLowerCase();
      creatorToName.set(ownerLower, { name: t.name || 'unnamed', symbol: t.symbol || '???' });
      creatorToToken.set(ownerLower, t.tokenAddress);
    }
  }

  // Build wallet -> tokens-held map from ALL holder data
  const walletHoldings = new Map<string, Set<string>>();
  for (const t of qualified) {
    const key = t.tokenAddress.toLowerCase();
    const enrich = enrichMap.get(key);
    if (!enrich) continue;
    for (const h of enrich.holders) {
      const addr = h.id.toLowerCase();
      if (!walletHoldings.has(addr)) walletHoldings.set(addr, new Set());
      walletHoldings.get(addr)!.add(key);
    }
  }

  const creatorSet = new Set(owners.map((o) => o.toLowerCase()));
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  // 6. Build agents + swap events
  const allSwapEvents: SwapEvent[] = [];

  const allAgents: Agent[] = qualified.map((t) => {
    const key = t.tokenAddress.toLowerCase();
    const enrich = enrichMap.get(key);
    const details = enrich?.details;
    const owner = details?.status.owner ?? '';
    const ownerLower = owner.toLowerCase();
    const totalHolders = enrich?.totalHolders ?? 0;

    // Cross-holdings: other agent tokens this wallet holds
    const held = walletHoldings.get(ownerLower);
    const crossHoldings = held
      ? [...held].filter((tokenAddr) => tokenAddr !== key).length
      : 0;

    // Recent swaps + cross-trade detection
    const rawSwaps = enrich?.swaps ?? [];
    const recentApiSwaps = rawSwaps.filter((s) => s.timestamp * 1000 > oneDayAgo);
    const recentSwaps = recentApiSwaps.length;

    let crossTradeCount = 0;
    for (const s of recentApiSwaps) {
      const makerLower = s.maker.toLowerCase();
      const makerInfo = creatorToName.get(makerLower);
      const isWash = makerLower === ownerLower;
      const isCross = !isWash && creatorSet.has(makerLower);
      const isAgent = creatorSet.has(makerLower);
      if (isCross) crossTradeCount++;

      // Skip wash trades
      if (isWash) continue;

      // Only keep notable swaps: agent wallet activity, cross-trades, or whale-size
      const isNotable = isAgent || isCross || s.amountETH >= WHALE_ETH;
      if (!isNotable) continue;

      allSwapEvents.push({
        tokenAddress: t.tokenAddress,
        tokenName: t.name || 'unnamed',
        tokenSymbol: t.symbol || '???',
        maker: s.maker,
        makerName: makerInfo ? `${makerInfo.name} (${makerInfo.symbol})` : null,
        makerTokenAddress: creatorToToken.get(makerLower) ?? null,
        type: s.type === 'buy' ? 'buy' : 'sell',
        amountETH: s.amountETH,
        timestamp: s.timestamp,
        transactionHash: s.transactionHash,
        isCrossTrade: isCross,
        isAgentSwap: isAgent,
        memo: null, // populated in memo pass
      });

    }

    return {
      tokenAddress: t.tokenAddress,
      name: t.name || 'unnamed',
      symbol: t.symbol || '???',
      creator: owner,
      marketCapETH: Number(t.marketCapETH || '0') / 1e18,
      volume24hETH: Number(details?.volume.volume24h || '0') / 1e18,
      priceChange24h: Number(details?.price.priceChange24h || '0'),
      claimableETH: claimableMap.get(ownerLower) ?? 0,
      walletETH: walletMap.get(ownerLower) ?? 0,
      image: t.image || '',
      description: t.description || '',
      flaunchUrl: `${env.FLAUNCH_URL}/coin/${t.tokenAddress}`,
      holders: totalHolders,
      crossHoldings,
      recentSwaps,
      crossTradeCount,
      memoCount: crossTradeCount,
      powerScore: DEFAULT_POWER_SCORE,
      goalScore: 0,
      onboards: [],
      type: 'agent' as const,
    };
  });

  // 6b. Batch-resolve memos for all swaps via single RPC batch
  const hashesNeedingMemos = allSwapEvents
    .filter((s) => !s.memo)
    .map((s) => s.transactionHash);

  if (hashesNeedingMemos.length > 0) {
    const memoMap = await batchFetchMemos(env, hashesNeedingMemos);
    for (const swap of allSwapEvents) {
      if (!swap.memo) swap.memo = memoMap.get(swap.transactionHash) ?? null;
    }
    console.log(`[pipeline] batch memos: ${memoMap.size}/${hashesNeedingMemos.length} resolved`);
  }

  // Build cross-holding edges
  const crossEdges: CrossHoldingEdge[] = [];
  const seenEdges = new Set<string>();

  for (const agent of allAgents) {
    const ownerLower = agent.creator.toLowerCase();
    if (!ownerLower) continue;
    const held = walletHoldings.get(ownerLower);
    if (!held) continue;

    for (const heldToken of held) {
      if (heldToken === agent.tokenAddress.toLowerCase()) continue;
      const edgeKey = [agent.tokenAddress.toLowerCase(), heldToken].sort().join('-');
      if (seenEdges.has(edgeKey)) continue;
      seenEdges.add(edgeKey);

      crossEdges.push({
        tokenA: agent.tokenAddress,
        tokenB: heldToken,
        holder: ownerLower,
      });
    }
  }

  // 7. Fetch agent wallet activity via Alchemy (direct wallet queries)
  // This catches ALL agent txs — not just ones on our tracked tokens
  const seenHashes = new Set(allSwapEvents.map((s) => s.transactionHash));
  const uniqueOwners = [...new Set(owners.map((o) => o.toLowerCase()))];

  await Promise.allSettled(
    uniqueOwners.map(async (ownerAddr) => {
      const walletTxs = await fetchWalletSwaps(env, ownerAddr, 15);
      const agentInfo = creatorToName.get(ownerAddr);
      const agentToken = creatorToToken.get(ownerAddr);

      for (const tx of walletTxs) {
        if (seenHashes.has(tx.hash)) {
          // Already have this swap — just attach memo if we found one
          if (tx.memo) {
            const existing = allSwapEvents.find((s) => s.transactionHash === tx.hash);
            if (existing && !existing.memo) existing.memo = tx.memo;
          }
          continue;
        }
        seenHashes.add(tx.hash);

        // Cache memo in KV
        if (tx.memo) {
          await env.NETWORK_KV.put(`memo:${tx.hash}`, tx.memo, { expirationTtl: 604800 }).catch(() => {});
        }

        const ts = Math.floor(new Date(tx.timestamp).getTime() / 1000);

        allSwapEvents.push({
          tokenAddress: agentToken ?? '',
          tokenName: agentInfo?.name ?? 'unknown',
          tokenSymbol: agentInfo?.symbol ?? '???',
          maker: ownerAddr,
          makerName: agentInfo ? `${agentInfo.name} (${agentInfo.symbol})` : null,
          makerTokenAddress: agentToken ?? null,
          type: 'buy', // outgoing ETH = buying a token
          amountETH: tx.value,
          timestamp: ts,
          transactionHash: tx.hash,
          isCrossTrade: false,
          isAgentSwap: true,
          memo: tx.memo,
        });
      }
    }),
  );

  console.log(`[pipeline] wallet query: ${allSwapEvents.filter((s) => s.isAgentSwap).length} agent swaps total`);

  // Re-sort after adding wallet swaps, keep last 100
  allSwapEvents.sort((a, b) => b.timestamp - a.timestamp);
  const trimmedSwaps = allSwapEvents.slice(0, 100);

  // 7b. Compute onboard credits (goal: "Grow the Network")
  // If a qualified agent's creator wallet holds your token, you get onboard credit
  if (goal && goal.metric === 'onboards') {
    for (const agent of allAgents) {
      const credits: OnboardCredit[] = [];
      // Check each other agent's creator wallet — do they hold this agent's token?
      for (const other of allAgents) {
        if (other.tokenAddress === agent.tokenAddress) continue;
        const otherCreator = other.creator.toLowerCase();
        const held = walletHoldings.get(otherCreator);
        if (held && held.has(agent.tokenAddress.toLowerCase())) {
          credits.push({
            agentAddress: other.tokenAddress,
            agentName: other.name,
          });
        }
      }
      agent.onboards = credits;
      agent.goalScore = computeOnboardGoalScore(credits.length);
    }
    console.log(`[pipeline] onboard credits computed for ${allAgents.length} agents`);
  }

  // 8. Score and sort agents
  const scoredAgents = allAgents
    .map((a) => ({ ...a, powerScore: computePowerScore(a, goalWeight, a.goalScore) }))
    .sort((a, b) => b.powerScore.total - a.powerScore.total);

  // 9. Resolve banner images (cached in KV, generates missing ones via fal.ai)
  await resolveBanners(env, scoredAgents);

  // Store in KV
  const state: NetworkState = {
    agents: scoredAgents,
    swaps: trimmedSwaps,
    crossEdges,
    goal,
    timestamp: Date.now(),
  };

  await storeState(env, state);
  console.log(`[pipeline] complete: ${scoredAgents.length} agents, ${trimmedSwaps.length} swaps, ${crossEdges.length} edges`);
}

async function storeState(env: Env, state: NetworkState): Promise<void> {
  await env.NETWORK_KV.put('network:state', JSON.stringify(state), {
    expirationTtl: 3600, // 1 hour TTL, cron refreshes every 2 min
  });
}
