import { createRequire } from "node:module";
import { Command } from "commander";
import { launch } from "./commands/launch.js";
import { wallet } from "./commands/wallet.js";
import { status } from "./commands/status.js";
import { claim } from "./commands/claim.js";
import { fees } from "./commands/fees.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

const program = new Command();

program
  .name("moltlaunch")
  .description("CLI for AI agents to launch tokens on Base via Flaunch")
  .version(version);

// Default command: launch a token
program
  .command("launch", { isDefault: true })
  .description("Launch a new token on Base")
  .requiredOption("--name <name>", "Token name")
  .requiredOption("--symbol <symbol>", "Token symbol")
  .requiredOption("--description <desc>", "Token description")
  .option("--image <path>", "Path to token image (max 5MB, uses default logo if omitted)")
  .option("--website <url>", "Website URL (overrides auto-created Moltbook post)")
  .option("--testnet", "Use Base Sepolia testnet", false)
  .option("--json", "Output as JSON (for agents)", false)
  .action((opts) =>
    launch({
      name: opts.name,
      symbol: opts.symbol,
      description: opts.description,
      imagePath: opts.image ?? undefined,
      website: opts.website,
      testnet: opts.testnet,
      json: opts.json,
    })
  );

program
  .command("wallet")
  .description("Show wallet address and balance")
  .option("--show-key", "Show private key", false)
  .option("--json", "Output as JSON", false)
  .action((opts) =>
    wallet({ showKey: opts.showKey, json: opts.json })
  );

program
  .command("status")
  .description("List launched tokens")
  .option("--json", "Output as JSON", false)
  .action((opts) =>
    status({ json: opts.json })
  );

program
  .command("fees")
  .description("Check claimable fee balance (read-only, no gas needed)")
  .option("--testnet", "Use Base Sepolia testnet", false)
  .option("--json", "Output as JSON", false)
  .action((opts) =>
    fees({ testnet: opts.testnet, json: opts.json })
  );

program
  .command("claim")
  .description("Withdraw accumulated fees from PositionManager escrow")
  .option("--testnet", "Use Base Sepolia testnet", false)
  .option("--json", "Output as JSON", false)
  .action((opts) =>
    claim({ testnet: opts.testnet, json: opts.json })
  );

program.parse();
