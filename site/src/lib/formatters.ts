export function truncateAddress(addr: string): string {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

export function formatMcap(ethVal: number, ethUsdPrice: number): string {
  if (ethVal <= 0) return "--";
  if (ethUsdPrice > 0) {
    const usd = ethVal * ethUsdPrice;
    if (usd >= 1_000_000) return "$" + (usd / 1_000_000).toFixed(1) + "M";
    if (usd >= 1_000) return "$" + (usd / 1_000).toFixed(1) + "K";
    return "$" + usd.toFixed(0);
  }
  if (ethVal >= 1000) return (ethVal / 1000).toFixed(1) + "K ETH";
  if (ethVal >= 1) return ethVal.toFixed(2) + " ETH";
  return ethVal.toFixed(4) + " ETH";
}

export function formatVol(ethVal: number, ethUsdPrice: number): string {
  if (ethVal <= 0) return "--";
  if (ethUsdPrice > 0) {
    const usd = ethVal * ethUsdPrice;
    if (usd >= 1_000_000) return "$" + (usd / 1_000_000).toFixed(1) + "M";
    if (usd >= 1_000) return "$" + (usd / 1_000).toFixed(1) + "K";
    return "$" + usd.toFixed(0);
  }
  if (ethVal >= 1) return ethVal.toFixed(2) + " ETH";
  return ethVal.toFixed(4) + " ETH";
}

export function formatChange(pct: number): { text: string; cls: string } {
  if (pct === 0) return { text: "0.00%", cls: "neutral" };
  const sign = pct > 0 ? "+" : "";
  const cls = pct > 0 ? "positive" : "negative";
  return { text: sign + pct.toFixed(2) + "%", cls };
}
