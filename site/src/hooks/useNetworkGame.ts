import { useEffect, useRef, useCallback, useState } from 'react';
import { useNetwork } from './useNetwork';
import { useNetworkStore } from '../stores/networkStore';

const REFRESH_COOLDOWN_MS = 10_000;

/** Orchestrates game data: fetches from worker, syncs to store */
export function useNetworkGame() {
  const { agents, swaps, crossEdges, goal, loading, error, refetch } = useNetwork();
  const setAgents = useNetworkStore((s) => s.setAgents);
  const setSwaps = useNetworkStore((s) => s.setSwaps);
  const setCrossEdges = useNetworkStore((s) => s.setCrossEdges);
  const setGoal = useNetworkStore((s) => s.setGoal);
  const setLastRefresh = useNetworkStore((s) => s.setLastRefresh);
  const setRefreshing = useNetworkStore((s) => s.setRefreshing);

  const storeAgents = useNetworkStore((s) => s.agents);
  const storeSwaps = useNetworkStore((s) => s.swaps);
  const lastRefresh = useNetworkStore((s) => s.lastRefresh);

  // Sync server data to store when it changes
  useEffect(() => {
    if (agents.length > 0) {
      setAgents(agents);
      setLastRefresh(Date.now());
    }
  }, [agents, setAgents, setLastRefresh]);

  useEffect(() => {
    if (swaps.length > 0) setSwaps(swaps);
  }, [swaps, setSwaps]);

  useEffect(() => {
    if (crossEdges.length > 0) setCrossEdges(crossEdges);
  }, [crossEdges, setCrossEdges]);

  useEffect(() => {
    setGoal(goal);
  }, [goal, setGoal]);

  // Manual refresh: re-fetch full state without page reload
  const [canRefresh, setCanRefresh] = useState(true);
  const [refreshCooldown, setRefreshCooldown] = useState(0);
  const [refreshing, setRefreshingLocal] = useState(false);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const manualRefresh = useCallback(async () => {
    if (!canRefresh || refreshing) return;
    setCanRefresh(false);
    setRefreshCooldown(REFRESH_COOLDOWN_MS / 1000);
    setRefreshingLocal(true);
    setRefreshing(true);

    try {
      await refetch();
    } finally {
      setRefreshingLocal(false);
      setRefreshing(false);
    }

    cooldownRef.current = setInterval(() => {
      setRefreshCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          cooldownRef.current = null;
          setCanRefresh(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [canRefresh, refreshing, refetch, setRefreshing]);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  return {
    agents: storeAgents,
    swaps: storeSwaps,
    loading,
    loadingState: error ? 'error' as const : loading ? 'loading' as const : agents.length > 0 ? 'loaded' as const : 'idle' as const,
    loadProgress: { phase: loading ? 'fetching-tokens' as const : 'complete' as const, current: 0, total: 0, message: loading ? 'loading from server...' : '' },
    error,
    refreshing,
    lastRefresh,
    manualRefresh,
    canRefresh,
    refreshCooldown,
  };
}
