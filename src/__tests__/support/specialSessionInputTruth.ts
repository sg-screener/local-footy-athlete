import { athleteAnswers, ARCHETYPES } from '../compilerYear/catalog';
import { coldStartThroughOnboarding, quiet, quietAsync, relaunchApp } from './athleteJourney';
import { visibleSignature } from '../compilerYear/invariants';
import { presetEquipmentAnswer } from './equipmentAnswerFixture';
import { deriveVisibleWeekLive } from '../../utils/deriveVisibleWeek';
import { applyPlanChange } from '../../utils/planChangeProducer';
import { resolveEquipmentCapabilities } from '../../utils/equipmentAvailability';
import { exerciseIsAvailableWith } from '../../data/exerciseEquipmentRequirement';
import { createTemporaryEquipmentFact, temporaryFactScope } from '../../rules/temporarySourceFact';
import { transactTemporarySourceFact } from '../../store/temporarySourceFactTransaction';
import { executeProgramControlActionDurably } from '../../utils/programControlActions';
import { buildGuidedInjuryConstraint } from '../../utils/guidedInjuryControl';
import { getExerciseTags } from '../../data/exerciseTags';

/** Real Add doors, not isolated builder fixtures: current kit must reach authored special rows too. */
export async function specialSessionInputTruth(storage: Map<string, string>, ok: (label: string, value: boolean, detail?: string) => void) {
  const date = '2026-09-28';
  for (const gender of ['male', 'female'] as const) for (const kit of ['full', 'partial', 'none'] as const)
    for (const category of ['primer', 'gunshow', 'prehab'] as const) {
      const profile = { ...athleteAnswers({ ...ARCHETYPES[6], gender, initialPhase: 'Off-season', extraGame: false }),
        seasonFinishedOn: '2026-09-27' };
      if (kit === 'full') profile.equipmentAnswer = presetEquipmentAnswer('commercial_gym', date);
      if (kit === 'none') profile.equipmentAnswer = { tags: {}, modalities: {}, answeredOn: date };
      const installed = await quietAsync(() => coldStartThroughOnboarding({ profile, installDayISO: date }));
      if (installed.onboardingRefusal) throw Error(JSON.stringify(installed.onboardingRefusal));
      const view = () => quiet(() => deriveVisibleWeekLive(date, date));
      const target = view().find(day => day.workout?.composedOptionalKind === 'mobility');
      if (!target) throw Error('Special-session witness did not reach a real Mobility-only day');
      const label = `${gender}/${kit}/${category}`;
      const add = quiet(() => applyPlanChange({ change: { kind: 'add_category', date: target.date, category },
        visibleWeek: view(), todayISO: date, applyOverride: () => undefined }));
      const rows = () => view().find(day => day.date === target.date)?.workout?.exercises ?? [];
      const names = () => rows().map(row => row.exercise.name);
      const kitTags = resolveEquipmentCapabilities(profile).tags;
      const illegal = names().filter(name => !exerciseIsAvailableWith(name, kitTags));
      ok(`${label}: authored special rows respect the current equipment answer`, add.ok && illegal.length === 0,
        JSON.stringify({ add, kitTags, illegal, names: names() }));
      if (kit === 'full' && category === 'primer') ok(`${label}: full-kit route delivers authored heavy options`,
        names().some(name => ['Trap Bar Deadlift', 'High Box Squat'].includes(name)) && names().includes('Bench Press'));
      const accepted = visibleSignature(view());
      const boot = await quietAsync(() => relaunchApp({ storage, todayISO: date }));
      ok(`${label}: special-session equipment choices survive restart`, boot.ok && visibleSignature(view()) === accepted);
      if (kit !== 'full') continue;
      const source = { screen: 'my_status', surface: 'status_card', initiatedBy: 'tap' } as const;
      const injury = await quietAsync(() => executeProgramControlActionDurably({ type: 'set_injury_modifier', source,
        scope: 'current_and_future', payload: { constraint: buildGuidedInjuryConstraint({ region: 'upper_body', area: 'Shoulder',
          severity: 4, severityBand: 'slight', adjustmentLevel: 'slight', seriousSymptoms: false, triggers: ['pressing'] },
        { todayISO: date }) }, requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false }, { todayISO: date }));
      const painful = names().filter(name => ['horizontal_push', 'vertical_push'].includes(getExerciseTags(name)?.movement ?? ''));
      ok(`${label}: painful pressing is withheld after an accepted manual Add`, injury.ok && painful.length === 0, JSON.stringify(painful));
      const injured = visibleSignature(view());
      const injuryBoot = await quietAsync(() => relaunchApp({ storage, todayISO: date }));
      ok(`${label}: painful-trigger handling on manual Add survives restart`, injuryBoot.ok && visibleSignature(view()) === injured);
      const injuryClear = await quietAsync(() => executeProgramControlActionDurably({ type: 'clear_injury_modifier', source,
        scope: 'current_and_future', payload: { episodeId: injury.createdModifierIds?.[0] }, requiresRebuild: false,
        createsActiveModifier: false, oneOffOnly: false }, { todayISO: date }));
      ok(`${label}: Clear painful trigger restores the accepted manual Add`, injuryClear.ok && visibleSignature(view()) === accepted);
      const fact = createTemporaryEquipmentFact({ observedDate: date, scope: temporaryFactScope({ kind: 'week', date }),
        mode: 'only', equipmentTags: ['bodyweight'], sourceSurface: 'test' });
      const restrict = await quietAsync(() => transactTemporarySourceFact({ operation: 'create', fact, todayISO: date }));
      const restrictedIllegal = names().filter(name => !exerciseIsAvailableWith(name, ['bodyweight']));
      ok(`${label}: temporary kit restriction reaches special-session rows`, restrict.outcome === 'created_and_recomposed' && restrictedIllegal.length === 0,
        JSON.stringify({ restrict, illegal: restrictedIllegal, names: names() }));
      const restricted = visibleSignature(view());
      const restrictedBoot = await quietAsync(() => relaunchApp({ storage, todayISO: date }));
      ok(`${label}: temporary special-session restriction survives restart`, restrictedBoot.ok && visibleSignature(view()) === restricted);
      const clear = await quietAsync(() => transactTemporarySourceFact({ operation: 'resolve', factId: fact.factId, todayISO: date }));
      ok(`${label}: Clear equipment restores the accepted special session`, clear.outcome === 'resolved_and_recomposed' && visibleSignature(view()) === accepted,
        JSON.stringify(clear));
    }
}
