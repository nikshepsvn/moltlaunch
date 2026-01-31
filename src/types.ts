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

export type Network = "mainnet" | "testnet";
