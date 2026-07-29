/**
 * THE MIRROR MAY ONLY NARROW TOWARD THE ACCEPTED TRUTH, NEVER WIDEN A GAP.
 *
 * Sam's law (2026-07-30): the athlete's live answers outrank any stored
 * snapshot. This is the same ownership law as athlete-placed content outranking
 * derived filler (`rules/athletePlacement.ts`), applied to the profile — a
 * snapshot is a record of what was accepted, not a licence to un-answer a
 * question the athlete answered.
 *
 * THE DEFECT, which is pre-existing on main and needs none of the capacity
 * work to reproduce: `useProfileStore.subscribe` replaces `onboardingData`
 * WHOLE with the accepted snapshot. The 2026-07-24 reassessment scoped WHEN the
 * fence runs (post-completion only) but never constrained WHAT it replaces. So
 * an armed mirror with a stale or impoverished snapshot collapses the profile on
 * the next ordinary edit — on Sam's device, 28 answers down to 2, taking
 * `seasonPhase` with it and leaving generation refusing "onboarding never
 * collected seasonPhase".
 *
 * A snapshot LESS COMPLETE than the live profile is a corrupt record. It must
 * never publish, and the refusal is disclosed rather than silent.
 *
 * Run: npm run test:profile-mirror-narrowing
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

import type { OnboardingData } from '../types/domain';
import { useProfileStore } from '../store/profileStore';
import {
  profileMirrorPublicationRefusal,
  recentProfileMirrorRefusals,
  clearProfileMirrorRefusals,
} from '../rules/profileMirrorNarrowing';
import {
  IMPOVERISHED_SNAPSHOT,
  fullyAnsweredProfile,
  liveAnswerCount,
  liveProfile,
  seedArmedMirrorDevice,
} from './support/armedMirrorDeviceFixture';

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

console.log('\n-- Profile mirror narrowing --');

// ── The reported wipe ────────────────────────────────────────────────────

run('an ordinary edit against an impoverished snapshot does not wipe the profile', () => {
  seedArmedMirrorDevice({ snapshot: IMPOVERISHED_SNAPSHOT });
  const before = liveAnswerCount();
  assert(before > 20, `fixture is not device-shaped: only ${before} answers`);

  // The most ordinary thing an athlete can do after onboarding.
  useProfileStore.getState().updateOnboardingData({ trainingDaysPerWeek: 4 } as never);

  const after = liveAnswerCount();
  assert(after >= before,
    `the mirror dropped answers: ${before} -> ${after}`);
  assert(liveProfile().seasonPhase === 'In-season',
    `seasonPhase was replaced away (now ${JSON.stringify(liveProfile().seasonPhase)})`);
  assert(liveProfile().trainingDaysPerWeek === 4,
    "the athlete's own edit did not survive");
});

run('the refusal is recorded, not silent', () => {
  clearProfileMirrorRefusals();
  seedArmedMirrorDevice({ snapshot: IMPOVERISHED_SNAPSHOT });
  useProfileStore.getState().updateOnboardingData({ trainingDaysPerWeek: 4 } as never);

  const refusals = recentProfileMirrorRefusals();
  assert(refusals.length > 0, 'the mirror refused silently — nothing was recorded');
  const latest = refusals[refusals.length - 1];
  assert(latest.reason === 'snapshot_would_widen_gap',
    `unexpected refusal reason ${latest.reason}`);
  assert(latest.droppedAnswers.includes('seasonPhase'),
    `refusal did not name the answers at risk: ${latest.droppedAnswers.join(', ')}`);
});

// ── It must still narrow toward the accepted truth ───────────────────────

run('the mirror still publishes when the snapshot is equally complete', () => {
  // A coach edit changed an accepted VALUE. Nothing is un-answered, so the
  // accepted truth wins — that is the mirror doing its job, and a fix that
  // stopped this would be a different defect wearing the same fix.
  const answered = fullyAnsweredProfile();
  seedArmedMirrorDevice({
    profile: answered,
    snapshot: { ...(answered as object), trainingDaysPerWeek: 3 } as Partial<OnboardingData>,
  });
  useProfileStore.getState().updateOnboardingData({ position: 'winger' } as never);

  assert(liveProfile().trainingDaysPerWeek === 3,
    `the mirror stopped narrowing toward accepted truth: trainingDaysPerWeek=${
      String(liveProfile().trainingDaysPerWeek)}`);
});

run('a snapshot that only CHANGES answers is not a refusal', () => {
  clearProfileMirrorRefusals();
  const answered = fullyAnsweredProfile();
  seedArmedMirrorDevice({
    profile: answered,
    snapshot: { ...(answered as object), conditioningLevel: 'Average' } as Partial<OnboardingData>,
  });
  useProfileStore.getState().updateOnboardingData({ position: 'winger' } as never);
  assert(recentProfileMirrorRefusals().length === 0,
    'a value change was misread as widening a gap');
});

// ── The rule itself, in both directions ──────────────────────────────────

run('the rule names exactly the answers a snapshot would drop', () => {
  const live = fullyAnsweredProfile();
  const canonical = { ...(live as object) } as Record<string, unknown>;
  delete canonical.seasonPhase;
  delete canonical.conditioningLevel;
  const refusal = profileMirrorPublicationRefusal({
    live,
    canonical: canonical as OnboardingData,
  });
  assert(refusal, 'the rule allowed a snapshot that drops two answers');
  assert(refusal.droppedAnswers.slice().sort().join(',') === 'conditioningLevel,seasonPhase',
    `named ${refusal.droppedAnswers.join(', ')}`);
});

run('the rule permits an identical snapshot and a value-changed one', () => {
  const live = fullyAnsweredProfile();
  assert(profileMirrorPublicationRefusal({ live, canonical: live }) === null,
    'an identical snapshot was refused');
  assert(profileMirrorPublicationRefusal({
    live,
    canonical: { ...(live as object), position: 'winger' } as unknown as OnboardingData,
  }) === null, 'a value change was refused');
});

run('an EMPTY answer does not count as an answer the snapshot must keep', () => {
  // `undefined`, `null`, `''` and `[]` are absence, not content — treating them
  // as answers would refuse every legitimate publication for a profile that has
  // an optional field unset.
  const live = { ...(fullyAnsweredProfile() as object), injuries: [] } as OnboardingData;
  const canonical = { ...(live as object) } as Record<string, unknown>;
  delete canonical.injuries;
  assert(profileMirrorPublicationRefusal({ live, canonical: canonical as OnboardingData }) === null,
    'dropping an empty value was treated as widening a gap');
});

// ── Completion refuses unless the profile is generation-ready ────────────
//
// Sam's ruling #3. CompleteScreen's first completion was safe only by ACCIDENT
// of sequencing: it generates immediately before completing, so a fresh
// snapshot exists and the mirror's equality check short-circuits. The capacity
// repair reproduced completion WITHOUT that precondition and turned a latent
// wipe into a reliable one. The precondition is now an explicit invariant on
// the store action itself, so it holds for every caller including ones that do
// not exist yet.

run('completion refuses when the profile cannot be scored', () => {
  const answered = fullyAnsweredProfile();
  const gapped = { ...(answered as object) } as Record<string, unknown>;
  delete gapped.recentTrainingLoad;
  seedArmedMirrorDevice({ liveProfile: gapped as OnboardingData, snapshot: gapped as never });
  useProfileStore.setState({ isOnboardingComplete: false } as never);

  const outcome = useProfileStore.getState().completeOnboarding();
  assert(outcome.ok === false, 'completion closed over an unscoreable profile');
  assert(useProfileStore.getState().isOnboardingComplete === false,
    'the completion flag was set despite the refusal');
  assert(outcome.message.length > 0 && !/_/.test(outcome.message),
    `refusal reached the athlete as a raw code: "${outcome.message}"`);
});

run('completion closes for a generation-ready profile', () => {
  // Non-vacuity: the invariant must not refuse the normal journey.
  seedArmedMirrorDevice();
  useProfileStore.setState({ isOnboardingComplete: false } as never);
  const outcome = useProfileStore.getState().completeOnboarding();
  assert(outcome.ok === true, `a complete profile was refused: ${JSON.stringify(outcome)}`);
  assert(useProfileStore.getState().isOnboardingComplete === true,
    'completion reported ok without setting the flag');
});

run('THE WHOLE LOOP: gap -> answer -> gap gone -> profile survives completion', () => {
  // The end-to-end assertion Sam required before anything ships. Device-shaped:
  // armed mirror, impoverished snapshot — the exact state that ate his answers.
  const answered = fullyAnsweredProfile();
  const gapped = { ...(answered as object) } as Record<string, unknown>;
  delete gapped.recentTrainingLoad;
  seedArmedMirrorDevice({
    liveProfile: gapped as OnboardingData,
    snapshot: IMPOVERISHED_SNAPSHOT,
  });

  const before = liveAnswerCount();
  useProfileStore.setState({ isOnboardingComplete: false } as never);
  useProfileStore.getState().updateOnboardingData({ recentTrainingLoad: 'Very consistent' } as never);
  const outcome = useProfileStore.getState().completeOnboarding();

  assert(outcome.ok === true, `completion refused after the gap was answered: ${JSON.stringify(outcome)}`);
  assert(liveAnswerCount() >= before + 1,
    `answers were lost across the loop: ${before} -> ${liveAnswerCount()}`);
  assert(liveProfile().recentTrainingLoad === 'Very consistent',
    'the answer the athlete just gave did not survive completion');
  assert(liveProfile().seasonPhase === 'In-season',
    'seasonPhase was replaced away across the loop — the reported symptom');
});

console.log(`\nProfile mirror narrowing totals: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
