import { ethers } from "ethers";
import { loadWallet, getWalletBalance, loadLaunchRecords } from "../lib/wallet.js";
import { getClankerFees } from "../lib/clanker-fees.js";
import { REVENUE_MANAGER_ADDRESS, CHAIN } from "../lib/config.js";
import { printSuccess, printError } from "../lib/output.js";
import { EXIT_CODES, NoWalletError, MltlError } from "../lib/errors.js";
import type { Network } from "../types.js";

const REVENUE_MANAGER_ABI = [
  "function balances(address) external view returns (uint256)",
  "function protocolFee() external view returns (uint256)",
];

interface FeesOpts {
  testnet: boolean;
  json: boolean;
}

export async function fees(opts: FeesOpts): Promise<void> {
  const { testnet, json } = opts;
  const network: Network = testnet ? "testnet" : "mainnet";

  try {
    const walletData = await loadWallet();
    if (!walletData) {
      throw new NoWalletError();
    }

    const chain = testnet ? CHAIN.testnet : CHAIN.mainnet;
    const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
    const rm = new ethers.Contract(REVENUE_MANAGER_ADDRESS, REVENUE_MANAGER_ABI, provider);

    const claimable = await rm.balances(walletData.address);
    const claimableEth = ethers.formatEther(claimable);

    // Protocol takes a cut on claim (e.g. 1000 = 10%)
    let protocolFeeBps = 1000n;
    try { protocolFeeBps = await rm.protocolFee(); } catch { /* use default */ }
    const afterProtocol = claimable - (claimable * protocolFeeBps / 10000n);
    const afterProtocolEth = ethers.formatEther(afterProtocol);

    const walletBalance = await getWalletBalance(walletData.address, network);
    const hasGas = parseFloat(walletBalance) > 0;

    // Check for Clanker fees from launched tokens
    const launches = await loadLaunchRecords();
    const clankerLaunches = launches.filter(l => l.protocol === "clanker");

    let clankerFees = null;
    if (clankerLaunches.length > 0) {
      try {
        clankerFees = await getClankerFees(walletData.address, clankerLaunches, network);
      } catch {
        // Clanker fee check failed, continue with Flaunch fees
      }
    }

    // Build output
    const output: Record<string, unknown> = {
      flaunch: {
        claimable: `${claimableEth} ETH`,
        afterProtocolFee: `~${afterProtocolEth} ETH`,
        protocolFee: `${Number(protocolFeeBps) / 100}%`,
      },
      wallet: walletData.address,
      walletBalance: `${walletBalance} ETH`,
      hasGas,
      network: chain.name,
      canClaim: hasGas && (claimable > 0n || (clankerFees && clankerFees.wethClaimable > 0n)),
    };

    // Add Clanker fees if available
    if (clankerFees) {
      output.clanker = {
        weth: `${clankerFees.wethClaimableFormatted} ETH`,
        tokens: clankerFees.tokenBalances.map(t => ({
          symbol: t.symbol,
          amount: t.claimableFormatted,
        })),
      };
    }

    printSuccess("Fee balance", output, json);
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
