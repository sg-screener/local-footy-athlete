'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const mutations={
  'ignore-modality-source-scope':['src/utils/coachModalitySwap.ts','(workout.conditioningBlock?.options ?? []).filter(matchesSourceOption)','(workout.conditioningBlock?.options ?? [])'],
  'lose-return-template-identity':['src/rules/runningReturn.ts','return {...option,exerciseIds,title:base.exercise.name,description:prescription,','return {...option,exerciseIds,title,description:prescription,'],
  'discard-speed-return-display-context':['src/rules/projectVisibleWeek.ts',"if (kind === 'speed') return toVisibleRows(composed.speedExercises, workout);","if (kind === 'speed') return toVisibleRows(composed.speedExercises);"],
  'show-normal-dose-during-return':['src/rules/projectVisibleWeek.ts','if (returning) return runningReturnDoseCopy(returning, row.prescribedSets);',''],
  'rewrite-run-only-return-as-machine':['src/utils/coachModalitySwap.ts','if (authored.some(template => !templateSupportsSelectedModalities(template!, [targetMode as never]))) return workout;',''],
  're-dose-earlier-days-after-later-report':['src/rules/canonicalWeeklyInjuryCompiler.ts','if (args.historyBeforeISO && dateISO < args.historyBeforeISO) return [dateISO, workoutsByDate[dateISO]];',''],
  'copy-strength-dose-onto-demanding-prehab':['src/rules/acceptedLoadCarry.ts'," && !isDemandingPrehab(row.exercise.name)",""],
  'copy-strength-dose-onto-returning-field-work':['src/rules/acceptedLoadCarry.ts',"if (carry === 'loads_and_dose' && strengthIds.has(row.id) && !isDemandingPrehab(row.exercise.name)) {","if (carry === 'loads_and_dose') {"],
  'drop-fixture-coverage-dose':['src/utils/fixtureMinimalReplan.ts','dosePolicyForDate: date => args.targetMicrocycle.dosePolicyByDay?.[dayOfWeekForISODate(date)] ?? null,','', 'src/__tests__/legProgrammingJourneyTests.cjs'],
  'drop-trial-coverage-dose':['src/rules/canonicalWeeklyRowCompiler.ts','dosePolicyForDate: date => draft.dosePolicyByDay[dayOfWeekForISODate(date)] ?? null,','', 'src/__tests__/legProgrammingJourneyTests.cjs'],
  'drop-final-coverage-dose':['src/rules/canonicalWeeklyRowCompiler.ts','dosePolicyForDate: date => compiledDosePolicyByDay[dayOfWeekForISODate(date)] ?? null,','', 'src/__tests__/legProgrammingJourneyTests.cjs'],
  'drop-injury-coverage-dose':['src/rules/canonicalWeeklyInjuryCompiler.ts','        return completeWeeklySupport({ ...weeklyCompletionArgs,\n          dosePolicyForDate,','        return completeWeeklySupport({ ...weeklyCompletionArgs,'],
  'ignore-compiler-dose-for-coverage':['src/rules/weeklyLegCoverage.ts','const policy=args.dosePolicyForDate?.(date) ?? null;','const policy=null;'],
  'ignore-kit-main-seat-reservation':['src/rules/weeklyStrengthBudget.ts','if (slotAvailable) {','if (false) {'],
  'lose-injury-family-evidence':['src/rules/automaticWeeklyExerciseSelection.ts','if (family && !injuryReplacement) {','if (family) {'],
  'trust-unevidenced-injury-family':['src/rules/automaticWeeklyExerciseSelection.ts','&& (day.injuryAdjustment?.paused.length ?? 0) > 0\n        && day.injuryAdjustment!.added.some(name => canonicalExerciseName(name) === identity);',';'],
  'copy-planned-lifts-with-energy':['src/rules/canonicalInjuryConditioning.ts','...planned, exercises: plannedEnergyRows, workoutType:', '...planned, exercises: planned.exercises, workoutType:'],
  'ignore-previous-addon-dose':['src/rules/trainingWorkload.ts','const sets=prehabSets(row.name,authored,addonLoaded,reduced);','const sets=prehabSets(row.name,authored,exercises,reduced);'],
  'ignore-addon-flow-credit':['src/utils/mobilityPrehabFlow.ts','const loaded = prehabWorkRows(workout);','const loaded = [...workout.exercises];'],
  'ignore-strength-in-addons':['src/rules/lowerBodyWorkload.ts',"if(!strengthWorkAreas(row.name).length||getExerciseTags(row.name)?.region!=='lower')continue;",'if(true)continue;'],
  'count-ineligible-nordic-as-available':['src/rules/weeklyLegCoverage.ts',".filter(name => exerciseProgrammingAllows(name,{experienceLevel:args.profile.experienceLevel,route:'automatic'}))",'.filter(() => true)'],
  'ignore-deliberate-removal':['src/rules/weeklyLegCoverage.ts','if (removed) { receipts.push','if (false) { receipts.push'],
  'disconnect-whole-day-ranking':['src/rules/weeklyScheduler.ts','Math.max(0,Math.min(7,longestLegRun)-2),freshness,','0,freshness,'],
  'disconnect-weekly-coverage':['src/rules/weeklyLegCoverage.ts','return completeWeeklyLegCoverage({...args,workoutsByDate:core.workoutsByDate});','return {workoutsByDate:core.workoutsByDate,receipts:[]};'],
  'hinge-replaces-curl':['src/rules/footballRobustnessFoundation.ts','if (HAMSTRING_ACCESSORIES.has(name)) {',"if (HAMSTRING_ACCESSORIES.has(name) || sameExerciseVariationFamily(name, 'RDLs')) {"],
  'tib-replaces-calf':['src/rules/footballRobustnessFoundation.ts','if (CALF_ACCESSORIES.has(name))',"if (CALF_ACCESSORIES.has(name) || sameExerciseVariationFamily(name, 'Tib Raises'))"],
  'ignore-whole-day-legs':['src/rules/weeklyScheduler.ts','return Math.min(7,longestLegRun);','return 0;'],
  'skip-running-return':['src/rules/runningReturn.ts','if(!stage || workout.athletePlacement','if(true || !stage || workout.athletePlacement'],
  'ignore-prehab-dose':['src/rules/trainingWorkload.ts','if (!isDemandingPrehab(name)) return sets;','if (true) return sets;'],
  'ignore-derived-injury':['src/rules/datedAthleteContext.ts','const dated=datedAthleteContext(athlete,dateISO);','return true; const dated=datedAthleteContext(athlete,dateISO);'],
  // Sam's 2026-09-09 review of the three-day year (R-393 repairs, R-394, R-395).
  'untype-primer-pogo':['src/utils/sessionBuilder.ts',"// A lower jump, so the injury exposure filter sees it (R-393).\n        power: 'lower',",'// mutation: untyped authored jump'],
  'adductor-holds-not-one-family':['src/rules/exerciseVariationFamily.ts',"    .filter((entry) => entry.prescriptionType === 'duration')\n    .map((entry) => entry.name),","    .filter(() => false)\n    .map((entry) => entry.name),"],
  'drop-frontal-completion-dose':['src/rules/canonicalWeeklyPlaneCompletion.ts','const policy = args.dosePolicyForDate?.(dateISO) ?? null;','const policy = null;'],
  'ignore-dated-policy-for-prehab-reduction':['src/rules/canonicalWeeklyInjuryCompiler.ts','|| !!((args.programmingContextByDate?.[dateISO] ?? args.programmingContext)?.deloadPolicy))','|| false)'],
  'nordic-satisfied-by-curl':['src/rules/weeklyLegCoverage.ts',"category === 'nordic' ? isNordicExercise(name)","category === 'nordic' ? footballRobustnessCategoriesForExercise(name).includes('hamstring_eccentric_or_isometric')"],
  'drop-inseason-moderate-conditioning':['src/rules/weeklyScheduler.ts','if (!receiver) return withFortnightlyCod;','if (true) return withFortnightlyCod;'],
};
function installMutation(name){
 const rule=mutations[name];if(!rule)throw Error('Unknown mutation '+name);
 const prior=require.extensions['.ts'];let reached=false;
 require.extensions['.ts']=(mod,file)=>{
  if(file!==path.join(root,rule[0]))return prior(mod,file);
  const source=fs.readFileSync(file,'utf8');if(!source.includes(rule[1]))throw Error('Mutation anchor missing');
  reached=true;console.log('MUTATION REACHED '+name);
  return mod._compile(require('sucrase').transform(source.replace(rule[1],rule[2]),{transforms:['typescript','imports'],filePath:file}).code,file);
 };
 process.on('exit',()=>{if(!reached)process.exitCode=2;});
}
module.exports={installMutation};
if(require.main===module){let failures=0;for(const name of Object.keys(mutations)){
 const result=spawnSync(process.execPath,[mutations[name][3]??'src/__tests__/legProgrammingTests.cjs'],{cwd:root,encoding:'utf8',env:{...process.env,LEG_PROGRAMMING_MUTATION:name}});
 const out=result.stdout+result.stderr;
 const caught=result.status===1 && out.includes('MUTATION REACHED '+name) && out.includes('FAIL ') && !out.includes('Mutation anchor missing');
 console.log((caught?'PASS':'FAIL')+' fault '+name);if(!caught){failures++;console.error(out);}
 }if(failures)process.exitCode=1;
}
