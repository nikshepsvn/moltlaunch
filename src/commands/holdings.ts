import { ethers } from "ethers";
import { loadOrCreateWallet } from "../lib/wallet.js";
import { CHAIN, WORKER_API_URL, MULTICALL3_ADDRESS } from "../lib/config.js";
import { printError } from "../lib/output.js";
import { EXIT_CODES } from "../lib/errors.js";
import type { Network, WorkerNetworkState, Holding } from "../types.js";

const ERC20_BALANCE_OF = "function balanceOf(address) external view returns (uint256)";
const MULTICALL3_ABI = [
  "function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) external view returns (tuple(bool success, bytes returnData)[])",
];

interface HoldingsOpts {
  json: boolean;
  testnet: boolean;
}

export async function holdings(opts: HoldingsOpts): Promise<void> {
  const { json, testnet } = opts;
  const network: Network = testnet ? "testnet" : "mainnet";
  const chain = testnet ? CHAIN.testnet : CHAIN.mainnet;

  try {
    const { wallet } = await loadOrCreateWallet();

    if (!json) console.log(`\nChecking holdings for ${wallet.address}...\n`);

    // Fetch all token addresses from worker
    let tokens: { address: string; name: string; symbol: string }[] = [];
    try {
      const res = await fetch(`${WORKER_API_URL}/api/network`);
      if (!res.ok) throw new Error(`Worker API error: ${res.status}`);
      const state = (await res.json()) as WorkerNetworkState;
      tokens = state.agents.map((a) => ({
        address: a.tokenAddress,
        name: a.name,
        symbol: a.symbol,
      }));
    } catch {
      if (!json) console.log("Could not reach network API. No tokens to check.\n");
      if (json) console.log(JSON.stringify({ success: false, error: "Network API unreachable" }));
      return;
    }

    if (tokens.length === 0) {
      if (json) {
        console.log(JSON.stringify({ success: true, holdings: [], count: 0 }));
      } else {
        console.log("No tokens in the network yet.\n");
      }
      return;
    }

    // Batch balanceOf calls via Multicall3
    const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
    const multicall = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, provider);
    const erc20Iface = new ethers.Interface([ERC20_BALANCE_OF]);

    const calls = tokens.map((t) => ({
      target: t.address,
      allowFailure: true,
      callData: erc20Iface.encodeFunctionData("balanceOf", [wallet.address]),
    }));

    const results = (await multicall.aggregate3.staticCall(calls)) as {
      success: boolean;
      returnData: string;
    }[];

    const holdings: Holding[] = [];

    for (let i = 0; i < tokens.length; i++) {
      const result = results[i];
      if (!result.success) continue;

      try {
        const [balance] = erc20Iface.decodeFunctionResult("balanceOf", result.returnData) as [bigint];
        if (balance > 0n) {
          holdings.push({
            name: tokens[i].name,
            symbol: tokens[i].symbol,
            tokenAddress: tokens[i].address,
            balance: ethers.formatEther(balance),
            balanceWei: balance.toString(),
          });
        }
      } catch {
        // Skip tokens with decode errors
      }
    }

    if (json) {
      console.log(JSON.stringify({ success: true, count: holdings.length, holdings }, null, 2));
      return;
    }

    if (holdings.length === 0) {
      console.log("You don't hold any tokens in the network.\n");
      return;
    }

    console.log(`Your holdings — ${chain.name}\n`);

    for (const h of holdings) {
      const formatted = parseFloat(h.balance).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      console.log(`  ${h.name} (${h.symbol})`);
      console.log(`    Balance:   ${formatted} ${h.symbol}`);
      console.log(`    Token:     ${h.tokenAddress}`);
      console.log();
    }

    console.log(`${holdings.length} token(s) held\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    printError(message, json, EXIT_CODES.GENERAL);
    process.exit(EXIT_CODES.GENERAL);
  }
}
