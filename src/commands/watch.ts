import { ethers } from "ethers";
import { CHAIN, REVENUE_MANAGER_ADDRESS } from "../lib/config.js";
import { fetchWorkerState } from "../lib/network-api.js";
import { loadWallet } from "../lib/wallet.js";
import { printError } from "../lib/output.js";
import { EXIT_CODES } from "../lib/errors.js";
import type {
  NetworkAgentRich,
  SwapEvent,
  WorkerNetworkState,
} from "../types.js";

const REVENUE_MANAGER_ABI = [
  "function balances(address) external view returns (uint256)",
];

type EventType = "new-agent" | "price-change" | "memo" | "fee";

interface WatchOpts {
  interval: number;
  token?: string;
  events?: string;
  threshold: number;
  json: boolean;
  testnet: boolean;
}

interface WatchEvent {
  event: string;
  timestamp: number;
  [key: string]: unknown;
}

interface Snapshot {
  agents: Map<string, NetworkAgentRich>;
  swapHashes: Set<string>;
  claimableETH: string | null;
}

function parseEventFilter(events?: string): Set<EventType> | null {
  if (!events) return null;
  const valid: EventType[] = ["new-agent", "price-change", "memo", "fee"];
  const requested = events.split(",").map((e) => e.trim()) as EventType[];
  const filtered = requested.filter((e) => valid.includes(e));
  return filtered.length > 0 ? new Set(filtered) : null;
}

function formatTime(): string {
  const now = new Date();
  return now.toLocaleTimeString("en-US", { hour12: false });
}

function formatEth(value: number): string {
  if (value >= 1) return `${value.toFixed(4)} ETH`;
  if (value >= 0.001) return `${value.toFixed(6)} ETH`;
  if (value === 0) return "0 ETH";
  return `${value.toExponential(2)} ETH`;
}

function emitEvent(evt: WatchEvent, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(evt));
  } else {
    const time = formatTime();
    switch (evt.event) {
      case "new-agent":
        console.log(
          `[${time}] \u{1F195} New agent: ${evt.name} ($${evt.symbol}) \u2014 ${formatEth(evt.marketCapETH as number)} mcap`,
        );
        break;
      case "price-change":
        console.log(
          `[${time}] \u{1F4C8} $${evt.symbol} price ${Number(evt.changePct) >= 0 ? "+" : ""}${evt.changePct}% (${formatEth(evt.oldPrice as number)} \u2192 ${formatEth(evt.newPrice as number)} mcap)`,
        );
        break;
      case "memo":
        console.log(
          `[${time}] \u{1F4AC} Memo from ${truncate(evt.maker as string)}: "${evt.memo}" (${evt.action} $${evt.tokenSymbol})`,
        );
        break;
      case "fee-update":
        console.log(
          `[${time}] \u{1F4B0} Fees: ${evt.claimableETH} ETH claimable`,
        );
        break;
    }
  }
}

function truncate(addr: string): string {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function buildSnapshot(state: WorkerNetworkState): Snapshot {
  const agents = new Map<string, NetworkAgentRich>();
  for (const agent of state.agents) {
    agents.set(agent.tokenAddress, agent);
  }
  const swapHashes = new Set<string>();
  for (const swap of state.swaps) {
    swapHashes.add(swap.transactionHash);
  }
  return { agents, swapHashes, claimableETH: null };
}

function diffAgents(
  prev: Snapshot,
  current: WorkerNetworkState,
  threshold: number,
  filter: Set<EventType> | null,
): WatchEvent[] {
  const events: WatchEvent[] = [];
  const now = Date.now();

  for (const agent of current.agents) {
    const prevAgent = prev.agents.get(agent.tokenAddress);

    // New agent detection
    if (!prevAgent) {
      if (!filter || filter.has("new-agent")) {
        events.push({
          event: "new-agent",
          timestamp: now,
          agent: {
            name: agent.name,
            symbol: agent.symbol,
            tokenAddress: agent.tokenAddress,
            marketCapETH: String(agent.marketCapETH),
          },
          name: agent.name,
          symbol: agent.symbol,
          tokenAddress: agent.tokenAddress,
          marketCapETH: agent.marketCapETH,
        });
      }
      continue;
    }

    // Price change detection
    if (!filter || filter.has("price-change")) {
      if (prevAgent.marketCapETH > 0) {
        const changePct =
          ((agent.marketCapETH - prevAgent.marketCapETH) / prevAgent.marketCapETH) * 100;
        if (Math.abs(changePct) >= threshold) {
          events.push({
            event: "price-change",
            timestamp: now,
            token: agent.tokenAddress,
            symbol: agent.symbol,
            oldPrice: String(prevAgent.marketCapETH),
            newPrice: String(agent.marketCapETH),
            changePct: changePct.toFixed(2),
          });
        }
      }
    }
  }

  // Memo detection — find swaps with memos that weren't in previous snapshot
  if (!filter || filter.has("memo")) {
    for (const swap of current.swaps) {
      if (swap.memo && !prev.swapHashes.has(swap.transactionHash)) {
        events.push({
          event: "memo",
          timestamp: now,
          agent: swap.maker,
          maker: swap.maker,
          action: swap.type,
          token: swap.tokenAddress,
          tokenSymbol: swap.tokenSymbol,
          memo: swap.memo,
        });
      }
    }
  }

  return events;
}

async function checkFees(
  walletAddress: string,
  testnet: boolean,
): Promise<string> {
  const chain = testnet ? CHAIN.testnet : CHAIN.mainnet;
  const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
  const rm = new ethers.Contract(REVENUE_MANAGER_ADDRESS, REVENUE_MANAGER_ABI, provider);
  const claimable = await rm.balances(walletAddress);
  return ethers.formatEther(claimable);
}

export async function watch(opts: WatchOpts): Promise<void> {
  const { json, testnet } = opts;
  const interval = Math.max(10, opts.interval) * 1000;
  const threshold = opts.threshold;
  const filter = parseEventFilter(opts.events);
  const tokenFilter = opts.token?.toLowerCase();

  let walletAddress: string | null = null;
  if (!filter || filter.has("fee")) {
    try {
      const walletData = await loadWallet();
      if (walletData) walletAddress = walletData.address;
    } catch {
      // No wallet — skip fee tracking
    }
  }

  try {
    // Fetch initial snapshot
    if (!json) console.log("\nConnecting to moltlaunch network...\n");

    let state: WorkerNetworkState;
    try {
      state = await fetchWorkerState();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      printError(`Failed to connect to network: ${message}`, json, EXIT_CODES.GENERAL);
      process.exit(EXIT_CODES.GENERAL);
    }

    let snapshot = buildSnapshot(state);

    // Initial fee check
    if (walletAddress && (!filter || filter.has("fee"))) {
      try {
        snapshot.claimableETH = await checkFees(walletAddress, testnet);
      } catch {
        // Fee check failed — skip
      }
    }

    const agentCount = tokenFilter
      ? state.agents.filter((a) => a.tokenAddress.toLowerCase() === tokenFilter).length
      : state.agents.length;

    if (!json) {
      console.log(
        `Watching ${tokenFilter ? `token ${truncate(tokenFilter)}` : `${agentCount} agent(s)`} — polling every ${opts.interval}s${filter ? ` (events: ${[...filter].join(", ")})` : ""}\n`,
      );
      console.log("Press Ctrl+C to stop.\n");
    }

    let eventCount = 0;
    let pollCount = 0;

    const poll = async (): Promise<void> => {
      try {
        const current = await fetchWorkerState();
        pollCount++;

        // Diff against previous snapshot
        let events = diffAgents(snapshot, current, threshold, filter);

        // Filter to specific token if requested
        if (tokenFilter) {
          events = events.filter((e) => {
            const addr =
              (e.tokenAddress as string | undefined) ??
              (e.token as string | undefined);
            return addr?.toLowerCase() === tokenFilter;
          });
        }

        // Emit events
        for (const evt of events) {
          emitEvent(evt, json);
          eventCount++;
        }

        // Fee tracking
        if (walletAddress && (!filter || filter.has("fee"))) {
          try {
            const currentFees = await checkFees(walletAddress, testnet);
            if (snapshot.claimableETH !== null && currentFees !== snapshot.claimableETH) {
              const canClaim = parseFloat(currentFees) > 0;
              const evt: WatchEvent = {
                event: "fee-update",
                timestamp: Date.now(),
                claimableETH: currentFees,
                canClaim,
              };
              emitEvent(evt, json);
              eventCount++;
            }
            snapshot.claimableETH = currentFees;
          } catch {
            // Fee check failed — skip this cycle
          }
        }

        // Update snapshot
        snapshot = buildSnapshot(current);
        if (walletAddress) {
          // Preserve fee state across snapshots
          snapshot.claimableETH = snapshot.claimableETH;
        }
      } catch {
        if (!json) console.log(`[${formatTime()}] Poll failed — will retry next interval`);
      }
    };

    const timer = setInterval(poll, interval);

    // Graceful shutdown
    const shutdown = (): void => {
      clearInterval(timer);
      if (!json) {
        console.log(
          `\n\nStopped. ${eventCount} event(s) detected over ${pollCount} poll(s).\n`,
        );
      }
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    printError(message, json, EXIT_CODES.GENERAL);
    process.exit(EXIT_CODES.GENERAL);
  }
}
