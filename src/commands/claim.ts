import { ethers } from "ethers";
import { loadWallet, getSigner, getWalletBalance, loadLaunchRecords } from "../lib/wallet.js";
import { claimClankerFees } from "../lib/clanker-fees.js";
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

    // Check Flaunch claimable balance
    const flaunchClaimable = await rm.balances(walletData.address);
    const flaunchClaimableEth = ethers.formatEther(flaunchClaimable);

    // Check for Clanker launches
    const launches = await loadLaunchRecords();
    const clankerLaunches = launches.filter(l => l.protocol === "clanker");

    // Track if anything was claimed
    let flaunchClaimed = false;
    let flaunchTxHash: string | undefined;
    let clankerResult: Awaited<ReturnType<typeof claimClankerFees>> | undefined;

    // Claim Flaunch fees if any
    if (flaunchClaimable > 0n) {
      if (!json) console.log(`\nFlaunch claimable: ${flaunchClaimableEth} ETH`);
      if (!json) process.stdout.write("Claiming Flaunch fees...");

      const tx = await rm.claim();
      if (!json) console.log(` tx ${tx.hash}`);

      if (!json) process.stdout.write("Waiting for confirmation...");
      const receipt = await tx.wait();
      if (!receipt) {
        throw new MltlError("Flaunch transaction was dropped or replaced", EXIT_CODES.GENERAL);
      }
      if (!json) console.log(" confirmed");

      flaunchClaimed = true;
      flaunchTxHash = receipt.hash;
    }

    // Claim Clanker fees if any launches exist
    if (clankerLaunches.length > 0) {
      if (!json) process.stdout.write("Claiming Clanker fees...");
      try {
        clankerResult = await claimClankerFees(
          walletData.privateKey,
          clankerLaunches,
          network,
        );
        if (!json) console.log(" done");
      } catch (error) {
        if (!json) console.log(" failed");
        // Continue even if Clanker claim fails
      }
    }

    // Check if anything was claimed
    const anythingClaimed = flaunchClaimed ||
      clankerResult?.wethClaimed ||
      (clankerResult?.tokensClaimed.length ?? 0) > 0;

    if (!anythingClaimed) {
      printSuccess("No fees to claim", {
        flaunchClaimable: "0 ETH",
        wallet: walletData.address,
        network,
      }, json);
      return;
    }

    // Build output
    const output: Record<string, unknown> = {
      wallet: walletData.address,
      network,
    };

    if (flaunchClaimed && flaunchTxHash) {
      output.flaunch = {
        claimed: `${flaunchClaimableEth} ETH (minus protocol fee)`,
        transactionHash: flaunchTxHash,
      };
    }

    if (clankerResult && (clankerResult.wethClaimed || clankerResult.tokensClaimed.length > 0)) {
      output.clanker = {
        wethClaimed: clankerResult.wethClaimed,
        wethTxHash: clankerResult.wethTxHash,
        tokensClaimed: clankerResult.tokensClaimed,
      };
    }

    printSuccess("Fees claimed successfully!", output, json);
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
