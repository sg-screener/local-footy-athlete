'use strict';
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const cases=[
 ['household equipment','src/data/exerciseEquipmentRequirement.ts','"Pigeon Stretch": [],','"Pigeon Stretch": ["bench"],','household support needs no gym kit Pigeon Stretch'],
 ['approved implement count','src/utils/loadEstimation.ts',"'Overhead Carry':         { implements: 2","'Overhead Carry':         { implements: 1",'approved weight count Overhead Carry'],
 ['Christmas catch-up','src/rules/movementPlaneProgramming.ts','lastChristmasDose === christmasWeek','(christmasWeek - 1) % 2 === 0','Christmas deload catch-up week 4'],
 ['stable exercise choice','src/rules/acceptedExerciseTarget.ts','target.uniqueSeat && seats.length === 1','false && seats.length === 1','accepted choice follows its authored seat'],
 ['total load','src/utils/loadEstimation.ts','baseKg: args.baseKg / implementsCount','baseKg: args.baseKg','Chest-Supported DB Row/35/36'],
 ['partial history','src/rules/blockBoundaryProgression.ts',"for (const [, feedback] of allSorted) {\n    for (const log of feedback.strength ?? []) {\n      if (log.completion !== 'full') continue;","for (const [, feedback] of allSorted) {\n    for (const log of feedback.strength ?? []) {\n      if (log.completion === 'skipped') continue;",'history partial'],
 ['pool equipment','src/data/exerciseEquipmentRequirement.ts','if (explicit) return explicit;','if (explicit) return explicit; return null;','required QL Back Extension'],
 ['dated equipment','src/utils/tapSwapHierarchy.ts','equipmentTagsOnDate(args.profile ?? {}, args.date, resolveEquipmentAvailability(','((_profile, _date, tags) => tags)(args.profile ?? {}, args.date, resolveEquipmentAvailability(','replacement environment uses actual gym date'],
 ['replacement units','src/rules/canonicalWeeklyInjuryCompiler.ts','    prescriptionType,','    prescriptionType: original?.prescriptionType,','replacement reps/Foam Roll'],
 ['identity tenure','src/rules/blockRotationStagger.ts','history.filter(row => row.blockStartISO < beforeISO)','history.filter(row => row.seatIndex === 0 && row.blockStartISO < beforeISO)','identity spans seats'],
 ['complete-week grade check','src/rules/blockRotationStagger.ts','staggerGuardrailsHold(plan.map(option => option.grade))','staggerGuardrailsHold(queue.map(seat => seat.currentGrade))','valid complete plan rotates all four overdue beginner seats'],
 ['recorded rotation restore','src/rules/composeWeek.ts','currentBlockSelection: inputs.selectionHistory.find(entry => entry.slot === slot','currentBlockSelection: [].find(entry => entry.slot === slot','recorded A-grade rotation survives accumulated history and reopen'],
 ['rotation reason','src/rules/composeWeek.ts',"'staggered_block_rotation' as const","'two_block_maximum_reached' as const",'rotation trace distinguishes a quota choice from the eight-week ceiling'],
 ['power alternatives','src/rules/automaticWeeklyExerciseSelection.ts','legal.find(canUse) ?? legal[0] ?? null','legal[0] ?? null','power uses suitable unused alternative'],
 ['Lateral Bounds gate','src/data/exerciseTags.ts',"'Lateral Bounds': {\n    programming: { automaticMinimum: 'developing'","'Lateral Bounds': {\n    programming: { automaticMinimum: 'new'",'Lateral Bounds beginner'],
 ['Band category','src/data/exerciseTags.ts',"'Band Pull-Apart': {\n    strengthClassification: 'isolation',\n    movement: 'isolation_upper'","'Band Pull-Apart': {\n    strengthClassification: 'isolation',\n    movement: 'horizontal_pull'",'Band Pull-Apart is not horizontal pulling'],
];
if(process.env.LFA_SECOND_MUTATION){
 require('sucrase/register');
 const c=cases[Number(process.env.LFA_SECOND_MUTATION)-1];const filename=path.join(root,c[1]);
 const original=Module._extensions['.ts'];let applied=false;
 Module._extensions['.ts']=function(m,file){
  if(file!==filename)return original(m,file);
  const source=fs.readFileSync(file,'utf8');
  if(source.split(c[2]).length!==2)throw Error('Mutation anchor absent or ambiguous: '+c[0]);
  applied=true;console.error('APPLIED '+c[0]);
  m._compile(require('sucrase').transform(source.replace(c[2],c[3]),{transforms:['typescript','imports'],filePath:file}).code,file);
 };
 require(path.join(root,'src/__tests__/annualAuditSecondRepairTests.ts'));
 if(!applied)throw Error('Mutation target never loaded');
}else{
 const result=cases.map((c,i)=>{
  const p=spawnSync(process.execPath,[__filename],{cwd:root,env:{...process.env,LFA_SECOND_MUTATION:String(i+1)},encoding:'utf8'});
  const caught=p.status===1&&p.stderr.includes('APPLIED '+c[0])&&p.stdout.includes(c[4]);
  return {mutation:c[0],caught,exit:p.status,stdout:p.stdout,stderr:p.stderr};
 });
 console.log(JSON.stringify(result,null,2));if(result.some(r=>!r.caught))process.exitCode=1;
}
