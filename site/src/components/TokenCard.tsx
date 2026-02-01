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
      className="token-card border border-[#1e0606] bg-[#080202] p-3.5 flex flex-col items-center text-center gap-1.5 transition-all duration-200 relative overflow-hidden opacity-0 translate-y-1.5 animate-card-in no-underline hover:border-[#441111] hover:bg-[#0c0303]"
      style={{
        animationDelay: `${index * 0.04}s`,
      }}
    >
      {/* Top accent stripe */}
      <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-[#ff4444] to-transparent opacity-0 transition-opacity duration-200 card-stripe" />

      {/* Image */}
      {enriched && token.image ? (
        <img
          className="w-12 h-12 border border-[#1e0606] transition-all duration-200"
          src={token.image}
          alt={token.name}
          style={{ imageRendering: 'pixelated', filter: 'drop-shadow(0 0 6px rgba(255,68,68,0.15))' }}
        />
      ) : (
        <div className="w-12 h-12 border border-[#1e0606] bg-[#0a0303] flex items-center justify-center">
          <span className="text-[8px] text-[#1e0606] font-mono">···</span>
        </div>
      )}

      {/* Name / Symbol / Address */}
      <div className="text-[13px] text-crt-text leading-relaxed mt-0.5 font-mono">
        {enriched ? token.name : 'loading...'}
      </div>
      <div className="text-crt-accent-glow text-[14px] font-mono" style={{ textShadow: '0 0 10px rgba(255,68,68,0.5)' }}>
        {enriched ? token.symbol : '···'}
      </div>
      <div className="text-[10px] text-crt-dim font-mono opacity-50">
        {token.address ? truncateAddress(token.address) : 'resolving...'}
      </div>

      {/* Website */}
      {websiteHost && (
        <span
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(token.websiteUrl!, '_blank');
          }}
          className="inline-block text-[9px] text-crt-green border border-[rgba(52,211,153,0.15)] px-1.5 py-0.5 tracking-wide transition-all cursor-pointer font-mono hover:text-[#6ee7b7] hover:border-[rgba(52,211,153,0.3)] hover:bg-[rgba(52,211,153,0.04)]"
          style={{ textShadow: '0 0 6px rgba(52,211,153,0.2)' }}
        >
          {websiteHost}
        </span>
      )}

      {/* Mcap prominent */}
      <div className="w-full pt-2 border-t border-[#1e0606] mt-0.5">
        <div className="text-center mb-2">
          <span className="text-[9px] text-crt-dim uppercase tracking-[0.15em] opacity-40 font-mono">mcap</span>
          <div className="text-[18px] font-mono text-crt-accent-glow mt-0.5" style={{ textShadow: '0 0 12px rgba(255,68,68,0.5)' }}>
            {mcapEth > 0 ? formatMcap(mcapEth, ethUsdPrice) : '—'}
          </div>
        </div>

        {/* Secondary stats */}
        <div className="grid grid-cols-3 gap-1">
          <MetaItem label="24h" value={d?.mcapEth ? ch.text : '—'} loading={isLoading} cls={ch.cls} />
          <MetaItem label="vol" value={d?.vol24hEth !== undefined ? formatVol(d.vol24hEth, ethUsdPrice) : '—'} loading={isLoading} />
          <MetaItem label="holders" value={d?.totalHolders ? String(d.totalHolders) : '—'} loading={isLoading} />
        </div>
      </div>
    </a>
  );
}

function MetaItem({ label, value, loading, cls }: { label: string; value: string; loading?: boolean; cls?: string }) {
  const colorCls =
    cls === 'positive' ? 'text-crt-green' :
    cls === 'negative' ? 'text-crt-accent-bright' :
    cls === 'neutral' ? 'text-crt-dim' : 'text-crt-text';

  return (
    <div className="flex flex-col items-center gap-px">
      <span className="text-[9px] text-crt-dim uppercase tracking-[0.15em] opacity-40 font-mono">{label}</span>
      <span className={`text-[12px] font-mono ${colorCls} ${loading ? 'animate-shimmer' : ''}`}>
        {value}
      </span>
    </div>
  );
}
