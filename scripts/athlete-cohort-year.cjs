'use strict';
// Sam, 2026-09-02: "I'm going to run a full audit on these athletes" — six
// presets over the preserved real-onboarding/52-week driver, the same way
// `programming-remediation-year.cjs` runs the two audit athletes. One preset
// per run: `node scripts/athlete-cohort-year.cjs --preset=<id> --output=<dir> [--weeks=N]`.
//
// The driver is never edited: it is read, patched by exact anchors (a missing
// or repeated anchor throws) and compiled in memory, so the cohort answers to
// the same sequence of real doors (onboarding, weekly rollover, logging,
// readiness/illness/injury taps, fixtures, restarts) as the pair audit.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { ACCEPTED_CHRISTMAS_BREAK } = require('./programming-final-year-audit-rules.cjs');

const repo = path.resolve(__dirname, '..');
const presetId = process.argv.find(a => a.startsWith('--preset='))?.slice(9);
const output = path.resolve(repo, process.argv.find(a => a.startsWith('--output='))?.slice(9) ?? `outputs/athlete-cohort/${presetId}`);

/** The six athletes Sam named, as onboarding answers plus a year script. */
const PRESETS = {
  'two-day': {
    label: 'Two-day athlete', gender: 'male', experience: '2-5 years', kit: 'commercial_gym', weeks: 52,
    days: { offSeason: ['Monday', 'Thursday'], preSeason: ['Monday', 'Thursday'], inSeason: ['Monday', 'Thursday'] },
  },
  'three-day': {
    label: 'Normal three-day athlete', gender: 'female', experience: '2-5 years', kit: 'commercial_gym', weeks: 52,
    days: { offSeason: ['Monday', 'Wednesday', 'Friday'], preSeason: ['Monday', 'Wednesday', 'Friday'], inSeason: ['Monday', 'Wednesday', 'Friday'] },
    female: { heightCm: 168, weightKg: 66, squatStrength: 'Around bodyweight', benchStrength: 'Less than bodyweight', twoKmSeconds: 540 },
  },
  'beginner-three-years': {
    label: 'Beginner over three years', gender: 'male', experience: 'Complete beginner', kit: 'commercial_gym', weeks: 156,
    days: { offSeason: ['Monday', 'Wednesday', 'Friday'], preSeason: ['Monday', 'Wednesday', 'Friday'], inSeason: ['Monday', 'Wednesday', 'Friday'] },
    strength: { squatStrength: 'Less than bodyweight', benchStrength: 'Less than bodyweight', twoKmSeconds: 600 },
    // Sam, 2026-09-02: "for now just let the robot do it for him" — the grade
    // moves up in the profile at the start of years two and three.
    gradeByYear: { 2: '1-2 years', 3: '2-5 years' },
  },
  'minimal-kit': {
    label: 'Minimal equipment athlete', gender: 'female', experience: '2-5 years', weeks: 52,
    kit: { // squat rack and barbell, bench, pull-up bar, kettlebells, dumbbells, bands, plyo box — nothing else
      tags: { barbell: 'have', rack: 'have', dumbbells: 'have', bands: 'have', bench: 'have', pullup_bar: 'have', kettlebell: 'have', plyo_box: 'have',
        cables: 'lack', machine: 'lack', foam_roller: 'lack', trap_bar: 'lack', swiss_ball: 'lack', ab_wheel: 'lack', back_extension_bench: 'lack', medicine_ball: 'lack', dip_bars: 'lack', rings_trx: 'lack' },
      modalities: {},
      legacy: ['squat_rack', 'barbell', 'bench', 'pullup_bar', 'kettlebell', 'dumbbells', 'bands', 'plyo_box'],
      location: 'Home',
    },
    days: { offSeason: ['Monday', 'Tuesday', 'Thursday', 'Friday'], preSeason: ['Monday', 'Tuesday', 'Thursday', 'Friday'], inSeason: ['Monday', 'Tuesday', 'Thursday', 'Friday'] },
    female: { heightCm: 168, weightKg: 66, squatStrength: 'Around bodyweight', benchStrength: 'Less than bodyweight', twoKmSeconds: 540 },
  },
  'misses-sessions': {
    label: 'Athlete who regularly misses sessions', gender: 'male', experience: '5+ years', kit: 'commercial_gym', weeks: 52,
    days: { offSeason: ['Monday', 'Tuesday', 'Thursday', 'Friday'], preSeason: ['Monday', 'Tuesday', 'Thursday', 'Friday'], inSeason: ['Monday', 'Tuesday', 'Thursday', 'Friday'] },
    // Every Friday is never opened; weeks 14 and 40 are missed entirely; every
    // third Tuesday is opened and marked skipped.
    misses: { neverOpened: (i, d) => d === 4 || i === 13 || i === 39, skipped: (i, d) => d === 1 && i % 3 === 2 },
  },
  'club-rpe-swings': {
    label: 'Athlete whose club-night effort swings', gender: 'male', experience: '5+ years', kit: 'commercial_gym', weeks: 52,
    days: { offSeason: ['Monday', 'Tuesday', 'Thursday', 'Friday'], preSeason: ['Monday', 'Tuesday', 'Thursday', 'Friday'], inSeason: ['Monday', 'Tuesday', 'Thursday', 'Friday'] },
    // Club-night effort by week: easy, brutal, easy, hard, very easy, brutal.
    clubRpeByWeek: [4, 9, 5, 8, 3, 10],
  },
};
const preset = PRESETS[presetId];
if (!preset) throw new Error(`Unknown preset ${presetId}; choose one of ${Object.keys(PRESETS).join(', ')}`);
const weeks = Number(process.argv.find(a => a.startsWith('--weeks='))?.slice(8) ?? preset.weeks);

const original = path.join(repo, 'outputs/release-candidate-0bcc3353-rcsteps/current-shoulder-review/generate-year.cjs');
let code = fs.readFileSync(original, 'utf8');
const originalHash = createHash('sha256').update(code).digest('hex');
const replace = (from, to) => {
  if (code.split(from).length !== 2) throw Error(`Driver anchor missing or repeated: ${from.slice(0, 80)}`);
  code = code.replace(from, to);
};

// ── The same corrections the pair audit applies ─────────────────────────────
replace("const repo = '/Users/samgeurts/Documents/local-footy-athlete';", `const repo = ${JSON.stringify(repo)};`);
replace("function phaseFor(i) {return i<12?'Off-season':i<28?'Pre-season':'In-season';}\nfunction phaseWeek(i) {return i<12?i+1:i<28?i-11:i-27;}",
  `const {annualFootballPhaseForIndex,annualFootballPhaseWeek}=app('src/rules/annualFootballPhaseCalendar');
// A multi-year run repeats the canonical annual calendar each year.
function phaseFor(i) {return annualFootballPhaseForIndex(i%52);}
function phaseWeek(i) {return annualFootballPhaseWeek(i%52);}`);
replace('if(i===12||i===28) {', 'if(i%52===7||i%52===26||(i>0&&i%52===0)) {');
replace("teamTrainingDays:['Tuesday','Thursday']", "teamTrainingDays:phase==='Pre-season'?['Monday','Wednesday']:['Tuesday','Thursday']");
replace("assumptions:{offSeasonWeeks:12,preSeasonWeeks:16,inSeasonWeeks:24,clubDays:['Tuesday','Thursday']",
  `assumptions:{preset:${JSON.stringify(presetId)},label:${JSON.stringify(preset.label)},weeks:${weeks},offSeasonWeeks:7,preSeasonWeeks:19,inSeasonWeeks:26,preSeasonClubDays:['Monday','Wednesday'],inSeasonClubDays:['Tuesday','Thursday']`);
replace("const weekLimit = Number(process.argv.find(a=>a.startsWith('--weeks='))?.split('=')[1]??52);", `const weekLimit = ${weeks};`);

// ── The preset's own answers ────────────────────────────────────────────────
replace("const archetype={id:`year-${gender}`,gender,days:sixDays,experience:'5+ years',equipment:'commercial',initialPhase:'Off-season',clubDays:['Tuesday','Thursday'],gameDay:'Saturday',extraGame:false};",
  `const presetDays=(phase)=>phase==='Off-season'?${JSON.stringify(preset.days.offSeason)}:phase==='Pre-season'?${JSON.stringify(preset.days.preSeason)}:${JSON.stringify(preset.days.inSeason)};
  const archetype={id:${JSON.stringify(`cohort-${presetId}`)},gender,days:presetDays('Off-season'),experience:${JSON.stringify(preset.experience)},equipment:'commercial',initialPhase:'Off-season',clubDays:['Tuesday','Thursday'],gameDay:'Saturday',extraGame:false};`);
replace("preferredTrainingDays:phase==='In-season'?sixDays.slice(0,5):sixDays,", "preferredTrainingDays:presetDays(phase),seasonFinishedOn:phase==='Off-season'?plusDays(weekStart,-1):undefined,");
replace("  profile.firstName=gender==='male'?'Male example':'Female example';",
  `  profile.firstName=${JSON.stringify(preset.label)};
  ${preset.female ? `profile.heightCm=${preset.female.heightCm}; profile.weightKg=${preset.female.weightKg}; profile.squatStrength=${JSON.stringify(preset.female.squatStrength)}; profile.benchStrength=${JSON.stringify(preset.female.benchStrength)}; profile.twoKmTimeTrial={...profile.twoKmTimeTrial,seconds:${preset.female.twoKmSeconds}};` : ''}
  ${preset.strength ? `profile.squatStrength=${JSON.stringify(preset.strength.squatStrength)}; profile.benchStrength=${JSON.stringify(preset.strength.benchStrength)}; profile.twoKmTimeTrial={...profile.twoKmTimeTrial,seconds:${preset.strength.twoKmSeconds}};` : ''}`);
// Kit: a named onboarding preset, or the explicit minimal answer.
replace('const profile=athleteAnswers(archetype);',
  typeof preset.kit === 'string'
    ? `const profile=athleteAnswers(archetype);
  profile.equipmentAnswer=app('src/__tests__/support/equipmentAnswerFixture').presetEquipmentAnswer(${JSON.stringify(preset.kit)},start);`
    : `const profile=athleteAnswers(archetype);
  profile.trainingLocation=${JSON.stringify(preset.kit.location)};
  profile.equipment=${JSON.stringify(preset.kit.legacy)};
  profile.equipmentAnswer={tags:${JSON.stringify(preset.kit.tags)},modalities:${JSON.stringify(preset.kit.modalities)},answeredOn:start};
  const kitCapabilities=app('src/utils/equipmentAvailability').resolveEquipmentCapabilities(profile);
  process.stdout.write('kit capabilities: '+JSON.stringify({tags:kitCapabilities.tags,modalities:kitCapabilities.conditioningModalities})+'\\n');`);

// The grade moves up in the profile at the start of years two and three.
replace("    const rolled=quiet(()=>journey.rolloverIfDue(weekStart)); check(!rolled.refusal,'rollover',rolled);",
  `    const gradeByYear=${JSON.stringify(preset.gradeByYear ?? {})};
    if(i>0&&i%52===0&&gradeByYear[String(i/52+1)]) {
      const experienceLevel=gradeByYear[String(i/52+1)];
      const graded=await quietAsync(()=>commitProfileProgramTransaction({change:{kind:'profile_setup',patch:{experienceLevel}},todayISO:weekStart,sourceSurface:'phase_shift'}));
      result.actions.push({date:weekStart,label:'Grade updated to '+experienceLevel,result:graded});check(graded.ok,'grade update',graded);
    }
    const rolled=quiet(()=>journey.rolloverIfDue(weekStart)); check(!rolled.refusal,'rollover',rolled);`);
replace("    const w={number:i+1,start:weekStart,phase,phaseWeek:pw,days:[],events:[]};",
  `    const acceptedProfileForWeek=useProfileStore.getState().onboardingData;
    const w={number:i+1,start:weekStart,year:Math.floor(i/52)+1,phase,phaseWeek:pw,
      acceptedProgrammingInputs:{
        experienceLevel:acceptedProfileForWeek.experienceLevel,
        preferredTrainingDays:[...(acceptedProfileForWeek.preferredTrainingDays??[])],
        teamTrainingDays:[...(acceptedProfileForWeek.teamTrainingDays??[])],
        usualGameDay:acceptedProfileForWeek.usualGameDay??acceptedProfileForWeek.gameDay??null,
      },days:[],events:[]};
    if(i>0&&i%52===0&&gradeByYear[String(i/52+1)]) w.events.push({date:weekStart,label:'Grade updated to '+gradeByYear[String(i/52+1)]});`);

// Logging: the preset's misses and club-night effort; everything else as the pair audit logs.
replace("      const logged=await quietAsync(()=>journey.recordDay(date,{record:!illnessId,completion:'full',feeling:'good',soreness:'none',difficulty:7,logWeights:true,conditioningRpe:6,absenceReason:illnessId?'Sick':undefined}));",
  `      const misses=${preset.misses ? `{neverOpened:${preset.misses.neverOpened.toString()},skipped:${preset.misses.skipped.toString()}}` : 'null'};
      const clubRpeByWeek=${JSON.stringify(preset.clubRpeByWeek ?? null)};
      const isClubNight=!!day.workout&&(day.workout.isTeamDay===true||/team training/i.test(String(day.workout.name??'')));
      const neverOpened=!!misses&&misses.neverOpened(i,d);
      const markedSkipped=!!misses&&!neverOpened&&misses.skipped(i,d);
      const difficulty=clubRpeByWeek&&isClubNight?clubRpeByWeek[i%clubRpeByWeek.length]:7;
      if(neverOpened&&day.workout) w.events.push({date,label:'Session never opened'});
      if(markedSkipped&&day.workout) w.events.push({date,label:'Session marked skipped'});
      if(clubRpeByWeek&&isClubNight) w.events.push({date,label:'Club night effort '+difficulty+'/10'});
      const logged=await quietAsync(()=>journey.recordDay(date,{record:!illnessId&&!neverOpened,completion:markedSkipped?'skipped':'full',feeling:difficulty>=9?'very_hard':difficulty>=7?'hard':difficulty<=4?'easy':'good',soreness:'none',difficulty,logWeights:!markedSkipped,conditioningRpe:6,absenceReason:illnessId?'Sick':neverOpened?'Missed':markedSkipped?'Skipped':undefined}));`);

// Scripted readiness / illness / injury events, as the pair audit, repeated each year.
replace("for (const [week,offset] of [[5,2],[18,0],[33,3],[45,0]]) event(week,offset,'tired');",
  `for (const [week,offset] of [[5,2],[18,0],[33,3],[45,0],[45,1]]) event(week,offset,'tired');
event(35,0,'cooked');
event(11,3,'christmas_break');
// Multi-year runs repeat the dated readiness, illness and injury script each
// year; the Christmas break and the away week are calendar facts of year one.
for (let year=1; year*52<${weeks}; year+=1) for (const e of events.filter(e=>e.kind!=='christmas_break').slice()) events.push({...e,date:plusDays(e.date,364*year)});`);
replace("        if(e.kind==='tired'||e.kind==='sick') {\n          const r=await act(readinessActionForKind(e.kind==='tired'?'tired_today':'illness_moderate',{anchorDateISO:date,todayISO:date}),date,e.kind);\n          if(e.kind==='sick') illnessId=r.createdModifierIds?.[0];\n          label=e.kind==='tired'?'Tired today':'Sick';",
  `        if(e.kind==='tired'||e.kind==='cooked'||e.kind==='sick') {
          const readinessKind=e.kind==='tired'?'tired_today':e.kind==='cooked'?'cooked_week':'illness_moderate';
          const r=await act(readinessActionForKind(readinessKind,{anchorDateISO:date,todayISO:date}),date,e.kind);
          if(e.kind==='sick') illnessId=r.createdModifierIds?.[0];
          label=e.kind==='tired'?'Tired today':e.kind==='cooked'?'Totally cooked - rest today':'Sick';
        } else if(e.kind==='christmas_break') {
          const span=${JSON.stringify(ACCEPTED_CHRISTMAS_BREAK)};
          await act({type:'set_schedule_modifier',source:{screen:'program_tab',surface:'christmas_break',initiatedBy:'tap'},scope:'current_week',payload:{date:span.from,teamTrainingBreak:{from:span.from,to:span.to}},requiresRebuild:false,createsActiveModifier:true,oneOffOnly:false},date,'christmas_break');
          label='Christmas team-training break accepted';`);
replace("save('year-programs.json',data);", `save('year-programs.json',data);`);
replace("  for(const gender of ['male','female'].filter(x=>!genderOnly||genderOnly===x))data.athletes.push(await run(gender));",
  `  data.athletes.push(await run(${JSON.stringify(preset.gender)}));`);
replace("const result={gender,profile,weeks:[],actions:[],restarts:[],loggedDays:0};",
  `const result={gender,athleteId:${JSON.stringify(presetId)},label:${JSON.stringify(preset.label)},profile,weeks:[],actions:[],restarts:[],loggedDays:0};`);

fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'driver-receipt.json'), JSON.stringify({
  preset: presetId, label: preset.label, weeks,
  sourceDriver: original, sourceDriverSha256: originalHash,
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
  notCovered: ['Physical iPhone acceptance', 'Native onboarding taps', 'The Christmas break and away week are year-one calendar facts only'],
}, null, 2));
const driver = new Module(path.join(output, 'generate-year.cjs'), module);
driver.filename = path.join(output, 'generate-year.cjs');
driver.paths = module.paths;
driver._compile(code, driver.filename);
