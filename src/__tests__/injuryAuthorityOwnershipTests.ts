/**
 * STAGE 2a — INJURY AUTHORITY OWNERSHIP (region-scoped anchor participation).
 *
 * Sam's D10 ruling, recorded in Addendum A of
 * `docs/DURABLE_ATHLETE_STATE_FACT_OWNERSHIP_REASSESSMENT_2026-07-24.md`:
 *
 *   > an injury never silently withdraws team-training/game conditioning-sprint
 *   > credit; affected-region work pauses per the Bible bands; injuries at every
 *   > severity become recordable.
 *
 * What rider 0 established (`docs/investigations/RIDER0_INJURY_AUTHORITY_AT_THE_GATE_2026-07-24.md`):
 * the §18 gate never ignored anything. `applyGenerationSafetyToSection18Contract`
 * demotes EVERY anchor to `modified` as soon as any main-strength pattern is
 * prohibited, which zeroes their conditioning and sprint production claim — and
 * it authors a matching typed reduction for strength, and for sprint on a
 * lower-body injury, but NEVER for conditioning, in any branch. The contract
 * handed to the gate therefore asserts both "these anchors no longer produce
 * conditioning" and "this week requires 3 conditioning exposures". It is
 * unsatisfiable before the gate runs, and because the fact and the week commit
 * in one transaction, the unsatisfiable week takes the athlete's injury report
 * down with it. Measured: EVERY injury from 6/10 up, in either region, is
 * rejected and records nothing.
 *
 * Run: npm run test:injury-authority
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
const memory = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value); },
    removeItem: (key: string) => { memory.delete(key); },
    clear: () => { memory.clear(); },
  },
};
process.env.TZ = 'Australia/Melbourne';

import { useProgramStore } from '../store/programStore';
import { normalizeAcceptedMaterialContext } from '../store/acceptedStateColdStart';
import { executeProgramControlActionDurably } from '../utils/programControlActions';
import {
  buildGuidedInjuryConstraint,
  type GuidedInjuryRegion,
} from '../utils/guidedInjuryControl';
import { applyGenerationSafetyToSection18Contract } from '../rules/section18SafetyPolicy';
import { rebaseAcceptedEffectiveWeek } from '../rules/acceptedEffectiveWeek';
import { useProfileStore } from '../store/profileStore';
import {
  SPENT_TODAY,
  SPENT_WEEK_1,
  acceptedWeek,
  markSpentDaysDone,
  quietAsync,
  runScenariosForked,
  seedSpentWeekFriday,
} from './spentWeekFridayTestSupport';

let passes = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

interface Scenario { id: string; name: string; body: () => Promise<void> }
const scenarios: Scenario[] = [];
function scenario(id: string, name: string, body: () => Promise<void>): void {
  scenarios.push({ id, name, body });
}

async function run(name: string, body: () => Promise<void>): Promise<void> {
  try { await body(); passes += 1; console.log(`  PASS [invariant] ${name}`); }
  catch (error) { failures.push(name); console.error(`  FAIL [invariant] ${name}: ${(error as Error).message}`); }
}

const AREA_FOR_REGION: Record<GuidedInjuryRegion, string> = {
  upper_body: 'Shoulder',
  lower_body: 'Hamstring',
  back_midline: 'Lower back',
  other: 'Other',
};

async function reportInjury(region: GuidedInjuryRegion, severity: number) {
  const constraint = buildGuidedInjuryConstraint({
    region,
    area: AREA_FOR_REGION[region],
    severity,
    severityBand: severity >= 8 ? 'avoid' : severity >= 6 ? 'moderate' : severity >= 4 ? 'slight' : 'mild',
    adjustmentLevel: severity >= 8 ? 'training_paused' : severity >= 6 ? 'moderate' : severity >= 4 ? 'slight' : 'minimal',
    triggers: region === 'upper_body' ? ['Pressing'] : ['Sprinting'],
    seriousSymptoms: false,
  }, { todayISO: SPENT_TODAY });
  return quietAsync(() => executeProgramControlActionDurably({
    type: 'set_injury_modifier',
    source: { screen: 'program_tab', surface: 'guided_injury_flow', initiatedBy: 'tap' },
    scope: 'current_and_future',
    payload: { constraint },
    requiresRebuild: false,
    createsActiveModifier: true,
    oneOffOnly: false,
  } as never, { todayISO: SPENT_TODAY }), !!process.env.INJURY_LOUD);
}

function recordedState() {
  const accepted = normalizeAcceptedMaterialContext(
    useProgramStore.getState().acceptedMaterialContext);
  return {
    activeInjury: accepted.activeInjury,
    episodes: accepted.injuryEpisodes.length,
    facts: accepted.temporarySourceFacts.length,
  };
}

function currentWeekContract() {
  const state = useProgramStore.getState();
  return rebaseAcceptedEffectiveWeek({
    surfaces: state as never,
    weekStart: SPENT_WEEK_1,
    profile: useProfileStore.getState().onboardingData,
    markedDays: state.acceptedMaterialContext.markedDays,
  }).contract;
}

function registerScenarios(): void {
  // ── I1 — the headline. An upper-body 8/10 must be RECORDED. Nothing about
  // an athlete telling the app their shoulder is badly hurt is conditional on
  // the app's ability to produce an admissible week from it.
  scenario('i1', 'I1 an upper-body 8-10/10 injury is recorded (fact, episode and activeInjury)', async () => {
    seedSpentWeekFriday();
    await markSpentDaysDone();
    const result = await reportInjury('upper_body', 9);
    assert((result as { ok?: boolean }).ok === true,
      `the injury was rejected: "${(result as { message?: string }).message}"`);
    const state = recordedState();
    assert(state.activeInjury, 'activeInjury is null — the app has no memory that the athlete is hurt');
    assert(state.episodes === 1, `expected 1 injury episode, found ${state.episodes}`);
    assert(state.facts >= 1, `expected a durable injury fact, found ${state.facts}`);
  });

  // ── I2 — region scoping. Sam's ruling in one assertion: a shoulder does not
  // stop someone running. The team trainings and the game keep normal
  // participation, so their conditioning and sprint credit survives, and the
  // week stays admissible without any gate exception. This is the invariant
  // that makes I1 possible rather than a symptom fix on top of it.
  scenario('i2', 'I2 an upper-body injury does not withdraw team-training or game conditioning/sprint credit', async () => {
    seedSpentWeekFriday();
    await markSpentDaysDone();
    const before = currentWeekContract();
    const beforeNormal = before.anchors.filter((a) => a.participation === 'normal_unrestricted').length;
    assert(beforeNormal === before.anchors.length && before.anchors.length > 0,
      'the seed did not start with every anchor at normal participation');

    const result = await reportInjury('upper_body', 9);
    assert((result as { ok?: boolean }).ok === true,
      `the injury was rejected: "${(result as { message?: string }).message}"`);

    const after = currentWeekContract();
    const withdrawn = after.anchors.filter((anchor) =>
      anchor.currentProductionClaim.conditioning === false ||
      anchor.currentProductionClaim.sprintHighSpeed === false);
    assert(withdrawn.length === 0,
      `an upper-body injury withdrew field credit from ${withdrawn.length} anchor(s): ` +
      withdrawn.map((a) => `${a.kind}@${a.dayOfWeek}:${a.participation}`).join(', '));

    // And the affected region IS restricted — region scoping must not become
    // "the injury changes nothing". Asserted against the safety policy, which is
    // the owner Stage 2a changed. Whether the restriction then reaches the
    // athlete's visible week is materialisation, pinned separately by I6.
    const policy = applyGenerationSafetyToSection18Contract({
      contract: JSON.parse(JSON.stringify(before)),
      generationConstraints: {
        injuries: [{
          region: 'upper_body', injuryKeys: ['shoulder'], severity: 9, effectiveSeverity: 9,
          pauseAffectedTraining: true, removeRiskyWork: true,
        }],
      } as never,
    });
    const prohibited = policy.strengthPatterns.prohibitedPatterns ?? [];
    assert(prohibited.includes('push') && prohibited.includes('pull'),
      `an 8-10/10 upper-body injury did not prohibit push/pull (got ${JSON.stringify(prohibited)})`);
    assert(!prohibited.includes('squat') && !prohibited.includes('hinge'),
      `an upper-body injury prohibited lower-body patterns (got ${JSON.stringify(prohibited)})`);
  });

  // ── I6 — MATERIALISATION. RED and quarantined by Sam's sequencing: the
  // committed week must actually stop prescribing the affected work.
  //
  // Stage 2a makes the injury RECORDABLE, which is what the ruling asked for and
  // is the difference between the app knowing the athlete is hurt and not. It
  // does not make the injury VISIBLE: the injury path validates the existing
  // base against a stricter contract and never re-authors content, so the
  // shoulder-injured athlete's Monday pressing session is still on screen. That
  // is rider 0's divergence 3, and it is the same missing owner as the
  // partly-spent week in Stage 1's T4 — both are answered by the §18
  // elapsed-week / materialisation reassessment, not by another line here.
  scenario('i6', 'I6 [QUARANTINED] the committed week for an upper-body 8-10/10 stops prescribing push/pull', async () => {
    seedSpentWeekFriday();
    await markSpentDaysDone();
    const result = await reportInjury('upper_body', 9);
    assert((result as { ok?: boolean }).ok === true,
      `the injury was rejected: "${(result as { message?: string }).message}"`);
    const prohibited = currentWeekContract().strengthPatterns.prohibitedPatterns ?? [];
    assert(prohibited.includes('push') && prohibited.includes('pull'),
      `the committed week carries no push/pull prohibition (got ${JSON.stringify(prohibited)}) — ` +
      'the injury was recorded but the week was never re-authored');
  });

  // ── I3 — the whole matrix. The trigger was never the severity band: it is
  // "any injury that prohibits a main-strength pattern", i.e. >=6/10 in any
  // region. Pinning every cell is what stops the fix being tuned to 8-10.
  for (const region of ['upper_body', 'lower_body', 'back_midline'] as const) {
    for (const severity of [2, 5, 7, 9]) {
      scenario(`i3-${region}-${severity}`,
        `I3 ${region} ${severity}/10 is recorded`, async () => {
          seedSpentWeekFriday();
          await markSpentDaysDone();
          const result = await reportInjury(region, severity);
          assert((result as { ok?: boolean }).ok === true,
            `${region} ${severity}/10 was rejected: "${(result as { message?: string }).message}"`);
          const state = recordedState();
          assert(state.activeInjury && state.episodes === 1,
            `${region} ${severity}/10 committed but recorded nothing (activeInjury=${!!state.activeInjury}, episodes=${state.episodes})`);
        });
    }
  }

  // ── I4 — B4, as restated in Addendum A. Withdrawing production credit and
  // authorising the matching typed reduction are ONE decision. No contract may
  // reach the gate claiming both "this no longer produces X" and "this week
  // requires X" — that is unsatisfiable by construction, and it is precisely
  // what destroyed the athlete's injury report.
  //
  // Behavioural, not a source scan: it drives the real safety policy across the
  // injury matrix and inspects the contract it produces, so it holds however the
  // implementation is refactored.
  scenario('i4', 'I4 no contract withdraws anchor credit for a domain without authorising a reduction in it', async () => {
    seedSpentWeekFriday();
    await markSpentDaysDone();
    const baseline = currentWeekContract();
    const offenders: string[] = [];

    for (const region of ['upper_body', 'lower_body', 'back_midline'] as const) {
      for (const severity of [2, 5, 7, 9]) {
        const contract = applyGenerationSafetyToSection18Contract({
          contract: JSON.parse(JSON.stringify(baseline)),
          generationConstraints: {
            injuries: [{
              region,
              injuryKeys: [],
              severity,
              effectiveSeverity: severity,
              pauseAffectedTraining: severity >= 8,
              removeRiskyWork: severity >= 6,
            }],
          } as never,
        });
        const claims = (domain: 'conditioning' | 'sprintHighSpeed') =>
          contract.anchors.filter((anchor) => anchor.currentProductionClaim[domain] === false).length;
        const authorised = (metric: string) =>
          contract.authorisedReductions.some((reduction) => reduction.metric === metric);

        if (claims('conditioning') > 0 && !authorised('conditioning_core_frequency')) {
          offenders.push(`${region}/${severity}: ${claims('conditioning')} anchor(s) lost conditioning credit with no conditioning_core_frequency reduction`);
        }
        if (claims('sprintHighSpeed') > 0 && !authorised('sprint_high_speed_frequency')) {
          offenders.push(`${region}/${severity}: ${claims('sprintHighSpeed')} anchor(s) lost sprint credit with no sprint_high_speed_frequency reduction`);
        }
      }
    }
    assert(offenders.length === 0,
      `${offenders.length} unsatisfiable contract(s):\n    ${offenders.join('\n    ')}`);
  });

  // ── I5 — the week the athlete is left with must actually be admissible, and
  // it must still be an in-season week rather than something the gate salvaged.
  // I1 could in principle be satisfied by a week that limps; this says it does
  // not.
  scenario('i5', 'I5 the week after an upper-body 8-10/10 injury is admissible with no blocking violations', async () => {
    seedSpentWeekFriday();
    await markSpentDaysDone();
    const result = await reportInjury('upper_body', 9);
    assert((result as { ok?: boolean }).ok === true,
      `the injury was rejected: "${(result as { message?: string }).message}"`);
    const week = acceptedWeek(SPENT_WEEK_1);
    assert(week.blockingViolations.length === 0,
      `the accepted week carries ${week.blockingViolations.length} blocking violation(s): ${week.blockingViolations.join('  ')}`);
  });
}

async function runOne(id: string): Promise<void> {
  registerScenarios();
  const target = scenarios.find((entry) => entry.id === id);
  if (!target) { console.error(`unknown scenario id: ${id}`); process.exit(2); }
  await run(target.name, target.body);
  if (failures.length > 0) process.exit(1);
}

async function main(): Promise<void> {
  const only = process.env.INJURY_ONLY;
  if (only) { await runOne(only); return; }
  registerScenarios();
  runScenariosForked({
    title: 'Stage 2a: injury authority ownership (region-scoped anchor participation)',
    scenarioIds: scenarios.map((entry) => entry.id),
    envVar: 'INJURY_ONLY',
    filename: __filename,
  });
}

main().catch((error) => { console.error(error); process.exit(1); });
