import { createPublicClient, createWalletClient, http, formatEther } from "viem";
import { base, baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { CLANKER_FEE_LOCKER, CLANKER_WETH, CHAIN } from "./config.js";
import type { Network, LaunchRecord } from "../types.js";

// FeeLocker ABI - minimal interface for checking and claiming fees
const FEE_LOCKER_ABI = [
  {
    inputs: [
      { name: "feeOwner", type: "address" },
      { name: "token", type: "address" },
    ],
    name: "feesToClaim",
    outputs: [{ name: "balance", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "feeOwner", type: "address" },
      { name: "token", type: "address" },
    ],
    name: "claim",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export interface ClankerFeeBalance {
  wethClaimable: bigint;
  wethClaimableFormatted: string;
  tokenBalances: Array<{
    tokenAddress: string;
    symbol: string;
    claimable: bigint;
    claimableFormatted: string;
  }>;
}

/**
 * Check claimable fees from Clanker FeeLocker for a wallet.
 * Clanker fees are stored per-token (WETH + native token fees).
 */
export async function getClankerFees(
  walletAddress: string,
  clankerLaunches: LaunchRecord[],
  network: Network,
): Promise<ClankerFeeBalance> {
  const chainConfig = network === "testnet" ? CHAIN.testnet : CHAIN.mainnet;
  const chain = network === "testnet" ? baseSepolia : base;

  const publicClient = createPublicClient({
    chain,
    transport: http(chainConfig.rpcUrl),
  });

  // Check WETH fees first
  const wethClaimable = await publicClient.readContract({
    address: CLANKER_FEE_LOCKER as `0x${string}`,
    abi: FEE_LOCKER_ABI,
    functionName: "feesToClaim",
    args: [walletAddress as `0x${string}`, CLANKER_WETH as `0x${string}`],
  });

  // Check fees for each Clanker-launched token
  const tokenBalances: ClankerFeeBalance["tokenBalances"] = [];

  for (const launch of clankerLaunches) {
    if (launch.protocol !== "clanker") continue;

    try {
      const claimable = await publicClient.readContract({
        address: CLANKER_FEE_LOCKER as `0x${string}`,
        abi: FEE_LOCKER_ABI,
        functionName: "feesToClaim",
        args: [walletAddress as `0x${string}`, launch.tokenAddress as `0x${string}`],
      });

      if (claimable > 0n) {
        tokenBalances.push({
          tokenAddress: launch.tokenAddress,
          symbol: launch.symbol,
          claimable,
          claimableFormatted: formatEther(claimable),
        });
      }
    } catch {
      // Token might not have fees or contract call failed
    }
  }

  return {
    wethClaimable,
    wethClaimableFormatted: formatEther(wethClaimable),
    tokenBalances,
  };
}

export interface ClankerClaimResult {
  wethClaimed: boolean;
  wethTxHash?: string;
  tokensClaimed: Array<{
    tokenAddress: string;
    symbol: string;
    txHash: string;
  }>;
}

/**
 * Claim all available fees from Clanker FeeLocker.
 * Claims WETH fees first, then token-specific fees.
 */
export async function claimClankerFees(
  privateKey: string,
  clankerLaunches: LaunchRecord[],
  network: Network,
): Promise<ClankerClaimResult> {
  const chainConfig = network === "testnet" ? CHAIN.testnet : CHAIN.mainnet;
  const chain = network === "testnet" ? baseSepolia : base;

  const account = privateKeyToAccount(privateKey as `0x${string}`);

  const publicClient = createPublicClient({
    chain,
    transport: http(chainConfig.rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(chainConfig.rpcUrl),
  });

  const result: ClankerClaimResult = {
    wethClaimed: false,
    tokensClaimed: [],
  };

  // Claim WETH fees
  const wethClaimable = await publicClient.readContract({
    address: CLANKER_FEE_LOCKER as `0x${string}`,
    abi: FEE_LOCKER_ABI,
    functionName: "feesToClaim",
    args: [account.address, CLANKER_WETH as `0x${string}`],
  });

  if (wethClaimable > 0n) {
    const hash = await walletClient.writeContract({
      address: CLANKER_FEE_LOCKER as `0x${string}`,
      abi: FEE_LOCKER_ABI,
      functionName: "claim",
      args: [account.address, CLANKER_WETH as `0x${string}`],
    });

    await publicClient.waitForTransactionReceipt({ hash });
    result.wethClaimed = true;
    result.wethTxHash = hash;
  }

  // Claim token-specific fees
  for (const launch of clankerLaunches) {
    if (launch.protocol !== "clanker") continue;

    try {
      const claimable = await publicClient.readContract({
        address: CLANKER_FEE_LOCKER as `0x${string}`,
        abi: FEE_LOCKER_ABI,
        functionName: "feesToClaim",
        args: [account.address, launch.tokenAddress as `0x${string}`],
      });

      if (claimable > 0n) {
        const hash = await walletClient.writeContract({
          address: CLANKER_FEE_LOCKER as `0x${string}`,
          abi: FEE_LOCKER_ABI,
          functionName: "claim",
          args: [account.address, launch.tokenAddress as `0x${string}`],
        });

        await publicClient.waitForTransactionReceipt({ hash });
        result.tokensClaimed.push({
          tokenAddress: launch.tokenAddress,
          symbol: launch.symbol,
          txHash: hash,
        });
      }
    } catch {
      // Token might not have fees or claim failed
    }
  }

  return result;
}
