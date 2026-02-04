import { useEffect } from 'react';
import { useNetworkStore } from '../stores/networkStore';
import AgentDetailPanel from './AgentDetailPanel';
import AgentMemoFeed from './AgentMemoFeed';
import SwapFeed from './SwapFeed';

/** Right sidebar — 420px feed by default, expands to two panels when agent selected.
 *  On mobile (<md): hidden inline, shown as full-screen overlay via mobilePanelOpen. */
export default function SidePanel() {
  const selectedAgent = useNetworkStore((s) => s.selectedAgent);
  const mobilePanelOpen = useNetworkStore((s) => s.mobilePanelOpen);
  const setMobilePanelOpen = useNetworkStore((s) => s.setMobilePanelOpen);

  // Auto-open mobile panel when an agent is selected on small screens
  useEffect(() => {
    if (selectedAgent && window.innerWidth < 768) {
      setMobilePanelOpen(true);
    }
  }, [selectedAgent, setMobilePanelOpen]);

  if (selectedAgent) {
    return (
      <>
        {/* Desktop: inline two-panel sidebar */}
        <div className="hidden md:flex shrink-0 border-l border-[#1e0606]">
          <div className="w-[390px] shrink-0 hud-panel flex flex-col">
            <AgentDetailPanel />
          </div>
          <div className="w-[340px] shrink-0 border-l border-[#1e0606] hud-panel flex flex-col">
            <AgentMemoFeed />
          </div>
        </div>

        {/* Mobile: full-screen overlay */}
        {mobilePanelOpen && (
          <div className="fixed inset-0 z-40 bg-[#060101] flex flex-col md:hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-[#1e0606]">
              <span className="text-[11px] text-crt-dim font-mono">agent detail</span>
              <button
                onClick={() => setMobilePanelOpen(false)}
                className="text-crt-dim text-[14px] w-8 h-8 flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
              <div className="flex-1 min-h-0 hud-panel flex flex-col">
                <AgentDetailPanel />
              </div>
              <div className="border-t border-[#1e0606] hud-panel flex flex-col flex-1 min-h-0">
                <AgentMemoFeed />
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {/* Desktop: inline feed */}
      <div className="hidden md:flex w-[420px] shrink-0 border-l border-[#1e0606] hud-panel flex-col">
        <SwapFeed />
      </div>

      {/* Mobile: full-screen overlay */}
      {mobilePanelOpen && (
        <div className="fixed inset-0 z-40 bg-[#060101] flex flex-col md:hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-[#1e0606]">
            <span className="text-[11px] text-crt-dim font-mono">feed</span>
            <button
              onClick={() => setMobilePanelOpen(false)}
              className="text-crt-dim text-[14px] w-8 h-8 flex items-center justify-center"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <SwapFeed />
          </div>
        </div>
      )}
    </>
  );
}
