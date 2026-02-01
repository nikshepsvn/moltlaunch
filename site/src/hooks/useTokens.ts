import { useEffect } from 'react';
import { useTokenStore } from '../stores/tokenStore';
import { fetchAllTokens } from '../lib/flaunch-api';

/**
 * Discovers tokens via Flaunch REST API (managerAddress filter).
 * No blockchain scanning needed. Runs once.
 * Enrichment (details/holders) is handled by useEnrichTokens.
 */
export function useTokens(): void {
  const setTokens = useTokenStore((s) => s.setTokens);
  const setLoading = useTokenStore((s) => s.setLoading);
  const setError = useTokenStore((s) => s.setError);
  const addLog = useTokenStore((s) => s.addLog);
  const setProgress = useTokenStore((s) => s.setProgress);
  const discoveryStarted = useTokenStore((s) => s.discoveryStarted);
  const markDiscoveryStarted = useTokenStore((s) => s.markDiscoveryStarted);

  useEffect(() => {
    if (discoveryStarted) return;
    markDiscoveryStarted();

    async function discover() {
      try {
        addLog('mltl v1.0 — base mainnet', 'info');
        addLog('fetching tokens from flaunch api...', 'dim');
        setProgress(10, 'fetching tokens...');

        const tokens = await fetchAllTokens((loaded) => {
          addLog(`  loaded ${loaded} token(s)...`, 'dim');
          setProgress(10 + Math.min(70, (loaded / 10) * 7), `loaded ${loaded} tokens...`);
        });

        addLog(`  ${tokens.length} token(s) found`, 'ok');
        setProgress(90, 'rendering...');

        if (tokens.length === 0) {
          addLog('no tokens found.', 'warn');
          setProgress(100, 'done');
          setTokens([]);
          setLoading(false);
          return;
        }

        setTokens(tokens);
        setLoading(false);

        setProgress(100, 'done — loading details...');
        addLog('  enriching tokens...', 'info');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        addLog(`ERROR: ${msg}`, 'warn');
        setProgress(100, 'failed');
        setError(msg);
        setLoading(false);
      }
    }

    discover();
  }, [discoveryStarted, markDiscoveryStarted, setTokens, setLoading, setError, addLog, setProgress]);
}
