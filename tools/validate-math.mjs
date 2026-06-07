/**
 * Validate a Stake-shaped math bundle before booting a game.
 *
 * Usage: node tools/validate-math.mjs <dataDir>
 * Example: node tools/validate-math.mjs ../Pure-Plinko/data
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dataDir = resolve(process.argv[2] || 'data');
const errors = [];
const warnings = [];

function fail(msg) {
  errors.push(msg);
}

function warn(msg) {
  warnings.push(msg);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    fail(`${path}: invalid JSON (${err.message})`);
    return null;
  }
}

function loadBooks(path) {
  const books = [];
  const text = readFileSync(path, 'utf8');
  for (const [lineNo, line] of text.trim().split('\n').entries()) {
    if (!line.trim()) continue;
    try {
      books.push({ line: lineNo + 1, book: JSON.parse(line) });
    } catch (err) {
      fail(`${path}:${lineNo + 1}: invalid JSONL (${err.message})`);
    }
  }
  return books;
}

function loadLookup(path) {
  const text = readFileSync(path, 'utf8').trim();
  const lines = text.split('\n');
  if (lines.length < 2) {
    fail(`${path}: lookup table needs header + rows`);
    return [];
  }

  const header = lines[0].split(',').map((h) => h.trim());
  const idIdx = header.findIndex((h) => h === 'id');
  const weightIdx = header.findIndex((h) =>
    ['weight', 'probability_uint64', 'probability'].includes(h),
  );
  const payoutIdx = header.findIndex((h) =>
    ['payout', 'payout_multiplier'].includes(h),
  );

  if (idIdx < 0 || weightIdx < 0 || payoutIdx < 0) {
    fail(`${path}: header must include id, weight/probability_uint64, payout/payout_multiplier`);
    return [];
  }

  return lines.slice(1).map((line, i) => {
    const cols = line.split(',');
    return {
      line: i + 2,
      id: Number(cols[idIdx]),
      weight: Number(cols[weightIdx]),
      payout: Number(cols[payoutIdx]),
    };
  });
}

function validateBookEvents(book, path, line) {
  if (!Array.isArray(book.events) || !book.events.length) {
    fail(`${path}:${line}: book ${book.id} missing events[]`);
    return;
  }

  const indices = book.events.map((e) => e.index);
  const sorted = [...indices].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i += 1) {
    if (sorted[i] !== i) {
      fail(`${path}:${line}: book ${book.id} event indices must be 0..n-1 (got ${indices.join(',')})`);
      break;
    }
  }

  for (const event of book.events) {
    if (!event.type || typeof event.type !== 'string') {
      fail(`${path}:${line}: book ${book.id} event ${event.index} missing type`);
    }
  }

  const hasFinal = book.events.some((e) => e.type === 'finalWin');
  if (!hasFinal) {
    warn(`${path}:${line}: book ${book.id} has no finalWin event`);
  }
}

function validateMode(dataDir, mode) {
  const modeName = mode.name || '(unnamed)';
  if (!mode.name) fail(`index.json mode missing name`);

  const weightsFile = mode.weights?.replace(/\.zst$/, '') ?? mode.weights;
  const eventsFile = mode.events?.replace(/\.zst$/, '') ?? mode.events;
  if (!weightsFile) fail(`mode ${modeName}: missing weights file in index.json`);
  if (!eventsFile) fail(`mode ${modeName}: missing events file in index.json`);

  const weightsPath = join(dataDir, weightsFile);
  const eventsPath = join(dataDir, eventsFile);
  if (!existsSync(weightsPath)) fail(`mode ${modeName}: missing ${weightsPath}`);
  if (!existsSync(eventsPath)) fail(`mode ${modeName}: missing ${eventsPath}`);
  if (!existsSync(weightsPath) || !existsSync(eventsPath)) return;

  const lookup = loadLookup(weightsPath);
  const books = loadBooks(eventsPath);
  const bookIds = new Set();

  for (const { line, book } of books) {
    if (!Number.isFinite(book.id)) {
      fail(`${eventsPath}:${line}: book missing numeric id`);
      continue;
    }
    if (bookIds.has(book.id)) {
      fail(`${eventsPath}:${line}: duplicate book id ${book.id}`);
    }
    bookIds.add(book.id);
    if (!Number.isFinite(book.payoutMultiplier)) {
      fail(`${eventsPath}:${line}: book ${book.id} missing payoutMultiplier`);
    }
    validateBookEvents(book, eventsPath, line);
  }

  const lookupIds = new Set();
  let weightTotal = 0;
  for (const row of lookup) {
    if (!Number.isFinite(row.id) || !Number.isFinite(row.weight) || !Number.isFinite(row.payout)) {
      fail(`${weightsPath}:${row.line}: invalid id/weight/payout`);
      continue;
    }
    if (row.weight <= 0) fail(`${weightsPath}:${row.line}: weight must be > 0`);
    lookupIds.add(row.id);
    weightTotal += row.weight;
    if (!bookIds.has(row.id)) {
      fail(`${weightsPath}:${row.line}: lookup id ${row.id} has no matching book`);
    }
  }

  for (const id of bookIds) {
    if (!lookupIds.has(id)) {
      warn(`book id ${id} has no lookup row`);
    }
  }

  if (weightTotal <= 0) {
    fail(`${weightsPath}: total weight must be > 0`);
  }

  console.log(`  mode ${modeName}: ${books.length} books, ${lookup.length} lookup rows, weight sum ${weightTotal}`);
}

function main() {
  console.log(`Validating math bundle: ${dataDir}`);

  if (!existsSync(dataDir)) {
    console.error(`Directory not found: ${dataDir}`);
    process.exit(1);
  }

  const indexPath = join(dataDir, 'index.json');
  if (!existsSync(indexPath)) {
    fail('missing index.json');
  } else {
    const index = readJson(indexPath);
    if (index?.modes?.length) {
      for (const mode of index.modes) {
        validateMode(dataDir, mode);
      }
    } else {
      fail('index.json missing modes[]');
    }
  }

  for (const w of warnings) console.warn(`warn: ${w}`);
  for (const e of errors) console.error(`error: ${e}`);

  if (errors.length) {
    console.error(`\n${errors.length} error(s), ${warnings.length} warning(s) — FAILED`);
    process.exit(1);
  }

  console.log(`\nOK — ${warnings.length} warning(s)`);
}

main();
