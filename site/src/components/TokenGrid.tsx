import { useMemo } from 'react';
import { useTokenStore } from '../stores/tokenStore';
import { useFilteredTokens } from '../hooks/useFilters';
import { usePagination } from '../hooks/usePagination';
import { useEnrichTokens } from '../hooks/useEnrichTokens';
import TokenCard from './TokenCard';
import Pagination from './Pagination';
import ControlsBar from './ControlsBar';
import LoadingTerminal from './LoadingTerminal';

export default function TokenGrid() {
  const tokens = useTokenStore((s) => s.tokens);
  const loading = useTokenStore((s) => s.loading);
  const error = useTokenStore((s) => s.error);

  const filtered = useFilteredTokens();
  const { page, currentPage, totalPages, nextPage, prevPage } = usePagination(filtered);

  // Build a stable set of visible token IDs for the enrichment coordinator
  const visibleIds = useMemo(
    () => new Set(page.map((t) => t.tokenId)),
    [page],
  );

  // Single enrichment coordinator — prioritizes visible tokens, aborts on page change
  useEnrichTokens(visibleIds);

  if (loading) {
    return <LoadingTerminal />;
  }

  if (error) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <pre
            className="font-mono text-[14px] sm:text-[18px] leading-[1.15] text-center select-none mb-6"
            style={{ color: '#ff4444', opacity: 0.3, textShadow: '0 0 10px rgba(255,68,68,0.3)' }}
          >
{`┏┳┓┓ ╺┳╸┓
┃┃┃┃  ┃ ┃
╹ ╹┗━╸╹ ┗━╸`}
          </pre>
          <div className="font-mono text-[10px] text-crt-accent-glow mb-2" style={{ textShadow: '0 0 8px rgba(255,68,68,0.4)' }}>
            connection failed
          </div>
          <div className="font-mono text-[9px] text-crt-dim opacity-40 max-w-[300px] text-center leading-relaxed">
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <pre
            className="font-mono text-[14px] sm:text-[18px] leading-[1.15] text-center select-none mb-6"
            style={{ color: '#ff4444', opacity: 0.3, textShadow: '0 0 10px rgba(255,68,68,0.3)' }}
          >
{`┏┳┓┓ ╺┳╸┓
┃┃┃┃  ┃ ┃
╹ ╹┗━╸╹ ┗━╸`}
          </pre>
          <div className="font-mono text-[9px] text-crt-dim opacity-40 tracking-[0.15em]">
            no tokens launched yet
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <ControlsBar tokenCount={filtered.length} totalCount={tokens.length} />

      {filtered.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center">
            <pre
              className="font-mono text-[10px] sm:text-[12px] leading-[1.15] text-center select-none mb-4"
              style={{ color: '#ff4444', opacity: 0.15 }}
            >
{`┏┳┓┓ ╺┳╸┓
┃┃┃┃  ┃ ┃
╹ ╹┗━╸╹ ┗━╸`}
            </pre>
            <div className="font-mono text-[9px] text-crt-dim opacity-40 tracking-[0.15em]">
              no tokens match filters
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {page.map((token, i) => (
            <TokenCard key={token.tokenId} token={token} index={i} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPrev={prevPage}
          onNext={nextPage}
        />
      )}
    </>
  );
}
