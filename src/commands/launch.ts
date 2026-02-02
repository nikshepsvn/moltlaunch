import { resolve } from "node:path";
import { access } from "node:fs/promises";
import { loadOrCreateWallet, saveLaunchRecord } from "../lib/wallet.js";
import { uploadImage, launchMemecoin, pollLaunchStatus } from "../lib/flaunch-api.js";
import { launchViaClanker } from "../lib/clanker.js";
import { generateTokenLogo } from "../lib/generate-logo.js";
import { printSuccess, printError } from "../lib/output.js";
import { announceToken } from "../lib/announce.js";
import { CHAIN, REVENUE_MANAGER_ADDRESS } from "../lib/config.js";
import { MltlError, EXIT_CODES } from "../lib/errors.js";
import type { LaunchParams, Network, LaunchRecord } from "../types.js";

export async function launch(opts: LaunchParams): Promise<void> {
  const { name, symbol, description, website, testnet, json, quiet, protocol } = opts;
  const network: Network = testnet ? "testnet" : "mainnet";
  const chain = testnet ? CHAIN.testnet : CHAIN.mainnet;

  if (!json && protocol === "clanker") {
    console.log("Using Clanker protocol (requires gas)");
  }

  try {
    // Resolve image: use provided path or generate a unique one
    let imageSource: string | { buffer: Buffer; mime: string };

    if (opts.imagePath) {
      const resolvedImage = resolve(opts.imagePath);
      try {
        await access(resolvedImage);
      } catch {
        printError(`Image not found: ${resolvedImage}`, json, EXIT_CODES.UPLOAD_FAIL);
        process.exit(EXIT_CODES.UPLOAD_FAIL);
      }
      imageSource = resolvedImage;
    } else {
      if (!json) console.log("Generating unique logo from token name...");
      imageSource = { buffer: generateTokenLogo(name, symbol), mime: "image/png" };
    }

    // Step 1: Load or create wallet
    const { wallet, isNew } = await loadOrCreateWallet();

    if (!json) {
      if (isNew) {
        console.log(`\nWallet created: ${wallet.address}`);
        console.log(`Private key: ${wallet.privateKey}`);
        console.log("(Save this key — it will not be shown again)\n");
      } else {
        console.log(`\nUsing wallet: ${wallet.address}`);
      }
    }

    // Step 2: Upload image to IPFS
    if (!json) process.stdout.write("Uploading image...");
    const imageIpfs = await uploadImage(imageSource);
    if (!json) console.log(` ${imageIpfs.slice(0, 16)}...`);

    let tokenAddress: string;
    let transactionHash: string;
    let flaunchUrl: string;
    let clankerUrl: string | undefined;

    if (protocol === "clanker") {
      // Clanker launch flow (requires gas)
      if (!json) process.stdout.write("Deploying via Clanker...");

      const clankerResult = await launchViaClanker({
        name,
        symbol,
        description,
        imageUrl: `https://ipfs.io/ipfs/${imageIpfs}`,
        privateKey: wallet.privateKey,
        websiteUrl: website,
        network,
      });

      if (!json) console.log(" done");

      tokenAddress = clankerResult.tokenAddress;
      transactionHash = clankerResult.txHash;
      clankerUrl = clankerResult.clankerUrl;
      flaunchUrl = ""; // Not applicable for Clanker
    } else {
      // Flaunch launch flow (gasless)
      if (!json) process.stdout.write("Submitting launch...");

      const jobId = await launchMemecoin({
        name,
        symbol,
        description,
        imageIpfs,
        creatorAddress: wallet.address,
        revenueManagerAddress: REVENUE_MANAGER_ADDRESS,
        websiteUrl: website,
        network,
      });
      if (!json) console.log(` queued (job ${jobId})`);

      // Poll for completion
      if (!json) process.stdout.write("Deploying on-chain");
      const result = await pollLaunchStatus(jobId, (state, position) => {
        if (!json) {
          if (position > 0) {
            process.stdout.write(` [queue: ${position}]`);
          } else {
            process.stdout.write(".");
          }
        }
      });
      if (!json) console.log(" done");

      if (!result.collectionToken?.address || !result.transactionHash) {
        throw new MltlError(
          "Launch completed but missing token address or transaction hash",
          EXIT_CODES.LAUNCH_FAIL,
        );
      }

      tokenAddress = result.collectionToken.address;
      transactionHash = result.transactionHash;
      flaunchUrl = `${chain.flaunchUrl}/coin/${tokenAddress}`;
    }

    // Step 5: Save launch record
    const launchRecord: LaunchRecord = {
      name,
      symbol,
      tokenAddress,
      transactionHash,
      network,
      walletAddress: wallet.address,
      launchedAt: new Date().toISOString(),
      flaunchUrl,
      protocol,
      clankerUrl,
    };
    await saveLaunchRecord(launchRecord);

    // Step 6: Announce to social platforms (unless --quiet)
    const announcements = await announceToken(launchRecord, { quiet: !!quiet, json });

    // Output result
    const outputData: Record<string, unknown> = {
      protocol,
      tokenAddress,
      transactionHash,
      name,
      symbol,
      network: chain.name,
      explorer: `${chain.explorer}/token/${tokenAddress}`,
      wallet: wallet.address,
    };

    // Add protocol-specific URLs
    if (protocol === "clanker" && clankerUrl) {
      outputData.clanker = clankerUrl;
    } else {
      outputData.flaunch = flaunchUrl;
    }

    if (announcements.length > 0) {
      outputData.announcements = announcements;
    }

    if (isNew) {
      outputData.privateKey = wallet.privateKey;
      outputData.walletNote = "Save this private key — it will not be shown again";
    }

    printSuccess("Token launched successfully!", outputData, json);
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
