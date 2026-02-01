import { ethers } from "ethers";
import { loadWallet, getSigner, getWalletBalance } from "../lib/wallet.js";
import { REVENUE_MANAGER_ADDRESS } from "../lib/config.js";
import { printSuccess, printError } from "../lib/output.js";
import { EXIT_CODES, NoWalletError, NoGasError, MltlError } from "../lib/errors.js";
import type { Network } from "../types.js";

// Fees accumulate in FeeEscrow, claimed via the Revenue Manager
const REVENUE_MANAGER_ABI = [
  "function balances(address) external view returns (uint256)",
  "function claim() external returns (uint256)",
];

interface ClaimOpts {
  testnet: boolean;
  json: boolean;
}

export async function claim(opts: ClaimOpts): Promise<void> {
  const { testnet, json } = opts;
  const network: Network = testnet ? "testnet" : "mainnet";

  try {
    const walletData = await loadWallet();
    if (!walletData) {
      throw new NoWalletError();
    }

    // Check gas balance
    const balance = await getWalletBalance(walletData.address, network);
    if (parseFloat(balance) === 0) {
      throw new NoGasError(walletData.address);
    }

    const signer = await getSigner(walletData.privateKey, network);
    const rm = new ethers.Contract(REVENUE_MANAGER_ADDRESS, REVENUE_MANAGER_ABI, signer);

    // Check claimable balance
    const claimable = await rm.balances(walletData.address);
    const claimableEth = ethers.formatEther(claimable);

    if (claimable === 0n) {
      printSuccess("No fees to claim", {
        claimable: "0 ETH",
        wallet: walletData.address,
        network,
      }, json);
      return;
    }

    if (!json) console.log(`\nClaimable: ${claimableEth} ETH`);
    if (!json) process.stdout.write("Submitting claim transaction...");

    // claim() pulls fees from FeeEscrow, deducts protocol fee, sends ETH to caller
    const tx = await rm.claim();
    if (!json) console.log(` tx ${tx.hash}`);

    if (!json) process.stdout.write("Waiting for confirmation...");
    const receipt = await tx.wait();
    if (!receipt) {
      throw new MltlError("Transaction was dropped or replaced", EXIT_CODES.GENERAL);
    }
    if (!json) console.log(" confirmed");

    printSuccess("Fees claimed successfully!", {
      transactionHash: receipt.hash,
      claimed: `${claimableEth} ETH (minus protocol fee)`,
      wallet: walletData.address,
      network,
    }, json);
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
