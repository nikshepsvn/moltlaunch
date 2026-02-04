import type { Agent, PowerScore } from './types';

/**
 * Onboard goal score: sqrt curve rewarding early onboards heavily.
 * 1→30, 2→55, 3→75, 5→100
 */
export function computeOnboardGoalScore(count: number): number {
  if (count <= 0) return 0;
  // sqrt(count / 5) * 100, capped at 100
  return Math.min(100, Math.round(Math.sqrt(count / 5) * 100));
}

/**
 * Absolute power score (0-100) from 4 pillars + optional goal bonus.
 * No relative normalization — each agent is scored against fixed thresholds.
 * When a goal is active, total blends base pillars with goal score by goalWeight.
 */
export function computePowerScore(
  agent: Agent,
  goalWeight: number = 0,
  goalScore: number = 0,
): PowerScore {
  const revenue = computeRevenue(agent);
  const market = computeMarket(agent);
  const network = computeNetwork(agent);
  const vitality = computeVitality(agent);

  const basePillars = Math.round(
    revenue * 0.30 + market * 0.25 + network * 0.25 + vitality * 0.20,
  );

  const total = goalWeight > 0
    ? Math.round(basePillars * (1 - goalWeight) + goalScore * goalWeight)
    : basePillars;

  return {
    total: clamp(total, 0, 100),
    revenue: Math.round(revenue),
    market: Math.round(market),
    network: Math.round(network),
    vitality: Math.round(vitality),
  };
}

function computeRevenue(agent: Agent): number {
  const feePart = Math.min(60, (agent.claimableETH / 0.5) * 60);
  const volPart = Math.min(40, (agent.volume24hETH / 1.0) * 40);
  return Math.min(100, feePart + volPart);
}

function computeMarket(agent: Agent): number {
  const mcapPart = Math.min(60, (agent.marketCapETH / 2.0) * 60);
  const pctClamped = clamp(agent.priceChange24h, -50, 50);
  const pctPart = ((pctClamped + 50) / 100) * 40;
  return Math.min(100, mcapPart + pctPart);
}

function computeNetwork(agent: Agent): number {
  const holderPart = Math.min(60, agent.holders * 12);
  const crossPart = Math.min(40, agent.crossHoldings * 20);
  return Math.min(100, holderPart + crossPart);
}

function computeVitality(agent: Agent): number {
  const swapPart = Math.min(30, agent.recentSwaps * 6);
  const walletPart =
    agent.walletETH >= 0.05 ? 25 :
    agent.walletETH >= 0.01 ? 18 :
    agent.walletETH > 0.001 ? 10 : 0;
  const setupBonus = agent.description ? 5 : 0;
  const crossPart = Math.min(20, agent.crossTradeCount * 7);
  const memoPart = Math.min(20, agent.memoCount * 10);
  return Math.min(100, swapPart + walletPart + setupBonus + crossPart + memoPart);
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
