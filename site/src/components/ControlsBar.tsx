import { useRef, useCallback } from 'react';
import { useTokenStore, type SortBy } from '../stores/tokenStore';

interface ControlsBarProps {
  tokenCount: number;
  totalCount: number;
}

const MCAP_OPTIONS = [
  { label: 'all', value: 0 },
  { label: '>$1K', value: 1000 },
  { label: '>$10K', value: 10000 },
  { label: '>$100K', value: 100000 },
];

const HOLDER_OPTIONS = [
  { label: 'all', value: 0 },
  { label: '>10', value: 10 },
  { label: '>50', value: 50 },
  { label: '>100', value: 100 },
];

export default function ControlsBar({ tokenCount, totalCount }: ControlsBarProps) {
  const setSearchQuery = useTokenStore((s) => s.setSearchQuery);
  const setSortBy = useTokenStore((s) => s.setSortBy);
  const sortBy = useTokenStore((s) => s.sortBy);
  const filterMcap = useTokenStore((s) => s.filterMcap);
  const setFilterMcap = useTokenStore((s) => s.setFilterMcap);
  const filterHolders = useTokenStore((s) => s.filterHolders);
  const setFilterHolders = useTokenStore((s) => s.setFilterHolders);
  const filterWebsite = useTokenStore((s) => s.filterWebsite);
  const setFilterWebsite = useTokenStore((s) => s.setFilterWebsite);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchQuery(e.target.value.trim());
    }, 150);
  }, [setSearchQuery]);

  return (
    <div className="border-b border-[#1e0606] mb-4">
      {/* Header row */}
      <div className="panel-header justify-between">
        <span className="label">
          tokens
          <span className="text-[8px] text-crt-dim opacity-40 ml-2 normal-case tracking-widest">{tokenCount} of {totalCount}</span>
        </span>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-center px-4 py-2 bg-[#080202] max-sm:flex-col max-sm:items-stretch">
        <input
          type="text"
          placeholder="search..."
          onChange={handleSearch}
          className="flex-1 min-w-[140px] bg-[#050101] border border-[#1e0606] text-crt-text font-mono text-[10px] px-2.5 py-1.5 outline-none transition-all focus:border-[#441111] focus:shadow-[0_0_8px_rgba(255,68,68,0.1),inset_0_0_8px_rgba(255,68,68,0.03)] placeholder:text-crt-dim placeholder:opacity-40 max-sm:min-w-full"
        />

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="bg-[#050101] border border-[#1e0606] text-crt-text font-mono text-[10px] px-2 py-1.5 cursor-pointer outline-none appearance-none pr-6 focus:border-[#441111] focus:shadow-[0_0_8px_rgba(255,68,68,0.1),inset_0_0_8px_rgba(255,68,68,0.03)]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Cpath d='M0 2l4 4 4-4' fill='%23994444'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 0.5rem center',
          }}
        >
          <option value="mcap">mcap</option>
          <option value="vol24h">vol 24h</option>
          <option value="change24h">24h change</option>
          <option value="holders">holders</option>
          <option value="name">name A-Z</option>
        </select>

        <div className="w-px h-[14px] bg-[#1e0606] shrink-0 max-sm:hidden" />

        {/* Mcap filter */}
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-crt-dim opacity-40 uppercase tracking-wide whitespace-nowrap">mcap:</span>
          {MCAP_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilterMcap(opt.value)}
              className={`border font-mono text-[9px] px-1.5 py-0.5 cursor-pointer transition-all whitespace-nowrap ${
                filterMcap === opt.value
                  ? 'border-[#441111] text-crt-accent-glow bg-[rgba(255,68,68,0.06)]'
                  : 'border-[#1e0606] text-crt-dim opacity-50 hover:opacity-100 hover:text-crt-text'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Holders filter */}
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-crt-dim opacity-40 uppercase tracking-wide whitespace-nowrap">holders:</span>
          {HOLDER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilterHolders(opt.value)}
              className={`border font-mono text-[9px] px-1.5 py-0.5 cursor-pointer transition-all whitespace-nowrap ${
                filterHolders === opt.value
                  ? 'border-[#441111] text-crt-accent-glow bg-[rgba(255,68,68,0.06)]'
                  : 'border-[#1e0606] text-crt-dim opacity-50 hover:opacity-100 hover:text-crt-text'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Website filter */}
        <button
          onClick={() => setFilterWebsite(!filterWebsite)}
          className={`border font-mono text-[9px] px-1.5 py-0.5 cursor-pointer transition-all whitespace-nowrap ${
            filterWebsite
              ? 'border-[#441111] text-crt-accent-glow bg-[rgba(255,68,68,0.06)]'
              : 'border-[#1e0606] text-crt-dim opacity-50 hover:opacity-100 hover:text-crt-text'
          }`}
        >
          has website
        </button>
      </div>
    </div>
  );
}
