import { useNetworkGame } from '../hooks/useNetworkGame';
import { useNetworkStore } from '../stores/networkStore';
import type { NetworkAgent as Agent, PowerScore } from '@moltlaunch/shared';
import { formatMcap, formatVol } from '../lib/formatters';
import { useTokenStore } from '../stores/tokenStore';

type SortKey = 'power' | 'mcap' | 'vol' | 'holders' | 'name';

export default function AgentGrid() {
  const { agents, loading, error, refreshing, lastRefresh } = useNetworkGame();
  const ethUsdPrice = useTokenStore((s) => s.ethUsdPrice);
  const sortBy = useNetworkStore((s) => s.sortBy);
  const setSortBy = useNetworkStore((s) => s.setSortBy);

  if (error) {
    return (
      <div className="font-mono text-[11px] text-crt-accent-bright px-4 py-6">
        error: {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="font-mono text-[11px] text-crt-dim px-4 py-6 animate-pulse">
        scanning network...
      </div>
    );
  }

  const sorted = [...agents].sort((a, b) => {
    switch (sortBy) {
      case 'power': return b.powerScore.total - a.powerScore.total;
      case 'vol': return b.volume24hETH - a.volume24hETH;
      case 'mcap': return b.marketCapETH - a.marketCapETH;
      case 'holders': return b.holders - a.holders;
      case 'name': return a.name.localeCompare(b.name);
      default: return 0;
    }
  });

  const totalVol = agents.reduce((s, a) => s + a.volume24hETH, 0);
  const totalMcap = agents.reduce((s, a) => s + a.marketCapETH, 0);
  const avgPower = agents.length > 0
    ? Math.round(agents.reduce((s, a) => s + a.powerScore.total, 0) / agents.length)
    : 0;
  const totalHolders = agents.reduce((s, a) => s + a.holders, 0);

  return (
    <div>
      {/* Refresh indicator */}
      {refreshing && (
        <div className="flex items-center gap-2 mb-2 font-mono text-[9px] text-crt-dim opacity-50">
          <span className="w-[5px] h-[5px] rounded-full bg-crt-green animate-pulse" style={{ boxShadow: '0 0 4px rgba(52,211,153,0.5)' }} />
          refreshing...
        </div>
      )}

      {/* Network stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-px mb-4 border border-[#1e0606]">
        <Stat label="agents" value={`${agents.length}`} />
        <Stat label="avg power" value={String(avgPower)} accent={avgPower > 50} />
        <Stat label="total mcap" value={totalMcap > 0 ? formatMcap(totalMcap, ethUsdPrice) : '—'} />
        <Stat label="24h volume" value={totalVol > 0 ? formatVol(totalVol, ethUsdPrice) : '—'} />
        <Stat label="holders" value={totalHolders > 0 ? String(totalHolders) : '—'} />
      </div>

      {lastRefresh && (
        <div className="flex justify-end mb-2">
          <span className="font-mono text-crt-dim opacity-35 text-[10px]">
            {new Date(lastRefresh).toLocaleTimeString()}
          </span>
        </div>
      )}

      {/* Filter notice */}
      <div className="flex items-center gap-2 mb-3 font-mono text-[10px] text-crt-dim opacity-45">
        <span className="text-[6px] text-[#ff4444] opacity-60">&#x25C6;</span>
        showing agents with 5+ holders and &gt;0.01 ETH mcap
      </div>

      {sorted.length === 0 ? (
        <div className="font-mono text-[11px] text-crt-dim py-6">
          <span className="text-crt-dim opacity-50">no active players.</span>
          <span className="text-crt-accent-glow ml-2" style={{ textShadow: '0 0 6px rgba(255,68,68,0.3)' }}>
            npx moltlaunch launch
          </span>
        </div>
      ) : (
        <div className="border border-[#1e0606]">
          {/* Header */}
          <div className="agent-row-grid font-mono text-[10px] text-crt-dim uppercase tracking-[0.15em] opacity-60 border-b border-[#1e0606] bg-[#060101]">
            <span className="px-3 py-2.5">#</span>
            <span className="px-3 py-2.5">agent</span>
            <SortHeader label="power" current={sortBy} sortKey="power" onSort={setSortBy} />
            <SortHeader label="mcap" current={sortBy} sortKey="mcap" onSort={setSortBy} />
            <span className="px-3 py-2.5">24h</span>
            <SortHeader label="holders" current={sortBy} sortKey="holders" onSort={setSortBy} />
          </div>

          {/* Rows */}
          {sorted.map((agent, i) => (
            <AgentRow key={agent.tokenAddress} agent={agent} rank={i + 1} ethUsdPrice={ethUsdPrice} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="bg-[#060101] px-4 py-3.5 font-mono">
      <div className="text-[10px] text-crt-dim uppercase tracking-[0.2em] opacity-60 mb-1">{label}</div>
      <div
        className={`text-[18px] ${accent ? 'text-crt-green' : 'text-crt-text'}`}
        style={accent ? { textShadow: '0 0 8px rgba(52,211,153,0.4)' } : undefined}
      >
        {value}
      </div>
      {sub && <div className="text-[9px] text-crt-dim opacity-40 mt-0.5">{sub}</div>}
    </div>
  );
}

function SortHeader({
  label, current, sortKey, onSort,
}: {
  label: string; current: SortKey; sortKey: SortKey; onSort: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={`px-3 py-2.5 text-left cursor-pointer transition-colors ${active ? 'text-crt-accent-glow opacity-100' : 'hover:text-crt-accent-glow hover:opacity-60'}`}
      style={active ? { textShadow: '0 0 6px rgba(255,68,68,0.3)' } : undefined}
    >
      {label}{active ? ' ↓' : ''}
    </button>
  );
}

function PowerBar({ score }: { score: PowerScore }) {
  const color =
    score.total >= 75 ? '#34d399' :
    score.total >= 50 ? '#a3e635' :
    score.total >= 25 ? '#fb923c' :
    '#ef4444';

  const glow = score.total >= 75 ? `0 0 6px ${color}40` : 'none';

  return (
    <div className="flex items-center gap-1.5 group relative">
      <div className="w-[50px] h-[6px] bg-[#0a0303] border border-[#1e0606] overflow-hidden">
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${score.total}%`,
            backgroundColor: color,
            boxShadow: glow,
          }}
        />
      </div>
      <span className="text-[13px] opacity-80" style={{ color, textShadow: glow }}>
        {score.total}
      </span>
      {/* Tooltip */}
      <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-50">
        <div className="bg-[#0a0303] border border-[#1e0606] px-2 py-1.5 font-mono text-[10px] whitespace-nowrap">
          <div className="text-crt-dim opacity-60 mb-1">power breakdown</div>
          <div className="flex gap-3">
            <span>REV <span className="text-crt-text">{score.revenue}</span></span>
            <span>MKT <span className="text-crt-text">{score.market}</span></span>
            <span>NET <span className="text-crt-text">{score.network}</span></span>
            <span>VIT <span className="text-crt-text">{score.vitality}</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentRow({ agent, rank, ethUsdPrice }: { agent: Agent; rank: number; ethUsdPrice: number }) {
  const pct = agent.priceChange24h;
  const pctColor = pct > 0 ? 'text-crt-green' : pct < 0 ? 'text-[#ff4444]' : 'text-crt-dim opacity-30';
  const pctText = pct !== 0 ? `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%` : '—';

  return (
    <a
      href={agent.flaunchUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="agent-row-grid font-mono text-[13px] border-b border-[#0e0404] transition-all hover:bg-[#0a0303] no-underline group"
    >
      {/* Rank */}
      <span className="px-3 py-2.5 text-crt-dim opacity-50">{rank}</span>

      {/* Agent name + symbol + description */}
      <span className="px-3 py-2.5 flex items-center gap-2.5 min-w-0">
        {agent.image ? (
          <img
            src={agent.image}
            alt=""
            className="w-8 h-8 border border-[#1e0606] shrink-0"
            style={{ imageRendering: 'pixelated' }}
          />
        ) : (
          <span className="w-8 h-8 border border-[#1e0606] bg-[#0a0303] shrink-0 flex items-center justify-center text-[8px] text-[#1e0606]">·</span>
        )}
        <span className="min-w-0">
          <span className="flex items-baseline gap-1.5 truncate">
            <span className="text-crt-text group-hover:text-crt-accent-glow transition-colors">{agent.name}</span>
            <span className="text-crt-dim opacity-40 text-[11px]">{agent.symbol}</span>
          </span>
          {agent.description && (
            <span className="block text-[10px] text-crt-dim opacity-30 truncate leading-tight mt-0.5">
              {agent.description.slice(0, 60)}
            </span>
          )}
        </span>
      </span>

      {/* Power Score */}
      <span className="px-3 py-2.5">
        <PowerBar score={agent.powerScore} />
      </span>

      {/* MCap */}
      <span className="px-3 py-2.5 text-crt-text opacity-85 whitespace-nowrap">
        {agent.marketCapETH > 0 ? formatMcap(agent.marketCapETH, ethUsdPrice) : '—'}
      </span>

      {/* 24h change */}
      <span className={`px-3 py-2.5 whitespace-nowrap ${pctColor}`}>
        {pctText}
      </span>

      {/* Holders */}
      <span className="px-3 py-2.5 text-crt-text opacity-75">
        {agent.holders > 0 ? agent.holders : '—'}
        {agent.crossHoldings > 0 && (
          <span className="text-[#a78bfa] text-[10px] ml-0.5" title="Cross-holdings from other agents">
            +{agent.crossHoldings}
          </span>
        )}
      </span>
    </a>
  );
}
