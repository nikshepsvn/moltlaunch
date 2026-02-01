import { loadWallet, getWalletBalance } from "../lib/wallet.js";
import { printSuccess, printError } from "../lib/output.js";
import { EXIT_CODES, MltlError } from "../lib/errors.js";

interface WalletOpts {
  showKey: boolean;
  json: boolean;
}

export async function wallet(opts: WalletOpts): Promise<void> {
  const { showKey, json } = opts;

  try {
    const data = await loadWallet();
    if (!data) {
      printError("No wallet found. Run `mltl launch` to create one.", json, EXIT_CODES.NO_WALLET);
      process.exit(EXIT_CODES.NO_WALLET);
    }

    let balance = "unknown";
    try {
      balance = await getWalletBalance(data.address, "mainnet");
    } catch {
      // RPC may be unreachable
    }

    const output: Record<string, unknown> = {
      address: data.address,
      balance: json ? balance : `${balance} ETH (Base)`,
      network: json ? "Base" : undefined,
      createdAt: data.createdAt,
    };

    if (showKey) {
      output.privateKey = data.privateKey;
    }

    printSuccess("Wallet info", output, json);
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
