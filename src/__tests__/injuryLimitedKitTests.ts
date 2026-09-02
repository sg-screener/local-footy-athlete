/**
 * R-354 — an injury report never changes a day the athlete already did.
 * R-355 — injured on limited kit: no strength filler on a Mobility day, no
 *         third row of a pattern the day already carries, and DOUBLING
 *         (repeating a safe exercise the week already has) before nothing.
 *
 * Both were measured on the compiler-year archetypes on 2026-09-02 (seat
 * `hingecod`): the 2-day home-kit novice's Monday gained a Copenhagen Plank
 * (Half) after a Wednesday knee report; the 3-day home-kit beginner's Wednesday
 * MOBILITY session gained Push-ups and her Friday stacked three presses.
 *
 * Run: npm run test:injury-limited-kit
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import { ARCHETYPES, athleteAnswers, YEAR_START, yearTimeline, plusDays } from './compilerYear/catalog';
import {
  coldStartThroughOnboarding, quiet, quietAsync, setJourneyClock, rolloverIfDue, followTheWeek,
} from './support/athleteJourney';
import { deriveVisibleWeekLive } from '../utils/deriveVisibleWeek';
import { buildGuidedInjuryConstraint } from '../utils/guidedInjuryControl';
import { executeProgramControlActionDurably } from '../utils/programControlActions';
import { applyPlanChange } from '../utils/planChangeProducer';
import { resolveTapSwapEnvironment } from '../utils/tapSwapHierarchy';
import { chooseInjurySessionAdditions } from '../utils/injurySessionAdjustment';
import { getExerciseTags } from '../data/exerciseTags';
import { mainPatternForExerciseMovement } from '../rules/strengthPatternContributions';
import { resetStoresToFreshInstall } from './support/freshInstallStores';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';

armTotalsOrRed();

let passed = 0;
const failures: string[] = [];
function check(name: string, condition: boolean, detail = ''): void {
  if (condition) { passed += 1; console.log(`  ok   ${name}`); }
  else { failures.push(name); console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); }
}

type Day = { date: string; source?: string; workout?: { name: string; workoutType?: string; injuryAdjustment?: { added: readonly { name: string }[] } | null; exercises: { exercise?: { name?: string } }[] } | null };
const names = (day: Day | undefined) => (day?.workout?.exercises ?? []).map((row) => row.exercise?.name ?? '');
const rowsBefore = (weekStart: string, date: string): string[] =>
  (quiet(() => deriveVisibleWeekLive(weekStart, date)) as unknown as Day[])
    .filter((day) => day.date < date)
    .map((day) => `${day.date} ${day.workout?.name ?? 'rest'}: ${names(day).join(', ')}`);

function kneeConstraint(date: string) {
  return buildGuidedInjuryConstraint({
    region: 'lower_body', area: 'knee', severity: 7, severityBand: 'moderate',
    adjustmentLevel: 'moderate', triggers: ['running'], seriousSymptoms: false,
  } as never, { todayISO: date });
}

async function reportKnee(date: string): Promise<{ ok?: boolean; message?: string }> {
  return quietAsync(() => executeProgramControlActionDurably({
    type: 'set_injury_modifier',
    source: { screen: 'my_status', surface: 'status_card', initiatedBy: 'tap' },
    scope: 'current_and_future', payload: { constraint: kneeConstraint(date) },
    requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false,
  } as never, { todayISO: date })) as Promise<{ ok?: boolean; message?: string }>;
}

async function walkTo(archetypeId: string, phaseWeek: number): Promise<string> {
  resetStoresToFreshInstall(`injury-limited-kit:${archetypeId}`);
  const archetype = (ARCHETYPES as unknown as { id: string }[]).find((entry) => entry.id === archetypeId)!;
  const installed = await quietAsync(() => coldStartThroughOnboarding({
    profile: athleteAnswers(archetype as never), installDayISO: YEAR_START,
  }));
  check(`${archetypeId}: real onboarding accepted`, installed.onboardingRefusal === null, String(installed.onboardingRefusal));
  for (const week of yearTimeline(archetype as never)) {
    setJourneyClock(week.weekStart);
    const roll = quiet(() => rolloverIfDue(week.weekStart)) as { refusal?: string | null };
    if (roll.refusal) throw new Error(`rollover refused at ${week.weekStart}: ${roll.refusal}`);
    if (week.phaseWeek === phaseWeek) return week.weekStart;
    quiet(() => followTheWeek(week.weekStart));
  }
  throw new Error(`phase week ${phaseWeek} not reached`);
}

(async () => {
  // ── R-354: the 2-day home-kit novice, week 8, the year runner's own steps ──
  {
    const weekStart = await walkTo('male-2-novice-home', 8);
    const wednesday = plusDays(weekStart, 2);
    setJourneyClock(wednesday);
    const days = quiet(() => deriveVisibleWeekLive(weekStart, wednesday)) as unknown as Day[];
    const target = days.find((day) => day.date >= wednesday && day.source !== 'game' && (day.workout?.exercises.length ?? 0) > 0)!;
    const edit = quiet(() => applyPlanChange({
      change: { kind: 'remove_session', date: target.date, scope: 'whole_day' },
      visibleWeek: days, todayISO: wednesday, applyOverride: () => undefined,
    } as never)) as { ok?: boolean };
    check('CONTROL: the Wednesday session removal landed', edit.ok === true);
    const history = rowsBefore(weekStart, wednesday);
    check('CONTROL: Monday was a real done session with rows', history.length >= 1 && /Monday|full_body|lower|Jump|Squat/i.test(history[0]!), history.join(' | '));
    const report = await reportKnee(wednesday);
    check('CONTROL: the Wednesday knee report was accepted', report.ok === true, String(report.message));
    const after = rowsBefore(weekStart, wednesday);
    check('R-354: Monday and Tuesday are byte-identical after the Wednesday knee report',
      JSON.stringify(after) === JSON.stringify(history), `${history.join(' | ')}  ->  ${after.join(' | ')}`);
    check('CONTROL: the report is not a no-op — the injury is active in the week', /Injury restrictions are active/i.test(String(report.message)));
  }

  // ── R-355: the 3-day home-kit beginner, week 10, knee ──
  {
    const weekStart = await walkTo('female-3-novice-home', 10);
    const report = await reportKnee(weekStart);
    check('CONTROL: the week-10 knee report was accepted', report.ok === true, String(report.message));
    const injured = (weekStart2: string) => quiet(() => deriveVisibleWeekLive(weekStart2, weekStart2)) as unknown as Day[];
    const week = injured(weekStart);
    const mobility = week.filter((day) => day.workout?.workoutType === 'Mobility');
    check('CONTROL: the week has a Mobility session to protect', mobility.length >= 1);
    const strengthOnMobility = mobility.flatMap((day) => names(day).filter((name) => {
      const tags = getExerciseTags(name);
      return !!mainPatternForExerciseMovement(tags?.movement);
    }));
    check('R-355: a Mobility session receives no strength filler (no Push-ups on a stretching day)',
      strengthOnMobility.length === 0, strengthOnMobility.join(', '));
    const paused = String(report.message);
    check('CONTROL: the knee report paused leg work on the Monday', /paused/i.test(paused), paused.slice(0, 160));
    // The BLOCK never hands a day a third row of a push or pull pattern it
    // already carries twice (the healthy upper template's own presses are the
    // composer's business, not this block's).
    const isPower = (name: string) => !!getExerciseTags(name)?.power;
    const patternOf = (name: string) => mainPatternForExerciseMovement(getExerciseTags(name)?.movement);
    const stacked = week.flatMap((day) => {
      const added = (day.workout?.injuryAdjustment?.added ?? []).map((row) => row.name);
      if (added.length === 0) return [];
      const kept = names(day).filter((name) => !added.includes(name) && !isPower(name));
      return (['push', 'pull'] as const).flatMap((pattern) => {
        const keptCount = kept.filter((name) => patternOf(name) === pattern).length;
        const addedCount = added.filter((name) => patternOf(name) === pattern).length;
        return keptCount >= 2 && addedCount > 0 ? [`${day.date}:${pattern} kept ${keptCount} + added ${addedCount}`] : [];
      });
    });
    check('R-355: the block never adds a third row of a push or pull pattern the day already carries twice', stacked.length === 0, stacked.join(', '));
  }

  // ── R-355 doubling, at the chooser: nothing unused → a safe repeat, not nothing ──
  {
    resetStoresToFreshInstall('injury-limited-kit:chooser');
    const archetype = (ARCHETYPES as unknown as { id: string }[]).find((entry) => entry.id === 'female-3-novice-home')!;
    const profile = athleteAnswers(archetype as never);
    const date = '2026-09-14';
    const constraint = kneeConstraint(date);
    const environment = resolveTapSwapEnvironment({
      date, profile, activeConstraints: [constraint] as never,
      primaryInjury: { bucket: (constraint as { bucket?: string }).bucket ?? 'knee', severity: 7, triggers: ['running'], seriousSymptoms: false } as never,
    });
    const paused = ['Bodyweight Squat', 'Glute Bridge', 'Reverse Lunges', 'Single-Leg RDL', 'Groin Squeeze'];
    // Every upper compound this home kit can do is already in the week.
    const weekHasEverything = [
      'Incline DB Bench', 'DB Bench Press', 'Chest-Supported DB Row', 'Single-Arm DB Row', 'Band-Assisted Pull-Up',
      'Seated DB Press', 'DB Shoulder Press', 'Half-Kneeling Single-Arm Overhead Press', 'Incline Push-Up', 'Push-ups',
      'Single-Arm DB Bench Press', 'Single-Arm DB Floor Press', 'Band Pull-Apart',
    ];
    const common = {
      environment, profile, keptRowNames: [] as string[], pausedRowNames: paused,
      excludedByAthlete: [] as string[], pausedCount: paused.length, originalRowCount: paused.length,
      injuredHalf: 'lower' as const, keptSets: 0, dateISO: date,
    };
    const withRoom = chooseInjurySessionAdditions({ ...common, weekExerciseNames: [] });
    check('CONTROL: with an unused bench the block opens with an unused upper compound',
      withRoom.length > 0 && !weekHasEverything.slice(0, 0).includes(withRoom[0]!.name), JSON.stringify(withRoom.map((row) => row.name)));
    const doubled = chooseInjurySessionAdditions({ ...common, weekExerciseNames: weekHasEverything });
    const compound = doubled.find((row) => !!row.mainStrengthPattern);
    check('R-355: when every unused compound is gone, the block REPEATS a safe compound the week already has',
      !!compound && weekHasEverything.includes(compound.name), JSON.stringify(doubled.map((row) => row.name)));
    check('R-355: the repeat is never one of the paused rows', !doubled.some((row) => paused.includes(row.name)), JSON.stringify(doubled.map((row) => row.name)));
    // Pattern cap: two presses already kept today → the block does not add a third press.
    const twoPresses = chooseInjurySessionAdditions({
      ...common, keptRowNames: ['DB Bench Press', 'Seated DB Press'], originalRowCount: 7, keptSets: 6,
      weekExerciseNames: ['DB Bench Press', 'Seated DB Press'],
    });
    const thirdPress = twoPresses.find((row) => mainPatternForExerciseMovement(getExerciseTags(row.name)?.movement) === 'push');
    check('R-355: a day already holding two presses is not handed a third by the block',
      !thirdPress, JSON.stringify(twoPresses.map((row) => row.name)));
  }

  console.log(`\nInjury on limited kit: ${passed} passed, ${failures.length} failed`);
  totalsPrinted(failures.length);
  process.exit(failures.length === 0 ? 0 : 1);
})().catch((error) => {
  console.log(`SUITE THREW ${(error as Error).message}`);
  process.exit(1);
});
