/**
 * CAPACITY AT THE RENDER SEAM — render never throws.
 *
 * Device crash (Sam, 2026-07-30): `MissingCapacityAnswerError` thrown during
 * RENDER on app launch, blocking the device re-check entirely.
 *
 * WHAT THE DIAGNOSIS FOUND, so the fix is not read as agreeing with a guess:
 *
 *   * Current onboarding does NOT store labels the rubric cannot read. Both
 *     capture screens commit the enum `id` (`Good`, `Very consistent`); the
 *     Review screen's "Solid" is `reviewRows.formatConditioning`'s DISPLAY
 *     label for the stored `Good`. `ConditioningLevel` and `RecentTrainingLoad`
 *     are byte-identical to their first commit, so there is no legacy
 *     vocabulary either. A fresh athlete is not at risk from value drift.
 *   * What changed is the TOLERANCE, not the data. Until 784d74b (2026-07-28)
 *     `deriveProfileReadiness` carried two silent absorbers — a `seasonPhase`
 *     guard and `catch { return 'medium' }`. A profile missing a capacity
 *     answer scored a confident 'medium' for months. The fail-loud rewrite
 *     turned that latent gap into a render crash.
 *   * The fail-loud landed at the wrong seam. `scoreCapacity` refusing is
 *     correct and stays; `useSchedule` calling it during render is not.
 *
 * Sam's ruling: render never throws. Unscoreable capacity refuses at the
 * scoring/generation boundary and surfaces disclosure-plus-repair like the
 * season-phase skew, with the athlete routed to re-answer. The bodyweight
 * precedent is the law — refuse gracefully, prescribe nothing.
 *
 * Run: npm run test:capacity-render-safety
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
const localStorageData = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => localStorageData.get(key) ?? null,
    setItem: (key: string, value: string) => { localStorageData.set(key, value); },
    removeItem: (key: string) => { localStorageData.delete(key); },
    clear: () => { localStorageData.clear(); },
  },
};
process.env.TZ = 'Australia/Melbourne';


import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import { readFileSync } from 'fs';
import { join } from 'path';
import type { OnboardingData } from '../types/domain';
import {
  MissingCapacityAnswerError,
  capacityFor,
  scoreCapacity,
} from '../data/capacityRubric';
import {
  deriveProfileReadiness,
  profileCapacityBandOrNull,
} from '../utils/readiness';
import {
  capacityAnswerGap,
  capacityAnswerGapMessage,
} from '../utils/capacityAnswerGap';
import { resolveOnboardingResumeStep } from '../utils/onboardingSteps';
import { assessOnboardingCompleteness } from '../utils/onboardingCompleteness';
import { DEV_E2E_STANDARD_PROFILE } from '../dev/e2e/devE2EStandardProfile';
import { useProfileStore } from '../store/profileStore';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function run(name: string, body: () => void): void {
  try {
    body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failed += 1;
    failures.push(name);
    console.error(`  FAIL ${name}`, error instanceof Error ? error.message : error);
  }
}

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}


/**
 * A profile that satisfies EVERY answerable step, derived from the registry so
 * a new onboarding question cannot silently make these fixtures incomplete.
 */
function fullyAnsweredProfile(): OnboardingData {
  const profile = { ...(DEV_E2E_STANDARD_PROFILE as object) } as OnboardingData;
  const assessment = assessOnboardingCompleteness(profile);
  if (assessment.complete) return profile;
  // The standard dev profile omits the 2km time trial, whose "answer" is the
  // field being present at all (`seconds: null` is a real answer).
  return { ...(profile as object), twoKmTimeTrial: { seconds: null } } as OnboardingData;
}

const COMPLETE = {
  seasonPhase: 'In-season',
  conditioningLevel: 'Good',
  recentTrainingLoad: 'Very consistent',
} as unknown as OnboardingData;

/** Every shape that reached the crash, including the store's own default. */
const UNSCOREABLE: Array<{ why: string; profile: OnboardingData | null }> = [
  { why: 'no conditioning answer', profile: { seasonPhase: 'In-season', recentTrainingLoad: 'A bit' } as never },
  { why: 'no training-load answer', profile: { seasonPhase: 'In-season', conditioningLevel: 'Good' } as never },
  { why: 'neither answer', profile: {} as never },
  { why: 'no profile at all', profile: null },
  // The display label, stored. Current onboarding cannot produce this — pinned
  // so that if a screen ever starts committing its own copy, the app degrades
  // to the disclosure instead of crashing.
  { why: 'a display label stored as the value', profile: { conditioningLevel: 'Solid', recentTrainingLoad: 'Consistent' } as never },
];

console.log('\n-- Capacity at the render seam --');

// ── Render never throws ──────────────────────────────────────────────────

for (const shape of UNSCOREABLE) {
  run(`the render accessor answers null, never throws (${shape.why})`, () => {
    let threw: unknown = null;
    let value: unknown = 'unset';
    try {
      value = profileCapacityBandOrNull(shape.profile);
    } catch (error) {
      threw = error;
    }
    assert(threw === null, `render accessor threw: ${String(threw)}`);
    assert(value === null, `render accessor invented a tier: ${String(value)}`);
  });
}

run('a scoreable profile still gets its real band from the render accessor', () => {
  assert(profileCapacityBandOrNull(COMPLETE) === 'high',
    `complete profile scored ${String(profileCapacityBandOrNull(COMPLETE))}, expected high`);
});

run('the schedule state builds for an unscoreable profile instead of throwing', () => {
  const prior = useProfileStore.getState();
  try {
    useProfileStore.setState({ onboardingData: {} as never, isOnboardingComplete: true } as never);
    let threw: unknown = null;
    try {
      buildScheduleStateImperative();
    } catch (error) {
      threw = error;
    }
    assert(threw === null,
      `building schedule state threw for an unscoreable profile: ${String(threw)}`);
  } finally {
    useProfileStore.setState(prior as never);
  }
});

run("the store's own initial profile does not crash the render seam", () => {
  // A fresh install carries `initialOnboardingData` — trainingLocation and
  // equipment only. This is the shape that made ANY screen calling useSchedule
  // crash before onboarding finished, which is a far wider blast radius than
  // one athlete's stored profile.
  const fresh = useProfileStore.getState().onboardingData;
  assert(fresh.conditioningLevel === undefined && fresh.recentTrainingLoad === undefined,
    'the initial profile now carries capacity answers — this test no longer covers the case');
  let threw: unknown = null;
  try {
    profileCapacityBandOrNull(fresh);
  } catch (error) {
    threw = error;
  }
  assert(threw === null, `the initial profile threw at the render seam: ${String(threw)}`);
});

// ── The scoring/generation boundary still refuses loudly ─────────────────

run('scoreCapacity still refuses — the fail-loud moved seam, it did not soften', () => {
  let threw: unknown = null;
  try {
    scoreCapacity(undefined, 'Good');
  } catch (error) {
    threw = error;
  }
  assert(threw instanceof MissingCapacityAnswerError,
    `scoreCapacity stopped refusing: ${String(threw)}`);
});

run('capacityFor still refuses, so prescribers cannot silently get a tier', () => {
  let threw: unknown = null;
  try {
    capacityFor('A bit', undefined);
  } catch (error) {
    threw = error;
  }
  assert(threw instanceof MissingCapacityAnswerError,
    `capacityFor stopped refusing: ${String(threw)}`);
});

run('deriveProfileReadiness — the generation-side accessor — still refuses', () => {
  let threw: unknown = null;
  try {
    deriveProfileReadiness({} as never);
  } catch (error) {
    threw = error;
  }
  assert(threw instanceof MissingCapacityAnswerError,
    'the generation accessor stopped refusing; prescription would resume on a guess');
});

// ── Disclosure and repair ────────────────────────────────────────────────

run('the gap names the two questions in plain language, never a field name', () => {
  const gap = capacityAnswerGap({} as never);
  assert(gap, 'no gap reported for a profile with neither answer');
  const message = capacityAnswerGapMessage(gap);
  assert(message.length > 0, 'gap produced no message');
  assert(!/_/.test(message) && !/conditioningLevel|recentTrainingLoad/.test(message),
    `disclosure leaked a field name or code: "${message}"`);
  assert(/conditioning/i.test(message) && /training/i.test(message),
    `disclosure does not name both missing answers: "${message}"`);
});

run('a scoreable profile reports no gap', () => {
  assert(capacityAnswerGap(COMPLETE) === null,
    'a complete profile was reported as having a capacity gap');
});

run('the repair routes the athlete at the step that owns the missing answer', () => {
  // A genuinely complete profile with ONLY the conditioning answer removed —
  // built from the step registry itself so it cannot drift as steps are added.
  // A hand-written near-complete fixture routes to whichever earlier question
  // it happens to omit, which would make this assertion about the fixture
  // rather than about the repair.
  const answered = fullyAnsweredProfile();
  const gapped = { ...(answered as object), conditioningLevel: undefined } as OnboardingData;
  const gap = capacityAnswerGap(gapped);
  assert(gap, 'no gap for a profile missing conditioning');
  assert(gap.resumeStep === 'ConditioningLevel',
    `repair routes to ${gap.resumeStep}, not the step that owns the answer`);
  // The gap and the navigator must read the same owner, or the athlete is sent
  // somewhere the navigator will not open.
  assert(resolveOnboardingResumeStep(gapped) === gap.resumeStep,
    'the gap and the onboarding resume owner disagree about where to send the athlete');
  assert(gap.missingAnswers.length === 1,
    `disclosure named ${gap.missingAnswers.length} answers when one is missing`);
});

run('the repair routes to the training-load step when that is the gap', () => {
  const gapped = {
    ...(fullyAnsweredProfile() as object), recentTrainingLoad: undefined,
  } as OnboardingData;
  const gap = capacityAnswerGap(gapped);
  assert(gap && gap.resumeStep === 'RecentTrainingLoad',
    `repair routes to ${gap?.resumeStep}, not the training-load step`);
});

// ── The surface renders it, like the season-phase skew ───────────────────

/**
 * REVERTED (Sam, 2026-07-30). This used to assert that HomeScreenV2 rendered a
 * capacity-gap card with a repair action. The repair reopened onboarding, and
 * completing onboarding a SECOND time armed the profile compatibility mirror
 * against a stale accepted snapshot — which replaced the athlete's whole
 * profile with it, costing `seasonPhase` and every other answer on Sam's
 * device. A card whose action can cost answers is worse than no card.
 *
 * The assertion is INVERTED rather than deleted: until repair is non-destructive
 * by construction, no surface may offer one, and that boundary should fail
 * loudly if someone re-adds the card before the mirror is fixed.
 */
run('no surface offers a capacity repair while repair can still cost answers', () => {
  const home = readFileSync(
    join(__dirname, '..', 'screens', 'home', 'HomeScreenV2.tsx'),
    'utf8',
  );
  assert(!/home-capacity-answer-gap/.test(home),
    'HomeScreenV2 offers a capacity repair again — the mirror fix must land first');
  const profileStore = readFileSync(
    join(__dirname, '..', 'store', 'profileStore.ts'),
    'utf8',
  );
  assert(!/reopenOnboardingForRepair/.test(profileStore),
    'the onboarding-reopen action is back before repair is non-destructive');
});

console.log(`\nCapacity render safety totals: ${passed} passed, ${failed} failed`);
totalsPrinted(failed);
if (failed > 0) {
  console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
