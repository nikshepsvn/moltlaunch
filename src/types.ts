export type Protocol = "flaunch" | "clanker";

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
  network: "mainnet" | "testnet";
  walletAddress: string;
  launchedAt: string;
  flaunchUrl: string;
  protocol?: Protocol;
  clankerUrl?: string;  // Only present for Clanker launches
}

export interface LaunchParams {
  name: string;
  symbol: string;
  description: string;
  imagePath?: string;
  testnet: boolean;
  json: boolean;
  website?: string;
  quiet?: boolean;
  protocol: Protocol;
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

export interface AnnouncementResult {
  platform: string;
  url: string | null;
  success: boolean;
}

export interface SwapParams {
  token: string;
  amount: string;
  side: "buy" | "sell";
  slippage: number;
  testnet: boolean;
  json: boolean;
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

export type Network = "mainnet" | "testnet";
