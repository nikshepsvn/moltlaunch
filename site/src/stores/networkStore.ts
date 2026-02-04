import { create } from 'zustand';
import type { NetworkAgent as Agent, SwapEvent, CrossHoldingEdge, NetworkGoal } from '@moltlaunch/shared';
import { useTokenStore } from './tokenStore';
import { formatEthUsd } from '../lib/formatters';

type SortKey = 'power' | 'mcap' | 'vol' | 'holders' | 'name';
type FilterType = 'all' | 'agents' | 'humans';

export interface AgentDelta {
  rankDelta: number;       // positive = climbed ranks
  mcapDelta: number;       // ETH change
  mcapDeltaPct: number;    // percentage change
  scoreDelta: number;      // power score change
  holdersDelta: number;
  isNew: boolean;          // just appeared in this refresh
}

export interface ChangeFeedEntry {
  id: string;
  text: string;
  type: 'rank' | 'mcap' | 'new' | 'drop';
  timestamp: number;
}

export interface DeltaAnimation {
  type: 'gain' | 'loss' | 'new';
  startTime: number;
  value: number; // score delta (+/-) or 0 for new
}

export interface SwapAnimation {
  id: string;
  sourceNode: string;
  targetNode: string | null;
  label: string;
  type: 'buy' | 'sell';
  isCross: boolean;
  startTime: number;
  memoSnippet?: string;
}

const ANIMATION_TTL = 3000;
const MAX_ANIMATIONS = 10;
const MAX_FEED_ENTRIES = 10;
const DELTA_ANIMATION_TTL = 5000;
const DELTA_SCORE_THRESHOLD = 5; // minimum score change to trigger glow

function rankAgents(agents: Agent[]): Map<string, number> {
  const sorted = [...agents].sort((a, b) => b.powerScore.total - a.powerScore.total);
  const ranks = new Map<string, number>();
  sorted.forEach((a, i) => ranks.set(a.tokenAddress, i + 1));
  return ranks;
}

function computeDeltas(
  prev: Agent[],
  next: Agent[],
): { deltas: Map<string, AgentDelta>; feedEntries: ChangeFeedEntry[] } {
  const deltas = new Map<string, AgentDelta>();
  const feedEntries: ChangeFeedEntry[] = [];

  if (prev.length === 0) return { deltas, feedEntries };

  const prevRanks = rankAgents(prev);
  const nextRanks = rankAgents(next);
  const prevMap = new Map(prev.map((a) => [a.tokenAddress, a]));
  const now = Date.now();

  for (const agent of next) {
    const addr = agent.tokenAddress;
    const prevAgent = prevMap.get(addr);
    const prevRank = prevRanks.get(addr);
    const nextRank = nextRanks.get(addr) ?? next.length;

    if (!prevAgent) {
      // New agent
      deltas.set(addr, {
        rankDelta: 0,
        mcapDelta: 0,
        mcapDeltaPct: 0,
        scoreDelta: 0,
        holdersDelta: 0,
        isNew: true,
      });
      feedEntries.push({
        id: `new-${addr}-${now}`,
        text: `${agent.name} joined the network`,
        type: 'new',
        timestamp: now,
      });
      continue;
    }

    const rankDelta = (prevRank ?? prev.length) - nextRank; // positive = climbed
    const mcapDelta = agent.marketCapETH - prevAgent.marketCapETH;
    const mcapDeltaPct = prevAgent.marketCapETH > 0
      ? ((agent.marketCapETH - prevAgent.marketCapETH) / prevAgent.marketCapETH) * 100
      : 0;
    const scoreDelta = agent.powerScore.total - prevAgent.powerScore.total;
    const holdersDelta = agent.holders - prevAgent.holders;

    deltas.set(addr, {
      rankDelta,
      mcapDelta,
      mcapDeltaPct,
      scoreDelta,
      holdersDelta,
      isNew: false,
    });

    // Generate feed entries for significant changes
    if (Math.abs(rankDelta) >= 2) {
      const dir = rankDelta > 0 ? 'climbed' : 'dropped';
      feedEntries.push({
        id: `rank-${addr}-${now}`,
        text: `${agent.name} ${dir} to #${nextRank} (${rankDelta > 0 ? '↑' : '↓'}${Math.abs(rankDelta)})`,
        type: rankDelta > 0 ? 'rank' : 'drop',
        timestamp: now,
      });
    }

    if (Math.abs(mcapDeltaPct) >= 5) {
      const sign = mcapDeltaPct > 0 ? '+' : '';
      feedEntries.push({
        id: `mcap-${addr}-${now}`,
        text: `${agent.name} mcap ${sign}${mcapDeltaPct.toFixed(0)}%`,
        type: mcapDeltaPct > 0 ? 'mcap' : 'drop',
        timestamp: now,
      });
    }
  }

  return { deltas, feedEntries: feedEntries.slice(0, MAX_FEED_ENTRIES) };
}

type FilterPower = 'all' | '50+' | '75+';
type FilterActivity = 'all' | 'active';

interface NetworkState {
  agents: Agent[];
  previousAgents: Agent[];
  agentDeltas: Map<string, AgentDelta>;
  changeFeed: ChangeFeedEntry[];
  swaps: SwapEvent[];
  crossEdges: CrossHoldingEdge[];
  sortBy: SortKey;
  filterType: FilterType;
  filterPower: FilterPower;
  filterActivity: FilterActivity;
  searchQuery: string;
  selectedAgent: string | null;
  refreshing: boolean;
  lastRefresh: number | null;

  // Animation state
  animationQueue: SwapAnimation[];
  recentlyActiveNodes: Map<string, number>;
  deltaAnimations: Map<string, DeltaAnimation>;

  // Network goal
  goal: NetworkGoal | null;

  // Mobile panel state
  mobilePanelOpen: boolean;

  setGoal: (goal: NetworkGoal | null) => void;
  setAgents: (agents: Agent[]) => void;
  setSwaps: (swaps: SwapEvent[]) => void;
  setCrossEdges: (edges: CrossHoldingEdge[]) => void;
  setSortBy: (key: SortKey) => void;
  setFilterType: (type: FilterType) => void;
  setFilterPower: (v: FilterPower) => void;
  setFilterActivity: (v: FilterActivity) => void;
  setSearchQuery: (q: string) => void;
  setSelectedAgent: (addr: string | null) => void;
  setMobilePanelOpen: (open: boolean) => void;
  setRefreshing: (v: boolean) => void;
  setLastRefresh: (ts: number) => void;
  pushAnimations: (anims: SwapAnimation[]) => void;
  expireAnimations: () => void;
}

export const useNetworkStore = create<NetworkState>((set, get) => ({
  agents: [],
  previousAgents: [],
  agentDeltas: new Map(),
  changeFeed: [],
  swaps: [],
  crossEdges: [],
  sortBy: 'power',
  filterType: 'all',
  filterPower: 'all',
  filterActivity: 'all',
  searchQuery: '',
  selectedAgent: null,
  refreshing: false,
  lastRefresh: null,
  animationQueue: [],
  recentlyActiveNodes: new Map(),
  deltaAnimations: new Map(),
  goal: null,
  mobilePanelOpen: false,

  setGoal: (goal) => set({ goal }),
  setAgents: (agents) => {
    const prev = get().agents;
    const { deltas, feedEntries } = computeDeltas(prev, agents);

    // Build delta animations for significant power score changes
    const now = Date.now();
    const deltaAnims = new Map<string, DeltaAnimation>();
    for (const [addr, delta] of deltas) {
      if (delta.isNew) {
        deltaAnims.set(addr, { type: 'new', startTime: now, value: 0 });
      } else if (delta.scoreDelta >= DELTA_SCORE_THRESHOLD) {
        deltaAnims.set(addr, { type: 'gain', startTime: now, value: delta.scoreDelta });
      } else if (delta.scoreDelta <= -DELTA_SCORE_THRESHOLD) {
        deltaAnims.set(addr, { type: 'loss', startTime: now, value: delta.scoreDelta });
      }
    }

    set({
      previousAgents: prev,
      agents,
      agentDeltas: deltas,
      changeFeed: feedEntries,
      deltaAnimations: deltaAnims,
    });
  },

  setCrossEdges: (crossEdges) => set({ crossEdges }),

  setSwaps: (swaps) => {
    const prev = get().swaps;
    const prevHashes = new Set(prev.map((s) => s.transactionHash));
    const newAnims: SwapAnimation[] = [];

    // Build creator->token lookup for cross-trade edge detection
    const agents = get().agents;
    const creatorToToken = new Map<string, string>();
    for (const a of agents) {
      if (a.creator) creatorToToken.set(a.creator.toLowerCase(), a.tokenAddress);
    }

    for (const swap of swaps) {
      if (prevHashes.has(swap.transactionHash)) continue;
      if (newAnims.length >= MAX_ANIMATIONS) break;

      const ethPrice = useTokenStore.getState().ethUsdPrice;
      const amtStr = formatEthUsd(swap.amountETH, ethPrice);
      const action = swap.type === 'buy' ? 'bought' : 'sold';

      let targetNode: string | null = null;
      if (swap.isCrossTrade) {
        targetNode = creatorToToken.get(swap.maker.toLowerCase()) ?? null;
      }

      newAnims.push({
        id: swap.transactionHash,
        sourceNode: swap.tokenAddress,
        targetNode,
        label: `${action} ${swap.tokenSymbol} — ${amtStr}`,
        type: swap.type,
        isCross: swap.isCrossTrade,
        startTime: Date.now(),
        memoSnippet: swap.memo ?? undefined,
      });
    }

    // Track recently active nodes
    const now = Date.now();
    const nextActive = new Map(get().recentlyActiveNodes);
    for (const [nodeId, ts] of nextActive) {
      if (now - ts > 60_000) nextActive.delete(nodeId);
    }
    for (const anim of newAnims) {
      nextActive.set(anim.sourceNode, now);
      if (anim.targetNode) nextActive.set(anim.targetNode, now);
    }

    set({
      swaps,
      animationQueue: [...get().animationQueue, ...newAnims].slice(-MAX_ANIMATIONS),
      recentlyActiveNodes: nextActive,
    });
  },

  setSortBy: (sortBy) => set({ sortBy }),
  setFilterType: (filterType) => set({ filterType }),
  setFilterPower: (filterPower) => set({ filterPower }),
  setFilterActivity: (filterActivity) => set({ filterActivity }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSelectedAgent: (selectedAgent) => set({ selectedAgent }),
  setMobilePanelOpen: (mobilePanelOpen) => set({ mobilePanelOpen }),
  setRefreshing: (refreshing) => set({ refreshing }),
  setLastRefresh: (lastRefresh) => set({ lastRefresh }),

  pushAnimations: (anims) =>
    set((s) => ({
      animationQueue: [...s.animationQueue, ...anims].slice(-MAX_ANIMATIONS),
    })),

  expireAnimations: () =>
    set((s) => ({
      animationQueue: s.animationQueue.filter(
        (a) => Date.now() - a.startTime < ANIMATION_TTL,
      ),
    })),

}));
