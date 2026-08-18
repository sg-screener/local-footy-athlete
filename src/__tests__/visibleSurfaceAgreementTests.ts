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

import { profileForDevE2ESeed } from '../dev/e2e/devE2ESeedRegistry';
import { devE2EWeekStartForSeed } from '../dev/e2e/devE2ESeedIds';
import { generateProgramLocally } from '../services/api/generateProgram';
import { composeDayDetail } from '../utils/dayDetailComposition';
import { buildSessionTemplate } from '../utils/sessionTemplate';
import { buildSwapSuggestionPayload } from '../utils/swapSuggestionPayload';
import { loadForReplacementExercise } from '../rules/blockBoundaryProgression';
import * as fs from 'fs';
import * as path from 'path';
import {
  buildSessionEquipmentReplacementPlan,
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
import { CUE_ASSUMED_IMPLEMENT } from '../data/cueImplement';
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

  const equipmentRows = [
    { key: 'rdl', name: 'RDLs', raw: { exercise: { equipmentRequired: ['Barbell'] } } },
    { key: 'row', name: 'Barbell Row', raw: { exercise: { equipmentRequired: ['Barbell'] } } },
  ];
  const equipmentPlan = buildSessionEquipmentReplacementPlan({
    exercises: equipmentRows as never,
    requirements: deriveSessionEquipmentRequirements(equipmentRows as never),
    missingKeys: new Set(['tag:barbell'] as never),
    capabilities: {
      tags: KIT_WITH_BARBELL, conditioningModalities: [],
      selectionCompleteness: 'complete', source: 'athlete_answer',
    },
    environment: {
      activeInjuries: {}, primaryInjury: null,
      availableEquipment: ['bodyweight', 'dumbbell'],
      availableEquipmentTags: KIT_WITHOUT_BARBELL,
      capacity: 'high', hasEquipmentConstraint: true, medicalStop: false,
    } as never,
  });
  const replacedNames = equipmentPlan.ok
    ? equipmentPlan.replacements.map((entry) => entry.fromExercise)
    : ['REFUSED'];
  check('THE PLAN TAKES THE BARBELL-ONLY ROW AND LEAVES THE ONE THAT SURVIVES',
    JSON.stringify(replacedNames) === '["Barbell Row"]', JSON.stringify(replacedNames));

  // ⚠ NEWLY blocked, not blocked. A row already illegal on the athlete's SAVED
  // kit is a real problem, but it is not this answer's doing and this door must
  // not silently swap it while they are answering about something else.
  const preIllegalRows = [
    { key: 'squat', name: 'Back Squat', raw: { exercise: { equipmentRequired: ['Barbell', 'Rack'] } } },
    { key: 'row', name: 'Barbell Row', raw: { exercise: { equipmentRequired: ['Barbell'] } } },
  ];
  const noRackKit: EquipmentTag[] = ['bodyweight', 'dumbbells', 'barbell'];
  const preIllegalPlan = buildSessionEquipmentReplacementPlan({
    exercises: preIllegalRows as never,
    requirements: deriveSessionEquipmentRequirements(preIllegalRows as never),
    missingKeys: new Set(['tag:barbell'] as never),
    capabilities: {
      tags: noRackKit, conditioningModalities: [],
      selectionCompleteness: 'complete', source: 'athlete_answer',
    },
    environment: {
      activeInjuries: {}, primaryInjury: null,
      availableEquipment: ['bodyweight', 'dumbbell'],
      availableEquipmentTags: ['bodyweight', 'dumbbells'],
      capacity: 'high', hasEquipmentConstraint: true, medicalStop: false,
    } as never,
  });
  const preIllegalTaken = preIllegalPlan.ok
    ? preIllegalPlan.replacements.map((entry) => entry.fromExercise).sort()
    : ['REFUSED'];
  check('a row ALREADY illegal on the saved kit is not swept up by this answer',
    !JSON.stringify(preIllegalTaken).includes('Back Squat'), JSON.stringify(preIllegalTaken));

  // ═══════════════════════════════════════════════════════════════════════
  // [4] THE EQUIPMENT DOOR'S REPLACEMENT WEARS ITS OWN LOAD
  //
  // `sessionEquipment.replacementExercise` was a FOURTH copy of the swap payload
  // rule and still carried `?? raw?.prescribedWeightKg`. Measured through the
  // real door: `RDLs (80 kg) -> Glute Bridge` arrived at 80 kg, and
  // `Landmine Press (35 kg) -> Half-Kneeling Single-Arm Overhead Press` at 35
  // against its own estimate of 20.
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n[4] The equipment door\'s replacement wears its own load');
  const heavyRow = { prescribedSets: 3, prescribedRepsMin: 2, prescribedRepsMax: 4, prescribedWeightKg: 80 };
  const equipmentSwapRows = [
    { key: 'row', name: 'Barbell Row', targetId: 'row',
      raw: { ...heavyRow, exercise: { equipmentRequired: ['Barbell'] } } },
  ];
  const loadPlan = buildSessionEquipmentReplacementPlan({
    exercises: equipmentSwapRows as never,
    requirements: deriveSessionEquipmentRequirements(equipmentSwapRows as never),
    missingKeys: new Set(['tag:barbell'] as never),
    capabilities: {
      tags: KIT_WITH_BARBELL, conditioningModalities: [],
      selectionCompleteness: 'complete', source: 'athlete_answer',
    },
    environment: {
      activeInjuries: {}, primaryInjury: null,
      availableEquipment: ['bodyweight', 'dumbbell'],
      availableEquipmentTags: KIT_WITHOUT_BARBELL,
      capacity: 'high', hasEquipmentConstraint: true, medicalStop: false,
    } as never,
  });
  const swappedIn = loadPlan.ok ? loadPlan.replacements[0]?.toExercise : null;
  check('THE EQUIPMENT DOOR PRESCRIBES NO LOAD — the load owner decides',
    !!swappedIn && swappedIn.weight === undefined,
    `weight=${String(swappedIn?.weight)} (the outgoing row was 80)`);
  check('and the DOSE still carries over from the slot it steps into',
    !!swappedIn && swappedIn.sets === 3 && swappedIn.repsMin === 2 && swappedIn.repsMax === 4,
    `${swappedIn?.sets}x${swappedIn?.repsMin}-${swappedIn?.repsMax}`);

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
  const applyBody = screenSource.slice(screenSource.indexOf('const applySessionEquipment'));
  // ⚠ MATCH CODE, NEVER PROSE. The first version of this cell compared against
  // `'swap_exercise'` and went red on a tree that was correct — the word appears
  // in this handler's own explanatory comment, ABOVE the fact write it explains.
  // A source scan that a comment can move is not asserting the property.
  const factWriteAt = applyBody.indexOf("kind: 'missing_for_session'");
  const firstSwapAt = applyBody.indexOf("type: 'swap_exercise'");
  check('the sheet writes a typed equipment fact BEFORE it applies anything',
    factWriteAt >= 0 && firstSwapAt >= 0 && factWriteAt < firstSwapAt,
    `fact@${factWriteAt} swap@${firstSwapAt} — the fact write must precede the swap loop, `
      + 'or the producers downstream of it cannot know the kit changed');

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
  const unfiled: string[] = [];
  let namingCues = 0;
  for (const [name, cue] of Object.entries(EXERCISE_CUES)) {
    const text = `${cue.primaryCue} ${cue.secondaryCue}`;
    if (!Object.values(IMPLEMENT_WORDS).some((re) => re.test(text))) continue;
    namingCues += 1;
    if (!CUE_ASSUMED_IMPLEMENT[name]) unfiled.push(name);
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
  console.log('\n[7] The fallback ladder — no swap may silently fail');
  const ladderRow = [{
    key: 'row', name: 'Barbell Row', targetId: 'row',
    raw: {
      prescribedSets: 3, prescribedRepsMin: 4, prescribedRepsMax: 6,
      prescribedWeightKg: 72.5, exercise: { equipmentRequired: ['Barbell'] },
    },
  }];
  const ladderEnv = {
    activeInjuries: {}, primaryInjury: null,
    availableEquipment: ['bodyweight', 'dumbbell', 'cable', 'machine', 'kettlebell'],
    availableEquipmentTags: NO_BARBELL,
    capacity: 'high', hasEquipmentConstraint: true, medicalStop: false,
  };
  const ladderPlan = buildSessionEquipmentReplacementPlan({
    exercises: ladderRow as never,
    requirements: deriveSessionEquipmentRequirements(ladderRow as never),
    missingKeys: new Set(['tag:barbell'] as never),
    capabilities: {
      tags: FULL_KIT, conditioningModalities: [],
      selectionCompleteness: 'complete', source: 'athlete_answer',
    },
    environment: ladderEnv as never,
  });

  check('non-vacuity: the rung that used to be offered really is illegal here',
    exerciseAllowedByEquipment('Inverted Row (Bodyweight)', NO_BARBELL) === false,
    `authored requirement ${JSON.stringify(equipmentRequiredFor('Inverted Row (Bodyweight)'))}`);
  check('THE LADDER LANDS — a legal rung, not a refusal',
    ladderPlan.ok === true && ladderPlan.replacements.length === 1,
    ladderPlan.ok ? 'ok' : `REFUSED ${(ladderPlan as { exerciseName: string }).exerciseName}`);
  const landed = ladderPlan.ok ? ladderPlan.replacements[0] : null;
  check('AND THE RUNG IT LANDS ON IS LEGAL ON THE REMAINING KIT',
    !!landed && exerciseAllowedByEquipment(String(landed.toExercise.name), NO_BARBELL),
    String(landed?.toExercise.name));
  check('it took the TOP rung — same movement pattern, so coverage is full',
    !!landed && landed.fallbackTier === 'same_movement_pattern'
      && landed.coversOriginalPattern === true,
    `${landed?.fallbackTier} coversOriginalPattern=${landed?.coversOriginalPattern}`);
  check('and the replacement still prescribes no load of its own',
    !!landed && landed.toExercise.weight === undefined,
    String(landed?.toExercise.weight));

  // RUNG 6. When nothing legal remains the answer is a TYPED reason, never
  // silence and never an illegal row the write door will bounce.
  const barePlan = buildSessionEquipmentReplacementPlan({
    exercises: ladderRow as never,
    requirements: deriveSessionEquipmentRequirements(ladderRow as never),
    missingKeys: new Set(['tag:barbell'] as never),
    capabilities: {
      tags: ['bodyweight', 'barbell'] as EquipmentTag[], conditioningModalities: [],
      selectionCompleteness: 'complete', source: 'athlete_answer',
    },
    environment: {
      ...ladderEnv,
      availableEquipment: ['bodyweight'],
      availableEquipmentTags: ['bodyweight'] as EquipmentTag[],
    } as never,
  });
  check('RUNG 6 — nothing legal left gives a TYPED refusal, not a shrug',
    barePlan.ok === false
      && (barePlan as { reason: string }).reason === 'no_legal_fallback_on_remaining_kit',
    barePlan.ok
      ? `unexpectedly replaced with ${barePlan.replacements[0]?.toExercise.name}`
      : (barePlan as { reason: string }).reason);

  console.log(`\nVisible surface totals: ${passed} passed, ${failed} failed`);
  totalsPrinted(failed);
  if (failed > 0) process.exitCode = 1;
}

run();
