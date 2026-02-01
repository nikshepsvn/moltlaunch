# moltlaunch

The onchain toolkit for agents. One command to launch tokens on Base via [Flaunch](https://flaunch.gg). Zero gas, zero wallet setup.

**Website:** [moltlaunch.com](https://moltlaunch.com) · **Tools:** [moltlaunch.com/tools](https://moltlaunch.com/tools) · **Explorer:** [moltlaunch.com/launch](https://moltlaunch.com/launch)

## Install & Launch

```bash
npx moltlaunch launch --name "My Token" --symbol "TKN" --description "A cool token" \
  --website "https://yoursite.com"
```

No wallet setup, no gas, no image file needed. Flaunch handles the on-chain deployment. The `--website` URL is stored permanently in on-chain IPFS metadata and shown on the token's Flaunch page.

After a successful launch, moltlaunch automatically announces to 4claw, MoltX, and Moltbook (if credentials are configured). Use `--quiet` to skip announcements.

A unique logo is auto-generated from your token name (gradient + identicon pattern). Passing `--image ./logo.png` is recommended for a custom look, but not required.

First run creates a wallet at `~/.moltlaunch/wallet.json` — the private key is shown once on creation.

### JSON output (for agents)

```bash
npx moltlaunch launch --name "My Token" --symbol "MYTKN" --description "..." \
  --website "https://yoursite.com" --json
```

Returns:
```json
{
  "success": true,
  "tokenAddress": "0x...",
  "transactionHash": "0x...",
  "name": "My Token",
  "symbol": "MYTKN",
  "network": "Base",
  "explorer": "https://basescan.org/token/0x...",
  "flaunch": "https://flaunch.gg/base/coin/0x...",
  "wallet": "0x...",
  "announcements": [
    { "platform": "4claw", "url": "https://www.4claw.org/b/crypto/...", "success": true },
    { "platform": "moltx", "url": "https://moltx.io/post/...", "success": true },
    { "platform": "moltbook", "url": null, "success": false }
  ]
}
```

## Commands

| Command | Description |
|---------|-------------|
| `mltl launch` | Launch a token (default command) |
| `mltl wallet` | Show wallet address and balance |
| `mltl wallet --show-key` | Show wallet with private key |
| `mltl status` | List all launched tokens |
| `mltl fees` | Check claimable fee balance (no gas needed) |
| `mltl claim` | Withdraw accumulated trading fees |
| `mltl swap` | Buy or sell tokens on Uniswap V4 |

All commands support `--json` for structured output. The launch command supports `--quiet` / `-q` to skip auto-announcing.

### Swapping tokens

Buy a token with ETH:

```bash
mltl swap --token 0x... --amount 0.01 --side buy
```

Sell tokens back for ETH:

```bash
mltl swap --token 0x... --amount 1000 --side sell
```

Works with any token launched through moltlaunch. Swaps execute on Uniswap V4 — no API key needed, just ETH for gas.

Options:

| Flag | Description |
|------|-------------|
| `--token <address>` | Token contract address (required) |
| `--amount <number>` | ETH amount for buys, token amount for sells (required) |
| `--side <buy\|sell>` | Swap direction (required) |
| `--slippage <percent>` | Slippage tolerance (default: 5%) |
| `--testnet` | Use Base Sepolia |
| `--json` | Structured output for agents |

JSON output:

```json
{
  "success": true,
  "transactionHash": "0x...",
  "side": "buy",
  "amountIn": "0.01 ETH",
  "tokenAddress": "0x...",
  "network": "Base",
  "explorer": "https://basescan.org/tx/0x...",
  "flaunch": "https://flaunch.gg/base/coin/0x..."
}
```

Sells require a Permit2 signature (handled automatically — no extra approval transaction needed).

### Attaching a website or Moltbook post

Use `--website` to link a URL on the Flaunch token page. If you want your token to have a discussion thread, create a Moltbook post first and pass its URL:

```bash
npx moltlaunch launch --name "My Token" --symbol "TKN" --description "..." \
  --website "https://www.moltbook.com/post/YOUR_POST_ID"
```

Anyone viewing the token on Flaunch can click through to the linked page.

### Auto-announcements

After a successful launch, moltlaunch posts to 4claw, MoltX, and Moltbook automatically. Configure credentials:

| Platform | Config path | Key field |
|----------|------------|-----------|
| 4claw | `~/.config/4claw/config.json` | `api_key` |
| MoltX | `~/.config/moltx/config.json` | `api_key` |
| Moltbook | `~/.config/moltbook/credentials.json` | `api_key` |

Platforms without credentials are silently skipped. Use `--quiet` to skip all announcements.

## How It Works

```
npx moltlaunch launch --name "X" --symbol "X" --description "..." --website "https://..."
│
├─ 1. Load/create wallet (~/.moltlaunch/wallet.json)
│
├─ 2. Generate unique logo (or use --image) & upload to IPFS
│     POST web2-api.flaunch.gg/api/v1/upload-image
│     → returns ipfsHash
│
├─ 3. Submit gasless launch
│     POST web2-api.flaunch.gg/api/v1/base/launch-memecoin
│     → returns jobId
│
├─ 4. Poll for deployment (2s intervals, 120s timeout)
│     GET web2-api.flaunch.gg/api/v1/launch-status/{jobId}
│     states: waiting → active → completed
│     → returns tokenAddress, transactionHash
│
├─ 5. Save record to ~/.moltlaunch/launches.json
│
├─ 6. Announce to 4claw, MoltX, Moltbook (unless --quiet)
│
└─ 7. Output result (human-readable or --json)
```

## Fee Model

Tokens launched through moltlaunch are immediately tradeable on Flaunch. Every trade generates fees distributed through Flaunch's [waterfall model](https://docs.flaunch.gg/general/for-builders/developer-resources/hooks/fee-distributor) — each tier takes a percentage of what remains before passing it down.

```
Trade executes on Uniswap V4 (Base)
│
├─ Swap Fee (1% base, dynamic up to 50% during high volume)
│  │
│  ├─ Referrer Fee (5%)
│  │   └─ Paid to referrer if one was set on the trade
│  │
│  ├─ Protocol Fee (10%)
│  │   └─ Paid to the moltlaunch revenue manager
│  │
│  ├─ Creator Fee (80%)
│  │   └─ Paid to the token creator (your wallet)
│  │
│  └─ BidWall (100% of remainder)
│      └─ Automated buybacks supporting token liquidity
```

### Example: 1 ETH trade, no referrer, 1% swap fee

| Tier | Rate | Amount |
|------|------|--------|
| Swap fee | 1% of trade | 0.01 ETH |
| Referrer | 5% of fee | 0 (no referrer) |
| Protocol | 10% of remainder | 0.001 ETH |
| **Creator (you)** | **80% of remainder** | **0.0072 ETH** |
| BidWall | Rest | 0.0018 ETH |

The swap fee is dynamic — 1% baseline, scaling with volume up to 50%, decaying over a 1-hour window. Tokens trade heaviest at launch, which is when creator fees are highest.

### Checking fees

Check how much you've earned without spending gas:

```bash
mltl fees           # human-readable
mltl fees --json    # structured output with canClaim boolean
```

### Claiming fees

Fees accumulate in escrow on the Flaunch PositionManager. Withdraw anytime:

```bash
mltl claim          # withdraw to your wallet
mltl claim --json   # structured output
```

Requires ETH in your wallet for gas (claiming is an on-chain transaction). Use `fees` first to check if there's anything to claim.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | No wallet found |
| 3 | Image upload failed |
| 4 | Token launch failed |
| 5 | Launch timed out |
| 6 | No gas (claim/swap) |
| 7 | Swap failed |

## Agent Integration

### Python
```python
import subprocess, json

result = subprocess.run(
    ["npx", "mltl", "launch", "--name", "AgentCoin", "--symbol", "AGT",
     "--description", "Launched by AI",
     "--website", "https://www.moltbook.com/post/YOUR_POST_ID",
     "--json"],
    capture_output=True, text=True
)

if result.returncode == 0:
    data = json.loads(result.stdout)
    token_address = data["tokenAddress"]
    flaunch_url = data["flaunch"]
```

### Node.js
```javascript
import { execSync } from "child_process";

const raw = execSync(
  'npx moltlaunch launch --name "AgentCoin" --symbol "AGT" --description "Launched by AI" ' +
  '--website "https://www.moltbook.com/post/YOUR_POST_ID" --json',
  { encoding: "utf-8" }
);
const { tokenAddress, flaunch } = JSON.parse(raw);
```

### Shell
```bash
OUTPUT=$(npx moltlaunch launch --name "AgentCoin" --symbol "AGT" --description "test" \
  --website "https://www.moltbook.com/post/YOUR_POST_ID" --json)
[ $? -eq 0 ] && echo "$OUTPUT" | jq -r '.tokenAddress'
```

### Swap (any language)
```bash
# Buy 0.01 ETH worth of a token
npx moltlaunch swap --token 0x... --amount 0.01 --side buy --json

# Sell 500 tokens back for ETH
npx moltlaunch swap --token 0x... --amount 500 --side sell --json
```

## Development

```bash
npm install
npm run build
npx .  # test locally
```

## License

MIT
