import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { LaunchRecord, AnnouncementResult } from "../types.js";

interface PlatformConfig {
  name: string;
  credPath: string;
  extractKey: (config: Record<string, unknown>) => string | undefined;
  buildRequest: (key: string, title: string, content: string) => { url: string; init: RequestInit };
  extractUrl: (body: Record<string, unknown>) => string | null;
}

const PLATFORMS: PlatformConfig[] = [
  {
    name: "4claw",
    credPath: join(homedir(), ".config", "4claw", "config.json"),
    extractKey: (c) => c.api_key as string | undefined,
    buildRequest: (key, title, content) => ({
      url: "https://www.4claw.org/api/v1/boards/crypto/threads",
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ title, content, anon: false }),
      },
    }),
    extractUrl: (body) =>
      (body.url as string) ?? (body.id ? `https://www.4claw.org/b/crypto/${body.id}` : null),
  },
  {
    name: "moltx",
    credPath: join(homedir(), ".config", "moltx", "config.json"),
    extractKey: (c) => c.api_key as string | undefined,
    buildRequest: (key, _title, content) => ({
      url: "https://moltx.io/v1/posts",
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ content }),
      },
    }),
    extractUrl: (body) => {
      const data = body.data as Record<string, unknown> | undefined;
      const id = data?.id ?? body.id;
      return (body.url as string) ?? (id ? `https://moltx.io/post/${id}` : null);
    },
  },
  {
    name: "moltbook",
    credPath: join(homedir(), ".config", "moltbook", "credentials.json"),
    extractKey: (c) => (c.api_key as string | undefined),
    buildRequest: (key, title, content) => ({
      url: "https://www.moltbook.com/api/v1/posts",
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ submolt: "crypto", title, content }),
      },
    }),
    extractUrl: (body) => {
      const post = body.post as Record<string, unknown> | undefined;
      if (post?.id) return `https://www.moltbook.com/post/${post.id}`;
      return (body.url as string) ?? null;
    },
  },
];

const ANNOUNCE_TIMEOUT_MS = 5000;

function buildAnnouncementContent(record: LaunchRecord): { title: string; content: string } {
  const title = `${record.name} (${record.symbol}) — just launched on Base`;
  const explorerUrl = `https://basescan.org/token/${record.tokenAddress}`;

  const lines = [
    `${record.name} (${record.symbol}) just launched on Base.`,
    "",
    `Trade: ${record.flaunchUrl}`,
    `Explorer: ${explorerUrl}`,
  ];

  return { title, content: lines.join("\n") };
}

async function loadApiKey(platform: PlatformConfig): Promise<string | undefined> {
  try {
    const raw = await readFile(platform.credPath, "utf-8");
    const config = JSON.parse(raw) as Record<string, unknown>;
    return platform.extractKey(config);
  } catch {
    return undefined;
  }
}

async function postToplatform(
  platform: PlatformConfig,
  title: string,
  content: string,
): Promise<AnnouncementResult> {
  const key = await loadApiKey(platform);
  if (!key) {
    return { platform: platform.name, url: null, success: false };
  }

  const { url, init } = platform.buildRequest(key, title, content);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ANNOUNCE_TIMEOUT_MS);

  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) {
      return { platform: platform.name, url: null, success: false };
    }
    const body = (await res.json()) as Record<string, unknown>;
    return { platform: platform.name, url: platform.extractUrl(body), success: true };
  } catch {
    return { platform: platform.name, url: null, success: false };
  } finally {
    clearTimeout(timeout);
  }
}

export async function announceToken(
  record: LaunchRecord,
  opts: { quiet: boolean; json: boolean },
): Promise<AnnouncementResult[]> {
  if (opts.quiet) return [];

  const { title, content } = buildAnnouncementContent(record);
  const results = await Promise.all(
    PLATFORMS.map((p) => postToplatform(p, title, content)),
  );

  if (!opts.json) {
    const succeeded = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    if (succeeded.length > 0) {
      const names = succeeded.map((r) => r.platform).join(", ");
      console.log(`Announced on ${names}`);
    }
    if (failed.length > 0) {
      const names = failed.map((r) => r.platform).join(", ");
      console.log(`Skipped announcements: ${names} (no credentials or API error)`);
    }
  }

  return results;
}
