import { useTokenStore } from '../stores/tokenStore';
import { useEthPrice } from '../hooks/useEthPrice';
import { formatMcap } from '../lib/formatters';

export default function StatsBar() {
  const tokens = useTokenStore((s) => s.tokens);
  const totalMcapEth = useTokenStore((s) => s.totalMcapEth);
  const ethUsdPrice = useEthPrice();

  const count = tokens.filter((t) => !t._dead).length;

  return (
    <div className="flex flex-col">
      {/* Panel header */}
      <div className="panel-header">
        <span className="label">status</span>
      </div>

      {/* Stats list */}
      <div className="flex-1 p-4 font-mono text-[11px] leading-[2.6]">
        <div className="flex justify-between items-baseline">
          <span className="text-crt-dim">tokens launched</span>
          <span className="text-crt-accent-glow text-[14px] font-semibold" style={{ textShadow: '0 0 10px rgba(255,68,68,0.5), 0 0 30px rgba(255,50,50,0.15)' }}>
            {count > 0 ? count : '—'}
          </span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-crt-dim">total mcap</span>
          <span className="text-crt-accent-glow text-[16px] font-semibold" style={{ textShadow: '0 0 12px rgba(255,68,68,0.5), 0 0 30px rgba(255,50,50,0.2)' }}>
            {totalMcapEth > 0 ? formatMcap(totalMcapEth, ethUsdPrice) : '—'}
          </span>
        </div>
        <div className="h-px bg-[#1e0606] my-1.5" />
        <div className="flex justify-between items-center">
          <span className="text-crt-dim">network</span>
          <div className="flex items-center gap-1.5">
            <span className="status-dot inline-block w-[5px] h-[5px] rounded-full bg-crt-green" style={{ boxShadow: '0 0 6px rgba(52,211,153,0.6)' }} />
            <span className="text-crt-green" style={{ textShadow: '0 0 6px rgba(52,211,153,0.4)' }}>
              base
            </span>
          </div>
        </div>
        <div className="flex justify-between">
          <span className="text-crt-dim">protocol</span>
          <span className="text-crt-text">uniswap</span>
        </div>
        <div className="flex justify-between">
          <span className="text-crt-dim">standard</span>
          <span className="text-crt-text">erc-20</span>
        </div>
        <div className="flex justify-between">
          <span className="text-crt-dim">chain id</span>
          <span className="text-crt-text">8453</span>
        </div>
      </div>
    </div>
  );
}
