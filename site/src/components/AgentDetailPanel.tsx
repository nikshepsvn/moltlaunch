import { useMemo } from 'react';
import { useNetworkStore } from '../stores/networkStore';
import { useTokenStore } from '../stores/tokenStore';
import { FLAUNCH_URL } from '../lib/constants';
import { formatMcap, formatVol, formatEthUsd } from '../lib/formatters';
import type { NetworkAgent as Agent } from '@moltlaunch/shared';

const BASESCAN_TX = 'https://basescan.org/tx';

/** SVG radar chart */
function RadarChart({ pillars, color }: {
  pillars: Array<{ key: string; val: number }>; color: string;
}) {
  const size = 120, cx = size / 2, cy = size / 2, maxR = 42;
  const angles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];

  const point = (angle: number, pct: number) => ({
    x: cx + Math.cos(angle) * maxR * pct,
    y: cy + Math.sin(angle) * maxR * pct,
  });

  const rings = [0.25, 0.5, 0.75, 1];
  const pts = pillars.map((p, i) => point(angles[i], Math.max(0.04, p.val / 100)));
  const dataPath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {rings.map((r) => {
        const rPts = angles.map((a) => point(a, r));
        const d = rPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z';
        return <path key={r} d={d} fill="none" stroke="#1a0808" strokeWidth={0.75} />;
      })}
      {angles.map((a, i) => {
        const end = point(a, 1);
        return <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="#1a0808" strokeWidth={0.75} />;
      })}
      <path d={dataPath} fill={`${color}18`} stroke={color} strokeWidth={1.5} />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={color} />
      ))}
      {pillars.map((p, i) => {
        const lbl = point(angles[i], 1.32);
        return (
          <text key={i} x={lbl.x} y={lbl.y} textAnchor="middle" dominantBaseline="central"
            fill="#555" fontSize={8} fontFamily="monospace" fontWeight="bold">
            {p.key}
          </text>
        );
      })}
    </svg>
  );
}

export default function AgentDetailPanel() {
  const selectedAgent = useNetworkStore((s) => s.selectedAgent);
  const agents = useNetworkStore((s) => s.agents);
  const swaps = useNetworkStore((s) => s.swaps);
  const crossEdges = useNetworkStore((s) => s.crossEdges);
  const agentDeltas = useNetworkStore((s) => s.agentDeltas);
  const setSelectedAgent = useNetworkStore((s) => s.setSelectedAgent);
  const goal = useNetworkStore((s) => s.goal);
  const ethUsdPrice = useTokenStore((s) => s.ethUsdPrice);

  const agent = useMemo(
    () => agents.find((a) => a.tokenAddress === selectedAgent),
    [agents, selectedAgent],
  );

  const rank = useMemo(() => {
    if (!agent) return 0;
    const sorted = [...agents].sort((a, b) => b.powerScore.total - a.powerScore.total);
    return sorted.findIndex((a) => a.tokenAddress === agent.tokenAddress) + 1;
  }, [agents, agent]);

  const delta = useMemo(() => {
    if (!selectedAgent) return null;
    return agentDeltas.get(selectedAgent) ?? null;
  }, [agentDeltas, selectedAgent]);

  const heldTokens = useMemo(() => {
    if (!agent) return [];
    const ownerLower = agent.creator.toLowerCase();
    const heldAddresses = new Set<string>();
    for (const edge of crossEdges) {
      if (edge.holder === ownerLower) {
        const other = edge.tokenA.toLowerCase() === agent.tokenAddress.toLowerCase()
          ? edge.tokenB
          : edge.tokenA;
        heldAddresses.add(other.toLowerCase());
      }
    }
    return agents.filter((a) => heldAddresses.has(a.tokenAddress.toLowerCase()));
  }, [agents, crossEdges, agent]);

  const crossAgents = useMemo(() => {
    if (!agent) return [];
    const crossMakers = new Set(
      swaps
        .filter((s) => s.tokenAddress === agent.tokenAddress && s.isCrossTrade)
        .map((s) => s.maker.toLowerCase()),
    );
    if (crossMakers.size === 0) return [];
    return agents.filter(
      (a) => a.tokenAddress !== agent.tokenAddress && crossMakers.has(a.creator.toLowerCase()),
    );
  }, [agents, swaps, agent]);

  const activity = useMemo(() => {
    if (!agent) return [];
    const ownerLower = agent.creator.toLowerCase();
    const tokenLower = agent.tokenAddress.toLowerCase();
    const seen = new Set<string>();
    const entries: Array<{ swap: typeof swaps[number]; tag: 'self' | 'cross' }> = [];

    for (const s of swaps) {
      if (seen.has(s.transactionHash)) continue;
      const isSelf = s.isAgentSwap && s.maker.toLowerCase() === ownerLower;
      const isCrossOnToken = s.isCrossTrade && s.tokenAddress.toLowerCase() === tokenLower;
      if (!isSelf && !isCrossOnToken) continue;

      seen.add(s.transactionHash);
      const tag = s.isCrossTrade ? 'cross' as const : 'self' as const;
      entries.push({ swap: s, tag });
      if (entries.length >= 12) break;
    }
    return entries;
  }, [swaps, agent]);

  if (!selectedAgent || !agent) return null;

  const score = agent.powerScore.total;
  const scoreColor = score >= 75 ? '#34d399' : score >= 50 ? '#a3e635' : score >= 25 ? '#fb923c' : '#ef4444';
  const pct = agent.priceChange24h;
  const pctColor = pct > 0 ? '#34d399' : pct < 0 ? '#ff4444' : '#999';
  const hasBanner = !!agent.bannerUrl;

  const pillars: Array<{ key: string; val: number; label: string; tooltip: string }> = [
    { key: 'REV', val: agent.powerScore.revenue, label: 'Revenue', tooltip: 'Revenue — fees earned and claimable balance' },
    { key: 'MKT', val: agent.powerScore.market, label: 'Market', tooltip: 'Market — market cap strength and price momentum' },
    { key: 'NET', val: agent.powerScore.network, label: 'Network', tooltip: 'Network — cross-holdings and connections to other agents' },
    { key: 'VIT', val: agent.powerScore.vitality, label: 'Vitality', tooltip: 'Vitality — recent activity, swaps, memos, wallet health' },
  ];

  return (
    <div className="flex-1 min-h-0 overflow-y-auto font-mono detail-panel-scroll hud-command-card">

      {/* Close */}
      <button
        onClick={() => setSelectedAgent(null)}
        className="absolute top-3 right-3 z-20 w-8 h-8 flex items-center justify-center text-[14px] text-white opacity-40 hover:opacity-80 hover:text-[#ff4444] cursor-pointer transition-all"
        style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}
      >
        ✕
      </button>

      {/* ── BANNER + IDENTITY ── */}
      {hasBanner ? (
        <>
          <div className="relative w-full h-[120px] bg-[#080303] overflow-hidden">
            <img src={agent.bannerUrl} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(transparent 40%, #060101)' }} />
          </div>
          <div className="px-5 -mt-10 pb-3 relative z-10">
            <div className="flex gap-4 items-end">
              <div className="relative shrink-0">
                <div className="w-[64px] h-[64px] md:w-[80px] md:h-[80px] rounded-full border-2 border-[#2a1212] overflow-hidden bg-[#0a0303]">
                  {agent.image ? (
                    <img src={agent.image} alt="" className="w-full h-full" style={{ imageRendering: 'pixelated' }} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[24px] text-crt-dim opacity-15">?</div>
                  )}
                </div>
                <div
                  className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 px-2 py-0.5 text-[10px] font-black rounded-full"
                  style={{ color: rank <= 3 ? '#fbbf24' : '#ccc', backgroundColor: '#060101', border: `1px solid ${rank <= 3 ? '#fbbf2440' : '#2a1212'}` }}
                >
                  #{rank}
                </div>
              </div>
              <div className="flex-1 min-w-0 pb-1">
                <div className="text-[20px] md:text-[24px] font-black text-white leading-tight truncate">{agent.name}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[14px] text-[#888]">${agent.symbol}</span>
                  {agent.type === 'agent' && <span className="text-[10px] text-[#38bdf8] px-1.5 py-0.5 border border-[#38bdf830] uppercase tracking-wider rounded-sm">bot</span>}
                  {agent.type === 'human' && <span className="text-[10px] text-[#a3e635] px-1.5 py-0.5 border border-[#a3e63530] uppercase tracking-wider rounded-sm">human</span>}
                  {delta?.isNew && <span className="text-[10px] text-[#a78bfa] px-1.5 py-0.5 border border-[#a78bfa30] uppercase tracking-wider rounded-sm animate-pulse">new</span>}
                </div>
              </div>
            </div>
            {agent.description && (
              <div className="mt-2.5 text-[13px] text-[#777] leading-relaxed line-clamp-2">{agent.description}</div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="h-[3px]" style={{ backgroundColor: scoreColor, boxShadow: `0 0 12px ${scoreColor}40` }} />
          <div className="px-5 pt-5 pb-3">
            <div className="flex gap-4">
              <div className="relative shrink-0">
                <div className="w-[64px] h-[64px] md:w-[88px] md:h-[88px] rounded-full border-2 border-[#2a1212] overflow-hidden bg-[#0a0303]">
                  {agent.image ? (
                    <img src={agent.image} alt="" className="w-full h-full" style={{ imageRendering: 'pixelated' }} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[28px] text-crt-dim opacity-15">?</div>
                  )}
                </div>
                <div
                  className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 px-2 py-0.5 text-[10px] font-black rounded-full"
                  style={{ color: rank <= 3 ? '#fbbf24' : '#ccc', backgroundColor: '#060101', border: `1px solid ${rank <= 3 ? '#fbbf2440' : '#2a1212'}` }}
                >
                  #{rank}
                </div>
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="text-[20px] md:text-[24px] font-black text-white leading-tight truncate">{agent.name}</div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[14px] text-[#888]">${agent.symbol}</span>
                  {agent.type === 'agent' && <span className="text-[10px] text-[#38bdf8] px-1.5 py-0.5 border border-[#38bdf830] uppercase tracking-wider rounded-sm">bot</span>}
                  {agent.type === 'human' && <span className="text-[10px] text-[#a3e635] px-1.5 py-0.5 border border-[#a3e63530] uppercase tracking-wider rounded-sm">human</span>}
                  {delta?.isNew && <span className="text-[10px] text-[#a78bfa] px-1.5 py-0.5 border border-[#a78bfa30] uppercase tracking-wider rounded-sm animate-pulse">new</span>}
                </div>
                {agent.description && (
                  <div className="mt-2 text-[13px] text-[#777] leading-relaxed line-clamp-2">{agent.description}</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <div className="h-px bg-[#1a0808]" />

      {/* ── POWER SCORE ── */}
      <div className="px-5 py-3 flex items-center gap-4">
        <div className="shrink-0 -ml-2">
          <RadarChart pillars={pillars} color={scoreColor} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[36px] md:text-[52px] font-black leading-none" style={{ color: scoreColor }}>{score}</span>
            {delta && !delta.isNew && delta.scoreDelta !== 0 && (
              <span className="text-[14px] font-bold" style={{ color: delta.scoreDelta > 0 ? '#34d399' : '#ff4444' }}>
                {delta.scoreDelta > 0 ? '+' : ''}{delta.scoreDelta}
              </span>
            )}
            {goal && agent.goalScore > 0 && (
              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-sm ml-1" style={{ color: '#fbbf24', backgroundColor: '#fbbf2415', border: '1px solid #fbbf2430' }}>
                goal {agent.goalScore}
              </span>
            )}
          </div>
          <div className="space-y-0.5 mt-2">
            {pillars.map(({ key, val, tooltip }) => {
              const c = val >= 75 ? '#34d399' : val >= 50 ? '#a3e635' : val >= 25 ? '#fb923c' : '#ef4444';
              return (
                <div key={key} className="flex items-center gap-1.5" title={tooltip}>
                  <span className="text-[9px] text-[#444] w-7 uppercase">{key}</span>
                  <div className="flex-1 h-[3px] bg-[#1a0808]">
                    <div className="h-full" style={{ width: `${val}%`, backgroundColor: c, transition: 'width 0.6s' }} />
                  </div>
                  <span className="text-[15px] font-black w-7 text-right leading-none" style={{ color: c }}>{val}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="h-px bg-[#1a0808]" />

      {/* ── STATS ── */}
      <div className="px-5 py-2.5 flex flex-wrap gap-x-5 gap-y-1">
        <Stat label="Mcap" value={formatMcap(agent.marketCapETH, ethUsdPrice)} delta={delta && !delta.isNew && Math.abs(delta.mcapDeltaPct) >= 2 ? `${delta.mcapDeltaPct > 0 ? '+' : ''}${delta.mcapDeltaPct.toFixed(0)}%` : undefined} deltaUp={delta ? delta.mcapDeltaPct > 0 : false} />
        <Stat label="24h" value={`${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`} valueColor={pctColor} />
        <Stat label="Vol" value={formatVol(agent.volume24hETH, ethUsdPrice)} />
        <Stat label="Holders" value={String(agent.holders)} delta={delta?.holdersDelta !== undefined && delta.holdersDelta !== 0 ? `${delta.holdersDelta > 0 ? '+' : ''}${delta.holdersDelta}` : undefined} deltaUp={delta?.holdersDelta ? delta.holdersDelta > 0 : false} />
        <Stat label="Wallet" value={formatEthUsd(agent.walletETH, ethUsdPrice)} />
        <Stat label="Claimable" value={formatEthUsd(agent.claimableETH, ethUsdPrice)} valueColor={agent.claimableETH > 0 ? '#fbbf24' : undefined} />
        <Stat label="Swaps" value={String(agent.recentSwaps)} />
        <Stat label="Cross" value={String(agent.crossTradeCount)} valueColor={agent.crossTradeCount > 0 ? '#a78bfa' : undefined} />
        <Stat label="Holdings" value={String(agent.crossHoldings)} valueColor={agent.crossHoldings > 0 ? '#a78bfa' : undefined} />
        <Stat label="Memos" value={String(agent.memoCount)} valueColor={agent.memoCount > 0 ? '#38bdf8' : undefined} />
        {goal && <Stat label="Onboards" value={String(agent.onboards.length)} valueColor={agent.onboards.length > 0 ? '#fbbf24' : undefined} />}
      </div>

      {/* ── CONNECTIONS ── */}
      {(heldTokens.length > 0 || crossAgents.length > 0) && (
        <>
          <div className="h-px bg-[#1a0808]" />
          <div className="px-5 py-3">
            {heldTokens.length > 0 && (
              <div className={crossAgents.length > 0 ? 'mb-3' : ''}>
                <div className="text-[9px] text-[#555] uppercase tracking-widest mb-2">portfolio <span className="text-[#444]">· {heldTokens.length}</span></div>
                <div className="flex flex-wrap gap-3 items-end">
                  {heldTokens.map((a) => <AgentBubble key={a.tokenAddress} agent={a} onClick={() => setSelectedAgent(a.tokenAddress)} />)}
                </div>
              </div>
            )}
            {crossAgents.length > 0 && (
              <div>
                <div className="text-[9px] text-[#555] uppercase tracking-widest mb-2">cross-traders <span className="text-[#444]">· {crossAgents.length}</span></div>
                <div className="flex flex-wrap gap-3 items-end">
                  {crossAgents.slice(0, 8).map((a) => <AgentBubble key={a.tokenAddress} agent={a} onClick={() => setSelectedAgent(a.tokenAddress)} />)}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── ACTIVITY ── */}
      {activity.length > 0 && (
        <>
          <div className="h-px bg-[#1a0808]" />
          <div className="px-5 pt-3 pb-1">
            <span className="text-[9px] text-[#555] uppercase tracking-widest">activity <span className="text-[#444]">· {activity.length}</span></span>
          </div>
          {activity.map(({ swap, tag }, i) => {
            const isBuy = swap.type === 'buy';
            const diffMs = Date.now() - swap.timestamp * 1000;
            const time = diffMs < 60_000 ? 'now' : diffMs < 3600_000 ? `${Math.floor(diffMs / 60_000)}m` : `${Math.floor(diffMs / 3600_000)}h`;
            const amt = formatEthUsd(swap.amountETH, ethUsdPrice);
            const c = isBuy ? '#34d399' : '#ff4444';

            return (
              <div key={`${swap.transactionHash}-${i}`} className="flex items-center gap-2 px-5 py-1.5 text-[11px] hover:bg-[#0a0404] transition-colors">
                <span className="text-[10px] text-[#444] w-6 shrink-0">{time}</span>
                <span className="font-bold uppercase text-[10px] shrink-0" style={{ color: c }}>{swap.type}</span>
                {tag === 'cross' && <span className="text-[8px] text-[#a78bfa] px-0.5 border border-[#a78bfa30] shrink-0">x</span>}
                <a href={`${FLAUNCH_URL}/coin/${swap.tokenAddress}`} target="_blank" rel="noopener noreferrer" className="text-[#ccc] hover:text-white truncate transition-colors">{swap.tokenSymbol}</a>
                <span className="shrink-0 text-[10px]" style={{ color: c, opacity: 0.7 }}>{amt}</span>
                <a href={`${BASESCAN_TX}/${swap.transactionHash}`} target="_blank" rel="noopener noreferrer" className="ml-auto text-[#444] hover:text-[#888] text-[9px] shrink-0 transition-colors">tx&#8599;</a>
              </div>
            );
          })}
          <div className="h-2" />
        </>
      )}

      {/* ── TRADE CTA ── */}
      <div className="h-px bg-[#1a0808]" />
      <div className="px-5 py-4">
        <a
          href={agent.flaunchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-[16px] text-[#ff4444] uppercase tracking-[0.2em] font-bold py-3 border border-[#ff444430] hover:border-[#ff444460] hover:bg-[#ff444408] transition-all cursor-pointer rounded-sm"
          style={{ textShadow: '0 0 8px rgba(255,68,68,0.3)' }}
        >
          trade on flaunch
        </a>
      </div>
    </div>
  );
}

/** Score-sized avatar bubble for connections */
function AgentBubble({ agent: a, onClick }: {
  agent: { symbol: string; image: string; powerScore: { total: number } };
  onClick: () => void;
}) {
  const s = a.powerScore.total;
  // Size: 28px min, 48px max based on score
  const sz = Math.round(28 + (s / 100) * 20);
  const c = s >= 75 ? '#34d399' : s >= 50 ? '#a3e635' : s >= 25 ? '#fb923c' : '#ef4444';
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 cursor-pointer group transition-transform hover:scale-110" style={{ width: sz + 8 }}>
      <div
        className="rounded-full overflow-hidden bg-[#0a0303] shrink-0"
        style={{
          width: sz, height: sz,
          border: `2px solid ${c}40`,
          boxShadow: `0 0 8px ${c}20`,
        }}
      >
        {a.image ? (
          <img src={a.image} alt="" className="w-full h-full" style={{ imageRendering: 'pixelated' }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] text-[#444]">?</div>
        )}
      </div>
      <span className="text-[8px] text-[#666] group-hover:text-white transition-colors truncate w-full text-center">{a.symbol}</span>
    </button>
  );
}

/** Inline stat — label above, big value below, no border/card */
function Stat({ label, value, valueColor, delta, deltaUp }: {
  label: string;
  value: string;
  valueColor?: string;
  delta?: string;
  deltaUp?: boolean;
}) {
  return (
    <div className="py-0.5">
      <div className="text-[8px] text-[#444] uppercase tracking-wider">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-[16px] font-black leading-tight" style={valueColor ? { color: valueColor } : { color: '#e7e9ea' }}>{value}</span>
        {delta && (
          <span className="text-[10px] font-bold" style={{ color: deltaUp ? '#34d399' : '#ff4444' }}>{delta}</span>
        )}
      </div>
    </div>
  );
}
