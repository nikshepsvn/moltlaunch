// Re-export constants from shared package — single source of truth
export {
  REVENUE_MANAGER_ADDRESS,
  POSITION_MANAGER_ADDRESS,
  MULTICALL3_ADDRESS,
  WETH_ADDRESS,
  PERMIT2_ADDRESS,
  FLAUNCH_API_BASE,
  FLAUNCH_DATA_API_BASE,
  WORKER_API_URL,
  CHAIN,
  MEMO_MAGIC_PREFIX,
  DEFAULT_SLIPPAGE_PERCENT,
  MAX_IMAGE_SIZE_BYTES,
  POLL_INTERVAL_MS,
  POLL_TIMEOUT_MS,
} from "@moltlaunch/shared";

// CLI-specific constants (not shared with worker/site)
export const WALLET_DIR = ".moltlaunch";
export const WALLET_FILE = "wallet.json";
export const LAUNCHES_FILE = "launches.json";
