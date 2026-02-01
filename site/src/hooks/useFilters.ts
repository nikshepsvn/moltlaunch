import { useMemo } from 'react';
import { useTokenStore, type TokenData } from '../stores/tokenStore';

function mcapEth(t: TokenData): number {
  if (t.details?.mcapEth) return t.details.mcapEth;
  if (t.marketCapETH) return Number(t.marketCapETH) / 1e18;
  return 0;
}

function mcapUsd(t: TokenData, ethUsdPrice: number): number {
  const eth = mcapEth(t);
  return ethUsdPrice > 0 ? eth * ethUsdPrice : eth;
}

export function useFilteredTokens(): TokenData[] {
  const tokens = useTokenStore((s) => s.tokens);
  const searchQuery = useTokenStore((s) => s.searchQuery);
  const sortBy = useTokenStore((s) => s.sortBy);
  const filterMcap = useTokenStore((s) => s.filterMcap);
  const filterHolders = useTokenStore((s) => s.filterHolders);
  const filterWebsite = useTokenStore((s) => s.filterWebsite);
  const ethUsdPrice = useTokenStore((s) => s.ethUsdPrice);

  return useMemo(() => {
    const q = searchQuery.toLowerCase();
    const hasActiveFilter = q || filterMcap > 0 || filterHolders > 0 || filterWebsite;

    const filtered = tokens.filter((t) => {
      if (t._dead) return false;
      if (!t.name) return !hasActiveFilter;
      if (q && !t.name.toLowerCase().includes(q) && !(t.symbol ?? '').toLowerCase().includes(q)) return false;
      if (filterMcap > 0 && mcapUsd(t, ethUsdPrice) < filterMcap) return false;
      if (filterHolders > 0 && (t.details?.totalHolders || 0) < filterHolders) return false;
      if (filterWebsite && !t.websiteUrl) return false;
      return true;
    });

    filtered.sort((a, b) => {
      if (!a.name && !b.name) return 0;
      if (!a.name) return 1;
      if (!b.name) return -1;
      switch (sortBy) {
        case 'mcap': return mcapUsd(b, ethUsdPrice) - mcapUsd(a, ethUsdPrice);
        case 'vol24h': return (b.details?.vol24hEth || 0) - (a.details?.vol24hEth || 0);
        case 'change24h': return (b.details?.priceChange || 0) - (a.details?.priceChange || 0);
        case 'holders': return (b.details?.totalHolders || 0) - (a.details?.totalHolders || 0);
        case 'name': return a.name.localeCompare(b.name);
        default: return 0;
      }
    });

    return filtered;
  }, [tokens, searchQuery, sortBy, filterMcap, filterHolders, filterWebsite, ethUsdPrice]);
}
