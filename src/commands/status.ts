import { ethers } from "ethers";
import { fetchTokensByOwner } from "../lib/flaunch-api.js";
import { loadWallet } from "../lib/wallet.js";
import { CHAIN } from "../lib/config.js";
import { printError } from "../lib/output.js";
import { EXIT_CODES, NoWalletError, MltlError } from "../lib/errors.js";
import type { Network } from "../types.js";

interface StatusOpts {
  testnet: boolean;
  json: boolean;
}

function formatMarketCap(marketCapWei: string): string {
  try {
    const eth = parseFloat(ethers.formatEther(BigInt(marketCapWei)));
    if (eth >= 1_000) return `${(eth / 1_000).toFixed(1)}k ETH`;
    if (eth >= 1) return `${eth.toFixed(2)} ETH`;
    if (eth >= 0.001) return `${eth.toFixed(4)} ETH`;
    return `${eth.toExponential(2)} ETH`;
  } catch {
    return "—";
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export async function status(opts: StatusOpts): Promise<void> {
  const { testnet, json } = opts;
  const network: Network = testnet ? "testnet" : "mainnet";
  const chain = testnet ? CHAIN.testnet : CHAIN.mainnet;

  try {
    const walletData = await loadWallet();
    if (!walletData) {
      throw new NoWalletError();
    }

    const response = await fetchTokensByOwner(walletData.address, network);
    const tokens = response.data;

    if (tokens.length === 0) {
      if (json) {
        console.log(JSON.stringify({ success: true, tokens: [], network: chain.name, wallet: walletData.address }));
      } else {
        console.log("\nNo tokens found. Run `mltl launch` to create one.\n");
      }
      return;
    }

    // Sort by most recently created first
    const sorted = [...tokens].sort((a, b) => b.createdAt - a.createdAt);

    if (json) {
      console.log(JSON.stringify({
        success: true,
        count: sorted.length,
        network: chain.name,
        wallet: walletData.address,
        tokens: sorted.map((t) => ({
          name: t.name,
          symbol: t.symbol,
          tokenAddress: t.tokenAddress,
          marketCapETH: formatMarketCap(t.marketCapETH),
          createdAt: new Date(t.createdAt * 1000).toISOString(),
          fairLaunchActive: t.fairLaunchActive,
          image: t.image,
          flaunchUrl: `${chain.flaunchUrl}/token/${t.tokenAddress}`,
        })),
      }, null, 2));
      return;
    }

    console.log(`\nYour tokens (${sorted.length}) — ${chain.name}\n`);

    for (const token of sorted) {
      const mcap = formatMarketCap(token.marketCapETH);
      const date = formatDate(token.createdAt);
      const fairLaunch = token.fairLaunchActive ? " [FAIR LAUNCH]" : "";

      console.log(`  ${token.name} (${token.symbol})${fairLaunch}`);
      console.log(`    Token:      ${token.tokenAddress}`);
      console.log(`    Market cap: ${mcap}`);
      console.log(`    Flaunch:    ${chain.flaunchUrl}/token/${token.tokenAddress}`);
      console.log(`    Launched:   ${date}`);
      console.log();
    }
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
