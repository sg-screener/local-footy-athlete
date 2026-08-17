/**
 * THE EQUIPMENT-SCOPE TRACE — mission "EQUIPMENT SCOPES AND AWAY/HOLIDAY
 * PROGRAMMING", seat `equip`, 2026-08-17.
 *
 *   npm run trace:equipment-scopes
 *
 * ## WHAT IT IS FOR
 *
 * The mission's first order is *"drive the real production doors, not
 * hand-built constraints"* and *"name the first exact boundary where any fact
 * is dropped, widened, made permanent or recomputed incorrectly"*. This script
 * is that instrument. It runs SIX boundaries through the app's own chain and
 * prints NINE facts at each one.
 *
 * ## HOW IT OBSERVES THE COMPOSER WITHOUT BECOMING A SECOND CHAIN
 *
 * `composeWeek` returns `selections` (the BASE block selection), per-row
 * `substitutedFor` (the TEMPORARY substitute) and `gaps` (the typed equipment
 * gap). **None of those three reach the generated `TrainingProgram`** — the
 * rows are materialised into domain workouts and the three records are dropped
 * at that seam. So a trace that read only the program could not see them.
 *
 * Rather than build a second composer call with hand-made inputs — which is
 * exactly the "hand-built constraints" the mission forbids, and which is how
 * `a-cell-that-asserts-a-pipeline-property-against-one-function` was born — this
 * WRAPS the live `composeWeek` export and records what the REAL generation run
 * passed it and got back. The generation is the app's; the observation is a tap
 * on the wire.
 *
 * READ-ONLY over the repo. It writes one markdown file to `docs/` and touches
 * no source.
 */

/* eslint-disable import/first */
// ⚠ **NO `declare global` HERE, DELIBERATELY.** `scripts/print-week.ts` — which
// this file imports — already declares `__DEV__`, and a second declaration in
// the same compilation scope is a `TS2451: Cannot redeclare block-scoped
// variable` on BOTH files. It only appeared when `test:equipment-scopes` pulled
// this script into the tests scope for the first time, so the compiler was the
// only thing that could have found it. The assignment below needs no
// declaration; it is what print-week's module scope does anyway, restated here
// so this script's own run does not depend on import order.
(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

// ── THE TAP, INSTALLED BEFORE GENERATION IS IMPORTED ───────────────────────
// `composeWeek` is called as a property of the imported module object, so
// replacing the property intercepts the live call. Installed first so no
// import order can beat it.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const composeWeekModule = require('../src/rules/composeWeek');
const realComposeWeek = composeWeekModule.composeWeek;

export interface ComposeObservation {
  readonly kit: readonly string[];
  readonly blockStartISO: string;
  readonly blockNumber: number;
  readonly selectionHistoryIn: readonly { slot: string; identity: string; blockStartISO: string }[];
  readonly selections: readonly { slot: string; identity: string; blockStartISO: string; role: string }[];
  readonly substitutions: readonly {
    dayOfWeek: number; slot: string; shipped: string; base: string; cause: string;
  }[];
  readonly gaps: readonly { dayOfWeek: number; slot: string; cause: string; detail: string }[];
  readonly kitUnachievablePatterns: readonly string[];
  readonly rows: readonly { dayOfWeek: number; slot: string; identity: string; role: string }[];
}

// ── THE SECOND TAP: the constraint pass that runs INSIDE generation ────────
// `validateWorkoutAgainstActiveConstraints` is called by `buildCanonicalCandidate`
// on every composed workout whenever a hard constraint is live. It can answer
// `workout: null`, and the caller then collapses that day to REST. Nothing
// narrates that, so it is tapped here.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const constraintModule = require('../src/utils/postGenerationConstraintValidation');
const realValidateWorkout = constraintModule.validateWorkoutAgainstActiveConstraints;
let constraintPass: string[] = [];

constraintModule.validateWorkoutAgainstActiveConstraints = function tapped(input: any) {
  const before = (input.workout?.exercises ?? []).length;
  const out = realValidateWorkout(input);
  const after = (out?.workout?.exercises ?? []).length;
  if (out?.workout === null || out?.changed) {
    constraintPass.push(
      `${input.date} day${input.workout?.dayOfWeek} "${input.workout?.name ?? ''}"`
      + ` rows ${before} -> ${out?.workout === null ? 'NULL (caller collapses to REST)' : after}`
      + `${out?.collapsedToRest ? ' [collapsedToRest]' : ''}`
      + `${out?.removedExerciseNames?.length ? ` removed: ${out.removedExerciseNames.join(', ')}` : ''}`,
    );
  }
  return out;
};

let observations: ComposeObservation[] = [];

composeWeekModule.composeWeek = function tracedComposeWeek(inputs: any) {
  const out = realComposeWeek(inputs);
  const substitutions: ComposeObservation['substitutions'][number][] = [];
  const rows: ComposeObservation['rows'][number][] = [];
  for (const day of out.days ?? []) {
    for (const row of day.rows ?? []) {
      rows.push({
        dayOfWeek: day.dayOfWeek, slot: row.slot, identity: row.identity, role: row.role,
      });
      if (row.substitutedFor) {
        substitutions.push({
          dayOfWeek: day.dayOfWeek,
          slot: row.slot,
          shipped: row.identity,
          base: row.substitutedFor.baseIdentity,
          cause: row.substitutedFor.cause,
        });
      }
    }
  }
  observations.push({
    kit: [...(inputs.kit ?? [])],
    blockStartISO: inputs.blockStartISO,
    blockNumber: inputs.blockNumber,
    selectionHistoryIn: (inputs.selectionHistory ?? []).map((e: any) => ({
      slot: e.slot, identity: e.identity, blockStartISO: e.blockStartISO,
    })),
    selections: (out.selections ?? []).map((e: any) => ({
      slot: e.slot, identity: e.identity, blockStartISO: e.blockStartISO, role: e.role,
    })),
    substitutions,
    gaps: (out.gaps ?? []).map((g: any) => ({
      dayOfWeek: g.dayOfWeek, slot: g.slot, cause: g.cause, detail: g.detail ?? g.reason ?? '',
    })),
    kitUnachievablePatterns: [...(out.kitUnachievablePatterns ?? [])],
    rows,
  });
  return out;
};

import { generateProgramLocally } from '../src/services/api/generateProgram';
import { buildProgramTabProjectedWeek } from '../src/utils/visibleProgramReadModel';
import {
  resolveEquipmentCapabilities,
  resolveEquipmentAvailability,
} from '../src/utils/equipmentAvailability';
import {
  createTemporaryEquipmentFact,
  createTemporaryScheduleFact,
  temporaryFactScope,
  composeTemporarySourceFactCompatibility,
} from '../src/rules/temporarySourceFact';
import {
  exerciseIsAvailableWith,
  equipmentRequirementLabel,
} from '../src/data/exerciseEquipmentRequirement';
import { projectWithGapsMarked, scheduleStateFor } from './print-week';
import type { OnboardingData, DayOfWeek } from '../src/types/domain';
import type { BlockExerciseSelection } from '../src/rules/blockExerciseSelection';

type SeasonPhaseClock = Parameters<typeof generateProgramLocally>[1]['seasonPhaseClock'];

// `print-week` sets __DEV__ false at module scope; that is what we want here too.

// ═══════════════════════════════════════════════════════════════════════════
// THE ATHLETE AND THE CALENDAR
// ═══════════════════════════════════════════════════════════════════════════

const WEEK_MONDAY = '2026-08-10';           // block 1, week 1
const TRIP_FROM = '2026-08-12';             // Wednesday — he leaves
const TRIP_UNTIL = '2026-08-16';            // Sunday — LAST DAY AWAY
const RETURN_DATE = '2026-08-17';           // Monday — HOME
const NEXT_BLOCK_MONDAY = '2026-09-07';     // block 2

/** The signed commercial-gym answer: every askable tag, every machine. */
export const COMMERCIAL_GYM = {
  tags: {
    barbell: 'have', dumbbells: 'have', cables: 'have', machine: 'have',
    bands: 'have', bench: 'have', pullup_bar: 'have', kettlebell: 'have',
    foam_roller: 'have', plyo_box: 'have', rack: 'have', trap_bar: 'have',
    swiss_ball: 'have', ab_wheel: 'have', back_extension_bench: 'have',
    dip_bars: 'have', rings_trx: 'have',
  },
  modalities: {
    bike_erg: 'have', air_bike: 'have', row: 'have', ski: 'have', treadmill: 'have',
  },
  answeredOn: '2026-08-01',
} as const;

export function athlete(overrides: Partial<OnboardingData> = {}): OnboardingData {
  return {
    firstName: 'Sam',
    ageRange: '22-26',
    position: 'Midfielder',
    heightCm: 183,
    weightKg: 84,
    experienceLevel: 'Intermediate',
    squatStrength: 'Around bodyweight',
    benchStrength: 'Around bodyweight',
    twoKmTimeTrial: { seconds: 420, testedOn: '2026-07-20' },
    conditioningLevel: 'Good',
    sprintExposure: '2+ times per week',
    recentTrainingLoad: 'Very consistent',
    injuries: [],
    goals: ['Get stronger', 'Run faster'],
    trainingLocation: 'Commercial gym',
    equipmentAnswer: COMMERCIAL_GYM,
    teamTrainingDuration: '90 minutes',
    teamTrainingIntensity: 'Hard',
    seasonPhase: 'In-season',
    gameDay: 'Saturday',
    usualGameDay: 'Saturday',
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as DayOfWeek[],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'] as DayOfWeek[],
    ...overrides,
  } as unknown as OnboardingData;
}

function clockAtPhaseWeek(phase: string, phaseWeekNumber: number, mondayISO: string): SeasonPhaseClock {
  const entry = new Date(`${mondayISO}T12:00:00`);
  entry.setDate(entry.getDate() - (phaseWeekNumber - 1) * 7);
  return {
    protocolVersion: 1,
    selectedPhase: phase as never,
    phaseEntryWeekStartISO: `${entry.getFullYear()}-${String(entry.getMonth() + 1)
      .padStart(2, '0')}-${String(entry.getDate()).padStart(2, '0')}`,
    originProvenance: 'explicit_user_phase_change',
    persistenceProvenance: 'preserved_persisted_state',
  } as SeasonPhaseClock;
}

// ═══════════════════════════════════════════════════════════════════════════
// THE DOORS — each builds its fact the way the app's own screen builds it
// ═══════════════════════════════════════════════════════════════════════════

/** The AWAY SPAN door: `HomeScreenV2`'s away sheet → `set_schedule_modifier`. */
export function travelFact(from: string, until: string) {
  return createTemporaryScheduleFact({
    observedDate: from,
    scope: temporaryFactScope({ kind: 'window', from, until }),
    scheduleKind: 'travel',
    unavailableDates: [],
    unavailableWeekdays: [],
    maxSessions: null,
    sourceActor: 'athlete',
    sourceSurface: 'away_this_week',
  } as Parameters<typeof createTemporaryScheduleFact>[0]);
}

/**
 * The AWAY EQUIPMENT door: `EquipmentLimitationSheet` → `set_equipment_modifier`
 * with `decision.kind: 'missing_for_span'`, whose executor builds exactly this
 * fact (`programControlActions.ts`, the `missing_for_span` branch).
 */
export function awayEquipmentFact(args: {
  from: string; until: string; removedTags: readonly string[]; removedModalities: readonly string[];
}) {
  return createTemporaryEquipmentFact({
    observedDate: args.from,
    scope: temporaryFactScope({ kind: 'window', from: args.from, until: args.until }),
    mode: 'without',
    equipmentTags: args.removedTags as never,
    conditioningModalities: args.removedModalities as never,
    sourceActor: 'athlete',
    sourceSurface: 'equipment_limitation_sheet' as never,
  });
}

/** The ONE route a fact takes into generation. */
function constraintsFor(facts: readonly unknown[], onDate: string) {
  return composeTemporarySourceFactCompatibility({
    temporarySourceFacts: facts as never,
    onDate,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// ONE BOUNDARY
// ═══════════════════════════════════════════════════════════════════════════

export interface Boundary {
  readonly id: string;
  readonly title: string;
  readonly profile: OnboardingData;
  readonly todayISO: string;
  readonly weekMondayISO: string;
  readonly phaseWeek: number;
  readonly blockStartISO: string;
  readonly blockNumber: number;
  readonly facts: readonly unknown[];
  readonly selectionHistory: readonly BlockExerciseSelection[];
  /** Session-scope removal, applied AFTER generation the way the day screen does. */
  readonly sessionRemoval?: { dateISO: string; tags: readonly string[]; modalities: readonly string[] };
}

export interface BoundaryResult {
  readonly boundary: Boundary;
  readonly permanentTags: readonly string[];
  readonly permanentModalities: readonly string[];
  readonly activeTags: readonly string[];
  readonly activeModalities: readonly string[];
  readonly equipmentFacts: readonly { factId: string; kind: string; from?: string; until?: string; tags: readonly string[] }[];
  readonly observation: ComposeObservation | null;
  readonly visible: readonly { day: string; title: string; lines: readonly string[] }[];
  readonly anchors: readonly string[];
  readonly error: string | null;
  readonly removalLog: readonly string[];
  readonly constraintPass: readonly string[];
}

export function runBoundary(boundary: Boundary): BoundaryResult {
  observations = [];
  constraintPass = [];
  const permanent = resolveEquipmentCapabilities(boundary.profile, [], boundary.todayISO);
  const compatibility = constraintsFor(boundary.facts, boundary.todayISO);
  const activeConstraints = [...compatibility.activeConstraints];
  const active = resolveEquipmentCapabilities(
    boundary.profile, activeConstraints as never, boundary.todayISO,
  );

  const equipmentFacts = boundary.facts
    .filter((f: any) => f.factKind === 'equipment' || f.factKind === 'schedule')
    .map((f: any) => ({
      factId: f.factId,
      kind: f.factKind === 'schedule' ? `schedule:${f.scheduleKind}` : `equipment:${f.mode}`,
      from: f.effectiveFrom,
      until: f.effectiveUntil,
      tags: [...(f.equipmentTags ?? [])],
    }));

  let error: string | null = null;
  let visible: BoundaryResult['visible'] = [];
  let anchors: string[] = [];
  // ── WHAT THE PIPELINE SAYS IT DID TO THE COMPOSER'S ROWS ────────────────
  // The canonicaliser and the constraint pass both narrate their own removals.
  // A refusal whose composer emitted the pattern means something between them
  // took it, and this is the only place that says which.
  const removalLog: string[] = [];
  const realLog = console.log;
  console.log = ((...parts: unknown[]) => {
    const text = parts.map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join(' ');
    if (/removed|collapsed|dropped|refus|travel|away|unavailable/i.test(text)) {
      removalLog.push(text.replace(/\s+/g, ' ').slice(0, 400));
    }
  }) as typeof console.log;
  try {
    const program = generateProgramLocally(boundary.profile, {
      todayISO: boundary.todayISO,
      blockNumber: boundary.blockNumber,
      blockStartISO: boundary.blockStartISO,
      seasonPhaseClock: clockAtPhaseWeek(
        String(boundary.profile.seasonPhase), boundary.phaseWeek, boundary.weekMondayISO,
      ),
      activeConstraints,
      temporarySourceFacts: boundary.facts,
      previousProgram: null,
      selectionHistory: boundary.selectionHistory,
      recordSelections: false,
    } as Parameters<typeof generateProgramLocally>[1]);

    const weekDays = buildProgramTabProjectedWeek({
      mondayISO: boundary.weekMondayISO,
      todayISO: boundary.todayISO,
      state: scheduleStateFor({
        profile: boundary.profile,
        program,
        todayISO: boundary.todayISO,
        activeConstraints,
        temporarySourceFacts: boundary.facts,
        markedDays: {},
      }) as never,
      overrideContexts: {},
      modalityPreferences: {},
    });
    const { visibleWeek } = projectWithGapsMarked({
      week: weekDays, weekStart: boundary.weekMondayISO,
    });
    // ── THE LEGALITY AUDIT, PER DAY, AGAINST THAT DAY'S OWN KIT ────────────
    // Asked of `exerciseIsAvailableWith` — the app's OWN availability oracle,
    // the same one generation filters with — and asked for the kit resolved on
    // THAT DATE, not the week's. That is the whole question the mission asks:
    // was this athlete shown something they could not do that day?
    visible = (visibleWeek.days ?? []).map((day: any) => {
      const kitToday = resolveEquipmentAvailability(
        boundary.profile, activeConstraints as never, day.date,
      );
      const lines: string[] = [];
      for (const part of day.parts ?? []) {
        lines.push(`  ${String(part.headline ?? '')}${part.detail ? ` — ${part.detail}` : ''}`);
        for (const row of part.rows ?? []) {
          const name = String(row.name ?? row.headline ?? '');
          const verdict = name && !exerciseIsAvailableWith(name, kitToday as string[])
            ? `   ⚠ ILLEGAL ON THIS DAY'S KIT (needs ${equipmentRequirementLabel(name) ?? '?'})`
            : '';
          lines.push(`    - ${name}${row.prescription?.sets_reps_range
            ? ` · ${row.prescription.sets_reps_range}` : ''}${verdict}`);
        }
      }
      return { day: `${day.date} [kit: ${kitToday.length}]`, title: String(day.headline ?? ''), lines };
    });
    anchors = (visibleWeek.days ?? []).flatMap((day: any) =>
      (day.parts ?? [])
        .filter((part: any) => /team training|game|match|club/i.test(String(part.headline ?? '')))
        .map((part: any) => `${day.date}  ${String(part.headline)}`));
  } catch (thrown: any) {
    error = `${thrown?.code ?? thrown?.name ?? 'Error'}: ${thrown?.message ?? String(thrown)}`
      + (thrown?.findings ? `\n      findings: ${JSON.stringify(thrown.findings)}` : '');
  } finally {
    console.log = realLog;
  }

  return {
    boundary,
    permanentTags: permanent.tags,
    permanentModalities: permanent.conditioningModalities,
    activeTags: active.tags,
    activeModalities: active.conditioningModalities,
    equipmentFacts,
    observation: observations[0] ?? null,
    visible,
    anchors,
    error,
    removalLog,
    constraintPass: [...constraintPass],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// THE REPORT
// ═══════════════════════════════════════════════════════════════════════════

function renderBoundary(result: BoundaryResult): string {
  const out: string[] = [];
  const o = result.observation;
  out.push(`## ${result.boundary.id} — ${result.boundary.title}`);
  out.push('');
  out.push(`today: \`${result.boundary.todayISO}\` · week Monday: \`${result.boundary.weekMondayISO}\``
    + ` · block ${result.boundary.blockNumber} from \`${result.boundary.blockStartISO}\``);
  out.push('');
  out.push('### 1. PERMANENT equipment profile');
  out.push(`\`\`\`\ntags (${result.permanentTags.length}): ${result.permanentTags.join(', ')}`);
  out.push(`machines (${result.permanentModalities.length}): ${result.permanentModalities.join(', ') || '(none)'}\n\`\`\``);
  out.push('### 2. TEMPORARY equipment fact and dates');
  if (result.equipmentFacts.length === 0) out.push('_none_');
  else {
    out.push('```');
    for (const fact of result.equipmentFacts) {
      out.push(`${fact.kind}  ${fact.from ?? '?'} .. ${fact.until ?? '(open)'}  removes: ${fact.tags.join(', ') || '(none)'}`);
    }
    out.push('```');
  }
  out.push('### 3. ACTIVE equipment passed to scheduler/composer');
  out.push(`\`\`\`\nresolver tags (${result.activeTags.length}): ${result.activeTags.join(', ')}`);
  out.push(`resolver machines: ${result.activeModalities.join(', ') || '(none)'}`);
  out.push(`composer kit  (${o?.kit.length ?? 0}): ${o?.kit.join(', ') ?? '(composer never ran)'}\n\`\`\``);
  out.push('### 4. BASE block exercise selection (what gets RECORDED)');
  if (!o) out.push('_composer never ran_');
  else {
    out.push('```');
    for (const sel of [...o.selections].sort((a, b) => a.slot.localeCompare(b.slot))) {
      out.push(`${sel.slot.padEnd(22)} ${sel.identity.padEnd(28)} role=${sel.role} block=${sel.blockStartISO}`);
    }
    out.push('```');
  }
  out.push('### 4b. COMPOSED ROWS, with the role §18 judges');
  if (!o) out.push('_composer never ran_');
  else {
    out.push('```');
    for (const row of o.rows) {
      out.push(`day ${row.dayOfWeek} ${row.slot.padEnd(22)} ${row.identity.padEnd(28)} role=${row.role}`);
    }
    out.push(`main_strength rows: ${o.rows.filter((r) => r.role === 'main_strength').length}`);
    out.push('```');
  }
  out.push('### 5. TEMPORARY substitutions');
  if (!o) out.push('_composer never ran_');
  else if (o.substitutions.length === 0) out.push('_none — no row carries `substitutedFor`_');
  else {
    out.push('```');
    for (const sub of o.substitutions) {
      out.push(`day ${sub.dayOfWeek} ${sub.slot.padEnd(22)} shipped=${sub.shipped.padEnd(24)} base=${sub.base} (${sub.cause})`);
    }
    out.push('```');
  }
  out.push('### 6. STORED block-selection history (input to this run)');
  if (result.boundary.selectionHistory.length === 0) out.push('_empty_');
  else {
    out.push('```');
    for (const entry of [...result.boundary.selectionHistory]
      .sort((a, b) => `${b.blockStartISO}${a.slot}`.localeCompare(`${a.blockStartISO}${b.slot}`))) {
      out.push(`${entry.blockStartISO}  ${String(entry.slot).padEnd(22)} ${entry.identity}`);
    }
    out.push('```');
  }
  out.push('### 7. VISIBLE generated exercises');
  if (result.error) out.push(`\`\`\`\n⚠ GENERATION REFUSED\n      ${result.error}\n\`\`\``);
  else if (result.visible.length === 0) out.push('_nothing projected_');
  else {
    out.push('```');
    for (const day of result.visible) {
      out.push(`${day.day}  ${day.title}`);
      for (const line of day.lines) out.push(line);
    }
    out.push('```');
  }
  out.push('### 7b. WHAT THE IN-GENERATION CONSTRAINT PASS DID TO EACH DAY');
  if (result.constraintPass.length === 0) out.push('_the pass changed nothing (or never ran)_');
  else out.push(`\`\`\`\n${result.constraintPass.join('\n')}\n\`\`\``);
  if (result.removalLog.length > 0) {
    out.push(`\`\`\`\n${[...new Set(result.removalLog)].slice(0, 12).join('\n')}\n\`\`\``);
  }
  out.push('### 8. Club / game anchors');
  out.push(result.anchors.length === 0 ? '_none visible_' : `\`\`\`\n${result.anchors.join('\n')}\n\`\`\``);
  out.push('### 9. Typed equipment gaps');
  if (!o) out.push('_composer never ran_');
  else {
    out.push('```');
    out.push(`kitUnachievablePatterns: ${o.kitUnachievablePatterns.join(', ') || '(none)'}`);
    if (o.gaps.length === 0) out.push('gaps: (none)');
    else for (const gap of o.gaps) {
      out.push(`gap day ${gap.dayOfWeek} slot=${gap.slot} cause=${gap.cause} ${gap.detail}`);
    }
    out.push('```');
  }
  out.push('');
  return out.join('\n');
}

function main(): void {
  const base = athlete();
  const trip = travelFact(TRIP_FROM, TRIP_UNTIL);

  // A dumbbells+bands hotel gym: everything else comes OFF his own list.
  const REMOVED_AWAY = [
    'barbell', 'cables', 'machine', 'bench', 'pullup_bar', 'kettlebell',
    'plyo_box', 'rack', 'trap_bar', 'swiss_ball', 'ab_wheel',
    'back_extension_bench', 'dip_bars', 'rings_trx', 'foam_roller',
  ];
  const REMOVED_MODALITIES = ['bike_erg', 'air_bike', 'row', 'ski', 'treadmill'];
  const awayKit = awayEquipmentFact({
    from: TRIP_FROM, until: TRIP_UNTIL,
    removedTags: REMOVED_AWAY, removedModalities: REMOVED_MODALITIES,
  });

  const boundaries: Boundary[] = [
    {
      id: 'B0', title: 'NORMAL — Commercial Gym athlete, no temporary change',
      profile: base, todayISO: WEEK_MONDAY, weekMondayISO: WEEK_MONDAY,
      phaseWeek: 8, blockStartISO: WEEK_MONDAY, blockNumber: 1,
      facts: [], selectionHistory: [],
    },
    {
      id: 'B1', title: 'AWAY MARKED — trip span only, normal equipment kept',
      profile: base, todayISO: WEEK_MONDAY, weekMondayISO: WEEK_MONDAY,
      phaseWeek: 8, blockStartISO: WEEK_MONDAY, blockNumber: 1,
      facts: [trip], selectionHistory: [],
    },
    {
      id: 'B2', title: 'AWAY + KIT REMOVED — dumbbells and bands only',
      profile: base, todayISO: WEEK_MONDAY, weekMondayISO: WEEK_MONDAY,
      phaseWeek: 8, blockStartISO: WEEK_MONDAY, blockNumber: 1,
      facts: [trip, awayKit], selectionHistory: [],
    },
    {
      id: 'B3', title: 'BOOT DURING THE TRIP — same facts, today is inside the span',
      profile: base, todayISO: '2026-08-14', weekMondayISO: WEEK_MONDAY,
      phaseWeek: 8, blockStartISO: WEEK_MONDAY, blockNumber: 1,
      facts: [trip, awayKit], selectionHistory: [],
    },
    {
      id: 'B4', title: 'RETURN-DATE BOOT — today is the return date, the span is over',
      profile: base, todayISO: RETURN_DATE, weekMondayISO: RETURN_DATE,
      phaseWeek: 9, blockStartISO: WEEK_MONDAY, blockNumber: 1,
      facts: [trip, awayKit], selectionHistory: [],
    },
    {
      id: 'B5', title: 'NEXT BLOCK AFTER RETURNING — block 2, trip long expired',
      profile: base, todayISO: NEXT_BLOCK_MONDAY, weekMondayISO: NEXT_BLOCK_MONDAY,
      phaseWeek: 12, blockStartISO: NEXT_BLOCK_MONDAY, blockNumber: 2,
      facts: [trip, awayKit], selectionHistory: [],
    },
    // ── THE CONTROL THAT ISOLATES THE DATE ARGUMENT ─────────────────────────
    // Same removal, same athlete, same week — but the span STARTS ON THE WEEK'S
    // OWN MONDAY. If the composer sees the kit here and not in B2/B3, the
    // boundary is the single date the kit is resolved at, not the fact.
    {
      id: 'B6', title: 'CONTROL — identical removal, span starts on the week Monday',
      profile: base, todayISO: WEEK_MONDAY, weekMondayISO: WEEK_MONDAY,
      phaseWeek: 8, blockStartISO: WEEK_MONDAY, blockNumber: 1,
      facts: [
        travelFact(WEEK_MONDAY, '2026-08-16'),
        awayEquipmentFact({
          from: WEEK_MONDAY, until: '2026-08-16',
          removedTags: REMOVED_AWAY, removedModalities: REMOVED_MODALITIES,
        }),
      ],
      selectionHistory: [],
    },
    // ── ISOLATING WHAT DESTROYS THE MAIN LIFTS ─────────────────────────────
    // B6 refuses with "no hinge / no push / no pull" while its composer emitted
    // four main-strength rows covering exactly those patterns. Two controls,
    // each dropping ONE of B6's two facts.
    {
      id: 'B7', title: 'CONTROL — kit removal ONLY, no travel fact',
      profile: base, todayISO: WEEK_MONDAY, weekMondayISO: WEEK_MONDAY,
      phaseWeek: 8, blockStartISO: WEEK_MONDAY, blockNumber: 1,
      facts: [awayEquipmentFact({
        from: WEEK_MONDAY, until: '2026-08-16',
        removedTags: REMOVED_AWAY, removedModalities: REMOVED_MODALITIES,
      })],
      selectionHistory: [],
    },
    {
      id: 'B8', title: 'CONTROL — travel fact ONLY, full kit kept',
      profile: base, todayISO: WEEK_MONDAY, weekMondayISO: WEEK_MONDAY,
      phaseWeek: 8, blockStartISO: WEEK_MONDAY, blockNumber: 1,
      facts: [travelFact(WEEK_MONDAY, '2026-08-16')],
      selectionHistory: [],
    },
  ];

  const results: BoundaryResult[] = [];
  // B0 authors block 1's history; every later boundary is fed WHAT B0 RECORDED,
  // which is what the live store would hold on the morning he leaves.
  let history: BlockExerciseSelection[] = [];
  for (const boundary of boundaries) {
    const result = runBoundary({ ...boundary, selectionHistory: history });
    results.push(result);
    if (boundary.id === 'B0' && result.observation) {
      history = result.observation.selections.map((sel) => ({
        blockNumber: 1,
        blockStartISO: sel.blockStartISO,
        slot: sel.slot,
        group: null,
        role: sel.role,
        identity: sel.identity,
      })) as unknown as BlockExerciseSelection[];
    }
  }

  const page: string[] = [];
  page.push('# EQUIPMENT SCOPES — THE BOUNDARY TRACE');
  page.push('');
  page.push('Generated by `npm run trace:equipment-scopes`. Every number below was');
  page.push('produced by the run that wrote this file; nothing is recalled.');
  page.push('');
  for (const result of results) page.push(renderBoundary(result));

  // ── THE COMPARISON THAT NAMES THE BOUNDARY ────────────────────────────────
  page.push('## THE DIFF THAT MATTERS — base selection, B0 vs each boundary');
  page.push('');
  page.push('```');
  const b0 = results[0].observation;
  for (const result of results.slice(1)) {
    const o = result.observation;
    if (!b0 || !o) { page.push(`${result.boundary.id}: composer never ran`); continue; }
    const changed = o.selections.filter((sel) => {
      const before = b0.selections.find((entry) => entry.slot === sel.slot);
      return before && before.identity !== sel.identity;
    });
    const lost = b0.selections.filter((sel) => !o.selections.some((e) => e.slot === sel.slot));
    page.push(`${result.boundary.id}: ${changed.length} slot(s) RECORD a different base, ${lost.length} slot(s) lost`);
    for (const sel of changed) {
      const before = b0.selections.find((entry) => entry.slot === sel.slot);
      page.push(`    ${sel.slot.padEnd(22)} ${before?.identity} -> ${sel.identity}`);
    }
    for (const sel of lost) page.push(`    ${sel.slot.padEnd(22)} ${sel.identity} -> (slot gone)`);
  }
  page.push('```');

  const dir = resolve(__dirname, '..', 'docs');
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, 'EQUIPMENT_SCOPE_TRACE_2026-08-17.md');
  writeFileSync(path, `${page.join('\n')}\n`, 'utf8');
  // eslint-disable-next-line no-console
  console.log(page.join('\n'));
  // eslint-disable-next-line no-console
  console.log(`\nwritten: ${path}`);
}

if (require.main === module) main();
