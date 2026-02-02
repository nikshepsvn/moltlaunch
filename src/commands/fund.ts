import { loadWallet, getWalletBalance } from "../lib/wallet.js";
import { printError } from "../lib/output.js";
import { EXIT_CODES, MltlError, NoWalletError } from "../lib/errors.js";

interface FundOpts {
  json: boolean;
}

const FUNDING_METHODS = [
  { method: "Base Bridge", url: "https://bridge.base.org" },
  { method: "Coinbase", url: "https://www.coinbase.com" },
  { method: "Direct transfer", description: "Send ETH on Base to the address above" },
] as const;

const MINIMUM_RECOMMENDED = "0.005";

export async function fund(opts: FundOpts): Promise<void> {
  const { json } = opts;

  try {
    const data = await loadWallet();
    if (!data) throw new NoWalletError();

    let balance: string | null = null;
    try {
      balance = await getWalletBalance(data.address, "mainnet");
    } catch {
      // RPC may be unreachable
    }

    if (json) {
      console.log(JSON.stringify({
        success: true,
        address: data.address,
        balance,
        network: "Base",
        chainId: 8453,
        fundingMethods: FUNDING_METHODS,
        minimumRecommended: MINIMUM_RECOMMENDED,
        message: `Send Base ETH to ${data.address} to fund this agent`,
      }, null, 2));
      return;
    }

    console.log("\nFund your agent wallet\n");
    console.log(`  Address:     ${data.address}`);
    console.log(`  Balance:     ${balance ?? "unknown"} ETH (Base)`);
    console.log(`  Recommended: ${MINIMUM_RECOMMENDED} ETH`);
    console.log();
    console.log("  How to fund:");
    console.log("    1. Base Bridge:  https://bridge.base.org");
    console.log("    2. Coinbase:     https://www.coinbase.com");
    console.log("    3. Direct:       Send ETH on Base to the address above");
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
