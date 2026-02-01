import { FLAUNCH_DATA_API, RM_ADDRESS, TOKENS_PER_PAGE } from './constants';
import type { TokenData, TokenDetails } from '../stores/tokenStore';
import { truncateAddress } from './formatters';

interface FlaunchListToken {
  tokenAddress: string;
  symbol: string;
  name: string;
  positionManager: string;
  marketCapETH: string;
  createdAt: number;
  fairLaunchActive: boolean;
  image: string;
  description: string;
  video: string | null;
}

interface FlaunchListResponse {
  data: FlaunchListToken[];
  pagination: { limit: number; offset: number };
}

interface FlaunchDetails {
  name?: string;
  symbol?: string;
  image?: string;
  description?: string;
  socials?: { website?: string };
  price?: { marketCapETH?: string; priceChange24h?: string };
  volume?: { volume24h?: string };
}

interface FlaunchHolders {
  totalHolders?: string;
}

export interface TokenFullResponse {
  name: string;
  symbol: string;
  image: string;
  description: string;
  websiteUrl: string | null;
  details: TokenDetails;
}

/**
 * Fetch all tokens under the moltlaunch revenue manager via REST API.
 * Paginates automatically (100 per page). No RPC needed.
 */
export async function fetchAllTokens(
  onProgress?: (loaded: number) => void,
): Promise<TokenData[]> {
  const all: TokenData[] = [];
  let offset = 0;

  while (true) {
    const url = `${FLAUNCH_DATA_API}/tokens?managerAddress=${RM_ADDRESS}&orderBy=datecreated&orderDirection=desc&limit=${TOKENS_PER_PAGE}&offset=${offset}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API error: ${res.status}`);

    const json = (await res.json()) as FlaunchListResponse;
    const batch = json.data;
    if (batch.length === 0) break;

    for (const t of batch) {
      all.push({
        tokenId: t.tokenAddress,
        address: t.tokenAddress,
        name: t.name || undefined,
        symbol: t.symbol || undefined,
        image: t.image || undefined,
        description: t.description || undefined,
        marketCapETH: t.marketCapETH,
        createdAt: t.createdAt,
      });
    }

    onProgress?.(all.length);
    if (batch.length < TOKENS_PER_PAGE) break;
    offset += TOKENS_PER_PAGE;
  }

  return all;
}

export async function fetchTokenFull(tokenAddress: string): Promise<TokenFullResponse | null> {
  try {
    const [detailsRes, holdersRes] = await Promise.all([
      fetch(`${FLAUNCH_DATA_API}/tokens/${tokenAddress}/details`),
      fetch(`${FLAUNCH_DATA_API}/tokens/${tokenAddress}/holders`),
    ]);
    const details: FlaunchDetails | null = detailsRes.ok ? await detailsRes.json() : null;
    const holders: FlaunchHolders | null = holdersRes.ok ? await holdersRes.json() : null;

    if (!details) return null;

    return {
      name: details.name || "",
      symbol: details.symbol || "",
      image: details.image || "",
      description: details.description || "",
      websiteUrl: details.socials?.website || null,
      details: {
        mcapEth: Number(details.price?.marketCapETH ?? "0") / 1e18,
        priceChange: parseFloat(details.price?.priceChange24h ?? "0"),
        vol24hEth: Number(details.volume?.volume24h ?? "0") / 1e18,
        totalHolders: parseInt(holders?.totalHolders ?? "0", 10),
      },
    };
  } catch {
    return null;
  }
}

/**
 * Enrich a single token: fetch detailed metadata + holders.
 * Returns a partial TokenData patch or null on failure.
 */
export async function enrichSingle(
  address: string,
  signal?: AbortSignal,
): Promise<Partial<TokenData> | null> {
  if (signal?.aborted) return null;
  const data = await fetchTokenFull(address);
  if (!data) {
    return { name: truncateAddress(address), symbol: "???" };
  }
  return {
    name: data.name,
    symbol: data.symbol,
    image: data.image,
    description: data.description,
    websiteUrl: data.websiteUrl,
    details: data.details,
  };
}
