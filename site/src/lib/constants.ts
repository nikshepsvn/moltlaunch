// Re-export constants from shared package — single source of truth
export {
  REVENUE_MANAGER_ADDRESS as RM_ADDRESS,
  FLAUNCH_DATA_API,
  FLAUNCH_URL,
  WORKER_API_URL as NETWORK_API,
  UNISWAP_URL,
  BASE_RPC,
  MEMO_MAGIC_PREFIX,
} from "@moltlaunch/shared";

// Site-specific constants (not shared with CLI/worker)
export const PER_PAGE = 20;
export const TOKENS_PER_PAGE = 100;
export const SWAP_POLL_INTERVAL = 60_000;
