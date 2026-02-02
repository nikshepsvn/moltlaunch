import { createPublicClient, createWalletClient, http, encodeFunctionData, type Hex, type PublicClient, type WalletClient, type Account } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";
import { createDrift, type Drift, type ReadWriteAdapter } from "@delvtech/drift";
import { viemAdapter } from "@delvtech/drift-viem";
import { ReadWriteFlaunchSDK } from "@flaunch/sdk";
import { CHAIN } from "./config.js";
import { appendMemoToCalldata } from "./memo.js";
import type { Network } from "../types.js";

// Module-level memo context — set before calling SDK, proxy reads and appends
let _pendingMemoHex: Hex | null = null;

/** Set memo bytes to append to the next transaction's calldata. Auto-clears after use. */
export function setMemo(memoHex: Hex | null): void {
  _pendingMemoHex = memoHex;
}

/** Clear any pending memo without consuming it. */
export function clearMemo(): void {
  _pendingMemoHex = null;
}

const VIEM_CHAINS = {
  mainnet: base,
  testnet: baseSepolia,
} as const;

interface FlaunchClients {
  flaunch: ReadWriteFlaunchSDK;
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: Account;
}

export function createFlaunchSdk(privateKey: string, network: Network): FlaunchClients {
  const chainConfig = CHAIN[network];
  const chain = VIEM_CHAINS[network];
  const account = privateKeyToAccount(privateKey as `0x${string}`);

  const publicClient = createPublicClient({
    chain,
    transport: http(chainConfig.rpcUrl),
  });

  const walletClient = createWalletClient({
    chain,
    account,
    transport: http(chainConfig.rpcUrl),
  });

  // drift-viem passes address strings (not Account objects) to viem methods,
  // which makes viem use eth_sendTransaction (JSON-RPC signing) instead of
  // local signing + eth_sendRawTransaction. Patch the methods to always use
  // the local Account object so transactions are signed client-side.
  //
  // Also: if a memo is pending, append it to the calldata of writeContract
  // and sendTransaction calls. The ABI decoder ignores trailing bytes.
  const patchedWalletClient = new Proxy(walletClient, {
    get(target, prop, receiver) {
      const val = Reflect.get(target, prop, receiver);
      if (typeof val !== "function") return val;
      if (prop === "writeContract" || prop === "sendTransaction" || prop === "deployContract") {
        return (args: Record<string, unknown>) => {
          const patched: Record<string, unknown> = { ...args, account };

          // Consume pending memo and append to calldata
          if (_pendingMemoHex && (prop === "writeContract" || prop === "sendTransaction")) {
            const memo = _pendingMemoHex;
            _pendingMemoHex = null; // auto-clear after consumption

            if (prop === "sendTransaction" && typeof patched.data === "string") {
              patched.data = appendMemoToCalldata(patched.data as Hex, memo);
            }

            // writeContract: viem encodes calldata internally, so we encode it
            // ourselves, append the memo, and send as a raw sendTransaction
            if (prop === "writeContract" && patched.abi && patched.functionName) {
              const encoded = encodeFunctionData({
                abi: patched.abi as readonly unknown[],
                functionName: patched.functionName as string,
                args: (patched.args ?? []) as readonly unknown[],
              });
              const data = appendMemoToCalldata(encoded, memo);
              const sendTx = Reflect.get(target, "sendTransaction", receiver) as
                (a: Record<string, unknown>) => Promise<Hex>;
              return sendTx.call(target, {
                account,
                to: patched.address as string,
                data,
                value: patched.value ?? 0n,
                ...(patched.gas ? { gas: patched.gas } : {}),
              });
            }
          }

          return val.call(target, patched);
        };
      }
      return val.bind(target);
    },
  });

  // Cast needed: Base chain's deposit tx type causes generic mismatch with drift-viem
  const drift = createDrift({
    adapter: viemAdapter({
      publicClient: publicClient as unknown as PublicClient,
      walletClient: patchedWalletClient as unknown as WalletClient,
    }),
  }) as unknown as Drift<ReadWriteAdapter>;

  const flaunch = new ReadWriteFlaunchSDK(chain.id, drift);

  return {
    flaunch,
    publicClient: publicClient as unknown as PublicClient,
    walletClient: patchedWalletClient as unknown as WalletClient,
    account,
  };
}
