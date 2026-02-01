import { ethers } from "ethers";
import { readFile, writeFile, mkdir, chmod, access } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { WALLET_DIR, WALLET_FILE, LAUNCHES_FILE, CHAIN } from "./config.js";
import type { WalletData, LaunchRecord, Network } from "../types.js";

function getWalletDir(): string {
  return join(homedir(), WALLET_DIR);
}

function getWalletPath(): string {
  return join(getWalletDir(), WALLET_FILE);
}

function getLaunchesPath(): string {
  return join(getWalletDir(), LAUNCHES_FILE);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function walletExists(): Promise<boolean> {
  return fileExists(getWalletPath());
}

export async function loadWallet(): Promise<WalletData | null> {
  const path = getWalletPath();
  if (!(await fileExists(path))) return null;

  const raw = await readFile(path, "utf-8");
  return JSON.parse(raw) as WalletData;
}

export async function createWallet(): Promise<WalletData> {
  const wallet = ethers.Wallet.createRandom();
  const data: WalletData = {
    address: wallet.address,
    privateKey: wallet.privateKey,
    createdAt: new Date().toISOString(),
  };

  const dir = getWalletDir();
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await chmod(dir, 0o700);

  const path = getWalletPath();
  await writeFile(path, JSON.stringify(data, null, 2), { mode: 0o600 });
  await chmod(path, 0o600);

  return data;
}

export async function loadOrCreateWallet(): Promise<{ wallet: WalletData; isNew: boolean }> {
  const existing = await loadWallet();
  if (existing) return { wallet: existing, isNew: false };

  const wallet = await createWallet();
  return { wallet, isNew: true };
}

export async function getWalletBalance(address: string, network: Network): Promise<string> {
  const chain = network === "testnet" ? CHAIN.testnet : CHAIN.mainnet;
  const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
  const balance = await provider.getBalance(address);
  return ethers.formatEther(balance);
}

export async function getSigner(privateKey: string, network: Network): Promise<ethers.Wallet> {
  const chain = network === "testnet" ? CHAIN.testnet : CHAIN.mainnet;
  const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
  return new ethers.Wallet(privateKey, provider);
}

export async function saveLaunchRecord(record: LaunchRecord): Promise<void> {
  const path = getLaunchesPath();
  let records: LaunchRecord[] = [];

  if (await fileExists(path)) {
    const raw = await readFile(path, "utf-8");
    records = JSON.parse(raw) as LaunchRecord[];
  }

  records.push(record);

  const dir = getWalletDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path, JSON.stringify(records, null, 2), { mode: 0o600 });
}

export async function loadLaunchRecords(): Promise<LaunchRecord[]> {
  const path = getLaunchesPath();
  if (!(await fileExists(path))) return [];

  const raw = await readFile(path, "utf-8");
  return JSON.parse(raw) as LaunchRecord[];
}
