import HoldingsGraph from './HoldingsGraph';
import NetworkStatsBar from './NetworkStatsBar';
import SidePanel from './SidePanel';
import SwapTicker from './SwapTicker';
import { useNetworkGame } from '../hooks/useNetworkGame';
import { useEthPrice } from '../hooks/useEthPrice';
import { useNetworkStore } from '../stores/networkStore';

/** Graph-first network view: always renders UI, agents populate progressively */
export default function NetworkArena() {
  // Fetch ETH/USD price — populates tokenStore for all child components
  useEthPrice();
  const setMobilePanelOpen = useNetworkStore((s) => s.setMobilePanelOpen);
  const { loadingState, loadProgress, error, agents, manualRefresh, canRefresh, refreshCooldown } = useNetworkGame();

  const isLoading = loadingState === 'loading';
  const pct = loadProgress.total > 0 ? (loadProgress.current / loadProgress.total) * 100 : 0;
  const isComplete = loadProgress.phase === 'complete';

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Loading state — game-like boot sequence */}
      {isLoading && (
        <div
          className="shrink-0 relative overflow-hidden transition-opacity duration-700"
          style={{ opacity: isComplete ? 0 : 1 }}
        >
          {/* Progress track with glow */}
          <div className="h-[2px] bg-[#0a0303] relative">
            <div
              className="h-full transition-all duration-300 ease-out"
              style={{
                width: `${Math.max(pct, 15)}%`,
                background: 'linear-gradient(90deg, rgba(255,68,68,0.6), rgba(52,211,153,0.8))',
                boxShadow: '0 0 12px rgba(52,211,153,0.4), 0 0 4px rgba(255,68,68,0.3)',
              }}
            />
            {/* Scanning sweep indicator */}
            <div
              className="absolute top-0 h-full w-[60px]"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(52,211,153,0.3), transparent)',
                animation: 'sweep 2s ease-in-out infinite',
              }}
            />
          </div>
          {/* Phase message with scan aesthetic */}
          <div className="px-3 py-2 flex items-center gap-3 font-mono text-[10px] bg-[#060101] border-b border-[#1e0606]">
            <span
              className="w-[4px] h-[4px] rounded-full bg-[#ff4444]"
              style={{ boxShadow: '0 0 6px rgba(255,68,68,0.5)', animation: 'status-pulse 1.5s ease-in-out infinite' }}
            />
            <span className="text-crt-dim opacity-50 uppercase tracking-[0.15em]">
              {loadProgress.message || 'scanning network...'}
            </span>
            <span className="text-crt-dim opacity-20 ml-auto tracking-widest text-[9px]">
              phase 1
            </span>
          </div>
        </div>
      )}

      {/* Inline error banner with retry */}
      {loadingState === 'error' && (
        <div className="shrink-0 px-3 py-2 flex items-center gap-3 font-mono text-[11px] bg-[#0a0202] border-b border-[#1e0606]">
          <span
            className="w-[4px] h-[4px] rounded-full bg-[#ff4444]"
            style={{ boxShadow: '0 0 6px rgba(255,68,68,0.5)' }}
          />
          <span className="text-crt-accent-bright">signal lost: {error}</span>
          <button
            onClick={manualRefresh}
            className="hud-cmd-btn text-[10px] px-2.5 py-1"
            style={{ boxShadow: '0 0 6px rgba(52,211,153,0.1)' }}
          >
            reconnect
          </button>
        </div>
      )}

      {/* Resource bar */}
      <NetworkStatsBar
        onRefresh={manualRefresh}
        canRefresh={canRefresh}
        refreshCooldown={refreshCooldown}
      />

      {/* Main content — graph left, feed right */}
      <div className="flex-1 min-h-0 flex">
        {/* Tactical viewport */}
        <div className="flex-1 min-h-0 relative hud-viewport hud-scanlines">
          <HoldingsGraph />
          <div className="hud-scanline-overlay" />
        </div>

        {/* Right sidebar — swaps between feed and agent detail */}
        <SidePanel />
      </div>

      {/* Mobile: floating toggle for feed/detail */}
      <button
        onClick={() => setMobilePanelOpen(true)}
        className="md:hidden fixed bottom-16 right-4 z-30 w-10 h-10 rounded-full bg-[#1a0808] border border-[#2a1212] flex items-center justify-center text-crt-dim"
      >
        ☰
      </button>

      {/* Event log — bottom console bar */}
      <SwapTicker />
    </div>
  );
}
