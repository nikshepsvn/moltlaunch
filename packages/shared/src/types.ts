// ─── Network types (canonical, used by CLI, worker, and site) ────────────────

export interface PowerScore {
  total: number;
  revenue: number;
  market: number;
  network: number;
  vitality: number;
}

export interface NetworkGoal {
  id: string;
  name: string;
  description: string;
  metric: string;
  weight: number;
  startedAt: number;
  endsAt: number | null;
}

export interface OnboardCredit {
  agentAddress: string;
  agentName: string;
}

export type PlayerType = "agent" | "human" | "unknown";

export interface NetworkAgent {
  tokenAddress: string;
  name: string;
  symbol: string;
  creator: string;
  marketCapETH: number;
  volume24hETH: number;
  priceChange24h: number;
  claimableETH: number;
  walletETH: number;
  image: string;
  description: string;
  flaunchUrl: string;
  holders: number;
  crossHoldings: number;
  recentSwaps: number;
  crossTradeCount: number;
  memoCount: number;
  powerScore: PowerScore;
  goalScore: number;
  onboards: OnboardCredit[];
  type: PlayerType;
  bannerUrl?: string;
}

export interface SwapEvent {
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  maker: string;
  makerName: string | null;
  makerTokenAddress: string | null;
  type: "buy" | "sell";
  amountETH: number;
  timestamp: number;
  transactionHash: string;
  isCrossTrade: boolean;
  isAgentSwap: boolean;
  memo: string | null;
}

export interface CrossHoldingEdge {
  tokenA: string;
  tokenB: string;
  holder: string;
}

export interface NetworkState {
  agents: NetworkAgent[];
  swaps: SwapEvent[];
  crossEdges: CrossHoldingEdge[];
  goal: NetworkGoal | null;
  timestamp: number;
}

/** Basic agent shape used by CLI fallback when Worker API is unavailable */
export interface NetworkAgentBasic {
  tokenAddress: string;
  name: string;
  symbol: string;
  creator: string;
  marketCapETH: string;
  claimableETH: string;
  image: string;
}

// ─── CLI types (used by CLI only, re-exported for convenience) ───────────────

export type Network = "mainnet" | "testnet";

export interface WalletData {
  address: string;
  privateKey: string;
  createdAt: string;
}

export interface LaunchRecord {
  name: string;
  symbol: string;
  tokenAddress: string;
  transactionHash: string;
  network: Network;
  walletAddress: string;
  launchedAt: string;
  flaunchUrl: string;
}

export interface LaunchParams {
  name: string;
  symbol: string;
  description: string;
  imagePath?: string;
  testnet: boolean;
  json: boolean;
  website?: string;
}

export interface SwapParams {
  token: string;
  amount: string;
  side: "buy" | "sell";
  slippage: number;
  testnet: boolean;
  json: boolean;
  memo?: string;
}

export interface SwapResult {
  success: boolean;
  transactionHash: string;
  side: "buy" | "sell";
  amountIn: string;
  tokenAddress: string;
  network: string;
  explorer: string;
  flaunch: string;
}

export interface Holding {
  name: string;
  symbol: string;
  tokenAddress: string;
  balance: string;
  balanceWei?: string;
}

// ─── Flaunch API types ──────────────────────────────────────────────────────

export interface FlaunchToken {
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

export interface FlaunchTokenDetail {
  tokenAddress: string;
  symbol: string;
  name: string;
  marketCapETH: string;
  createdAt: number;
  image: string;
  description: string;
  socials: {
    website: string;
    twitter: string;
    telegram: string;
    discord: string;
    farcaster: string;
  };
  meta: {
    network: string;
    timestamp: number;
  };
}

export interface FlaunchTokenListResponse {
  data: FlaunchToken[];
  pagination: {
    limit: number;
    offset: number;
  };
  meta: {
    network: string;
    timestamp: number;
  };
}

export interface FlaunchUploadResponse {
  success: boolean;
  ipfsHash: string;
  tokenURI: string;
}

export interface FlaunchLaunchResponse {
  success: boolean;
  message: string;
  jobId: string;
  queueStatus: {
    position: number;
    waitingJobs: number;
    activeJobs: number;
    estimatedWaitSeconds: number;
  };
}

export interface FlaunchStatusResponse {
  success: boolean;
  state: "waiting" | "active" | "completed" | "failed";
  queuePosition: number;
  estimatedWaitTime: number;
  transactionHash: string | null;
  error: string | null;
  collectionToken: {
    address: string;
    imageIpfs: string;
    name: string;
    symbol: string;
    tokenURI: string;
    creator: string;
  } | null;
}

// ─── Worker-specific Flaunch types ──────────────────────────────────────────

export interface FlaunchListToken {
  tokenAddress: string;
  symbol: string;
  name: string;
  positionManager: string;
  marketCapETH: string;
  createdAt: number;
  image: string;
  description: string;
}

export interface FlaunchListResponse {
  data: FlaunchListToken[];
  pagination: { limit: number; offset: number };
}

export interface FlaunchTokenDetails {
  tokenAddress: string;
  symbol: string;
  name: string;
  image: string;
  description: string;
  price: { marketCapETH: string; priceChange24h: string };
  volume: { volume24h: string };
  status: { owner: string; createdAt: number };
}

export interface FlaunchHolder {
  id: string;
  balance: string;
}

export interface FlaunchSwapRaw {
  maker: string;
  type: string;
  timestamp: number;
  txHash: string;
  amounts: {
    isp: { amount0: string; amount1: string };
    uniswap: { amount0: string; amount1: string };
  };
}

export interface FlaunchSwap {
  maker: string;
  type: string;
  amountETH: number;
  timestamp: number;
  transactionHash: string;
}

// ─── Agent state (autonomous protocol) ───────────────────────────────────────

export interface AgentState {
  version: number;
  identity: {
    tokenAddress: string;
    name: string;
    symbol: string;
    launchedAt: string;
  };
  portfolio: {
    positions: Record<string, {
      entryPrice: number;
      amountHeld: string;
      entryTimestamp: string;
      memo: string;
    }>;
    tradeHistory: Array<{
      timestamp: string;
      tokenAddress: string;
      side: "buy" | "sell";
      amount: string;
      memo: string;
      txHash: string;
    }>;
    totalBuys: number;
    totalSells: number;
    totalSpentETH: number;
    totalReceivedETH: number;
  };
  network: {
    knownAgents: Record<string, {
      firstSeen: string;
      lastPowerScore: number;
      lastMcap: number;
    }>;
    watchlist: string[];
    lastNetworkScan: string | null;
    lastFeeClaim: string | null;
    lastHeartbeat: string | null;
  };
  config: {
    maxPositionETH: number;
    maxPortfolioETH: number;
    minPowerScore: number;
    heartbeatIntervalHours: number;
    feeClaimThresholdETH: number;
  };
}
