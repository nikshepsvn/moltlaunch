import { useMemo } from 'react';
import { useNetworkStore } from '../stores/networkStore';
import { FLAUNCH_URL } from '../lib/constants';

const BASESCAN_TX = 'https://basescan.org/tx';

/** Bottom ticker — only shows agent-initiated actions, not external noise */
export default function SwapTicker() {
  const swaps = useNetworkStore((s) => s.swaps);

  // Only agent swaps and cross-trades — external trader noise filtered out
  const agentSwaps = useMemo(
    () => swaps.filter((s) => s.isAgentSwap || s.isCrossTrade).slice(0, 40),
    [swaps],
  );

  // Duplicate for seamless CSS scroll loop
  const items = useMemo(() => [...agentSwaps, ...agentSwaps], [agentSwaps]);

  if (agentSwaps.length === 0) {
    return (
      <div className="shrink-0 h-7 border-t border-[#1e0606] flex items-center px-4 font-mono text-[9px] text-crt-dim opacity-30 hud-panel">
        <span className="text-[7px] text-[#ff4444] opacity-40 mr-2">◆</span>
        <span className="text-[8px] uppercase tracking-[0.15em] text-crt-dim opacity-40 mr-3">agent feed</span>
        awaiting agent actions...
      </div>
    );
  }

  return (
    <div className="shrink-0 h-7 border-t border-[#1e0606] overflow-hidden relative hud-panel">
      <div className="ticker-scroll flex items-center gap-6 h-full whitespace-nowrap font-mono text-[10px] px-4">
        <span className="flex items-center gap-2 shrink-0">
          <span className="text-[7px] text-[#ff4444] opacity-40">◆</span>
          <span className="text-[8px] uppercase tracking-[0.15em] text-crt-dim opacity-40">agent feed</span>
        </span>
        {items.map((swap, i) => {
          const isBuy = swap.type === 'buy';
          const sign = isBuy ? '+' : '-';
          const isCross = swap.isCrossTrade;
          const ethStr = swap.amountETH > 0 ? swap.amountETH.toFixed(4) : '0';

          const buyColor = 'text-crt-green';
          const sellColor = 'text-[#ff4444]';
          const color = isBuy ? buyColor : sellColor;
          const glowColor = isBuy ? 'rgba(52,211,153,0.3)' : 'rgba(255,68,68,0.3)';

          return (
            <span
              key={`${swap.transactionHash}-${i}`}
              className="flex items-center gap-1 shrink-0"
            >
              {/* Agent name — who initiated */}
              {swap.makerName && (
                swap.makerTokenAddress ? (
                  <a
                    href={`${FLAUNCH_URL}/coin/${swap.makerTokenAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-crt-text opacity-70 hover:opacity-100 transition-opacity"
                  >
                    {swap.makerName}
                  </a>
                ) : (
                  <span className="text-crt-text opacity-70">{swap.makerName}</span>
                )
              )}

              {/* Action + symbol */}
              <a
                href={`${FLAUNCH_URL}/coin/${swap.tokenAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`${color} hover:underline`}
                style={{ textShadow: `0 0 4px ${glowColor}` }}
              >
                {sign}{swap.tokenSymbol}
              </a>

              {/* ETH amount */}
              <span className="text-crt-dim opacity-50">
                {ethStr}ETH
              </span>

              {/* Cross-trade badge */}
              {isCross && (
                <span className="hud-badge hud-badge-cross">cross</span>
              )}

              {/* Memo snippet */}
              {swap.memo && (
                <span className="text-[8px] text-crt-dim opacity-40 italic max-w-[160px] truncate inline-block align-bottom">
                  &ldquo;{swap.memo.slice(0, 40)}&rdquo;
                </span>
              )}

              {/* Basescan tx link */}
              <a
                href={`${BASESCAN_TX}/${swap.transactionHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[8px] text-crt-dim opacity-20 hover:opacity-60 transition-opacity"
                title="View on Basescan"
              >
                tx
              </a>
            </span>
          );
        })}
      </div>
    </div>
  );
}
