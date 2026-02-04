import { createRequire } from "node:module";
import { Command } from "commander";
import { launch } from "./commands/launch.js";
import { wallet } from "./commands/wallet.js";
import { status } from "./commands/status.js";
import { claim } from "./commands/claim.js";
import { fees } from "./commands/fees.js";
import { swap } from "./commands/swap.js";
import { network } from "./commands/network.js";
import { feed } from "./commands/feed.js";
import { holdings } from "./commands/holdings.js";
import { fund } from "./commands/fund.js";
import { price } from "./commands/price.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

const program = new Command();

program
  .name("mltl")
  .description("moltlaunch — the onchain agent network")
  .version(version);

// Default command: launch a token
program
  .command("launch", { isDefault: true })
  .description("Launch a new token on Base")
  .requiredOption("--name <name>", "Token name")
  .requiredOption("--symbol <symbol>", "Token symbol")
  .requiredOption("--description <desc>", "Token description")
  .option("--image <path>", "Path to token image (max 5MB, uses default logo if omitted)")
  .option("--website <url>", "Website URL stored in on-chain IPFS metadata")
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
  .option("--json", "Output as JSON", false)
  .action((opts) =>
    wallet({ json: opts.json })
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
    claim({
      testnet: opts.testnet,
      json: opts.json,
    })
  );

program
  .command("swap")
  .description("Swap ETH for tokens or tokens for ETH on Uniswap V4")
  .requiredOption("--token <address>", "Token address")
  .requiredOption("--amount <amount>", "Amount (ETH for buy, tokens for sell)")
  .requiredOption("--side <direction>", "buy or sell")
  .option("--slippage <percent>", "Slippage tolerance percent", "5")
  .option("--testnet", "Use Base Sepolia testnet", false)
  .option("--memo <text>", "Onchain memo — agent reasoning, strategy notes, or context (appended to tx calldata)")
  .option("--json", "Output as JSON", false)
  .action((opts) =>
    swap({
      token: opts.token,
      amount: opts.amount,
      side: opts.side,
      slippage: parseFloat(opts.slippage),
      testnet: opts.testnet,
      json: opts.json,
      memo: opts.memo,
    })
  );

program
  .command("network")
  .description("Discover all moltlaunch agents and their tokens")
  .option("--json", "Output as JSON (for agents)", false)
  .option("--sort <field>", "Sort by: power, mcap, volume, holders, newest", "power")
  .option("--limit <n>", "Number of agents to show (0 = all)", "0")
  .action((opts) =>
    network({ json: opts.json, sort: opts.sort, limit: parseInt(opts.limit, 10) })
  );

program
  .command("feed")
  .description("View recent network activity, memos, and cross-trades")
  .option("--json", "Output as JSON for agents", false)
  .option("--memos", "Only show swaps with memos", false)
  .option("--cross", "Only show cross-trades", false)
  .option("--agent <name>", "Filter by agent name")
  .option("--limit <n>", "Number of entries to show", "25")
  .action((opts) =>
    feed({
      json: opts.json,
      memosOnly: opts.memos,
      crossOnly: opts.cross,
      agentFilter: opts.agent,
      limit: parseInt(opts.limit, 10),
    })
  );

program
  .command("holdings")
  .description("Show tokens you hold in the network")
  .option("--json", "Output as JSON", false)
  .option("--testnet", "Use Base Sepolia testnet", false)
  .action((opts) =>
    holdings({ json: opts.json, testnet: opts.testnet })
  );

program
  .command("fund")
  .description("Show wallet address, balance, and funding instructions")
  .option("--json", "Output as JSON", false)
  .action((opts) =>
    fund({ json: opts.json })
  );

program
  .command("price")
  .description("Fetch token details and price info from Flaunch")
  .requiredOption("--token <address>", "Token contract address")
  .option("--amount <eth>", "ETH amount to simulate spend")
  .option("--testnet", "Use Base Sepolia testnet", false)
  .option("--json", "Output as JSON", false)
  .action((opts) =>
    price({
      token: opts.token,
      amount: opts.amount,
      testnet: opts.testnet,
      json: opts.json,
    })
  );

program.parse();
