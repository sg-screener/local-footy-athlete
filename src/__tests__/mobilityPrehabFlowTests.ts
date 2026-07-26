/**
 * D13 — the collapsed "Mobility & Prehab" flow at the top of the session.
 *
 * Spec: `docs/SESSION_TEMPLATE_SPEC_2026-07-25.md` §4. `MOBILITY_FLOW_TEMPLATES`
 * has existed as a catalog of 10 templates since before this unit, with no
 * screen to land on — the code comment at the old `DayWorkoutScreenV2:355`
 * called flow rendering "a POSSIBLE FUTURE BUILD, not now" because "a
 * suggestion naming a MOBILITY_FLOW_TEMPLATES entry has nowhere to land". This
 * is where they land.
 *
 * THE LOAD-BEARING RULE (§6 item 6, and the reason most of this suite exists).
 * The product assumes athletes will sometimes skip the flow entirely, so the
 * flow is NEVER load-bearing. That is not a UI preference, it is an accounting
 * boundary: flow content must not become a session component, must not gate
 * Finish Session, must not reach the feedback panel, and must not be counted as
 * work. §5 below is the part that would catch a future change quietly wiring it
 * in.
 *
 * §4.1's per-session-type mapping is an explicit v1 PLACEHOLDER (§6 items 6-7):
 * it ships now so the mechanism has something to render, and Sam curates the
 * real menus later. The tests below therefore pin the SELECTION MECHANISM —
 * that a session type resolves to exactly one template, deterministically,
 * filtered by season phase, with game week overriding — and treat the specific
 * template ids as the current placeholder content they are.
 *
 * Run: npm run test:mobility-flow
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import fs from 'fs';
import path from 'path';

import type { SeasonPhase } from '../types/domain';
import { selectMobilityPrehabFlow } from '../utils/mobilityPrehabFlow';
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

type FlowContext = { seasonPhase: SeasonPhase; isGameWeek: boolean };
const IN_SEASON: FlowContext = { seasonPhase: 'In-season', isGameWeek: false };

function flowFor(workout: any, context: FlowContext = IN_SEASON) {
  return selectMobilityPrehabFlow({ workout, ...context });
}

function primerNames(flow: any): string[] {
  return (flow?.primers ?? []).map((primer: any) => primer.name);
}

/* ══ 1. Session type selects the flow ══ */

console.log('\n[1] Each session type resolves to exactly one flow');
{
  const upper = flowFor(
    workoutOf({ exercises: [row('Bench Press'), row('Barbell Row')] }),
  );
  ok('an upper day gets a flow', !!upper);
  ok(
    'an upper day gets the t-spine/shoulder template',
    upper?.template.id === 't-spine-shoulder-reset',
    `got ${upper?.template.id}`,
  );
  ok(
    'the upper primer is the external rotation D13 names by example',
    primerNames(upper).includes('Banded External Rotation'),
    `got ${JSON.stringify(primerNames(upper))}`,
  );

  const squat = flowFor(
    workoutOf({ exercises: [row('Back Squat'), row('Bulgarian Split Squat')] }),
  );
  ok(
    'a squat-dominant lower day gets the lower-body reset',
    squat?.template.id === 'lower-body-reset',
    `got ${squat?.template.id}`,
  );
  ok(
    'the squat primer is a knee-activation entry from the lower prehab pool',
    primerNames(squat).some((name) =>
      ['Spanish Squat Hold', 'Banded TKE'].includes(name),
    ),
    `got ${JSON.stringify(primerNames(squat))}`,
  );

  const hinge = flowFor(
    workoutOf({ exercises: [row('Romanian Deadlift'), row('Barbell Hip Thrust')] }),
  );
  ok(
    'a hinge-dominant lower day gets the hamstring/hinge reset',
    hinge?.template.id === 'hamstring-hip-hinge-reset',
    `got ${hinge?.template.id}`,
  );
  ok(
    'the hinge primer is the hamstring/calf activation hold',
    primerNames(hinge).includes('Bosch Hold'),
    `got ${JSON.stringify(primerNames(hinge))}`,
  );

  const fullBody = flowFor(
    workoutOf({ exercises: [row('Back Squat'), row('Bench Press')] }),
  );
  ok(
    'a full-body day gets the movement-prep template built for exactly that',
    fullBody?.template.id === 'pre-training-movement-prep',
    `got ${fullBody?.template.id}`,
  );
  ok(
    'a full-body day carries both an upper and a lower primer',
    primerNames(fullBody).includes('Banded External Rotation') &&
      primerNames(fullBody).length >= 2,
    `got ${JSON.stringify(primerNames(fullBody))}`,
  );

  ok(
    'selection is deterministic — the same session resolves the same way twice',
    flowFor(workoutOf({ exercises: [row('Bench Press')] }))?.template.id ===
      flowFor(workoutOf({ exercises: [row('Bench Press')] }))?.template.id,
  );
}

/* ══ 2. Game week overrides the session type ══ */

console.log('\n[2] Game week overrides regardless of session type');
{
  const gameWeek = flowFor(workoutOf({ exercises: [row('Back Squat')] }), {
    seasonPhase: 'In-season',
    isGameWeek: true,
  });
  ok(
    'a game week takes the game-week template even on a squat day',
    gameWeek?.template.id === 'game-week-light-mobility',
    `got ${gameWeek?.template.id}`,
  );
  ok('the game-week flow carries no primer', primerNames(gameWeek).length === 0);
}

/* ══ 3. Season phase filters the catalog ══ */

console.log('\n[3] phaseSuitability is honoured, not ignored');
{
  const offSeason = flowFor(workoutOf({ exercises: [row('Back Squat')] }), {
    seasonPhase: 'Off-season',
    isGameWeek: false,
  });
  ok(
    'an off-season flow is suitable for the off-season',
    offSeason?.template.phaseSuitability.includes('Off-season'),
    `got ${JSON.stringify(offSeason?.template.phaseSuitability)}`,
  );

  // The game-week template is scoped to In-season / Deload / Game week only. An
  // off-season game week must not be handed a template the catalog says is
  // unsuitable — the override picks the flow, the phase filter still vetoes it.
  const offSeasonGameWeek = flowFor(workoutOf({ exercises: [row('Back Squat')] }), {
    seasonPhase: 'Off-season',
    isGameWeek: true,
  });
  ok(
    'the game-week override cannot smuggle in a phase-unsuitable template',
    !offSeasonGameWeek ||
      offSeasonGameWeek.template.phaseSuitability.includes('Off-season') ||
      offSeasonGameWeek.template.phaseSuitability.includes('Game week'),
    `got ${offSeasonGameWeek?.template.id}`,
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
  ok('no flow without a workout', selectMobilityPrehabFlow({ workout: null, ...IN_SEASON }) === null);
  ok(
    'no flow on a strength day with no classifiable movement',
    flowFor(workoutOf({ exercises: [] })) === null,
  );
}

/* ══ 5. The flow is never load-bearing ══ */

console.log('\n[5] The flow is never counted, never gates, never logged');
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
  const flowMovementNames = flow!.template.movements.map((movement) => movement.name);
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

  const feedbackPanel = fs.readFileSync(
    path.join(src, 'components/SessionFeedbackPanel.tsx'),
    'utf8',
  );
  ok(
    'the post-session feedback panel never asks about the flow',
    !/mobility|prehab flow/i.test(feedbackPanel),
  );
}

/* ══ 6. Render contract ══ */

console.log('\n[6] Collapsed at the top, tap to expand, cosmetic tick only');
{
  const section = fs.readFileSync(
    path.join(src, 'components/MobilityPrehabFlowSection.tsx'),
    'utf8',
  );
  const screen = fs.readFileSync(
    path.join(src, 'screens/home/DayWorkoutScreenV2.tsx'),
    'utf8',
  );

  ok('the flow section exists', section.length > 0);
  ok(
    'it starts collapsed',
    /useState\(false\)/.test(section),
    'collapsed by default — the athlete opts in',
  );
  ok('tapping toggles it open and shut', /setExpanded\(\(prev\) => !prev\)/.test(section));
  ok(
    'the collapsed header summarises movement count and duration',
    /movementCount/.test(section) && /durationMinutes/.test(section),
  );

  ok(
    'the completion tick is local component state only',
    /useState\(false\)/.test(section) && /setDone/.test(section),
  );
  ok(
    'the tick never writes to a store',
    !/useProgramStore|useProfileStore|useReadinessStore|AsyncStorage|setWeightOverride/.test(
      section,
    ),
    'a cosmetic tick that persists is not cosmetic',
  );
  ok(
    'the tick is labelled as carrying no consequence',
    /nothing is logged|not logged|Nothing is logged/i.test(section),
  );

  ok(
    'the screen mounts the flow above the session list',
    screen.indexOf('MobilityPrehabFlowSection') > 0 &&
      screen.indexOf('<MobilityPrehabFlowSection') < screen.indexOf('<SessionList'),
  );
  ok(
    'the flow is not rendered on the recovery-template branch',
    !/mode === 'recovery' \? \([\s\S]{0,400}MobilityPrehabFlowSection/.test(screen),
  );
  ok(
    'the flow never gates the Finish action',
    !/flowDone|mobilityDone/.test(screen),
  );
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
