import { CONDITIONING_TEMPLATES } from '../../data/conditioningTemplates';
import { composeConditioningRows, renderableModalities } from '../../rules/conditioningSelection';
import { CONDITIONING_COACHING_COPY, conditioningDisplayLines, conditioningAthletePrescription, conditioningWordingForModality } from '../../rules/conditioningDisplay';
import { conditioningModeLabel, conditioningModeLabelForRow } from '../../utils/conditioningVisibleIdentity';
import { applyConditioningModalityToWorkout } from '../../utils/coachModalitySwap';
import { buildSessionTemplate } from '../../utils/sessionTemplate';
import { coldStartThroughOnboarding, quiet, quietAsync, relaunchApp } from './athleteJourney';
import { athleteAnswers, ARCHETYPES } from '../compilerYear/catalog';
import { deriveVisibleWeekLive } from '../../utils/deriveVisibleWeek';
import { visibleSignature } from '../compilerYear/invariants';
import { presetEquipmentAnswer } from './equipmentAnswerFixture';
import { buildConditioningBlock, resolvedBlockModality } from '../../data/defaultProgram';
import { project } from '../../rules/projectVisibleWeek';

type Check = (label: string, value: boolean, detail?: string) => void;
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
export async function conditioningClarity(storage: Map<string, string>, ok: Check) {
  const templates = CONDITIONING_TEMPLATES;
  ok('clarity: all 55 authored templates have individually reviewed coaching copy',
    templates.length === 55 && Object.keys(CONDITIONING_COACHING_COPY).length === 55
    && templates.every(t => !!CONDITIONING_COACHING_COPY[t.name]));
  for (const t of templates) for (const authoredMinimumDose of [false, true]) {
    const row = composeConditioningRows(t, '2026-09-28', { authoredMinimumDose }).at(-1)!;
    const lines = conditioningDisplayLines({ template: t, resolvedSetsRounds: row.prescribedSets });
    const prescription = conditioningAthletePrescription(t, row.prescribedSets);
    const intensity = lines.find(l => l.label === 'Intensity')!.text;
    const cue = lines.find(l => l.label === null)!.text;
    const iw = words(intensity), cw = words(cue);
    const repeated = iw.some((_, i) => i + 5 <= iw.length && cw.join(' ').includes(iw.slice(i, i + 5).join(' ')));
    ok(`clarity/${t.name}/${authoredMinimumDose}: cue adds information rather than repeating intensity`, !repeated, row.notes);
    ok(`clarity/${t.name}/${authoredMinimumDose}: emitted Work and Recovery match the existing dose owner`,
      row.notes!.includes(`Work: ${prescription.work}\nRecovery: ${prescription.recovery}`)
      && row.notes === lines.map(l => l.label ? `${l.label}: ${l.text}` : l.text).join('\n'));
  }
  ok('clarity: stale submaximal acceleration cue does not contradict the signed maximal target',
    !composeConditioningRows(templates.find(t => t.name === '10 m Acceleration Reps')!, '2026-09-28').at(-1)!.notes!.includes('not a max sprint'));
  const air = composeConditioningRows(templates.find(t => t.name === 'Air Bike Accelerations')!, '2026-09-28').at(-1)!.notes!;
  ok('clarity: wattage-drop threshold and recovery-or-stop instruction survive shortening',
    /5%/.test(air) && /extend recovery or stop/.test(air));
  ok('clarity: an unspecified mixed mode is not presented as a complete prescription',
    !/Mixed modalities/.test(conditioningModeLabel('mixed') ?? ''));
  let mixed = 0;
  for (const t of templates) for (const machines of [['bike','air_bike','row','ski'],['bike'],['air_bike'],['row'],['ski'],['row','ski'],['bike','row']] as const)
  for (const authoredMinimumDose of [false, true]) {
    const allowed = renderableModalities(t).filter(mode => mode !== 'run' && machines.includes(mode as never));
    if (!allowed.length) continue;
    const mode = resolvedBlockModality(t.name, 'mixed', machines);
    const rows = composeConditioningRows(t,dateForUnit, { authoredMinimumDose });
    const block = buildConditioningBlock('aerobic',rows,undefined,mode,machines)!;
    const option = block.options[0];
    if (mode === 'mixed') mixed++;
    ok(`clarity/${t.name}/${machines}: actual mode owner names only available machines`,
      !!option.modalitySequence?.length && option.modalitySequence.every(machine => allowed.includes(machine))
      && !!conditioningModeLabel(option.modality,option.modalitySequence));
    ok(`clarity/${t.name}/${machines}: only multi-round flushes mix machines`,
      mode !== 'mixed' || (t.quality === 'flush' && option.modalitySequence!.length > 1 && rows.at(-1)!.prescribedSets > 1));
    if (mode !== 'mixed') ok(`clarity/${t.name}/${machines}: a non-mixed prescription chooses exactly one mode`,option.modalitySequence?.length===1);
    const displayInput = { id: 'clarity', workoutType: 'Conditioning', exercises: rows,
      conditioningBlock: block };
    const display = buildSessionTemplate(displayInput as never);
    const emitted = display.items.flatMap(item => item.kind === 'exercise' ? [item.row]
      : item.kind === 'conditioning_choice' ? item.options.flatMap(o => o.rows) : []);
    const actual = emitted.find(row => row.id === rows.at(-1)!.id);
    const projectedRows = project({ weekStart: dateForUnit, week: [{ date: dateForUnit,
      dayOfWeek: 1, source: 'generated', workout: displayInput }] as never }).days
      .flatMap(day => day.parts.flatMap(part => part.rows));
    const projectedDose = projectedRows.find(row => row.id === actual?.id)?.dose;
    const recovery = actual?.notes?.split('\n').find(line => line.startsWith('Recovery:'));
    ok(`clarity/${t.name}/${machines}: Day and Session agree on selected-mode recovery`,
      !!recovery && !!projectedDose?.some(line => line.replace(/^Rest:/, 'Recovery:') === recovery));
    ok(`clarity/${t.name}/${machines}: resolved machine instructions contain no walking recovery`,
      !!actual && !/\bwalk(?:ing)?\b|spin\/paddle/i.test(actual.notes ?? ''), actual?.notes);
    ok(`clarity/${t.name}/${machines}: wording preserves all dose numbers and complete-rest instructions`,
      !!actual && JSON.stringify((actual.notes ?? '').match(/\d+(?:\.\d+)?/g)) === JSON.stringify(rows.at(-1)!.notes!.match(/\d+(?:\.\d+)?/g))
      && ((actual.notes ?? '').includes('complete rest') === rows.at(-1)!.notes!.includes('complete rest'))
      && actual.prescribedSets === rows.at(-1)!.prescribedSets && actual.restSeconds === rows.at(-1)!.restSeconds);
  }
  ok('clarity: the equipment matrix actually reaches mixed flush prescriptions',mixed>0);
  const tempo = templates.find(t => t.name === 'Extensive Tempo (100 m repeats)')!;
  ok('clarity: running retains walking recovery and machine wording retains active recovery',
    /walk/i.test(conditioningAthletePrescription(tempo, undefined, 'running').recovery)
    && /active recovery/i.test(conditioningAthletePrescription(tempo, undefined, 'bike').recovery));
  ok('clarity: complete rest and its numbers are never changed by a modality',
    ['running', 'bike', 'air_bike', 'row', 'ski', 'mixed'].every(mode =>
      conditioningWordingForModality('60 s complete rest', mode as never) === '60 s complete rest'));
  ok('clarity: walking back becomes active machine recovery without a dangling movement suffix',
    conditioningWordingForModality('45–60 s walk-back (full recovery)', 'bike')
      === '45–60 s easy active recovery (full recovery)');

  for (const gender of ['male', 'female'] as const) {
    const date = '2026-10-26';
    const profile = { ...athleteAnswers({ ...ARCHETYPES[6], gender, initialPhase: 'Off-season', extraGame: false }),
      seasonFinishedOn: '2026-09-27', equipmentAnswer: presetEquipmentAnswer('commercial_gym', date) };
    const installed = await quietAsync(() => coldStartThroughOnboarding({ profile, installDayISO: date }));
    if (installed.onboardingRefusal) throw Error(JSON.stringify(installed.onboardingRefusal));
    const view = () => quiet(() => deriveVisibleWeekLive(date, date));
    const workouts = view().flatMap(d => d.workout ? [d.workout] : []);
    const options = workouts.flatMap(w => w.conditioningBlock?.options ?? []);
    ok(`clarity/${gender}: real generated non-flush prescriptions select one actual machine`, options.length > 0 && options.every(o => {
      const t = templates.find(t => t.name === o.title);
      return t?.quality === 'flush' || o.modality !== 'mixed';
    }), JSON.stringify(options));
    ok(`clarity/${gender}: every delivered machine sequence names owned renderable equipment`, options.length > 0 && options.every(o => {
      const sequence = (o as typeof o & { modalitySequence?: string[] }).modalitySequence;
      const t = templates.find(t => t.name === o.title);
      return !!t && !!sequence?.length && sequence.every(m => renderableModalities(t).includes(m as never));
    }), JSON.stringify(options));
    for (const workout of workouts.filter(w => w.conditioningBlock?.options.length)) {
      const changed = applyConditioningModalityToWorkout(workout, { fromModality: null, toModality: 'bike' });
      const labels = changed.exercises.filter(row => changed.conditioningBlock?.options.some(o => o.exerciseIds.includes(row.id)))
        .map(row => conditioningModeLabelForRow(changed, row.id));
      ok(`clarity/${gender}/${workout.dayOfWeek}: a modality change replaces every old machine instruction`,
        labels.length > 0 && labels.every(l => l === 'Bike · off-leg'), JSON.stringify(labels));
      ok(`clarity/${gender}/${workout.dayOfWeek}: final session reads the selected machine`,
        buildSessionTemplate(changed).items.some(item => item.kind === 'exercise' && item.presentation === 'conditioning_phase'
          && item.modalityLabel === 'Bike · off-leg'));
      const projected = project({ week: view().map(day => day.workout?.id === workout.id ? { ...day, workout: changed } : day),
        weekStart: date });
      const shown = buildSessionTemplate(changed).items.flatMap(item => item.kind === 'exercise' ? [item.row] : []);
      const doses = projected.days.flatMap(day => day.parts.flatMap(part => part.rows));
      const ids = changed.conditioningBlock!.options.flatMap(option => option.exerciseIds);
      ok(`clarity/${gender}/${workout.dayOfWeek}: Day and Session agree on selected-mode recovery`,
        ids.length > 0 && ids.every(id => {
          const row = shown.find(row => row.id === id);
          const recovery = row?.notes?.split('\n').find(line => line.startsWith('Recovery:'));
          return !recovery || doses.find(row => row.id === id)?.dose.some(line =>
            line.replace(/^Rest:/, 'Recovery:') === recovery);
        }), JSON.stringify(doses.map(row => row.dose)));
      const running = applyConditioningModalityToWorkout(changed, { fromModality: null, toModality: 'run' });
      const back = applyConditioningModalityToWorkout(running, { fromModality: null, toModality: 'bike' });
      ok(`clarity/${gender}/${workout.dayOfWeek}: changing mode away and back leaves no stale display instructions`,
        JSON.stringify(buildSessionTemplate(back)) === JSON.stringify(buildSessionTemplate(changed)));
    }
    const before = visibleSignature(view());
    const labels = JSON.stringify(workouts.flatMap(w => buildSessionTemplate(w).items.filter(i => i.kind === 'exercise')
      .map(i => i.kind === 'exercise' ? [i.modalityLabel, i.row.notes] : null)));
    const boot = await quietAsync(() => relaunchApp({ storage, todayISO: date }));
    ok(`clarity/${gender}: actual delivered copy and machine labels survive restart`, boot.ok && before === visibleSignature(view())
      && labels === JSON.stringify(view().flatMap(d => d.workout ? buildSessionTemplate(d.workout).items.filter(i => i.kind === 'exercise')
        .map(i => i.kind === 'exercise' ? [i.modalityLabel, i.row.notes] : null) : [])));
  }
}
const dateForUnit = '2026-09-28';
