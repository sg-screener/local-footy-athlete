/**
 * seasonPhaseOwnershipTests — ONE owner answers "what season phase is it?".
 *
 * The disease this suite pins: the app carried TWO answers to the season
 * phase. `profile.seasonPhase` (the athlete's stored selection) and
 * `program.seasonPhaseClock.selectedPhase` (the clock the visible week is
 * built from). The chrome read one, the week read the other, and a failed
 * rebuild left them skewed in either direction with nothing to say so.
 *
 * The fix is ownership, not detection: the CLOCK owns the phase, the profile
 * selection is the INPUT the clock is minted from, and the only writer of
 * both is the atomic profile/program transaction. This suite proves:
 *
 *   [1] the owner answers once, and names where its answer came from
 *   [2] skew is a typed, reported fact — never a silent second answer
 *   [3] every fixture-kind producer reads the SAME phase expression
 *   [4] no second deload decider survives (D16 binds them all)
 *   [5] the hydrated in-season week is never a scheduled deload
 *
 * Run: npm run test:phase-ownership
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import * as fs from 'fs';
import * as path from 'path';
import type { SeasonPhase, TrainingProgram } from '../types/domain';
import {
  ownSeasonPhase,
  ownSeasonPhaseForGeneration,
  seasonPhaseSkew,
} from '../rules/seasonPhaseOwner';
import { canonicalFixtureKind } from '../rules/fixtureConditionedAvailability';
import {
  resolveDeloadWeekPolicy,
  resolveWeekIntensityMultiplier,
} from '../rules/deloadWeekRules';
import { resolveProgression } from '../utils/progressionRules';

// ─── Harness ─────────────────────────────────────────────────────────
let pass = 0;
let fail = 0;
const failures: string[] = [];
function ok(name: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; failures.push(name); console.log(`  ✗ ${name}${detail ? '\n      ' + detail : ''}`); }
}
function section(label: string) { console.log(`\n${label}`); }

const SRC = path.resolve(__dirname, '..');
const read = (relative: string) => fs.readFileSync(path.join(SRC, relative), 'utf8');

function programWithClock(
  selectedPhase: SeasonPhase,
  phaseEntryWeekStartISO = '2026-06-01',
): TrainingProgram {
  return {
    id: 'test-program',
    programPhase: 'Off-Season Base',
    startDate: phaseEntryWeekStartISO,
    microcycles: [],
    seasonPhaseClock: {
      protocolVersion: 1,
      selectedPhase,
      phaseEntryWeekStartISO,
      originProvenance: 'explicit_user_phase_change',
      persistenceProvenance: 'preserved_persisted_state',
    },
  } as unknown as TrainingProgram;
}

// ═════════════════════════════════════════════════════════════════════
// 1. The owner answers once and names its source
// ═════════════════════════════════════════════════════════════════════
section('[1] One owner, one answer, named provenance');
{
  const owned = ownSeasonPhase({
    program: programWithClock('In-season'),
    profile: { seasonPhase: 'In-season' },
  });
  ok('valid clock answers', owned.phase === 'In-season');
  ok('source names the clock', owned.source === 'program_clock');
  ok('profile selection is retained as an input', owned.profileSelection === 'In-season');
  ok('agreement is not skew', owned.skew === null);
}
{
  // No program yet (fresh account, pre-generation): the athlete's stored
  // selection IS the input, and it must be named as such.
  const owned = ownSeasonPhase({ program: null, profile: { seasonPhase: 'Pre-season' } });
  ok('no program → profile selection answers', owned.phase === 'Pre-season');
  ok('source names the profile selection', owned.source === 'profile_selection');
  ok('a lone input is not skew', owned.skew === null);
}
{
  const owned = ownSeasonPhase({ program: null, profile: null });
  ok('nothing has answered → phase is null', owned.phase === null);
  ok('nothing has answered → source is absent', owned.source === 'absent');
}
{
  // A legacy program with no valid clock still answers from its own phase
  // string — but it must NOT masquerade as a clock answer.
  const legacy = {
    id: 'legacy',
    programPhase: 'Pre-Season',
    startDate: '2026-06-01',
    microcycles: [],
  } as unknown as TrainingProgram;
  const owned = ownSeasonPhase({ program: legacy, profile: { seasonPhase: 'In-season' } });
  ok('legacy program answers from programPhase', owned.phase === 'Pre-season');
  ok('legacy answer is named a migration, not a clock',
    owned.source === 'program_phase_migration');
}

// ═════════════════════════════════════════════════════════════════════
// 2. Skew is a typed reported fact, never a second answer
// ═════════════════════════════════════════════════════════════════════
section('[2] Skew is reported, never silently resolved');
{
  // Sam's own device: the profile write landed, the rebuild did not.
  const owned = ownSeasonPhase({
    program: programWithClock('Pre-season', '2026-06-01'),
    profile: { seasonPhase: 'In-season' },
  });
  ok('the clock still owns the answer under skew', owned.phase === 'Pre-season');
  ok('skew is reported', owned.skew !== null);
  ok('skew names the owned phase', owned.skew?.ownedPhase === 'Pre-season');
  ok('skew names the athlete selection that disagrees',
    owned.skew?.profileSelection === 'In-season');
  ok('skew carries the phase entry week for disclosure',
    owned.skew?.phaseEntryWeekStartISO === '2026-06-01');
  ok('neither value was mutated by detection',
    owned.profileSelection === 'In-season' && owned.phase === 'Pre-season');
}
{
  // Skew in the other direction — a rebuild that landed while the profile
  // write failed — is the same fact, reported the same way.
  const owned = ownSeasonPhase({
    program: programWithClock('In-season'),
    profile: { seasonPhase: 'Off-season' },
  });
  ok('reverse skew is reported too', owned.skew !== null);
  ok('reverse skew names both sides',
    owned.skew?.ownedPhase === 'In-season' && owned.skew?.profileSelection === 'Off-season');
}
{
  ok('seasonPhaseSkew() is the one detector',
    seasonPhaseSkew({
      program: programWithClock('Pre-season'),
      profile: { seasonPhase: 'In-season' },
    })?.profileSelection === 'In-season');
  ok('no program means nothing to be skewed against',
    seasonPhaseSkew({ program: null, profile: { seasonPhase: 'In-season' } }) === null);
}

// ═════════════════════════════════════════════════════════════════════
// 3. Every fixture-kind producer reads the SAME phase expression
// ═════════════════════════════════════════════════════════════════════
section('[3] One fixture-kind expression');
{
  const cases: Array<[SeasonPhase, string]> = [
    ['Pre-season', 'practice_match'],
    ['In-season', 'game'],
    ['Off-season', 'game'],
  ];
  for (const [phase, expected] of cases) {
    ok(`${phase} → ${expected} (owned by clock)`,
      canonicalFixtureKind(ownSeasonPhase({
        program: programWithClock(phase),
        profile: { seasonPhase: phase },
      })) === expected);
    ok(`${phase} → ${expected} (generation input)`,
      canonicalFixtureKind(ownSeasonPhaseForGeneration({ seasonPhase: phase })) === expected);
  }
}
{
  // The whole point: under skew the fixture kind follows the OWNER, so the
  // fixture the athlete sees and the fixture the transaction validates are
  // the same fixture. Before this, one read the clock and one read the
  // profile, and a practice match could be refused as a game.
  const owned = ownSeasonPhase({
    program: programWithClock('Pre-season'),
    profile: { seasonPhase: 'In-season' },
  });
  ok('under skew the fixture kind follows the clock, not the profile',
    canonicalFixtureKind(owned) === 'practice_match');
}
{
  // Source gate: the ternary that decides fixture kind may exist exactly
  // once in src/. Six copies is how the two owners stayed invisible.
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
        walk(full);
      } else if (/\.tsx?$/.test(entry.name)) {
        files.push(full);
      }
    }
  };
  walk(SRC);
  // Comments are stripped first. A gate that reads code is coupled to the
  // code's SHAPE, and prose that quotes the very expression it forbids would
  // otherwise both trip it and — worse — let a real copy hide inside a
  // block comment that someone later uncomments.
  const stripComments = (text: string) =>
    text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const decider = /Pre-season['"]\s*\n?\s*\?\s*['"]practice_match['"]\s*:\s*['"]game['"]/;
  const offenders = files.filter((file) => {
    if (file.endsWith(path.join('rules', 'fixtureConditionedAvailability.ts'))) return false;
    return decider.test(stripComments(fs.readFileSync(file, 'utf8')));
  }).map((file) => path.relative(SRC, file));
  ok('no second phase→fixture-kind decider anywhere in src/',
    offenders.length === 0,
    offenders.join(', '));
  ok('the one decider is a real expression, not a comment',
    decider.test(stripComments(read('rules/fixtureConditionedAvailability.ts'))));
}
{
  // The dead duplicate is gone rather than left as a door.
  ok('fixtureKindForPhase() deleted from gameChangeCoachNotes',
    !/export function fixtureKindForPhase/.test(read('utils/gameChangeCoachNotes.ts')));
}

// ═════════════════════════════════════════════════════════════════════
// 4. The readers read the owner
// ═════════════════════════════════════════════════════════════════════
section('[4] useSchedule and the home chrome read the one owner');
{
  const schedule = read('hooks/useSchedule.ts');
  ok('useSchedule imports the owner', /ownSeasonPhase/.test(schedule));
  ok('useSchedule no longer reads onboardingData.seasonPhase as an answer',
    !/onboardingData\?\.seasonPhase\)/.test(schedule));
  const home = read('screens/home/useHomeScreen.ts');
  ok('useHomeScreen resolves currentPhase through the owner',
    /ownSeasonPhase\(/.test(home));
  ok('useHomeScreen no longer falls back to the profile as a second answer',
    !/seasonPhaseFromProgram\(currentProgram\)\s*\n?\s*\?\?\s*onboardingData\.seasonPhase/.test(home));
  const profileScreen = read('screens/profile/ProfileScreen.tsx');
  ok('ProfileScreen resolves the current phase through the owner',
    /ownSeasonPhase\(/.test(profileScreen));
}

// ═════════════════════════════════════════════════════════════════════
// 5. No second deload decider (D16 binds every door)
// ═════════════════════════════════════════════════════════════════════
section('[5] One deload decider');
{
  // The SCHEDULED door only. `sessionFeeling: 'Sore'` is a fatigue signal for
  // step 4 but is NOT one of the soft-deload signals in step 3, so this input
  // reaches the scheduled branch and nothing else.
  const scheduledDoorOnly = (seasonPhase: SeasonPhase, weeksSinceDeload: number) =>
    resolveProgression({
      exerciseRole: 'primary_strength',
      seasonPhase,
      readiness: 'medium',
      completionQuality: 'full',
      weeksSinceDeload,
      consecutiveBuildWeeks: 2,
      recentRPE: 7,
      daysToGame: null,
      daysSinceGame: null,
      doubleGameWeek: false,
      weeksOffTraining: 0,
      injuryAvoidFlag: false,
      recentDeloadTrigger: null,
      missedSessionsThisWeek: 0,
      sessionFeeling: 'Sore',
      trend: 'flat',
      isLowerBody: false,
      consecutiveFullCompletions: 1,
    });

  // D16: no SCHEDULED in-season deloads. The progression rules carried their
  // own in-season 4-week threshold that nothing gated.
  const inSeasonAtFour = scheduledDoorOnly('In-season', 4);
  ok('in-season scheduled deload no longer fires at the old 4-week threshold',
    inSeasonAtFour.state !== 'deload',
    `state=${inSeasonAtFour.state} note=${inSeasonAtFour.note}`);
  const inSeasonAtSix = scheduledDoorOnly('In-season', 6);
  ok('in-season scheduled deload does not fire at six weeks either (D16)',
    inSeasonAtSix.state !== 'deload',
    `state=${inSeasonAtSix.state} note=${inSeasonAtSix.note}`);

  // Off-season still deloads on schedule — the gate is the phase, not the door.
  ok('off-season scheduled deload still fires at six weeks',
    scheduledDoorOnly('Off-season', 6).state === 'deload');
  ok('pre-season scheduled deload still fires at six weeks',
    scheduledDoorOnly('Pre-season', 6).state === 'deload');
  ok('off-season below the threshold does not deload',
    scheduledDoorOnly('Off-season', 3).state !== 'deload');
}
{
  // The in-season doors D16 DOES name still work — an athlete-driven deload
  // is reachable in-season through readiness/illness, and gating those the
  // same way would leave in-season unable to back off at all.
  const hardTrigger = resolveProgression({
    exerciseRole: 'primary_strength',
    seasonPhase: 'In-season',
    readiness: 'low',
    completionQuality: 'partial',
    weeksSinceDeload: 1,
    consecutiveBuildWeeks: 0,
    recentRPE: 9,
    daysToGame: null,
    daysSinceGame: null,
    doubleGameWeek: false,
    weeksOffTraining: 0,
    injuryAvoidFlag: false,
    recentDeloadTrigger: null,
    missedSessionsThisWeek: 0,
    sessionFeeling: 'Cooked',
    trend: 'down',
    isLowerBody: false,
    consecutiveFullCompletions: 0,
  });
  ok('in-season athlete-signal deload still fires', hardTrigger.state === 'deload');
}
{
  ok('the scheduled door still refuses in-season (D16)',
    resolveDeloadWeekPolicy('In-season', 'deload') === null);
  ok('the scheduled door still opens off-season',
    resolveDeloadWeekPolicy('Off-season', 'deload')?.intensityMultiplier === 0.85);
}
{
  // Source gate: the phase→intensity table lives in exactly one owner.
  const store = read('store/programStore.ts');
  ok('programStore no longer carries its own intensity table',
    !/selectedPhase === 'Off-season' \? 0\.85 : 0\.9/.test(store));
  ok('programStore folds into the intensity owner',
    /resolveWeekIntensityMultiplier/.test(store));
  const progression = read('utils/progressionRules.ts');
  ok('progressionRules no longer carries its own in-season threshold',
    !/seasonPhase === 'In-season' \? 4 : 6/.test(progression));
}
{
  // In-season deload intensity is HOLD (1.0). The duplicate table returned
  // 0.9 — a silent 10% tonnage drop with no athlete reason behind it.
  ok('in-season deload holds the weight', resolveWeekIntensityMultiplier('In-season', 'deload') === 1.0);
  ok('off-season deload drops to 0.85', resolveWeekIntensityMultiplier('Off-season', 'deload') === 0.85);
  ok('pre-season deload drops to 0.9', resolveWeekIntensityMultiplier('Pre-season', 'deload') === 0.9);
  ok('a build week never scales', resolveWeekIntensityMultiplier('In-season', 'build') === 1.0);
}

// ─── Summary ───
console.log(`\n— Summary —`);
console.log(`  Pass: ${pass}`);
console.log(`  Fail: ${fail}`);
totalsPrinted(fail);
if (fail > 0) {
  console.log(`\n— Failures —`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
// TOTALS-OR-RED (Sam, 2026-08-03): the explicit exit is GONE, not moved.
// `process.exit(0)` hard-overrides `process.exitCode`, so it silently
// un-arms this suite — proven by a surviving mutation during the rollout.
// `totalsPrinted(...)` above already set the correct code from the report.
