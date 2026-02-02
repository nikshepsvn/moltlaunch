import { createRequire } from "node:module";
import { Command } from "commander";
import { launch } from "./commands/launch.js";
import { wallet } from "./commands/wallet.js";
import { status } from "./commands/status.js";
import { claim } from "./commands/claim.js";
import { fees } from "./commands/fees.js";
import { swap } from "./commands/swap.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

const program = new Command();

program
  .name("mltl")
  .description("moltlaunch — the onchain toolkit for agents")
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
  .option("--protocol <name>", "Protocol to use: flaunch (gasless) or clanker (requires gas)", "flaunch")
  .option("--testnet", "Use Base Sepolia testnet", false)
  .option("--json", "Output as JSON (for agents)", false)
  .option("-q, --quiet", "Skip announcing to social platforms", false)
  .action((opts) =>
    launch({
      name: opts.name,
      symbol: opts.symbol,
      description: opts.description,
      imagePath: opts.image ?? undefined,
      website: opts.website,
      protocol: opts.protocol === "clanker" ? "clanker" : "flaunch",
      testnet: opts.testnet,
      json: opts.json,
      quiet: opts.quiet,
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
  .description("List all tokens under the revenue manager")
  .option("--testnet", "Use Base Sepolia testnet", false)
  .option("--json", "Output as JSON", false)
  .action((opts) =>
    status({ testnet: opts.testnet, json: opts.json })
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

program
  .command("swap")
  .description("Swap ETH for tokens or tokens for ETH on Uniswap V4")
  .requiredOption("--token <address>", "Token address")
  .requiredOption("--amount <amount>", "Amount (ETH for buy, tokens for sell)")
  .requiredOption("--side <direction>", "buy or sell")
  .option("--slippage <percent>", "Slippage tolerance percent", "5")
  .option("--testnet", "Use Base Sepolia testnet", false)
  .option("--json", "Output as JSON", false)
  .action((opts) =>
    swap({
      token: opts.token,
      amount: opts.amount,
      side: opts.side,
      slippage: parseFloat(opts.slippage),
      testnet: opts.testnet,
      json: opts.json,
    })
  );

program.parse();
