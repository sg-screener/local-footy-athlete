/**
 * Exact founding journey for canonical session-work ownership.
 *
 * Fresh install -> advanced male onboarding -> real phase shift -> Christmas
 * club break + separate Going Away fact -> accumulated rollovers -> relaunch.
 * No program/store snapshot is hand-built; every saved input uses the same
 * production door as the app.
 */
(global as unknown as { __DEV__: boolean }).__DEV__ = true;
const localStorageData = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => localStorageData.get(key) ?? null,
    setItem: (key: string, value: string) => { localStorageData.set(key, value); },
    removeItem: (key: string) => { localStorageData.delete(key); },
    clear: () => { localStorageData.clear(); },
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — canonical ownership journey is on-device');
};
process.env.TZ = 'Australia/Melbourne';

import { readFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import { athleteAnswers, plusDays } from './compilerYear/catalog';
import {
  coldStartThroughOnboarding,
  followTheWeek,
  quiet,
  quietAsync,
  recordDay,
  relaunchApp,
  rolloverIfDue,
  setJourneyClock,
} from './support/athleteJourney';
import { presetEquipmentAnswer } from './support/equipmentAnswerFixture';
import { visibleSignature } from './compilerYear/invariants';
import { applyPhaseShift } from '../utils/profileMutations';
import { commitProfileProgramTransaction } from '../store/profileProgramTransaction';
import { executeProgramControlActionDurably } from '../utils/programControlActions';
import { useProfileStore, ownedEquipmentKit } from '../store/profileStore';
import { useProgramStore } from '../store/programStore';
import { deriveVisibleWeekLive } from '../utils/deriveVisibleWeek';
import { buildSessionTemplate } from '../utils/sessionTemplate';
import { getSessionComponentRows, getSessionComponents } from '../utils/sessionComponents';
import { weeklyPlanTitle } from '../utils/weeklyPlanDisplay';
import { normalizeAcceptedMaterialContext } from '../store/acceptedStateColdStart';
import {
  composeTemporarySourceFactCompatibility,
  normalizeTemporarySourceFacts,
} from '../rules/temporarySourceFact';
import {
  finalAthleteFacingAuditRows,
  programmingAuditProjectionFindings,
  type ProgrammingAuditExportDay,
} from '../rules/programmingYearAuditProjection';

armTotalsOrRed();

let passed = 0;
const failures: string[] = [];
function ok(name: string, condition: unknown, detail?: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  failures.push(name);
  console.log(`  FAIL ${name}`);
  if (detail !== undefined) console.log(`       ${JSON.stringify(detail, null, 2)}`);
}

const START = '2026-09-28';
const PRESEASON_START = '2026-11-16';
const LAST_TEAM_TRAINING = '2026-12-16';
const BREAK_FROM = '2026-12-17';
const BREAK_UNTIL = '2027-01-31';
const TEAM_RETURN = '2027-02-01';
const TARGET_WEEK = '2027-01-04';
const TARGET_DATE = '2027-01-10';
const SIX_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

function advancedMale() {
  const profile = athleteAnswers({
    id: 'canonical-advanced-male',
    gender: 'male',
    days: [...SIX_DAYS],
    experience: '5+ years',
    equipment: 'commercial',
    initialPhase: 'Off-season',
    clubDays: ['Monday', 'Wednesday'],
    gameDay: 'Saturday',
    extraGame: false,
  });
  profile.firstName = 'Canonical advanced male';
  profile.seasonFinishedOn = plusDays(START, -1);
  profile.equipmentAnswer = presetEquipmentAnswer('commercial_gym', START);
  profile.twoKmTimeTrial = { seconds: 480, recordedOn: START, source: 'onboarding' };
  return profile;
}

function visible(weekStart: string, todayISO: string) {
  return quiet(() => deriveVisibleWeekLive(weekStart, todayISO));
}

function activeFacts() {
  return normalizeTemporarySourceFacts({
    value: normalizeAcceptedMaterialContext(
      useProgramStore.getState().acceptedMaterialContext,
    ).temporarySourceFacts,
  });
}

function logicalName(row: any): string {
  return String(row?.exercise?.name ?? row?.name ?? '').trim();
}

function targetSignature(day: any): string {
  const template = buildSessionTemplate(day.workout);
  return JSON.stringify({
    title: weeklyPlanTitle(day.workout),
    rows: template.items.map((item: any) => ({
      kind: item.kind,
      role: item.role,
      name: logicalName(item.row),
      notes: item.row?.notes ?? null,
    })),
    speedIds: day.workout?.speedBlock?.exerciseIds ?? [],
    conditioningOptions: day.workout?.conditioningBlock?.options ?? [],
  });
}

async function main(): Promise<void> {
  console.log('sessionWorkOwnershipJourneyTests');
  const profile = advancedMale();
  const installed = await quietAsync(() => coldStartThroughOnboarding({
    profile,
    installDayISO: START,
  }));
  ok('the exact athlete enters through real onboarding', !installed.onboardingRefusal,
    installed.onboardingRefusal);

  let breakSaved = false;
  let awaySaved = false;
  for (let weekIndex = 0; weekIndex <= 14; weekIndex += 1) {
    const weekStart = plusDays(START, weekIndex * 7);
    setJourneyClock(weekStart);

    if (weekStart === PRESEASON_START) {
      const next = applyPhaseShift(useProfileStore.getState().onboardingData, {
        targetPhase: 'Pre-season',
        preferredTrainingDays: [...SIX_DAYS],
        teamTrainingDays: ['Monday', 'Wednesday'],
      });
      const patch = Object.fromEntries([
        'seasonPhase', 'seasonFinishedOn', 'preferredTrainingDays',
        'trainingDaysPerWeek', 'teamTrainingDays', 'teamTrainingDaysPerWeek',
        'usualGameDay', 'gameDay',
      ].map((key) => [key, (next as any)[key]]));
      const shifted = await quietAsync(() => commitProfileProgramTransaction({
        change: { kind: 'profile_setup', patch },
        todayISO: weekStart,
        sourceSurface: 'phase_shift',
      }));
      ok('the real profile door starts pre-season', shifted.ok === true, shifted);
    }

    const rolled = quiet(() => rolloverIfDue(weekStart));
    ok(`week ${weekIndex + 1} rolls without refusal`, !rolled.refusal, rolled.refusal);
    quiet(() => followTheWeek(weekStart));

    for (let offset = 0; offset < 7; offset += 1) {
      const date = plusDays(weekStart, offset);
      setJourneyClock(date);

      if (date === LAST_TEAM_TRAINING) {
        const saved = await quietAsync(() => executeProgramControlActionDurably({
          type: 'set_schedule_modifier',
          source: { screen: 'program_tab', surface: 'christmas_break', initiatedBy: 'tap' },
          scope: 'current_week',
          payload: {
            date: BREAK_FROM,
            todayISO: date,
            noTeamTrainingSpan: { from: BREAK_FROM, until: BREAK_UNTIL },
          },
          requiresRebuild: false,
          createsActiveModifier: true,
          oneOffOnly: false,
        } as any, { todayISO: date }));
        breakSaved = saved.ok === true;
        ok('the Christmas answer saves through the production door', breakSaved, saved);
        const boot = await quietAsync(() => relaunchApp({ storage: localStorageData, todayISO: date }));
        ok('the Christmas answer survives a real relaunch', boot.ok, boot);
        quiet(() => followTheWeek(date));
      }

      if (date === '2026-12-28') {
        const kit = ownedEquipmentKit();
        const allowed = new Set(['dumbbells', 'bands', 'bench']);
        const unavailable = kit.tags.filter((tag) => !allowed.has(String(tag).toLowerCase()));
        const away = await quietAsync(() => executeProgramControlActionDurably({
          type: 'set_schedule_modifier',
          source: { screen: 'program_tab', surface: 'away_this_week', initiatedBy: 'tap' },
          scope: 'current_week',
          payload: {
            date,
            todayISO: date,
            awaySpan: { from: date, until: '2027-01-01' },
            awayEquipment: {
              tags: unavailable,
              conditioningModalities: kit.conditioningModalities,
            },
          },
          requiresRebuild: false,
          createsActiveModifier: true,
          oneOffOnly: false,
        } as any, { visibleWeek: visible(weekStart, date), todayISO: date }));
        awaySaved = away.ok === true;
        ok('Going Away saves as its own production action', awaySaved, away);
      }

      // Accumulate the same kind of lived state as the annual journey. The
      // session outcome door decides whether the date has anything recordable.
      const logged = await quietAsync(() => recordDay(date, {
        record: true,
        completion: 'full',
        feeling: 'good',
        soreness: 'none',
        difficulty: 7,
        logWeights: true,
        conditioningRpe: 6,
      }));
      ok(`day ${date} follows the real outcome door`,
        !['refused', 'threw'].includes(logged.result), logged);
    }

    const end = plusDays(weekStart, 6);
    const before = visible(weekStart, end);
    const boot = await quietAsync(() => relaunchApp({ storage: localStorageData, todayISO: end }));
    ok(`week ${weekIndex + 1} survives restart`, boot.ok, boot);
    quiet(() => followTheWeek(end));
    ok(`week ${weekIndex + 1} complete visible programming survives restart`,
      visibleSignature(visible(weekStart, end)) === visibleSignature(before));
  }

  ok('both saved inputs were exercised', breakSaved && awaySaved);
  const facts = activeFacts();
  const breakFacts = facts.filter((fact: any) =>
    fact.factKind === 'schedule' && fact.scheduleKind === 'no_team_training');
  const travelFacts = facts.filter((fact: any) =>
    fact.factKind === 'schedule' && fact.scheduleKind === 'travel');
  ok('Christmas and Going Away remain separate saved facts',
    breakFacts.length === 1 && travelFacts.length === 1,
    facts.map((fact: any) => ({ kind: fact.factKind, schedule: fact.scheduleKind,
      from: fact.effectiveFrom, until: fact.effectiveUntil })));

  const clubConstraintCount = (date: string) => composeTemporarySourceFactCompatibility({
    temporarySourceFacts: normalizeAcceptedMaterialContext(
      useProgramStore.getState().acceptedMaterialContext,
    ).temporarySourceFacts as any,
    onDate: date,
  }).activeConstraints.filter((constraint: any) =>
    constraint.scheduleKind === 'no_team_training').length;
  ok('the last team-training date remains live', clubConstraintCount(LAST_TEAM_TRAINING) === 0);
  ok('team training is removed from 17 December through 31 January',
    clubConstraintCount(BREAK_FROM) === 1 && clubConstraintCount(TARGET_DATE) === 1
      && clubConstraintCount(BREAK_UNTIL) === 1);
  ok('team training resumes on 1 February', clubConstraintCount(TEAM_RETURN) === 0);

  setJourneyClock(TARGET_DATE);
  quiet(() => followTheWeek(TARGET_DATE));
  const target = visible(TARGET_WEEK, TARGET_DATE).find((day) => day.date === TARGET_DATE);
  ok('the exact Sunday 10 January session is reached', !!target?.workout, target);
  if (!target?.workout) throw new Error('founding Sunday has no workout');

  const beforeRestart = targetSignature(target);
  const restart = await quietAsync(() => relaunchApp({
    storage: localStorageData,
    todayISO: TARGET_DATE,
  }));
  quiet(() => followTheWeek(TARGET_DATE));
  const restarted = visible(TARGET_WEEK, TARGET_DATE).find((day) => day.date === TARGET_DATE);
  ok('the founding session survives save/restart exactly',
    restart.ok && !!restarted && targetSignature(restarted) === beforeRestart,
    { restart, before: beforeRestart, after: restarted && targetSignature(restarted) });
  if (!restarted?.workout) throw new Error('restarted founding Sunday has no workout');

  const template = buildSessionTemplate(restarted.workout);
  const finalItems = template.items.filter((item: any) => item.kind === 'exercise');
  const finalNames = finalItems.map((item: any) => logicalName(item.row));
  const duplicateNames = finalNames.filter((name, index) => name && finalNames.indexOf(name) !== index);
  const componentRows = getSessionComponentRows(restarted.workout);
  const speedNames = componentRows.speedRows.map(logicalName);
  const conditioningNames = componentRows.conditioningRows.map(logicalName);
  const rowOwnership = (restarted.workout.exercises ?? []).map((row: any) => ({
    id: row.id,
    name: logicalName(row),
    role: row.role,
    section: row.sessionSection,
    speed: restarted.workout?.speedBlock?.exerciseIds?.includes(row.id) ?? false,
    conditioning: restarted.workout?.conditioningBlock?.options?.some((option: any) =>
      option.exerciseIds?.includes(row.id)) ?? false,
  }));

  ok('one logical work item has one visible role',
    speedNames.every((name) => !conditioningNames.includes(name)),
    { speedNames, conditioningNames, rowOwnership,
      speedBlock: restarted.workout.speedBlock,
      conditioningBlock: restarted.workout.conditioningBlock });
  ok('the app final session has no duplicated logical rows',
    duplicateNames.length === 0, { finalNames, duplicateNames });
  ok('the founding final session contains one preparation row and one Fly row',
    finalNames.length === 2
      && finalNames.filter((name) => /warm.?up/i.test(name)).length === 1
      && finalNames.filter((name) => /^Fly 20 \(20\+20\)$/i.test(name)).length === 1,
    finalNames);

  const exportDay: ProgrammingAuditExportDay = {
    date: TARGET_DATE,
    rows: finalItems.map((item: any) => ({
      name: logicalName(item.row),
      catalogueIdentity: logicalName(item.row),
      role: item.presentation,
      modalityLabel: item.modalityLabel,
      notes: item.row?.notes,
    })),
    speedRows: componentRows.speedRows.map((row: any) => ({
      name: logicalName(row),
      catalogueIdentity: logicalName(row),
      role: 'speed',
      modalityLabel: 'Run',
      notes: row.notes,
    })),
  };
  const finalAuditRows = finalAthleteFacingAuditRows(exportDay);
  ok('day.rows is the final athlete-facing export exactly once',
    JSON.stringify(finalAuditRows) === JSON.stringify(exportDay.rows),
    { dayRows: exportDay.rows, finalAuditRows });
  ok('speedRows remains typed evidence only',
    exportDay.speedRows!.length > 0
      && finalAuditRows.length === exportDay.rows!.length
      && programmingAuditProjectionFindings(exportDay).length === 0,
    programmingAuditProjectionFindings(exportDay));

  const pdfPath = join(__dirname, '../../scripts/build-full-year-pdfs.py');
  const pdfSource = readFileSync(pdfPath, 'utf8');
  const pdfProjectionProgram = [
    'import ast, json, sys',
    'source = open(sys.argv[1], encoding="utf-8").read()',
    'tree = ast.parse(source)',
    'node = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "flatten_rows")',
    'scope = {}',
    'exec(compile(ast.Module(body=[node], type_ignores=[]), sys.argv[1], "exec"), scope)',
    'print(json.dumps(scope["flatten_rows"](json.loads(sys.stdin.read()))))',
  ].join('\n');
  const pdfRows = JSON.parse(execFileSync('python3', ['-c', pdfProjectionProgram, pdfPath], {
    input: JSON.stringify(exportDay),
    encoding: 'utf8',
  }));
  ok('the app, annual audit and PDF return the same canonical rows',
    JSON.stringify(exportDay.rows) === JSON.stringify(finalAuditRows)
      && JSON.stringify(exportDay.rows) === JSON.stringify(pdfRows),
    { app: exportDay.rows, audit: finalAuditRows, pdf: pdfRows });

  const contradictory = finalItems.filter((item: any) => {
    const text = `${logicalName(item.row)} ${item.row?.notes ?? ''}`;
    return /10\s*\/\s*10|10\/10/i.test(text) && /easy aerobic only/i.test(text);
  });
  ok('no 10/10 sprint instruction says easy aerobic only',
    contradictory.length === 0,
    contradictory.map((item: any) => ({ name: logicalName(item.row), notes: item.row?.notes })));
  // The template item union only carries `row` on its exercise member; the
  // cells below read that member's row, so the find is typed to it.
  const flyItem: any = finalItems.find((item: any) => /^Fly 20 \(20\+20\)$/i.test(logicalName(item.row)));
  ok('the deload keeps one reduced sharp Speed exposure',
    flyItem?.row?.deloadQualityExposure === true
      && flyItem?.row?.prescribedSets === 3
      && /week's one quality exposure.*sharp but short/i.test(flyItem?.row?.notes ?? ''),
    flyItem?.row && {
      sets: flyItem.row.prescribedSets,
      quality: flyItem.row.deloadQualityExposure,
      notes: flyItem.row.notes,
    });

  const components = getSessionComponents(restarted.workout).map((component) => component.kind);
  const title = weeklyPlanTitle(restarted.workout);
  ok('the visible title agrees with final Speed content',
    !components.includes('speed') || title === 'Speed Conditioning',
    { title, components, finalNames });

  ok('the PDF reads canonical rows and never appends speedRows',
    /day\.get\(['"]rows['"]\)/.test(pdfSource)
      && !/for row in day\.get\(['"]speedRows['"]\)/.test(pdfSource));
  ok('[MUTATION] a PDF speedRows re-append would be caught',
    /for row in day\.get\(['"]speedRows['"]\)/.test(
      pdfSource.replace(
        "return [dict(row) for row in day.get('rows') or []]",
        "rows = [dict(row) for row in day.get('rows') or []]\n    for row in day.get('speedRows') or []:\n        rows.append(dict(row))\n    return rows",
      ),
    ));

  console.log(`\nSession-work ownership journey: passed=${passed}/${passed + failures.length} failures=${failures.length}`);
  totalsPrinted(failures.length);
  if (failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
