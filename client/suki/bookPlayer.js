/**
 * Generic round.state event player — handler map keyed by event.type.
 * Reports bet/event after each step (Stake-shaped).
 */

import { reportBetEvent } from '../rgs.js';

/** @typedef {{ index: number, type: string }} BookEvent */

/**
 * @param {BookEvent[] | null | undefined} state
 * @returns {BookEvent[]}
 */
export function sortBookEvents(state) {
  return [...(state ?? [])].sort((a, b) => a.index - b.index);
}

/**
 * Last reported event index from auth meta or round.event.
 * @param {{ lastEvent?: string | null }} [meta]
 * @param {{ event?: string | null }} [round]
 * @returns {number} — -1 when no events have been reported yet
 */
export function resolveLastEventIndex(meta, round) {
  const raw = meta?.lastEvent ?? round?.event ?? null;
  if (raw === null || raw === undefined || raw === '') return -1;
  const index = Number(raw);
  return Number.isFinite(index) ? index : -1;
}

/**
 * Split book events into completed vs remaining for resume.
 * @param {BookEvent[]} events — sorted
 * @param {number} lastEventIndex — last reported index, or -1
 */
export function sliceEventsForResume(events, lastEventIndex) {
  const completed = events.filter((e) => e.index <= lastEventIndex);
  const remaining = events.filter((e) => e.index > lastEventIndex);
  return { completed, remaining, all: events };
}

/**
 * Events to present on resume — avoid replaying the full book when progress exists.
 * Prevents feature trigger boards (e.g. scatter reveal at index 0) from replaying
 * after refresh when all bet/event steps were already reported.
 *
 * @param {BookEvent[]} events — sorted
 * @param {number} lastEventIndex — last reported index, or -1
 * @param {{ active?: boolean }} [round]
 * @returns {BookEvent[]}
 */
export function resolveEventsToPlay(events, lastEventIndex, round = {}) {
  const { remaining } = sliceEventsForResume(events, lastEventIndex);
  if (lastEventIndex >= 0) return remaining;

  const enterBonus = events.find((event) => event.type === 'enterBonus');
  if (enterBonus && round.active) {
    return events.filter((event) => event.index >= enterBonus.index);
  }
  return events;
}

/**
 * @param {object} options
 * @param {Record<string, (event: BookEvent, ctx: object) => Promise<void>>} options.handlers
 * @param {(index: number) => Promise<void>} [options.reportEvent] — defaults to reportBetEvent
 */
export function createBookPlayer({ handlers, reportEvent = reportBetEvent }) {
  /**
   * @param {BookEvent[]} events
   * @param {object} ctx — passed to every handler (round, animate, isReplay, …)
   * @param {{ skipReporting?: boolean, waitBeforeLastEvent?: () => Promise<void>, fullBookLastIndex?: number }} [options]
   */
  async function playEvents(events, ctx, options = {}) {
    const sorted = sortBookEvents(events);
    if (!sorted.length) return;

    const lastIndex =
      options.fullBookLastIndex ?? sorted[sorted.length - 1].index;

    for (const event of sorted) {
      if (options.waitBeforeLastEvent && event.index === lastIndex) {
        await options.waitBeforeLastEvent();
      }

      const handler = handlers[event.type];
      if (handler) {
        await handler(event, { ...ctx, bookEvents: sorted });
      } else {
        console.warn(`[Suki] No book handler for type "${event.type}" (index ${event.index})`);
      }

      if (!options.skipReporting && !ctx.skipEventReporting) {
        try {
          await reportEvent(event.index);
        } catch (err) {
          console.warn(`[Suki] bet/event ${event.index} failed`, err);
        }
      }
    }
  }

  return { playEvents, sortBookEvents, sliceEventsForResume, resolveLastEventIndex };
}
