import HoldingsGraph from './HoldingsGraph';
import NetworkStatsBar from './NetworkStatsBar';
import AgentDetailPanel from './AgentDetailPanel';
import SwapTicker from './SwapTicker';
import { useNetworkGame } from '../hooks/useNetworkGame';

/** Graph-first network view: always renders UI, agents populate progressively */
export default function NetworkArena() {
  const { loadingState, loadProgress, error, agents, manualRefresh, canRefresh, refreshCooldown } = useNetworkGame();

  const isLoading = loadingState === 'loading';
  const pct = loadProgress.total > 0 ? (loadProgress.current / loadProgress.total) * 100 : 0;
  const isComplete = loadProgress.phase === 'complete';

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Progress status bar — visible during loading, fades on complete */}
      {isLoading && (
        <div
          className="shrink-0 relative overflow-hidden transition-opacity duration-500"
          style={{ opacity: isComplete ? 0 : 1 }}
        >
          {/* Thin progress track */}
          <div className="h-[2px] bg-[#0a0303]">
            <div
              className="h-full transition-all duration-300 ease-out"
              style={{
                width: `${pct}%`,
                background: 'rgba(52,211,153,0.8)',
                boxShadow: '0 0 8px rgba(52,211,153,0.4)',
              }}
            />
          </div>
          {/* Phase message */}
          <div className="px-3 py-1 font-mono text-[9px] text-crt-green opacity-60 tracking-wide bg-[#060101] border-b border-[#1e0606]">
            {loadProgress.message || 'initializing...'}
          </div>
        </div>
      )}

      {/* Inline error banner with retry */}
      {loadingState === 'error' && (
        <div className="shrink-0 px-3 py-2 flex items-center gap-3 font-mono text-[10px] bg-[#0a0202] border-b border-[#1e0606]">
          <span className="text-crt-accent-bright">error: {error}</span>
          <button
            onClick={manualRefresh}
            className="hud-cmd-btn text-[9px] px-2 py-0.5"
            style={{ boxShadow: '0 0 6px rgba(52,211,153,0.1)' }}
          >
            retry
          </button>
        </div>
      )}

      {/* Resource bar */}
      <NetworkStatsBar
        onRefresh={manualRefresh}
        canRefresh={canRefresh}
        refreshCooldown={refreshCooldown}
      />

      {/* Tactical viewport */}
      <div className="flex-1 min-h-0 relative hud-viewport hud-scanlines">
        <HoldingsGraph />
        <AgentDetailPanel />
        {/* Scanline overlay as a div — pointer-events:none so SVG stays interactive */}
        <div className="hud-scanline-overlay" />
      </div>

      {/* Event log — bottom console bar */}
      <SwapTicker />
    </div>
  );
}
