'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
// R-375's signed two-implement list. Expectations do not call load normalization.
const twoDB=new Set(['Farmer Carry','Overhead Carry','DB Bench Press','Incline DB Bench','DB Shoulder Press','Seated DB Press','Lateral Raise','Chest Supported Row','Bicep Curl (Dumbbell)','Hammer Curl','Incline Dumbbell Curl','Lying Dumbbell Curl','Dumbbell Skull Crusher','Rear Delt Fly','Chest-Supported DB Row','Shrugs']);
const perHandRungs=new Set([1,2,3,4,5,6,7,8,9,10,...Array.from({length:20},(_,i)=>12.5+i*2.5)]);
const typeFor={'Pissing Dog Against Wall':'reps','Adductor Rockback':'reps','Butterfly Stretch':'reps','Horse Stance Hold':'duration','90/90 Breathing':'reps'};
exports.checkAnnualSecondRepairs=function(folder){
 const year=JSON.parse(fs.readFileSync(path.join(folder,'year-programs.json'),'utf8'));let checked=0,substitutions=0,christmasCatchupAthletes=0;
 for(const athlete of year.athletes) {
  const coreWeeks=new Map();
  const christmasCatchupDates=new Set();let reachedCatchupWeek=false;
  for(const week of athlete.weeks){
  const reopened=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(folder,'raw',`week-${week.number}-reloaded.json.gz`))));
  for(const day of week.days){
   const raw=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(folder,'raw',day.date+'.json.gz'))));
   const rows=raw.day.workout?.exercises??[];
   // Established annual calendar: 4–10 January is deload; 11–17 January
   // is the next healthy build week. These literal dates are fixture inputs,
   // independent of the generator's COD due-week function (R-385).
   if(day.date>='2027-01-11'&&day.date<='2027-01-17'&&week.phase==='Pre-season'){
    reachedCatchupWeek=true;
    if(rows.some(r=>r.exercise.name==='Low-Intensity Deceleration Drills'))christmasCatchupDates.add(day.date);
   }
   for(const row of rows){
    const name=row.exercise.name;checked++;
    if(row.section18Evidence?.role==='main_strength') {
      if(!coreWeeks.has(name))coreWeeks.set(name,new Set());
      coreWeeks.get(name).add(week.number);
    }
    if(twoDB.has(name)&&row.prescribedWeightKg>0)assert(perHandRungs.has(row.prescribedWeightKg/2),`${day.date}/${name}: automatic total cannot be divided into real equal dumbbells`);
    if(row.substitutedFrom){
     substitutions++;
     const expected=name.startsWith('Foam Roll —')?'duration':typeFor[name];
     if(expected)assert.equal(row.prescriptionType??'reps',expected,`${day.date}/${name}: replacement units`);
     if(name==='Foam Roll — Hip Flexor, Quad, Adductors'){
      assert(row.prescribedRepsMin>=90&&row.prescribedRepsMax<=120,`${day.date}: foam-roll seconds come from its authored drill`);
      assert(row.prescribedSets<=1,`${day.date}: foam-roll set count`);
     }
    }
   }
   const fields=workout=>(workout?.exercises??[]).map(r=>({name:r.exercise.name,sets:r.prescribedSets,min:r.prescribedRepsMin,max:r.prescribedRepsMax,type:r.prescriptionType,side:r.perSide,rest:r.restSeconds,notes:r.notes,kg:r.prescribedWeightKg}));
   assert.deepEqual(fields(raw.day.workout),fields(reopened.visibleWeek.find(d=>d.date===day.date)?.workout),`${day.date}: full prescription fields survive save/reopen`);
  }
 }
  if(athlete.weeks.length>=18&&athlete.weeks[0].days[0].date==='2026-09-28')assert(reachedCatchupWeek,'Established January catch-up week was actually reached');
  if(reachedCatchupWeek)christmasCatchupAthletes++;
  if(reachedCatchupWeek)assert.equal(christmasCatchupDates.size,1,`${path.basename(folder)}: skipped Christmas COD reaches exactly one date in the next healthy week`);
  // Controlled full-kit annual worlds have many proven legal alternatives.
  // Restricted-kit/novice pool gaps are reviewed separately rather than waived silently.
  if(path.basename(folder).startsWith('controlled-') || path.basename(folder)==='beginner-three-years') {
    for(const [name,weeks] of coreWeeks)for(const n of weeks) {
      if(weeks.has(n-1))continue;
      let end=n;while(weeks.has(end+1))end++;
      assert(end-n+1<=8,`${path.basename(folder)}/${name}: ${end-n+1} consecutive weeks despite the full-kit rotation bench`);
    }
  }
 }
 return {checkedRows:checked,substitutedRows:substitutions,christmasCatchupAthletes};
};
if(require.main===module) for(const folder of process.argv.slice(2)) console.log(folder,JSON.stringify(exports.checkAnnualSecondRepairs(folder)));
