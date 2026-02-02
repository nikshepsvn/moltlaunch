import { useMemo } from 'react';
import { useNetworkStore } from '../stores/networkStore';
import { FLAUNCH_URL } from '../lib/constants';
import type { PowerScore } from '@moltlaunch/shared';

const BASESCAN_TX = 'https://basescan.org/tx';

export default function AgentDetailPanel() {
  const selectedAgent = useNetworkStore((s) => s.selectedAgent);
  const agents = useNetworkStore((s) => s.agents);
  const swaps = useNetworkStore((s) => s.swaps);
  const crossEdges = useNetworkStore((s) => s.crossEdges);
  const setSelectedAgent = useNetworkStore((s) => s.setSelectedAgent);

  const agent = useMemo(
    () => agents.find((a) => a.tokenAddress === selectedAgent),
    [agents, selectedAgent],
  );

  // Tokens held by this agent's wallet (from crossEdges)
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

  // Agents whose creators have cross-traded this token
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

  // Agent actions: this agent's own txs + cross-trades involving this token
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
      if (entries.length >= 15) break;
    }
    return entries;
  }, [swaps, agent]);

  if (!selectedAgent || !agent) return null;

  const scoreColor =
    agent.powerScore.total >= 75 ? '#34d399' :
    agent.powerScore.total >= 50 ? '#a3e635' :
    agent.powerScore.total >= 25 ? '#fb923c' :
    '#ef4444';

  const pct = agent.priceChange24h;
  const pctColor = pct > 0 ? '#34d399' : pct < 0 ? '#ff4444' : '#666';

  return (
    <div className="absolute top-0 right-0 bottom-0 w-[360px] overflow-y-auto z-10 font-mono detail-panel-scroll hud-command-card">
      {/* Agent identity header */}
      <div className="relative px-5 pt-5 pb-4 hud-wireframe">
        <button
          onClick={() => setSelectedAgent(null)}
          className="absolute top-3 right-3 text-crt-dim opacity-25 hover:opacity-60 hover:text-[#ff4444] text-[12px] w-6 h-6 flex items-center justify-center cursor-pointer transition-all"
        >
          ✕
        </button>
        <div className="flex items-start gap-3.5">
          <div className="relative shrink-0">
            {agent.image ? (
              <img
                src={agent.image}
                alt=""
                className="w-12 h-12 border border-[#2a1212]"
                style={{ imageRendering: 'pixelated' }}
              />
            ) : (
              <div className="w-12 h-12 border border-[#2a1212] bg-[#0a0303] flex items-center justify-center text-crt-dim text-[10px]">
                ?
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[16px] text-crt-text truncate leading-tight">{agent.name}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-crt-dim opacity-35">{agent.symbol}</span>
              {agent.type === 'agent' && (
                <span className="text-[8px] text-[#38bdf8] px-1.5 py-px border border-[#38bdf820] uppercase tracking-wider" style={{ textShadow: '0 0 4px rgba(56,189,248,0.2)' }}>agent</span>
              )}
              {agent.type === 'human' && (
                <span className="text-[8px] text-[#a3e635] px-1.5 py-px border border-[#a3e63520] uppercase tracking-wider">human</span>
              )}
            </div>
            {agent.description && (
              <div className="text-[10px] text-crt-dim opacity-30 mt-1.5 leading-relaxed line-clamp-2">
                {agent.description}
              </div>
            )}
          </div>
        </div>

        {/* Key metrics row beneath name */}
        <div className="flex items-center gap-4 mt-3.5">
          <div className="flex items-center gap-1.5">
            <span
              className="text-[20px] font-bold"
              style={{ color: scoreColor, textShadow: `0 0 10px ${scoreColor}30` }}
            >
              {agent.powerScore.total}
            </span>
            <span className="text-[9px] text-crt-dim opacity-35 uppercase tracking-wider">pwr</span>
          </div>
          <div className="w-px h-4 bg-[#1e0606]" />
          <div>
            <span className="text-[13px] text-crt-text opacity-80">{formatEth(agent.marketCapETH)}</span>
            <span className="text-[9px] text-crt-dim opacity-30 ml-1">mcap</span>
          </div>
          <div className="w-px h-4 bg-[#1e0606]" />
          <span
            className="text-[13px]"
            style={{ color: pctColor }}
          >
            {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Power breakdown */}
      <div className="px-5 pt-4 pb-4 border-b border-[#0e0404]">
        <div className="hud-section-tab">influence</div>
        <PowerBar score={agent.powerScore} />
        <div className="grid grid-cols-4 gap-2 mt-3">
          <PillarStat label="REV" value={agent.powerScore.revenue} max={25} tooltip="Fee revenue generated" />
          <PillarStat label="MKT" value={agent.powerScore.market} max={25} tooltip="Market cap & liquidity" />
          <PillarStat label="NET" value={agent.powerScore.network} max={25} tooltip="Holders & cross-holdings" />
          <PillarStat label="VIT" value={agent.powerScore.vitality} max={25} tooltip="Recent activity & momentum" />
        </div>
        <div className="text-[8px] text-crt-dim opacity-25 mt-2.5 text-right tracking-wider">
          scoring subject to change
        </div>
      </div>

      {/* Economics */}
      <div className="px-5 pt-4 pb-4 border-b border-[#0e0404]">
        <div className="hud-section-tab">economics</div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-[11px]">
          <StatLine label="mcap" value={formatEth(agent.marketCapETH)} />
          <StatLine label="vol 24h" value={formatEth(agent.volume24hETH)} />
          <StatLine label="holders" value={String(agent.holders)} />
          <StatLine label="wallet" value={formatEth(agent.walletETH)} />
          <StatLine label="cross-hold" value={String(agent.crossHoldings)} accent={agent.crossHoldings > 0} />
          <StatLine
            label="24h"
            value={`${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`}
            color={pct > 0 ? 'text-crt-green' : pct < 0 ? 'text-[#ff4444]' : undefined}
          />
        </div>
      </div>

      {/* Holdings — tokens this agent's wallet holds */}
      {heldTokens.length > 0 && (
        <div className="px-5 pt-4 pb-4 border-b border-[#0e0404]">
          <div className="hud-section-tab">portfolio <span className="text-crt-dim opacity-30 ml-1 text-[8px] normal-case tracking-normal">{heldTokens.length} tokens</span></div>
          <div className="flex flex-wrap gap-1.5">
            {heldTokens.map((a) => (
              <a
                key={a.tokenAddress}
                href={`${FLAUNCH_URL}/coin/${a.tokenAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#0a0303] border border-[#1e0606] text-[11px] text-[#60a5fa] opacity-70 hover:opacity-100 hover:border-[#2a1212] hover:bg-[#0e0505] transition-all"
              >
                {a.image && (
                  <img src={a.image} alt="" className="w-3.5 h-3.5" style={{ imageRendering: 'pixelated' }} />
                )}
                {a.symbol}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Cross-agents trading this token */}
      {crossAgents.length > 0 && (
        <div className="px-5 pt-4 pb-4 border-b border-[#0e0404]">
          <div className="hud-section-tab">connected agents <span className="text-crt-dim opacity-30 ml-1 text-[8px] normal-case tracking-normal">{crossAgents.length} agents</span></div>
          <div className="flex flex-wrap gap-1.5">
            {crossAgents.slice(0, 8).map((a) => (
              <button
                key={a.tokenAddress}
                onClick={() => setSelectedAgent(a.tokenAddress)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#0a0303] border border-[#1e0606] text-[11px] text-crt-text opacity-70 hover:opacity-100 hover:border-[#2a1212] hover:bg-[#0e0505] cursor-pointer transition-all"
              >
                {a.image && (
                  <img src={a.image} alt="" className="w-3.5 h-3.5" style={{ imageRendering: 'pixelated' }} />
                )}
                {a.symbol}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Agent actions */}
      {activity.length > 0 && (
        <div className="px-5 pt-4 pb-4 border-b border-[#0e0404]">
          <div className="hud-section-tab">activity <span className="text-crt-dim opacity-30 ml-1 text-[8px] normal-case tracking-normal">{activity.length} txns</span></div>
          <div className="space-y-2">
            {activity.map(({ swap, tag }, i) => (
              <SwapRow key={`al-${swap.transactionHash}-${i}`} swap={swap} showToken={tag === 'self'} tag={tag} />
            ))}
          </div>
        </div>
      )}

      {/* Flaunch link */}
      <div className="px-5 py-5">
        <a
          href={agent.flaunchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-[11px] text-crt-accent-glow uppercase tracking-[0.15em] opacity-50 hover:opacity-100 transition-all border border-[#1e0606] hover:border-[#3a1818] px-3 py-3 hover:bg-[#0e0505]"
          style={{ textShadow: '0 0 6px rgba(255,68,68,0.2)' }}
        >
          view on flaunch →
        </a>
      </div>
    </div>
  );
}

function PowerBar({ score }: { score: PowerScore }) {
  const color =
    score.total >= 75 ? '#34d399' :
    score.total >= 50 ? '#a3e635' :
    score.total >= 25 ? '#fb923c' :
    '#ef4444';

  const glow = score.total >= 75 ? `0 0 8px ${color}40` : 'none';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 hud-health-bar">
        <div
          className="hud-health-fill"
          style={{ width: `${score.total}%`, backgroundColor: color, boxShadow: glow }}
        />
      </div>
      <span className="text-[16px] font-bold" style={{ color, textShadow: glow }}>
        {score.total}
      </span>
    </div>
  );
}

function PillarStat({ label, value, max, tooltip }: { label: string; value: number; max: number; tooltip?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  const color =
    pct >= 75 ? '#34d399' :
    pct >= 50 ? '#a3e635' :
    pct >= 25 ? '#fb923c' :
    '#ef4444';

  return (
    <div className="text-center bg-[#080303] border border-[#0e0404] px-2 py-2.5 cursor-default" title={tooltip}>
      <div className="text-[9px] text-crt-dim opacity-45 uppercase tracking-[0.15em] mb-1.5">{label}</div>
      <div
        className="text-[15px] mb-2"
        style={{ color, textShadow: pct >= 50 ? `0 0 6px ${color}30` : 'none' }}
      >
        {value}
      </div>
      <div className="h-[3px] bg-[#0a0303] overflow-hidden">
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color, boxShadow: pct >= 50 ? `0 0 4px ${color}40` : 'none' }}
        />
      </div>
    </div>
  );
}

function StatLine({ label, value, color, accent }: { label: string; value: string; color?: string; accent?: boolean }) {
  return (
    <div className="flex justify-between items-baseline py-0.5">
      <span className="text-crt-dim opacity-40 uppercase tracking-[0.1em] text-[10px]">{label}</span>
      <span className={`text-[12px] ${color ?? (accent ? 'text-[#a78bfa]' : 'text-crt-text opacity-85')}`}>
        {value}
      </span>
    </div>
  );
}

function SwapRow({ swap, showToken, tag }: { swap: { transactionHash: string; tokenAddress: string; tokenSymbol: string; timestamp: number; type: 'buy' | 'sell'; amountETH: number; makerName: string | null; isCrossTrade: boolean; memo: string | null }; showToken?: boolean; tag?: 'self' | 'cross' }) {
  const time = new Date(swap.timestamp * 1000);
  const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
  const isBuy = swap.type === 'buy';

  const badgeClass = tag === 'self' ? 'hud-badge-self' : 'hud-badge-cross';

  return (
    <div className="group py-1 border-b border-[#0a0303] last:border-0">
      <div className="flex items-center gap-1.5 text-[11px] opacity-65 group-hover:opacity-100 transition-opacity">
        {tag && <span className={`hud-badge ${badgeClass}`}>{tag}</span>}
        <span className="text-crt-dim opacity-35 text-[10px]">{timeStr}</span>
        {!showToken && swap.makerName && (
          <span className="text-crt-text opacity-45 truncate max-w-[80px] text-[10px]" title={swap.makerName}>
            {swap.makerName}
          </span>
        )}
        <span
          className={isBuy ? 'text-crt-green' : 'text-[#ff4444]'}
          style={{ textShadow: `0 0 4px ${isBuy ? 'rgba(52,211,153,0.3)' : 'rgba(255,68,68,0.3)'}` }}
        >
          {isBuy ? 'buy' : 'sell'}
        </span>
        {showToken && (
          <a
            href={`${FLAUNCH_URL}/coin/${swap.tokenAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-crt-text opacity-55 hover:opacity-100 transition-opacity"
          >
            {swap.tokenSymbol}
          </a>
        )}
        <span className="text-crt-dim opacity-35 text-[10px]">
          {swap.amountETH > 0 ? swap.amountETH.toFixed(4) : '0'} ETH
        </span>
        <a
          href={`${BASESCAN_TX}/${swap.transactionHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-crt-dim opacity-20 hover:opacity-60 hover:text-[#ff4444] transition-all ml-auto text-[9px]"
          title="View on Basescan"
        >
          tx↗
        </a>
      </div>
      {swap.memo && (
        <div className="ml-5 mt-1 mb-0.5 text-[10px] text-[#60a5fa] opacity-50 italic whitespace-pre-wrap break-words max-w-[280px] leading-relaxed">
          &ldquo;{swap.memo.slice(0, 80)}&rdquo;
        </div>
      )}
    </div>
  );
}

function formatEth(val: number): string {
  if (val <= 0) return '0';
  if (val >= 1) return val.toFixed(2) + ' ETH';
  if (val >= 0.01) return val.toFixed(3) + ' ETH';
  return val.toFixed(4) + ' ETH';
}
