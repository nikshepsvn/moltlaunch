import { create } from 'zustand';

export interface TokenDetails {
  mcapEth: number;
  priceChange: number;
  vol24hEth: number;
  totalHolders: number;
}

export interface TokenData {
  tokenId: string;
  address: string;
  name?: string;
  symbol?: string;
  image?: string;
  description?: string;
  websiteUrl?: string | null;
  marketCapETH?: string;
  createdAt?: number;
  details?: TokenDetails;
  _dead?: boolean;
  _enriching?: boolean;
}

export type SortBy = 'mcap' | 'vol24h' | 'change24h' | 'holders' | 'name';

export interface LogLine {
  msg: string;
  cls: string;
}

interface TokenState {
  tokens: TokenData[];
  loading: boolean;
  error: string | null;
  ethUsdPrice: number;
  totalMcapEth: number;

  logs: LogLine[];
  progress: number;
  progressLabel: string;

  discoveryStarted: boolean;

  searchQuery: string;
  sortBy: SortBy;
  filterMcap: number;
  filterHolders: number;
  filterWebsite: boolean;

  // Actions
  setTokens: (tokens: TokenData[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setEthUsdPrice: (price: number) => void;
  updateTotalMcap: () => void;
  addLog: (msg: string, cls?: string) => void;
  setProgress: (progress: number, label: string) => void;
  setSearchQuery: (query: string) => void;
  setSortBy: (sort: SortBy) => void;
  setFilterMcap: (value: number) => void;
  setFilterHolders: (value: number) => void;
  setFilterWebsite: (value: boolean) => void;
  markDiscoveryStarted: () => void;

  // Immutable token update — replaces a token by tokenId
  updateToken: (tokenId: string, patch: Partial<TokenData>) => void;
  updateTokens: (patches: Array<{ tokenId: string; patch: Partial<TokenData> }>) => void;
}

export const useTokenStore = create<TokenState>((set, get) => ({
  tokens: [],
  loading: true,
  error: null,
  ethUsdPrice: 0,
  totalMcapEth: 0,

  logs: [],
  progress: 0,
  progressLabel: 'initializing...',

  discoveryStarted: false,

  searchQuery: '',
  sortBy: 'mcap',
  filterMcap: 0,
  filterHolders: 0,
  filterWebsite: false,

  setTokens: (tokens) => set({ tokens }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setEthUsdPrice: (ethUsdPrice) => set({ ethUsdPrice }),
  addLog: (msg, cls = 'dim') => set((s) => ({ logs: [...s.logs, { msg, cls }] })),
  setProgress: (progress, progressLabel) => set({ progress, progressLabel }),

  updateTotalMcap: () => {
    const totalMcapEth = get().tokens.reduce(
      (sum, t) => sum + (t.details?.mcapEth || 0),
      0,
    );
    set({ totalMcapEth });
  },

  updateToken: (tokenId, patch) => {
    set((s) => ({
      tokens: s.tokens.map((t) =>
        t.tokenId === tokenId ? { ...t, ...patch } : t
      ),
    }));
  },

  updateTokens: (patches) => {
    set((s) => {
      const patchMap = new Map(patches.map((p) => [p.tokenId, p.patch]));
      return {
        tokens: s.tokens.map((t) => {
          const patch = patchMap.get(t.tokenId);
          return patch ? { ...t, ...patch } : t;
        }),
      };
    });
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSortBy: (sortBy) => set({ sortBy }),
  setFilterMcap: (filterMcap) => set({ filterMcap }),
  setFilterHolders: (filterHolders) => set({ filterHolders }),
  setFilterWebsite: (filterWebsite) => set({ filterWebsite }),
  markDiscoveryStarted: () => set({ discoveryStarted: true }),
}));
