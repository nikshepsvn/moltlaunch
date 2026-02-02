// Re-export all types from shared package — single source of truth
export type {
  PowerScore,
  PlayerType,
  NetworkAgent as Agent,
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
}
