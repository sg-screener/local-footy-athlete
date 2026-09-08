'use strict';
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const phases = ['Off-season','Pre-season','In-season'];
if (!process.argv[2]) {
  let failed=0;
  for(const phase of phases)if(spawnSync(process.execPath,[__filename,phase],{stdio:'inherit'}).status!==0)failed++;
  console.log(`No-equipment strength: ${phases.length-failed}/${phases.length} complete profile-change journeys`);
  process.exitCode=failed?1:0;
} else {
 require('sucrase/register');global.__DEV__=true;
 const disk=new Map();global.window={localStorage:{getItem:k=>disk.get(k)??null,setItem:(k,v)=>disk.set(k,v),removeItem:k=>disk.delete(k),clear:()=>disk.clear()}};
 global.fetch=()=>{throw Error('No network in equipment journey');};
 const j=require('./support/athleteJourney');
 const {athleteAnswers}=require('./compilerYear/catalog');
 const {presetEquipmentAnswer}=require('./support/equipmentAnswerFixture');
 const {changePermanentEquipment}=require('./support/settingsJourney');
 const {deriveVisibleWeekLive}=require('../utils/deriveVisibleWeek');
 const {visibleSignature}=require('./compilerYear/invariants');
 const {composedRowIsLegal}=require('../rules/composedRowLegality');
 const {footballRobustnessCategoriesForExercise:categories,suppliesAlternativeHamstringWork}=require('../rules/footballRobustnessFoundation');
 const date='2026-09-28',phase=process.argv[2];
 const view=()=>j.quiet(()=>deriveVisibleWeekLive(date,date));
 (async()=>{
  const profile=athleteAnswers({id:'no-equipment',gender:'female',days:['Monday','Wednesday','Friday'],experience:'2-5 years',equipment:'commercial',initialPhase:phase,clubDays:[],gameDay:phase==='In-season'?'Saturday':null,extraGame:false});
  assert.equal((await j.quietAsync(()=>j.coldStartThroughOnboarding({profile,installDayISO:date}))).onboardingRefusal,null);
  const all=presetEquipmentAnswer('commercial_gym',date);
  const answer={tags:Object.fromEntries(Object.keys(all.tags).map(k=>[k,'never'])),modalities:Object.fromEntries(Object.keys(all.modalities).map(k=>[k,'never'])),answeredOn:date};
  const changed=await j.quietAsync(()=>changePermanentEquipment({answer,todayISO:date}));
  assert.ok(changed.ok,JSON.stringify(changed));
  const days=view(),rows=days.flatMap(d=>d.workout?.exercises??[]);
  const strength=days.filter(d=>d.workout?.exercises.some(r=>r.section18Evidence?.role==='main_strength'));
  assert.equal(strength.length,phase==='In-season'?2:3,'each achievable main day remains');
  for(const row of rows.filter(row=>row.section18Evidence?.role==='main_strength'))
    assert.ok(composedRowIsLegal(row.exercise.name,['bodyweight']),row.exercise.name+' needs unavailable equipment');
  assert.ok(rows.some(r=>categories(r.exercise.name).includes('calf_or_soleus')),'calf coverage');
  assert.ok(rows.some(r=>categories(r.exercise.name).includes('hamstring_eccentric_or_isometric')||suppliesAlternativeHamstringWork(r.exercise.name)),'hamstring coverage');
  const signature=visibleSignature(days);
  assert.ok((await j.quietAsync(()=>j.relaunchApp({storage:disk,todayISO:date}))).ok);
  assert.equal(visibleSignature(view()),signature,'no-equipment choices survive boot');
  assert.ok((await j.quietAsync(()=>changePermanentEquipment({answer:all,todayISO:date}))).ok,'restoring kit saves');
  const restored=visibleSignature(view());
  assert.ok((await j.quietAsync(()=>j.relaunchApp({storage:disk,todayISO:date}))).ok);
  assert.equal(visibleSignature(view()),restored,'restored kit survives boot');
  console.log('PASS no-equipment profile change',phase,strength.map(d=>d.date).join(','));
 })().catch(error=>{console.error(error);process.exitCode=1;});
}
