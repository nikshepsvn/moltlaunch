import { useEffect, useRef } from 'react';
import { useTokenStore, type TokenData } from '../stores/tokenStore';
import { enrichSingle } from '../lib/flaunch-api';

async function pMap<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency = 6,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );
  return results;
}

/**
 * Single enrichment coordinator. Call once from TokenGrid.
 * Fetches detailed metadata (socials, volume, holders) for visible tokens.
 * Address resolution is no longer needed — addresses come from the list API.
 */
export function useEnrichTokens(visibleIds: Set<string>): void {
  const updateTokens = useTokenStore((s) => s.updateTokens);
  const updateTotalMcap = useTokenStore((s) => s.updateTotalMcap);

  const enrichingSet = useRef(new Set<string>());
  const runningRef = useRef(false);
  const visibleRef = useRef(visibleIds);
  visibleRef.current = visibleIds;

  const runEnrichment = useRef(async () => {
    if (runningRef.current) return;
    runningRef.current = true;

    try {
      const tokens = useTokenStore.getState().tokens;
      const visible = visibleRef.current;

      // Only enrich tokens that don't have details yet
      const unenriched = tokens.filter(
        (t) => !t.details && !t._dead && !enrichingSet.current.has(t.tokenId)
      );
      if (unenriched.length === 0) return;

      const visibleBatch = unenriched.filter((t) => visible.has(t.tokenId));
      const bgBatch = unenriched.filter((t) => !visible.has(t.tokenId)).slice(0, 20);
      const batch = [...visibleBatch, ...bgBatch];
      if (batch.length === 0) return;

      batch.forEach((t) => enrichingSet.current.add(t.tokenId));

      const collected: Array<{ tokenId: string; patch: Partial<TokenData> }> = [];

      await pMap(
        batch,
        async (t) => {
          const patch = await enrichSingle(t.address);
          enrichingSet.current.delete(t.tokenId);
          if (patch) {
            collected.push({ tokenId: t.tokenId, patch });
          }
        },
        6,
      );

      if (collected.length > 0) {
        updateTokens(collected);
        updateTotalMcap();
      }
    } finally {
      runningRef.current = false;

      const remaining = useTokenStore.getState().tokens.filter(
        (t) => !t.details && !t._dead && !enrichingSet.current.has(t.tokenId)
      );
      if (remaining.length > 0) {
        setTimeout(() => runEnrichment.current(), 100);
      }
    }
  });

  useEffect(() => {
    const tokens = useTokenStore.getState().tokens;
    if (tokens.length > 0 && !runningRef.current) {
      runEnrichment.current();
    }
  });

  const prevVisibleRef = useRef<string>('');
  useEffect(() => {
    const key = [...visibleIds].sort().join(',');
    if (key !== prevVisibleRef.current) {
      prevVisibleRef.current = key;
      if (!runningRef.current) {
        runEnrichment.current();
      }
    }
  }, [visibleIds]);
}
