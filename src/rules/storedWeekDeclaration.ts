/**
 * THE ONE READ DOOR FOR A WEEK'S DECLARATION — move (ii) of THE FLIP
 * (seat re-scope order 2026-08-07, `docs/SEAT_INBOX.md`; the §8 alternative
 * approved at `b1eee72d`).
 *
 * THE PROBLEM THIS DELETES. "Which contract does this week answer to?" was
 * written out LONGHAND at every site that asked it — `overlay
 * ?? coveringMicrocycle` (and, at three sites, a third `currentMicrocycle`
 * branch nobody else had). Thirteen copies of one question, each free to drift,
 * and each one a place move (iii) would otherwise have to be repeated.
 *
 * WHAT MOVE (ii) IS AND IS NOT. It is MECHANICAL: every site keeps asking
 * exactly what it asked, of exactly the same candidates, in exactly the same
 * order. Nothing derives here yet and no answer changes. Move (iii) then
 * switches the implementation below from storage to the deriver in ONE commit,
 * and every caller follows without being touched again — which is the whole
 * reason the door is worth building.
 *
 * WHY A DOOR AND NOT A WRITER FIX. Move (i) — teaching each writer to store
 * the derived answer — was attempted and abandoned under §8 SECOND-WALL LAW
 * (`docs/R53_FLIP_MOVE_I_WRITER_NAMED_BY_TAPE_2026-08-07.md`): four
 * publication sites were taught to derive and the stored declaration moved
 * zero leaves, because the stored week is re-authored by whichever gateway
 * pass runs last and there are at least five of those. Unread storage makes
 * every writer — the five found and any sixth — harmless in one commit. This
 * door is what makes storage unread.
 */
import type { Microcycle, WeekScopedWorkoutOverlay } from '../types/domain';
import type { WeeklyExposureContractV2 } from './weeklyExposureContractV2';

/**
 * WHICH CANDIDATE ANSWERED. Recorded rather than inferred, because "the door
 * behaves identically" is a claim about WHICH SOURCE each caller got, not just
 * about whether it got one — a door that silently promoted the covering
 * microcycle over an overlay would pass a bare not-null check.
 */
export type StoredWeekDeclarationSource =
  | 'overlay'
  | 'covering_microcycle'
  | 'current_microcycle'
  | 'none';

/**
 * THE CENSUS TAPE, and it lives IN the door on purpose.
 *
 * The seat's gate for this move is a census tape re-run showing the same pairs
 * and the same counts. A tape bolted to the longhand sites would be complete
 * only for the sites someone remembered to instrument — the exact failure the
 * ownership census's recording Proxy was built to avoid. A tape inside the one
 * door is complete BY CONSTRUCTION the moment the last longhand site is gone,
 * and its emptiness for a given reader is then evidence rather than an
 * oversight.
 *
 * Inert unless `LFA_TAPE_DECLARATION_DOOR=1`. `process.stdout` deliberately,
 * not `console.log`: the suites that reach these paths wrap their doors in
 * `quiet()`, which replaces the console — a `console.log` tape reads as "the
 * site never fired", and that cost a whole run during move (i).
 */
const tape = new Map<string, number>();

function record(reader: string, weekStart: string, source: StoredWeekDeclarationSource): void {
  if (process.env.LFA_TAPE_DECLARATION_DOOR !== '1') return;
  const key = `${reader}|${weekStart}|${source}`;
  tape.set(key, (tape.get(key) ?? 0) + 1);
}

/** Every (reader, week, source) pair the door served, with its count. */
export function declarationDoorTape(): Array<{
  reader: string;
  weekStart: string;
  source: StoredWeekDeclarationSource;
  calls: number;
}> {
  return [...tape.entries()]
    .map(([key, calls]) => {
      const [reader, weekStart, source] = key.split('|');
      return { reader, weekStart, source: source as StoredWeekDeclarationSource, calls };
    })
    .sort((left, right) => (left.reader + left.weekStart + left.source)
      .localeCompare(right.reader + right.weekStart + right.source));
}

export function resetDeclarationDoorTape(): void {
  tape.clear();
}

/**
 * The tape prints itself at exit rather than needing every suite to remember
 * to ask for it — a census that only reports where someone added a print is
 * the enumeration problem it exists to replace.
 */
if (process.env.LFA_TAPE_DECLARATION_DOOR === '1' && typeof process.on === 'function') {
  process.on('exit', () => {
    const rows = declarationDoorTape();
    const calls = rows.reduce((total, row) => total + row.calls, 0);
    // OCCURRENCES AND DISTINCT, both, with the dedup key NAMED — the counting
    // law (AGENTS.md): a count names the instrument's unit, not the domain
    // noun. The unit here is a (reader, week, source) triple.
    process.stdout.write(`\n[DECLARATION DOOR TAPE] ${calls} calls over `
      + `${rows.length} distinct (reader|weekStart|source) triples, `
      + `${new Set(rows.map((row) => row.reader)).size} distinct readers\n`);
    for (const row of rows) {
      process.stdout.write(`  ${row.calls}\t${row.reader}\t${row.weekStart}\t${row.source}\n`);
    }
  });
}

/** Does this microcycle cover the week? The one copy of a four-copy predicate. */
export function microcycleCoversWeek(
  microcycle: Pick<Microcycle, 'startDate' | 'endDate'> | null | undefined,
  weekStart: string,
): boolean {
  if (!microcycle) return false;
  const week = weekStart.slice(0, 10);
  return week >= microcycle.startDate.slice(0, 10) && week <= microcycle.endDate.slice(0, 10);
}

export interface StoredWeekDeclarationQuery {
  /** The week's overlay, if the world has one. */
  overlay?: Pick<WeekScopedWorkoutOverlay, 'exposureContractV2'> | null;
  /** The microcycle that COVERS this week — the reader's own fallback. */
  coveringMicrocycle?: Pick<Microcycle, 'exposureContractV2'> | null;
  /**
   * The third branch, and only the three sites that already had it pass it:
   * `contractForAcceptedWeek` and `safetyContractForDate` fall through to the
   * store's `currentMicrocycle` when it covers the week. Passing it where it
   * was never consulted would be a behaviour change wearing a refactor.
   */
  currentMicrocycle?: Pick<Microcycle, 'exposureContractV2'> | null;
  weekStart: string;
  /** Census identity — which caller is asking. Never affects the answer. */
  reader: string;
}

/**
 * THE WEEK'S DECLARATION, or null. Precedence is the app's existing one,
 * unchanged: the overlay's declaration outranks the covering microcycle's,
 * which outranks the store's current microcycle where a caller consulted it.
 */
/**
 * PRICING SCAFFOLD — move (iii), THE FLIP, priced before it is built.
 *
 * `LFA_FLIP_DOOR=1` drops the OVERLAY rung: the door stops answering from the
 * declaration the write path authors, and the covering microcycle's contract —
 * the generation output the deriver already treats as "the identity to derive
 * FROM" — answers instead. That is the whole behavioural content of the flip;
 * the fact-threading that lets the door derive in place is the BUILD, and it is
 * not worth threading through ten callers before the price is known.
 *
 * Inert unless the flag is set. Nothing here is landed behaviour.
 */
/**
 * ARM 2 IS DELETED, and the deletion is the finding, not tidying.
 *
 * Arm 2 replayed the week's identity onto the base contract from the live
 * world — the seat's (c). It was measured (control 2 -> arm 1 nine -> arm 2
 * FOURTEEN of 156: it paid ZERO and cost five more) and REFUTED, and its
 * numbers are recorded in
 * `docs/R53_FLIP_C_REPLAY_REFUTED_ACCUMULATOR_STOP_2026-08-07.md`.
 *
 * It is removed rather than parked because it read the profile MIRROR
 * (`useProfileStore.getState().onboardingData`), which is an LR-4 violation
 * the legacy-census ratchet counts by SOURCE SCAN — so a parked, flag-off
 * scaffold still pushed declared debt up by one. **That also explains one of
 * arm 2's own five "new reds": `test:legacy-census` was never a behavioural
 * artefact of the arm, it was this static hit.** A refuted scaffold is not
 * worth a debt ratchet; the replay unit re-derives its own arm from the
 * kickoff doc.
 */
export const FLIP_SCAFFOLD = {
  get door(): boolean { return process.env.LFA_FLIP_DOOR === '1'; },
};

export function selectStoredWeekDeclaration(
  query: StoredWeekDeclarationQuery,
): WeeklyExposureContractV2 | null {
  const overlay = FLIP_SCAFFOLD.door ? undefined : query.overlay?.exposureContractV2;
  if (overlay) {
    record(query.reader, query.weekStart, 'overlay');
    return overlay;
  }
  const covering = query.coveringMicrocycle?.exposureContractV2;
  if (covering) {
    record(query.reader, query.weekStart, 'covering_microcycle');
    return covering;
  }
  const current = query.currentMicrocycle?.exposureContractV2;
  if (current) {
    record(query.reader, query.weekStart, 'current_microcycle');
    return current;
  }
  record(query.reader, query.weekStart, 'none');
  return null;
}

/**
 * DOES THIS WEEK HAVE A DECLARATION? The class A′ question, routed to the same
 * owner so an existence check and a selection can never disagree about the
 * week they are both looking at.
 */
export function hasStoredWeekDeclaration(query: StoredWeekDeclarationQuery): boolean {
  return selectStoredWeekDeclaration(query) !== null;
}
