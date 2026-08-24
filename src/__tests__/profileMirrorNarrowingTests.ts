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

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type { OnboardingData } from '../types/domain';
import { useProfileStore } from '../store/profileStore';
import {
  acceptedProfileSnapshotMintRefusal,
  profileMirrorPublicationRefusal,
  staleAcceptedSnapshotRepair,
  recentProfileMirrorRefusals,
  clearProfileMirrorRefusals,
} from '../rules/profileMirrorNarrowing';
import {
  INITIAL_ONBOARDING_DATA,
  applyProfileOnboardingWrite,
  beginProfileResetAction,
  endProfileResetAction,
  publishAcceptedProfileCompatibilityMirror,
} from '../store/profileStore';
import { athleteActionLogEntries } from '../utils/athleteActionLog';
import { useProgramStore } from '../store/programStore';
import { commitAcceptedStateTransaction } from '../store/acceptedStateTransaction';
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

function liveAnswerCountFrom(profile: OnboardingData): number {
  return Object.keys(profile).filter((key) => {
    const value = (profile as Record<string, unknown>)[key];
    if (value === undefined || value === null) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  }).length;
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

// ── Provenance: where the impoverished snapshot came from ───────────────

run("the fixture is the HISTORICAL default, and the live default is honestly empty", () => {
  // THE PROVENANCE PROOF, from Sam's real export of 2026-07-29. His
  // `acceptedProfileSnapshot` was `initialOnboardingData` AS IT THEN WAS —
  // 'Commercial gym' + the unauthored 8-tag checklist — minted from the
  // in-memory default at a hydration acceptance, never from him. That is the
  // fabrication mechanism PROFILE_MIRROR_OWNERSHIP_REASSESSMENT named.
  //
  // The equipment rulings (2026-07-31) then DELETED that default: the store's
  // initial data is `{}` now, so the same fabrication could only ever mint an
  // obviously-empty profile. Both halves are pinned: the fixture stays the
  // device-recorded historical shape (it may never drift toward the current
  // default, or it stops matching the export it documents), and the current
  // default stays empty (a value reappearing here is the fantasy gym coming
  // back).
  assert(IMPOVERISHED_SNAPSHOT.trainingLocation === 'Commercial gym' &&
    JSON.stringify(IMPOVERISHED_SNAPSHOT.equipment) === JSON.stringify([
      'barbell', 'dumbbells', 'squat_rack', 'pullup_bar',
      'cable_machine', 'hamstring_curl', 'knee_extension', 'bands',
    ]),
    'the historical fixture drifted away from the 2026-07-29 export');
  assert(Object.keys(INITIAL_ONBOARDING_DATA).length === 0,
    `initialOnboardingData is no longer empty: ${JSON.stringify(INITIAL_ONBOARDING_DATA)}`);
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

// ── The temporary instrument no longer lives on a healthy screen ────────

run('the stored-state export has retired from the normal Profile screen', () => {
  const profileScreen = readFileSync(
    join(__dirname, '..', 'screens', 'profile', 'ProfileScreen.tsx'),
    'utf8',
  );
  assert(!/profile-export-stored-state|profile-stored-state-readout/.test(profileScreen),
    'the old export button or internal counts still render in Profile');
  assert(!/serialiseStoredStateExport|storedStateExportHeadline/.test(profileScreen),
    'Profile still wires the retired stored-state diagnostic');
});

// ── ONE WRITER, AND THE TAPE SEES ALL OF IT (5D.1, arrived early) ────────
//
// Export 5 is the reason this exists. The tape recorded all 22 answers going
// in, one step at a time, 04:54:05 to 04:54:53 — and at 04:55:24 the completion
// guard judged a profile of TWO. Thirty-one seconds, no log entry, no mirror
// refusal. A writer nothing could see replaced the profile with
// `initialOnboardingData`.
//
// Naming that writer by reading code has now failed four times. So the law is
// the instrument: every write of the profile goes through one owner, the owner
// refuses the shape of the defect, and the owner puts every write on the tape.
// Whatever the writer is, the next run either fails to wipe or is named.

run('writing the DEFAULT over a real profile is refused', () => {
  seedArmedMirrorDevice({ profile: COMPLETE_PROFILE, snapshot: COMPLETE_PROFILE });
  useProfileStore.setState({ onboardingData: COMPLETE_PROFILE, isOnboardingComplete: true });

  const outcome = applyProfileOnboardingWrite({
    next: INITIAL_ONBOARDING_DATA,
    writer: 'compatibility_mirror',
  });

  assert(outcome.ok === false, 'the default was written straight over 22 answers');
  assert(outcome.reason === 'default_over_answered_profile',
    `refused for the wrong reason: ${outcome.reason}`);
  assert(liveAnswerCount() > 2,
    `the profile is down to ${liveAnswerCount()} answers despite the refusal`);
});

run('a reset writes the default, because that is what a reset IS', () => {
  seedArmedMirrorDevice({ profile: COMPLETE_PROFILE, snapshot: COMPLETE_PROFILE });
  useProfileStore.setState({ onboardingData: COMPLETE_PROFILE, isOnboardingComplete: true });

  const outcome = applyProfileOnboardingWrite({
    next: INITIAL_ONBOARDING_DATA,
    writer: 'reset',
    resetActionId: beginProfileResetAction('test'),
  });

  assert(outcome.ok, `the reset was refused: ${outcome.reason}`);
  // The default is honestly empty now (2026-07-31): a reset leaves NO answers,
  // where it used to leave the two unauthored ones.
  assert(liveAnswerCount() === 0,
    `the reset left ${liveAnswerCount()} answers behind`);
  assert(useProfileStore.getState().isOnboardingComplete === false,
    'the reset left onboarding marked complete');
});

run('a stale reset id cannot wipe a profile answered after it', () => {
  // The suspected shape: a reset that fires, and something belonging to it
  // landing much later, over answers given in between. An id minted before
  // those answers is not a licence to erase them.
  seedArmedMirrorDevice({ profile: COMPLETE_PROFILE, snapshot: COMPLETE_PROFILE });
  useProfileStore.setState({ onboardingData: COMPLETE_PROFILE, isOnboardingComplete: true });
  const stale = beginProfileResetAction('test');
  endProfileResetAction(stale);

  const outcome = applyProfileOnboardingWrite({
    next: INITIAL_ONBOARDING_DATA,
    writer: 'reset',
    resetActionId: stale,
  });

  assert(outcome.ok === false,
    'a finished reset action still authorised a wipe — the deferred-write case');
  assert(outcome.reason === 'reset_action_not_in_flight',
    `refused for the wrong reason: ${outcome.reason}`);
  assert(liveAnswerCount() > 2, `the stale reset wiped ${liveAnswerCount()}`);
});

run('every profile write is on the tape, refused or not', () => {
  seedArmedMirrorDevice({ profile: COMPLETE_PROFILE, snapshot: COMPLETE_PROFILE });
  useProfileStore.setState({ onboardingData: COMPLETE_PROFILE, isOnboardingComplete: true });
  // Indexed from here rather than clearing: the tape is durable and shared, and
  // a test that wipes it hides whatever ran before it.
  const from = athleteActionLogEntries().length;

  applyProfileOnboardingWrite({ next: INITIAL_ONBOARDING_DATA, writer: 'compatibility_mirror' });
  const id = beginProfileResetAction('test');
  applyProfileOnboardingWrite({ next: INITIAL_ONBOARDING_DATA, writer: 'reset', resetActionId: id });
  endProfileResetAction(id);

  const writes = athleteActionLogEntries().slice(from)
    .filter((entry) => entry.event === 'profile_write');
  assert(writes.length === 2,
    `the tape saw ${writes.length} of 2 profile writes`);
  assert(writes[0]!.outcome === 'refused' && writes[0]!.writer === 'compatibility_mirror',
    `the refused write is not named on the tape: ${JSON.stringify(writes[0])}`);
  assert(writes[1]!.outcome === 'applied' && writes[1]!.writer === 'reset',
    `the applied write is not named on the tape: ${JSON.stringify(writes[1])}`);
  assert(writes[0]!.answerCountBefore === liveAnswerCountFrom(COMPLETE_PROFILE),
    'the tape does not record how big the profile was before the write');
  const serialised = JSON.stringify(writes);
  assert(!serialised.includes('inside_mid') && !serialised.includes('In-season'),
    `an answer VALUE reached the tape: ${serialised}`);
});

run('no writer can reach the profile around the owner', () => {
  // A writer the tape cannot see is a build failure (Sam, 2026-07-30). The
  // whole defect class is a store anything can assign to, so the check is that
  // the ONLY setState in the file is the owner's, and that no zustand action
  // assigns the profile behind its back.
  const profileStore = readFileSync(
    join(__dirname, '..', 'store', 'profileStore.ts'), 'utf8');
  const ownerStart = profileStore.indexOf('export function applyProfileOnboardingWrite');
  assert(ownerStart > 0, 'the profile write owner is gone');

  const setStateCalls = profileStore.split('useProfileStore.setState(').length - 1;
  assert(setStateCalls === 1,
    `${setStateCalls} direct setState calls in profileStore — exactly one, the `
    + "owner's, may exist");
  // The owner's body ends at the first line-start closing brace after it.
  const ownerEnd = profileStore.indexOf('\n}\n', ownerStart);
  const setStateAt = profileStore.indexOf('useProfileStore.setState(');
  assert(setStateAt > ownerStart && setStateAt < ownerEnd,
    `the one setState (offset ${setStateAt}) is outside the write owner `
    + `(${ownerStart}..${ownerEnd})`);

  // zustand's own `set` may still carry loading/error/completion flags; what it
  // may never carry is the profile itself.
  for (const match of profileStore.matchAll(/set\(\{[^}]*\}/g)) {
    assert(!match[0].includes('onboardingData'),
      `a store action assigns the profile directly: ${match[0].slice(0, 80)}`);
  }

  for (const file of ['../utils/resetCoach.ts', '../store/programStore.ts',
    '../store/acceptedStateTransaction.ts', '../store/coachMutationTransaction.ts']) {
    const source = readFileSync(join(__dirname, file), 'utf8');
    assert(!/useProfileStore\.setState\(/.test(source),
      `${file} writes the profile store directly — it must go through the owner`);
  }
});

/**
 * THE GATE LEARNS TO SEE TESTS (seat answer 2, 2026-08-07).
 *
 * The one-door law above scanned PRODUCT sources only, so test code could
 * assign `onboardingData` around the owner and nothing failed. That hole is
 * not academic: it is how `athleteSessionMoveTests`' `seed()` manufactured a
 * world no athlete can be in — an Off-season athlete running against an
 * In-season profile, because the direct write fired the mirror fence while
 * `programStore` still held the previous cell's accepted snapshot, and the
 * fence republished that stale canonical straight back over it. A whole
 * ruling was then reasoned from the trace that world produced, and withdrawn
 * (docs/R53_SEAT_ANSWERS_2026-08-07.md §1).
 *
 * Third sighting of a fixture manufacturing a misdirection in one unit
 * (cell-19 carry-over, `seedExactSundayRegression`'s borrowed fill, scaffold
 * defect 4), so the compression ships with the fix rather than later.
 *
 * WHY A DECLARED CENSUS AND NOT A BAN. There are ~50 such files. Banning
 * outright would either fail the build or invite a blanket exemption, and a
 * gate with a blanket exemption is the gate that was already missing. So the
 * set is DECLARED and checked in BOTH directions:
 *
 *   - a file that writes directly and is NOT declared fails immediately —
 *     that is the half that stops this class growing;
 *   - a declared file that no longer writes directly ALSO fails, so paying
 *     the debt forces the declaration down in the same commit and the census
 *     can never quietly overstate what is owed.
 *
 * Fixtures reach state by ACTING (AGENTS.md); every entry below is debt
 * against that law, not a permission.
 */

/**
 * The narrowing suite's own writes are NOT debt. Proving the fence catches an
 * unowned write requires performing one, so these are the gate's instrument
 * rather than a violation of it.
 */
const FENCE_PROVING_SOURCES = ['profileMirrorNarrowingTests.ts'];

/**
 * DELIBERATE FAULT INJECTION — a cell that breaks the store ON PURPOSE to
 * prove the code fails safe, e.g. nulling the profile to induce a technical
 * failure mid-transaction. That is the opposite of manufacturing a plausible
 * world: it asserts an IMPOSSIBLE one and expects a refusal.
 *
 * This category cannot be used to seed. Every direct write in one of these
 * files must sit on a line carrying `PROFILE-DOOR-BYPASS: fault injection`, so
 * a seeding write added to the same file still fails the gate.
 */
const FAULT_INJECTION_SOURCES = ['athleteSessionMoveTests.ts'];
const FAULT_INJECTION_MARKER = 'PROFILE-DOOR-BYPASS: fault injection';

/**
 * DEBT: fixtures that still assign `onboardingData` directly instead of
 * reaching state through the owned doors. Remove an entry in the same commit
 * that pays it — the gate fails if an entry no longer earns its place.
 */
const DIRECT_PROFILE_WRITE_DEBT = [
  'acceptedStateTransactionTests.ts',
  'athleteActionLogTests.ts',
  'athleteDoorMatrixTests.ts',
  'athleteMoveOccupiedContentLossTests.ts',
  'athletePlacementOwnershipTests.ts',
  'athleteSessionDeletionTests.ts',
  'bibleConformance/observations/buildSlice4Trace.ts',
  'capacityRenderSafetyTests.ts',
  'chainedMutationContinuityTests.ts',
  // Item 31 part 5. Seeds a pre-season club athlete so the Christmas break has
  // team nights to take off; the two ANSWERS it measures both go through the
  // real durable door. Same debt shape as its away sibling.
  'christmasBreakTests.ts',
  'coachAddSessionOwnershipTests.ts',
  'coachClarifierAdvanceTests.ts',
  'dayPrecedenceOwnershipTests.ts',
  'deletionCalendarOwnershipTests.ts',
  'derivedRepairOwnershipTests.ts',
  'derivedWeekOwnershipTests.ts',
  'derivingSourceFactDeviceCommitTests.ts',
  'deviceExactSeed.ts',
  'deviceFindingsReplayTests.ts',
  'devicePass20260805EveningReplayTests.ts',
  'devicePass20260805ReplayTests.ts',
  'doorLedgerAppendTests.ts',
  'durableFactHorizonTests.ts',
  'equipmentAvailabilityTests.ts',
  'equipmentScheduleFactTransactionTests.ts',
  'fixtureConditionedReplanTests.ts',
  'fixtureMutationTransactionTests.ts',
  'g1LandingAskFlowTests.ts',
  'illnessRecoveryModeTests.ts',
  'mobilityAccessoryDoorTests.ts',
  'onboardingColdStartTests.ts',
  'onboardingReliabilityTests.ts',
  'phaseShiftAtomicityTests.ts',
  'planChangeMoveScopingTests.ts',
  'planChangeProducerTests.ts',
  'programControlActionsTests.ts',
  'programControlDurableOwnershipTests.ts',
  'programOverrideOwnershipTests.ts',
  'projectionOwnershipTests.ts',
  'quiescentBootTests.ts',
  'readinessSourceFactOwnershipTests.ts',
  'resolverDisplacementSweepTests.ts',
  'seasonPhaseSkewRepairTests.ts',
  'section18OwnershipInvariantTests.ts',
  'sessionTypeCharterTests.ts',
  'spentWeekFridayTestSupport.ts',
  'support/armedMirrorDeviceFixture.ts',
  'support/freshInstallStores.ts',
  'surfaceAgreementTests.ts',
  'teamNightMovabilityTests.ts',
  'weekRebuildIntegrationTests.ts',
  'workBillTests.ts',
  'wornWorldBootTests.ts',
];

function testSourcesWritingProfileDirectly(): string[] {
  const roots = [__dirname, join(__dirname, '..', 'dev')];
  const found: string[] = [];
  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(join(dir, entry.name), rel);
        continue;
      }
      if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue;
      const source = readFileSync(join(dir, entry.name), 'utf8');
      if (/useProfileStore\.setState\(/.test(source)) found.push(rel);
    }
  };
  for (const root of roots) {
    try {
      walk(root, root === __dirname ? '' : 'dev');
    } catch {
      // A missing dev tree is not a gate failure.
    }
  }
  return found.sort();
}

run('the one-door law reaches TEST sources, and the census is exact', () => {
  const actual = testSourcesWritingProfileDirectly();
  const declared = [...FENCE_PROVING_SOURCES, ...FAULT_INJECTION_SOURCES,
    ...DIRECT_PROFILE_WRITE_DEBT].sort();

  // Non-vacuity: a scan that finds nothing is a broken scan, not a clean repo.
  assert(actual.length > 0,
    'the test-source scan found no direct profile writes at all — the walker '
    + 'or the pattern is broken, and a gate that cannot fail is not a gate');

  const undeclared = actual.filter((file) => !declared.includes(file));
  assert(undeclared.length === 0,
    `${undeclared.length} test source(s) assign onboardingData around the write `
    + `owner without being declared: ${undeclared.join(', ')}. Fixtures reach `
    + 'state by ACTING (AGENTS.md) — route the write through the owned door, or '
    + 'declare it as debt with a reason.');

  const stale = declared.filter((file) => !actual.includes(file));
  assert(stale.length === 0,
    `${stale.length} declared entr(y/ies) no longer write the profile directly: `
    + `${stale.join(', ')}. The declaration drops in the SAME commit that pays `
    + 'the debt, or the census overstates what is owed.');

  // Fault injection stays fault injection. Every direct write in one of those
  // files must name itself, so the category cannot quietly host a seed.
  for (const file of FAULT_INJECTION_SOURCES) {
    const lines = readFileSync(join(__dirname, file), 'utf8').split('\n');
    const unmarked = lines
      .map((line, index) => ({ line, number: index + 1 }))
      .filter(({ line }) => line.includes('useProfileStore.setState(') &&
        !line.trimStart().startsWith('//') &&
        !line.includes(FAULT_INJECTION_MARKER));
    assert(unmarked.length === 0,
      `${file} writes the profile store directly at line(s) `
      + `${unmarked.map(({ number }) => number).join(', ')} without the `
      + `\`${FAULT_INJECTION_MARKER}\` marker. Fault injection declares itself; `
      + 'seeding goes through the owned door.');
  }
});

// ── The residue: a corrupt record repairs itself (export 6) ──────────────
//
// The tape named the villain. Four `profile_write` attempts by writer
// `accepted_transaction` at 05:13:21, every one refused, then completion
// accepted with 23 answers. The publication in `commitAcceptedStateTransaction`
// was pushing the FROZEN 2-key snapshot over the live profile on every
// ordinary transaction — a move, a generation, a set_today_workout.
//
// It is frozen because the refresh asks `proposal.profile !== undefined`, and
// no ordinary transaction carries a profile. So the record could never correct
// itself while being republished forever. Refusing the publication stopped the
// damage; it left the wrong record on disk, still trying.
//
// The law says the athlete's live answers outrank the stored snapshot. When
// they disagree in that direction the SNAPSHOT is what is wrong, so it is the
// snapshot that gets corrected.

run('the rule spots a snapshot that is poorer than the live profile', () => {
  assert(staleAcceptedSnapshotRepair({
    live: COMPLETE_PROFILE,
    snapshot: INITIAL_ONBOARDING_DATA,
  }), 'a 2-key snapshot beside a fully answered profile was called healthy');
  // Non-vacuity in both directions: an equal snapshot needs no repair, and
  // neither does one that merely holds DIFFERENT values.
  assert(staleAcceptedSnapshotRepair({
    live: COMPLETE_PROFILE, snapshot: COMPLETE_PROFILE,
  }) === null, 'an identical snapshot was called stale');
  assert(staleAcceptedSnapshotRepair({
    live: COMPLETE_PROFILE,
    snapshot: { ...COMPLETE_PROFILE, position: 'winger' } as unknown as OnboardingData,
  }) === null, 'a value change was mistaken for a poorer record');
});

run('an ordinary transaction re-mints a snapshot poorer than the profile', () => {
  // Exactly Sam's device: rich live profile, impoverished accepted snapshot,
  // and a transaction that carries no profile of its own — which is every
  // ordinary one.
  seedArmedMirrorDevice({ profile: COMPLETE_PROFILE, snapshot: IMPOVERISHED_SNAPSHOT });
  useProfileStore.setState({ onboardingData: COMPLETE_PROFILE, isOnboardingComplete: true });
  const before = useProgramStore.getState().acceptedMaterialContext;
  assert(Object.keys(before.acceptedProfileSnapshot!.onboardingData).length < 5,
    'the fixture no longer starts from an impoverished snapshot');

  commitAcceptedStateTransaction({
    // Harness seed: installs a world, never restores one.
    operation: 'forward_decision',
    reason: 'test:ordinary_transaction_with_no_profile',
    source: 'tap',
  } as never);

  const after = useProgramStore.getState().acceptedMaterialContext;
  const snapshotAnswers = Object.keys(after.acceptedProfileSnapshot!.onboardingData).length;
  assert(snapshotAnswers > 20,
    `the record still carries ${snapshotAnswers} answers — it can no longer `
    + 'overwrite the profile, but it is still wrong, and still trying');
  assert(after.acceptedProfileSnapshot!.sourceRevision === after.revision,
    'the re-minted snapshot did not take the revision it was minted at');
  assert(liveAnswerCount() > 20,
    `the repair cost the live profile: ${liveAnswerCount()} answers`);
});

console.log(`\nProfile mirror narrowing totals: ${passed} passed, ${failed} failed`);
totalsPrinted(failed);
if (failed > 0) {
  console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
