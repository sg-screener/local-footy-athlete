require('sucrase/register');
const { armTotalsOrRed, totalsPrinted } = require('./support/totalsOrRed');
armTotalsOrRed();
if (process.env.YEARSCAN_MUTATION)
    require('../../scripts/test-yearscan-mutations.cjs').installMutation(process.env.YEARSCAN_MUTATION);
global.__DEV__ = true;
process.env.TZ = 'Australia/Melbourne';
const disk = new Map();
global.window = { localStorage: { getItem: k => disk.get(k) ?? null, setItem: (k, v) => disk.set(k, v), removeItem: k => disk.delete(k), clear: () => disk.clear() } };
global.fetch = () => { throw Error('offline test'); };
const assert = require('assert/strict'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '../..'), app = p => require(path.join(root, 'src', p));
const j = app('__tests__/support/athleteJourney'), { athleteAnswers, ARCHETYPES } = app('__tests__/compilerYear/catalog'), lattice = app('data/equipmentLattice'), load = app('utils/loadEstimation'), view = app('utils/deriveVisibleWeek');
let passed = 0;
const failures = [];
async function test(name, fn) { if (process.env.YEARSCAN_FILTER && !name.includes(process.env.YEARSCAN_FILTER))
    return; try {
    await fn();
    passed++;
    console.log('PASS ' + name);
}
catch (e) {
    failures.push({ name, error: e.message });
    console.log('FAIL ' + name + ': ' + e.message);
} }
function profile(freq = 4, phase = 'Off-season') { const days = { 2: ['Monday', 'Thursday'], 3: ['Monday', 'Wednesday', 'Friday'], 4: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'], 5: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] }[freq]; return { ...athleteAnswers({ ...ARCHETYPES[2], days, initialPhase: phase, clubDays: [], gameDay: phase === 'In-season' ? 'Saturday' : null }), seasonFinishedOn: '2026-08-01' }; }
async function install(p) { disk.clear(); const x = await j.quietAsync(() => j.coldStartThroughOnboarding({ profile: p, installDayISO: '2026-09-28' })); assert.equal(x.onboardingRefusal, null); return x; }
function rows(days) { return days.map(d => ({ date: d.date, source: d.source, name: d.workout?.name, rows: (d.workout?.exercises ?? []).map(r => ({ name: r.exercise.name, sets: r.prescribedSets, min: r.prescribedRepsMin, max: r.prescribedRepsMax, kg: r.prescribedWeightKg, notes: r.notes })) })); }
(async () => {
    await test('follow-up goals change real generated prescriptions within phase rules', async () => {
        const signatures = {};
        for (const goal of ['make_senior_team','stronger_and_fitter','build_muscle','dominate_level','fresh_on_game_day','stay_injury_free','stay_consistent']) {
            await install({...profile(), goals:[goal]});
            signatures[goal] = rows(j.quiet(() => view.deriveVisibleWeekLive('2026-09-28','2026-09-28')));
            assert.ok((await j.quietAsync(() => j.relaunchApp({storage:disk,todayISO:'2026-09-28'}))).ok);
            assert.deepEqual(rows(j.quiet(() => view.deriveVisibleWeekLive('2026-09-28','2026-09-28'))), signatures[goal]);
        }
        assert.deepEqual(signatures.make_senior_team, signatures.stronger_and_fitter, 'both balanced goals keep the standard program');
        for (const goal of ['build_muscle','dominate_level','fresh_on_game_day','stay_injury_free','stay_consistent'])
            assert.notDeepEqual(signatures[goal], signatures.make_senior_team, goal+' must reach the generated workout');
    });
    await test('follow-up Pull-Ups and Dips remain chosen after shoulder injury, fatigue and an unrelated injury', async () => {
        const p = profile(); await install(p); const date='2026-09-28';
        const report = async (area,region,triggers) => {
            const constraint = app('utils/guidedInjuryControl').buildGuidedInjuryConstraint({region,area,severity:7,severityBand:'moderate',adjustmentLevel:'moderate',triggers,seriousSymptoms:false},{todayISO:date});
            return j.quietAsync(() => app('store/injuryEpisodeTransaction').createOrUpdateInjuryEpisode({constraint,sourceActor:'athlete',sourceSurface:'status_card',todayISO:date}));
        };
        await report('shoulder','upper_body',['pressing']);
        const chosen = () => j.quiet(() => view.deriveVisibleWeekLive(date,date)).find(d=>d.date===date).workout.exercises.filter(r=>r.athleteAdditionId);
        for (const name of ['Pull-Ups','Dips']) {
            const result = await j.quietAsync(() => app('utils/programControlActions').executeProgramControlActionDurably({type:'add_exercise',source:{screen:'session_detail',surface:'exercise_edit_sheet',initiatedBy:'tap'},scope:'today_only',payload:{date,exercise:{name,sets:3,repsMin:8,repsMax:8,weight:0}},requiresRebuild:false,createsActiveModifier:false,oneOffOnly:true},{todayISO:date}));
            assert.ok(result.ok, JSON.stringify(result));
        }
        const before=chosen(); assert.deepEqual(before.map(r=>r.exercise.name),['Pull-Ups','Dips']);
        assert.ok(before.every(r=>!r.unavailableForInjury), 'Add cannot retain a hidden skip instruction');
        const chosenWorkout=j.quiet(()=>view.deriveVisibleWeekLive(date,date)).find(d=>d.date===date).workout;
        const biased=app('rules/goalProgramming').applyGoalProgramming([chosenWorkout],{profile:{...p,goals:['build_muscle','dominate_level']},protectedDays:[],daysToGameByDay:{},injuryAdjusted:false})[0];
        assert.deepEqual(biased.exercises.filter(r=>r.athleteAdditionId),before,'goals do not change deliberate additions');
        const facts=app('rules/temporarySourceFact');
        const fact=facts.createTemporaryFatigueFact({observedDate:date,scope:facts.temporaryFactScope({kind:'date',date}),athleteReportedLevel:'slight',sourceSurface:'status_card'});
        await j.quietAsync(()=>app('store/temporarySourceFactTransaction').transactTemporarySourceFact({operation:'create',fact,todayISO:date}));
        assert.deepEqual(chosen(),before);
        await report('knee','lower_body',['running']);
        assert.deepEqual(chosen(),before,'new knee report cannot reactivate the overridden shoulder restriction');
        const goalChange=await j.quietAsync(()=>app('store/profileProgramTransaction').commitProfileProgramTransaction({change:{kind:'profile_setup',patch:{goals:['build_muscle']}},todayISO:date,sourceSurface:'profile'}));
        assert.ok(goalChange.ok,JSON.stringify(goalChange));
        assert.deepEqual(chosen(),before,'changing goals after injury and Add preserves the exact chosen prescription');
        assert.ok((await j.quietAsync(()=>j.relaunchApp({storage:disk,todayISO:date}))).ok);
        assert.deepEqual(chosen(),before);
    });
    await test('follow-up goal limits preserve loads, movement prep, recovery and manual choices', async () => {
        const policy=app('rules/goalProgramming').applyGoalProgramming;
        const parts=app('utils/sessionComponents').getSessionComponentRows;
        const reps=app('rules/prescriptionDisplay').displayReps;
        for (const phase of ['Off-season','Pre-season','In-season']) {
            await install({...profile(4,phase),goals:['stronger_and_fitter']});
            const workouts=j.quiet(()=>view.deriveVisibleWeekLive('2026-09-28','2026-09-28')).flatMap(d=>d.workout?[d.workout]:[]);
            const context={profile:{...profile(4,phase)},protectedDays:[],daysToGameByDay:{},injuryAdjusted:false};
            for (const goals of [['build_muscle'],['dominate_level'],['stay_injury_free'],['fresh_on_game_day'],['stay_consistent'],['build_muscle','dominate_level','stay_injury_free']]) {
                const output=policy(workouts,{...context,profile:{...context.profile,goals}});
                assert.deepEqual(output.map(w=>[w.id,w.dayOfWeek,w.exercises.map(r=>[r.id,r.exercise.name,r.prescribedWeightKg])]),workouts.map(w=>[w.id,w.dayOfWeek,w.exercises.map(r=>[r.id,r.exercise.name,r.prescribedWeightKg])]),'goal does not change schedule, exercise identity or load');
                let beforeSets=0,afterSets=0,beforeReps=0,afterReps=0;
                for(let i=0;i<workouts.length;i++) {
                    const a=parts(workouts[i]),b=parts(output[i]);
                    assert.deepEqual(a.powerRows,b.powerRows,'goal must not alter the power budget');
                    for(let k=0;k<workouts[i].exercises.length;k++) {
                        const row=workouts[i].exercises[k],next=output[i].exercises[k];
                        if(row.prescriptionType && row.prescriptionType!=='reps') assert.deepEqual(next,row,'timed and Movement Prep prescriptions stay unchanged');
                    }
                    for(const r of [...a.strengthRows,...a.supportRows]) {beforeSets+=r.prescribedSets;beforeReps+=r.prescribedSets*(reps(r.prescribedRepsMin,r.prescribedRepsMax)||0);}
                    for(const r of [...b.strengthRows,...b.supportRows]) {afterSets+=r.prescribedSets;afterReps+=r.prescribedSets*(reps(r.prescribedRepsMin,r.prescribedRepsMax)||0);}
                }
                assert.ok(Math.abs(afterSets-beforeSets)<=Math.floor(beforeSets*.10));
                if(goals.includes('build_muscle')) assert.ok(afterReps-beforeReps<=Math.floor(beforeReps*.10));
                if(phase==='In-season') assert.ok(afterSets<=beforeSets && afterReps<=beforeReps);
                assert.deepEqual(policy(workouts,{...context,profile:{...context.profile,goals},protectedDays:workouts.map(w=>w.dayOfWeek)}),workouts,'recovery weeks stay authoritative');
            }
            for(const restriction of [{injuryAdjusted:true},{daysToGameByDay:Object.fromEntries(workouts.map(w=>[w.dayOfWeek,1]))}])
                assert.deepEqual(policy(workouts,{...context,...restriction,profile:{...context.profile,goals:['dominate_level','build_muscle','stay_injury_free']}}),workouts,'injury and game proximity prevent extra work');
        }
    });
    await test('follow-up changing goals in settings changes the accepted plan and survives reopen', async () => {
        await install({...profile(),goals:['stronger_and_fitter']}); const date='2026-09-28';
        const before=rows(j.quiet(()=>view.deriveVisibleWeekLive(date,date)));
        const result=await j.quietAsync(()=>app('store/profileProgramTransaction').commitProfileProgramTransaction({change:{kind:'profile_setup',patch:{goals:['build_muscle']}},todayISO:date,sourceSurface:'profile'}));
        assert.ok(result.ok,JSON.stringify(result));
        const after=rows(j.quiet(()=>view.deriveVisibleWeekLive(date,date)));
        assert.notDeepEqual(after,before,'saved goal must change actual prescriptions');
        assert.ok((await j.quietAsync(()=>j.relaunchApp({storage:disk,todayISO:date}))).ok);
        assert.deepEqual(rows(j.quiet(()=>view.deriveVisibleWeekLive(date,date))),after);
        assert.deepEqual(app('store/profileStore').useProfileStore.getState().onboardingData.goals,['build_muscle']);
    });
    await test('follow-up displayed reps are the performance target and journey input', async () => {
        await install(profile());
        const week = j.quiet(() => view.deriveVisibleWeekLive('2026-09-28', '2026-09-28'));
        const day = week.find(d => d.workout?.exercises.some(r => r.exercise.name === 'Pull-Ups'));
        assert.ok(day, 'real generated Pull-Ups reached');
        const row = day.workout.exercises.find(r => r.exercise.name === 'Pull-Ups');
        const target = app('rules/prescriptionDisplay').displayReps(row.prescribedRepsMin, row.prescribedRepsMax);
        assert.ok(target < row.prescribedRepsMax, 'probe reaches hidden upper-bound discrepancy');
        j.typeLoadsForSession(day.date, day.workout);
        const sets = app('store/workoutLogStore').useWorkoutLogStore.getState().loggedSets.get(row.id);
        assert.equal(sets.length, row.prescribedSets);
        assert.ok(sets.every(s => s.actualReps === target), 'following the card must log displayed reps');
        const strength = app('utils/strengthLogging').buildStrengthPerformanceLogs(day.workout, {}, 'full', {[row.id]:sets});
        const feedback = {date:day.date, completion:'full', feeling:'good', soreness:'none', strength};
        const history = app('rules/blockBoundaryProgression').readBlockHistory({feedbackByDate:{[day.date]:feedback},blockStartISO:'2026-09-28',blockEndISO:'2026-10-25',requiredStrengthSessions:1});
        assert.equal(history.prescribedTargetCompletedByExercise['Pull-Ups'], true);
        for (const log of strength) if (log.exerciseName==='Pull-Ups') log.actualReps=target-1;
        const short = app('rules/blockBoundaryProgression').readBlockHistory({feedbackByDate:{[day.date]:feedback},blockStartISO:'2026-09-28',blockEndISO:'2026-10-25',requiredStrengthSessions:1});
        assert.equal(short.prescribedTargetCompletedByExercise['Pull-Ups'], undefined);

    });
    await test('follow-up injury then Add then slight fatigue preserves the chosen row', async () => {
        const p = athleteAnswers(ARCHETYPES[0]); await install(p);
        const date = '2026-09-28';
        const constraint = app('utils/guidedInjuryControl').buildGuidedInjuryConstraint({region:'lower_body',area:'knee',severity:7,severityBand:'moderate',adjustmentLevel:'moderate',triggers:['running'],seriousSymptoms:false},{todayISO:date});
        await j.quietAsync(() => app('store/injuryEpisodeTransaction').createOrUpdateInjuryEpisode({constraint,sourceActor:'athlete',sourceSurface:'status_card',todayISO:date}));
        const day = j.quiet(() => view.deriveVisibleWeekLive(date,date)).find(d => d.workout?.exercises.length);
        j.setJourneyClock(day.date);
        const result = await j.quietAsync(() => app('utils/programControlActions').executeProgramControlActionDurably({type:'add_exercise',source:{screen:'session_detail',surface:'exercise_edit_sheet',initiatedBy:'tap'},scope:'today_only',payload:{date:day.date,exercise:{name:'Back Squat',sets:3,repsMin:5,repsMax:5,weight:20}},requiresRebuild:false,createsActiveModifier:false,oneOffOnly:true},{todayISO:day.date}));
        assert.ok(result.ok);
        const chosen = () => j.quiet(() => view.deriveVisibleWeekLive(date,day.date)).find(d => d.date===day.date).workout.exercises.find(r => r.athleteAdditionId && r.exercise.name==='Back Squat');
        const before = chosen(); assert.ok(before); assert.equal(before.unavailableForInjury, undefined);
        const facts = app('rules/temporarySourceFact');
        const fact = facts.createTemporaryFatigueFact({observedDate:day.date,scope:facts.temporaryFactScope({kind:'date',date:day.date}),athleteReportedLevel:'slight',sourceSurface:'status_card'});
        await j.quietAsync(() => app('store/temporarySourceFactTransaction').transactTemporarySourceFact({operation:'create',fact,todayISO:day.date}));
        assert.deepEqual(chosen(), before, 'unrelated fatigue must not revoke the Add');
        assert.ok((await j.quietAsync(() => j.relaunchApp({storage:disk,todayISO:day.date}))).ok);
        assert.deepEqual(chosen(), before, 'chosen row survives durable reconstruction');
    });
    await test('dumbbell signed step continues above 60 for estimates and increases', () => { for (const [input, expected] of [[9.9, 9], [10, 10], [12.4, 10], [12.5, 12.5], [61, 60], [62.5, 62.5], [67.5, 67.5], [90, 90], [200, 200]])
        assert.equal(lattice.roundDownToLattice(input, 'dumbbell'), expected); for (const [input, expected] of [[9, 10], [10, 12.5], [60, 62.5], [67.5, 70], [90.1, 92.5]])
        assert.equal(lattice.nextAutomaticLoadRung(input, 'dumbbell'), expected); assert.equal(lattice.normaliseAutomaticLoadChange({ baseKg: 61.3, targetKg: 61.3, kind: 'dumbbell' }), 61.3); });
    await test('strong athlete estimate uses two 67.5 kg dumbbells', () => { assert.equal(load.estimateStartingWeight('Shrugs', { ...profile(), weightKg: 150, benchStrength: '1.5x bodyweight+', squatStrength: '2x bodyweight+' }), 135); });
    for (const freq of [2, 3, 4, 5])
        for (const anchor of ['none', 'usual', 'legacy', 'both'])
            await test(`Off-season ${freq} days ${anchor} game fields: exact reopen`, async () => { const p = profile(freq); if (anchor === 'usual' || anchor === 'both')
                p.usualGameDay = 'Saturday'; if (anchor === 'legacy' || anchor === 'both')
                p.gameDay = 'Saturday'; await install(p); const before = rows(j.quiet(() => view.deriveVisibleWeekLive('2026-09-28', '2026-09-28'))); const boot = await j.quietAsync(() => j.relaunchApp({ storage: disk, todayISO: '2026-09-28' })); assert.equal(boot.ok, true); assert.deepEqual(rows(j.quiet(() => view.deriveVisibleWeekLive('2026-09-28', '2026-09-28'))), before); assert.deepEqual(app('store/calendarStore').useCalendarStore.getState().markedDays, {}); });
    for (const freq of [2, 3, 4, 5])
        await test(`athlete can add and repeat power in early Off-season, ${freq} days`, async () => { await install({ ...profile(freq), seasonFinishedOn: '2026-09-27' }); const day = j.quiet(() => view.deriveVisibleWeekLive('2026-09-28', '2026-09-28')).find(d => d.workout?.exercises?.some(r => r.section18Evidence?.role === 'main_strength')); assert.ok(day); j.setJourneyClock(day.date); const menu = app('utils/addExerciseCandidates'), tap = app('utils/tapSwapHierarchy'); for (let n = 0; n < 2; n++) {
            const current = j.quiet(() => view.deriveVisibleWeekLive('2026-09-28', day.date)).find(d => d.date === day.date);
            const environment = j.quiet(() => tap.resolveTapSwapEnvironment({ date: day.date, profile: app('store/profileStore').useProfileStore.getState().onboardingData, activeConstraints: [], readinessSignal: null }));
            const candidate = menu.legalAddCandidates({ environment, existingExerciseNames: current.workout.exercises.map(r => r.exercise.name), profile: profile(freq), leaf: 'power' }).find(c => c.name === 'Box Jumps');
            assert.ok(candidate, 'Box Jumps remains offered including repeat');
            const result = await j.quietAsync(() => app('utils/programControlActions').executeProgramControlActionDurably({ type: 'add_exercise', source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' }, scope: 'today_only', payload: { date: day.date, exercise: { ...candidate, weight: candidate.weightKg, ...menu.addExerciseSectionContext('strength', 'power') } }, requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true }, { todayISO: day.date }));
            assert.ok(result.ok, JSON.stringify(result));
        } const before = rows(j.quiet(() => view.deriveVisibleWeekLive('2026-09-28', day.date))); assert.equal(before.find(d => d.date === day.date).rows.filter(r => r.name === 'Box Jumps').length, 2); assert.ok((await j.quietAsync(() => j.relaunchApp({ storage: disk, todayISO: day.date }))).ok); assert.deepEqual(rows(j.quiet(() => view.deriveVisibleWeekLive('2026-09-28', day.date))), before); });
    await test('conditioning duration step keeps two blocks and updates actual minutes and card', () => { const template = app('data/conditioningTemplates').CONDITIONING_TEMPLATES.find(t => t.name === 'Controlled 10–20 min Blocks'); assert.ok(template); const exercises = app('rules/conditioningSelection').composeConditioningRows(template, '2026-09-28', { weekInBlock: 2 }); const workout = { id: 'pure-conditioning-dose', exercises, conditioningCategory: 'tempo' }; const before = exercises.find(r => r.exercise.name === template.name); assert.equal(before.prescribedSets, 2); assert.match(before.notes, /Work: 15 min/); const out = app('rules/blockBoundaryProgression').applyBlockBoundaryConditioningAdvance({ workouts: [workout], advances: [{ weekIndex: 0, workoutId: workout.id, templateName: template.name, stepped: true, step: { kind: 'authored_duration_increase', from: 15, to: 16, authoredFrom: template.workPeriod } }] })[0].exercises.find(r => r.id === before.id); assert.equal(out.prescribedSets, 2); assert.match(out.notes, /Work: 16 min/); assert.match(out.notes, /Sets: 2/); assert.equal(out.prescribedRepsMin, 16); assert.equal(out.prescriptionType, 'duration_minutes'); });
    await test('conditioning progression begins at the actual context dose', () => { const templates = app('data/conditioningTemplates').CONDITIONING_TEMPLATES; const template = templates.find(t => t.name === 'Controlled 10–20 min Blocks'); const out = app('rules/conditioningDoseStep').nextAuthoredDose(template, { sets: 2, work: '18 min', rest: '2 min' }); assert.equal(out.step.from, 18); assert.equal(out.step.to, 19); });
    await test('warning matrix: near-game and same heavy lift only', async () => {
        await install(profile());
        const week = j.quiet(() => view.deriveVisibleWeekLive('2026-09-28', '2026-09-28'));
        const { athleteAdditionWarnings: w } = app('rules/athleteAdditionWarnings');
        const main = week.flatMap(d => d.workout?.exercises ?? []).find(r => app('utils/sessionRoles').classifyExerciseRole(r.exercise.name) === 'main_lift');
        assert.ok(main);
        for (const [date, near] of [['2026-09-30', false], ['2026-10-01', true], ['2026-10-02', true], ['2026-10-03', true], ['2026-10-04', false]]) {
            assert.deepEqual(w({ dateISO: date, exerciseName: 'Box Jumps', gameDates: ['2026-10-03'], week }), near ? ['near_game'] : []);
            assert.deepEqual(w({ dateISO: date, exerciseName: main.exercise.name, gameDates: ['2026-10-03'], week }), near ? ['near_game', 'repeat_heavy'] : ['repeat_heavy']);
        }
        assert.deepEqual(w({ dateISO: '2026-10-05', exerciseName: main.exercise.name, gameDates: [], week }), []);
    });
    await test('every catalogue choice stays in Add despite limited kit, experience, injury or an existing row', async () => {
        const p = athleteAnswers(ARCHETYPES[0]);
        await install(p);
        const tap = app('utils/tapSwapHierarchy'), menu = app('utils/addExerciseCandidates');
        const normal = j.quiet(() => tap.resolveTapSwapEnvironment({ date: '2026-09-28', profile: p, activeConstraints: [], readinessSignal: null }));
        const all = (environment, existingExerciseNames = []) => { const args = { profile: p, environment, existingExerciseNames }; return [...new Set(menu.legalAddFamilies(args).flatMap(f => f.groups.flatMap(g => g.leaves.flatMap(l => menu.legalAddCandidates({ ...args, leaf: l.id }).map(c => c.name)))))].sort(); };
        const names = all(normal);
        assert.ok(names.length > 100);
        assert.ok(names.includes('Box Jumps'));
        assert.ok(names.includes('Back Squat'));
        for (const environment of [normal, { ...normal, activeInjuries: { knee: 'avoid', hamstring: 'avoid' }, primaryInjury: { bucket: 'knee', severity: 7 }, isLowCapacity: true }])
            assert.deepEqual(all(environment, names), names);
        // Automatic swap alternatives still filter those same choices.
        assert.equal(app('utils/tapSwapHierarchy').assessTapSwapCandidateSafety('Back Squat', normal).safe, false);
        const automatic = menu.legalAddFamilies({ profile: p, environment: normal }).flatMap(f => f.groups.flatMap(g =>
            g.leaves.flatMap(l => menu.legalAutomaticAdditionCandidates({ profile: p, environment: normal, leaf: l.id }))));
        assert.ok(automatic.length > 0);
        assert.ok(!automatic.some(c => c.name === 'Back Squat'), 'automatic injury additions retain equipment/experience filtering');
    });
    await test('manual heavy lift near game accepts and survives reopen and Undo', async () => {
        const p = profile(4, 'In-season');
        await install(p);
        const week = j.quiet(() => view.deriveVisibleWeekLive('2026-09-28', '2026-09-28'));
        const target = week.find(d => d.date === '2026-10-01' && d.workout);
        assert.ok(target);
        j.setJourneyClock(target.date);
        const source = week.flatMap(d => d.workout?.exercises ?? []).find(r => app('utils/sessionRoles').classifyExerciseRole(r.exercise.name) === 'main_lift');
        assert.ok(source);
        const before = rows(week);
        const result = await j.quietAsync(() => app('utils/programControlActions').executeProgramControlActionDurably({ type: 'add_exercise', source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' }, scope: 'today_only', payload: { date: target.date, exercise: { name: source.exercise.name, sets: source.prescribedSets, repsMin: source.prescribedRepsMin, repsMax: source.prescribedRepsMax, weight: source.prescribedWeightKg } }, requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true }, { todayISO: target.date }));
        assert.ok(result.ok, JSON.stringify(result));
        const after = rows(j.quiet(() => view.deriveVisibleWeekLive('2026-09-28', target.date)));
        const added = after.find(d => d.date === target.date).rows;
        assert.equal(added.length, before.find(d => d.date === target.date).rows.length + 1);
        assert.ok((await j.quietAsync(() => j.relaunchApp({ storage: disk, todayISO: target.date }))).ok);
        assert.deepEqual(rows(j.quiet(() => view.deriveVisibleWeekLive('2026-09-28', target.date))), after);
        assert.equal((await j.quietAsync(() => app('store/undoLastDecision').undoLastDecision())).outcome, 'undone');
        assert.deepEqual(rows(j.quiet(() => view.deriveVisibleWeekLive('2026-09-28', target.date))), before);
    });
    for (const phase of ['Pre-season', 'In-season'])
        await test(`${phase} real recurring games remain through reopen`, async () => {
            await install({ ...profile(4, phase), gameDay: 'Saturday', usualGameDay: 'Saturday' });
            const before = rows(j.quiet(() => view.deriveVisibleWeekLive('2026-09-28', '2026-09-28')));
            assert.ok(before.some(d => d.name === 'Game Day' || d.source === 'game' || d.rows.some(r => r.name === 'Game')), 'actual recurring game present');
            assert.ok((await j.quietAsync(() => j.relaunchApp({ storage: disk, todayISO: '2026-09-28' }))).ok);
            assert.deepEqual(rows(j.quiet(() => view.deriveVisibleWeekLive('2026-09-28', '2026-09-28'))), before);
        });
    await test('all authored conditioning steps keep count, time and recovery in their own fields', () => {
        const { CONDITIONING_TEMPLATES: T } = app('data/conditioningTemplates'), { composeConditioningRows } = app('rules/conditioningSelection'), { nextAuthoredDose } = app('rules/conditioningDoseStep'), d = app('rules/conditioningDisplay');
        const kinds = new Set(), templates = new Set();
        let occurrences = 0;
        for (const template of T)
            for (const weekInBlock of [1, 2, 3, 4]) {
                const row = composeConditioningRows(template, '2026-09-28', { weekInBlock }).find(r => r.exercise.name === template.name);
                if (!row)
                    continue;
                const outcome = nextAuthoredDose(template, d.currentConditioningDose(row));
                if (!outcome.stepped)
                    continue;
                const s = outcome.step, changed = d.applyConditioningDoseStep(row, s);
                assert.notDeepEqual(changed, row, template.name);
                assert.equal(changed.exercise.name, row.exercise.name);
                const current = d.currentConditioningDose(changed);
                if (s.kind === 'authored_sets_increase') {
                    assert.equal(changed.prescribedSets, s.to);
                    assert.equal(current.sets, s.to);
                    assert.equal(current.work, d.currentConditioningDose(row).work);
                    assert.equal(changed.restSeconds, row.restSeconds);
                }
                else {
                    assert.equal(changed.prescribedSets, row.prescribedSets);
                    assert.equal(current.sets, d.currentConditioningDose(row).sets);
                    if (s.kind === 'authored_duration_increase') {
                        assert.equal(changed.prescribedRepsMin, s.to);
                        assert.equal(changed.restSeconds, row.restSeconds);
                        assert.notEqual(current.work, d.currentConditioningDose(row).work);
                    }
                    else {
                        assert.notEqual(current.rest, d.currentConditioningDose(row).rest);
                        assert.equal(current.work, d.currentConditioningDose(row).work);
                    }
                }
                kinds.add(s.kind);
                templates.add(template.name);
                occurrences++;
            }
        assert.equal(kinds.size, 3);
        assert.ok(templates.size >= 10);
        console.log(JSON.stringify({ instrument: 'authored template × week-context dose applications', occurrences, distinctTemplates: templates.size, dedupKey: 'template.name' }));
    });
    await test('actual four-week feedback advances conditioning, but never in a scheduled deload', async () => {
        const p = profile(5);
        await install(p);
        const { plusDays } = app('__tests__/compilerYear/catalog');
        for (let offset = 0; offset < 28; offset++) {
            const date = plusDays('2026-09-28', offset);
            j.setJourneyClock(date);
            await j.quietAsync(() => j.recordDay(date, { record: true, completion: 'full', feeling: 'hard', soreness: 'none', difficulty: 6, logWeights: true, conditioningRpe: 2 }));
        }
        const boundary = app('rules/blockBoundaryProgression'), original = boundary.decideBlockBoundaryConditioningAdvance, calls = [];
        boundary.decideBlockBoundaryConditioningAdvance = args => { const result = original(args); calls.push({ args, result }); return result; };
        try {
            j.setJourneyClock('2026-10-26');
            const rolled = j.quiet(() => j.rolloverIfDue('2026-10-26'));
            assert.ok(rolled.fired, JSON.stringify(rolled));
        }
        finally {
            boundary.decideBlockBoundaryConditioningAdvance = original;
        }
        assert.ok(calls.some(c => c.args.history.byQuality.conditioningEasy), 'real feedback reached easy conditioning');
        assert.ok(calls.some(c=>c.args.history.prescribedTargetCompletedByExercise['Pull-Ups']), 'real displayed Pull-Up reps reach block history');
        const program=app('store/programStore').useProgramStore.getState().currentProgram;
        const bodyweightRise=(program.blockBoundaryExplanation??[]).find(row=>row.exerciseName==='Pull-Ups' && row.kind==='bodyweight_progressed');
        assert.ok(bodyweightRise,'following the displayed Pull-Up prescription can earn a first added-load suggestion');
        assert.ok(calls.some(c => c.result.some(d => d.stepped)), 'at least one actual advance');
        assert.ok(calls.some(c => c.args.weekKind === 'deload'), 'actual deload reached');
        for (const c of calls.filter(c => c.args.weekKind === 'deload'))
            assert.deepEqual(c.result, []);
        const before = rows(j.quiet(() => view.deriveVisibleWeekLive('2026-10-26', '2026-10-26')));
        assert.ok((await j.quietAsync(() => j.relaunchApp({ storage: disk, todayISO: '2026-10-26' }))).ok);
        assert.deepEqual(rows(j.quiet(() => view.deriveVisibleWeekLive('2026-10-26', '2026-10-26'))), before);
    });
    for (const date of ['2026-09-28', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'])
        await test(`whole-session Add stays available and accepts another strength session on ${date}`, async () => {
            await install(profile(4, 'In-season'));
            j.setJourneyClock(date);
            const producer = app('utils/planChangeProducer');
            let week = j.quiet(() => view.deriveVisibleWeekLive('2026-09-28', date));
            const options = j.quiet(() => producer.listPlanChangeOptionsForDay({ visibleWeek: week, date, todayISO: date }));
            assert.equal(options.canAdd, true);
            assert.ok(options.categories.some(c => c.id === 'strength_lower'));
            if (options.hasSession)
                assert.ok(options.addOnTopCategories.some(c => c.id === 'strength_lower'), 'second strength option is offered');
            const preview = j.quiet(() => producer.previewPlanChangeRisk({ change: { kind: 'add_category', date, category: 'strength_lower' }, visibleWeek: week, todayISO: date }));
            assert.ok(preview.ok, JSON.stringify(preview.rejected));
            assert.ok(!preview.g1Ask, 'Add keeps the selected session and uses only the advisory warning');
            assert.ok(preview.assessment.findings.every(f => f.canOverride && /^athlete_add_(near_game|repeat_heavy)$/.test(f.ruleId)));
            if (['2026-10-01', '2026-10-02', '2026-10-03'].includes(date)) {
                assert.equal(preview.assessment.decision, 'confirm');
                assert.ok(preview.assessment.findings.some(f => f.ruleId === 'athlete_add_near_game'));
            }
            const before = rows(week);
            const priorIds = new Set(week.find(d => d.date === date).workout?.exercises.map(r => r.id) ?? []);
            const applyOriginal = producer.applyPlanChange;
            let appliedDetail;
            producer.applyPlanChange = args => { const result = applyOriginal(args); appliedDetail = result; return result; };
            const outcome = await j.quietAsync(() => app('utils/programControlActions').executeProgramControlActionDurably({ type: 'add_to_day', source: { screen: 'program_tab', surface: 'plan_change_sheet', initiatedBy: 'tap' }, scope: 'today_only', payload: { date, category: 'strength_lower' }, requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true }, { todayISO: date, visibleWeek: week }));
            producer.applyPlanChange = applyOriginal;
            assert.ok(outcome.ok, JSON.stringify({ outcome, appliedDetail }));
            const after = rows(j.quiet(() => view.deriveVisibleWeekLive('2026-09-28', date)));
            assert.ok(after.find(d => d.date === date).rows.length > before.find(d => d.date === date).rows.length, 'added training visible');
            const addedRows = j.quiet(() => view.deriveVisibleWeekLive('2026-09-28', date)).find(d => d.date === date).workout.exercises.filter(r => !priorIds.has(r.id));
            assert.ok(addedRows.some(r => r.section18Evidence?.role === 'main_strength'), 'chosen main strength work is not silently replaced by accessories');
            if (date === '2026-10-03') {
                assert.equal(after.find(d => d.date === date).source, 'game', 'real game remains');
                const parts = app('rules/projectVisibleWeek').projectParts({ week: j.quiet(() => view.deriveVisibleWeekLive('2026-09-28', date)), weekStart: '2026-09-28' }).days.find(d => d.date === date).parts;
                assert.ok(parts.some(p => p.kind === 'game'));
                assert.ok(parts.some(p => p.kind === 'strength'));
            }
            assert.ok((await j.quietAsync(() => j.relaunchApp({ storage: disk, todayISO: date }))).ok);
            assert.deepEqual(rows(j.quiet(() => view.deriveVisibleWeekLive('2026-09-28', date))), after);
            if (date === '2026-09-28') {
                let previousCount = after.find(d => d.date === date).rows.length;
                for (let additionalSession = 0; additionalSession < 2; additionalSession++) {
                    const currentWeek = j.quiet(() => view.deriveVisibleWeekLive('2026-09-28', date));
                    const again = await j.quietAsync(() => app('utils/programControlActions').executeProgramControlActionDurably({
                        type: 'add_to_day', source: { screen: 'program_tab', surface: 'plan_change_sheet', initiatedBy: 'tap' },
                        scope: 'today_only', payload: { date, category: 'strength_lower' }, requiresRebuild: false,
                        createsActiveModifier: false, oneOffOnly: true,
                    }, { todayISO: date, visibleWeek: currentWeek }));
                    assert.ok(again.ok, 'a third/fourth session is accepted: ' + JSON.stringify(again));
                    const accepted = rows(j.quiet(() => view.deriveVisibleWeekLive('2026-09-28', date)));
                    assert.ok(accepted.find(d => d.date === date).rows.length > previousCount);
                    previousCount = accepted.find(d => d.date === date).rows.length;
                    assert.ok((await j.quietAsync(() => j.relaunchApp({ storage: disk, todayISO: date }))).ok);
                    assert.deepEqual(rows(j.quiet(() => view.deriveVisibleWeekLive('2026-09-28', date))), accepted);
                }
            }
        });
    await test('injury and beginner kit limits do not veto a deliberate exercise Add', async () => {
        const p = athleteAnswers(ARCHETYPES[0]);
        await install(p);
        const constraint = app('utils/guidedInjuryControl').buildGuidedInjuryConstraint({ region: 'lower_body', area: 'knee', severity: 7, severityBand: 'moderate', adjustmentLevel: 'moderate', triggers: ['running'], seriousSymptoms: false }, { todayISO: '2026-09-28' });
        const injury = await j.quietAsync(() => app('store/injuryEpisodeTransaction').createOrUpdateInjuryEpisode({ constraint, sourceActor: 'athlete', sourceSurface: 'status_card', todayISO: '2026-09-28' }));
        assert.ok(!['conflicted', 'safely_rejected'].includes(injury.outcome), JSON.stringify(injury));
        const day = j.quiet(() => view.deriveVisibleWeekLive('2026-09-28', '2026-09-28')).find(d => d.workout?.exercises.length);
        assert.ok(day);
        j.setJourneyClock(day.date);
        const result = await j.quietAsync(() => app('utils/programControlActions').executeProgramControlActionDurably({ type: 'add_exercise', source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' }, scope: 'today_only', payload: { date: day.date, exercise: { name: 'Back Squat', sets: 3, repsMin: 5, repsMax: 5, weight: 20 } }, requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true }, { todayISO: day.date }));
        assert.ok(result.ok, JSON.stringify(result));
        const before = rows(j.quiet(() => view.deriveVisibleWeekLive('2026-09-28', day.date)));
        assert.ok(before.find(d => d.date === day.date).rows.some(r => r.name === 'Back Squat'));
        assert.ok((await j.quietAsync(() => j.relaunchApp({ storage: disk, todayISO: day.date }))).ok);
        assert.deepEqual(rows(j.quiet(() => view.deriveVisibleWeekLive('2026-09-28', day.date))), before);
    });
    await test('later injury and equipment reports adjust earlier manual sessions and Clear restores them', async () => {
        let cells = 0;
        await app('__tests__/support/specialSessionInputTruth').specialSessionInputTruth(disk, (label, value, detail) => {
            cells++;
            assert.ok(value, label + ': ' + (detail ?? ''));
        });
        assert.equal(cells, 74, '18 onboarding journeys reach 74 Add, injury, kit, Clear and restart checks');
    });
    await test('Add screens bind warnings and keep the continue button without duplicate/session caps', () => {
        const screen = fs.readFileSync(path.join(root, 'src/screens/home/DayWorkoutScreenV2.tsx'), 'utf8');
        const mount = screen.indexOf('<ExerciseEditSheet');
        assert.ok(mount >= 0);
        const end = screen.indexOf('<SessionEquipmentSheet', mount);
        assert.ok(end > mount);
        const region = screen.slice(mount, end);
        assert.ok(region.length > 300);
        for (const part of ['addWarningsFor=', 'athleteAdditionWarnings', 'gameDates:', 'week: deriveVisibleWeekLive', 'onApplyAddToday={applyAddToday}'])
            assert.ok(region.includes(part), part);
        const render = screen.indexOf("const warnings = addWarningsFor(step.suggestion.name)");
        assert.ok(render >= 0);
        const footer = screen.indexOf("case 'future_scope'", render);
        assert.ok(footer > render);
        const body = screen.slice(render, footer);
        assert.ok(body.includes('warnings.map'));
        assert.ok(body.includes('ATHLETE_ADD_ANYWAY'));
        assert.ok(body.includes('onApplyAddToday(step)'));
        const sheet = fs.readFileSync(path.join(root, 'src/screens/home/PlanChangeSheet.tsx'), 'utf8');
        assert.ok(!sheet.includes('add_blocked_duplicate'));
        assert.ok(!sheet.includes('add_blocked_max_sessions'));
    });
    console.log(JSON.stringify({ suite: 'yearscan-repairs', passed, failed: failures.length, failures }));
    totalsPrinted(failures.length);
})().catch(e => { console.error(e); process.exitCode = 1; });
