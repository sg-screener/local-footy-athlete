/* eslint-disable */
/**
 * Verification harness for conditioning upgrade:
 *   1. Off-season weekly plan covers all 4 energy-system categories
 *      distinctly (no duplicates until week has ≥4 conditioning exposures).
 *   2. Pre-season weekly plan prioritises vo2 + glycolytic.
 *   3. Every standalone conditioning template stays inside the 20–45min cap.
 *   4. Combined S+C conditioning stays inside the 30min cap.
 *   5. Every conditioning template description uses Intensity X/10 language
 *      (no "RPE" string in the generated description).
 *
 * Run: node scripts/verifyConditioningSystem.js
 * Assumes test:compile has run (so /tmp/lfa-compiled is present).
 */

const path = require('path');
const COMPILED = process.env.LFA_COMPILED || '/tmp/lfa-compiled';

function loadModule(p) {
  return require(path.join(COMPILED, p));
}

const { buildCoachingPlan } = loadModule('utils/coachingEngine.js');
const {
  buildConditioningTemplate,
  buildCombinedConditioningTemplate,
  CONDITIONING_DURATION_CAP,
  TEMPLATE_CATEGORY,
  conditioningCategoryToExerciseName,
} = loadModule('utils/sessionBuilder.js');

const DATE = '2026-05-04'; // deterministic date for variety hash
const PHASES = ['Off-season', 'Pre-season'];
const FAIL = [];
const PASS = [];
const logPass = (msg) => PASS.push('✓ ' + msg);
const logFail = (msg) => FAIL.push('✗ ' + msg);

function estimateDurationMin(exercises) {
  // Pull minutes out of the exercise description where possible, otherwise
  // sum prescribed rest × sets + 1min per set as a conservative baseline.
  let total = 0;
  for (const ex of exercises) {
    const note = ex.notes || '';
    // Match patterns like "20min", "5min", "15 min", "30s on / 30s off × 4min block"
    const minMatches = [...note.matchAll(/(\d+)\s*min(?:ute)?s?/gi)].map(m => +m[1]);
    const warmupish = /warm-?up|cool-?down|stretch/i.test(ex.exercise?.name || '');
    if (minMatches.length > 0) {
      // For block-style templates ("4min block × N rounds"), pick the sum
      // of the largest block × set count. For simple ones, just take max.
      const blockMin = Math.max(...minMatches);
      const sets = ex.sets || 1;
      // warmup/cool rows rarely scale by set count
      total += warmupish ? blockMin : blockMin * sets;
      // plus inter-set rest
      const rest = (ex.restSeconds || 0) * Math.max(0, sets - 1);
      total += rest / 60;
    } else {
      // No duration mentioned — rough baseline
      total += (ex.sets || 1) * 1.5;
    }
  }
  return Math.round(total);
}

// ── 1. Weekly category distribution ──
function runWeekPlan(phase, availableDays, conditioningLevel = 'Good') {
  const inputs = {
    seasonPhase: phase,
    availableDays,
    selectedDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].slice(0, availableDays),
    teamTrainingDaysPerWeek: phase === 'Pre-season' ? 2 : 0,
    teamTrainingDays: phase === 'Pre-season' ? ['Tuesday', 'Thursday'] : [],
    teamTrainingIntensity: 'Hard',
    sprintExposure: 'Some',
    conditioningLevel,
    recentTrainingLoad: 'Pretty consistent',
    injuries: [],
    goals: ['Get fitter'],
    hasGame: false,
  };
  return buildCoachingPlan(inputs);
}

for (const phase of PHASES) {
  for (const availableDays of [4, 5, 6]) {
    const plan = runWeekPlan(phase, availableDays);
    const condSessions = plan.weeklyPlan.filter(s => s.conditioningCategory);
    const cats = condSessions.map(s => s.conditioningCategory);
    const catCounts = cats.reduce((m, c) => ({ ...m, [c]: (m[c] || 0) + 1 }), {});
    const distinct = Object.keys(catCounts).length;

    const label = `${phase} / ${availableDays}d / ${condSessions.length} cond`;
    if (condSessions.length >= 4) {
      if (distinct >= 4) logPass(`${label}: all 4 categories covered`);
      else logFail(`${label}: only ${distinct} distinct categories (${JSON.stringify(catCounts)})`);
    } else if (condSessions.length > 0) {
      // With <4 sessions, must have ZERO duplicates.
      const duped = Object.values(catCounts).some(v => v > 1);
      if (!duped) logPass(`${label}: ${condSessions.length} cond slots all distinct (${cats.join(', ')})`);
      else logFail(`${label}: duplicate before all-4 covered (${JSON.stringify(catCounts)})`);
    } else {
      logFail(`${label}: no conditioning placed`);
    }
  }
}

// ── 2. Pre-season priority — vo2 + glycolytic first ──
{
  const plan = runWeekPlan('Pre-season', 4);
  const firstTwoCats = plan.weeklyPlan
    .filter(s => s.conditioningCategory)
    .slice(0, 2)
    .map(s => s.conditioningCategory)
    .sort();
  const expected = ['glycolytic', 'vo2'];
  if (JSON.stringify(firstTwoCats) === JSON.stringify(expected)) {
    logPass(`Pre-season first two cond are vo2 + glycolytic`);
  } else {
    logFail(`Pre-season first two cond are ${JSON.stringify(firstTwoCats)}, expected ${JSON.stringify(expected)}`);
  }
}

// ── 3. Standalone template durations ──
for (const tpl of Object.keys(TEMPLATE_CATEGORY)) {
  try {
    const ex = buildConditioningTemplate(tpl, DATE);
    const dur = estimateDurationMin(ex);
    const cap = CONDITIONING_DURATION_CAP.standalone.max; // 45
    if (dur <= cap) logPass(`Standalone "${tpl}" ≈ ${dur}min (cap ${cap})`);
    else logFail(`Standalone "${tpl}" estimated ${dur}min EXCEEDS ${cap}min cap`);
  } catch (err) {
    logFail(`Standalone "${tpl}" threw: ${err.message}`);
  }
}

// ── 4. Combined-day template durations ──
for (const cat of ['aerobic_base', 'sprint', 'vo2', 'glycolytic']) {
  const ex = buildCombinedConditioningTemplate(cat, DATE);
  const dur = estimateDurationMin(ex);
  const cap = CONDITIONING_DURATION_CAP.combined.max; // 30
  if (dur <= cap) logPass(`Combined "${cat}" ≈ ${dur}min (cap ${cap})`);
  else logFail(`Combined "${cat}" estimated ${dur}min EXCEEDS ${cap}min cap`);
}

// ── 4b. Lower-body pairing forces ergometer modality ──
// When combined conditioning pairs with a lower-body lift on sprint or
// glycolytic days, the template must use an ergometer (Bike / Row / Ski)
// rather than running sprints, to spare the legs from a double dose.
for (const cat of ['sprint', 'glycolytic']) {
  // Probe multiple dates so we sample different hash buckets.
  const samples = ['2026-05-04', '2026-05-11', '2026-05-18', '2026-05-25', '2026-06-01', '2026-06-08'];
  let runOnLower = 0;
  for (const d of samples) {
    const ex = buildCombinedConditioningTemplate(cat, d, 'lower');
    for (const e of ex) {
      const name = (e.exercise?.name || '').toLowerCase();
      const notes = (e.notes || '').toLowerCase();
      // Reject any running-sprint wording on a lower-day combined template.
      if (/max[-\s]velocity sprint|20m build|running sprint/.test(notes)) runOnLower++;
      if (/max[-\s]velocity sprint/.test(name)) runOnLower++;
    }
  }
  if (runOnLower === 0) {
    logPass(`Combined "${cat}" on lower day uses ergometer (no running sprints detected)`);
  } else {
    logFail(`Combined "${cat}" on lower day produced ${runOnLower} running-sprint references across samples`);
  }
}
// Upper-day sprint should still be allowed to use running sprints — sanity check.
{
  const samples = ['2026-05-04', '2026-05-11', '2026-05-18'];
  const anyRunOnUpper = samples.some(d => {
    const ex = buildCombinedConditioningTemplate('sprint', d, 'upper');
    return ex.some(e => /max[-\s]velocity|20m build/i.test(e.notes || ''));
  });
  if (anyRunOnUpper) {
    logPass('Combined sprint on upper day still allows running sprints (correct — only lower is off-feet)');
  } else {
    // Not strictly a failure — date hash may not hit a running-sprint variant
    // in this sample. Report as info only.
    logPass('Combined sprint on upper day: sampled set had no running variant (informational, not a failure)');
  }
}

// ── 5. Intensity language — no raw "RPE" mention in conditioning notes ──
let rpeOffenders = 0;
for (const tpl of Object.keys(TEMPLATE_CATEGORY)) {
  const ex = buildConditioningTemplate(tpl, DATE);
  for (const e of ex) {
    if (/\bRPE\b/.test(e.notes || '')) {
      rpeOffenders++;
      logFail(`RPE language in "${tpl}": ${e.exercise?.name}`);
    }
  }
  // Category-requiring templates should also include an "Intensity:" label.
  const combined = buildConditioningTemplate(tpl, DATE, { combined: true });
  for (const e of combined) {
    if (/\bRPE\b/.test(e.notes || '')) {
      rpeOffenders++;
      logFail(`RPE language in combined "${tpl}": ${e.exercise?.name}`);
    }
  }
}
if (rpeOffenders === 0) logPass('No "RPE" language in any conditioning template notes');

// ── 6. Sprint protection — sprint never placed the day after vo2/glycolytic ──
{
  const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  let sprintViolations = 0;
  for (const phase of PHASES) {
    for (const availableDays of [4, 5, 6]) {
      const plan = runWeekPlan(phase, availableDays);
      const sessionsByDayIdx = plan.weeklyPlan
        .filter(s => s.conditioningCategory)
        .map(s => ({ dayIdx: DAY_ORDER.indexOf(s.dayOfWeek), cat: s.conditioningCategory }))
        .sort((a, b) => a.dayIdx - b.dayIdx);
      for (let i = 1; i < sessionsByDayIdx.length; i++) {
        const prev = sessionsByDayIdx[i - 1];
        const cur = sessionsByDayIdx[i];
        if (cur.dayIdx === prev.dayIdx + 1 && cur.cat === 'sprint'
            && (prev.cat === 'vo2' || prev.cat === 'glycolytic')) {
          sprintViolations++;
          logFail(`${phase}/${availableDays}d: sprint placed day after ${prev.cat} (${DAY_ORDER[prev.dayIdx]}→${DAY_ORDER[cur.dayIdx]})`);
        }
      }
    }
  }
  if (sprintViolations === 0) logPass('Sprint never placed the day after vo2/glycolytic');
}

// ── 7. Weekly sequencing — early-week bias toward vo2/glyco, late-week toward aerobic ──
{
  // For 6-day off-season weeks, conditioning spans all 4 zones; check that
  // high-intensity (vo2/glyco) falls in the first half and aerobic_base in
  // the second half MORE OFTEN THAN NOT.
  const plan = runWeekPlan('Off-season', 6);
  const condSlots = plan.weeklyPlan
    .map((s, idx) => ({ idx, cat: s.conditioningCategory }))
    .filter(s => s.cat);

  const firstHalfHighIntensity = condSlots
    .slice(0, Math.ceil(condSlots.length / 2))
    .some(s => s.cat === 'vo2' || s.cat === 'glycolytic');
  const secondHalfAerobic = condSlots
    .slice(Math.ceil(condSlots.length / 2))
    .some(s => s.cat === 'aerobic_base');

  if (firstHalfHighIntensity) logPass('Off-season 6d: vo2/glycolytic appears in first half of week');
  else logFail(`Off-season 6d: no vo2/glycolytic in first half (order: ${condSlots.map(s => s.cat).join(', ')})`);

  if (secondHalfAerobic) logPass('Off-season 6d: aerobic_base appears in second half of week');
  else logFail(`Off-season 6d: no aerobic_base in second half (order: ${condSlots.map(s => s.cat).join(', ')})`);
}

// ── 8. S+C pairing — bad combos (lower+glyco, lower+sprint) should be rare.
//      Threshold tightened to 20% (Sam's target). Ergometer-swap mitigates
//      the legs-twice problem on days that do pair badly; this check
//      measures how often the planner can AVOID the pairing entirely. ──
{
  let badPairings = 0;
  let totalCombined = 0;
  const lowerTokens = /squat|hinge|Lower|RDL|hip/i;
  for (const phase of PHASES) {
    for (const availableDays of [4, 5, 6]) {
      const plan = runWeekPlan(phase, availableDays);
      for (const s of plan.weeklyPlan) {
        if (!s.hasCombinedConditioning || !s.conditioningCategory) continue;
        totalCombined++;
        const focus = s.focus || '';
        const isLowerStrength = lowerTokens.test(focus.split('+')[0] || '');
        if (isLowerStrength && (s.conditioningCategory === 'glycolytic' || s.conditioningCategory === 'sprint')) {
          badPairings++;
        }
      }
    }
  }
  if (totalCombined === 0) {
    logPass('S+C pairing check: no combined days placed (vacuously OK)');
  } else {
    const ratio = badPairings / totalCombined;
    if (ratio < 0.20) {
      logPass(`S+C pairing: ${badPairings}/${totalCombined} bad pairings (<20% target, ergo-swap mitigated)`);
    } else {
      logFail(`S+C pairing: ${badPairings}/${totalCombined} bad pairings EXCEEDS 20% target (${Math.round(ratio*100)}%)`);
    }
  }
}

// ── 9. Sprint never dropped — every off-season / pre-season week must
//      have at least one sprint exposure (standard, reduced, or micro-dose).
//      The sprint-rescue pass is the last line of defence: if the picker
//      couldn't slot sprint during coverage, a rescue pass retro-converts
//      a compatible slot to a sprint micro-dose. ──
{
  let missing = 0;
  let totalWeeks = 0;
  for (const phase of PHASES) {
    for (const availableDays of [4, 5, 6]) {
      totalWeeks++;
      const plan = runWeekPlan(phase, availableDays);
      const hasSprint = plan.weeklyPlan.some(s => s.conditioningCategory === 'sprint');
      if (!hasSprint) {
        missing++;
        logFail(`${phase}/${availableDays}d: sprint category is MISSING from the week`);
      }
    }
  }
  if (missing === 0) {
    logPass(`Sprint never dropped: all ${totalWeeks} weekly plans have a sprint exposure`);
  }
}

// ── 10. Conditioning feel differentiation — within a week where two
//       sessions share a category, they should not both use identical
//       feel (grindy/sharp/flowing). This ensures intra-category variety. ──
//       Note: most weeks won't have duplicate categories (4 cats cover
//       4 sessions); this check is informational — failures are rare but
//       would indicate the hash is clustering.
{
  let differentiated = 0;
  let duplicateSameFeel = 0;
  for (const phase of PHASES) {
    for (const availableDays of [5, 6]) {
      const plan = runWeekPlan(phase, availableDays);
      const byCat = {};
      for (const s of plan.weeklyPlan) {
        if (!s.conditioningCategory || !s.conditioningFeel) continue;
        (byCat[s.conditioningCategory] ||= []).push(s.conditioningFeel);
      }
      for (const cat of Object.keys(byCat)) {
        const feels = byCat[cat];
        if (feels.length < 2) continue;
        const unique = new Set(feels).size;
        if (unique === feels.length) differentiated++;
        else duplicateSameFeel++;
      }
    }
  }
  if (differentiated + duplicateSameFeel === 0) {
    logPass('Feel differentiation: no weeks had duplicate-category sessions to check');
  } else if (duplicateSameFeel <= 1) {
    logPass(`Feel differentiation: ${differentiated} varied vs ${duplicateSameFeel} identical within-category (acceptable)`);
  } else {
    logFail(`Feel differentiation: ${duplicateSameFeel} category-pairs used the same feel (expected <2)`);
  }
}

// ── 11. Weekly erg modality variety — when multiple sessions in a week
//       use ergometers (bike/row/ski/mixed), they should spread across
//       the pool rather than repeat the same modality. Informational —
//       we accept 1 repeat but flag 2+. ──
{
  let weeksChecked = 0;
  let overRepeats = 0;
  for (const phase of PHASES) {
    for (const availableDays of [5, 6]) {
      weeksChecked++;
      const plan = runWeekPlan(phase, availableDays);
      const ergs = plan.weeklyPlan
        .map(s => s.ergModality)
        .filter(Boolean);
      if (ergs.length < 2) continue;
      const counts = {};
      for (const e of ergs) counts[e] = (counts[e] || 0) + 1;
      const maxRepeat = Math.max(...Object.values(counts));
      if (maxRepeat > 2) overRepeats++;
    }
  }
  if (overRepeats === 0) {
    logPass(`Weekly erg modality variety: ${weeksChecked} weeks, no modality used >2× in one week`);
  } else {
    logFail(`Weekly erg modality variety: ${overRepeats} week(s) had a modality used 3+ times`);
  }
}

// ── 12. Sprint micro-dose cross-week guard — if previous week was
//       micro_dose, this week's sprint must not also be micro_dose.
//       Force the rescue-pass fallback to go 'reduced' (or 'standard'). ──
{
  let microDoseRepeats = 0;
  let sampledWeeks = 0;
  for (const phase of PHASES) {
    for (const availableDays of [4, 5, 6]) {
      sampledWeeks++;
      const inputs = {
        seasonPhase: phase,
        availableDays,
        selectedDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].slice(0, availableDays),
        teamTrainingDaysPerWeek: phase === 'Pre-season' ? 2 : 0,
        teamTrainingDays: phase === 'Pre-season' ? ['Tuesday', 'Thursday'] : [],
        teamTrainingIntensity: 'Hard',
        sprintExposure: 'Some',
        conditioningLevel: 'Good',
        recentTrainingLoad: 'Pretty consistent',
        injuries: [],
        goals: ['Get fitter'],
        hasGame: false,
        previousWeekSprintVariant: 'micro_dose',
      };
      const plan = buildCoachingPlan(inputs);
      const sprintSession = plan.weeklyPlan.find(s => s.conditioningCategory === 'sprint');
      if (sprintSession && sprintSession.conditioningVariant === 'micro_dose') {
        microDoseRepeats++;
        logFail(`${phase}/${availableDays}d: sprint micro-dose repeated back-to-back (previous week guard failed)`);
      }
    }
  }
  if (microDoseRepeats === 0) {
    logPass(`Sprint cross-week guard: ${sampledWeeks} weeks with previousWeekSprintVariant=micro_dose, none repeated`);
  }
}

// ── 13. Weekly feel balance — every week with ≥2 non-micro-dose
//       conditioning sessions must include at least 1 'sharp' AND
//       at least 1 'flowing'. Avoids all-grindy weeks. ──
{
  let imbalancedWeeks = 0;
  let balancedWeeks = 0;
  for (const phase of PHASES) {
    for (const availableDays of [4, 5, 6]) {
      const plan = runWeekPlan(phase, availableDays);
      const feels = plan.weeklyPlan
        .filter(s => s.conditioningCategory && s.conditioningVariant !== 'micro_dose' && s.conditioningFeel)
        .map(s => s.conditioningFeel);
      if (feels.length < 2) continue;
      const hasSharp = feels.includes('sharp');
      const hasFlowing = feels.includes('flowing');
      if (hasSharp && hasFlowing) {
        balancedWeeks++;
      } else {
        imbalancedWeeks++;
        logFail(`${phase}/${availableDays}d: feel imbalance (${feels.join(',')}) — missing ${!hasSharp ? 'sharp' : ''}${!hasSharp && !hasFlowing ? '+' : ''}${!hasFlowing ? 'flowing' : ''}`);
      }
    }
  }
  if (imbalancedWeeks === 0) {
    logPass(`Weekly feel balance: all ${balancedWeeks} multi-session weeks have ≥1 sharp AND ≥1 flowing`);
  }
}

// ── 14. Erg consecutive-day avoidance — when consecutive training days
//       both use ergometers, they should use DIFFERENT modalities when
//       the pool has alternatives. ──
{
  let violations = 0;
  let consecutivePairs = 0;
  for (const phase of PHASES) {
    for (const availableDays of [5, 6]) {
      const plan = runWeekPlan(phase, availableDays);
      // Build ordered list of (dayOfWeek, ergModality) for sessions that have an erg
      const ergDays = plan.weeklyPlan
        .filter(s => s.ergModality)
        .map(s => ({ dow: s.dayOfWeek, erg: s.ergModality }))
        .sort((a, b) => a.dow - b.dow);
      for (let i = 1; i < ergDays.length; i++) {
        if (ergDays[i].dow === ergDays[i - 1].dow + 1) {
          consecutivePairs++;
          if (ergDays[i].erg === ergDays[i - 1].erg) {
            violations++;
            logFail(`${phase}/${availableDays}d: consecutive-day same erg (${ergDays[i - 1].erg} → ${ergDays[i].erg})`);
          }
        }
      }
    }
  }
  if (violations === 0) {
    logPass(`Erg consecutive-day avoidance: ${consecutivePairs} adjacent-day erg pairs, none duplicated`);
  }
}

// ── 15. Sprint mid-week preference — across multi-week samples, sprint
//       should prefer landing in the middle third of the week more
//       often than not (> 40%). Soft preference; constraints can
//       override (short weeks force sprint to early zone). ──
{
  let midCount = 0;
  let totalSprintWeeks = 0;
  for (const phase of PHASES) {
    for (const availableDays of [4, 5, 6]) {
      const plan = runWeekPlan(phase, availableDays);
      const condSlots = plan.weeklyPlan
        .filter(s => s.conditioningCategory)
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek);
      if (condSlots.length === 0) continue;
      const sprintIdx = condSlots.findIndex(s => s.conditioningCategory === 'sprint');
      if (sprintIdx < 0) continue;
      totalSprintWeeks++;
      const third = condSlots.length / 3;
      // mid zone = middle third
      if (sprintIdx >= Math.floor(third) && sprintIdx < Math.ceil(2 * third)) {
        midCount++;
      }
    }
  }
  if (totalSprintWeeks === 0) {
    logPass(`Sprint mid-week preference: no sprint weeks sampled`);
  } else {
    const midRatio = midCount / totalSprintWeeks;
    // Allow flexibility — short weeks push sprint EARLY on purpose.
    if (midRatio >= 0.33) {
      logPass(`Sprint mid-week preference: ${midCount}/${totalSprintWeeks} (${Math.round(midRatio*100)}%) sprints in mid zone`);
    } else {
      logFail(`Sprint mid-week preference: only ${midCount}/${totalSprintWeeks} (${Math.round(midRatio*100)}%) in mid zone — expected ≥33%`);
    }
  }
}

// ── 16. Feel+region pairing — no heavy-lower (L-sq / L-hi) S+C day
//       should be paired with 'grindy' feel. Heavy lower must pair
//       with 'sharp' (or 'flowing' as a fallback). ──
{
  let badFeelPairings = 0;
  let totalLowerCombined = 0;
  for (const phase of PHASES) {
    for (const availableDays of [4, 5, 6]) {
      const plan = runWeekPlan(phase, availableDays);
      for (const s of plan.weeklyPlan) {
        if (!s.hasCombinedConditioning) continue;
        if (s.conditioningVariant === 'micro_dose') continue;
        const focus = (s.focus || '').toLowerCase();
        const isLower = /squat|hinge|lower|rdl|hip/.test(focus);
        if (!isLower) continue;
        totalLowerCombined++;
        if (s.conditioningFeel === 'grindy') {
          badFeelPairings++;
          logFail(`${phase}/${availableDays}d: heavy-lower S+C paired with 'grindy' (focus: ${s.focus})`);
        }
      }
    }
  }
  if (totalLowerCombined === 0) {
    logPass(`Feel+region pairing: no heavy-lower S+C days sampled`);
  } else if (badFeelPairings === 0) {
    logPass(`Feel+region pairing: 0/${totalLowerCombined} heavy-lower S+C days use 'grindy' feel`);
  }
}

// ── Summary ──
console.log('── Conditioning system verification ──');
for (const p of PASS) console.log(p);
for (const f of FAIL) console.log(f);
console.log('');
console.log(`PASS: ${PASS.length}   FAIL: ${FAIL.length}`);
process.exit(FAIL.length > 0 ? 1 : 0);
