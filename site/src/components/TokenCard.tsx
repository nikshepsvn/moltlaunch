import type { TokenData } from '../stores/tokenStore';
import { useTokenStore } from '../stores/tokenStore';
import { truncateAddress, formatMcap, formatVol, formatChange } from '../lib/formatters';
import { UNISWAP_URL } from '../lib/constants';

interface TokenCardProps {
  token: TokenData;
  index: number;
}

export default function TokenCard({ token, index }: TokenCardProps) {
  const ethUsdPrice = useTokenStore((s) => s.ethUsdPrice);
  const enriched = !!token.name;
  const d = token.details;
  const ch = formatChange(d?.priceChange || 0);
  const isLoading = enriched && !d;

  // Use list-level mcap before enrichment loads details
  const mcapEth = d?.mcapEth ?? (token.marketCapETH ? Number(token.marketCapETH) / 1e18 : 0);

  const href = token.address ? `${UNISWAP_URL}/${token.address}?inputCurrency=NATIVE` : '#';

  let websiteHost: string | null = null;
  if (token.websiteUrl) {
    try {
      websiteHost = new URL(token.websiteUrl).hostname.replace('www.', '');
    } catch { /* skip */ }
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="token-card border border-[#1e0606] bg-[#080202] p-4 flex flex-col text-left gap-1.5 transition-all duration-200 relative overflow-hidden opacity-0 translate-y-1.5 animate-card-in no-underline hover:border-[#441111] hover:bg-[#0c0303]"
      style={{
        animationDelay: `${index * 0.04}s`,
      }}
    >
      {/* Top accent stripe */}
      <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-[#ff4444] to-transparent opacity-0 transition-opacity duration-200 card-stripe" />

      {/* Header: image + text */}
      <div className="flex items-start gap-3">
        {/* Image */}
        {enriched && token.image ? (
          <img
            className="w-14 h-14 border border-[#1e0606] transition-all duration-200 shrink-0"
            src={token.image}
            alt={token.name}
            style={{ imageRendering: 'pixelated', filter: 'drop-shadow(0 0 6px rgba(255,68,68,0.15))' }}
          />
        ) : (
          <div className="w-14 h-14 border border-[#1e0606] bg-[#0a0303] flex items-center justify-center shrink-0">
            <span className="text-[8px] text-[#1e0606] font-mono">···</span>
          </div>
        )}

        {/* Name / Symbol / Address / Website */}
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="text-[14px] text-crt-text leading-snug font-mono opacity-90 truncate">
            {enriched ? token.name : 'loading...'}
          </div>
          <div className="text-crt-accent-glow text-[14px] font-mono" style={{ textShadow: '0 0 10px rgba(255,68,68,0.5)' }}>
            {enriched ? token.symbol : '···'}
          </div>
          <div className="text-[10px] text-crt-dim font-mono opacity-55">
            {token.address ? truncateAddress(token.address) : 'resolving...'}
          </div>
          {websiteHost && (
            <span
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.open(token.websiteUrl!, '_blank');
              }}
              className="inline-flex items-center gap-1 text-[10px] text-crt-green font-mono tracking-wide transition-all cursor-pointer hover:text-[#6ee7b7] mt-0.5 w-fit"
              style={{ textShadow: '0 0 6px rgba(52,211,153,0.2)' }}
            >
              ↗ {websiteHost}
            </span>
          )}
        </div>
      </div>

      {/* Mcap section */}
      <div className="w-full pt-2 border-t border-[#1e0606] mt-1">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[10px] text-crt-dim uppercase tracking-[0.15em] opacity-55 font-mono">mcap</span>
          <div className="text-[18px] font-mono text-crt-accent-glow" style={{ textShadow: '0 0 12px rgba(255,68,68,0.5)' }}>
            {mcapEth > 0 ? formatMcap(mcapEth, ethUsdPrice) : '—'}
          </div>
        </div>

        {/* Secondary stats — 2 col */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          <MetaItem label="24h" value={d?.mcapEth ? ch.text : '—'} loading={isLoading} cls={ch.cls} />
          <MetaItem label="vol" value={d?.vol24hEth !== undefined ? formatVol(d.vol24hEth, ethUsdPrice) : '—'} loading={isLoading} />
          <MetaItem label="holders" value={d?.totalHolders ? String(d.totalHolders) : '—'} loading={isLoading} />
        </div>
      </div>

      {/* Description */}
      {token.description && (
        <div className="text-[11px] text-crt-dim font-mono opacity-45 line-clamp-2 leading-relaxed mt-1">
          {token.description}
        </div>
      )}
    </a>
  );
}

function MetaItem({ label, value, loading, cls }: { label: string; value: string; loading?: boolean; cls?: string }) {
  const colorCls =
    cls === 'positive' ? 'text-crt-green' :
    cls === 'negative' ? 'text-crt-accent-bright' :
    cls === 'neutral' ? 'text-crt-dim' : 'text-crt-text';

  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[10px] text-crt-dim uppercase tracking-[0.15em] opacity-55 font-mono">{label}</span>
      <span className={`text-[13px] font-mono opacity-85 ${colorCls} ${loading ? 'animate-shimmer' : ''}`}>
        {value}
      </span>
    </div>
  );
}
