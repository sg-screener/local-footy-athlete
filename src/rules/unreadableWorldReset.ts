/**
 * THE CLEAN-RESET DOOR — what happens when the app cannot read its own storage.
 *
 * ## The ruling this implements, in Sam's words
 *
 * 2026-08-10, on the throwing power-block migration: ***"kill it"***. The seat's
 * expansion, ruled the same day: **"a stored world the current code cannot read
 * is RESET CLEAN and the athlete is told, never migrated and never silently
 * served by an older set of rules."** And the scope, given verbatim: *"an
 * unreadable stored world resets and the athlete is told once, in plain words.
 * No migration, no fallback, no second attempt to salvage."*
 *
 * The order it replaces is the opposite shape. `legacyPowerBlockMigration`
 * carried six THROW sites: a stored world it could not map took the whole app
 * down at read ingress rather than letting the athlete in. That was the right
 * instinct — never drop work silently — with the wrong exit. **A reset is
 * honest. A crash at boot is not, and a fallback that quietly serves an older
 * set of rules is worse than either.**
 *
 * ## Why this file is allowed to exist while `test:bible` is red
 *
 * The red bans features. This is not one: **it IS the guard for "a stored world
 * the code cannot read"**, which is a law with nothing holding it. LAW ZERO's
 * sanctioned work during the red is *"a guard for a law, a fix for a law a new
 * guard proves the app is breaking, and measurement"* — this is the first.
 *
 * ## The north star, and why the reset FACT is a legal thing to store
 *
 * *Store only decisions, derive everything else.* Two inputs are stored, and
 * nothing else:
 *
 *   - `resetAtISO` + `reason` — a **fact**: the world was reset, at this time,
 *     because of this. Facts are input (NORTH_STAR §2), not derived output.
 *   - `toldAtISO` — the athlete's **decision** to dismiss the telling.
 *
 * *"Does the athlete still need to be told?"* is **derived** from those two by
 * `athleteIsOwedTheResetTelling`, never stored. A boolean `hasBeenTold` beside
 * the fact would be a stored derivation and is exactly the shape the north star
 * calls presumed-wrong.
 *
 * ## What this module does NOT do
 *
 * It performs no I/O and clears nothing. Deciding and doing are separate on
 * purpose: the decisions below are testable without a storage layer, and the
 * one place that actually clears a key is `store/unreadableWorldResetDoor.ts`.
 */

import { registerSignedCopy } from './signedCopy';

/**
 * Why a stored world could not be read.
 *
 * Deliberately COARSE. A finer taxonomy would be the first step back toward
 * salvage — "this kind we can rescue, that kind we cannot" — and salvage is the
 * thing the ruling forbids. The reason is carried so the reset leaves a receipt,
 * not so anything can branch on it.
 */
export type UnreadableWorldReason =
  /** The payload is not JSON at all. */
  | 'not_json'
  /** It parses, but not to an object — a bare number, string, null, array. */
  | 'not_an_object'
  /** It is an object whose envelope the current code does not recognise. */
  | 'unrecognised_envelope';

/** What `readStoredWorld` concluded about one stored payload. */
export type StoredWorldVerdict =
  /** Nothing stored. A first run, and NOT a reset — nobody is told. */
  | { readonly kind: 'absent' }
  /** The current code can read it. Hand it on untouched. */
  | { readonly kind: 'readable'; readonly value: Record<string, unknown> }
  /** The current code cannot read it. Reset clean, tell the athlete. */
  | { readonly kind: 'unreadable'; readonly reason: UnreadableWorldReason };

/**
 * THE FACT. Written once when a world is reset; the only thing that survives it.
 *
 * `toldAtISO` starts null and is stamped by the athlete's dismissal. Nothing
 * else is stored, and in particular no "shown" counter — "once" is a property of
 * the derivation below, not of a tally somebody has to keep correct.
 */
export interface WorldResetFact {
  readonly resetAtISO: string;
  readonly reason: UnreadableWorldReason;
  readonly toldAtISO: string | null;
}

/**
 * Can the current code read this stored payload?
 *
 * Pure, total, and it never throws — a classifier that can throw would need its
 * own reset door. Anything it cannot vouch for is `unreadable`, because the
 * failure mode this exists to prevent is a half-read world being served as if
 * whole.
 */
export function readStoredWorld(raw: string | null | undefined): StoredWorldVerdict {
  if (raw === null || raw === undefined || raw.trim() === '') {
    return { kind: 'absent' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: 'unreadable', reason: 'not_json' };
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { kind: 'unreadable', reason: 'not_an_object' };
  }

  // The envelope zustand's `persist` writes is `{ state, version }`. `version`
  // is allowed to be absent (pre-versioning payloads), but `state` must be an
  // object we can hand to `merge` — a `state` of the wrong shape is precisely
  // the world that used to reach the migration and throw.
  const envelope = parsed as Record<string, unknown>;
  if (!('state' in envelope)) {
    return { kind: 'unreadable', reason: 'unrecognised_envelope' };
  }
  const state = envelope.state;
  if (state === null || typeof state !== 'object' || Array.isArray(state)) {
    return { kind: 'unreadable', reason: 'unrecognised_envelope' };
  }

  return { kind: 'readable', value: envelope };
}

/**
 * The reset decision, given a verdict.
 *
 * `absent` resets NOTHING and tells NOBODY. That distinction is the one this
 * function exists to make and the easiest to get wrong: every first run of the
 * app has no stored world, and an athlete greeted on day one with *"your saved
 * training was reset"* has been told a lie about a world that never existed.
 */
export function decideUnreadableWorldReset(
  verdict: StoredWorldVerdict,
  nowISO: string,
): { readonly clear: boolean; readonly fact: WorldResetFact | null } {
  if (verdict.kind !== 'unreadable') return { clear: false, fact: null };
  return {
    clear: true,
    fact: { resetAtISO: nowISO, reason: verdict.reason, toldAtISO: null },
  };
}

/**
 * DERIVED, never stored: does the athlete still owe reading this?
 *
 * One line, and it is the whole of "once".
 */
export function athleteIsOwedTheResetTelling(fact: WorldResetFact | null): boolean {
  return fact !== null && fact.toldAtISO === null;
}

/** The athlete's dismissal — a decision, recorded onto the fact. */
export function markResetTelling(fact: WorldResetFact, nowISO: string): WorldResetFact {
  return fact.toldAtISO === null ? { ...fact, toldAtISO: nowISO } : fact;
}

/**
 * Read a persisted fact back without trusting it.
 *
 * The reset record lives in storage like anything else, so it can be corrupt
 * like anything else — and a corrupt reset record must not be able to trigger a
 * second reset, or an unreadable byte becomes an infinite loop of resets. An
 * unreadable record is simply forgotten: `null`, no telling, no cascade.
 */
export function parseWorldResetFact(raw: string | null | undefined): WorldResetFact | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  const resetAtISO = record.resetAtISO;
  const reason = record.reason;
  const toldAtISO = record.toldAtISO ?? null;
  if (typeof resetAtISO !== 'string' || resetAtISO.trim() === '') return null;
  if (reason !== 'not_json' && reason !== 'not_an_object' && reason !== 'unrecognised_envelope') {
    return null;
  }
  if (toldAtISO !== null && typeof toldAtISO !== 'string') return null;
  return { resetAtISO, reason, toldAtISO: toldAtISO as string | null };
}

/**
 * THE ATHLETE-FACING SENTENCE.
 *
 * Plain words, and it says the three things a person actually needs: what
 * happened, what it cost them, what to do. It names no file, no version and no
 * error code, and it does not apologise twice.
 *
 * **PROPOSED, NOT SAM-SIGNED.** `provenance` says so, in the sheet, where the
 * copy gate reads it — a claim of a signature Sam never gave would be worse than
 * an honest gap. It ships as the words the athlete reads and Sam overrules them
 * whenever he likes; one id is one sentence, so changing the words never
 * changes the code.
 */
export const WORLD_RESET_NOTICE_ID = 'world_reset_notice';
export const WORLD_RESET_NOTICE_DISMISS_ID = 'world_reset_notice_dismiss';

registerSignedCopy([
  {
    id: WORLD_RESET_NOTICE_ID,
    source: 'signed_sentence',
    provenance:
      'PROPOSED COPY, UNSIGNED — awaiting Sam. Written 2026-08-10 for the clean-reset '
      + 'door he ordered ("an unreadable stored world resets and the athlete is told '
      + 'once, in plain words"). The words are the seat\'s; the ruling is his.',
    text:
      'Your saved training could not be opened, so it has been started fresh. '
      + 'Your answers are still here — set your week up again and you are back to normal.',
  },
  {
    id: WORLD_RESET_NOTICE_DISMISS_ID,
    source: 'signed_sentence',
    provenance:
      'PROPOSED COPY, UNSIGNED — awaiting Sam. The dismissal for the clean-reset '
      + 'notice; "once" means this button is the only way it goes away.',
    text: 'Got it',
  },
]);
