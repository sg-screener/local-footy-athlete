/**
 * seasonPhaseSkewRepairTests — what an athlete on a already-skewed device
 * actually sees, and what one press actually does.
 *
 * Sam's own device carries the skew this unit closes: the profile write from
 * a phase shift landed, the rebuild did not, and nothing since has said so.
 * Fixing the write path does not fix that device. This suite pins the three
 * things that must hold for stored state that is ALREADY wrong:
 *
 *   [1] hydration reports the skew and repairs nothing behind the athlete's
 *       back — neither value is coerced into agreeing with the other
 *   [2] the setup sheet's Save is live on the selection that repairs it (the
 *       dead tap), and a disabled Save always says why
 *   [3] a hydrated In-season week is never a scheduled deload and never
 *       loses exposures or tonnage without a typed athlete reason
 *
 * Run: npm run test:phase-skew-repair
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
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — hydration repair must be local');
};
process.env.TZ = 'Australia/Melbourne';

import * as fs from 'fs';
import * as path from 'path';
import type { OnboardingData, TrainingProgram } from '../types/domain';
import { generateProgramLocally } from '../services/api/generateProgram';
import { canonicaliseHydratedProgram } from '../store/programStore';
import { ownSeasonPhase, seasonPhaseSkew } from '../rules/seasonPhaseOwner';
import {
  decideProfileSetupChange,
  profileSetupBlockCopy,
} from '../rules/profileSetupChange';
import { resolveWeekIntensityMultiplier } from '../rules/deloadWeekRules';
import { resolveSeasonPhaseWeekKind } from '../rules/seasonPhaseClock';

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

const WEEK_START = '2026-07-13';
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  const first = String(args[0] ?? '');
  if (first.includes('[ProgramGen]') || first.includes('[WorkoutCanonicalisation]')) return;
  originalWarn(...args);
};

function profile(
  phase: NonNullable<OnboardingData['seasonPhase']>,
  overrides: Partial<OnboardingData> = {},
): OnboardingData {
  return {
    seasonPhase: phase,
    firstName: 'Sam',
    position: 'inside_mid',
    motivation: 'Build strength and football fitness',
    trainingDaysPerWeek: 4,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    teamTrainingIntensity: 'Hard',
    trainingLocation: 'Commercial gym',
    equipment: ['Full Gym'],
    equipmentSelectionCompleteness: 'complete',
    experienceLevel: '2-5 years',
    squatStrength: '1.5x bodyweight',
    benchStrength: '1.25x bodyweight',
    conditioningLevel: 'Elite',
    sprintExposure: '2+ times per week',
    recentTrainingLoad: 'Very consistent',
    injuries: [],
    ...overrides,
  } as OnboardingData;
}

function quiet<T>(body: () => T): T {
  const warn = console.warn;
  const error = console.error;
  console.warn = () => {};
  console.error = () => {};
  try { return body(); } finally { console.warn = warn; console.error = error; }
}

function generate(
  value: OnboardingData,
  phaseEntryWeekStartISO = WEEK_START,
  todayISO = WEEK_START,
): TrainingProgram {
  return quiet(() => generateProgramLocally(value, {
    todayISO,
    previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1,
      selectedPhase: value.seasonPhase!,
      phaseEntryWeekStartISO,
      originProvenance: 'explicit_user_phase_change',
    },
  } as never));
}

const setupSelection = (over: Partial<Parameters<typeof decideProfileSetupChange>[0]['selection']> = {}) => ({
  name: 'Sam',
  position: 'inside_mid' as never,
  experience: '2-5 years' as never,
  twoKmSeconds: null,
  twoKmAnswer: null,
  seasonPhase: 'In-season' as const,
  preferredDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'] as never,
  teamDays: [] as never,
  gameDay: 'Saturday' as never,
  ...over,
});

// ═════════════════════════════════════════════════════════════════════
// 1. Hydration reports the skew and repairs nothing silently
// ═════════════════════════════════════════════════════════════════════
section('[1] A skewed device is told, not quietly corrected');
{
  // The exact shape of Sam's device: the profile says In-season because the
  // shift wrote it; the program is still the Pre-season one because the
  // rebuild failed after that write.
  const stored = profile('In-season', { usualGameDay: 'Saturday', gameDay: 'Saturday' });
  const preSeasonProgram = generate(profile('Pre-season'));
  const hydrated = quiet(() => canonicaliseHydratedProgram(preSeasonProgram, stored));

  const owned = ownSeasonPhase({ program: hydrated, profile: stored });
  ok('the clock still owns the phase after hydration', owned.phase === 'Pre-season',
    `phase=${owned.phase}`);
  ok('hydration did not rewrite the athlete selection', stored.seasonPhase === 'In-season');
  ok('hydration did not rewrite the clock',
    hydrated.seasonPhaseClock?.selectedPhase === 'Pre-season',
    String(hydrated.seasonPhaseClock?.selectedPhase));
  ok('the skew survives hydration as a reportable fact', owned.skew !== null);
  ok('the report names both sides',
    owned.skew?.ownedPhase === 'Pre-season' && owned.skew?.profileSelection === 'In-season');
  ok('the detector agrees with the owner',
    seasonPhaseSkew({ program: hydrated, profile: stored })?.ownedPhase === owned.skew?.ownedPhase);
}
{
  // The honest repair path is the SAME atomic transaction a deliberate phase
  // shift uses. Nothing writes one value to match the other directly.
  const store = read('store/programStore.ts');
  ok('hydration never writes profile.seasonPhase',
    !/onboardingData\.seasonPhase\s*=/.test(store) &&
    !/seasonPhase:\s*profile\.seasonPhase\s*\}\s*\)/.test(store));
  const home = read('screens/home/useHomeScreen.ts');
  ok('the home chrome holds the skew report', /ownedPhase\.skew/.test(home));
  ok('the repair runs through the owned transaction, not a direct write',
    /seasonPhaseSkew[\s\S]{0,2000}commitProfileProgramTransaction/.test(home));
  ok('the repair is disclosed to the athlete',
    /seasonPhaseSkew/.test(read('screens/home/HomeScreenV2.tsx')));
}

// ═════════════════════════════════════════════════════════════════════
// 2. The dead tap
// ═════════════════════════════════════════════════════════════════════
section('[2] Save is live on the selection that repairs the skew');
{
  // The athlete opens the sheet on a skewed device, sees In-season, and picks
  // In-season because that is what they are. Under the old comparison — which
  // read profile.seasonPhase — this was "no change", Save went dead, and the
  // rebuild that would have fixed everything never ran.
  const stored = profile('In-season', { usualGameDay: 'Saturday', gameDay: 'Saturday' });
  const dead = decideProfileSetupChange({
    stored,
    ownedPhase: 'Pre-season', // what the program is ACTUALLY built on
    storedPosition: 'inside_mid' as never,
    lfaDayCountNeedsSync: false,
    selection: setupSelection(),
  });
  ok('picking the phase you meant IS a change on a skewed device', dead.hasChanges);
  ok('Save is available', dead.canSave, dead.blockedBy.join(','));
  ok('the patch actually carries the phase', dead.patch.seasonPhase === 'In-season');
  ok('nothing blocks it', dead.blockedBy.length === 0);
}
{
  // The same selection on an UNSKEWED device really is a no-op, and the
  // athlete is told that rather than left with a dead control.
  const stored = profile('In-season', { usualGameDay: 'Saturday', gameDay: 'Saturday' });
  const noop = decideProfileSetupChange({
    stored,
    ownedPhase: 'In-season',
    storedPosition: 'inside_mid' as never,
    lfaDayCountNeedsSync: false,
    selection: setupSelection(),
  });
  ok('an unchanged selection has no changes', !noop.hasChanges);
  ok('an unchanged selection cannot be saved', !noop.canSave);
  ok('and it says why', noop.blockedBy.includes('no_changes'));
  ok('the reason has athlete-facing copy',
    /already/i.test(profileSetupBlockCopy('no_changes')));
}
{
  // The button and the commit read ONE decision. A patch that is empty while
  // canSave is true is the dead tap in its general form; it is now
  // unrepresentable because hasChanges IS "the patch is not empty".
  const stored = profile('Pre-season');
  const cases = [
    { ownedPhase: 'Pre-season' as const, selection: setupSelection({ seasonPhase: 'Pre-season', gameDay: null }) },
    { ownedPhase: 'Pre-season' as const, selection: setupSelection() },
    { ownedPhase: 'In-season' as const, selection: setupSelection({ seasonPhase: 'Off-season', gameDay: null }) },
    { ownedPhase: 'Off-season' as const, selection: setupSelection({ preferredDays: ['Monday'] as never }) },
  ];
  const decisions = cases.map((entry) => decideProfileSetupChange({
    stored,
    ownedPhase: entry.ownedPhase,
    storedPosition: 'inside_mid' as never,
    lfaDayCountNeedsSync: false,
    selection: entry.selection,
  }));
  ok('canSave never outruns a non-empty patch',
    decisions.every((d) => !d.canSave || Object.keys(d.patch).length > 0));
  ok('hasChanges is exactly "the patch is not empty"',
    decisions.every((d) => d.hasChanges === (Object.keys(d.patch).length > 0)));
  ok('every unavailable Save carries at least one reason',
    decisions.every((d) => d.canSave || d.blockedBy.length > 0));
  ok('every reason has copy',
    decisions.every((d) => d.blockedBy.every((reason) => profileSetupBlockCopy(reason).length > 0)));
}
{
  const stored = profile('Pre-season');
  const noDays = decideProfileSetupChange({
    stored,
    ownedPhase: 'Pre-season',
    storedPosition: 'inside_mid' as never,
    lfaDayCountNeedsSync: false,
    selection: setupSelection({ preferredDays: [] as never }),
  });
  ok('no training days blocks Save', noDays.blockedBy.includes('no_training_days'));
  const noGameDay = decideProfileSetupChange({
    stored,
    ownedPhase: 'Pre-season',
    storedPosition: 'inside_mid' as never,
    lfaDayCountNeedsSync: false,
    selection: setupSelection({ gameDay: null }),
  });
  ok('an In-season selection with no game day blocks Save',
    noGameDay.blockedBy.includes('game_day_unanswered'));
}
{
  const screen = read('screens/profile/ProfileScreen.tsx');
  ok('ProfileScreen reads the one decision', /decideProfileSetupChange/.test(screen));
  ok('the second comparison is gone', !/const setupHasChanges =\s*\n?\s*playerProgramHasChanges/.test(screen));
  ok('buildSetupPatch no longer exists as a rival', !/const buildSetupPatch = /.test(screen));
  ok('the commit uses the decision the button read', /setupDecision\.patch/.test(screen));
  ok('a blocked Save renders its reason', /profile-setup-blocked-reason/.test(screen));
}

// ═════════════════════════════════════════════════════════════════════
// 3. What the athlete sees in a hydrated In-season week
// ═════════════════════════════════════════════════════════════════════
section('[3] A hydrated In-season week is never a scheduled deload');
{
  // Every phase week an in-season athlete can be sitting on. Week 4, 8, 12
  // are where the pre-season `% 4 === 0` rule would have minted a deload if
  // the phase had been read from the wrong owner.
  const stored = profile('In-season', { usualGameDay: 'Saturday', gameDay: 'Saturday' });
  const entryWeeks = ['2026-07-13', '2026-06-22', '2026-05-25', '2026-04-27'];
  const deloadWeeks: string[] = [];
  const scaledWeeks: string[] = [];
  for (const entry of entryWeeks) {
    const program = generate(stored, entry, WEEK_START);
    const hydrated = quiet(() => canonicaliseHydratedProgram(program, stored));
    for (const microcycle of hydrated.microcycles ?? []) {
      if (microcycle.weekKind === 'deload') deloadWeeks.push(`${entry}:${microcycle.startDate}`);
      if ((microcycle.intensityMultiplier ?? 1) !== 1) {
        scaledWeeks.push(`${entry}:${microcycle.startDate}=${microcycle.intensityMultiplier}`);
      }
    }
  }
  ok('no hydrated In-season week is a deload week',
    deloadWeeks.length === 0, deloadWeeks.join(', '));
  ok('no hydrated In-season week loses tonnage to an intensity multiplier',
    scaledWeeks.length === 0, scaledWeeks.join(', '));
}
{
  // Exposures survive hydration. A week that hydrates with fewer sessions
  // than it was published with has lost work no athlete asked to lose.
  const stored = profile('In-season', { usualGameDay: 'Saturday', gameDay: 'Saturday' });
  const program = generate(stored, '2026-06-22', WEEK_START);
  const before = (program.microcycles ?? []).map((microcycle) => ({
    start: microcycle.startDate,
    workouts: (microcycle.workouts ?? []).length,
  }));
  const hydrated = quiet(() => canonicaliseHydratedProgram(program, stored));
  const after = (hydrated.microcycles ?? []).map((microcycle) => ({
    start: microcycle.startDate,
    workouts: (microcycle.workouts ?? []).length,
  }));
  const lost = before.filter((week, index) => (after[index]?.workouts ?? 0) < week.workouts)
    .map((week, index) => `${week.start}: ${week.workouts}→${after[index]?.workouts}`);
  ok('hydration drops no session from an In-season week', lost.length === 0, lost.join(', '));
  ok('the week count is unchanged by hydration', before.length === after.length);
}
{
  // CORRECTION to how this duplicate was first described. programStore's own
  // table returned 0.9 for an in-season deload where the owner holds at 1.0 —
  // but that branch was DORMANT, not active: `resolveSeasonPhaseWeekKind`
  // never mints a deload week in-season, so nothing could reach the 0.9. The
  // duplicate was a second table free to drift, in the same class as
  // progressionRules' in-season threshold, and not a live tonnage loss.
  //
  // Pin the dormancy, so a future change that makes an in-season scheduled
  // deload reachable has to come past this line.
  const inSeasonDeloadWeeks: number[] = [];
  for (let week = 1; week <= 60; week += 1) {
    if (resolveSeasonPhaseWeekKind('In-season', week) === 'deload') inSeasonDeloadWeeks.push(week);
  }
  ok('no in-season phase week is ever a SCHEDULED deload',
    inSeasonDeloadWeeks.length === 0, inSeasonDeloadWeeks.join(','));
  ok('pre-season still schedules one every fourth week',
    resolveSeasonPhaseWeekKind('Pre-season', 4) === 'deload');

  ok('an in-season deload holds the weight',
    resolveWeekIntensityMultiplier('In-season', 'deload') === 1);
  ok('an in-season build week holds the weight',
    resolveWeekIntensityMultiplier('In-season', 'build') === 1);
  ok('an unset phase is not treated as off-season',
    resolveWeekIntensityMultiplier(null, 'deload') === 1);
}
{
  // Differential over the REACHABLE space: whatever the hydration path puts
  // on a microcycle must equal what the intensity owner says for that week's
  // phase and kind. This is the assertion a second table has to survive, and
  // unlike a source grep it also catches a table that drifts in value.
  const drifted: string[] = [];
  const checked: string[] = [];
  for (const phase of ['Off-season', 'Pre-season', 'In-season'] as const) {
    const stored = phase === 'In-season'
      ? profile(phase, { usualGameDay: 'Saturday', gameDay: 'Saturday' })
      : profile(phase);
    // Entry weeks reaching phase weeks 1, 4, 8 and 12 relative to WEEK_START,
    // which covers both deload rules and the build weeks between them.
    for (const entry of ['2026-07-13', '2026-06-22', '2026-05-25', '2026-04-27']) {
      const program = generate(stored, entry, WEEK_START);
      const hydrated = quiet(() => canonicaliseHydratedProgram(program, stored));
      for (const microcycle of hydrated.microcycles ?? []) {
        const expected = resolveWeekIntensityMultiplier(phase, microcycle.weekKind);
        checked.push(`${phase}/${microcycle.weekKind}`);
        if ((microcycle.intensityMultiplier ?? 1) !== expected) {
          drifted.push(
            `${phase} ${microcycle.startDate} ${microcycle.weekKind}: ` +
            `${microcycle.intensityMultiplier} ≠ ${expected}`,
          );
        }
      }
    }
  }
  ok('hydration agrees with the intensity owner on every reachable week',
    drifted.length === 0, drifted.join('; '));
  ok('the differential actually covered a deload week',
    checked.some((entry) => entry.endsWith('/deload')),
    `covered: ${Array.from(new Set(checked)).join(', ')}`);
}

// ─── Summary ───
console.log(`\n— Summary —`);
console.log(`  Pass: ${pass}`);
console.log(`  Fail: ${fail}`);
if (fail > 0) {
  console.log(`\n— Failures —`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
process.exit(0);
