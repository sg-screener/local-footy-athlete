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

export async function programmingInputTruth(storage: Map<string, string>, ok: (label: string, value: boolean, detail?: string) => void) {
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
  ok('P14: all five usable off-leg aerobic templates remain selectable',
    ['Continuous Aerobic Run', 'Steady Blocks (3×8 min or 4×6 min)', 'Long Aerobic Intervals',
      'Controlled 10–20 min Blocks', 'Steady 5 min Blocks'].every(name => picked.has(name)), JSON.stringify([...picked]));
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
    ok(`${category}: sparse opportunities reach every eligible quality`,
      category === 'sprint' ? new Set(selected.map(t => t.quality)).size === 3 : new Set(selected.map(t => t.name)).size === 5,
      JSON.stringify(selected.map(t => t.name)));
  }
  ok('conditioning display audit reaches all 55 authored templates', CONDITIONING_TEMPLATES.length === 55);
  for (const template of CONDITIONING_TEMPLATES) {
    const lines = conditioningDisplayLines({ template });
    ok(`${template.name}: shared projection has work, recovery and no duplicate prescription labels`,
      lines.some(line => line.label === 'Work') && lines.some(line => line.label === 'Recovery')
      && new Set(lines.filter(line => line.label).map(line => line.label)).size === lines.filter(line => line.label).length);
    ok(`${template.name}: shared title/copy has no ratio title, Heart rate line or alternative dose`,
      !/\b\d+\s*:\s*\d+\b/.test(conditioningDisplayTitleForName(template.name))
      && lines.every(line => line.label !== 'Heart rate')
      && lines.filter(line => ['Work', 'Recovery', 'Rounds', 'Reps', 'Blocks'].includes(line.label ?? ''))
        .every(line => !/\b(?:or|variant|alternative)\b/i.test(line.text)));
  }
  for (const gender of ['male', 'female'] as const) {
    const profile = { ...athleteAnswers({ ...ARCHETYPES[6], gender, initialPhase: 'Off-season', extraGame: false }),
      seasonFinishedOn: '2026-09-27' };
    const installed = await quietAsync(() => coldStartThroughOnboarding({ profile, installDayISO: '2026-09-28' }));
    if (installed.onboardingRefusal) throw Error(JSON.stringify(installed.onboardingRefusal));
    const acceptedHistory = JSON.stringify(blockConditioningSelectionHistory());
    ok(`${gender}: real onboarding records nonempty conditioning selections`, blockConditioningSelectionHistory().length > 0);
    quiet(() => generateProgramLocally(profile, { todayISO: '2026-10-26', blockStartISO: '2026-10-26', blockNumber: 2 } as never));
    ok(`${gender}: speculative future generation cannot write conditioning history`, JSON.stringify(blockConditioningSelectionHistory()) === acceptedHistory);
    for (const monday of ['2026-10-12', '2026-10-19']) {
      const week = quiet(() => deriveVisibleWeekLive(monday, '2026-09-28'));
      const receivers = week.filter(day => day.workout?.conditioningBlock?.options.length).map(day => day.dayOfWeek);
      ok(`${gender}/${monday}: original weeks 3/4 distribute conditioning beyond Wednesday`,
        receivers.length === 3 && receivers.some(day => [4, 5, 6, 0].includes(day)), JSON.stringify(receivers));
      const receiverOrder = receivers.map(day => (day + 6) % 7).sort((a, b) => a - b);
      ok(`${gender}/${monday}: conditioning receiver spacing includes week boundary`, receivers.length === 3
        && receiverOrder.every((day, i) => (receiverOrder[(i + 1) % receiverOrder.length] - day + 7) % 7 >= 2), JSON.stringify(receivers));
      ok(`${gender}/${monday}: no automatic no-game Gunshow or Primer`,
        week.every(day => !['gunshow', 'primer'].includes(day.workout?.composedOptionalKind ?? '')));
      const conditioning = week.flatMap(day => getSessionComponentRows(day.workout).conditioningRows)
        .map(row => row.exercise?.name ?? '');
      ok(`${gender}/${monday}: equivalent conditioning seats have distinct eligible templates`,
        conditioning.length === 3 && new Set(conditioning).size === 3, JSON.stringify(conditioning));
    }
    const beforeBoot = visibleSignature(quiet(() => deriveVisibleWeekLive('2026-10-12', '2026-09-28')));
    const boot = await quietAsync(() => relaunchApp({ storage, todayISO: '2026-09-28' }));
    ok(`${gender}: accepted conditioning history and final rows survive restart`, boot.ok
      && JSON.stringify(blockConditioningSelectionHistory()) === acceptedHistory
      && visibleSignature(quiet(() => deriveVisibleWeekLive('2026-10-12', '2026-09-28'))) === beforeBoot,
      JSON.stringify({ boot: boot.ok, historyBefore: JSON.parse(acceptedHistory), historyAfter: blockConditioningSelectionHistory(),
        rowDiff: signatureDifferences(beforeBoot, visibleSignature(quiet(() => deriveVisibleWeekLive('2026-10-12', '2026-09-28')))) }));
  }
}
