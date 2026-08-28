import { scheduleWeek, scheduleRefused, type WeeklySchedulerInputs } from '../../rules/weeklyScheduler';
import { materialiseAuthoredSessions } from '../../rules/materialiseAuthoredSessions';
import { ARCHETYPES, athleteAnswers } from '../compilerYear/catalog';
import { coldStartThroughOnboarding, quiet, quietAsync, relaunchApp } from './athleteJourney';
import { deriveVisibleWeekLive } from '../../utils/deriveVisibleWeek';
import { visibleSignature, signatureDifferences } from '../compilerYear/invariants';
import { resolveTemplateByName } from '../../rules/conditioningSelection';

export async function inseasonSpeedTruth(storage: Map<string, string>, ok: (label: string, value: boolean, detail?: string) => void) {
  inseasonSpeedSelectionTruth(ok);
  const today = '2026-08-24';
  for (const gender of ['male', 'female'] as const) {
    const profile = { ...athleteAnswers({ ...ARCHETYPES[0], gender, equipment: 'commercial', days: [...ARCHETYPES[6].days] }),
      sprintExposure: 'No sprint training' as const, recentTrainingLoad: 'Hardly at all' as const, conditioningLevel: 'Poor' as const };
    let installed: Awaited<ReturnType<typeof coldStartThroughOnboarding>>;
    try { installed = await quietAsync(() => coldStartThroughOnboarding({ profile, installDayISO: today })); }
    catch (error) {
      ok(`P15/${gender}: club-top-up fatigue rule does not refuse existing novice no-club programming`, false, String(error));
      continue;
    }
    ok(`P15/${gender}: club-top-up fatigue rule does not refuse existing novice no-club programming`,
      !installed.onboardingRefusal, JSON.stringify(installed.onboardingRefusal));
    if (installed.onboardingRefusal) continue;
    const view = () => quiet(() => deriveVisibleWeekLive(today, today));
    const before = visibleSignature(view());
    const boot = await quietAsync(() => relaunchApp({ storage, todayISO: today }));
    ok(`P15/${gender}: novice no-club programming survives restart unchanged`, boot.ok && before === visibleSignature(view()));
  }
  for (const gender of ['male', 'female'] as const) for (const answer of ['Acceleration only', 'Top-speed only'] as const) {
    const profile = { ...athleteAnswers({ ...ARCHETYPES[7], gender, days: ['Monday', 'Wednesday'],
      clubDays: ['Thursday'], gameDay: 'Saturday' }), sprintExposure: answer };
    const installed = await quietAsync(() => coldStartThroughOnboarding({ profile, installDayISO: today }));
    if (installed.onboardingRefusal) throw Error(JSON.stringify(installed.onboardingRefusal));
    const view = () => quiet(() => deriveVisibleWeekLive(today, today));
    const templates = view().flatMap(day => day.workout?.exercises ?? [])
      .map(row => resolveTemplateByName(row.exercise.name)).filter(template => template &&
        ['acceleration', 'top_end_speed', 'repeat_sprint'].includes(template.quality));
    const quality = answer === 'Acceleration only' ? 'top_end_speed' : 'acceleration';
    ok(`P15/${gender}/${answer}: actual onboarding/compiler delivers the missing quality only`,
      templates.length > 0 && templates.every(template => template!.quality === quality),
      JSON.stringify(templates.map(template => template?.name)));
    const before = visibleSignature(view());
    const boot = await quietAsync(() => relaunchApp({ storage, todayISO: today }));
    ok(`P15/${gender}/${answer}: exact delivered rows and doses survive restart`,
      boot.ok && before === visibleSignature(view()), JSON.stringify(signatureDifferences(before, visibleSignature(view()))));
  }
}

export function inseasonSpeedSelectionTruth(ok: (label: string, value: boolean, detail?: string) => void) {
  const base: WeeklySchedulerInputs = {
    weekStartISO: '2026-08-24', phase: 'In-season', offseasonBlock: null,
    gymAccessDays: [1, 3], clubNights: [4], gameDay: 6, fixtureRecurrence: 'recurring',
    age: 25, unavailableDays: [], readiness: { lowReadiness: false, highReadiness: false,
      lowFatigue: true, consistentlyCompletesThree: true },
  };
  for (const [answer, qualities] of [
    ['No sprint training', ['acceleration', 'top_end_speed']],
    ['Acceleration only', ['top_end_speed']],
    ['Top-speed only', ['acceleration']],
  ] as const) {
    const seen = new Set<string>();
    for (let block = 1; block <= 8; block++) {
      const result = scheduleWeek({ ...base, sprintExposure: answer, miniCycleNumber: block } as WeeklySchedulerInputs);
      if (scheduleRefused(result)) throw Error(JSON.stringify(result));
      const speed = result.days.filter(day => day.conditioning === 'sprint_high_speed' || day.sprintComponent);
      ok(`P15/${answer}/${block}: a club night does not blanket-deny an unmet speed need`, speed.length === 1);
      ok(`P15/${answer}/${block}: speed stays outside club/game/G+1/G-2/G-1`,
        speed.every(day => [1, 2, 3].includes(day.dayOfWeek)));
      const materialised = materialiseAuthoredSessions({ schedule: result, gameDay: 6,
        facts: { weekStartISO: base.weekStartISO, phase: 'In-season', capacity: 'high',
          isBeginner: false, experienced: true, powerGoalNudge: false, injuries: [], miniCycleNumber: block } });
      for (const day of materialised) for (const template of [day.sprintTemplate, day.conditioningTemplate]) {
        if (template && ['acceleration', 'top_end_speed', 'repeat_sprint'].includes(template.quality)) {
          seen.add(template.quality);
          ok(`P15/${answer}/${block}: the delivered template serves only an unmet quality`,
            (qualities as readonly string[]).includes(template.quality), template.name);
        }
      }
    }
    ok(`P15/${answer}: selection reaches every missing quality without repeat-sprint substitution`,
      seen.size === qualities.length && qualities.every(q => seen.has(q)), JSON.stringify([...seen]));
    for (const [name, change] of [
      ['injury', { appSprintPermitted: false }],
      ['fatigue', { readiness: { ...base.readiness, lowReadiness: true } }],
      ['unavailable', { unavailableDays: [1, 2, 3] }],
      ['three existing sprint nights', { clubNights: [2, 4] }],
    ] as const) {
      const result = scheduleWeek({ ...base, sprintExposure: answer, ...change } as WeeklySchedulerInputs);
      ok(`P15/${answer}/${name}: an unmet need never overrides existing safety`, scheduleRefused(result)
        || result.days.every(day => day.conditioning !== 'sprint_high_speed' && !day.sprintComponent));
    }
  }
  for (const answer of [undefined, 'Occasionally', '2+ times per week']) {
    const result = scheduleWeek({ ...base, sprintExposure: answer } as WeeklySchedulerInputs);
    ok(`P15/${answer ?? 'legacy unknown'}: no forced extra without a reported shortfall`,
      !scheduleRefused(result) && result.days.every(day => day.conditioning !== 'sprint_high_speed' && !day.sprintComponent));
  }
}
