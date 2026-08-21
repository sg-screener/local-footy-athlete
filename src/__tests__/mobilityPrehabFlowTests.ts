/**
 * D13 — the collapsed "Mobility & Prehab" flow at the top of the session.
 *
 * Spec: `docs/SESSION_TEMPLATE_SPEC_2026-07-25.md` §4. Bible `:229`.
 *
 * THE BUNDLES ARE GONE, AND THIS SUITE CHANGED SHAPE WITH THEM. It used to pin a
 * SELECTION mechanism: ten `MOBILITY_FLOW_TEMPLATES` entries, one chosen per
 * session shape, filtered by `phaseSuitability`, overridden on a game week. Sam
 * does not recognise those groupings
 * (`docs/OPTIONAL_PLACEMENT_LAW_SUPERSESSION_2026-07-30.md`), so there is nothing
 * left to select among: the flow COMPOSES from `MOBILITY_POOL` — his twenty
 * movements at his authored doses — one movement per signed region.
 *
 * The cells that went with the bundles are not weakened versions of themselves;
 * they had no subject any more. A cell asserting "an upper day gets the
 * t-spine/shoulder template" cannot be rephrased once no template exists, and
 * rephrasing it into "an upper day gets SOMETHING" would be an assertion that
 * passes for the wrong reason. What replaces them asserts the properties the
 * bundles were standing in for: pool provenance, region spread, authored doses,
 * determinism, and shrink-never-pad under filtering.
 *
 * THE LOAD-BEARING RULE (§6 item 6, and the reason most of this suite exists).
 * The product assumes athletes will sometimes skip the flow entirely, so the
 * flow is NEVER load-bearing. It may now be measured honestly as per-movement
 * execution evidence, but it must not become a required session component,
 * gate Finish Session, or count as work. §5 catches a future change quietly
 * turning measurement into a requirement.
 *
 * Run: npm run test:mobility-flow
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;


import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import fs from 'fs';
import path from 'path';

import type { OnboardingInjury, SeasonPhase } from '../types/domain';
import {
  flowSlotCandidates,
  mobilityFlowMovementDose,
  selectMobilityPrehabFlow,
} from '../utils/mobilityPrehabFlow';
import { POOL_REGISTRY } from '../data/exercisePools';
import {
  EXERCISE_MUSCLE_METADATA,
  MUSCLE_METADATA_POOLS,
} from '../data/muscleExperienceMetadata';
import {
  FLOW_CATEGORY_MUSCLE_MAPPING,
  FLOW_DOSING,
  SESSION_FLOW_MENUS,
  type FlowSlotCategory,
} from '../data/sessionFlowMenus';
import { DEFAULT_ATHLETE_CONTEXT, type AthleteContext } from '../utils/sessionBuilder';
import { FULL_GYM_EQUIPMENT } from '../utils/equipmentAvailability';
import { getSessionComponents, getSessionComponentRows } from '../utils/sessionComponents';
import { buildSessionTemplate } from '../utils/sessionTemplate';

const src = path.resolve(__dirname, '..');

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

/* ══ Fixtures ══ */

let rowSeq = 0;
function row(name: string, overrides: Record<string, unknown> = {}): any {
  rowSeq += 1;
  const id = String(overrides.id ?? `row-${rowSeq}`);
  return {
    id,
    exerciseId: `ex-${id}`,
    exerciseOrder: rowSeq,
    prescribedSets: 3,
    prescribedRepsMin: 5,
    prescribedRepsMax: 5,
    restSeconds: 120,
    exercise: { id: `lib-${id}`, name },
    ...overrides,
  };
}

function workoutOf(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'w1',
    microcycleId: 'm1',
    dayOfWeek: 1,
    name: 'Session',
    description: '',
    durationMinutes: 60,
    intensity: 'moderate',
    workoutType: 'Strength',
    exercises: [],
    ...overrides,
  };
}

type FlowContext = {
  seasonPhase: SeasonPhase;
  isGameWeek: boolean;
  athlete?: AthleteContext;
  date?: string;
};
const IN_SEASON: FlowContext = { seasonPhase: 'In-season', isGameWeek: false };
const DATE = '2026-07-30';

// `inferEquipment(location)` is deleted (ruling 4, 2026-07-31) — equipment is
// an athlete answer now. The test keeps the same two envelopes it always
// exercised, stated as the tag sets they were.
const EQUIPMENT_ENVELOPES: Record<string, readonly string[]> = {
  'Commercial gym': FULL_GYM_EQUIPMENT,
  Outdoor: ['bodyweight', 'bands'],
};

function athleteWith(
  location: keyof typeof EQUIPMENT_ENVELOPES,
  injuries: OnboardingInjury[] = [],
): AthleteContext {
  return {
    injuries,
    equipmentTags: [...EQUIPMENT_ENVELOPES[location]] as AthleteContext['equipmentTags'],
  };
}

function injury(bodyArea: string): OnboardingInjury {
  return { bodyArea, description: '' } as OnboardingInjury;
}

function flowFor(workout: any, context: FlowContext = IN_SEASON) {
  return selectMobilityPrehabFlow({
    workout,
    seasonPhase: context.seasonPhase,
    isGameWeek: context.isGameWeek,
    athlete: context.athlete ?? DEFAULT_ATHLETE_CONTEXT,
    date: context.date ?? DATE,
  });
}

function movementNames(flow: any): string[] {
  return (flow?.movements ?? []).map((movement: any) => movement.exercise.name);
}

function movementEntries(flow: any): any[] {
  return (flow?.movements ?? []).map((movement: any) => movement.exercise);
}

function authoredShapeIncludes(dayType: string, category: string): boolean {
  const menu = SESSION_FLOW_MENUS.find((m) => m.dayType === dayType);
  return !!menu && menu.slots.some((slot) => slot.category === category);
}

/* ══ 1. The flow is D17's menu, filled ══ */

console.log("\n[1] Sam's D17 menus — the counts are law, the app picks which");
{
  ok(
    'mobility rep ranges display the high target only',
    mobilityFlowMovementDose({
      sets: 2, repsMin: 8, repsMax: 10, perSide: true,
    } as any) === '2 × 10 / side',
  );
  ok(
    'mobility duration ranges also display the high target only',
    mobilityFlowMovementDose({
      sets: 2, repsMin: 20, repsMax: 30, perSide: true, prescriptionType: 'duration',
    } as any) === '2 × 30s / side',
  );
  const upper = flowFor(workoutOf({ exercises: [row('Bench Press'), row('Barbell Row')] }));
  const squat = flowFor(workoutOf({ exercises: [row('Back Squat'), row('Bulgarian Split Squat')] }));
  const hinge = flowFor(workoutOf({ exercises: [row('Romanian Deadlift'), row('Barbell Hip Thrust')] }));
  const fullBody = flowFor(workoutOf({ exercises: [row('Back Squat'), row('Bench Press')] }));

  ok('an upper day takes the upper menu', upper?.dayType === 'upper', `got ${upper?.dayType}`);
  ok(
    'a squat-dominant lower day takes the squat menu',
    squat?.dayType === 'lower_squat',
    `got ${squat?.dayType}`,
  );
  ok(
    "a hinge day takes the hinge menu — Sam's precedence is hinge > squat > general",
    hinge?.dayType === 'lower_hinge',
    `got ${hinge?.dayType}`,
  );
  ok(
    'a day carrying both a hinge and a squat still takes the HINGE menu',
    flowFor(workoutOf({ exercises: [row('Romanian Deadlift'), row('Back Squat')] }))?.dayType
      === 'lower_hinge',
  );
  ok(
    'a full-body day takes the full-body menu',
    fullBody?.dayType === 'full_body',
    `got ${fullBody?.dayType}`,
  );

  // THE COUNTS ARE LAW. Sam: every menu lands on four flow items. A layer that
  // changes a count is changing his programming, not rendering it.
  for (const menu of SESSION_FLOW_MENUS) {
    const total = menu.slots.reduce((n, slot) => n + slot.count, 0);
    ok(`the ${menu.dayType} menu is authored at four items`, total === 4, `authored ${total}`);
  }
  for (const flow of [upper, squat, hinge, fullBody]) {
    ok(
      `the ${flow?.dayType} flow fills every authored slot`,
      flow?.movementCount === 4,
      `got ${flow?.movementCount} of 4`,
    );
  }

  // EVERY SLOT IS FILLED FROM ITS OWN AUTHORED CATEGORY — not from whatever was
  // nearest. This is the cell the retired bundles had no equivalent of: a bundle
  // was a list, so nothing could be checked against a category at all.
  const slotShape = (flow: any): string =>
    (flow?.movements ?? []).map((m: any) => m.category).sort().join(',');
  const authoredShape = (dayType: string): string =>
    SESSION_FLOW_MENUS.find((m) => m.dayType === dayType)!
      .slots.flatMap((slot) => Array(slot.count).fill(slot.category)).sort().join(',');
  for (const flow of [upper, squat, hinge, fullBody]) {
    ok(
      `the ${flow?.dayType} flow's categories are exactly the menu's`,
      slotShape(flow) === authoredShape(flow!.dayType),
      `got ${slotShape(flow)}, authored ${authoredShape(flow!.dayType)}`,
    );
  }

  // AND EVERY MOVEMENT BELONGS TO THE SLOT IT FILLED, through the authored muscle
  // sheet. A slot that quietly drew from the wrong pool would pass the shape cell
  // above and fail this one.
  const misplaced: string[] = [];
  for (const flow of [upper, squat, hinge, fullBody]) {
    for (const movement of flow?.movements ?? []) {
      const mapping = FLOW_CATEGORY_MUSCLE_MAPPING[movement.category];
      const entry = EXERCISE_MUSCLE_METADATA.find((e) => e.exercise === movement.exercise.name);
      const poolOk = !!entry && mapping.pools.includes(entry.pool);
      const groupOk = !!entry &&
        [...entry.primary, ...entry.secondary].some((g) => mapping.muscleGroups.includes(g));
      if (!poolOk || !groupOk) {
        misplaced.push(`${movement.exercise.name} in ${movement.category}`);
      }
    }
  }
  ok(
    "every movement is in its slot's authored pool AND muscle group",
    misplaced.length === 0,
    misplaced.join('; '),
  );

  // THE DOSES ARE SAM'S. `FLOW_DOSING.curatedDoseWins` is true and every candidate
  // is a curated pool entry, so each movement carries the dose he authored on it.
  // The retired bundles carried their own, which is how a grouping nobody authored
  // came to prescribe work.
  ok('the dosing rule still says curated wins', FLOW_DOSING.curatedDoseWins === true);
  const poolByName = new Map<string, any>();
  for (const pool of Object.values(POOL_REGISTRY)) {
    for (const entry of pool) poolByName.set(entry.name, entry);
  }
  const reDosed = movementEntries(upper).concat(movementEntries(hinge)).filter((movement) => {
    const source = poolByName.get(movement.name);
    return !source ||
      source.sets !== movement.sets ||
      source.repsMin !== movement.repsMin ||
      source.repsMax !== movement.repsMax;
  });
  ok(
    'every dose is the one authored on the curated pool entry',
    reDosed.length === 0,
    `re-dosed: ${reDosed.map((m: any) => m.name).join(', ')}`,
  );

  ok(
    'composition is deterministic — the same session and date fill the same flow',
    JSON.stringify(movementNames(upper)) ===
      JSON.stringify(movementNames(flowFor(
        workoutOf({ exercises: [row('Bench Press'), row('Barbell Row')] }),
      ))),
  );
  ok(
    'a different date rotates which entries fill the slots',
    JSON.stringify(movementNames(upper)) !==
      JSON.stringify(movementNames(
        flowFor(workoutOf({ exercises: [row('Bench Press'), row('Barbell Row')] }),
          { ...IN_SEASON, date: '2026-08-27' }),
      )),
    'every date drew the identical four movements — the seed is not reaching the draw',
  );
  ok(
    'no movement is ever repeated inside one flow',
    new Set(movementNames(hinge)).size === movementNames(hinge).length,
  );
}

/* ══ 2. Equipment and injuries filter it, exactly as every pool draw is filtered ══ */

console.log('\n[2] Filtered like every other pool draw — and it SHRINKS, never pads');
{
  const kneeAnkle = flowFor(workoutOf({ exercises: [row('Back Squat')] }), {
    ...IN_SEASON,
    athlete: athleteWith('Commercial gym', [injury('knee'), injury('ankle')]),
  });
  const contraindicated = ['Deep Squat Hold', 'ATG Split Squat', 'Toe Stretch', 'Calf Stretch'];
  ok(
    'a knee-and-ankle athlete is offered none of the movements those rule out',
    contraindicated.every((name) => !movementNames(kneeAnkle).includes(name)),
    `got ${JSON.stringify(movementNames(kneeAnkle))}`,
  );

  const outdoor = flowFor(workoutOf({ exercises: [row('Bench Press')] }), {
    ...IN_SEASON,
    athlete: athleteWith('Outdoor'),
  });
  ok(
    'an Outdoor athlete is never offered the bar-hang or the pullover',
    !movementNames(outdoor).includes('Dead Hang') &&
      !movementNames(outdoor).includes('Dumbbell Pullovers'),
    `got ${JSON.stringify(movementNames(outdoor))}`,
  );

  // SHRINK, NEVER PAD — Sam's gunshow ruling, and it does not stop at gunshows. A
  // slot whose candidates are all filtered out leaves the flow SHORTER; it never
  // borrows a fifth movement from a category the menu did not ask for.
  const thin = flowFor(workoutOf({ exercises: [row('Bench Press')] }), {
    ...IN_SEASON,
    athlete: athleteWith('Commercial gym', [injury('shoulder')]),
  });
  ok(
    'a shoulder injury shrinks the upper menu rather than substituting a category',
    !!thin && thin.movementCount <= 4 &&
      thin.movements.every((m) => authoredShapeIncludes('upper', m.category)),
    `got ${thin?.movementCount} movements: `
      + `${(thin?.movements ?? []).map((m) => m.category).join(', ')}`,
  );
}

/* ══ 3. The bundles are retired, not merely bypassed ══ */

console.log('\n[3] MOBILITY_FLOW_TEMPLATES no longer exists, and D17 is wired');
{
  ok(
    'the flow-bundle module is deleted',
    !fs.existsSync(path.join(src, 'data/mobilityFlowTemplates.ts')),
    'bypassing a catalog leaves it available to the next patch; deleting it does not',
  );
  const flowSource = fs.readFileSync(path.join(src, 'utils/mobilityPrehabFlow.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  ok(
    'the flow selector reads no template catalog at all',
    !/MOBILITY_FLOW_TEMPLATES|TEMPLATE_FOR_SHAPE|phaseSuitability/.test(flowSource),
    'the shape table and the phase filter existed to choose among bundles',
  );
  ok(
    'and it composes through D17 — the authored source for THIS surface',
    /SESSION_FLOW_MENUS/.test(flowSource) && /FLOW_CATEGORY_MUSCLE_MAPPING/.test(flowSource),
    "sessionFlowMenus.ts said 'NOT WIRED YET: nothing composes a flow from this'",
  );

  // Every pool D17's mapping cites must be a real authored pool AND must actually
  // yield candidates. An unresolvable name would silently empty a slot Sam
  // authored — the flow would come out short and nothing would say why.
  const unresolved: string[] = [];
  const empty: string[] = [];
  for (const category of Object.keys(FLOW_CATEGORY_MUSCLE_MAPPING) as FlowSlotCategory[]) {
    for (const poolName of FLOW_CATEGORY_MUSCLE_MAPPING[category].pools) {
      if (!MUSCLE_METADATA_POOLS.includes(poolName)) unresolved.push(`${poolName} (not authored)`);
    }
    if (flowSlotCandidates(category, DEFAULT_ATHLETE_CONTEXT).length === 0) empty.push(category);
  }
  ok(
    'every pool D17 names is one of the authored muscle-sheet pools',
    unresolved.length === 0,
    unresolved.join('; '),
  );
  ok(
    'every authored slot category has candidates to draw from',
    empty.length === 0,
    `no candidate resolves for: ${empty.join(', ')} — the slot would come out empty`,
  );
}

/* ══ 4. Where there is no flow ══ */

console.log('\n[4] Days that get no flow at all');
{
  ok(
    'no flow on a conditioning-only day (§6 item 8)',
    flowFor(
      workoutOf({ name: 'Tempo Run', workoutType: 'Tempo-Run', exercises: [row('Tempo Run')] }),
    ) === null,
  );
  ok(
    'no flow on a recovery day (§6 item 3)',
    flowFor(workoutOf({ workoutType: 'Recovery', exercises: [row('Cat-Cow')] })) === null,
  );
  ok(
    'no flow on a recovery-TIER day',
    flowFor(
      workoutOf({ workoutType: 'Strength', sessionTier: 'recovery', exercises: [row('Cat-Cow')] }),
    ) === null,
  );
  ok(
    'no flow on a team-training-only day',
    flowFor(
      workoutOf({
        name: 'Team Training',
        workoutType: 'Team Training',
        exercises: [row('Team Training', { workoutType: 'Team Training' })],
      }),
    ) === null,
  );
  ok('no flow without a workout', flowFor(null) === null);
  ok(
    'no flow on a strength day with no classifiable movement',
    flowFor(workoutOf({ exercises: [] })) === null,
  );
}

/* ══ 5. The flow is never load-bearing ══ */

console.log('\n[5] The flow is measured but never counted or load-bearing');
{
  const workout = workoutOf({ exercises: [row('Bench Press')] });
  const flow = flowFor(workout);
  ok('the fixture actually has a flow to test against', !!flow);

  const componentKinds = getSessionComponents(workout).map((component) => component.kind);
  ok(
    'the flow adds no session component',
    !componentKinds.some((kind) => /mobility|flow|prehab/.test(kind)),
    `got ${JSON.stringify(componentKinds)}`,
  );

  const rows = getSessionComponentRows(workout);
  const allRowNames = [
    ...rows.strengthRows,
    ...rows.supportRows,
    ...rows.conditioningRows,
  ].map((r: any) => r?.exercise?.name);
  const flowMovementNames = movementNames(flow);
  ok(
    'no flow movement leaks into the counted component rows',
    flowMovementNames.every((name) => !allRowNames.includes(name)),
    `overlap: ${JSON.stringify(flowMovementNames.filter((n) => allRowNames.includes(n)))}`,
  );

  const template = buildSessionTemplate(workout);
  const listedNames = template.items.map((item: any) => item.row?.exercise?.name ?? item.row?.name);
  ok(
    'no flow movement appears as a badged list row either',
    flowMovementNames.every((name) => !listedNames.includes(name)),
  );

  const sessionComponentsSource = fs.readFileSync(
    path.join(src, 'utils/sessionComponents.ts'),
    'utf8',
  );
  ok(
    'sessionComponents.ts still knows nothing about the flow',
    !/mobilityPrehabFlow|MobilityFlow/.test(sessionComponentsSource),
    'the moment the counting owner imports the flow, it has become load-bearing',
  );

  const executionOwner = fs.readFileSync(
    path.join(src, 'utils/sessionExecutionChecklist.ts'),
    'utf8',
  );
  ok(
    'the execution owner measures mobility without assigning a counted component',
    /sectionId:\s*'mobility'[\s\S]{0,160}componentId:\s*null/.test(executionOwner),
  );
}

/* ══ 6. Render contract ══ */

console.log('\n[6] Shared section and exercise-row owners at the top');
{
  const screen = fs.readFileSync(
    path.join(src, 'screens/home/DayWorkoutScreenV2.tsx'),
    'utf8',
  );

  const mobilityOwnerAt = screen.indexOf("section.id === 'mobility'");
  const mobilityRowsAt = screen.indexOf('<MobilityExerciseList', mobilityOwnerAt);
  const mobilityRendererAt = screen.indexOf('function MobilityExerciseList');
  const sessionListAt = screen.indexOf('function SessionList', mobilityRendererAt);
  const mobilityRenderer = mobilityRendererAt >= 0 && sessionListAt > mobilityRendererAt
    ? screen.slice(mobilityRendererAt, sessionListAt)
    : '';
  ok('the flow renderer exists', mobilityRenderer.length > 500);
  ok('the shared execution section owns mobility disclosure',
    mobilityOwnerAt >= 0 && mobilityRowsAt > mobilityOwnerAt &&
      screen.slice(mobilityOwnerAt, mobilityRowsAt).includes('<SessionExecutionSection'));
  ok('the movement renderer owns no competing disclosure state',
    !/useState\(false\)|setExpanded|chevron-up|chevron-down/.test(mobilityRenderer));
  ok('the common section reports the movement total from execution items',
    /section\.items\.length/.test(screen));
  ok(
    'and it no longer promises a duration',
    !/durationMinutes/.test(mobilityRenderer),
    'the minutes came from a retired bundle; a composed flow shrinks, so a promised '
      + 'length is a signed sentence that can lie',
  );

  ok(
    'each movement reads the shared completed-id owner',
    /completedItemIds\.has\(itemId\)/.test(mobilityRenderer),
  );
  ok(
    'the presentation component never writes to a store itself',
    !/useProgramStore|useProfileStore|useReadinessStore|AsyncStorage|setWeightOverride/.test(
      mobilityRenderer,
    ),
    'the screen owns the result; this component is controlled',
  );
  ok(
    'each movement exposes a checkbox and delegates its stable item id',
    /<ExecutionChecklistItem/.test(mobilityRenderer) &&
      /itemId=\{itemId\}/.test(mobilityRenderer) &&
      /onToggle=\{onToggleItem\}/.test(mobilityRenderer),
  );
  ok(
    'every movement reuses Strength prescription, cues, load and video presentation',
    /<StrengthExerciseCard/.test(mobilityRenderer) &&
      /prescriptionLabel=\{mobilityFlowMovementDose\(exercise\)\}/.test(mobilityRenderer) &&
      /cueTextOverride=\{exercise\.notes\}/.test(mobilityRenderer) &&
      /expandedCues=\{expandedCues\}/.test(mobilityRenderer) &&
      /formatWeight=\{formatWeight\}/.test(mobilityRenderer) &&
      /onSelectExercise=\{onSelectExercise\}/.test(mobilityRenderer),
  );

  ok(
    'the screen mounts the shared mobility section above the session list',
    screen.indexOf('MobilityExerciseList') > 0 &&
      screen.indexOf('<MobilityExerciseList') < screen.indexOf('<SessionList'),
  );
  ok(
    'standalone low-load sessions do not restore a recovery-template branch',
    !/sessionTemplate\.mode === 'recovery'/.test(screen),
  );
  ok(
    'the external warm-up flow alone is withheld from SessionList',
    /section\.id === 'mobility'[\s\S]{0,120}section\.items\.every\(\(item\) => item\.source === 'mobility'\)/.test(screen),
  );
  ok(
    'the flow never gates the Finish action',
    !/flowDone|mobilityDone/.test(screen),
  );
}

console.log(`\n${passed} passed, ${failures.length} failed`);
totalsPrinted(failures.length);
if (failures.length > 0) process.exit(1);
