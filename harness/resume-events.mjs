/**
 * Regression — active-round resume must not replay the full book when progress exists.
 */

import { resolveEventsToPlay, sortBookEvents } from '../client/suki/bookPlayer.js';

const featureBook = sortBookEvents([
  { index: 0, type: 'gameReveal' },
  { index: 1, type: 'enterBonus' },
  { index: 2, type: 'updateFreeSpin' },
  { index: 3, type: 'gameReveal' },
  { index: 4, type: 'freeSpinEnd' },
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// All events reported — must not replay scatter trigger.
const done = resolveEventsToPlay(featureBook, 4, { active: true }, { isResume: true });
assert(done.length === 0, 'expected no replay when lastEvent covers full book');

// Mid-feature resume — continue from next event only.
const mid = resolveEventsToPlay(featureBook, 2, { active: true }, { isResume: true });
assert(mid.length === 2 && mid[0].index === 3, 'expected remaining free-spin events only');

// Missing cursor on active feature — skip scatter reveal, start at enterBonus.
const noCursor = resolveEventsToPlay(featureBook, -1, { active: true }, { isResume: true });
assert(
  noCursor.length === 4 && noCursor[0].type === 'enterBonus',
  'expected feature resume without replaying index-0 reveal',
);

// Fresh active round — play full book including scatter trigger.
const freshActive = resolveEventsToPlay(featureBook, -1, { active: true });
assert(freshActive.length === 5, 'expected full book on fresh active round');

// Completed round snapshot — play full book.
const fresh = resolveEventsToPlay(featureBook, -1, { active: false });
assert(fresh.length === 5, 'expected full book on fresh inactive round');

console.log('resume-events: ok');
