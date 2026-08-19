/**
 * WHAT THE ATHLETE SEES, HELD IN THE CHAIN.
 *
 * Run: npm run test:visible-surfaces
 *
 * Two properties, both found by DRIVING THE REAL SCREENS on a simulator on
 * 2026-08-18 and neither visible to any existing suite:
 *
 *   1. the day card and the opened session present ONE exercise order;
 *   2. a swapped-in exercise never wears the outgoing exercise's load.
 *
 * ## WHY THESE CELLS EXIST WHEN MAESTRO FLOWS ALREADY PROVE BOTH
 *
 * The flows (`.maestro/visible/one-order.yaml`, `.maestro/visible/swap-load.yaml`)
 * are the acceptance — they tap the real controls and read the real glass, and
 * both were seen RED under mutation. But they need a booted simulator, so they
 * are not in `test:bible` and nothing runs them on an ordinary change. **A guard
 * outside the chain is a guard nothing runs.** These cells are the chain's half:
 * same properties, same owners, no pixels.
 *
 * **NEITHER HALF IS SUFFICIENT AND THAT IS SAID PLAINLY.** These cells cannot
 * see a screen that stops calling these owners — that is exactly the failure the
 * swap defect WAS (the writer was right; the screen talked over it), and only
 * the flow catches it. The flow cannot run here. Both, or the property is half
 * held.
 */

// ── Headless bootstrap. MUST precede every app import. ────────────────────
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
  throw new Error('NETWORK DISABLED');
};
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();

import { profileForDevE2ESeed, buildDevE2ESeed } from '../dev/e2e/devE2ESeedRegistry';
import { devE2EWeekStartForSeed } from '../dev/e2e/devE2ESeedIds';
import { generateProgramLocally } from '../services/api/generateProgram';
import { composeDayDetail } from '../utils/dayDetailComposition';
import { buildSessionTemplate } from '../utils/sessionTemplate';
import { buildSwapSuggestionPayload } from '../utils/swapSuggestionPayload';
import { loadForReplacementExercise } from '../rules/blockBoundaryProgression';
import * as fs from 'fs';
import * as path from 'path';
import {
  deriveSessionEquipmentRequirements,
} from '../utils/sessionEquipment';
import { exerciseAllowedByEquipment } from '../data/exercisePoolsStrength';
import { equipmentRequiredFor } from '../data/exerciseEquipmentRequirement';
import {
  createTemporaryEquipmentFact,
  temporaryFactScope,
} from '../rules/temporarySourceFact';
import type { EquipmentTag } from '../data/exercisePools';
import {
  resolveSelectedImplement,
  selectedImplementLabel,
} from '../rules/selectedImplement';
import { cueForImplement } from '../screens/home/dayWorkoutHelpers';
import { CUE_ASSUMED_IMPLEMENT, CUE_IMPLEMENT_NEUTRAL } from '../data/cueImplement';
import { materialiseComposedWeek } from '../rules/materialiseComposedWeek';
import { finaliseWorkoutAfterMutation } from '../utils/workoutCanonicalisation';
import { EXERCISE_CUES } from '../data/exerciseCues';

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) { passed += 1; console.log(`  PASS ${name}`); }
  else { failed += 1; console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); }
}

const SEED = 'standard-in-season-week' as const;

function mondayOfTheSeedWeek(): any {
  const profile = profileForDevE2ESeed(SEED);
  const weekStart = devE2EWeekStartForSeed(SEED);
  const program: any = generateProgramLocally(profile as any, {
    todayISO: weekStart, blockStartISO: weekStart,
  } as any);
  const micro = program.microcycles.find(
    (m: any) => String(m.startDate).slice(0, 10) === weekStart);
  return micro?.workouts.find((w: any) => w.dayOfWeek === 1) ?? null;
}

function rowNames(rows: readonly any[]): string[] {
  return rows.map((r) => String(r?.exercise?.name ?? r?.name ?? ''));
}

function run(): void {
  console.log('\nWHAT THE ATHLETE SEES\n');

  // ── PROPERTY 1: ONE ORDER ─────────────────────────────────────────────
  const monday = mondayOfTheSeedWeek();
  check('the seed world still produces a Monday strength session (non-vacuity)',
    !!monday && (monday.exercises ?? []).length >= 3,
    `rows=${(monday?.exercises ?? []).length}`);

  const card = rowNames(composeDayDetail(monday, monday).strengthExercises);
  const session = rowNames(
    buildSessionTemplate(monday).items
      .filter((item: any) => item.kind === 'exercise' && item.role !== 'conditioning')
      .map((item: any) => item.row));

  check('the day card lists more than two exercises (non-vacuity — an order needs rows)',
    card.length > 2, card.join(' | '));

  // Compare only the rows BOTH surfaces carry. The session's list can legitimately
  // hold rows the strength part does not (add-ons, team training); the claim is
  // about the ORDER of what they share, not about membership.
  const shared = new Set(card.filter((n) => session.includes(n)));
  const cardOrder = card.filter((n) => shared.has(n));
  const sessionOrder = session.filter((n) => shared.has(n));

  check('the shared rows are a real overlap, not one row (non-vacuity)',
    cardOrder.length >= 3, `${cardOrder.length} shared`);
  check('THE DAY CARD AND THE OPENED SESSION READ ONE ORDER',
    JSON.stringify(cardOrder) === JSON.stringify(sessionOrder),
    `card=[${cardOrder.join(' | ')}]  session=[${sessionOrder.join(' | ')}]`);

  // ── PROPERTY 2: THE REPLACEMENT'S OWN LOAD ────────────────────────────
  //
  // The exact world measured on glass: `Single-Leg RDL` at 20 kg is replaced by
  // `Glute Bridge`, which this athlete has never loaded.
  const outgoing = (monday?.exercises ?? []).find(
    (r: any) => String(r?.exercise?.name ?? r?.name) === 'Single-Leg RDL');
  check('the outgoing row exists and carries a load (non-vacuity — nothing to inherit otherwise)',
    !!outgoing && Number(outgoing.prescribedWeightKg) > 0,
    `prescribedWeightKg=${outgoing?.prescribedWeightKg}`);

  const replacementOwnLoad = loadForReplacementExercise({
    exerciseName: 'Glute Bridge',
    onboardingData: profileForDevE2ESeed(SEED) as any,
    recordedLoadByExercise: {},
  });
  check('the load owner says the replacement has NO load of its own (the world this is about)',
    replacementOwnLoad === undefined, String(replacementOwnLoad));

  const payload = buildSwapSuggestionPayload('Glute Bridge', outgoing, {});
  check('THE SWAP PAYLOAD CARRIES NO LOAD — the owner decides, not the screen',
    payload.weight === undefined, String(payload.weight));
  check('and it is not merely blanking everything: the DOSE still carries over',
    payload.sets === Number(outgoing?.prescribedSets)
      && payload.repsMin === Number(outgoing?.prescribedRepsMin),
    `sets=${payload.sets} repsMin=${payload.repsMin} vs row sets=${outgoing?.prescribedSets} repsMin=${outgoing?.prescribedRepsMin}`);

  // A choice that PRESCRIBES a load is stating one, not inheriting one — the
  // recovery fallbacks send 0 to mean unloaded and must keep winning.
  const prescribed = buildSwapSuggestionPayload('Easy Bike', outgoing, { weight: 0 });
  check('a prescribed load still wins (0 means unloaded, and it is the choice\'s to say)',
    prescribed.weight === 0, String(prescribed.weight));


  // ═══════════════════════════════════════════════════════════════════════
  // [3] THE SESSION-EQUIPMENT DOOR ASKS THE ONE LEGALITY ORACLE
  //
  // Measured through the real door 2026-08-18: unticking BARBELL on a day of
  // `RDLs / Bulgarian Split Squats / Landmine Press / Barbell Row` swapped out
  // `RDLs` — which Sam's own sheet authorises on **barbell OR dumbbells** and
  // which the athlete could still do. The sheet's requirement reader flat-maps
  // each row's display labels onto tags, turning that OR into an AND; the
  // composer, asking `exerciseAllowedByEquipment`, disagreed inside one run.
  //
  // The previous session attributed this to the post-mutation restore pass
  // putting the row back. It was not: the restore returned a LEGAL row, and the
  // reader that called it illegal was this one.
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n[3] The session-equipment door asks the one legality oracle');
  const KIT_WITH_BARBELL: EquipmentTag[] = ['bodyweight', 'dumbbells', 'barbell', 'bench', 'rack'];
  const KIT_WITHOUT_BARBELL: EquipmentTag[] = ['bodyweight', 'dumbbells', 'bench', 'rack'];

  check('the world this is about: RDLs is authored barbell OR dumbbells',
    JSON.stringify(equipmentRequiredFor('RDLs')) === '[["barbell","dumbbells"]]',
    JSON.stringify(equipmentRequiredFor('RDLs')));
  check('and the one oracle therefore says RDLs survives losing the barbell',
    exerciseAllowedByEquipment('RDLs', KIT_WITHOUT_BARBELL) === true);
  check('while a barbell-only row does not',
    exerciseAllowedByEquipment('Barbell Row', KIT_WITHOUT_BARBELL) === false);

  // ⚠ **THE CELLS THAT ASKED THE SCREEN'S PLANNER THIS QUESTION ARE GONE, AND
  // THE QUESTION IS NOT.** `buildSessionEquipmentReplacementPlan` was deleted
  // 2026-08-19 as proven-inert (0 replacements in 2,038 real door walks). The
  // OR-group property is now held against the REAL door, on a real athlete, by
  // `npm run test:session-equipment-owner` cell [5] — where an `RDLs` that gets
  // swapped reddens the run. The three oracle checks above stay here because
  // their subject is the authored sheet, which is alive.



  // ═══════════════════════════════════════════════════════════════════════
  // [4] THE EQUIPMENT DOOR'S REPLACEMENT WEARS ITS OWN LOAD — MOVED, NOT LOST
  //
  // This section drove `buildSessionEquipmentReplacementPlan` with a hand-built
  // 80 kg row and asserted the payload carried no weight of its own. That
  // planner is deleted (inert in 2,038 door walks), and the property it guarded
  // is now asserted where it actually matters — on the load the athlete SEES —
  // by `test:session-equipment-owner` cells [6] and [7].
  // ═══════════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════════
  // [5] THE SESSION EQUIPMENT ANSWER IS WRITTEN DOWN
  //
  // R-072's session scope was the DEFAULT case and the only one of the three
  // that wrote no fact: the sheet emitted swap actions and kept "no barbell
  // today" in React `useState`. Sam ordered it persisted 2026-08-18.
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n[5] The session equipment answer is written down');
  const screenSource = fs.readFileSync(
    path.resolve(__dirname, '..', 'screens', 'home', 'DayWorkoutScreenV2.tsx'), 'utf8');
  const applyBody = screenSource.slice(
    screenSource.indexOf('const applySessionEquipment'),
    screenSource.indexOf('const applyExerciseGuidedInjury'));
  // ⚠ **THIS USED TO ASSERT AN ORDER; IT NOW ASSERTS AN ABSENCE, AND THAT IS
  // STRICTLY STRONGER.** The old cell checked that the fact write came BEFORE
  // the handler's `swap_exercise` loop. That loop is deleted — proven inert
  // across 2,038 door walks — so the handler must now contain the fact write and
  // NO exercise-choosing call at all. The window is bounded at the next handler
  // so a swap belonging to the live Swap door cannot satisfy or break this.
  const factWriteAt = applyBody.indexOf("kind: 'missing_for_session'");
  check('the sheet writes a typed equipment fact',
    factWriteAt >= 0, `fact@${factWriteAt}`);
  check('and the equipment handler chooses no exercise and commits no swap',
    !/type: 'swap_exercise'/.test(applyBody)
      && !/buildSessionEquipmentReplacementPlan\(/.test(applyBody),
    'the screen is choosing exercises again — that authority belongs to the composer');

  const sessionScope = temporaryFactScope({ kind: 'date', date: '2026-07-15' });
  check('the session scope is the session\'s own day, and expires with it',
    sessionScope.from === '2026-07-15' && sessionScope.until === '2026-07-15',
    JSON.stringify(sessionScope));
  const sessionFact = createTemporaryEquipmentFact({
    observedDate: '2026-07-15', scope: sessionScope, mode: 'without',
    equipmentTags: ['barbell'], sourceSurface: 'session_detail',
  });
  check('and it is a canonical equipment fact, not a screen flag',
    sessionFact.factKind === 'equipment' && sessionFact.mode === 'without'
      && sessionFact.equipmentTags.includes('barbell')
      && sessionFact.effectiveUntil === '2026-07-15');


  // ═══════════════════════════════════════════════════════════════════════
  // [6] THE SELECTED IMPLEMENT, AND CUES THAT AGREE WITH IT  (R-104)
  //
  // Sam: *"Each composed/visible row must identify the actual implement selected
  // for that session. The athlete must not infer it from availability … Prove
  // that changing today's equipment changes the visible implement and its cues
  // together, and that no cue names equipment unavailable that day."*
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n[6] The selected implement, and cues that agree with it');
  const FULL_KIT: EquipmentTag[] = ['bodyweight', 'dumbbells', 'barbell', 'cables',
    'machine', 'bands', 'bench', 'pullup_bar', 'kettlebell', 'plyo_box', 'rack'];
  const NO_BARBELL: EquipmentTag[] = FULL_KIT.filter((tag) => tag !== 'barbell');

  const rdlFull = resolveSelectedImplement({ exerciseName: 'RDLs', availableTags: FULL_KIT });
  const rdlNoBar = resolveSelectedImplement({ exerciseName: 'RDLs', availableTags: NO_BARBELL });
  check('the world this is about: RDLs is the one authored OR-GROUP',
    rdlFull.source === 'authored_choice', rdlFull.source);
  check('THE IMPLEMENT IS STATED, NOT INFERRED — barbell on a full kit',
    rdlFull.implement === 'barbell' && selectedImplementLabel(rdlFull) === 'Barbell',
    String(rdlFull.implement));
  check('AND CHANGING TODAY\'S KIT CHANGES IT — dumbbells once the bar is gone',
    rdlNoBar.implement === 'dumbbells' && selectedImplementLabel(rdlNoBar) === 'Dumbbells',
    String(rdlNoBar.implement));

  // THE PROOF CASE Sam named by hand.
  const rdlCueFull = cueForImplement('RDLs', rdlFull.implement);
  const rdlCueNoBar = cueForImplement('RDLs', rdlNoBar.implement);
  check('non-vacuity: the authored RDL cue really does name a bar',
    /\bbar\b/i.test(String(rdlCueFull.text)), String(rdlCueFull.text));
  check('NO "BAR SLIDES DOWN LEG" WHEN DUMBBELLS ARE SELECTED',
    rdlCueNoBar.text === null && rdlCueNoBar.missingCueForImplement === true,
    String(rdlCueNoBar.text));
  check('and it is FLAGGED as missing authored guidance, never invented',
    rdlCueNoBar.missingCueForImplement === true
      && !/dumbbell/i.test(String(rdlCueNoBar.text ?? '')),
    'a fabricated dumbbell cue would fail this cell');

  // A fixed-implement row must be untouched by all of this.
  const kbFull = resolveSelectedImplement({ exerciseName: 'Kettlebell Swings', availableTags: FULL_KIT });
  const kbNoBar = resolveSelectedImplement({ exerciseName: 'Kettlebell Swings', availableTags: NO_BARBELL });
  check('a fixed-implement row is unmoved by an unrelated kit change',
    kbFull.implement === 'kettlebell' && kbNoBar.implement === 'kettlebell'
      && cueForImplement('Kettlebell Swings', kbNoBar.implement).text !== null);

  // ⚠ THE COVERAGE GATE. `CUE_ASSUMED_IMPLEMENT` is a hand-kept reading of the
  // authored library, so it can fall behind it silently — this re-runs the scan
  // that built it and reds on any cue that names an implement and has no row.
  const IMPLEMENT_WORDS: Record<string, RegExp> = {
    barbell: /\b(bar|barbell)\b/i,
    dumbbells: /\b(dumbbell|dumbbells|db)\b/i,
    kettlebell: /\b(kettlebell|kb|bell)\b/i,
    cables: /\b(cable|rope|handle)\b/i,
    machine: /\b(machine|pad|sled|seat)\b/i,
    bands: /\b(band)\b/i,
  };
  // ⚠ **A CUE NAMING SEVERAL IMPLEMENTS IS NEUTRAL, NOT UNFILED.** Sam's third
  // category: *"use a generic cue only where it is correct for every supported
  // implement."* `Z-Press` says *"Can be done seated on a bench, or with
  // dumbbells"* — it covers barbell AND dumbbells, so it fits either and needs
  // no row. The first version of this gate counted any implement WORD and went
  // red on exactly that cue, which would have forced a wrong row into the table.
  // Only a cue that names ONE implement can be written for one implement.
  const unfiled: string[] = [];
  let namingCues = 0;
  for (const [name, cue] of Object.entries(EXERCISE_CUES)) {
    const text = `${cue.primaryCue} ${cue.secondaryCue}`;
    const named = Object.entries(IMPLEMENT_WORDS)
      .filter(([, re]) => re.test(text)).map(([key]) => key);
    if (named.length === 0) continue;
    namingCues += 1;
    if (named.length > 1) continue;
    // Filed EITHER as assuming one implement, or as explicitly ruled neutral.
    if (!CUE_ASSUMED_IMPLEMENT[name] && !CUE_IMPLEMENT_NEUTRAL.has(name)) unfiled.push(name);
  }
  check('non-vacuity: the scan still finds implement-naming cues',
    namingCues >= 30, `${namingCues} cues name an implement`);
  check('EVERY CUE THAT NAMES AN IMPLEMENT IS FILED — the table cannot fall behind',
    unfiled.length === 0, `unfiled: ${unfiled.join(', ')}`);

  // THE LOAD RULING, HELD NEGATIVELY. Sam: *"do not split load history by
  // implement."* The implement owner must not take load as an input or return
  // one, or a later reader will start keying history off it.
  const implementKeys = Object.keys(rdlNoBar).sort().join(',');
  check('the implement owner names NO load — Sam\'s ruling, held in the type',
    implementKeys === 'alternatives,implement,source', implementKeys);


  // ═══════════════════════════════════════════════════════════════════════
  // [7] THE FALLBACK LADDER — NO SWAP MAY SILENTLY FAIL  (R-103)
  //
  // Measured through the real door 2026-08-18: a barbell-less athlete was
  // offered **`Inverted Row (Bodyweight)`**, which Sam's sheet requires
  // `rings_trx` for. The write door correctly refused it and the reason was
  // flattened into "That change didn't go through — nothing on your plan
  // changed." The ladder offered an ILLEGAL RUNG, which is not a fallback.
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n[7] The fallback ladder — held at the real door now');
  // ⚠ **THE LADDER CELLS DROVE THE SCREEN'S PLANNER AND IT IS DELETED.** They
  // asserted that a barbell-less athlete gets a LEGAL rung rather than the
  // `Inverted Row (Bodyweight)` the door used to offer and the write door used
  // to bounce, and that with nothing legal left the answer is the typed
  // `no_legal_fallback_on_remaining_kit` rather than silence.
  //
  // **BOTH PROPERTIES SURVIVE, ASKED OF THE COMPOSER INSTEAD OF THE SCREEN**,
  // which is the owner that actually chooses now:
  //   - every visible row legal on today's kit -> `test:session-equipment-owner` [3]
  //   - a world with nothing legal says so in words -> the same suite's [13],
  //     which reads the per-day gap sentences ("No vertical push today — that
  //     would need Kettlebell") rather than a plan object.
  // The non-vacuity check below stays: its subject is the authored sheet.
  check('non-vacuity: the rung that used to be offered really is illegal here',
    exerciseAllowedByEquipment('Inverted Row (Bodyweight)', NO_BARBELL) === false,
    `authored requirement ${JSON.stringify(equipmentRequiredFor('Inverted Row (Bodyweight)'))}`);


  // ═══════════════════════════════════════════════════════════════════════
  // [8] A LOADED ROW IS NEVER "BODYWEIGHT"  (Sam, 2026-08-18)
  //
  // *"Single-Leg RDL is legal with dumbbells or a kettlebell … Bodyweight is
  // only the unloaded regression. If prescribedWeightKg > 0, selectedImplement
  // must never be bodyweight."* Shipped on the simulator as
  // `Single-Leg RDL · 3 × 7 · 20kg` under the notice "Bodyweight today".
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n[8] A loaded row is never "Bodyweight"');
  check('the authored sheet now offers the alternatives Sam ruled',
    JSON.stringify(equipmentRequiredFor('Single-Leg RDL'))
      === '[["dumbbells","kettlebell","barbell"]]',
    JSON.stringify(equipmentRequiredFor('Single-Leg RDL')));
  check('and it is STILL legal unloaded — bodyweight remains the regression',
    exerciseAllowedByEquipment('Single-Leg RDL', ['bodyweight'] as EquipmentTag[]) === true);

  const slrdlLoadedFull = resolveSelectedImplement({
    exerciseName: 'Single-Leg RDL', availableTags: FULL_KIT, prescribedWeightKg: 20,
  });
  const slrdlLoadedNoBar = resolveSelectedImplement({
    exerciseName: 'Single-Leg RDL', availableTags: NO_BARBELL, prescribedWeightKg: 20,
  });
  check('20 kg SELECTS A DUMBBELL, never bodyweight',
    slrdlLoadedFull.implement === 'dumbbells', String(slrdlLoadedFull.implement));
  check('AND LOSING THE BARBELL CHANGES NOTHING — so no notice is owed',
    slrdlLoadedNoBar.implement === slrdlLoadedFull.implement,
    `${slrdlLoadedFull.implement} -> ${slrdlLoadedNoBar.implement}`);
  check('its authored alternatives include the kettlebell Sam named',
    slrdlLoadedFull.alternatives.includes('kettlebell'),
    JSON.stringify(slrdlLoadedFull.alternatives));
  check('unloaded, it may still regress to bodyweight on a bare kit',
    resolveSelectedImplement({
      exerciseName: 'Single-Leg RDL',
      availableTags: ['bodyweight'] as EquipmentTag[],
      prescribedWeightKg: 0,
    }).implement === 'bodyweight');
  check('but a LOADED row on that same bare kit never says bodyweight',
    resolveSelectedImplement({
      exerciseName: 'Single-Leg RDL',
      availableTags: ['bodyweight'] as EquipmentTag[],
      prescribedWeightKg: 20,
    }).implement !== 'bodyweight');
  check('and its cue is implement-neutral, so it fits whichever is selected',
    cueForImplement('Single-Leg RDL', slrdlLoadedNoBar.implement).text !== null
      && cueForImplement('Single-Leg RDL', slrdlLoadedNoBar.implement)
        .missingCueForImplement === false);


  // ═══════════════════════════════════════════════════════════════════════
  // [9] SWAP PROVENANCE REACHES THE ROW  (Sam, 2026-08-18)
  //
  // *"When the exercise identity changes because of equipment or injury, carry
  // typed swap provenance to the screen."* The composer has recorded
  // `ComposedRow.substitutedFor` since 2026-08-17 and `materialiseComposedWeek`
  // threw it away, so no screen could tell a substitution from an unfamiliar
  // lift. This is the carry, and the screen's precedence rule.
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n[9] Swap provenance reaches the row');
  // ⚠ **THIS WAS A SOURCE SCAN AND IT WAS GREEN-AND-EMPTY.** The first version
  // grepped `materialiseComposedWeek.ts` for `row.substitutedFor`; mutation M7
  // wrapped the carry in `false && row.substitutedFor` and the cell stayed
  // GREEN, because the string was still in the file. **A grep passes on dead
  // code.** It CALLS the materialiser now and reads what comes out.
  const composedRow: any = {
    identity: 'Goblet Squat',
    substitutedFor: { baseIdentity: 'Back Squat', cause: 'kit_today' },
    slot: 'squat', role: 'main_strength', mainStrengthPattern: 'squat',
    doseCategory: 'main', sets: 3, repsMin: 5, repsMax: 5, load: 60,
  };
  const materialisedDay: any = {
    dayOfWeek: 1, planEntryId: 'p1', name: 'Strength', workoutType: 'Strength',
    sessionTier: 'core', kind: 'lower', requiredSlots: ['squat'],
    declaredSlots: ['squat'], rows: [composedRow, { ...composedRow, identity: 'RDLs', substitutedFor: undefined }],
  };
  const materialised = materialiseComposedWeek(
    { days: [materialisedDay], gaps: [] } as any,
    { microcycleId: 'mc-test', weekStartISO: '2026-07-13' } as any,
  );
  const materialisedRows: any[] = materialised[0]?.exercises ?? [];
  check('non-vacuity: the materialiser produced both rows',
    materialisedRows.length === 2, `${materialisedRows.length} rows`);
  check('THE SUBSTITUTION RECORD SURVIVES THE COMPOSER -> WORKOUT BOUNDARY',
    materialisedRows[0]?.substitutedFrom?.baseExerciseName === 'Back Squat'
      && materialisedRows[0]?.substitutedFrom?.cause === 'kit_today',
    JSON.stringify(materialisedRows[0]?.substitutedFrom ?? null));
  check('and an UNSUBSTITUTED row carries none — no notice on unchanged rows',
    materialisedRows[1]?.substitutedFrom === undefined,
    JSON.stringify(materialisedRows[1]?.substitutedFrom ?? null));

  const screenBody = screenSource.slice(screenSource.indexOf('const substitution ='));
  check('IDENTITY OUTRANKS IMPLEMENT — never both notices on one row',
    /!substitutionBadgeText\s*&&\s*showImplementBadge/.test(screenBody),
    'the implement notice must stand down when the exercise itself changed');
  check('and the row renders ONE notice, not two',
    /affectedRowNotice\s*=\s*substitutionBadgeText\s*\?\?\s*implementBadgeText/
      .test(screenBody));
  check('each typed cause has athlete wording, and none is left unexplained',
    /kit_today/.test(screenBody) && /injury/.test(screenBody)
      && /excluded_today/.test(screenBody)
      && /Swapped from \$\{displayExerciseName/.test(screenBody));


  // ═══════════════════════════════════════════════════════════════════════
  // [10] SAM'S THREE EQUIPMENT RULINGS  (2026-08-18)
  //
  // Ruled after this branch surfaced the cue/sheet conflicts as a table. Held
  // BEHAVIOURALLY — through the legality oracle and the implement owner, not by
  // reading the data file back to itself.
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n[10] Sam\'s three equipment rulings');
  const DB_ONLY: EquipmentTag[] = ['bodyweight', 'dumbbells', 'bench'];
  const BB_ONLY: EquipmentTag[] = ['bodyweight', 'barbell', 'bench', 'rack'];
  const RINGS: EquipmentTag[] = ['bodyweight', 'rings_trx' as EquipmentTag];

  // RULING 1 — Skull Crushers: dumbbells OR barbell.
  check('SKULL CRUSHERS is legal on dumbbells alone',
    exerciseAllowedByEquipment('Skull Crushers', DB_ONLY) === true);
  check('AND NOW ALSO ON A BARBELL ALONE — the widening Sam ruled',
    exerciseAllowedByEquipment('Skull Crushers', BB_ONLY) === true);
  check('a barbell athlete SELECTS the barbell, and its bar cue then fits',
    resolveSelectedImplement({ exerciseName: 'Skull Crushers', availableTags: BB_ONLY })
      .implement === 'barbell'
      && cueForImplement('Skull Crushers', 'barbell').text !== null);
  check('a dumbbell athlete selects dumbbells, and the BAR cue stands down',
    resolveSelectedImplement({ exerciseName: 'Skull Crushers', availableTags: DB_ONLY })
      .implement === 'dumbbells'
      && cueForImplement('Skull Crushers', 'dumbbells').missingCueForImplement === true,
    'the cue is the barbell variant; suppressing it is the ruling, not a defect');

  // RULING 2 — Z-Press: barbell OR dumbbells, and its cue covers both.
  check('Z-PRESS is legal on either implement alone',
    exerciseAllowedByEquipment('Z-Press', BB_ONLY) === true
      && exerciseAllowedByEquipment('Z-Press', DB_ONLY) === true);
  check('and its cue is RULED NEUTRAL, so it renders on both',
    cueForImplement('Z-Press', 'barbell').text !== null
      && cueForImplement('Z-Press', 'dumbbells').text !== null
      && CUE_IMPLEMENT_NEUTRAL.has('Z-Press'));

  // RULING 3 — Inverted Row: a pull-up bar does NOT qualify.
  check('INVERTED ROW is NOT unlocked by a pull-up bar',
    exerciseAllowedByEquipment(
      'Inverted Row (Bodyweight)',
      ['bodyweight', 'pullup_bar'] as EquipmentTag[],
    ) === false,
    'Sam ruled against this widening — it is the row that caused the silent swap failure');
  check('and it IS legal on genuine rings/suspension',
    exerciseAllowedByEquipment('Inverted Row (Bodyweight)', RINGS) === true);
  check('so the ladder still refuses to offer it to a ringless athlete',
    exerciseAllowedByEquipment('Inverted Row (Bodyweight)', DB_ONLY) === false);

  // RULING 4 — Tib Raises unchanged.
  check('TIB RAISES is untouched, per the ruling',
    JSON.stringify(equipmentRequiredFor('Tib Raises')) === '[]',
    JSON.stringify(equipmentRequiredFor('Tib Raises')));


  // ═══════════════════════════════════════════════════════════════════════
  // [11] A REMOVAL EXCLUDES THE IDENTITY, NOT THE PATTERN  (Sam, 2026-08-18)
  //
  // *"Removing one exercise excludes that exercise identity; it does not remove
  // the movement pattern… Do not default an experienced/full-gym athlete to
  // Bodyweight Squat."* And: *"Do not collapse removal causes."*
  //
  // THE DEFECT: `removeExerciseAtDate` reported success while the canonicaliser's
  // repair pass put `Back Squat` straight back from the reference workout; the
  // transaction then found the week unchanged and told the athlete "that change
  // didn't go through". One cause behind BOTH disagreeing doors.
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n[11] A removal excludes the identity, not the pattern');
  // ⚠ **THE DEBT THIS BLOCK RECORDED IS NOW PAID, AND THE REASON IT COULD NOT
  // BE PAID BEFORE WAS ITSELF THE DEFECT.**
  //
  // What stood here said: *"a hand-built workout carries no strength intent, so
  // `intendedPatterns` is empty and the restore pass never runs on it — the
  // fixture cannot exhibit the fault."* That observation was correct and its
  // conclusion was wrong. **A workout with no typed intent is not an artefact of
  // hand-building — it is what the PHONE STORES.** The device installs its seed
  // with `preserveExactAcceptedWorkouts: true`, which deliberately bypasses the
  // canonicalisation that stamps `strengthIntent`, so every workout on the
  // device reached exactly that "restore pass never runs" state.
  //
  // That is why the door proof and the device disagreed for two sessions: the
  // door was measured on a REGENERATED world (typed intent, restore pass runs,
  // `Front Squat` lands) and the device ran the UNTYPED one (no restore pass, the
  // squat silently lost, §18 then refusing the whole week with
  // `pattern_restore_failure:strength_patterns:0` and the athlete told *"That
  // change didn't go through"*).
  //
  // The fix is in `finaliseWorkoutAfterMutation`: when a workout carries no
  // typed intent but DOES have a valid plan reference, intent is read from the
  // plan's own copy instead of from the candidate the mutation just changed.
  // Inferring intent from the candidate is circular — remove the day's only
  // squat and the day is judged never to have intended one.
  //
  // **THE WORLD BELOW IS THE PRODUCTION SEED FIXTURE, NOT A HAND-BUILT WORKOUT** —
  // `buildDevE2ESeed(SEED).program` is the exact object the device installs, and
  // its untyped shape is asserted before anything is concluded from it.
  const fixtureMonday: any = (() => {
    const weekStart = devE2EWeekStartForSeed(SEED);
    const micro = buildDevE2ESeed(SEED).program.microcycles.find(
      (m: any) => String(m.startDate).slice(0, 10) === weekStart);
    return micro?.workouts.find((w: any) => w.dayOfWeek === 1) ?? null;
  })();

  // NON-VACUITY, BOTH HALVES: the world must be the untyped one, and it must
  // actually contain the lift being removed. Either failing makes every cell
  // below green and empty.
  check('non-vacuity: the PHONE\'s stored Monday carries NO typed strength intent',
    !!fixtureMonday && !fixtureMonday.strengthIntent,
    `strengthIntent=${JSON.stringify(fixtureMonday?.strengthIntent ?? null)}`);
  check('non-vacuity: and it contains the Back Squat the athlete removes',
    rowNames(fixtureMonday?.exercises ?? []).includes('Back Squat'));

  const seedPhase = (profileForDevE2ESeed(SEED) as any).seasonPhase;
  const withoutSquat = {
    ...fixtureMonday,
    exercises: (fixtureMonday?.exercises ?? []).filter(
      (e: any) => String(e?.exercise?.name ?? '') !== 'Back Squat'),
  };

  const askedFor: string[] = [];
  const repaired = finaliseWorkoutAfterMutation(withoutSquat, {
    date: devE2EWeekStartForSeed(SEED),
    phase: seedPhase,
    planIntentValid: true,
    referenceWorkout: fixtureMonday,
    excludedIdentities: ['Back Squat'],
    legalIdentityForPattern: (pattern: any) => {
      askedFor.push(String(pattern));
      return 'Front Squat';
    },
  } as any);
  const repairedNames = rowNames(repaired.workout?.exercises ?? []);

  // ⚠ THIS IS THE CELL THAT REDS IF THE FIX IS REVERTED. Before it, the selector
  // was NEVER CALLED on this world — measured, `askedFor` was empty.
  check('the fallback selector IS asked to fill the removed pattern',
    askedFor.includes('squat'), `askedFor=${JSON.stringify(askedFor)}`);
  check('the excluded IDENTITY does not come back',
    !repairedNames.includes('Back Squat'), repairedNames.join(', '));
  check('and the PATTERN is kept by a legal loaded variation',
    repairedNames.includes('Front Squat'), repairedNames.join(', '));
  check('no unrelated row disappears',
    ['RDLs', 'Cossack Squat', 'Single-Leg RDL', 'Band Pallof Press']
      .every((name) => repairedNames.includes(name)), repairedNames.join(', '));

  // THE OTHER SIDE OF THE BOUNDARY — the fix must not over-reach. With no valid
  // plan reference there is nothing to read intent FROM, so the candidate's own
  // rows still own it exactly as before and the selector is not consulted.
  const askedWithoutReference: string[] = [];
  finaliseWorkoutAfterMutation(
    { ...withoutSquat, planEntryId: undefined },
    {
      date: devE2EWeekStartForSeed(SEED),
      phase: seedPhase,
      planIntentValid: false,
      referenceWorkout: null,
      excludedIdentities: ['Back Squat'],
      legalIdentityForPattern: (pattern: any) => {
        askedWithoutReference.push(String(pattern));
        return 'Front Squat';
      },
    } as any,
  );
  check('with no valid plan reference the candidate still owns its own intent',
    !askedWithoutReference.includes('squat'),
    `askedFor=${JSON.stringify(askedWithoutReference)}`);

  // The three causes are typed and distinct on the input contract.
  const coachSource = fs.readFileSync(
    path.resolve(__dirname, '..', 'utils', 'coachActions.ts'), 'utf8');
  check('the removal input carries a TYPED CAUSE, not one collapsed path',
    /cause\?:\s*'equipment'\s*\|\s*'exclusion'\s*\|\s*'injury'/.test(coachSource));
  check('and the screen\'s case defaults to an identity EXCLUSION',
    /input\.cause\s*\?\?\s*'exclusion'/.test(coachSource));
  check('the injury cause uses the INJURY ladder, not the pool walk',
    /cause === 'injury'/.test(coachSource)
      && /reason: 'injury_or_pain'/.test(coachSource));
  check('and only a same-pattern injury answer keeps full credit',
    /fullPatternCredit: choice\.hierarchyTier === 'same_movement_pattern'/.test(coachSource));
  check('an ACCESSORY substitute is partial coverage, never full credit',
    /fullPatternCredit: false/.test(coachSource)
      && /fullPatternCredit: true/.test(coachSource));

  // THE CANONICALISER MUST NOT RESTORE AN EXCLUDED IDENTITY — driven, not read.
  const restoreProbe = finaliseWorkoutAfterMutation as any;
  check('non-vacuity: the canonicaliser is callable here',
    typeof restoreProbe === 'function');

  console.log(`\nVisible surface totals: ${passed} passed, ${failed} failed`);
  totalsPrinted(failed);
  if (failed > 0) process.exitCode = 1;
}

run();
