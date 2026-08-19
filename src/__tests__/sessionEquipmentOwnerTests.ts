/**
 * THE EQUIPMENT ANSWER, END TO END, ON A REAL ATHLETE.
 *
 * *"Athlete reports missing equipment for today → canonical dated equipment
 * fact → composer legally recomposes the affected session → validator accepts
 * or gives a typed refusal → accepted-state transaction saves it → projection
 * only displays it → athlete sees the change → close/reopen preserves today's
 * change → the change expires after that session/date."*
 *
 * Run: npm run test:session-equipment-owner
 *
 * ## WHAT IS REAL HERE
 *
 * A cold start through `coldStartThroughOnboarding`, a real `generateProgramLocally`,
 * the real `executeProgramControlActionDurably` door the session equipment sheet
 * taps, the real `resolveWeekWithConditioning` read chain, and a real process
 * death through `relaunchApp`. **Nothing hand-builds a `ScheduleState` and
 * nothing writes a store directly** — an under-fed `ScheduleState` answers "no"
 * instead of failing, which is a green cell that measures nothing.
 *
 * ## WHY THE PREDICATES ARE CLASS-LEVEL AND NOT EXERCISE NAMES
 *
 * Every cell below asks the app's OWN legality oracle
 * (`exerciseAllowedByEquipment`, the one `composeWeek` and generation use) and
 * the app's OWN load owner (`resolveComposedLoad`). A cell that named
 * `Barbell Row` would pass on the day a pool rotation replaced it and would
 * never have caught the class. The one name in this file is in cell [0], whose
 * whole job is to fail loudly when the fixture world stops containing the
 * shape the other cells need — see NON-VACUITY below.
 *
 * ## NON-VACUITY
 *
 * Cells [1] and [5] are the controls. [1] refuses to pass unless the session
 * really carries TWO rows that today's kit removes; [5] refuses unless it also
 * carries a row authored against an OR group (barbell **or** dumbbells **or**
 * kettlebells) that must SURVIVE. Without those two, [3] ("no illegal row is
 * visible") would pass on an app that had stopped reading equipment at all.
 *
 * ## THE WORLD, STATED, BECAUSE A CONCLUSION DOES NOT OUTLIVE IT
 *
 * Off-season, three training days (Mon/Wed/Fri), commercial gym, 5+ years,
 * install 2026-07-13. On 2026-07-22 that athlete is programmed
 * `RDLs / Bulgarian Split Squats / Landmine Press / Barbell Row / Banded Dead Bug`.
 * Removing the BARBELL takes `Landmine Press` and `Barbell Row` and leaves
 * `RDLs` — the OR-group row — exactly where it was.
 */

// ── Headless bootstrap. MUST precede every app import. ────────────────────
//
// `__DEV__` IS TRUE: this suite moves the clock, and `isDevE2EClockAvailable()`
// refuses outside dev, so `setDevE2EClock` would return null *silently* and
// every door below would read the wall clock.
(global as unknown as { __DEV__: boolean }).__DEV__ = true;
const localStorageData = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => localStorageData.get(key) ?? null,
    setItem: (key: string, value: string) => { localStorageData.set(key, value); },
    removeItem: (key: string) => { localStorageData.delete(key); },
    clear: () => { localStorageData.clear(); },
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — this athlete trains entirely on-device');
};
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();

import { readFileSync } from 'fs';
import { resolve as resolvePath } from 'path';
import type { OnboardingData, TrainingProgram, Workout } from '../types/domain';
import { addDaysISO } from '../utils/programBlockState';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { generateProgramLocally } from '../services/api/generateProgram';
import { commitRebuiltProgram } from '../utils/weekRebuild';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { buildProgramTabProjectedWeek } from '../utils/visibleProgramReadModel';
import { project } from '../rules/projectVisibleWeek';
import { executeProgramControlActionDurably } from '../utils/programControlActions';
import { resolveEquipmentCapabilities } from '../utils/equipmentAvailability';
import { exerciseAllowedByEquipment } from '../data/exercisePoolsStrength';
import { resolveComposedLoad } from '../rules/composedDose';
import { STRENGTH_POOLS, type PoolSlotKey } from '../data/exercisePoolsStrength';
import { selectActiveCoachNotes } from '../utils/activeCoachNotes';
import { resetStoresToFreshInstall } from './support/freshInstallStores';
import { quiet, quietAsync, relaunchApp, setJourneyClock } from './support/athleteJourney';

let pass = 0; let fail = 0; const failures: string[] = [];
function ok(name: string, condition: boolean, detail?: string): void {
  if (condition) { pass += 1; console.log(`  PASS ${name}`); }
  else {
    fail += 1;
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// THE WORLD
// ═══════════════════════════════════════════════════════════════════════════

const INSTALL_DAY = '2026-07-13';
const TARGET_DATE = '2026-07-22';
const REMOVED_TAG = 'barbell';

function mondayFor(dateISO: string): string {
  const parsed = new Date(`${dateISO}T12:00:00Z`);
  return addDaysISO(dateISO, -((parsed.getUTCDay() + 6) % 7));
}

function theAthlete(): OnboardingData {
  return {
    firstName: 'Sim', heightCm: 184, weightKg: 90, seasonPhase: 'Off-season',
    position: 'inside_mid', motivation: 'Dominate your level', trainingDaysPerWeek: 3,
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
    teamTrainingDaysPerWeek: 0, teamTrainingDays: [],
    teamTrainingDuration: '90 minutes', teamTrainingIntensity: 'Moderate',
    trainingLocation: 'Commercial gym',
    equipment: ['barbell', 'dumbbells', 'squat_rack', 'pullup_bar', 'cable_machine',
      'hamstring_curl', 'knee_extension', 'bands'],
    experienceLevel: '5+ years', squatStrength: '1.5x bodyweight',
    benchStrength: '1.5x bodyweight+', conditioningLevel: 'Good',
    sprintExposure: '2+ times per week', recentTrainingLoad: 'Very consistent',
    injuries: [], twoKmTimeTrial: { seconds: 420, recordedOn: INSTALL_DAY, source: 'onboarding' },
    equipmentAnswer: {
      tags: {
        barbell: 'have', dumbbells: 'have', cables: 'have', machine: 'have',
        bands: 'have', bench: 'have', pullup_bar: 'have', kettlebell: 'have',
        foam_roller: 'have', plyo_box: 'have',
      },
      modalities: { bike_erg: 'have', air_bike: 'have', row: 'have', ski: 'have', treadmill: 'have' },
      answeredOn: INSTALL_DAY,
    },
    usualGameDay: 'Saturday', gameDay: 'Saturday',
  } as unknown as OnboardingData;
}

/** Install and generate. Returns the settled week's Monday. */
function installAndGenerate(): string {
  localStorageData.clear();
  resetStoresToFreshInstall('session-equipment-owner:install');
  const profile = theAthlete();
  useProfileStore.getState().updateOnboardingData(profile);
  const outcome = quiet(() => useProfileStore.getState().completeOnboarding()) as
    { ok?: boolean; missingAnswers?: unknown } | undefined;
  if (outcome && outcome.ok === false) {
    throw new Error('onboarding REFUSED — this athlete is not a world the product would accept: '
      + JSON.stringify(outcome.missingAnswers ?? null));
  }
  setJourneyClock(INSTALL_DAY);
  const program = quiet(() => generateProgramLocally(profile, {
    todayISO: INSTALL_DAY,
    previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1,
      selectedPhase: 'Off-season' as never,
      phaseEntryWeekStartISO: mondayFor(INSTALL_DAY),
      originProvenance: 'explicit_user_phase_change',
      persistenceProvenance: 'preserved_persisted_state',
    },
  })) as TrainingProgram;
  // Week one of a fresh generation is a partial week; the settled week is the
  // one the athlete lives in, and it is the one every other driver in this repo
  // reports on.
  const settled = program.microcycles[1] ?? program.microcycles[0]!;
  const weekStart = String(settled.startDate).slice(0, 10);
  quiet(() => commitRebuiltProgram(program, { preserve: [], clear: [], conflictsRemoved: [] }, {
    markedDays: useCalendarStore.getState().markedDays ?? {},
    selectedDate: weekStart,
    reason: 'session-equipment-owner:generate',
  }));
  useProgramStore.setState({ currentMicrocycle: settled } as never);
  return weekStart;
}

interface Row { name: string; sets: number | null; kg: number | null; id: string | null; }

/** The resolved session — the same chain every app surface reads. */
function session(dateISO: string, weekStartISO: string): { name: string | null; rows: Row[] } {
  const week = quiet(() => resolveWeekWithConditioning(weekStartISO, buildScheduleStateImperative()));
  const day = week.find((candidate) => candidate.date === dateISO);
  const workout = (day as { workout?: Workout } | undefined)?.workout;
  return {
    name: workout?.name ?? null,
    rows: (workout?.exercises ?? []).map((row) => {
      const nested = (row as { exercise?: { name?: string } }).exercise;
      const num = (value: unknown): number | null => (Number.isFinite(value) ? Number(value) : null);
      return {
        name: String(nested?.name ?? (row as { name?: string }).name ?? '(NO NAME ON ROW)'),
        sets: num((row as { prescribedSets?: number }).prescribedSets),
        kg: num((row as { prescribedWeightKg?: number }).prescribedWeightKg),
        id: (row as { exerciseId?: string }).exerciseId ?? null,
      };
    }),
  };
}

/** The kit the app resolves for a date — never a list this file writes down. */
function kitFor(dateISO: string): readonly string[] {
  return quiet(() => resolveEquipmentCapabilities(
    useProfileStore.getState().onboardingData as never, [] as never, dateISO)).tags;
}

/** The athlete's answer, through the door the session equipment sheet taps. */
async function reportMissingForSession(args: {
  dateISO: string; tags: readonly string[];
}): Promise<{ ok: boolean; message: string }> {
  const result = await quietAsync(() => executeProgramControlActionDurably({
    type: 'set_equipment_modifier',
    source: { screen: 'session_detail', surface: 'session_equipment_sheet', initiatedBy: 'tap' },
    scope: 'today_only',
    payload: {
      date: args.dateISO,
      todayISO: args.dateISO,
      decision: {
        kind: 'missing_for_session',
        tags: [...args.tags],
        conditioningModalities: [],
      },
    },
    requiresRebuild: false, createsActiveModifier: true, oneOffOnly: true,
  } as never, { todayISO: args.dateISO }));
  return {
    ok: (result as { ok?: boolean })?.ok === true,
    message: String((result as { message?: string })?.message ?? ''),
  };
}

function storedEquipmentFacts(): {
  factId: string; equipmentTags: string[]; scope: { kind: string; from?: string; until?: string };
}[] {
  const accepted = useProgramStore.getState().acceptedMaterialContext as unknown as
    { temporarySourceFacts?: { factKind?: string }[] } | undefined;
  return ((accepted?.temporarySourceFacts ?? []) as never[])
    .filter((fact: { factKind?: string }) => fact?.factKind === 'equipment') as never;
}

/** The per-day gaps the athlete is shown — the composer's typed reason, projected. */
function dayGaps(weekStartISO: string, dateISO: string): string[] {
  const weekDays = quiet(() => buildProgramTabProjectedWeek({
    mondayISO: weekStartISO, todayISO: dateISO,
    state: buildScheduleStateImperative(),
    overrideContexts: useProgramStore.getState().overrideContexts ?? {},
  }));
  const projected = quiet(() => project({
    week: weekDays as never, weekStart: weekStartISO,
    program: useProgramStore.getState().currentProgram as never,
  })) as unknown as { days?: { dateISO?: string; date?: string; gaps?: unknown[] }[] };
  const day = (projected.days ?? []).find((candidate) =>
    (candidate.dateISO ?? candidate.date) === dateISO);
  return (day?.gaps ?? []).map(String);
}

function athleteModifierTitles(): string[] {
  const accepted = useProgramStore.getState().acceptedMaterialContext as unknown as
    { activeConstraints?: unknown[] } | undefined;
  return quiet(() => selectActiveCoachNotes({
    activeConstraints: (accepted?.activeConstraints ?? []) as never,
  })).map((note) => String((note as { title?: string }).title ?? ''));
}

// ═══════════════════════════════════════════════════════════════════════════
// THE RUN
// ═══════════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  console.log('\n-- The session equipment answer, end to end --');
  console.log(`   WORLD: Off-season, 3 training days, commercial gym, 5+ years, installed ${INSTALL_DAY}.`);
  console.log(`   ANSWER: no ${REMOVED_TAG} on ${TARGET_DATE}, for that session only.\n`);

  const weekStart = installAndGenerate();
  setJourneyClock(TARGET_DATE);

  const fullKit = kitFor(TARGET_DATE);
  const reducedKit = fullKit.filter((tag) => tag !== REMOVED_TAG);
  const before = session(TARGET_DATE, weekStart);

  // ── [0] THE FIXTURE IS THE SHAPE THE REST OF THE FILE NEEDS ──────────────
  //
  // ⚠ THE ONLY CELL THAT NAMES AN EXERCISE, AND IT NAMES THEM SO THE OTHERS DO
  // NOT HAVE TO. If a pool rotation ever changes this day, this is the cell that
  // says so out loud instead of letting [1]/[5] quietly stop testing anything.
  ok('[0] the fixture day is still the session these cells were written against',
    before.rows.some((row) => row.name === 'RDLs')
      && before.rows.some((row) => row.name === 'Barbell Row'),
    `${TARGET_DATE} is now [${before.rows.map((row) => row.name).join(', ')}] — `
    + 'the world moved; re-choose the fixture day before trusting any cell below');

  // ── [1] NON-VACUITY: the answer really removes something ─────────────────
  const removedByAnswer = before.rows.filter((row) =>
    exerciseAllowedByEquipment(row.name, fullKit as never)
    && !exerciseAllowedByEquipment(row.name, reducedKit as never));
  ok('[1] the session carries at least two rows the removed implement is required for',
    removedByAnswer.length >= 2,
    `only ${removedByAnswer.length} row(s) [${removedByAnswer.map((r) => r.name).join(', ')}] — `
    + 'with fewer than two, cell [3] would pass on an app that ignores equipment entirely');

  // ── [5] NON-VACUITY: an OR-group row that must SURVIVE ───────────────────
  //
  // Sam's sheet is not flat: `RDLs` is `[['barbell','dumbbells']]` — barbell OR
  // dumbbells. An athlete without a barbell can still do it. Reading that OR as
  // an AND is the defect this control exists for; it swapped a perfectly legal
  // row and the sheet then still offered `Barbell` on re-open.
  const alternateImplementRows = before.rows.filter((row) =>
    exerciseAllowedByEquipment(row.name, fullKit as never)
    && exerciseAllowedByEquipment(row.name, reducedKit as never)
    && /rdl|romanian/i.test(row.name));
  ok('[5-control] the session carries a row authored against an OR equipment group',
    alternateImplementRows.length >= 1,
    'no alternate-implement row on this day — cell [5] would be vacuous');

  const loadsBefore = new Map(before.rows.map((row) => [row.name, row.kg]));

  // ── [2] THE DOOR ─────────────────────────────────────────────────────────
  const door = await reportMissingForSession({ dateISO: TARGET_DATE, tags: [REMOVED_TAG] });
  ok('[2] the athlete can mark the implement unavailable for today',
    door.ok, `the door refused: ${door.message}`);

  const after = session(TARGET_DATE, weekStart);

  // ── [3] EVERY VISIBLE ROW IS LEGAL ON WHAT THE ATHLETE KEPT ──────────────
  //
  // The CLASS, not a name: every row, asked of the one legality oracle.
  const illegal = after.rows.filter((row) =>
    !exerciseAllowedByEquipment(row.name, reducedKit as never));
  ok('[3] every visible row is legal on the kit the athlete still has',
    illegal.length === 0,
    `still visible and unperformable: ${illegal.map((row) => row.name).join(', ')}`);

  // ── [4] THE REST OF THE SESSION IS LEFT ALONE ────────────────────────────
  const untouched = before.rows.filter((row) =>
    exerciseAllowedByEquipment(row.name, reducedKit as never));
  const survivorNames = untouched.map((row) => row.name);
  const kept = survivorNames.filter((name) => after.rows.some((row) => row.name === name));
  ok('[4] every row the answer does not affect is still there',
    kept.length === survivorNames.length,
    `lost ${survivorNames.filter((name) => !kept.includes(name)).join(', ')}`);
  ok('[4] and they are still in the same order',
    JSON.stringify(after.rows.map((row) => row.name).filter((name) => kept.includes(name)))
      === JSON.stringify(before.rows.map((row) => row.name).filter((name) => kept.includes(name))),
    'the surviving rows were re-ordered by a change that was not asked for');

  // ── [5] THE ALTERNATE-IMPLEMENT ROW STAYS ────────────────────────────────
  const alternateSurvived = alternateImplementRows.every((row) =>
    after.rows.some((candidate) => candidate.name === row.name));
  ok('[5] a row whose authored data allows another legal implement is NOT swapped',
    alternateSurvived,
    `${alternateImplementRows.map((r) => r.name).join(', ')} was replaced although it is legal `
    + 'on the remaining kit — an OR equipment group read as an AND');

  // ── [6] EVERY REPLACEMENT CARRIES ITS OWN LOAD AUTHORITY ─────────────────
  //
  // ⚠ **"THE LOAD IS NOT THE OUTGOING ROW'S" IS THE WRONG QUESTION AND IT
  // MANUFACTURES FINDINGS.** Measured 2026-08-19 across 2,038 real door walks:
  // `Bulgarian Split Squats (25 kg) -> Goblet Squat (25 kg)` looks like a
  // transfer and is not one — 25 is `resolveComposedLoad`'s own answer for
  // Goblet Squat as an off-season main lift, and the agreement is a
  // coincidence. **Equality is not provenance.**
  //
  // ⚠ **AND ASKING THE OWNER WITH ONE ARGUMENT SET IS ALSO WRONG.** The first
  // cut of this cell called `resolveComposedLoad` with `poolSlot: null,
  // offseasonSubphase: null` and reddened on `DB Shoulder Press@20` — a load
  // the owner produces perfectly well once the governed off-season cut is in
  // play. Re-deriving the composer's exact arguments here would be a second
  // copy of the composer.
  //
  // So the question this cell asks is the reachable one: **is the delivered
  // number a load this identity can produce for THIS athlete anywhere in the
  // owner's governed argument space?** A load lifted off the outgoing row has
  // no reason to be, and cell [7] uses the same set to say so.
  const OFFSEASON_SUBPHASES = [null, 'early_offseason', 'mid_offseason', 'late_offseason'] as const;
  const POOL_SLOTS = [null, ...(Object.keys(STRENGTH_POOLS) as PoolSlotKey[])];
  const ownLoadsFor = (identity: string): Set<number> => {
    const loads = new Set<number>();
    for (const isMainLift of [true, false]) {
      for (const poolSlot of POOL_SLOTS) {
        for (const offseasonSubphase of OFFSEASON_SUBPHASES) {
          loads.add(quiet(() => resolveComposedLoad({
            identity, isMainLift, poolSlot: poolSlot as never,
            seasonPhase: 'Off-season' as never,
            offseasonSubphase: offseasonSubphase as never,
            profile: useProfileStore.getState().onboardingData as never,
            kit: reducedKit as never,
          })));
        }
      }
    }
    return loads;
  };
  const newRows = after.rows.filter((row) => !loadsBefore.has(row.name));
  const loadDisagreements = newRows.filter((row) =>
    row.kg !== null && !ownLoadsFor(row.name).has(row.kg));
  ok('[6] every replacement carries a load its own load owner can produce for this athlete',
    newRows.length > 0 && loadDisagreements.length === 0,
    newRows.length === 0
      ? 'no replacement was made at all — [1] said two rows had to go'
      : loadDisagreements.map((row) =>
          `${row.name}@${row.kg} (its own owner only ever answers `
          + `${[...ownLoadsFor(row.name)].sort((a, b) => a - b).join('/')})`).join(', '));

  // ── [7] AND IT IS NOT THE LOAD OF THE ROW IT REPLACED ────────────────────
  //
  // Sam: *"Back Squat -> Front Squat, Bench Press -> Close-Grip Bench, RDL ->
  // Glute Bridge ... are different exercises."* A replacement that arrives
  // carrying the outgoing weight is the defect; a replacement whose OWN owner
  // happens to answer the same number is not. The pair is the test.
  const outgoingLoads = new Set(before.rows
    .filter((row) => !after.rows.some((kept) => kept.name === row.name))
    .map((row) => row.kg)
    .filter((kg): kg is number => kg !== null && kg > 0));
  const inherited = newRows.filter((row) =>
    row.kg !== null && outgoingLoads.has(row.kg) && !ownLoadsFor(row.name).has(row.kg));
  ok('[7] no replacement inherits the load of the exercise it replaced',
    inherited.length === 0,
    inherited.map((row) =>
      `${row.name} arrived at ${row.kg} kg — a weight only the row it replaced ever had`).join(', '));

  // ── [8] THE STORED FACT IS DATED AND SESSION-SCOPED ──────────────────────
  const facts = storedEquipmentFacts();
  const fact = facts[0];
  ok('[8] exactly one canonical equipment fact was stored',
    facts.length === 1, `${facts.length} equipment facts stored`);
  ok('[8] and it is scoped to that one date, not the week',
    !!fact && fact.scope.kind === 'date'
      && fact.scope.from === TARGET_DATE && fact.scope.until === TARGET_DATE,
    `scope=${JSON.stringify(fact?.scope ?? null)} — a week scope would keep the athlete's `
    + 'barbell away until Sunday for a session that ends today');
  ok('[8] and it names the implement the athlete actually unticked',
    !!fact && fact.equipmentTags.length === 1 && fact.equipmentTags[0] === REMOVED_TAG,
    `tags=${JSON.stringify(fact?.equipmentTags ?? null)}`);

  // ── [11] NOTHING PERMANENT MOVED ─────────────────────────────────────────
  const profileNow = useProfileStore.getState().onboardingData as unknown as {
    equipmentAnswer?: { tags?: Record<string, string> }; equipment?: string[];
  };
  ok('[11] the athlete\'s permanent equipment answer is untouched',
    profileNow?.equipmentAnswer?.tags?.[REMOVED_TAG] === 'have'
      && (profileNow?.equipment ?? []).includes(REMOVED_TAG),
    `profile now says ${REMOVED_TAG}=${profileNow?.equipmentAnswer?.tags?.[REMOVED_TAG]} — `
    + 'a one-session answer rewrote the gym they own');

  // ── [12] THE PROJECTION HOLDS NO SELECTION OR WRITE AUTHORITY ────────────
  //
  // Structural, because behaviour cannot prove an absence. The file that draws
  // the session may not reach the exercise pools, the swap ladder or a store.
  const projectionSource = readFileSync(
    resolvePath(__dirname, '../utils/visibleProgramProjection.ts'), 'utf8');
  const authoringImports = [
    'exercisePools', 'tapSwapHierarchy', 'sessionEquipment', 'composeWeek',
    'swapSuggestionPayload', 'injuryWorkoutFilter', 'acceptedStateTransaction',
  ].filter((module) => new RegExp(`from '[^']*${module}`).test(projectionSource));
  ok('[12] the visible projection imports no exercise-selection or write owner',
    authoringImports.length === 0,
    `it reaches ${authoringImports.join(', ')} — the projection may hide, it may not build`);
  const writeCalls = ['setState(', 'getState().set', 'commit', 'transact']
    .filter((token) => projectionSource.includes(token));
  ok('[12] and it calls nothing that writes',
    writeCalls.length === 0, `it calls ${writeCalls.join(', ')}`);

  // ── [10] THE ANSWER DOES NOT LEAK PAST ITS DATE ──────────────────────────
  //
  // The next session of the SAME shape is a week later for a Mon/Wed/Fri
  // athlete. Asking a day with no session would pass on an app that had leaked
  // the restriction everywhere.
  const laterDate = addDaysISO(TARGET_DATE, 7);
  const laterWeekStart = addDaysISO(weekStart, 7);
  setJourneyClock(laterDate);
  const later = session(laterDate, laterWeekStart);
  const laterNeedsRemoved = later.rows.filter((row) =>
    !exerciseAllowedByEquipment(row.name, reducedKit as never));
  ok('[10-control] the later session exists and is not empty',
    later.rows.length > 0, `${laterDate} has no session — cell [10] would be vacuous`);
  ok('[10] the next date is back on the athlete\'s normal equipment',
    laterNeedsRemoved.length > 0,
    `${laterDate} carries no row needing ${REMOVED_TAG} — a one-day answer has become a standing one`);

  // ⚠ **AND THE SAME WEEK, WHICH IS THE LEAK THE ABOVE CELL CANNOT SEE.**
  // Measured 2026-08-19 by mutation: swapping the fact's scope from `date` to
  // `week` — the exact hard-coded scope this door used to carry — reddens [8]
  // and [9] and leaves the cell above GREEN, because a week window ends on the
  // Sunday and that probe lands the following Wednesday. A leak has to be
  // looked for where it actually spills: the athlete's OTHER sessions in the
  // same week.
  const sameWeekOthers = [0, 1, 2, 3, 4, 5, 6]
    .map((offset) => addDaysISO(weekStart, offset))
    .filter((dateISO) => dateISO !== TARGET_DATE);
  setJourneyClock(TARGET_DATE);
  const sameWeekWithSessions = sameWeekOthers
    .map((dateISO) => ({ dateISO, rows: session(dateISO, weekStart).rows }))
    .filter((entry) => entry.rows.length > 0);
  const sameWeekStillNormal = sameWeekWithSessions.filter((entry) =>
    entry.rows.some((row) => !exerciseAllowedByEquipment(row.name, reducedKit as never)));
  ok('[10-control] at least one OTHER session this week normally needs the implement',
    sameWeekWithSessions.length > 0,
    'no other session in the week — this cell would be vacuous');
  ok('[10] and no other session in the same week lost the implement',
    sameWeekStillNormal.length > 0,
    `every other session this week (${sameWeekWithSessions.map((e) => e.dateISO).join(', ')}) `
    + `is now free of ${REMOVED_TAG} — a one-session answer became a whole-week one`);

  // ── [9] CLOSE AND REOPEN ─────────────────────────────────────────────────
  //
  // A real process death: stores emptied, their writes settled, disk restored,
  // registry rehydrated, `runQuiescentBoot`. **The program is never persisted**,
  // so this is a full regeneration — which is exactly why it is worth asserting.
  setJourneyClock(TARGET_DATE);
  const relaunch = await relaunchApp({ storage: localStorageData, todayISO: TARGET_DATE });
  ok('[9] the app boots after the answer', relaunch.ok, String(relaunch.error));
  const afterBoot = session(TARGET_DATE, weekStart);
  ok('[9] close/reopen reproduces the same changed session, row for row and load for load',
    JSON.stringify(afterBoot.rows.map((row) => `${row.name}@${row.kg}`))
      === JSON.stringify(after.rows.map((row) => `${row.name}@${row.kg}`)),
    `before restart ${JSON.stringify(after.rows.map((r) => `${r.name}@${r.kg}`))}, `
    + `after ${JSON.stringify(afterBoot.rows.map((r) => `${r.name}@${r.kg}`))}`);
  ok('[9] and the canonical fact survived the restart',
    storedEquipmentFacts().length === 1
      && storedEquipmentFacts()[0]!.scope.from === TARGET_DATE,
    `${storedEquipmentFacts().length} equipment facts after boot`);

  // ── [13] A WORLD WITH NO LEGAL FALLBACK SAYS SO ──────────────────────────
  //
  // Everything but bodyweight gone. Rungs 1-4 of Sam's ladder cannot fill every
  // pattern, and rung 5 is the typed gap: *"preserve an explicit typed
  // gap/refusal ... never invent unrelated work."*
  const gapWeekStart = installAndGenerate();
  setJourneyClock(TARGET_DATE);
  const strippedDoor = await reportMissingForSession({
    dateISO: TARGET_DATE,
    tags: ['barbell', 'dumbbells', 'kettlebell', 'machine', 'cables', 'bands',
      'pullup_bar', 'bench', 'plyo_box'],
  });
  const strippedSession = session(TARGET_DATE, gapWeekStart);
  const strippedKit = kitFor(TARGET_DATE).filter((tag) =>
    !['barbell', 'dumbbells', 'kettlebell', 'machine', 'cables', 'bands',
      'pullup_bar', 'bench', 'plyo_box'].includes(tag));
  const strippedIllegal = strippedSession.rows.filter((row) =>
    !exerciseAllowedByEquipment(row.name, strippedKit as never));
  const gaps = dayGaps(gapWeekStart, TARGET_DATE);
  ok('[13] the door still answers when almost nothing is left',
    strippedDoor.ok, `refused: ${strippedDoor.message}`);
  ok('[13] and it never leaves an unperformable row on the day',
    strippedIllegal.length === 0,
    `${strippedIllegal.map((r) => r.name).join(', ')} — an illegal original was restored`);
  ok('[13] and the athlete is told, in words, what could not be trained and why',
    gaps.length > 0 && gaps.every((gap) => /need|no /i.test(gap)),
    `the day shows ${gaps.length} gap sentence(s): ${JSON.stringify(gaps)} — a pattern that `
    + 'silently vanished is the shrug this rung exists to forbid');
  ok('[13] and the restriction is named on the athlete\'s modifier list',
    athleteModifierTitles().some((title) => /equipment/i.test(title)),
    `modifiers: ${JSON.stringify(athleteModifierTitles())}`);

  console.log(`\nSession equipment owner totals: ${pass} passed, ${fail} failed`);
  if (failures.length) {
    console.log('Failures:');
    for (const failure of failures) console.log(`  - ${failure}`);
  }
  totalsPrinted(fail);
  if (fail > 0) process.exit(1);
}

main().catch((error) => { console.error(error); process.exit(1); });
