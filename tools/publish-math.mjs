/**
 * Build a Stake Engine ACP upload folder from a game data directory.
 *
 * Stake requires these files at the upload root (no subfolders):
 *   - index.json
 *   - lookUpTable_<mode>_0.csv  (uint64 rows only — no header)
 *   - books_<mode>.jsonl.zst    (zstd-compressed JSONL)
 *
 * Usage: node tools/publish-math.mjs <dataDir> [outDir]
 * Example: node tools/publish-math.mjs ../Basic-Slot-Pool/data
 *
 * Default output: <dataDir>/publish/
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { basename, join, resolve } from 'node:path';
import zlib from 'node:zlib';

const zstdCompress = promisify(zlib.zstdCompress);

const dataDir = resolve(process.argv[2] || 'data');
const publishDir = resolve(process.argv[3] || join(dataDir, 'publish'));

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function requireFile(path, label) {
  if (!existsSync(path)) {
    throw new Error(`Missing ${label}: ${path}`);
  }
}

/** Stake ACP rejects header rows — uint64 data lines only. */
function stakeLookupCsv(sourcePath) {
  const lines = readFileSync(sourcePath, 'utf8').trim().split('\n').filter(Boolean);
  const dataLines = lines.filter((line) => /^\d+,/.test(line.trim()));
  if (!dataLines.length) {
    throw new Error(`No lookup data rows in ${sourcePath}`);
  }
  return `${dataLines.join('\n')}\n`;
}

function uncompressedEventsPath(eventsFile) {
  if (eventsFile.endsWith('.jsonl.zst')) {
    return eventsFile.replace(/\.zst$/, '');
  }
  if (eventsFile.endsWith('.jsonl')) {
    return eventsFile;
  }
  throw new Error(`Unsupported events file "${eventsFile}" — expected *.jsonl or *.jsonl.zst`);
}

function stakeEventsFilename(eventsFile) {
  if (eventsFile.endsWith('.jsonl.zst')) return eventsFile;
  if (eventsFile.endsWith('.jsonl')) return `${eventsFile}.zst`;
  throw new Error(`Unsupported events file "${eventsFile}" — expected *.jsonl or *.jsonl.zst`);
}

function stakeIndexFrom(index) {
  return {
    modes: index.modes.map((mode) => ({
      name: mode.name,
      cost: Number(mode.cost),
      events: stakeEventsFilename(mode.events),
      weights: mode.weights,
    })),
  };
}

async function publishMode(mode) {
  const modeName = mode.name || '(unnamed)';
  if (!mode.name) throw new Error('index.json mode missing name');
  if (!mode.weights) throw new Error(`mode ${modeName}: missing weights in index.json`);
  if (!mode.events) throw new Error(`mode ${modeName}: missing events in index.json`);

  const lookupSrc = join(dataDir, mode.weights);
  const eventsSrc = join(dataDir, uncompressedEventsPath(mode.events));
  requireFile(lookupSrc, `lookup for mode ${modeName}`);
  requireFile(eventsSrc, `uncompressed books for mode ${modeName} — compress source JSONL first`);

  const eventsOutName = stakeEventsFilename(mode.events);
  const lookupOut = join(publishDir, basename(mode.weights));
  const eventsOut = join(publishDir, basename(eventsOutName));

  const raw = readFileSync(eventsSrc);
  const compressed = await zstdCompress(raw);

  writeFileSync(lookupOut, stakeLookupCsv(lookupSrc));
  writeFileSync(eventsOut, compressed);

  console.log(`  mode ${modeName}:`);
  console.log(`    weights: ${lookupOut}`);
  console.log(`    events:  ${eventsOut} (${compressed.length} bytes)`);
}

async function main() {
  const indexPath = join(dataDir, 'index.json');
  requireFile(indexPath, 'index.json at data root');

  const index = readJson(indexPath);
  if (!index?.modes?.length) {
    throw new Error('index.json missing modes[]');
  }

  mkdirSync(publishDir, { recursive: true });

  const stakeIndex = stakeIndexFrom(index);
  const publishIndex = join(publishDir, 'index.json');
  writeFileSync(publishIndex, `${JSON.stringify(stakeIndex, null, 2)}\n`);

  console.log(`Publishing Stake math bundle`);
  console.log(`  source: ${dataDir}`);
  console.log(`  output: ${publishDir}`);
  console.log(`  index:  ${publishIndex}`);

  for (const mode of index.modes) {
    await publishMode(mode);
  }

  console.log('');
  console.log('Upload the contents of the output folder to Stake Engine ACP.');
  console.log('index.json must sit at the root of the directory you select.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
