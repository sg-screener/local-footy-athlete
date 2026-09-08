'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawnSync}=require('node:child_process');
const zlib=require('node:zlib');
const repo=path.resolve(__dirname,'../..');
const flatten=rows=>rows.flatMap(row=>row.choices?row.choices.flatMap(choice=>flatten(choice.rows??[])):[row]);
// Independent transcription of Sam's equipment answers: a compulsory fixed
// apparatus is unavailable away from a selected gym day, including optional work.
const fixedGymExercises=new Set();
for(const doc of ['EXERCISE_EQUIPMENT_FOR_SAM.md','EXERCISE_EQUIPMENT_FOR_SAM_PART2.md']){
 for(const line of fs.readFileSync(path.join(repo,'docs',doc),'utf8').split('\n')){
  const cells=line.split('|').map(s=>s.trim());
  if(cells.length>3&&cells[2].split(' & ').some(part=>!part.includes(' OR ')&&['cables','machine','rack','back_extension_bench'].includes(part.replace(/[()]/g,''))))fixedGymExercises.add(cells[1]);
 }
}
assert(fixedGymExercises.size>10,'Find the authored equipment table before checking it');
function verify(folder){
 require('./support/annualSecondRepairChecks.cjs').checkAnnualSecondRepairs(folder);
 const year=JSON.parse(fs.readFileSync(path.join(folder,'year-programs.json'),'utf8'));
 const actions=fs.readFileSync(path.join(folder,'action-history.ndjson'),'utf8').trim().split('\n').map(JSON.parse);
 assert(actions.length>=16,'Reach injuries, Clear, travel, illness and fatigue');
 const changed=actions.filter(action=>action.changed);
 assert.deepEqual(changed.map(action=>[action.date,action.label]),[],'A forward report/Clear must preserve earlier day prescriptions');
 for(const athlete of year.athletes){
  assert(athlete.weeks.length>=52,'Reach every annual transition and dated restriction');
  assert.equal(athlete.restarts.length,athlete.weeks.length);
  assert(athlete.restarts.every(r=>r.ok),'Every week must reopen unchanged');
  assert.deepEqual(athlete.checkFailures??[],[]);
  let dates=0,exercises=0;
  for(const week of athlete.weeks){
   assert.equal(week.days.length,7);
   const reopened=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(folder,'raw',`week-${week.number}-reloaded.json.gz`))));
   const dose=workout=>(workout?.exercises??[]).map(row=>({name:row.exercise.name,sets:row.prescribedSets,min:row.prescribedRepsMin,max:row.prescribedRepsMax,kg:row.prescribedWeightKg??null,notes:row.role==='conditioning'?row.notes:undefined,optional:row.optionalNoPenalty??false}));
   for(const day of week.days){
    const morning=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(folder,'raw',day.date+'.json.gz'))));
    assert.deepEqual(dose(reopened.visibleWeek.find(d=>d.date===day.date)?.workout),dose(morning.day.workout),`${day.date}: reopened past prescription differs from its morning`);
    const name=new Date(day.date+'T12:00:00Z').toLocaleDateString('en-US',{weekday:'long',timeZone:'UTC'});
    const gym=week.acceptedProgrammingInputs.preferredTrainingDays.includes(name);
    const displayRows=flatten(day.rows??[]);
    const speedNames=new Set((day.speedRows??[]).filter(row=>row.name!=='Warm-up').map(row=>row.catalogueIdentity??row.name));
    const speedIndexes=displayRows.flatMap((row,index)=>speedNames.has(row.catalogueIdentity??row.name)?[index]:[]);
    const strengthIndexes=displayRows.flatMap((row,index)=>['main_lift','accessory'].includes(row.role)?[index]:[]);
    if(speedIndexes.length&&strengthIndexes.length)assert(Math.max(...strengthIndexes)<Math.min(...speedIndexes),`${day.date}: Strength must display before Speed`);
    if(day.name==='Primer')assert.equal(day.tier,'optional',`${day.date}: pre-game Primer stays optional`);
    for(const row of [...flatten(day.rows??[]),...(day.warmup??[])]){
     exercises++;
     const identity=row.catalogueIdentity??row.name;
     assert(gym||!fixedGymExercises.has(identity),`${day.date}/${identity}: fixed gym equipment outside selected gym days`);
     assert(!row.rest,`${day.date}/${row.name}: export invented a separate rest label`);
     assert(gym||row.section18Evidence?.role!=='main_strength',`${day.date}: main lifting on an unselected gym day`);
     assert(row.name!=='Dragon Flag'||week.acceptedProgrammingInputs.experienceLevel==='5+ years',`${day.date}: advanced-only core exercise`);
     if(week.acceptedProgrammingInputs.experienceLevel==='Complete beginner')assert(!['Broad Jumps','Jump Squats','Depth Jumps'].includes(row.name),`${day.date}: beginner jump gate`);
    }
    dates++;
   }
  }
  console.log(`PASS ${path.basename(folder)}: ${dates} distinct dates, ${exercises} exported row occurrences, ${actions.length} action history comparisons and ${athlete.restarts.length} reopens`);
 }
}
const folders=process.argv.slice(2);
if(folders.length)folders.forEach(verify);
else{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'lfa-annual-repairs-'));
 for(const frequency of [2,3,4,5]){
  const output=path.join(root,`controlled-${frequency}`);fs.mkdirSync(output,{recursive:true});
  const log=fs.openSync(path.join(output,'run.log'),'w');
  const result=spawnSync(process.execPath,['scripts/annual-audit-evidence.cjs',`--preset=controlled-${frequency}`,'--weeks=52',`--output=${output}`],{cwd:repo,stdio:['ignore',log,log]});fs.closeSync(log);
  assert.equal(result.status,0,`Real journey failed: ${output}`);verify(output);
 }
}
