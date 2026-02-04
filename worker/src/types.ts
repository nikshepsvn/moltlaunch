// Re-export all types from shared package — single source of truth
export type {
  PowerScore,
  PlayerType,
  NetworkAgent as Agent,
  NetworkGoal,
  OnboardCredit,
  SwapEvent,
  CrossHoldingEdge,
  NetworkState,
  FlaunchListToken,
  FlaunchListResponse,
  FlaunchTokenDetails,
  FlaunchHolder,
  FlaunchSwapRaw,
  FlaunchSwap,
} from "@moltlaunch/shared";

// Worker-specific: Cloudflare Worker environment bindings
export interface Env {
  NETWORK_KV: KVNamespace;
  FLAUNCH_API: string;
  BASE_RPC: string;
  ALCHEMY_RPC: string;
  RM_ADDRESS: string;
  MEMO_MAGIC_PREFIX: string;
  FLAUNCH_URL: string;
  FAL_KEY: string;
  ADMIN_TOKEN: string;
}
