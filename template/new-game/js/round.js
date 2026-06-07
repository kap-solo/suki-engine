import { roundPayoutMultiplier } from '@kap-solo/suki-engine/client/rgs.js';

export function parseGameReveal(round) {
  const reveal = (round.state ?? []).find((e) => e.type === 'gameReveal');
  if (!reveal) throw new Error('Missing gameReveal in round.state');
  return reveal;
}

export function buildGameSettledResult(round) {
  const reveal = parseGameReveal(round);
  const multiplier = roundPayoutMultiplier(round);
  return {
    symbol: reveal.symbol,
    multiplier,
    payoutApi: round.payout,
    profitApi: round.payout - round.amount,
  };
}
