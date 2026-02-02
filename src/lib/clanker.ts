import { Clanker } from "clanker-sdk/v4";
import { createWalletClient, createPublicClient, http } from "viem";
import { base, baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { CHAIN } from "./config.js";
import { LaunchError, NoGasError } from "./errors.js";
import type { Network } from "../types.js";

export interface ClankerLaunchParams {
  name: string;
  symbol: string;
  description?: string;
  imageUrl: string;
  privateKey: string;
  websiteUrl?: string;
  network: Network;
}

export interface ClankerLaunchResult {
  tokenAddress: string;
  txHash: string;
  clankerUrl: string;
}

/**
 * Launch a token via Clanker SDK v4.
 * Unlike Flaunch, this requires gas from the user's wallet.
 */
export async function launchViaClanker(
  params: ClankerLaunchParams
): Promise<ClankerLaunchResult> {
  const { name, symbol, description, imageUrl, privateKey, websiteUrl, network } = params;

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const chain = network === "testnet" ? baseSepolia : base;
  const chainConfig = network === "testnet" ? CHAIN.testnet : CHAIN.mainnet;

  const publicClient = createPublicClient({
    chain,
    transport: http(chainConfig.rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(chainConfig.rpcUrl),
  });

  // Check gas balance before attempting deploy
  const balance = await publicClient.getBalance({ address: account.address });
  if (balance === 0n) {
    throw new NoGasError(account.address);
  }

  // Type cast needed due to viem version mismatch between SDK and this project
  const clanker = new Clanker({
    publicClient: publicClient as any,
    wallet: walletClient,
  });

  // Build metadata if description or website provided
  const metadata = description || websiteUrl ? {
    description,
    socialMediaUrls: websiteUrl ? [{ platform: "website", url: websiteUrl }] : undefined,
  } : undefined;

  const deployResult = await clanker.deploy({
    name,
    symbol,
    tokenAdmin: account.address,
    image: imageUrl,
    chainId: chain.id,
    metadata,
  });

  if (deployResult.error) {
    throw new LaunchError(`Clanker deploy failed: ${deployResult.error.message || deployResult.error}`);
  }

  if (!deployResult.txHash) {
    throw new LaunchError("Clanker deploy failed: no transaction hash returned");
  }

  // Wait for transaction confirmation
  const result = await deployResult.waitForTransaction();

  if (result.error) {
    throw new LaunchError(`Clanker transaction failed: ${result.error.message || result.error}`);
  }

  if (!result.address) {
    throw new LaunchError("Clanker deploy succeeded but no token address returned");
  }

  const tokenAddress = result.address;

  return {
    tokenAddress,
    txHash: deployResult.txHash,
    clankerUrl: `https://clanker.world/clanker/${tokenAddress}`,
  };
}
