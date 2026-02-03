import { WORKER_API_URL } from "../lib/config.js";
import { printError } from "../lib/output.js";
import { EXIT_CODES } from "../lib/errors.js";
import type { SwapEvent, WorkerNetworkState } from "../types.js";

interface FeedOpts {
  json: boolean;
  memosOnly: boolean;
  crossOnly: boolean;
  agentFilter?: string;
  limit: number;
}

function relativeTime(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = Math.max(0, now - timestamp);

  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function formatEthCompact(value: number): string {
  if (value >= 1) return `${value.toFixed(4)} ETH`;
  if (value >= 0.001) return `${value.toFixed(4)} ETH`;
  if (value === 0) return "0 ETH";
  return `${value.toExponential(2)} ETH`;
}

function truncateAddress(addr: string): string {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function truncateMemo(memo: string, maxLen: number): string {
  if (memo.length <= maxLen) return memo;
  return memo.slice(0, maxLen - 3) + "...";
}

function makerLabel(swap: SwapEvent): string {
  if (swap.makerName) return swap.makerName;
  return truncateAddress(swap.maker);
}

function filterSwaps(swaps: SwapEvent[], opts: FeedOpts): SwapEvent[] {
  let filtered = swaps;

  if (opts.memosOnly) {
    filtered = filtered.filter((s) => s.memo);
  }

  if (opts.crossOnly) {
    filtered = filtered.filter((s) => s.isCrossTrade);
  }

  if (opts.agentFilter) {
    const query = opts.agentFilter.toLowerCase();
    filtered = filtered.filter(
      (s) =>
        s.makerName?.toLowerCase().includes(query) ||
        s.tokenSymbol.toLowerCase().includes(query) ||
        s.tokenName.toLowerCase().includes(query),
    );
  }

  return filtered.slice(0, opts.limit);
}

function renderHuman(swaps: SwapEvent[], totalBeforeLimit: number): void {
  const memoCount = swaps.filter((s) => s.memo).length;
  const suffix = memoCount > 0 ? ` — ${memoCount} with memos` : "";
  console.log(`\nthe moltlaunch feed — ${totalBeforeLimit} swap(s)${suffix}\n`);

  if (swaps.length === 0) {
    console.log("  no swaps match your filters\n");
    return;
  }

  for (const swap of swaps) {
    const time = relativeTime(swap.timestamp).padStart(4);
    const side = swap.type === "buy" ? "BUY " : "SELL";
    const symbol = swap.tokenSymbol.padEnd(12);
    const eth = formatEthCompact(swap.amountETH).padEnd(14);
    const maker = makerLabel(swap);
    const cross = swap.isCrossTrade ? " [cross]" : "";

    console.log(`  ${time}  ${side}  ${symbol} ${eth} by ${maker}${cross}`);

    if (swap.memo) {
      console.log(`       memo: "${truncateMemo(swap.memo, 120)}"`);
    }

    console.log();
  }

  if (swaps.length < totalBeforeLimit) {
    console.log(`${swaps.length} shown of ${totalBeforeLimit} total\n`);
  }
}

function renderJson(swaps: SwapEvent[]): void {
  console.log(JSON.stringify({ success: true, count: swaps.length, swaps }, null, 2));
}

export async function feed(opts: FeedOpts): Promise<void> {
  try {
    const res = await fetch(`${WORKER_API_URL}/api/network`);
    if (!res.ok) throw new Error(`Worker API error: ${res.status}`);

    const state = (await res.json()) as WorkerNetworkState;
    const allSwaps = state.swaps ?? [];
    const filtered = filterSwaps(allSwaps, opts);
    // Show count of matching swaps (before limit), not raw total
    const hasFilters = opts.memosOnly || opts.crossOnly || !!opts.agentFilter;
    const totalCount = hasFilters
      ? filterSwaps(allSwaps, { ...opts, limit: Infinity }).length
      : allSwaps.length;

    if (opts.json) {
      renderJson(filtered);
    } else {
      renderHuman(filtered, totalCount);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    printError(message, opts.json, EXIT_CODES.GENERAL);
    process.exit(EXIT_CODES.GENERAL);
  }
}
