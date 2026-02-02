import type {
  Env,
  FlaunchListToken,
  FlaunchListResponse,
  FlaunchTokenDetails,
  FlaunchHolder,
  FlaunchSwap,
  FlaunchSwapRaw,
} from './types';

const TOKENS_PER_PAGE = 100;
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 200;
const FETCH_TIMEOUT_MS = 8000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function fetchWithTimeout(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetry(url: string, maxAttempts = 3): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetchWithTimeout(url);
      if (res.status >= 400 && res.status < 500) return res;
      if (res.ok) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    if (attempt < maxAttempts - 1) {
      const backoff = 500 * Math.pow(3, attempt) + Math.random() * 500;
      await sleep(backoff);
    }
  }
  throw lastError;
}

/** Run promises in batches of BATCH_SIZE with delay between batches */
export async function batchedFetch<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(batch.map(fn));
    if (i + BATCH_SIZE < items.length) await sleep(BATCH_DELAY_MS);
  }
}

/** Paginate all tokens from Flaunch API */
export async function fetchTokens(env: Env): Promise<FlaunchListToken[]> {
  const all: FlaunchListToken[] = [];
  let offset = 0;

  while (true) {
    const url = `${env.FLAUNCH_API}/tokens?managerAddress=${env.RM_ADDRESS}&orderBy=datecreated&orderDirection=desc&limit=${TOKENS_PER_PAGE}&offset=${offset}`;
    const res = await fetchWithRetry(url);
    if (!res.ok) break;

    const json = (await res.json()) as FlaunchListResponse;
    if (json.data.length === 0) break;

    all.push(...json.data);
    if (json.data.length < TOKENS_PER_PAGE) break;
    offset += TOKENS_PER_PAGE;
  }

  return all;
}

/** Fetch token details (creator, volume, priceChange) */
export async function fetchTokenDetails(
  env: Env,
  tokenAddress: string,
): Promise<FlaunchTokenDetails | null> {
  try {
    const res = await fetchWithRetry(`${env.FLAUNCH_API}/tokens/${tokenAddress}/details`);
    if (!res.ok) return null;
    return (await res.json()) as FlaunchTokenDetails;
  } catch {
    return null;
  }
}

/** Fetch ALL holders for a token, paginating in chunks of 100 */
export async function fetchHolders(
  env: Env,
  tokenAddress: string,
): Promise<{ holders: FlaunchHolder[]; totalHolders: number }> {
  const all: FlaunchHolder[] = [];
  let totalHolders = 0;
  try {
    let offset = 0;
    while (true) {
      const res = await fetchWithRetry(
        `${env.FLAUNCH_API}/tokens/${tokenAddress}/holders?limit=100&offset=${offset}`,
      );
      if (!res.ok) break;
      const json = await res.json() as Record<string, unknown>;
      const page = (json.holders ?? json.data ?? []) as FlaunchHolder[];
      totalHolders = Number(json.totalHolders ?? totalHolders);
      if (page.length === 0) break;
      all.push(...page);
      if (all.length >= totalHolders || page.length < 100) break;
      offset += 100;
    }
  } catch {
    // return what we have
  }
  return { holders: all, totalHolders: totalHolders || all.length };
}

/** Fetch recent swaps for a token */
export async function fetchSwaps(
  env: Env,
  tokenAddress: string,
  limit = 100,
): Promise<FlaunchSwap[]> {
  try {
    const res = await fetchWithRetry(
      `${env.FLAUNCH_API}/tokens/${tokenAddress}/swaps?limit=${limit}`,
    );
    if (!res.ok) return [];
    const json = await res.json() as Record<string, unknown>;
    const rawSwaps = (json.swaps ?? json.data ?? []) as FlaunchSwapRaw[];
    if (!Array.isArray(rawSwaps)) return [];

    return rawSwaps.map((s) => {
      const uniAmt0 = Math.abs(Number(s.amounts?.uniswap?.amount0 ?? '0'));
      const ispAmt0 = Math.abs(Number(s.amounts?.isp?.amount0 ?? '0'));
      const amountETH = (uniAmt0 + ispAmt0) / 1e18;
      return {
        maker: s.maker,
        type: s.type.toLowerCase(),
        amountETH,
        timestamp: s.timestamp,
        transactionHash: s.txHash,
      };
    });
  } catch {
    return [];
  }
}
