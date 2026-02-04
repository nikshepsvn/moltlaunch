import { useState, useEffect, useCallback } from 'react';
import { NETWORK_API, SWAP_POLL_INTERVAL, FULL_REFRESH_INTERVAL } from '../lib/constants';
import type {
  NetworkAgent as Agent,
  SwapEvent,
  CrossHoldingEdge,
  NetworkState,
} from '@moltlaunch/shared';

// Re-export shared types so existing consumers don't break
export type { Agent, SwapEvent, CrossHoldingEdge, NetworkState };
export type { PowerScore, PlayerType } from '@moltlaunch/shared';

/** Fetch full network state from the Cloudflare Worker, poll for new swaps */
export function useNetwork() {
  const [state, setState] = useState<NetworkState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFullState = useCallback(async () => {
    const r = await fetch(`${NETWORK_API}/api/network`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<NetworkState>;
  }, []);

  // Mount: fetch full state
  useEffect(() => {
    let cancelled = false;

    fetchFullState()
      .then((data) => {
        if (!cancelled) setState(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [fetchFullState]);

  // Poll: full state refresh every 120s (matches worker cron)
  useEffect(() => {
    if (!state) return;

    const id = setInterval(async () => {
      try {
        const data = await fetchFullState();
        setState(data);
      } catch {
        // ignore polling errors — will retry next cycle
      }
    }, FULL_REFRESH_INTERVAL);

    return () => clearInterval(id);
  }, [state !== null, fetchFullState]);

  // Poll: incremental swaps every 60s
  useEffect(() => {
    if (!state) return;

    const id = setInterval(async () => {
      try {
        const r = await fetch(`${NETWORK_API}/api/network/swaps?since=${state.timestamp}`);
        if (!r.ok) return;
        const data = await r.json() as { swaps: SwapEvent[]; timestamp: number };
        if (data.swaps.length > 0) {
          setState((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              swaps: [...data.swaps, ...prev.swaps].slice(0, 200),
              timestamp: data.timestamp,
            };
          });
        }
      } catch {
        // ignore polling errors
      }
    }, SWAP_POLL_INTERVAL);

    return () => clearInterval(id);
  }, [state?.timestamp]);

  // Manual refetch — re-fetches full state without reloading the page
  const refetch = useCallback(async () => {
    try {
      const data = await fetchFullState();
      setState(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [fetchFullState]);

  return {
    agents: state?.agents ?? [],
    swaps: state?.swaps ?? [],
    crossEdges: state?.crossEdges ?? [],
    goal: state?.goal ?? null,
    timestamp: state?.timestamp ?? null,
    loading,
    error,
    refetch,
  };
}
