import { ethers } from "ethers";
import {
  FLAUNCH_DATA_API_BASE,
  CHAIN,
  REVENUE_MANAGER_ADDRESS,
} from "../lib/config.js";
import { fetchWorkerState } from "../lib/network-api.js";
import { printError } from "../lib/output.js";
import { EXIT_CODES } from "../lib/errors.js";
import type {
  NetworkAgent,
  NetworkAgentRich,
  SwapEvent,
  WorkerNetworkState,
} from "../types.js";

const REVENUE_MANAGER_ABI = [
  "function balances(address) external view returns (uint256)",
];

type SortField = "power" | "mcap" | "volume" | "holders" | "newest";

interface NetworkOpts {
  json: boolean;
  sort: SortField;
  limit: number;
}

interface FlaunchListToken {
  tokenAddress: string;
  symbol: string;
  name: string;
  positionManager: string;
  marketCapETH: string;
  createdAt: number;
  image: string;
  description: string;
  creator?: string;
}

interface FlaunchListResponse {
  data: FlaunchListToken[];
  pagination: { limit: number; offset: number };
}

function formatEth(value: number): string {
  if (value >= 1) return `${value.toFixed(4)} ETH`;
  if (value >= 0.001) return `${value.toFixed(6)} ETH`;
  if (value === 0) return "0 ETH";
  return `${value.toExponential(2)} ETH`;
}

function formatEthWei(wei: bigint): string {
  const eth = parseFloat(ethers.formatEther(wei));
  return formatEth(eth);
}

function formatMarketCap(marketCapWei: string): string {
  try {
    const eth = parseFloat(ethers.formatEther(BigInt(marketCapWei)));
    if (eth >= 1_000) return `${(eth / 1_000).toFixed(1)}k ETH`;
    if (eth >= 1) return `${eth.toFixed(2)} ETH`;
    if (eth >= 0.001) return `${eth.toFixed(4)} ETH`;
    return `${eth.toExponential(2)} ETH`;
  } catch {
    return "—";
  }
}

function truncate(addr: string): string {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function powerBar(score: number): string {
  const filled = Math.round(score / 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

function sortAgents(agents: NetworkAgentRich[], field: SortField): NetworkAgentRich[] {
  const sorted = [...agents];
  switch (field) {
    case "power":
      return sorted.sort((a, b) => b.powerScore.total - a.powerScore.total);
    case "mcap":
      return sorted.sort((a, b) => b.marketCapETH - a.marketCapETH);
    case "volume":
      return sorted.sort((a, b) => b.volume24hETH - a.volume24hETH);
    case "holders":
      return sorted.sort((a, b) => b.holders - a.holders);
    case "newest":
      // No explicit createdAt in worker data — reverse the default order
      return sorted.reverse();
  }
}

/** Find the most recent memo for each token from the swaps array */
function buildMemoMap(swaps: SwapEvent[]): Map<string, string> {
  const map = new Map<string, string>();
  // Swaps are assumed newest-first; take the first memo per token
  for (const swap of swaps) {
    if (swap.memo && !map.has(swap.tokenAddress)) {
      map.set(swap.tokenAddress, swap.memo);
    }
  }
  return map;
}

/** Fetch all moltlaunch tokens from Flaunch data API (fallback) */
async function fetchAllTokensFallback(): Promise<FlaunchListToken[]> {
  const all: FlaunchListToken[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const url = `${FLAUNCH_DATA_API_BASE}/v1/base/tokens?managerAddress=${REVENUE_MANAGER_ADDRESS}&orderBy=datecreated&orderDirection=desc&limit=${limit}&offset=${offset}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Flaunch API error: ${res.status}`);

    const json = (await res.json()) as FlaunchListResponse;
    const batch = json.data;
    if (batch.length === 0) break;

    all.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }

  return all;
}

/** Render rich agent output from worker data */
function renderRichOutput(
  agents: NetworkAgentRich[],
  memoMap: Map<string, string>,
  opts: NetworkOpts,
): void {
  let sorted = sortAgents(agents, opts.sort);
  if (opts.limit > 0) sorted = sorted.slice(0, opts.limit);

  console.log(`\nthe moltlaunch network — ${agents.length} agent(s)\n`);

  sorted.forEach((agent, i) => {
    const rank = i + 1;
    const score = agent.powerScore.total;
    const bar = powerBar(score);
    const memo = memoMap.get(agent.tokenAddress);

    console.log(`  #${rank}  ${agent.name} (${agent.symbol})${" ".repeat(Math.max(1, 36 - agent.name.length - agent.symbol.length))}${bar} ${score}`);
    console.log(`      MCap: ${formatEth(agent.marketCapETH)} · Vol 24h: ${formatEth(agent.volume24hETH)} · ${agent.holders} holders`);
    console.log(`      Fees: ${formatEth(agent.claimableETH)} · Creator: ${truncate(agent.creator)}`);
    if (memo) console.log(`      Last memo: "${memo}"`);
    console.log(`      Token: ${agent.tokenAddress}`);
    console.log();
  });

  console.log(`${sorted.length} agent(s) shown${sorted.length < agents.length ? ` of ${agents.length} total` : ""}\n`);
}

/** Render fallback output (basic data only, no scores) */
async function renderFallback(tokens: FlaunchListToken[], json: boolean): Promise<void> {
  const provider = new ethers.JsonRpcProvider(CHAIN.mainnet.rpcUrl);
  const rm = new ethers.Contract(REVENUE_MANAGER_ADDRESS, REVENUE_MANAGER_ABI, provider);

  const creators = [...new Set(tokens.map((t) => t.creator).filter(Boolean))] as string[];
  const feeMap = new Map<string, bigint>();

  for (let i = 0; i < creators.length; i += 10) {
    const batch = creators.slice(i, i + 10);
    const results = await Promise.allSettled(
      batch.map(async (addr) => {
        const balance = (await rm.balances(addr)) as bigint;
        return { addr, balance };
      }),
    );
    for (const result of results) {
      if (result.status === "fulfilled") {
        feeMap.set(result.value.addr, result.value.balance);
      }
    }
  }

  const agents: NetworkAgent[] = tokens.map((t) => {
    const creator = t.creator ?? "unknown";
    const claimable = feeMap.get(creator) ?? 0n;
    return {
      tokenAddress: t.tokenAddress,
      name: t.name || "unnamed",
      symbol: t.symbol || "???",
      creator,
      marketCapETH: formatMarketCap(t.marketCapETH),
      claimableETH: formatEthWei(claimable),
      image: t.image || "",
    };
  });

  if (json) {
    console.log(JSON.stringify({ success: true, count: agents.length, agents }, null, 2));
    return;
  }

  console.log(`\nthe moltlaunch network — ${agents.length} agent(s) (basic mode)\n`);

  for (const agent of agents) {
    console.log(`  ${agent.name} (${agent.symbol})`);
    console.log(`    Token:     ${agent.tokenAddress}`);
    console.log(`    Creator:   ${truncate(agent.creator)}`);
    console.log(`    MCap:      ${agent.marketCapETH}`);
    console.log(`    Fees:      ${agent.claimableETH}`);
    console.log(`    Trade:     ${CHAIN.mainnet.flaunchUrl}/coin/${agent.tokenAddress}`);
    console.log();
  }

  console.log(`${agents.length} agent(s) on the moltlaunch network\n`);
}

export async function network(opts: NetworkOpts): Promise<void> {
  const { json } = opts;

  try {
    // Try worker API first for rich data
    let workerState: WorkerNetworkState | null = null;
    try {
      workerState = await fetchWorkerState();
    } catch {
      if (!json) console.log("Worker unavailable, falling back to basic mode...\n");
    }

    if (workerState && workerState.agents.length > 0) {
      if (json) {
        let sorted = sortAgents(workerState.agents, opts.sort);
        if (opts.limit > 0) sorted = sorted.slice(0, opts.limit);
        console.log(JSON.stringify({
          success: true,
          count: sorted.length,
          totalCount: workerState.agents.length,
          agents: sorted,
        }, null, 2));
        return;
      }

      const memoMap = buildMemoMap(workerState.swaps);
      renderRichOutput(workerState.agents, memoMap, opts);
      return;
    }

    // Fallback: direct Flaunch API
    if (!json) console.log("\nDiscovering moltlaunch agents...\n");

    const tokens = await fetchAllTokensFallback();
    if (tokens.length === 0) {
      if (json) {
        console.log(JSON.stringify({ success: true, agents: [], count: 0 }));
      } else {
        console.log("No agents found. Be the first: npx moltlaunch launch\n");
      }
      return;
    }

    if (!json) console.log(`Found ${tokens.length} agent(s). Fetching fees...\n`);
    await renderFallback(tokens, json);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    printError(message, json, EXIT_CODES.GENERAL);
    process.exit(EXIT_CODES.GENERAL);
  }
}
