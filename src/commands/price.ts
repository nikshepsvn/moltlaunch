import { ethers } from "ethers";
import { fetchTokenDetails, fetchTokenHolderCount } from "../lib/flaunch-api.js";
import { CHAIN } from "../lib/config.js";
import { printError } from "../lib/output.js";
import { EXIT_CODES, MltlError } from "../lib/errors.js";
import type { Network } from "../types.js";

interface PriceOpts {
  token: string;
  amount?: string;
  json: boolean;
  testnet: boolean;
}

/** Parse a wei string safely — returns the formatted ETH string or the raw value if not integer */
function parseWei(value: string): string {
  if (/^\d+$/.test(value)) {
    return ethers.formatEther(BigInt(value));
  }
  // Already decimal or unexpected format — pass through
  return value;
}

export async function price(opts: PriceOpts): Promise<void> {
  const { token, json } = opts;
  const network: Network = opts.testnet ? "testnet" : "mainnet";
  const chain = CHAIN[network];

  try {
    if (!/^0x[a-fA-F0-9]{40}$/.test(token)) {
      throw new Error("Invalid token address — expected 0x followed by 40 hex characters");
    }

    if (opts.amount !== undefined) {
      const parsed = parseFloat(opts.amount);
      if (isNaN(parsed) || parsed <= 0) {
        throw new Error(`Invalid amount: ${opts.amount} — must be a positive number`);
      }
    }

    if (!json) console.log(`\nFetching token details...\n`);

    const [details, holders] = await Promise.all([
      fetchTokenDetails(token, network),
      fetchTokenHolderCount(token, network).catch(() => null),
    ]);

    const marketCapETH = parseWei(details.price.marketCapETH);
    const volume24hETH = parseWei(details.volume.volume24h);
    const flaunchUrl = `${chain.flaunchUrl}/coin/${token}`;

    if (json) {
      const output: Record<string, unknown> = {
        success: true,
        tokenAddress: details.tokenAddress,
        name: details.name,
        symbol: details.symbol,
        description: details.description,
        image: details.image,
        marketCapETH,
        priceChange24h: details.price.priceChange24h,
        volume24hETH,
        holders,
        creator: details.status.owner,
        createdAt: new Date(details.status.createdAt * 1000).toISOString(),
        flaunchUrl,
        network: chain.name,
      };

      if (opts.amount) {
        const spendETH = parseFloat(opts.amount);
        const mcapETH = parseFloat(marketCapETH);
        const percentOfMcap = mcapETH > 0 ? ((spendETH / mcapETH) * 100).toFixed(2) : null;
        output.estimate = {
          spendETH: opts.amount,
          percentOfMcap,
          note: "Approximate — actual output depends on pool liquidity and slippage",
        };
      }

      console.log(JSON.stringify(output, null, 2));
      return;
    }

    // Human-readable output
    const mcapFormatted = formatEthDisplay(parseFloat(marketCapETH));
    const volFormatted = formatEthDisplay(parseFloat(volume24hETH));
    const changeStr = formatChange(details.price.priceChange24h);

    console.log(`  ${details.name} (${details.symbol})`);
    console.log(`  ${details.tokenAddress}\n`);
    if (details.description) {
      console.log(`  ${details.description}\n`);
    }
    console.log(`  Market cap:    ${mcapFormatted}`);
    console.log(`  24h change:    ${changeStr}`);
    console.log(`  24h volume:    ${volFormatted}`);
    console.log(`  Holders:       ${holders ?? "unknown"}`);
    console.log(`  Creator:       ${details.status.owner}`);
    console.log(`  Trade:         ${flaunchUrl}`);

    if (opts.amount) {
      const spendETH = parseFloat(opts.amount);
      const mcapETH = parseFloat(marketCapETH);
      const pct = mcapETH > 0 ? ((spendETH / mcapETH) * 100).toFixed(2) : "N/A";
      console.log();
      console.log(`  Estimate for ${opts.amount} ETH:`);
      console.log(`    ~${pct}% of market cap`);
      console.log(`    Actual output depends on pool liquidity and slippage`);
    }

    console.log();
  } catch (error) {
    if (error instanceof MltlError) {
      printError(error.message, json, error.exitCode);
      process.exit(error.exitCode);
    }
    const message = error instanceof Error ? error.message : String(error);
    printError(message, json, EXIT_CODES.GENERAL);
    process.exit(EXIT_CODES.GENERAL);
  }
}

function formatEthDisplay(eth: number): string {
  if (eth >= 1_000) return `${(eth / 1_000).toFixed(1)}k ETH`;
  if (eth >= 1) return `${eth.toFixed(4)} ETH`;
  if (eth >= 0.001) return `${eth.toFixed(6)} ETH`;
  if (eth === 0) return "0 ETH";
  return `${eth.toExponential(2)} ETH`;
}

function formatChange(change: string): string {
  const num = parseFloat(change);
  if (isNaN(num)) return change;
  const sign = num >= 0 ? "+" : "";
  return `${sign}${num.toFixed(2)}%`;
}
