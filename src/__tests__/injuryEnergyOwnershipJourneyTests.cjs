'use strict';
// Fresh isolated stores; the same onboarding, injury, recovery and boot doors as the app.
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
// Sam, 2026-09-10: the no-standing-fixture profile is removed from every test
// fleet (an hour per year replay). One complete journey remains.
const worlds = [
  ['female-6-sunday-fixture', 'Pre-season'],
];
if (!process.argv[2]) {
  let failed = 0;
  for (const [athlete, phase] of worlds) {
    const run = spawnSync(process.execPath, [__filename, athlete, phase], {stdio:'inherit'});
    if (run.status !== 0) failed++;
  }
  console.log(`Injury energy ownership: ${worlds.length-failed}/${worlds.length} complete athlete journeys`);
  process.exitCode = failed ? 1 : 0;
} else {
  require('sucrase/register');
  global.__DEV__ = true;
  const disk = new Map();
  global.window = {localStorage:{getItem:k=>disk.get(k)??null,setItem:(k,v)=>disk.set(k,v),removeItem:k=>disk.delete(k),clear:()=>disk.clear()}};
  global.fetch = () => {throw Error('Network disabled in isolated injury journey');};
  const j = require('./support/athleteJourney');
  const {ARCHETYPES,athleteAnswers} = require('./compilerYear/catalog');
  const {deriveVisibleWeekLive} = require('../utils/deriveVisibleWeek');
  const {visibleSignature} = require('./compilerYear/invariants');
  const {useProfileStore} = require('../store/profileStore');
  const {executeProgramControlActionDurably:act} = require('../utils/programControlActions');
  const {getSessionComponentRows} = require('../utils/sessionComponents');
  const date = '2027-05-24';
  const view = () => j.quiet(()=>deriveVisibleWeekLive(date,date));
  const strengthDates = days => days.filter(d=>(d.workout?.exercises??[]).some(r=>r.section18Evidence?.role==='main_strength'&&!r.unavailableForInjury)).map(d=>d.date);
  const source = {screen:'my_status',surface:'status_card',initiatedBy:'tap'};
  (async()=>{
    const archetype = {...ARCHETYPES.find(a=>a.id===process.argv[2]),initialPhase:'Pre-season'};
    const installed = await j.quietAsync(()=>j.coldStartThroughOnboarding({profile:athleteAnswers(archetype),installDayISO:date}));
    assert.equal(installed.onboardingRefusal,null);
    if (process.argv[3]==='In-season') {
      const next = require('../utils/profileMutations').applyPhaseShift(useProfileStore.getState().onboardingData,{targetPhase:'In-season',preferredTrainingDays:[...archetype.days],teamTrainingDays:[...archetype.clubDays],gameAnchor:{kind:'no_usual_day'}});
      const patch = Object.fromEntries(['seasonPhase','seasonFinishedOn','preferredTrainingDays','trainingDaysPerWeek','teamTrainingDays','teamTrainingDaysPerWeek','usualGameDay','gameDay'].map(k=>[k,next[k]]));
      const shifted = await j.quietAsync(()=>require('../store/profileProgramTransaction').commitProfileProgramTransaction({change:{kind:'profile_setup',patch},todayISO:date,sourceSurface:'phase_shift'}));
      assert.ok(shifted.ok,JSON.stringify(shifted));
    }
    const before = view();
    const acceptedDates = strengthDates(before);
    assert.equal(acceptedDates.length,4,'reached the original four lifting days');
    const constraint = require('../utils/guidedInjuryControl').buildGuidedInjuryConstraint({region:'lower_body',area:'knee',severity:7,severityBand:'moderate',adjustmentLevel:'moderate',triggers:['running'],seriousSymptoms:false},{todayISO:date});
    const report = await j.quietAsync(()=>act({type:'set_injury_modifier',source,scope:'current_and_future',payload:{constraint},requiresRebuild:false,createsActiveModifier:true,oneOffOnly:false},{todayISO:date}));
    assert.ok(report.ok,JSON.stringify(report));
    const injured = view();
    assert.deepEqual(strengthDates(injured),acceptedDates,'injury cannot import another lifting date');
    assert.ok(injured.some(d=>getSessionComponentRows(d.workout).conditioningRows.length),'off-feet conditioning remains');
    const signature = visibleSignature(injured);
    assert.ok((await j.quietAsync(()=>j.relaunchApp({storage:disk,todayISO:date}))).ok);
    assert.equal(visibleSignature(view()),signature,'injury repair survives a fresh boot exactly');
    const cleared = await j.quietAsync(()=>act({type:'clear_injury_modifier',source,scope:'current_and_future',payload:{episodeId:report.createdModifierIds[0]},requiresRebuild:false,createsActiveModifier:false,oneOffOnly:false},{todayISO:date}));
    assert.ok(cleared.ok,JSON.stringify(cleared));
    assert.deepEqual(strengthDates(view()),acceptedDates,'clearing injury restores the accepted schedule');
    console.log('PASS injury energy journey',process.argv[2],process.argv[3],acceptedDates.join(','));
  })().catch(error=>{console.error(error);process.exitCode=1;});
}
