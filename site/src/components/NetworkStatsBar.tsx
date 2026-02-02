import { useMemo } from 'react';
import { useNetworkStore } from '../stores/networkStore';
import { useTokenStore } from '../stores/tokenStore';
import { formatMcap, formatVol } from '../lib/formatters';

interface Props {
  onRefresh: () => void;
  canRefresh: boolean;
  refreshCooldown: number;
}

export default function NetworkStatsBar({ onRefresh, canRefresh, refreshCooldown }: Props) {
  const agents = useNetworkStore((s) => s.agents);
  const swaps = useNetworkStore((s) => s.swaps);
  const refreshing = useNetworkStore((s) => s.refreshing);
  const ethUsdPrice = useTokenStore((s) => s.ethUsdPrice);

  const totalMcap = useMemo(() => agents.reduce((s, a) => s + a.marketCapETH, 0), [agents]);
  const totalVol = useMemo(() => agents.reduce((s, a) => s + a.volume24hETH, 0), [agents]);
  const avgPower = useMemo(
    () =>
      agents.length > 0
        ? Math.round(agents.reduce((s, a) => s + a.powerScore.total, 0) / agents.length)
        : 0,
    [agents],
  );
  const agentSwapCount = useMemo(
    () => swaps.filter((s) => s.isAgentSwap || s.isCrossTrade).length,
    [swaps],
  );

  const isDisabled = refreshing || !canRefresh;

  return (
    <div className="shrink-0 border-b border-[#1e0606] hud-panel">
      <div className="flex items-stretch font-mono">
        {/* Stats — each stat is a cell with clear label/value */}
        <StatCell label="agents" value={String(agents.length)} />
        <StatCell
          label="avg power"
          value={String(avgPower)}
          accent={avgPower > 50}
        />
        <StatCell
          label="total mcap"
          value={totalMcap > 0 ? formatMcap(totalMcap, ethUsdPrice) : '—'}
        />
        <StatCell
          label="24h volume"
          value={totalVol > 0 ? formatVol(totalVol, ethUsdPrice) : '—'}
        />
        <StatCell
          label="agent txs"
          value={String(agentSwapCount)}
          accent={agentSwapCount > 0}
        />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Refresh */}
        <div className="flex items-center px-3 border-l border-[#1e0606]">
          <button
            onClick={onRefresh}
            disabled={isDisabled}
            className={`whitespace-nowrap font-mono text-[9px] uppercase tracking-wider px-3 py-1 border transition-all ${
              isDisabled
                ? 'text-crt-dim opacity-25 cursor-not-allowed border-[#1e0606]'
                : 'text-crt-green opacity-70 hover:opacity-100 cursor-pointer border-[#1e0606] hover:border-[#2a1212] hover:bg-[#0a0505]'
            }`}
            style={!isDisabled ? { textShadow: '0 0 6px rgba(52,211,153,0.2)' } : undefined}
          >
            {refreshing ? (
              <span className="flex items-center gap-1.5">
                <span
                  className="w-[4px] h-[4px] rounded-full bg-crt-green animate-pulse"
                  style={{ boxShadow: '0 0 4px rgba(52,211,153,0.5)' }}
                />
                syncing
              </span>
            ) : refreshCooldown > 0 ? (
              <span>{refreshCooldown}s</span>
            ) : (
              'refresh'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col justify-center px-4 py-2 border-r border-[#1e0606] min-w-[80px]">
      <span className="text-[7px] uppercase tracking-[0.2em] text-crt-dim opacity-35 mb-0.5">{label}</span>
      <span
        className={`text-[15px] leading-none font-mono ${accent ? 'text-crt-green' : 'text-crt-text opacity-85'}`}
        style={accent ? { textShadow: '0 0 8px rgba(52,211,153,0.3)' } : undefined}
      >
        {value}
      </span>
    </div>
  );
}
