(global as unknown as { __DEV__: boolean }).__DEV__ = false;
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  },
};

/**
 * TEAM-NIGHT SIZE — Sam's signed mechanism, 2026-07-30.
 *
 *   > The one-question mechanism ("How was training?" Light / Normal / Hard, Sam-signed
 *   > copy) on the existing completion flow for team-training days, stored in
 *   > SessionFeedback; size = rolling read of the LAST 3 logged team nights; silence =
 *   > onboarding seed persists (never decays); a Hard night informs next WEEK, never next
 *   > day (readiness door owns today); teamTrainingDuration STOPS BEING ASKED.
 *
 * VERIFICATION STRATEGY (L12). Five clauses, and the classes they can each fail in are
 * different, so the gate is split the same way:
 *
 *   - the WINDOW can drift (4 nights, or the oldest 3) — swept, not sampled;
 *   - SILENCE can start decaying — asserted after arbitrarily long silence;
 *   - the NEXT-WEEK law can leak — asserted at the boundary date, both sides;
 *   - the QUESTION can appear where it should not, or vanish where it should be — driven
 *     through the real form owner for every completion state × team/non-team;
 *   - the ANSWER can be collected and then silently dropped before storage. This one gets
 *     the most attention because it is the class that actually bit during the build: the
 *     draft sanitiser REBUILDS its object, so a field it does not name is lost the moment
 *     the athlete changes their completion answer, and nothing would have reported it.
 */

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import type { SessionFeedback } from '../store/programStore';
import type { TeamTrainingIntensity } from '../types/domain';
import {
  TEAM_NIGHT_SIZES,
  TEAM_NIGHT_SIZE_OPTIONS,
  TEAM_NIGHT_WINDOW,
  deriveTeamNightSize,
  teamNightSeedFor,
  type LoggedTeamNight,
  type TeamNightSize,
} from '../rules/teamNightSize';
import {
  buildSessionFeedbackPayload,
  getVisibleFeedbackSections,
  sanitizeFeedbackDraftForCompletion,
  type FeedbackFormDraft,
} from '../utils/sessionFeedbackForm';
import { signedCopy, signedCopyEntry } from '../rules/signedCopy';
import { ONBOARDING_STEPS } from '../utils/onboardingSteps';
import { readFileSync } from 'fs';
import { join } from 'path';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: unknown): void {
  if (condition) {
    pass += 1;
    console.log(`  ✓ ${name}`);
  } else {
    fail += 1;
    failures.push(name);
    console.log(`  ✗ ${name}${detail === undefined ? '' : `\n      ${JSON.stringify(detail)}`}`);
  }
}

const WEEK_START = '2026-07-27';

const night = (dateISO: string, size: TeamNightSize): LoggedTeamNight => ({ dateISO, size });

/** Every logged night before the planned week, so only the window rule is in play. */
function derive(
  loggedNights: readonly LoggedTeamNight[],
  onboardingIntensity?: TeamTrainingIntensity | null,
) {
  return deriveTeamNightSize({ loggedNights, onboardingIntensity, weekStartISO: WEEK_START });
}

console.log('\nTeam-night size — Sam 2026-07-30');

console.log('\n[1] THE ROLLING READ USES THE LAST THREE, AND ONLY THE LAST THREE');
{
  ok('the declared window is three', TEAM_NIGHT_WINDOW === 3);

  // Six nights, the three most recent all hard, the three oldest all light. If the read
  // ever takes the oldest — or all six — this flips.
  const six = [
    night('2026-07-01', 'light'), night('2026-07-08', 'light'), night('2026-07-15', 'light'),
    night('2026-07-18', 'hard'), night('2026-07-20', 'hard'), night('2026-07-22', 'hard'),
  ];
  const recentHard = derive(six);
  ok('six nights, three recent hard → hard', recentHard.size === 'hard', recentHard);
  ok('and it reports using exactly three', recentHard.sampleSize === 3, recentHard);

  const reversed = derive([...six].reverse());
  ok('input ORDER does not change the answer',
    JSON.stringify(reversed) === JSON.stringify(recentHard), { reversed, recentHard });

  const one = derive([night('2026-07-22', 'hard')]);
  ok('a single night is enough to be measured', one.source === 'measured' && one.size === 'hard');
  ok('and the sample size says it was only one', one.sampleSize === 1, one);

  ok('two hard and one light read as normal',
    derive([night('2026-07-18', 'hard'), night('2026-07-20', 'hard'), night('2026-07-22', 'light')])
      .size === 'normal');
  ok('two hard and one normal read as hard',
    derive([night('2026-07-18', 'hard'), night('2026-07-20', 'hard'), night('2026-07-22', 'normal')])
      .size === 'hard');
  ok('three of the same read as that one',
    TEAM_NIGHT_SIZES.every((size) => derive([
      night('2026-07-18', size), night('2026-07-20', size), night('2026-07-22', size),
    ]).size === size));
}

console.log('\n[2] SILENCE IS NOT EVIDENCE — the seed persists and never decays');
{
  const INTENSITIES: TeamTrainingIntensity[] = ['Light', 'Moderate', 'Hard', 'Very intense'];
  for (const intensity of INTENSITIES) {
    const seeded = derive([], intensity);
    ok(`"${intensity}" seeds a size with source onboarding_seed`,
      seeded.source === 'onboarding_seed' && seeded.size === teamNightSeedFor(intensity),
      seeded);
  }
  ok('Hard and Very intense both seed hard — the four answers become three rungs',
    teamNightSeedFor('Hard') === 'hard' && teamNightSeedFor('Very intense') === 'hard');

  // THE DECAY TEST. A seed that decays toward Normal would drift as the weeks pass with no
  // answers; the read has no clock beyond the week start, so this asserts the property
  // directly across a year of silence.
  const farFuture = deriveTeamNightSize({
    loggedNights: [], onboardingIntensity: 'Light', weekStartISO: '2027-07-27',
  });
  ok('a year of silence does not move the seed toward Normal',
    farFuture.size === 'light' && farFuture.source === 'onboarding_seed', farFuture);

  const nothing = derive([], null);
  ok('no nights and no onboarding answer is UNKNOWN, not a guessed Normal',
    nothing.size === null && nothing.source === 'unknown', nothing);

  ok('one logged night immediately outranks the seed',
    derive([night('2026-07-22', 'light')], 'Hard').source === 'measured');
}

console.log('\n[3] A HARD NIGHT INFORMS NEXT WEEK, NEVER NEXT DAY');
{
  // The boundary, from both sides. The readiness door owns "today"; if this read could see
  // a night inside the week being planned, two doors would answer one question.
  const insideThisWeek = derive([night(WEEK_START, 'hard')], 'Light');
  ok('a night logged ON the week start is not evidence for that week',
    insideThisWeek.source === 'onboarding_seed', insideThisWeek);

  const laterThisWeek = derive([night('2026-07-30', 'hard')], 'Light');
  ok('a night logged mid-week is not evidence for that week',
    laterThisWeek.source === 'onboarding_seed', laterThisWeek);

  const dayBefore = derive([night('2026-07-26', 'hard')], 'Light');
  ok('a night logged the day BEFORE the week start is evidence for it',
    dayBefore.source === 'measured' && dayBefore.size === 'hard', dayBefore);

  // And the same nights DO reach the following week — the "informs next week" half, which
  // an exclusion filter alone could satisfy by never counting anything.
  const nextWeek = deriveTeamNightSize({
    loggedNights: [night('2026-07-30', 'hard')],
    onboardingIntensity: 'Light',
    weekStartISO: '2026-08-03',
  });
  ok('that same night IS evidence for the following week',
    nextWeek.source === 'measured' && nextWeek.size === 'hard', nextWeek);
}

console.log('\n[4] THE QUESTION IS ASKED ON A TEAM NIGHT THAT HAPPENED — AND NOWHERE ELSE');
{
  const asks = (completion: 'full' | 'partial' | 'skipped' | null, isTeamNight: boolean) =>
    getVisibleFeedbackSections(completion, { isTeamTrainingDay: isTeamNight })
      .some((section) => section.id === 'teamNightSize');

  ok('a completed team night is asked', asks('full', true));
  ok('a partially-completed team night is asked', asks('partial', true));
  ok('a SKIPPED team night is not asked — there is no size for a night that did not happen',
    !asks('skipped', true));
  ok('an unanswered form does not ask yet', !asks(null, true));

  for (const completion of ['full', 'partial', 'skipped', null] as const) {
    ok(`a NON-team session is never asked (completion: ${completion})`,
      !asks(completion, false));
  }

  ok('the question is not required — an athlete may decline to answer',
    getVisibleFeedbackSections('full', { isTeamTrainingDay: true })
      .find((section) => section.id === 'teamNightSize')?.required === false);
}

console.log('\n[5] THE ANSWER SURVIVES THE FORM AND REACHES STORAGE');
{
  const draft = (over: Partial<FeedbackFormDraft> = {}): FeedbackFormDraft => ({
    completion: 'full',
    teamNightSize: 'hard',
    feeling: 'good',
    soreness: 'mild',
    partialReason: null,
    skipReason: null,
    ...over,
  });

  // THE DEFECT CLASS THAT BIT DURING THE BUILD. `sanitizeFeedbackDraftForCompletion`
  // rebuilds its result object, so a field it does not name is dropped the moment the
  // athlete changes their completion answer — silently, with the chip still lit.
  ok('the answer survives a full → partial change',
    sanitizeFeedbackDraftForCompletion(draft(), 'partial').teamNightSize === 'hard');
  ok('the answer survives a partial → full change',
    sanitizeFeedbackDraftForCompletion(draft({ completion: 'partial' }), 'full')
      .teamNightSize === 'hard');
  ok('the answer is CLEARED when the athlete switches to skipped',
    sanitizeFeedbackDraftForCompletion(draft(), 'skipped').teamNightSize === null);
  ok('the answer is cleared when the form is reset to unanswered',
    sanitizeFeedbackDraftForCompletion(draft(), null).teamNightSize === null);

  const saved = buildSessionFeedbackPayload({ dateStr: '2026-07-22', ...draft() });
  ok('a saved team night carries the answer into SessionFeedback',
    saved?.teamNightSize === 'hard', saved);

  const withoutAnswer = buildSessionFeedbackPayload({
    dateStr: '2026-07-22', ...draft({ teamNightSize: null }),
  });
  ok('declining to answer stores no size at all — absence stays absence',
    withoutAnswer !== null && !('teamNightSize' in withoutAnswer), withoutAnswer);

  const skipped = buildSessionFeedbackPayload({
    dateStr: '2026-07-22',
    ...draft({ completion: 'skipped', teamNightSize: null, skipReason: 'busy_no_time' }),
  });
  ok('a skipped night stores no size', skipped !== null && !('teamNightSize' in skipped));

  // ── THE STRENGTH SESSION'S ACTUAL MINUTES SURVIVE THE SAME REBUILD ────────
  //
  // Item 18's field rides the SAME builder that this suite's own header calls
  // out: it REBUILDS its object, so a field it does not name is lost the moment
  // the athlete changes an answer. That class already bit once here, which is
  // why the new field is asserted through the builder rather than at its type.
  // `checklistMode` — an executionItems array — IS the strength path, and it is
  // the branch the field is named in. A cell on the other branch would pass for
  // the wrong reason.
  const timed = buildSessionFeedbackPayload({
    dateStr: '2026-07-22', ...draft(), executionItems: [], difficulty: 7, actualMinutes: 55,
  });
  ok('a timed strength session carries its actual minutes into SessionFeedback',
    timed?.actualMinutes === 55, timed);
  const untimed = buildSessionFeedbackPayload({
    dateStr: '2026-07-22', ...draft(), executionItems: [], difficulty: 7,
  });
  ok('a session the athlete did not time stores no minutes — absence stays absence',
    untimed !== null && !('actualMinutes' in untimed), untimed);
  // A ZERO IS NOT AN ANSWER, and storing it would read as an instant session.
  const zero = buildSessionFeedbackPayload({
    dateStr: '2026-07-22', ...draft(), executionItems: [], difficulty: 7, actualMinutes: 0,
  });
  ok('a zero duration is stored as no answer, never as zero minutes',
    zero !== null && !('actualMinutes' in zero), zero);
  const skippedTimed = buildSessionFeedbackPayload({
    dateStr: '2026-07-22',
    ...draft({ completion: 'skipped', teamNightSize: null, skipReason: 'busy_no_time' }),
    executionItems: [], difficulty: 7, actualMinutes: 55,
  });
  ok('a skipped session stores no duration', 
    skippedTimed !== null && !('actualMinutes' in skippedTimed));

  // End-to-end: stored feedback → the read. This is the join the two halves share, and it
  // is the one place a field-name mismatch between store and rule would show up.
  const stored: SessionFeedback[] = [
    { dateStr: '2026-07-18', completion: 'full', teamNightSize: 'hard' },
    { dateStr: '2026-07-20', completion: 'full', teamNightSize: 'hard' },
    { dateStr: '2026-07-22', completion: 'full', teamNightSize: 'normal' },
  ];
  const fromStore = derive(stored
    .filter((entry) => !!entry.teamNightSize)
    .map((entry) => night(entry.dateStr, entry.teamNightSize!)));
  ok('stored feedback reads back as a measured size',
    fromStore.source === 'measured' && fromStore.size === 'hard', fromStore);
}

console.log('\n[6] THE WORDS ARE SAM\'S, AND THEY ARE IN THE SHEET');
{
  ok('the question is registered signed copy',
    signedCopyEntry('team_night_size_question') !== null);
  ok('and it is the sentence Sam signed',
    String(signedCopy('team_night_size_question')) === 'How was training?');
  ok('the question cites its ruling',
    /Sam, 2026-07-30/.test(signedCopyEntry('team_night_size_question')?.provenance ?? ''));

  for (const option of TEAM_NIGHT_SIZE_OPTIONS) {
    ok(`the "${option.label}" answer is signed copy`,
      String(signedCopy(`team_night_size_answer_${option.key}`)) === option.label);
  }
  ok('the three answers are Light / Normal / Hard, in that order',
    TEAM_NIGHT_SIZE_OPTIONS.map((option) => option.label).join(' / ') === 'Light / Normal / Hard',
    TEAM_NIGHT_SIZE_OPTIONS.map((o) => o.label));

  // The panel must read the authored list, not retype it — the same both-directions rule
  // the goal options answer to.
  const panel = readFileSync(
    join(__dirname, '../components/SessionFeedbackPanel.tsx'), 'utf8',
  );
  ok('the feedback panel renders the authored answer list',
    /TEAM_NIGHT_SIZE_OPTIONS\.map/.test(panel));
}

console.log('\n[7] DURATION STOPS BEING ASKED');
{
  const collectors = ONBOARDING_STEPS
    .filter((step) => (step.collects as readonly string[]).includes('teamTrainingDuration'))
    .map((step) => step.name);
  ok('no onboarding step collects teamTrainingDuration', collectors.length === 0, collectors);

  const step = ONBOARDING_STEPS.find((candidate) => candidate.name === 'TeamTrainingDuration')!;
  ok('the team-training step still collects INTENSITY — it is the seed',
    step.collects.includes('teamTrainingIntensity'));
  ok('and it is satisfied by intensity alone',
    step.satisfied({ teamTrainingIntensity: 'Hard' } as never) &&
      !step.satisfied({} as never),
    'an athlete must not be blocked on a question the app no longer asks');

  const screen = readFileSync(
    join(__dirname, '../screens/onboarding/TeamTrainingDurationScreen.tsx'), 'utf8',
  );
  ok('the screen no longer offers duration options',
    !/DURATION_OPTIONS/.test(screen) && !/HOW LONG\?/.test(screen));
  ok('the screen no longer writes the duration answer',
    !/teamTrainingDuration:/.test(screen));

  // Review's contract: every row routes to a step that can still edit its answer.
  const rows = readFileSync(join(__dirname, '../screens/onboarding/reviewRows.ts'), 'utf8');
  ok('Review no longer shows a duration it cannot let the athlete change',
    !/formatTeamDuration/.test(rows));
}

console.log(`\nteamNightSizeTests: ${pass} passed, ${fail} failed`);
totalsPrinted(fail);
console.log('  DEPTH (L13): 0 — a unit sweep over the read, the form owner and the '
  + 'registry. It does NOT walk an athlete through logging three real team nights.');
console.log('  NOT COVERED: no CONSUMER reads the derived size yet — see the boundary '
  + 'report. Sam signed what the answer IS and how it is read; what it then influences '
  + '(§2.3 of the sheet) is a separate ruling and is deliberately not built.');
if (failures.length > 0) console.log(`Failures:\n  - ${failures.join('\n  - ')}`);
// TOTALS-OR-RED (Sam, 2026-08-03): the explicit exit is GONE, not moved.
// `process.exit(0)` hard-overrides `process.exitCode`, so it silently
// un-arms this suite — proven by a surviving mutation during the rollout.
// `totalsPrinted(...)` above already set the correct code from the report.
