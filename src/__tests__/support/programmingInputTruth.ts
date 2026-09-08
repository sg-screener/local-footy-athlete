import { OFFSEASON_PREPARATION } from '../../rules/offseasonSubphasePolicy';
import { ARCHETYPES, athleteAnswers } from '../compilerYear/catalog';
import { visibleSignature, signatureDifferences } from '../compilerYear/invariants';
import { presetEquipmentAnswer } from './equipmentAnswerFixture';
import { coldStartThroughOnboarding, quiet, quietAsync, relaunchApp } from './athleteJourney';
import { deriveVisibleWeekLive } from '../../utils/deriveVisibleWeek';
import { resolveEquipmentCapabilities } from '../../utils/equipmentAvailability';
import { filterPoolForAthlete } from '../../utils/sessionBuilder';
import { selectConditioningTemplate } from '../../rules/conditioningSelection';
import { getSessionComponentRows } from '../../utils/sessionComponents';
import { blockConditioningSelectionHistory } from '../../store/blockSelectionHistoryStore';
import { generateProgramLocally } from '../../services/api/generateProgram';
import { CONDITIONING_TEMPLATES } from '../../data/conditioningTemplates';
import { conditioningDisplayLines, conditioningDisplayTitleForName } from '../../rules/conditioningDisplay';
import type { BlockConditioningSelection } from '../../rules/conditioningSelection';
import { buildSessionTemplate } from '../../utils/sessionTemplate';
import { specialSessionInputTruth } from './specialSessionInputTruth';
import { conditioningModalityExposure } from './conditioningModalityExposure';
import { conditioningClarity } from './conditioningClarity';
import { flushPrescriptionTruth } from './flushPrescriptionTruth';
import { flushRestartJourney } from './flushRestartJourney';
import { onboardingTapTruth } from './onboardingTapTruth';
import { lowLoadAdditionJourney } from './lowLoadAdditionJourney';
import { programmingSelectionDecisions } from './programmingSelectionDecisions';
import { gPlusTwoFlushJourney } from './gPlusTwoFlushJourney';
import { unilateralPriorityJourney } from './unilateralPriorityJourney';
import { conditioningCategoryTruth } from './conditioningCategoryTruth';
import { lowLoadRemovalJourney } from './lowLoadRemovalJourney';
import { guidedInjuryUiTruth } from './guidedInjuryUiTruth';
import { simpleInjurySafetyTruth } from './simpleInjurySafetyTruth';
import { powerOnlyLandmineJourney } from './powerOnlyLandmineTruth';
import { inseasonSpeedTruth } from './inseasonSpeedTruth';
import { gameOutcomeJourney } from './gameOutcomeJourney';
import { runningReturnPrescription } from '../../rules/runningReturnDose';

export async function programmingInputTruth(storage: Map<string, string>, ok: (label: string, value: boolean, detail?: string) => void) {
  conditioningCategoryTruth(ok);
  guidedInjuryUiTruth(ok);
  await gameOutcomeJourney(storage, ok);
  await powerOnlyLandmineJourney(storage, ok);
  await inseasonSpeedTruth(storage, ok);
  await simpleInjurySafetyTruth(storage, ok);
  await lowLoadRemovalJourney(storage, ok);
  onboardingTapTruth(ok);
  await flushPrescriptionTruth(storage, ok);
  await flushRestartJourney(storage, ok);
  await conditioningClarity(storage, ok);
  programmingSelectionDecisions(ok);
  await unilateralPriorityJourney(storage,ok);
  await lowLoadAdditionJourney(storage, ok);
  await gPlusTwoFlushJourney(storage, ok);
  await conditioningModalityExposure(ok);
  await specialSessionInputTruth(storage, ok);
  const date = '2026-07-13';
  for (const gender of ['male', 'female'] as const) for (const kit of ['full', 'partial', 'none'] as const) {
    const answer = kit === 'full' ? presetEquipmentAnswer('commercial_gym', date)
      : { tags: kit === 'partial' ? { dumbbells: 'have' as const, plyo_box: 'never' as const } : {}, modalities: {}, answeredOn: date };
    const signatures: string[] = [];
    for (const legacy of [['Bodyweight Only'], ['Box', 'Barbell', 'Dumbbells', 'Squat Rack']] as const) {
      const profile = { ...athleteAnswers({ ...ARCHETYPES[6], gender, extraGame: false }), equipmentAnswer: answer, equipment: [...legacy] };
      const installed = await quietAsync(() => coldStartThroughOnboarding({ profile, installDayISO: date }));
      if (installed.onboardingRefusal) throw Error(JSON.stringify(installed.onboardingRefusal));
      const kitResolved = resolveEquipmentCapabilities(profile);
      const curls = filterPoolForAthlete('biceps', { injuries: [], equipmentTags: [...kitResolved.tags], onboardingData: profile });
      if (kit !== 'none') ok(`${gender}/${kit}: advanced automatic curl pool prefers loaded alternatives`,
        curls.length > 0 && !curls.some(row => row.name === 'Banded Bicep Curl'), JSON.stringify(curls.map(r => r.name)));
      ok(`${gender}/${kit}: current answer resolves without borrowing legacy box`, kitResolved.tags.includes('plyo_box') === (kit === 'full'));
      const view = () => quiet(() => deriveVisibleWeekLive(date, date));
      const before = visibleSignature(view());
      signatures.push(before);
      const boot = await quietAsync(() => relaunchApp({ storage, todayISO: date }));
      ok(`${gender}/${kit}: equipment-selected rows survive restart`, boot.ok && visibleSignature(view()) === before);
    }
    ok(`${gender}/${kit}: conflicting legacy equipment cannot change any final row`, signatures[0] === signatures[1], JSON.stringify(signatureDifferences(signatures[0], signatures[1])));
  }
  const baseProfile = athleteAnswers(ARCHETYPES[6]);
  const bandOnly = filterPoolForAthlete('biceps', { injuries: [], equipmentTags: ['bands'], onboardingData: baseProfile });
  ok('advanced band-only athlete retains the legal curl fallback', bandOnly.some(row => row.name === 'Banded Bicep Curl'));
  const novice = filterPoolForAthlete('biceps', { injuries: [], equipmentTags: ['bands', 'dumbbells'],
    onboardingData: { ...baseProfile, experienceLevel: 'Complete beginner' } });
  ok('novice automatic curls retain the band option', novice.some(row => row.name === 'Banded Bicep Curl'));
  const picked = new Set(Array.from({ length: 20 }, (_, i) => selectConditioningTemplate({
    category: 'aerobic_base', dateStr: date, miniCycleNumber: i + 1, offFeet: true,
    availableMachines: ['bike', 'air_bike', 'row', 'ski'], role: 'standalone',
  }).name));
  ok('P14: all four honestly named off-leg aerobic templates remain selectable',
    ['Steady Blocks (3×8 min or 4×6 min)', 'Long Aerobic Intervals',
      'Controlled 10–20 min Blocks', 'Steady 5 min Blocks'].every(name => picked.has(name)), JSON.stringify([...picked]));
  ok('P14: off-feet selection never returns a template whose identity says Run',
    [...picked].every(name => !/\brun\b/i.test(name)), JSON.stringify([...picked]));
  for (const category of ['sprint', 'aerobic_base'] as const) {
    const history: BlockConditioningSelection[] = [];
    const selected = [];
    for (let i = 0; i < 12; i++) {
      const blockStartISO = `2026-${String(i + 1).padStart(2, '0')}-01`;
      const args = { category, dateStr: blockStartISO, miniCycleNumber: 1 + i * 11,
        availableMachines: ['bike', 'air_bike', 'row', 'ski'] as const,
        noTeamTrainingWeek: true, selectionContext: { blockStartISO, history } };
      const template = selectConditioningTemplate(args);
      ok(`${category}/opportunity-${i}: repeat reads do not consume selection history`,
        selectConditioningTemplate(args).name === template.name && history.length === i);
      history.push({ blockStartISO, category, seatIndex: 0, templateName: template.name });
      ok(`${category}/opportunity-${i}: accepted identity restores independent of global block number`,
        selectConditioningTemplate({ ...args, miniCycleNumber: 999 }).name === template.name);
      selected.push(template);
    }
    // R-340 (2026-09-02): repeat-sprint is a hard CONDITIONING demand and the
    // Speed pool no longer offers it, so the eligible Speed qualities are two.
    ok(`${category}: sparse opportunities reach every eligible quality`,
      category === 'sprint'
        ? ['acceleration', 'top_end_speed'].every(quality => selected.some(t => t.quality === quality))
          && selected.every(t => t.quality !== 'repeat_sprint')
        : new Set(selected.map(t => t.name)).size === 5,
      JSON.stringify(selected.map(t => `${t.name}/${t.quality}`)));
  }
  ok('conditioning display audit reaches all 52 authored templates', CONDITIONING_TEMPLATES.length === 52);
  for (const template of CONDITIONING_TEMPLATES) {
    const lines = conditioningDisplayLines({ template });
    ok(`${template.name}: shared projection has work, recovery and no duplicate prescription labels`,
      lines.some(line => line.label === 'Work') && lines.some(line => line.label === 'Recovery')
      && new Set(lines.filter(line => line.label).map(line => line.label)).size === lines.filter(line => line.label).length);
    ok(`${template.name}: shared title/copy has no ratio title, Heart rate line or alternative dose`,
      !/\b\d+\s*:\s*\d+\b/.test(conditioningDisplayTitleForName(template.name))
      && lines.every(line => line.label !== 'Heart rate')
      && lines.filter(line => ['Work', 'Recovery', 'Rounds', 'Reps', 'Blocks'].includes(line.label ?? ''))
        .every(line => !/\b(?:variant|alternative)\b/i.test(line.text)
          && !/\b\d[^.;]*\bor\b[^.;]*\d/i.test(line.text)));
  }
  await conditioningPhaseHistoryTruth(storage, ok);
}

/** Self-contained phase-history witness; also callable when only this contract changes. */
export async function conditioningPhaseHistoryTruth(storage: Map<string, string>, ok: (label: string, value: boolean, detail?: string) => void) {
  for (const gender of ['male', 'female'] as const) for (const preparation of [true, false]) {
    const installDay = preparation ? '2026-09-28' : '2026-10-26';
    const mondays = preparation ? ['2026-10-12', '2026-10-19'] : ['2026-10-26', '2026-11-02'];
    const expectedConditioning = preparation ? OFFSEASON_PREPARATION.exposureConditioning.preferred.max : 3;
    const profile = { ...athleteAnswers({ ...ARCHETYPES[6], gender, initialPhase: 'Off-season', extraGame: false }),
      seasonFinishedOn: '2026-09-27' };
    const installed = await quietAsync(() => coldStartThroughOnboarding({ profile, installDayISO: installDay }));
    if (installed.onboardingRefusal) throw Error(JSON.stringify(installed.onboardingRefusal));
    const acceptedHistory = JSON.stringify(blockConditioningSelectionHistory());
    ok(`${gender}/${preparation}: accepted conditioning history follows the phase`,
      blockConditioningSelectionHistory().length > 0 && (!preparation
        || blockConditioningSelectionHistory().every(row => mondays.includes(row.weekStartISO ?? '')
          && ['aerobic_base', 'recovery_flush'].includes(row.category))));
    quiet(() => generateProgramLocally(profile, { todayISO: '2026-11-23', blockStartISO: '2026-11-23', blockNumber: 3 } as never));
    ok(`${gender}: speculative future generation cannot write conditioning history`, JSON.stringify(blockConditioningSelectionHistory()) === acceptedHistory);
    for (const monday of mondays) {
      const week = quiet(() => deriveVisibleWeekLive(monday, installDay));
      const receivers = week.filter(day => day.workout?.conditioningBlock?.options.length).map(day => day.dayOfWeek);
      ok(`${gender}/${monday}: preparation offers light add-ons; build distributes conditioning beyond Wednesday`,
        receivers.length === expectedConditioning && (preparation || receivers.some(day => [4, 5, 6, 0].includes(day))), JSON.stringify(receivers));
      if (preparation) ok(`${gender}/${monday}: preparation offers stay optional on selected gym days`,
        week.filter(day => day.workout?.conditioningBlock?.options.length).every(day =>
          profile.preferredTrainingDays?.includes(['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][day.dayOfWeek] as never)
          && day.workout?.attachedConditioningKind === 'finisher'
          && day.workout.conditioningCategory === 'aerobic_base'
          && buildSessionTemplate(day.workout).items.filter(item => item.role === 'conditioning')
            .every(item => 'optional' in item && item.optional === true)));
      const receiverOrder = receivers.map(day => (day + 6) % 7).sort((a, b) => a - b);
      // R-337: later build weeks prefer existing training days before even
      // spacing. Their Speed/hard-work schedule is not the retired mid-phase
      // three-tempo schedule. Keep the cross-week two-consecutive-day ceiling.
      ok(`${gender}/${monday}: conditioning spacing respects the build-week boundary`, receivers.length === expectedConditioning
        && receiverOrder.every(day => !(receiverOrder.includes((day + 1) % 7)
          && receiverOrder.includes((day + 2) % 7))) && !receivers.includes(0), JSON.stringify(receivers));
      ok(`${gender}/${monday}: no automatic no-game Gunshow or Primer`,
        week.every(day => !['gunshow', 'primer'].includes(day.workout?.composedOptionalKind ?? '')));
      const conditioning = week.flatMap(day => getSessionComponentRows(day.workout).conditioningRows)
        .map(row => row.exercise?.name ?? '');
      // A COD prescription contains several drills. Count selected templates
      // separately from rendered rows; neither count stands in for the other.
      const selectedOptions = week.flatMap(day => (day.workout?.conditioningBlock?.options ?? [])
        .map(option => ({ option, workout: day.workout! })));
      const selectedTemplates = selectedOptions.map(({ option }) => option.title);
      // R-393 replaces field prescriptions with the same introductory drill.
      // Rotation is still held at its selection owner; ordinary final options
      // must also stay distinct. Only verified return rows can share identity.
      const returning = selectedOptions.filter(({ option, workout }) =>
        option.modality === 'running' && !!workout.runningReturnStage);
      const ordinary = selectedOptions.filter(entry => !returning.includes(entry)).map(({ option }) => option.title);
      const authoredSelections = blockConditioningSelectionHistory()
        .filter(selection => selection.weekStartISO === monday && selection.category !== 'sprint')
        .map(selection => selection.templateName);
      ok(`${gender}/${monday}: equivalent conditioning seats have distinct eligible templates`,
        selectedTemplates.length === expectedConditioning && authoredSelections.length === expectedConditioning
          && new Set(authoredSelections).size === expectedConditioning && new Set(ordinary).size === ordinary.length,
        JSON.stringify({ authoredSelections, ordinary, selectedTemplates }));
      const expectedReturnStage = preparation ? null : monday === mondays[0] ? 1 : 2;
      const expectedReturnReps = expectedReturnStage === 1 ? 4 : 6;
      ok(`${gender}/${monday}: shared return identities carry the ruled stage and reduced prescription`,
        expectedReturnStage === null ? returning.length === 0 : returning.length > 0 && returning.every(({ option, workout }) => {
          const rows = workout.exercises.filter(row => option.exerciseIds.includes(row.id));
          return workout.runningReturnStage === expectedReturnStage && option.title === '20 m Acceleration Reps'
            && rows.length === 1 && rows[0].exercise.name === '20 m Acceleration Reps'
            && rows[0].prescribedSets === expectedReturnReps
            && rows[0].notes === runningReturnPrescription(expectedReturnStage, expectedReturnReps);
        }), JSON.stringify(returning.map(({ option, workout }) => ({ title: option.title, stage: workout.runningReturnStage }))));
      const modeRows = week.flatMap(day => buildSessionTemplate(day.workout ?? {}).items
        .filter(item => item.kind === 'exercise' && item.presentation === 'conditioning_phase'));
      ok(`${gender}/${monday}: single prescriptions retain their typed running or off-leg mode`,
        modeRows.length === conditioning.length && modeRows.length >= expectedConditioning
          && modeRows.every(item => !!(item as { modalityLabel?: string }).modalityLabel),
        JSON.stringify(modeRows.map(item => ({ name: item.kind === 'exercise' ? item.row.exercise?.name : '',
          mode: (item as { modalityLabel?: string }).modalityLabel }))));
    }
    const beforeBoot = visibleSignature(quiet(() => deriveVisibleWeekLive(mondays[0], installDay)));
    const boot = await quietAsync(() => relaunchApp({ storage, todayISO: installDay }));
    ok(`${gender}: accepted conditioning history and final rows survive restart`, boot.ok
      && JSON.stringify(blockConditioningSelectionHistory()) === acceptedHistory
      && visibleSignature(quiet(() => deriveVisibleWeekLive(mondays[0], installDay))) === beforeBoot,
      JSON.stringify({ boot: boot.ok, historyBefore: JSON.parse(acceptedHistory), historyAfter: blockConditioningSelectionHistory(),
        rowDiff: signatureDifferences(beforeBoot, visibleSignature(quiet(() => deriveVisibleWeekLive(mondays[0], installDay)))) }));
  }
}
