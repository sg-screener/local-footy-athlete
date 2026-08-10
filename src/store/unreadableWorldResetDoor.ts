/**
 * THE ONE DOOR THAT CLEARS STORAGE.
 *
 * Before this file, the census found **zero product files that clear storage**
 * (docs/LEGACY_POWER_CUT_CENSUS_2026-08-10.md) — which is why the order to
 * *"replace the migration with the clean-reset path"* was a contradiction: the
 * path did not exist. This is that path, and it is deliberately the ONLY one.
 *
 * Store-armour recipe (`docs/STORE_ARMOUR_RECIPE_2026-08-03.md`), same shape as
 * the override door: **one door, every writer converges.** A second place that
 * clears a key is how "reset clean and tell the athlete" becomes "reset clean
 * and sometimes tell the athlete", which is the failure this replaces rather
 * than a smaller version of it.
 *
 * The decisions live in `rules/unreadableWorldReset.ts` and are pure. This file
 * is I/O and nothing else: it asks, it clears, it records.
 */

import { asyncStorageCompat } from './asyncStorageCompat';
import { logger } from '../utils/logger';
import {
  athleteIsOwedTheResetTelling,
  decideUnreadableWorldReset,
  markResetTelling,
  parseWorldResetFact,
  readStoredWorld,
  type UnreadableWorldReason,
  type WorldResetFact,
} from '../rules/unreadableWorldReset';

/**
 * The reset fact's own key.
 *
 * SEPARATE from every store's key, and that is load-bearing: the fact records
 * that a world was destroyed, so it cannot live inside the thing being
 * destroyed. Keeping it in the program envelope would delete the telling along
 * with the world it is telling the athlete about.
 */
export const WORLD_RESET_FACT_KEY = 'lfa.world_reset.v1';

/**
 * Read a stored payload, and reset clean if the current code cannot read it.
 *
 * Returns what the caller should hand on: the original string when readable,
 * `null` when the world was reset (so the app boots exactly as a first run
 * does — no fallback, no salvage, no second attempt).
 *
 * NEVER THROWS. A door whose job is to survive a broken world cannot itself be
 * a new way for boot to die: if clearing or recording fails, the world is still
 * reported unreadable and the app still starts fresh. The athlete may then miss
 * the telling, and that is the honest trade — a missed sentence beats an app
 * that will not open.
 */
export async function readStoredWorldOrResetClean(
  storageKey: string,
  raw: string | null,
  nowISO: string,
): Promise<string | null> {
  const verdict = readStoredWorld(raw);
  const decision = decideUnreadableWorldReset(verdict, nowISO);
  if (!decision.clear || decision.fact === null) {
    // `absent` and `readable` both land here. An absent world is a FIRST RUN,
    // not a reset, and telling that athlete their training was reset would be
    // a lie about a world that never existed.
    return verdict.kind === 'readable' ? raw : null;
  }

  logger.error(
    '[unreadableWorldReset] stored world could not be read; resetting clean',
    { store: storageKey, reason: decision.fact.reason },
  );

  try {
    await asyncStorageCompat.removeItem(storageKey);
    await recordWorldReset(decision.fact);
  } catch (error) {
    logger.error(
      '[unreadableWorldReset] reset could not be completed; starting fresh anyway',
      { store: storageKey, error },
    );
  }
  return null;
}

/**
 * Write the fact.
 *
 * WRITTEN ONCE. A second unreadable world before the athlete has read the first
 * telling must not overwrite it with a later timestamp and re-arm a notice they
 * were already owed — the telling is about "your saved training is gone", which
 * is equally true either way, and an untold fact that keeps moving is an
 * athlete who never gets told at a stable moment. Once the existing fact has
 * been read, a new reset is a new telling.
 */
async function recordWorldReset(fact: WorldResetFact): Promise<void> {
  const existing = parseWorldResetFact(await asyncStorageCompat.getItem(WORLD_RESET_FACT_KEY));
  if (existing !== null && athleteIsOwedTheResetTelling(existing)) return;
  await asyncStorageCompat.setItem(WORLD_RESET_FACT_KEY, JSON.stringify(fact));
}

/** The stored fact, or null. A corrupt record reads as null and never cascades. */
export async function worldResetFact(): Promise<WorldResetFact | null> {
  try {
    return parseWorldResetFact(await asyncStorageCompat.getItem(WORLD_RESET_FACT_KEY));
  } catch {
    return null;
  }
}

/** Derived, not stored: is a telling owed right now? */
export async function athleteIsOwedTheResetNotice(): Promise<boolean> {
  return athleteIsOwedTheResetTelling(await worldResetFact());
}

/** The athlete's dismissal. The only thing that ends the telling. */
export async function recordResetNoticeSeen(nowISO: string): Promise<void> {
  const fact = await worldResetFact();
  if (fact === null || !athleteIsOwedTheResetTelling(fact)) return;
  await asyncStorageCompat.setItem(
    WORLD_RESET_FACT_KEY,
    JSON.stringify(markResetTelling(fact, nowISO)),
  );
}

export type { UnreadableWorldReason, WorldResetFact };
