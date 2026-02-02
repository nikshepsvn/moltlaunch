import { type Hex } from "viem";

/**
 * Magic 4-byte prefix "MLTL" (0x4d4c544c) marks where memo data begins
 * in appended calldata. The ABI decoder ignores trailing bytes, so this
 * is safe to append after any valid calldata payload.
 */
const MAGIC_PREFIX = "4d4c544c" as const;

/** Max memo payload size — 64KB minus the 4-byte prefix */
const MAX_MEMO_BYTES = 65_532;

/**
 * Encode a memo object as hex bytes with the MLTL magic prefix.
 * The memo is JSON-serialized, UTF-8 encoded, then hex-encoded.
 * Returns null if memo is empty or too large.
 */
export function encodeMemo(memo: Record<string, unknown>): Hex | null {
  const json = JSON.stringify(memo);
  const bytes = new TextEncoder().encode(json);

  if (bytes.length === 0) return null;
  if (bytes.length > MAX_MEMO_BYTES) {
    console.warn(`Memo too large (${bytes.length} bytes, max ${MAX_MEMO_BYTES}). Skipping.`);
    return null;
  }

  // Convert bytes to hex string
  const hexPayload = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `0x${MAGIC_PREFIX}${hexPayload}` as Hex;
}

/**
 * Extract memo from raw transaction calldata by scanning for the MLTL
 * magic prefix. Returns the decoded JSON object or null if no memo found.
 */
export function decodeMemo(calldata: Hex): Record<string, unknown> | null {
  const hex = calldata.toLowerCase().replace("0x", "");
  const prefixIdx = hex.lastIndexOf(MAGIC_PREFIX.toLowerCase());

  if (prefixIdx === -1) return null;

  const payloadHex = hex.slice(prefixIdx + MAGIC_PREFIX.length);
  if (payloadHex.length === 0 || payloadHex.length % 2 !== 0) return null;

  try {
    const bytes = new Uint8Array(payloadHex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(payloadHex.slice(i * 2, i * 2 + 2), 16);
    }
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Append memo hex to existing calldata. Simply concatenates the bytes.
 */
export function appendMemoToCalldata(calldata: Hex, memoHex: Hex): Hex {
  return `${calldata}${memoHex.slice(2)}` as Hex;
}
