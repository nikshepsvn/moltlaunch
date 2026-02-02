import { useNetworkStore } from '../stores/networkStore';
import { truncateAddress } from '../lib/formatters';
import type { SwapEvent } from '@moltlaunch/shared';

export default function SwapFeed() {
  const swaps = useNetworkStore((s) => s.swaps);
  const refreshing = useNetworkStore((s) => s.refreshing);

  if (swaps.length === 0 && !refreshing) {
    return (
      <div className="font-mono text-[11px] text-crt-dim opacity-50 p-4">
        no notable swaps detected. showing agent trades, cross-trades, and whale activity.
      </div>
    );
  }

  if (swaps.length === 0 && refreshing) {
    return (
      <div className="font-mono text-[11px] text-crt-dim p-4 animate-pulse">
        scanning swaps...
      </div>
    );
  }

  return (
    <div className="swap-feed font-mono text-[11px] leading-[1.8] p-4 max-h-[400px] overflow-y-auto">
      {swaps.slice(0, 80).map((swap, i) => (
        <SwapLine key={`${swap.transactionHash}-${i}`} swap={swap} />
      ))}
    </div>
  );
}

function SwapLine({ swap }: { swap: SwapEvent }) {
  const time = new Date(swap.timestamp * 1000);
  const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;

  const isBuy = swap.type === 'buy';
  const actionColor = isBuy ? 'text-crt-green' : 'text-[#ff4444]';
  const actionWord = isBuy ? 'bought' : 'sold';

  const maker = swap.makerName ?? truncateAddress(swap.maker);
  const ethStr = swap.amountETH > 0 ? swap.amountETH.toFixed(4) : '0';

  const isHighlight = swap.isAgentSwap || swap.isCrossTrade;

  return (
    <div className={`flex flex-wrap gap-1.5 transition-opacity ${isHighlight ? 'opacity-100' : 'opacity-60 hover:opacity-100'}`}>
      <span className="text-crt-dim opacity-40 shrink-0">[{timeStr}]</span>
      <span className="text-crt-text shrink-0 truncate max-w-[120px]">{maker}</span>
      <span className={actionColor} style={{ textShadow: '0 0 6px rgba(255,68,68,0.15)' }}>
        {actionWord}
      </span>
      <span className="text-crt-text opacity-60 truncate">
        {swap.tokenName}
      </span>
      <span className="text-crt-dim opacity-40 shrink-0">
        {ethStr} ETH
      </span>
      {swap.isAgentSwap && !swap.isCrossTrade && (
        <span
          className="text-[9px] text-[#38bdf8] shrink-0 px-1 border border-[#38bdf830] rounded-sm"
          style={{ textShadow: '0 0 4px rgba(56,189,248,0.3)' }}
        >
          agent
        </span>
      )}
      {swap.isCrossTrade && (
        <span
          className="text-[9px] text-[#a78bfa] shrink-0 px-1 border border-[#a78bfa30] rounded-sm"
          style={{ textShadow: '0 0 4px rgba(167,139,250,0.3)' }}
          title="Cross-trade: agent wallet trading another agent's token"
        >
          cross
        </span>
      )}
      {swap.memo && (
        <span className="text-[8px] text-[#60a5fa] opacity-50 italic truncate max-w-[200px]">
          &ldquo;{swap.memo.slice(0, 60)}&rdquo;
        </span>
      )}
    </div>
  );
}
