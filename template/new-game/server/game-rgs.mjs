import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMockRgs } from '@kap-solo/suki-engine/server/mock-rgs/create-mock-rgs.mjs';
import { API_MULT } from '@kap-solo/suki-engine/server/mock-rgs/defaults.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

export const GAME_ID = 'my-game';
export const REPLAY_VERSION = '1';

function loadLookup(filename) {
  const text = readFileSync(join(root, 'data', filename), 'utf8');
  return text
    .trim()
    .split('\n')
    .slice(1)
    .map((line) => {
      const [id, weight, payout] = line.split(',');
      return { id: Number(id), weight: Number(weight), payout: Number(payout) };
    });
}

function loadBooks(filename) {
  const text = readFileSync(join(root, 'data', filename), 'utf8');
  /** @type {Map<number, object>} */
  const books = new Map();
  for (const line of text.trim().split('\n')) {
    if (!line) continue;
    const book = JSON.parse(line);
    books.set(book.id, book);
  }
  return books;
}

const modePacks = {
  base: {
    lookup: loadLookup('lookUpTable_base_0.csv'),
    books: loadBooks('books_base.jsonl'),
    rgsMode: 'BASE',
  },
  bonus: {
    lookup: loadLookup('lookUpTable_bonus_0.csv'),
    books: loadBooks('books_bonus.jsonl'),
    rgsMode: 'BONUS',
  },
};

function pickSimulationId(lookup) {
  const weightTotal = lookup.reduce((sum, row) => sum + row.weight, 0);
  let r = Math.random() * weightTotal;
  for (const row of lookup) {
    r -= row.weight;
    if (r <= 0) return row.id;
  }
  return lookup[lookup.length - 1].id;
}

function roundFromBook(book, amountApi, rgsMode) {
  const payoutMultiplier = book.payoutMultiplier / 100;
  const payout = Math.round(amountApi * payoutMultiplier);
  return {
    amount: amountApi,
    payout,
    payoutMultiplier,
    active: false,
    mode: rgsMode,
    state: book.events,
  };
}

function packForRgsMode(mode) {
  const key = String(mode || 'BASE').toLowerCase();
  return modePacks[key] ?? modePacks.base;
}

export function createGameMockRgs() {
  return createMockRgs({
    gameId: GAME_ID,
    replayVersion: REPLAY_VERSION,
    jurisdictionDefaults: { disabledBuyFeature: false },
    betConfig: {
      minBet: API_MULT / 2,
      maxBet: 1000 * API_MULT,
      stepBet: API_MULT / 2,
      defaultBetLevel: API_MULT,
      betLevels: [0.5, 1, 2, 5, 10].map((d) => Math.round(d * API_MULT)),
      betModes: {
        BASE: { mode: 'BASE', costMultiplier: 1, feature: false },
        BONUS: { mode: 'BONUS', costMultiplier: 100, feature: true },
      },
    },
    resolvePlay(_session, body) {
      const amount = Number(body.amount);
      const pack = packForRgsMode(body.mode);
      const simId = pickSimulationId(pack.lookup);
      const book = pack.books.get(simId);
      if (!book) {
        return { error: { code: 'ERR_GEN', message: `Missing book ${simId}` } };
      }

      const payoutMultiplier = book.payoutMultiplier / 100;
      const payout = Math.round(amount * payoutMultiplier);

      return {
        payout,
        payoutMultiplier,
        state: book.events,
        mode: pack.rgsMode,
      };
    },
    resolveReplay(event, amountQuery) {
      const bookId = Number(event);
      if (!Number.isFinite(bookId) || !modePacks.base.books.has(bookId)) {
        return null;
      }
      const amountApi = Number(amountQuery) || API_MULT;
      if (!Number.isFinite(amountApi) || amountApi <= 0) {
        return { error: { code: 'ERR_VAL', message: 'Invalid replay amount' } };
      }
      return { round: roundFromBook(modePacks.base.books.get(bookId), amountApi, 'BASE') };
    },
  });
}
