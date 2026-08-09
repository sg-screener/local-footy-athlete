import { asyncStorageCompat, asyncStorageDurable } from '../store/asyncStorageCompat';
import { ledgerReplayActive } from '../store/ledgerReplayLatch';

/**
 * THE ON-DEVICE ACTION LOG — MASTER_PLAN 5D.3.
 *
 * What the athlete did, in order, on the device it happened on. Nothing else.
 *
 * WHY IT EXISTS. The G-1 add-optional investigation took four seed
 * reconstructions and ended on the question "what did you actually tap?" — and
 * the answer explained every byte in one line. Every one of those
 * reconstructions was a guess about a device nobody could read. This is the
 * instrument that makes the guess unnecessary, and it is also the post-launch
 * support tool: an athlete who reports "it said Done and nothing happened" can
 * send the sequence rather than try to remember it.
 *
 * WHY IT IS NOT THE DIAGNOSTICS CHANNEL. `athleteActionDiagnostics` already
 * emits this vocabulary, but it is switched OFF on production builds and drags
 * the whole V2 trace coordinator, deep snapshots and the dev-E2E scenario
 * bridge behind it. This is the small always-on part: a bounded ring of
 * already-redacted events, on disk, in the export. Turning the dev channel on
 * in production would have been the easy version of this and the wrong one.
 *
 * THE FOUR PROPERTIES, each of which was a gap (AGENTS.md, "instrumentation
 * must be alive where the defects are"):
 *
 *   1. ALIVE ON A RELEASE BUILD. No `__DEV__`, no env flag. A diagnostic that
 *      is dark on the build the defect lives on is a green gate that lies.
 *   2. SURVIVES A RELAUNCH. The interesting sequence is usually "I did this,
 *      then this, then it broke, then I closed the app in disgust."
 *   3. BOUNDED. 200 entries — enough to hold the sequence that led to a
 *      report, small enough to leave on forever and to paste into a message.
 *   4. IN THE EXPORT. Evidence that cannot leave the device is not evidence.
 *
 * PRIVACY. Entries are the events as `emitAthleteActionEvent` already built
 * them, which means they have already been through the forbidden-key filter:
 * no exercises, prescriptions, loads, injury detail or coach notes. The log
 * records that a move happened, from where to where, through which door, and
 * what the domain answered. It never records what the athlete lifted.
 * `athleteActionLogTests` asserts that with real forbidden fields rather than
 * trusting the filter.
 */

export const ATHLETE_ACTION_LOG_STORAGE_KEY = 'lfa.athlete-action-log.v1';

/**
 * Sam's number (2026-07-30). A device report is a handful of taps and their
 * boundaries — 200 entries covers several sessions of editing, and the whole
 * ring serialises to a few tens of KB.
 */
export const ATHLETE_ACTION_LOG_MAX_ENTRIES = 200;

const PROTOCOL_VERSION = 1;

export interface AthleteActionLogEntry {
  /** ISO instant the event was recorded. */
  at: string;
  event: string;
  traceId: string;
  source: string;
  actionType: string;
  /** Everything else the event carried, already redacted. */
  [field: string]: unknown;
}

interface PersistedAthleteActionLog {
  protocolVersion: number;
  entries: AthleteActionLogEntry[];
}

let entries: AthleteActionLogEntry[] = [];
let hydratedFromStorage = false;
let writeInFlight: Promise<void> | null = null;
let dirty = false;

/**
 * One write at a time, always converging on the current ring.
 *
 * Not debounced by a timer: the entries worth having are the ones written
 * immediately before something went wrong, and a timer is exactly what loses
 * them. Coalescing instead means a burst of events costs one extra write, not
 * one write per event.
 */
function persistSoon(): void {
  dirty = true;
  if (writeInFlight) return;
  writeInFlight = (async () => {
    while (dirty) {
      dirty = false;
      const payload: PersistedAthleteActionLog = { protocolVersion: PROTOCOL_VERSION, entries };
      try {
        await asyncStorageCompat.setItem(
          ATHLETE_ACTION_LOG_STORAGE_KEY,
          JSON.stringify(payload),
        );
      } catch {
        // A log that crashes the app it is observing is worse than no log.
        // The in-memory ring is unaffected and the export still carries it.
        return;
      }
    }
  })().finally(() => { writeInFlight = null; });
}

/**
 * Events that describe WHAT THE ATHLETE DID and what the app answered. These
 * survive; everything else is evicted first.
 *
 * Export 6 is why. Sam's six-step re-test produced 200 entries — and 182 of
 * them were one move's §18 repair search (`accepted_week_gateway_result` 76,
 * `repair_candidate_selected` 65, `repair_candidates_generated` 28,
 * `repair_candidate_rejected` 13). That single transaction's internals evicted
 * the first five steps of the session, including both findings he most wanted
 * read. A ring that one action can flood cannot describe a session, which is
 * the only thing this log is for.
 *
 * The engine chatter is still recorded — it is genuinely useful when the
 * question is "why did the repair pick that day" — it just loses its place in
 * the queue to the athlete's own actions.
 */
const DECISION_EVENTS: ReadonlySet<string> = new Set([
  'athlete_action_requested',
  'athlete_mutation_received',
  'athlete_action_route_selected',
  'mutation_preview_result',
  'mutation_constraint_created',
  'mutation_transaction_staged',
  'transaction_verification_result',
  'accepted_state_publication_result',
  'transaction_publish_result',
  'persistence_result',
  'athlete_action_completed',
  'athlete_action_failed',
  'athlete_ui_outcome_shown',
  'ui_outcome_mapped',
  'onboarding_step_committed',
  'onboarding_completion_result',
  'profile_write',
  'athlete_prefs_write',
  'calendar_write',
  'coach_prefs_write',
  'coach_mutation_history_write',
  'readiness_write',
  'coach_updates_write',
  'coach_store_write',
  'coach_memory_write',
  'program_override_write',
  // The rebuild's ledger (R1.1): every athlete decision is one of these.
  'decision_ledger_write',
  // The Journal's free notes: the athlete's own words are an answer.
  'journal_note_write',
  // 'auth_write' and 'ui_store_write' RETIRED with their stores
  // (Sam's §6 ruling, 2026-08-03) — no writer emits them any more.
  'profile_rehydrated',
  'profile_mirror_publication_refused',
  'profile_snapshot_repaired',
  'hydrated_state_checked',
]);

function isDecision(entry: AthleteActionLogEntry): boolean {
  return DECISION_EVENTS.has(entry.event);
}

/**
 * Trim to the cap, dropping the oldest ENGINE entries before any athlete
 * decision. Only when the ring is all decisions does the oldest decision go.
 */
function trimToCap(): void {
  if (entries.length <= ATHLETE_ACTION_LOG_MAX_ENTRIES) return;
  let over = entries.length - ATHLETE_ACTION_LOG_MAX_ENTRIES;
  const kept: AthleteActionLogEntry[] = [];
  for (const entry of entries) {
    if (over > 0 && !isDecision(entry)) {
      over -= 1;
      continue;
    }
    kept.push(entry);
  }
  entries = over > 0 ? kept.slice(over) : kept;
}

/**
 * Append one already-built, already-redacted event.
 *
 * Called from `emitAthleteActionEvent` BEFORE its enabled check — that call
 * ordering is the whole of gap 1, and the reason this function takes a finished
 * event rather than building one: there is exactly one place events are shaped,
 * and the log is a reader of it, not a second author.
 */
export function recordAthleteActionLogEntry(event: {
  event: string;
  traceId: string;
  timestamp: string;
  source: string;
  actionType: string;
  [field: string]: unknown;
}): void {
  // R1.3 (shell rebuild): a replayed interpreter is not the athlete acting.
  // While the boot latch is held the ring stays quiet — the boot flood that
  // evicted the athlete's own taps (evening-1) is unrepresentable.
  if (ledgerReplayActive()) return;
  const { timestamp, ...rest } = event;
  entries.push({ at: timestamp, ...rest } as AthleteActionLogEntry);
  trimToCap();
  persistSoon();
}

/** The ring, oldest first. Copies, so a reader cannot mutate the log. */
export function athleteActionLogEntries(): AthleteActionLogEntry[] {
  return entries.map((entry) => ({ ...entry }));
}

/**
 * Read the previous run's entries back, once, at startup.
 *
 * Persisted entries go BEFORE anything this run has already recorded: the
 * point of the log is the order things happened in, and a relaunch is a gap in
 * that order, not a reset of it.
 */
export async function hydrateAthleteActionLog(): Promise<void> {
  if (hydratedFromStorage) return;
  hydratedFromStorage = true;
  let raw: string | null = null;
  try {
    raw = await asyncStorageDurable.getItem(ATHLETE_ACTION_LOG_STORAGE_KEY);
  } catch {
    return;
  }
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as PersistedAthleteActionLog;
    if (!Array.isArray(parsed?.entries)) return;
    entries = [...parsed.entries, ...entries];
    trimToCap();
  } catch {
    // Unreadable bytes are dropped rather than crashing startup. The log is
    // never load-bearing for anything the athlete sees.
  }
}

/** Clear both ends — memory and disk. Anything less leaves the next export carrying it. */
export async function clearAthleteActionLog(): Promise<void> {
  entries = [];
  hydratedFromStorage = false;
  dirty = false;
  try {
    await asyncStorageCompat.setItem(
      ATHLETE_ACTION_LOG_STORAGE_KEY,
      JSON.stringify({ protocolVersion: PROTOCOL_VERSION, entries: [] }),
    );
  } catch {
    // Same reasoning as the write path.
  }
}
