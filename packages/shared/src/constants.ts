// ─── On-chain contracts (Base mainnet) ───────────────────────────────────────

export const REVENUE_MANAGER_ADDRESS = "0x3Bc08524d9DaaDEC9d1Af87818d809611F0fD669" as const;
export const POSITION_MANAGER_ADDRESS = "0x51Bba15255406Cfe7099a42183302640ba7dAFDC" as const;
export const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11" as const;
export const WETH_ADDRESS = "0x4200000000000000000000000000000000000006" as const;
export const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const;

// ─── APIs ────────────────────────────────────────────────────────────────────

export const FLAUNCH_API_BASE = "https://dev-web2-api.flaunch.gg";
export const FLAUNCH_DATA_API_BASE = "https://api.flayerlabs.xyz";
export const FLAUNCH_DATA_API = `${FLAUNCH_DATA_API_BASE}/v1/base`;
export const FLAUNCH_URL = "https://flaunch.gg/base";
export const WORKER_API_URL = "https://moltlaunch-network.nikshepsvn-d85.workers.dev";

// ─── Chain config ────────────────────────────────────────────────────────────

export const CHAIN = {
  mainnet: {
    id: 8453,
    name: "Base",
    network: "base",
    rpcUrl: "https://mainnet.base.org",
    explorer: "https://basescan.org",
    flaunchUrl: "https://flaunch.gg/base",
  },
  testnet: {
    id: 84532,
    name: "Base Sepolia",
    network: "base-sepolia",
    rpcUrl: "https://sepolia.base.org",
    explorer: "https://sepolia.basescan.org",
    flaunchUrl: "https://flaunch.gg/base-sepolia",
  },
} as const;

// ─── Protocol constants ─────────────────────────────────────────────────────

/** Magic 4-byte prefix "MLTL" marking agent memo data in calldata */
export const MEMO_MAGIC_PREFIX = "4d4c544c" as const;

export const DEFAULT_SLIPPAGE_PERCENT = 5;
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
export const POLL_INTERVAL_MS = 2_000;
export const POLL_TIMEOUT_MS = 120_000;

// ─── External URLs ──────────────────────────────────────────────────────────

export const UNISWAP_URL = "https://app.uniswap.org/explore/tokens/base";
export const BASE_RPC = "https://mainnet.base.org";
