import { parseEther, type Hex } from "viem";
import { loadWallet, getWalletBalance } from "../lib/wallet.js";
import { createFlaunchSdk } from "../lib/viem-client.js";
import { CHAIN, DEFAULT_SLIPPAGE_PERCENT } from "../lib/config.js";
import { printSuccess, printError } from "../lib/output.js";
import { EXIT_CODES, NoWalletError, NoGasError, SwapError, MltlError } from "../lib/errors.js";
import type { SwapParams, Network } from "../types.js";

export async function swap(opts: SwapParams): Promise<void> {
  const { token, amount, side, json } = opts;
  const slippage = opts.slippage ?? DEFAULT_SLIPPAGE_PERCENT;
  const network: Network = opts.testnet ? "testnet" : "mainnet";
  const chainConfig = CHAIN[network];

  try {
    const walletData = await loadWallet();
    if (!walletData) throw new NoWalletError();

    const balance = await getWalletBalance(walletData.address, network);
    if (parseFloat(balance) === 0) throw new NoGasError(walletData.address);

    if (!json) console.log(`\nSwapping on ${chainConfig.name}...`);

    const { flaunch, publicClient, walletClient, account } = createFlaunchSdk(walletData.privateKey, network);

    const coinAddress = token as `0x${string}`;
    const amountIn = parseEther(amount);

    let txHash: Hex;

    if (side === "buy") {
      if (!json) process.stdout.write(`Buying with ${amount} ETH...`);

      txHash = await flaunch.buyCoin({
        coinAddress,
        amountIn,
        slippagePercent: slippage,
        swapType: "EXACT_IN",
      });
    } else {
      if (!json) process.stdout.write(`Selling ${amount} tokens...`);

      // Check Permit2 allowance for sell flow
      const { allowance } = await flaunch.getPermit2AllowanceAndNonce(coinAddress);

      if (allowance < amountIn) {
        if (!json) process.stdout.write(" (signing Permit2 approval)");

        const { typedData, permitSingle } = await flaunch.getPermit2TypedData(coinAddress);

        const signature = await walletClient.signTypedData({ ...typedData, account });

        txHash = await flaunch.sellCoin({
          coinAddress,
          amountIn,
          slippagePercent: slippage,
          permitSingle,
          signature,
        });
      } else {
        txHash = await flaunch.sellCoin({
          coinAddress,
          amountIn,
          slippagePercent: slippage,
        });
      }
    }

    if (!json) console.log(` tx ${txHash}`);
    if (!json) process.stdout.write("Waiting for confirmation...");

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    if (receipt.status === "reverted") {
      throw new SwapError("Transaction reverted");
    }

    if (!json) console.log(" confirmed");

    printSuccess(`${side === "buy" ? "Buy" : "Sell"} swap completed!`, {
      transactionHash: receipt.transactionHash,
      side,
      amountIn: side === "buy" ? `${amount} ETH` : `${amount} tokens`,
      tokenAddress: token,
      network: chainConfig.name,
      explorer: `${chainConfig.explorer}/tx/${receipt.transactionHash}`,
      flaunch: `${chainConfig.flaunchUrl}/coin/${token}`,
    }, json);
  } catch (error) {
    if (error instanceof MltlError) {
      printError(error.message, json, error.exitCode);
      process.exit(error.exitCode);
    }
    const message = error instanceof Error ? error.message : String(error);
    printError(message, json, EXIT_CODES.SWAP_FAIL);
    process.exit(EXIT_CODES.SWAP_FAIL);
  }
}
