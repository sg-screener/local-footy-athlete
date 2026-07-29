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

import { readFileSync } from 'fs';
import { join } from 'path';
import type { OnboardingData } from '../types/domain';
import { useProfileStore } from '../store/profileStore';
import {
  acceptedProfileSnapshotMintRefusal,
  profileMirrorPublicationRefusal,
  recentProfileMirrorRefusals,
  clearProfileMirrorRefusals,
} from '../rules/profileMirrorNarrowing';
import { publishAcceptedProfileCompatibilityMirror } from '../store/profileStore';
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

/** The profile Sam actually answered — every question, as onboarding leaves it. */
const COMPLETE_PROFILE: OnboardingData = fullyAnsweredProfile();

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

// ── Provenance: where the impoverished snapshot came from ───────────────

run("the fixture's snapshot is byte-identical to the store's initial profile", () => {
  // THE PROVENANCE PROOF, from Sam's real export of 2026-07-29. His
  // `acceptedProfileSnapshot` is not a degraded record of answers he gave — it
  // is `initialOnboardingData` verbatim, so it was minted from the in-memory
  // default at a hydration acceptance, never from him. That is the fabrication
  // mechanism PROFILE_MIRROR_OWNERSHIP_REASSESSMENT named.
  //
  // Pinned in both directions so the fixture cannot quietly become a fiction:
  // if `initialOnboardingData` changes, this fails rather than leaving a
  // "real device" fixture that no longer matches any real device.
  const store = readFileSync(join(__dirname, '..', 'store', 'profileStore.ts'), 'utf8');
  const block = /const initialOnboardingData: OnboardingData = \{([\s\S]*?)\n\};/.exec(store);
  assert(block, 'initialOnboardingData is gone or reshaped');
  const location = /trainingLocation: '([^']+)'/.exec(block[1]);
  const equipment = Array.from(block[1].matchAll(/'([a-z_]+)'/g)).map((m) => m[1]);
  assert(location && location[1] === IMPOVERISHED_SNAPSHOT.trainingLocation,
    `trainingLocation drifted: store=${location?.[1]} fixture=${IMPOVERISHED_SNAPSHOT.trainingLocation}`);
  assert(JSON.stringify(equipment) === JSON.stringify(IMPOVERISHED_SNAPSHOT.equipment),
    `equipment drifted:\n  store  =${JSON.stringify(equipment)}\n  fixture=${JSON.stringify(IMPOVERISHED_SNAPSHOT.equipment)}`);
});

// ── The fabrication, both ends (Sam's device, third onboarding lost) ──────
//
// Export 4 settled the mechanism. The live profile was BYTE-IDENTICAL to the
// store's `initialOnboardingData` — 2 keys, `trainingLocation` + `equipment` —
// and so was the accepted snapshot, minted at `sourceRevision: 1`. The last
// line of his action log is `hydration_accepted_canonical_projection`: the
// hydration branch that calls `publishAcceptedProfileCompatibilityMirror`
// DIRECTLY, which sets the in-progress flag and therefore deliberately bypasses
// the subscriber the narrowing law lived in. That is why his export shows an
// empty refusal log next to a wiped profile: the guarded path never ran.
//
// Two ends, one law. Do not mint an acceptance nobody made, and do not publish
// one over answers that outrank it.

run('a snapshot is never minted from a profile that has not completed onboarding', () => {
  // Sam's device HAD a program (4 microcycles), so the old guard — no program
  // AND revision 0 — did not fire, and hydration minted an accepted profile
  // from the default. An accepted profile records an acceptance the athlete
  // made; there is no such thing before onboarding closes.
  assert(acceptedProfileSnapshotMintRefusal({
    isOnboardingComplete: false,
    onboardingData: IMPOVERISHED_SNAPSHOT as OnboardingData,
  }), 'hydration would still mint an accepted profile mid-onboarding');
  assert(acceptedProfileSnapshotMintRefusal({
    isOnboardingComplete: false,
    onboardingData: COMPLETE_PROFILE,
  }), 'a complete-looking profile mid-onboarding is still not an acceptance');
  // Non-vacuity: the ordinary case must still mint, or nothing has an accepted
  // profile and every downstream owner loses its input.
  assert(acceptedProfileSnapshotMintRefusal({
    isOnboardingComplete: true,
    onboardingData: COMPLETE_PROFILE,
  }) === null, 'a completed onboarding can no longer record its accepted profile');
});

run('the hydration mint site asks the rule', () => {
  const programStore = readFileSync(join(__dirname, '..', 'store', 'programStore.ts'), 'utf8');
  assert(programStore.includes('acceptedProfileSnapshotMintRefusal'),
    'the hydration acceptance no longer consults the mint rule — a snapshot can '
    + 'be fabricated from an unscoreable profile again');
});

run('publishing narrows at the FUNCTION, so no caller can bypass it', () => {
  // The exact call the hydration branch makes, with the exact payload from
  // Sam's device. Before this law lived in the publication itself, this call
  // replaced 23 answers with 2 and recorded nothing.
  seedArmedMirrorDevice({ profile: COMPLETE_PROFILE, snapshot: COMPLETE_PROFILE });
  clearProfileMirrorRefusals();
  useProfileStore.setState({ onboardingData: COMPLETE_PROFILE, isOnboardingComplete: true });

  publishAcceptedProfileCompatibilityMirror(IMPOVERISHED_SNAPSHOT as OnboardingData);

  const after = useProfileStore.getState().onboardingData!;
  const answerCount = Object.keys(after).filter((key) =>
    (after as Record<string, unknown>)[key] !== undefined).length;
  assert(answerCount > 2,
    `a direct publication wiped the profile to ${answerCount} answers — the `
    + 'narrowing law is still only in the subscriber');
  assert(after.seasonPhase === COMPLETE_PROFILE.seasonPhase,
    'the direct publication dropped seasonPhase, the answer generation refuses without');
  assert(recentProfileMirrorRefusals().length === 1,
    'the refused publication was silent — his export showed an empty refusal log '
    + 'next to a wiped profile for exactly this reason');
});

run('the athlete removing an answer on purpose is not a wipe', () => {
  // Leaving In-season clears the game day. That is an answer disappearing, by
  // the athlete's own act, inside the transaction that made it — and a guard
  // that cannot tell it from a stale snapshot being replayed would strand every
  // profile edit that removes something. `phaseShiftAtomicityTests` is where
  // that showed up; this is where the distinction is stated.
  seedArmedMirrorDevice({ profile: COMPLETE_PROFILE, snapshot: COMPLETE_PROFILE });
  clearProfileMirrorRefusals();
  useProfileStore.setState({ onboardingData: COMPLETE_PROFILE, isOnboardingComplete: true });
  const cleared = { ...COMPLETE_PROFILE } as Record<string, unknown>;
  delete cleared.gameDay;
  delete cleared.usualGameDay;

  publishAcceptedProfileCompatibilityMirror(cleared as OnboardingData, {
    origin: 'accepted_transaction',
  });

  assert(useProfileStore.getState().onboardingData!.gameDay === undefined,
    'the athlete cleared their game day and the mirror put it back');
  assert(recentProfileMirrorRefusals().length === 0,
    "the athlete's own edit was recorded as a corrupt-snapshot refusal");

  // And the same payload, replayed as a stored snapshot, is still refused —
  // otherwise the origin is a way to opt out of the law rather than a
  // statement about which of two things is happening.
  useProfileStore.setState({ onboardingData: COMPLETE_PROFILE, isOnboardingComplete: true });
  publishAcceptedProfileCompatibilityMirror(cleared as OnboardingData);
  assert(useProfileStore.getState().onboardingData!.gameDay === COMPLETE_PROFILE.gameDay,
    'a stored snapshot replayed the same drop and it was allowed through');
  assert(recentProfileMirrorRefusals().length === 1,
    'the projection was neither applied nor recorded');
});

run('a publication that does not widen the gap still lands', () => {
  // Non-vacuity for the guard above: the mirror is not disabled, it is bounded.
  seedArmedMirrorDevice({ profile: COMPLETE_PROFILE, snapshot: COMPLETE_PROFILE });
  clearProfileMirrorRefusals();
  useProfileStore.setState({ onboardingData: COMPLETE_PROFILE, isOnboardingComplete: true });
  const changed = { ...COMPLETE_PROFILE, seasonPhase: 'Off-season' } as OnboardingData;

  publishAcceptedProfileCompatibilityMirror(changed);

  assert(useProfileStore.getState().onboardingData!.seasonPhase === 'Off-season',
    'an equally-complete publication was refused — the mirror stopped working');
  assert(recentProfileMirrorRefusals().length === 0,
    'a legitimate publication was recorded as a refusal');
});

// ── The instrument has to exist where the defect does ───────────────────

run('the stored-state export is reachable on a Release build', () => {
  const profileScreen = readFileSync(
    join(__dirname, '..', 'screens', 'profile', 'ProfileScreen.tsx'),
    'utf8',
  );
  // Quoted match, not a substring: `indexOf('profile-export-stored-state')`
  // also matches `profile-export-stored-state-ANYTHING`, so it survived a
  // mutation that renamed the control out from under it.
  const exportIdx = profileScreen.indexOf('testID="profile-export-stored-state"');
  assert(exportIdx > 0, 'the stored-state export button is gone from ProfileScreen');
  // It first shipped inside the `__DEV__`-only developer-tools section, so on
  // the one device carrying the wiped profile it was invisible. The readout and
  // the button must sit in the unconditional header, beside the tap counters.
  const devToolsIdx = profileScreen.indexOf('profile-developer-tools-section');
  assert(devToolsIdx === -1 || exportIdx < devToolsIdx,
    'the export moved back inside the __DEV__-only developer tools section');
  assert(profileScreen.indexOf('testID="profile-stored-state-readout"') > 0,
    'the inline counts readout is gone — the numbers must be legible without sharing');
});

console.log(`\nProfile mirror narrowing totals: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
