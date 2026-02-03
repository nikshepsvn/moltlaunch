import { WORKER_API_URL } from "./config.js";
import type { WorkerNetworkState } from "../types.js";

/** Fetch network state from worker API */
export async function fetchWorkerState(): Promise<WorkerNetworkState> {
  const res = await fetch(`${WORKER_API_URL}/api/network`);
  if (!res.ok) throw new Error(`Worker API error: ${res.status}`);
  return (await res.json()) as WorkerNetworkState;
}
