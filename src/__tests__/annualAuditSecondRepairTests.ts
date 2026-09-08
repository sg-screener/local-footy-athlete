/** Independent expectations from the approved annual findings and Sam's 7 September answers. */
(global as any).__DEV__ = false;
(globalThis as any).window = { localStorage: { getItem: () => null, setItem() {}, removeItem() {}, clear() {} } };
import { normaliseAutomaticExerciseLoadChange, estimateStartingWeight, startingWeightForAthlete, familySeedFromRecord, EXERCISE_LOAD_MAP } from '../utils/loadEstimation';
import { readBlockHistory } from '../rules/blockBoundaryProgression';
import { equipmentRequiredFor, exerciseIsAvailableWith } from '../data/exerciseEquipmentRequirement';
import { exerciseProgrammingAllows } from '../utils/exerciseFilter';
import { getExerciseTags } from '../data/exerciseTags';
import { createAutomaticWeeklyExerciseSelector, automaticMainFamilyForExercise, automaticExerciseRouteForIdentity } from '../rules/automaticWeeklyExerciseSelection';
import { athleteAnswers, ARCHETYPES } from './compilerYear/catalog';
const failures: string[] = []; let checks = 0;
function check(name: string, actual: unknown, expected: unknown) {
 checks++; if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push(`${name}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
}
for (const [name, base, target, expected] of [
 ['Chest-Supported DB Row',35,36,40], ['Single-Arm DB Row',35,36,37.5],
 ['DB Bench Press',18,19,20], ['DB Bench Press',20,21,25],
 ['DB Bench Press',37.5,37.5,37.5], ['DB Bench Press',37.5,38,40],
 ['DB Bench Press',40,37.5,35], ['DB Bench Press',2,1,2],
 ['Back Squat',100,101,102.5], ['Kettlebell Swings',24,25,28],
] as const) check(`${name}/${base}/${target}`, normaliseAutomaticExerciseLoadChange({exerciseName:name,baseKg:base,targetKg:target}), expected);
const profile = athleteAnswers(ARCHETYPES.find(a=>a.id==='male-3-experienced-gym')!);
const rungs = new Set([1,2,3,4,5,6,7,8,9,10,...Array.from({length:20},(_,i)=>12.5+i*2.5)]);
for (const [name,p] of Object.entries(EXERCISE_LOAD_MAP)) {
 if (p.equipment !== 'dumbbell') continue;
 const total=estimateStartingWeight(name,profile);
 if(total!==null) check(`initial real dumbbells ${name}`,rungs.has(total/(p.implements??1)),true);
}
for (const [name,p] of Object.entries(EXERCISE_LOAD_MAP)) {
 if(p.equipment!=='dumbbell')continue;
 for(const bodyWeightKg of [53,67,89,107]){
  const athlete={...profile,bodyWeightKg};
  for(const [route,total] of [
   ['initial',estimateStartingWeight(name,athlete)],
   ['beginner',startingWeightForAthlete(name,{...athlete,experienceLevel:'Complete beginner'})],
   ['family',familySeedFromRecord(name,athlete,{'Bench Press':63.5,'Back Squat':93.5})],
  ] as const) if(total!==null)check(`${route}/${bodyWeightKg}/${name} uses real implements`,rungs.has(total/(p.implements??1)),true);
 }
}
for (const completion of ['full','partial','skipped'] as const) {
 const signal=readBlockHistory({feedbackByDate:{
 '2026-10-12':{completion:'full',strength:[{exerciseName:'Back Squat',completion:'full',weightKg:85}]},
 '2026-10-19':{completion,strength:[{exerciseName:'Back Squat',completion,weightKg:100}]},
 } as any,blockStartISO:'2026-09-28',blockEndISO:'2026-10-25',requiredStrengthSessions:8});
 check(`history ${completion}`,signal.lastRecordedLoadByExercise['Back Squat'],completion==='full'?100:85);
}
for(const [name,tag] of [['QL Back Extension','back_extension_bench'],['Foam Roll — Hip Flexor, Quad, Adductors','foam_roller']]) {
 check(`required ${name}`,equipmentRequiredFor(name)?.includes(tag),true);
 check(`missing kit ${name}`,exerciseIsAvailableWith(name,['bodyweight']),false);
 check(`present kit ${name}`,exerciseIsAvailableWith(name,['bodyweight',tag]),true);
}
for (const name of ['90/90 Breathing','ATG Split Squat','Butterfly Stretch','Calf Stretch','Chest / Pec Stretch (Doorway)','Couch Stretch','Elephant Walks','Lat Stretch','Pissing Dog Against Wall','Pigeon Stretch']) {
 check(`household support needs no gym kit ${name}`,equipmentRequiredFor(name),[]);
 check(`household support admitted ${name}`,exerciseIsAvailableWith(name,['bodyweight']),true);
}
for (const [name,count] of [['Overhead Carry',2],['Weighted Dead Bug',1],['Tricep Circuit (Dirty 30)',1],['Back Extension',1],['Bear Carry',1]] as const) {
 check(`approved weight count ${name}`,EXERCISE_LOAD_MAP[name].implements??1,count);
}
check('Lateral Bounds 1 year',exerciseProgrammingAllows('Lateral Bounds',{experienceLevel:'1-2 years',route:'automatic'}),true);
check('Lateral Bounds beginner',exerciseProgrammingAllows('Lateral Bounds',{experienceLevel:'Complete beginner',route:'automatic'}),false);
check('Band Pull-Apart is not horizontal pulling',getExerciseTags('Band Pull-Apart')?.movement,'isolation_upper');
check('Band Pull-Apart is repeatable prehab',automaticExerciseRouteForIdentity('Band Pull-Apart'),'prehab');
check('Band Pull-Apart cannot fill a main pulling family',automaticMainFamilyForExercise('Band Pull-Apart',{route:'prehab',requestedAsMain:false}),null);
const selector=createAutomaticWeeklyExerciseSelector(['Broad Jumps']);
check('reopened power history counts',selector.canUse({identity:'Broad Jumps',requestedSlot:'core',dayKind:null,route:'power',requestedAsMain:false}),false);
const { resolveTapSwapEnvironment, assessTapSwapCandidateSafety } = require('../utils/tapSwapHierarchy');
const datedProfile={...profile,preferredTrainingDays:['Monday','Thursday']};
const noGym=resolveTapSwapEnvironment({date:'2026-09-30',profile:datedProfile,activeConstraints:[]});
check('replacement environment uses actual gym date',noGym.availableEquipmentTags,['bodyweight']);
check('off-gym foam replacement rejected',assessTapSwapCandidateSafety('Foam Roll — Hip Flexor, Quad, Adductors',noGym).safe,false);
const { injuryReplacementPrescription } = require('../rules/canonicalWeeklyInjuryCompiler');
const { consecutiveIdentityWeeks, decideBlockRotationStagger } = require('../rules/blockRotationStagger');
for(const [fromType,name,type,sets,min,max,side] of [
 ['reps','Foam Roll — Hip Flexor, Quad, Adductors','duration',1,90,120,false],
 ['duration','Foam Roll — Hip Flexor, Quad, Adductors','duration',1,90,120,false],
 ['duration','Adductor Rockback','reps',2,10,12,false],
] as const){
 const dose=injuryReplacementPrescription({prescribedSets:2,prescribedRepsMin:8,prescribedRepsMax:12,prescriptionType:fromType,notes:'OLD CUE'}, {name});
 check(`replacement ${fromType}/${name}`, [dose.prescriptionType,dose.sets,dose.repsMin,dose.repsMax,dose.perSide], [type,sets,min,max,side]);
 check(`replacement clears old cue ${name}`,dose.notes==='OLD CUE',false);
}
const rotationHistory = [
 {blockStartISO:'2026-09-28',slot:'vertical_pull',seatIndex:0,identity:'Single-Arm Lat Pulldown'},
 {blockStartISO:'2026-09-28',slot:'vertical_pull',seatIndex:1,identity:'Pull-Ups'},
 {blockStartISO:'2026-10-26',slot:'vertical_pull',seatIndex:0,identity:'Pull-Ups'},
];
check('identity spans seats and seven calendar weeks',consecutiveIdentityWeeks(rotationHistory,'Pull-Ups','2026-11-16'),7);
check('duplicate history does not double tenure',consecutiveIdentityWeeks([...rotationHistory,...rotationHistory],'Pull-Ups','2026-11-16'),7);
const seats=['squat','hinge','horizontal_push','vertical_push','horizontal_pull','vertical_pull'].map((slot,i)=>({slot,previousIdentity:`old${i}`,wouldRotateTo:`new${i}`,blocksHeld:i===5?1:2,weeksHeld:i===5?7:8,currentGrade:'A',candidateGrade:'A',forced:false}));
check('seven-week lift cannot be held for four more',decideBlockRotationStagger(seats).find((s:any)=>s.slot==='vertical_pull')?.rotates,true);
const gradeSeats=seats.map((s:any,i:number)=>({...s,weeksHeld:8,candidateGrade:i<3?'B':'A',aGradeAlternative:i===2?'A-grade spare':null}));
const gradeDecision=decideBlockRotationStagger(gradeSeats).find((s:any)=>s.slot==='horizontal_push');
check('grade guard tries the suitable A alternative before holding',gradeDecision?.replacementIdentity,'A-grade spare');
check('grade-preserving alternative actually rotates',gradeDecision?.rotates,true);
const jointSeats=[
 {slot:'squat',previousIdentity:'Single-Leg Leg Press',wouldRotateTo:'Single-Leg Leg Press',blocksHeld:1,weeksHeld:4,currentGrade:'B',candidateGrade:'B',aGradeAlternative:'Leg Press',forced:false},
 {slot:'hinge',previousIdentity:'Hip Thrusts',wouldRotateTo:'Single-Leg RDL',blocksHeld:2,weeksHeld:8,currentGrade:'B',candidateGrade:'B',aGradeAlternative:'Trap Bar Deadlift',forced:false},
 {slot:'horizontal_push',previousIdentity:'Incline DB Bench',wouldRotateTo:'Incline DB Bench',blocksHeld:1,weeksHeld:4,currentGrade:'A',candidateGrade:'A',aGradeAlternative:'DB Bench Press',forced:false},
 {slot:'vertical_push',previousIdentity:'Seated DB Press',wouldRotateTo:'Half-Kneeling Single-Arm Overhead Press',blocksHeld:3,weeksHeld:12,currentGrade:'A',candidateGrade:'B',aGradeAlternative:null,forced:false},
 {slot:'horizontal_pull',previousIdentity:'Single-Arm DB Row',wouldRotateTo:'Seated Cable Row',blocksHeld:2,weeksHeld:8,currentGrade:'B',candidateGrade:'A',aGradeAlternative:'Seated Cable Row',forced:false},
 {slot:'vertical_pull',previousIdentity:'Band-Assisted Pull-Up',wouldRotateTo:'Neutral-Grip Pulldown',blocksHeld:2,weeksHeld:8,currentGrade:null,candidateGrade:'A',aGradeAlternative:'Neutral-Grip Pulldown',forced:false},
];
const joint=decideBlockRotationStagger(jointSeats);
check('valid complete plan rotates all four overdue beginner seats',joint.filter((d:any)=>['hinge','vertical_push','horizontal_pull','vertical_pull'].includes(d.slot)&&d.rotates).length,4);
check('joint rotation uses the A-grade hinge alternative',joint.find((d:any)=>d.slot==='hinge')?.replacementIdentity,'Trap Bar Deadlift');
const powers=['Broad Jumps','Jump Squats'].map(identity=>({identity,requestedSlot:'core',dayKind:null,route:'power',requestedAsMain:false} as const));
const powerSelector=createAutomaticWeeklyExerciseSelector(['Broad Jumps']);
check('power uses suitable unused alternative',powerSelector.acceptPower(powers)?.identity,'Jump Squats');
check('power repeats only after all suitable options used',powerSelector.acceptPower(powers)?.identity,'Broad Jumps');
check('empty safe power set never invents fallback',powerSelector.acceptPower([]),null);
// Actual accumulated year inputs, never a hand-built workout fixture.
const reopenFixture = require('./fixtures/annualRotationReopen.json');
const { composeWeek } = require('../rules/composeWeek');
const composedBefore = composeWeek(reopenFixture.before);
const composedAfter = composeWeek(reopenFixture.after);
check('recorded A-grade rotation survives accumulated history and reopen',
 composedAfter.days.map((d:any)=>d.rows),composedBefore.days.map((d:any)=>d.rows));
check('rotation trace distinguishes a quota choice from the eight-week ceiling',
 composedBefore.selectionTraces.find((t:any)=>t.need.movementOrQuality==='horizontal_push')?.selectionReason,
 'staggered_block_rotation');
check('rotation trace names current-block restoration',
 composedAfter.selectionTraces.find((t:any)=>t.need.movementOrQuality==='horizontal_push')?.selectionReason,
 'restored_recorded_selection');
const { fortnightlyCodDoseDue } = require('../rules/weeklyScheduler');
const codInputs={weekStartISO:'2027-01-11',phase:'Pre-season',offseasonBlock:null,clubNights:[],gameDays:[],gameDay:null,readiness:{lowReadiness:false}};
for(const [week,due] of [[1,true],[2,false],[3,false],[4,true],[5,false],[6,true]] as const) {
 check(`Christmas deload catch-up week ${week}`,fortnightlyCodDoseDue({...codInputs,phaseWeekNumber:week+5,christmasBreakWeekNumber:week,weekKind:week===3?'deload':'build'}),due);
}
check('Christmas catch-up waits through another restricted week',fortnightlyCodDoseDue({...codInputs,phaseWeekNumber:10,christmasBreakWeekNumber:5,christmasRestrictedWeeks:[4]}),true);
for(const safety of [{readiness:{lowReadiness:true}},{appRunningPermitted:false},{appSprintPermitted:false},{gameDays:[6],gameDay:6},{clubNights:[2]},{weekKind:'deload'}]) {
 check(`Christmas catch-up still respects ${JSON.stringify(safety)}`,fortnightlyCodDoseDue({...codInputs,phaseWeekNumber:9,christmasBreakWeekNumber:4,...safety}),false);
}
const capturedTargetRow=require('./fixtures/acceptedExerciseTargetRow.json');
const {captureAcceptedExerciseTarget,resolveAcceptedExerciseTarget}=require('../rules/acceptedExerciseTarget');
const {compileCanonicalExerciseEditOnWorkout,resolveCanonicalExerciseEditTarget}=require('../rules/canonicalWeeklyExerciseEditCompiler');
const targetWorkout={id:capturedTargetRow.workoutId,dayOfWeek:1,exercises:[capturedTargetRow]};
const acceptedTarget=captureAcceptedExerciseTarget(targetWorkout,capturedTargetRow);
const changedRow={...capturedTargetRow,id:'rebuilt-row',exercise:{...capturedTargetRow.exercise,name:'Bulgarian Split Squats'}};
const rebuiltWorkout={...targetWorkout,exercises:[changedRow]};
const acceptedEdit={kind:'swap',decisionId:'captured-swap',occurredAt:'2026-08-17T12:00:00Z',dateISO:'2026-08-17',targetName:capturedTargetRow.exercise.name,targetComponentId:capturedTargetRow.id,acceptedTarget,replacement:{name:'Single-Leg Squat (to Box)',sets:3,repsMin:2,repsMax:4,weight:83.75}};
check('accepted choice follows its authored seat across rebuilt IDs',compileCanonicalExerciseEditOnWorkout(rebuiltWorkout,acceptedEdit).exercises[0].exercise.name,'Single-Leg Squat (to Box)');
check('accepted choice keeps its own recorded weight',compileCanonicalExerciseEditOnWorkout(rebuiltWorkout,acceptedEdit).exercises[0].prescribedWeightKg,83.75);
check('ambiguous replacement seats are never guessed',resolveAcceptedExerciseTarget({...rebuiltWorkout,exercises:[changedRow,{...changedRow,id:'other'}]},acceptedTarget),null);
check('a missing slot cannot reuse the old ID on another movement',resolveCanonicalExerciseEditTarget({...targetWorkout,exercises:[{...capturedTargetRow,section18Evidence:{...capturedTargetRow.section18Evidence,slot:'hinge'}}]},acceptedEdit).kind,'not_found');
const duplicateWorkout={...targetWorkout,exercises:[capturedTargetRow,{...capturedTargetRow,id:'duplicate'}]};
const duplicateTarget=captureAcceptedExerciseTarget(duplicateWorkout,capturedTargetRow);
check('an exact duplicate row remains targetable before rebuilding',resolveAcceptedExerciseTarget(duplicateWorkout,duplicateTarget,capturedTargetRow.id),0);
check('duplicate seats with new IDs refuse instead of switching rows',resolveAcceptedExerciseTarget({...duplicateWorkout,exercises:duplicateWorkout.exercises.map((r:any,i:number)=>({...r,id:`new-${i}`}))},duplicateTarget,'missing-id'),null);
check('lost choice refusal reaches an honest screen explanation',require('../rules/programMutationRefusal').classifyProgramMutationRefusal({reason:'accepted_exercise_choice_not_preserved'}).kind,'exercise_choice_not_preserved');
console.log(JSON.stringify({checks, failures},null,2));
if(failures.length) process.exitCode=1;
