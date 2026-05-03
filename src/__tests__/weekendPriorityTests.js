/**
 * Weekend Priority Tests
 *
 * Verifies that Saturday is prioritised over Sunday for core allocation
 * when there is no game day. The training-week sort order should be
 * Mon(1) → Sat(6) → Sun(0→7), ensuring Sunday is always the
 * lowest-priority day for core sessions.
 */

const { buildCoachingPlan, onboardingToCoachingInputs } = require('/tmp/lfa-compiled/src/utils/coachingEngine');

let pass = 0;
let fail = 0;

function assert(condition, msg) {
  if (condition) { pass++; }
  else { fail++; console.error(`  FAIL: ${msg}`); }
}

function findDay(plan, dayName) {
  return plan.find(s => s.dayOfWeek === dayName);
}

const TIER_PRIORITY = { core: 3, optional: 2, recovery: 1 };

// ─── Test 1: Pre-season, no game, Sat+Sun both selected ───
console.log('\n=== Test 1: Pre-season, no game — Saturday >= Sunday in tier priority ===');
{
  const onboarding = {
    seasonPhase: 'Pre-season',
    gameDay: undefined,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday', 'Saturday', 'Sunday'],
    trainingDaysPerWeek: 5,
    experienceLevel: '2-5 years',
    sessionDurationMinutes: 75,
    trainingLocation: 'Full Gym',
    equipment: ['Barbell', 'Dumbbells', 'Cable Machine'],
    injuries: [],
  };
  const inputs = onboardingToCoachingInputs(onboarding);
  const plan = buildCoachingPlan(inputs);

  const sat = findDay(plan.weeklyPlan, 'Saturday');
  const sun = findDay(plan.weeklyPlan, 'Sunday');

  console.log('  Saturday:', sat ? `${sat.tier} — ${sat.focus}` : 'not in plan');
  console.log('  Sunday:', sun ? `${sun.tier} — ${sun.focus}` : 'not in plan');

  assert(sat, 'Saturday is in the plan');
  assert(sun, 'Sunday is in the plan');
  if (sat && sun) {
    assert(
      TIER_PRIORITY[sat.tier] >= TIER_PRIORITY[sun.tier],
      `Saturday tier (${sat.tier}) should be >= Sunday tier (${sun.tier})`
    );
    assert(
      sun.tier !== 'core',
      `Sunday should not be core when Saturday is also available (got: ${sun.tier})`
    );
  }
}

// ─── Test 2: Off-season, no game, Sat+Sun both selected ───
console.log('\n=== Test 2: Off-season, no game — Saturday >= Sunday in tier priority ===');
{
  const onboarding = {
    seasonPhase: 'Off-season',
    gameDay: undefined,
    teamTrainingDays: [],
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday', 'Saturday', 'Sunday'],
    trainingDaysPerWeek: 5,
    experienceLevel: '2-5 years',
    sessionDurationMinutes: 75,
    trainingLocation: 'Full Gym',
    equipment: ['Barbell', 'Dumbbells', 'Cable Machine'],
    injuries: [],
  };
  const inputs = onboardingToCoachingInputs(onboarding);
  const plan = buildCoachingPlan(inputs);

  const sat = findDay(plan.weeklyPlan, 'Saturday');
  const sun = findDay(plan.weeklyPlan, 'Sunday');

  console.log('  Saturday:', sat ? `${sat.tier} — ${sat.focus}` : 'not in plan');
  console.log('  Sunday:', sun ? `${sun.tier} — ${sun.focus}` : 'not in plan');

  assert(sat, 'Saturday is in the plan');
  assert(sun, 'Sunday is in the plan');
  if (sat && sun) {
    assert(
      TIER_PRIORITY[sat.tier] >= TIER_PRIORITY[sun.tier],
      `Saturday tier (${sat.tier}) should be >= Sunday tier (${sun.tier})`
    );
  }
}

// ─── Test 3: In-season, no game (bye week) — explicit Saturday/Sunday handling ───
console.log('\n=== Test 3: In-season no game (bye week) — Saturday=core, Sunday=recovery ===');
{
  const onboarding = {
    seasonPhase: 'In-season',
    gameDay: undefined,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday', 'Saturday', 'Sunday'],
    trainingDaysPerWeek: 5,
    experienceLevel: '2-5 years',
    sessionDurationMinutes: 60,
    trainingLocation: 'Full Gym',
    equipment: ['Barbell', 'Dumbbells'],
    injuries: [],
  };
  const inputs = onboardingToCoachingInputs(onboarding);
  const plan = buildCoachingPlan(inputs);

  const sat = findDay(plan.weeklyPlan, 'Saturday');
  const sun = findDay(plan.weeklyPlan, 'Sunday');

  console.log('  Saturday:', sat ? `${sat.tier} — ${sat.focus}` : 'not in plan');
  console.log('  Sunday:', sun ? `${sun.tier} — ${sun.focus}` : 'not in plan');

  assert(sat && sat.tier === 'core', `In-season no-game Saturday should be core (got: ${sat?.tier})`);
  assert(sun && sun.tier === 'recovery', `In-season no-game Sunday should be recovery (got: ${sun?.tier})`);
}

// ─── Test 4: Only Sat+Sun available, 1 core — Saturday gets core ───
console.log('\n=== Test 4: Only Sat+Sun, 1 core — Saturday gets core ===');
{
  const onboarding = {
    seasonPhase: 'Pre-season',
    gameDay: undefined,
    teamTrainingDays: [],
    preferredTrainingDays: ['Saturday', 'Sunday'],
    trainingDaysPerWeek: 2,
    experienceLevel: '0-2 years',
    sessionDurationMinutes: 60,
    trainingLocation: 'Full Gym',
    equipment: ['Dumbbells'],
    injuries: [],
  };
  const inputs = onboardingToCoachingInputs(onboarding);
  const plan = buildCoachingPlan(inputs);

  const sat = findDay(plan.weeklyPlan, 'Saturday');
  const sun = findDay(plan.weeklyPlan, 'Sunday');

  console.log('  Saturday:', sat ? `${sat.tier} — ${sat.focus}` : 'not in plan');
  console.log('  Sunday:', sun ? `${sun.tier} — ${sun.focus}` : 'not in plan');

  if (sat && sun) {
    // With only 2 days and enough core budget, both may be core — that's fine.
    // The key invariant: Saturday should always be core if Sunday is.
    assert(sat.tier === 'core', `Saturday should be core (got: ${sat.tier})`);
    assert(
      TIER_PRIORITY[sat.tier] >= TIER_PRIORITY[sun.tier],
      `Saturday tier (${sat.tier}) should be >= Sunday tier (${sun.tier})`
    );
  } else {
    assert(sat, 'Saturday should be in plan');
    assert(sun, 'Sunday should be in plan');
  }
}

// ─── Test 5: Many days, verify Sunday never gets core over Saturday ───
console.log('\n=== Test 5: 6-day pre-season — Sunday is never core ===');
{
  const onboarding = {
    seasonPhase: 'Pre-season',
    gameDay: undefined,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    trainingDaysPerWeek: 7,
    experienceLevel: '2-5 years',
    sessionDurationMinutes: 75,
    trainingLocation: 'Full Gym',
    equipment: ['Barbell', 'Dumbbells', 'Cable Machine'],
    injuries: [],
  };
  const inputs = onboardingToCoachingInputs(onboarding);
  const plan = buildCoachingPlan(inputs);

  const sun = findDay(plan.weeklyPlan, 'Sunday');

  console.log('  Full plan:');
  plan.weeklyPlan.forEach(s => console.log(`    ${s.dayOfWeek}: [${s.tier}] ${s.focus}`));

  assert(sun && sun.tier !== 'core', `Sunday should not be core in a full week (got: ${sun?.tier})`);
}

console.log(`\n══════════════════════════════════════════════════`);
console.log(`Weekend Priority Tests: ${pass} passed, ${fail} failed`);
console.log(`══════════════════════════════════════════════════\n`);
process.exit(fail > 0 ? 1 : 0);
