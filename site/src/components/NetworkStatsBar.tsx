import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { useNetworkStore } from '../stores/networkStore';
import { useTokenStore } from '../stores/tokenStore';
import { formatMcap, formatVol } from '../lib/formatters';
import { FULL_REFRESH_INTERVAL } from '../lib/constants';

interface Props {
  onRefresh: () => void;
  canRefresh: boolean;
  refreshCooldown: number;
}

interface StatDelta {
  value: number;
  timestamp: number;
}

const DELTA_VISIBLE_MS = 10_000;

export default function NetworkStatsBar({ onRefresh, canRefresh, refreshCooldown }: Props) {
  const agents = useNetworkStore((s) => s.agents);
  const swaps = useNetworkStore((s) => s.swaps);
  const refreshing = useNetworkStore((s) => s.refreshing);
  const lastRefresh = useNetworkStore((s) => s.lastRefresh);
  const goal = useNetworkStore((s) => s.goal);
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

  const prevValuesRef = useRef<{ agents: number; avgPower: number; totalMcap: number; totalVol: number; agentSwaps: number } | null>(null);
  const [deltas, setDeltas] = useState<Record<string, StatDelta>>({});

  useEffect(() => {
    const prev = prevValuesRef.current;
    if (prev) {
      const now = Date.now();
      const newDeltas: Record<string, StatDelta> = {};
      const agentsDiff = agents.length - prev.agents;
      const powerDiff = avgPower - prev.avgPower;
      const mcapDiff = totalMcap - prev.totalMcap;
      const volDiff = totalVol - prev.totalVol;
      const swapDiff = agentSwapCount - prev.agentSwaps;

      if (agentsDiff !== 0) newDeltas.agents = { value: agentsDiff, timestamp: now };
      if (powerDiff !== 0) newDeltas.avgPower = { value: powerDiff, timestamp: now };
      if (mcapDiff !== 0) newDeltas.totalMcap = { value: mcapDiff > 0 ? 1 : -1, timestamp: now };
      if (volDiff !== 0) newDeltas.totalVol = { value: volDiff > 0 ? 1 : -1, timestamp: now };
      if (swapDiff !== 0) newDeltas.agentSwaps = { value: swapDiff, timestamp: now };

      if (Object.keys(newDeltas).length > 0) setDeltas(newDeltas);
    }
    prevValuesRef.current = { agents: agents.length, avgPower, totalMcap, totalVol, agentSwaps: agentSwapCount };
  }, [agents.length, avgPower, totalMcap, totalVol, agentSwapCount]);

  useEffect(() => {
    if (Object.keys(deltas).length === 0) return;
    const timer = setTimeout(() => setDeltas({}), DELTA_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [deltas]);

  const [countdown, setCountdown] = useState<number | null>(null);
  const updateCountdown = useCallback(() => {
    if (!lastRefresh) { setCountdown(null); return; }
    const elapsed = Date.now() - lastRefresh;
    const remaining = Math.max(0, Math.ceil((FULL_REFRESH_INTERVAL - elapsed) / 1000));
    setCountdown(remaining);
  }, [lastRefresh]);

  useEffect(() => {
    updateCountdown();
    const id = setInterval(updateCountdown, 1000);
    return () => clearInterval(id);
  }, [updateCountdown]);

  const recentSwapRate = useMemo(() => {
    const cutoff = Date.now() - 120_000;
    const recentCount = swaps.filter((s) => (s.isAgentSwap || s.isCrossTrade) && s.timestamp * 1000 > cutoff).length;
    return Math.min(1, recentCount / 10);
  }, [swaps]);

  const isDisabled = refreshing || !canRefresh;

  return (
    <div className="shrink-0 border-b border-[#1e0606] hud-panel font-mono">
      {/* Active goal banner */}
      <div
        className="flex items-center gap-3 px-4 py-2 border-b border-[#1e0606]"
        style={{ background: 'linear-gradient(90deg, rgba(251,191,36,0.04), transparent 60%)' }}
      >
        <span
          className="w-[5px] h-[5px] rounded-full shrink-0"
          style={{ background: '#fbbf24', boxShadow: '0 0 6px rgba(251,191,36,0.5)', animation: 'status-pulse 2s ease-in-out infinite' }}
        />
        <span className="text-[10px] text-[#fbbf24] opacity-50 uppercase tracking-[0.2em] shrink-0">active goal</span>
        <span className="text-[12px] md:text-[13px] text-[#fbbf24] tracking-wide" style={{ textShadow: '0 0 8px rgba(251,191,36,0.2)' }}>
          {goal ? goal.name : 'MANDATE #001 — DOMAIN EXPANSION'}
        </span>
        <span className="text-[10px] text-[#fbbf24] opacity-25 hidden md:inline ml-auto shrink-0">
          {goal?.description || 'grow the network — recruit new agents'}
        </span>
      </div>

      {/* Top bar — LIVE beacon left, scan button right */}
      <div className="flex items-center h-8 px-4 border-b border-[#0e0404]">
        <div className="flex items-center gap-2">
          <span
            className="w-[7px] h-[7px] rounded-full bg-crt-green"
            style={{ boxShadow: '0 0 6px rgba(52,211,153,0.6)', animation: 'status-pulse 1.5s ease-in-out infinite' }}
          />
          <span className="text-[11px] text-crt-green tracking-[0.2em] font-bold" style={{ textShadow: '0 0 6px rgba(52,211,153,0.3)' }}>LIVE</span>
          <div className="flex items-center gap-[2px] ml-1">
            {[0, 1, 2, 3, 4].map((i) => {
              const active = recentSwapRate > i / 5;
              return (
                <div
                  key={i}
                  className="w-[3px] transition-all duration-300"
                  style={{
                    height: `${5 + i * 1.5}px`,
                    backgroundColor: active ? '#34d399' : '#1e0606',
                    boxShadow: active ? '0 0 3px rgba(52,211,153,0.4)' : 'none',
                    opacity: active ? 0.8 : 0.3,
                  }}
                />
              );
            })}
          </div>
        </div>

        <div className="flex-1" />

        {countdown !== null && countdown > 0 && !refreshing && (
          <span className="text-[12px] text-crt-dim opacity-25 tabular-nums mr-3">next scan {countdown}s</span>
        )}
        <button
          onClick={onRefresh}
          disabled={isDisabled}
          className={`text-[12px] uppercase tracking-wider px-2 py-0.5 border transition-all ${
            isDisabled
              ? 'text-crt-dim opacity-20 cursor-not-allowed border-[#1e0606]'
              : 'text-crt-green opacity-60 hover:opacity-100 cursor-pointer border-[#1e0606] hover:border-[#34d39940] hover:bg-[#34d39908]'
          }`}
          style={!isDisabled ? { textShadow: '0 0 4px rgba(52,211,153,0.2)' } : undefined}
        >
          {refreshing ? (
            <span className="flex items-center gap-1">
              <span className="w-[3px] h-[3px] rounded-full bg-crt-green" style={{ boxShadow: '0 0 4px rgba(52,211,153,0.5)', animation: 'status-pulse 0.8s ease-in-out infinite' }} />
              syncing
            </span>
          ) : refreshCooldown > 0 ? (
            <span className="tabular-nums">{refreshCooldown}s</span>
          ) : (
            'scan'
          )}
        </button>
      </div>

      {/* Stats — horizontal scroll on mobile, grid on desktop */}
      <div className="flex md:grid md:grid-cols-5 md:divide-x divide-[#0e0404] overflow-x-auto">
        <StatCell label="Players" value={String(agents.length)} delta={deltas.agents} />
        <StatCell label="Avg Power" value={String(avgPower)} accent={avgPower > 50} delta={deltas.avgPower} />
        <StatCell label="Total Mcap" value={totalMcap > 0 ? formatMcap(totalMcap, ethUsdPrice) : '\u2014'} delta={deltas.totalMcap} />
        <StatCell label="24h Volume" value={totalVol > 0 ? formatVol(totalVol, ethUsdPrice) : '\u2014'} delta={deltas.totalVol} />
        <StatCell label="Agent Txs" value={String(agentSwapCount)} accent={agentSwapCount > 0} delta={deltas.agentSwaps} />
      </div>
    </div>
  );
}

function StatCell({ label, value, accent, delta }: { label: string; value: string; accent?: boolean; delta?: StatDelta }) {
  const hasDelta = delta && delta.value !== 0;
  const isPositive = hasDelta && delta.value > 0;

  return (
    <div className="flex flex-col items-center justify-center py-3 shrink-0 px-4 md:px-0">
      <span
        className={`text-[18px] md:text-[24px] leading-none tabular-nums font-bold ${accent ? 'text-crt-green' : 'text-crt-text'}`}
        style={accent ? { textShadow: '0 0 8px rgba(52,211,153,0.3)' } : undefined}
      >
        {value}
        {hasDelta && (
          <span
            className={`text-[14px] ml-1 ${isPositive ? 'text-crt-green' : 'text-[#ff4444]'}`}
            style={{ textShadow: `0 0 4px ${isPositive ? 'rgba(52,211,153,0.4)' : 'rgba(255,68,68,0.4)'}` }}
          >
            {isPositive ? '\u2191' : '\u2193'}
            {typeof delta.value === 'number' && Math.abs(delta.value) > 1 ? Math.abs(delta.value) : ''}
          </span>
        )}
      </span>
      <span className="text-[11px] uppercase tracking-[0.12em] text-crt-dim opacity-40 mt-1.5">{label}</span>
    </div>
  );
}
