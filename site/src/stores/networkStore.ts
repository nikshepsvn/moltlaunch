import { create } from 'zustand';
import type { NetworkAgent as Agent, SwapEvent, CrossHoldingEdge } from '@moltlaunch/shared';

type SortKey = 'power' | 'mcap' | 'vol' | 'holders' | 'name';
type FilterType = 'all' | 'agents' | 'humans';

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

interface NetworkState {
  agents: Agent[];
  swaps: SwapEvent[];
  crossEdges: CrossHoldingEdge[];
  sortBy: SortKey;
  filterType: FilterType;
  selectedAgent: string | null;
  refreshing: boolean;
  lastRefresh: number | null;

  // Animation state
  animationQueue: SwapAnimation[];
  recentlyActiveNodes: Map<string, number>;

  setAgents: (agents: Agent[]) => void;
  setSwaps: (swaps: SwapEvent[]) => void;
  setCrossEdges: (edges: CrossHoldingEdge[]) => void;
  setSortBy: (key: SortKey) => void;
  setFilterType: (type: FilterType) => void;
  setSelectedAgent: (addr: string | null) => void;
  setRefreshing: (v: boolean) => void;
  setLastRefresh: (ts: number) => void;
  pushAnimations: (anims: SwapAnimation[]) => void;
  expireAnimations: () => void;
}

export const useNetworkStore = create<NetworkState>((set, get) => ({
  agents: [],
  swaps: [],
  crossEdges: [],
  sortBy: 'power',
  filterType: 'all',
  selectedAgent: null,
  refreshing: false,
  lastRefresh: null,
  animationQueue: [],
  recentlyActiveNodes: new Map(),

  setAgents: (agents) => set({ agents }),
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

      const ethStr = swap.amountETH > 0 ? swap.amountETH.toFixed(4) : '0';
      const action = swap.type === 'buy' ? 'bought' : 'sold';

      let targetNode: string | null = null;
      if (swap.isCrossTrade) {
        targetNode = creatorToToken.get(swap.maker.toLowerCase()) ?? null;
      }

      newAnims.push({
        id: swap.transactionHash,
        sourceNode: swap.tokenAddress,
        targetNode,
        label: `${action} ${swap.tokenSymbol} — ${ethStr} ETH`,
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
  setSelectedAgent: (selectedAgent) => set({ selectedAgent }),
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
