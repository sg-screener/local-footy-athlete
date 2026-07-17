/**
 * Permanent contract tests for canonical Coach injury ownership slices 1-2.
 *
 * Run: npm run test:coach-injury-contracts
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  COACH_INTENT_SYSTEM_PROMPT,
  isInjuryEpisodeIntent,
  parseCoachIntent,
  parseInjuryEpisodePayload,
  type AcceptedInjuryContext,
  type InjuryEpisodeIntent,
} from '../utils/coachIntent';
import {
  parseInjuryEpisodeIntent as parseEdgeInjuryEpisodeIntent,
} from '../../supabase/functions/shared/coachInjuryIntentContract';
import { buildAcceptedInjuryContext } from '../utils/coachContextPacket';
import { createEmptyAcceptedMaterialContext } from '../store/acceptedStateColdStart';
import type { InjuryEpisodeV1 } from '../rules/injuryEpisode';
import {
  getPendingClarifierSnapshot,
  getPendingInjuryClarifierSnapshot,
  PENDING_CLARIFIER_TTL_MS,
  usePendingCoachClarifierStore,
  type PendingInjuryClarifier,
} from '../store/pendingCoachClarifierStore';
import {
  resolveCoachInjuryTarget,
} from '../utils/coachInjuryTargetResolver';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    pass += 1;
    console.log(`  \u2713 ${name}`);
  } else {
    fail += 1;
    failures.push(name);
    console.log(`  \u2717 ${name}${detail ? `\n      ${detail}` : ''}`);
  }
}

function eq(name: string, actual: unknown, expected: unknown): void {
  ok(
    name,
    JSON.stringify(actual) === JSON.stringify(expected),
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

function section(label: string): void {
  console.log(`\n${label}`);
}

function rawIntent(
  intent: InjuryEpisodeIntent['intent'],
  payload?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    intent,
    confidence: 0.94,
    needsClarification: false,
    ...(payload === undefined ? {} : { payload }),
  };
}

function injuryIntent(
  kind: InjuryEpisodeIntent['intent'],
  payload?: Record<string, unknown>,
): InjuryEpisodeIntent {
  const parsed = parseCoachIntent(rawIntent(kind, payload));
  if (!parsed || !isInjuryEpisodeIntent(parsed)) {
    throw new Error(`invalid injury test intent: ${kind} ${JSON.stringify(payload)}`);
  }
  return parsed;
}

function episode(args: {
  id: string;
  bodyPart: string;
  bucket: InjuryEpisodeV1['bucket'];
  onset: string;
  updatedAt?: string;
  severity?: number;
  status?: InjuryEpisodeV1['status'];
  secret?: string;
}): InjuryEpisodeV1 {
  const createdAt = `${args.onset}T08:00:00.000Z`;
  return {
    protocolVersion: 1,
    episodeId: args.id,
    bodyPart: args.bodyPart,
    bucket: args.bucket,
    severity: args.severity ?? 6,
    status: args.status ?? 'active',
    onsetOrReportedDate: args.onset,
    createdAt,
    updatedAt: args.updatedAt ?? createdAt,
    resolvedAt: args.status === 'resolved' ? args.updatedAt ?? createdAt : null,
    triggers: [args.secret ?? 'private trigger'],
    seriousSymptoms: false,
    seriousSymptom: args.secret,
    transitionHistory: [{
      timestamp: createdAt,
      fromStatus: 'new',
      toStatus: args.status ?? 'active',
      severity: args.severity ?? 6,
      note: args.secret ?? 'private raw message',
      sourceActor: 'athlete',
      sourceSurface: 'coach_chat',
    }],
    sourceActor: 'athlete',
    sourceSurface: 'coach_chat',
    affectedDates: [],
    affectedWeeks: [],
    currentRestrictionPolicy: { rules: [], safeFocus: [], advice: [] },
    legacyMigrationStatus: 'native_v1',
    compatibility: { constraintId: `constraint-${args.id}` },
  };
}

function acceptedContext(
  activeEpisodes: AcceptedInjuryContext['activeEpisodes'],
): AcceptedInjuryContext {
  return { revision: 7, activeEpisodes };
}

function acceptedEpisode(args: {
  id: string;
  bodyPart: string;
  bucket: AcceptedInjuryContext['activeEpisodes'][number]['bucket'];
  onset: string;
  updatedAt?: string;
}): AcceptedInjuryContext['activeEpisodes'][number] {
  return {
    episodeId: args.id,
    bodyPart: args.bodyPart,
    bucket: args.bucket,
    severity: 6,
    status: 'active',
    onsetOrReportedDate: args.onset,
    updatedAt: args.updatedAt ?? `${args.onset}T08:00:00.000Z`,
    seriousSymptoms: false,
  };
}

section('[1] strict shared injury intent contract');
{
  const variants: Array<[InjuryEpisodeIntent['intent'], Record<string, unknown>]> = [
    ['new_injury_report', { bodyPart: 'hamstring', severity: 6 }],
    ['injury_severity_reply', { severity: 4 }],
    ['active_injury_followup', { bodyPart: 'hamstring', followupKind: 'improving' }],
  ];
  for (const [kind, payload] of variants) {
    const raw = rawIntent(kind, payload);
    const app = parseCoachIntent(raw);
    const edge = parseEdgeInjuryEpisodeIntent(raw);
    ok(`${kind} parses in app`, !!app && isInjuryEpisodeIntent(app));
    eq(`${kind} app/edge parser parity`, app, edge);
  }

  const missingSeverity = rawIntent('new_injury_report', { bodyPart: 'calf' });
  ok('missing severity remains a valid classified injury intent',
    isInjuryEpisodeIntent(parseCoachIntent(missingSeverity)));
  ok('missing payload remains valid for severity reply',
    isInjuryEpisodeIntent(parseCoachIntent(rawIntent('injury_severity_reply'))));
  eq('missing payload canonicalizes to an empty injury payload',
    (parseCoachIntent(rawIntent('injury_severity_reply')) as InjuryEpisodeIntent).payload,
    {});

  for (const severity of [0, 11, 2.5, '6']) {
    const raw = rawIntent('new_injury_report', { bodyPart: 'calf', severity });
    ok(`invalid severity ${String(severity)} fails app parser`, parseCoachIntent(raw) === null);
    ok(`invalid severity ${String(severity)} fails edge parser`,
      parseEdgeInjuryEpisodeIntent(raw) === null);
  }
  for (const payload of [
    { bodyPart: '', severity: 4 },
    { bodyPart: 'calf', severity: 4, requestedDate: '2026-07-20' },
    { followupKind: 'better' },
    {},
  ]) {
    const kind = 'followupKind' in payload || Object.keys(payload).length === 0
      ? 'active_injury_followup'
      : 'new_injury_report';
    ok(`invalid injury payload fails: ${JSON.stringify(payload)}`,
      parseCoachIntent(rawIntent(kind, payload)) === null);
  }
  ok('strict payload parser accepts only injury keys',
    parseInjuryEpisodePayload({ bodyPart: 'knee', severity: 5 }, 'new_injury_report') !== null);
  ok('strict payload parser rejects unknown injury keys',
    parseInjuryEpisodePayload({ bodyPart: 'knee', concern: 'raw note' }, 'new_injury_report') === null);
}

section('[2] fixture/outcome/program-adjustment contract remains strict');
{
  const fixture = {
    intent: 'fixture_change',
    confidence: 0.9,
    needsClarification: false,
    payload: { action: 'move', sourceDate: '2026-07-20', targetDate: '2026-07-21' },
  };
  ok('valid fixture_change still parses', parseCoachIntent(fixture) !== null);
  ok('fixture_change still rejects unknown fields', parseCoachIntent({
    ...fixture,
    payload: { ...fixture.payload, bodyPart: 'hamstring' },
  }) === null);
  ok('fixture_change still rejects missing move target', parseCoachIntent({
    ...fixture,
    payload: { action: 'move', sourceDate: '2026-07-20' },
  }) === null);
  ok('prompt keeps missed games as session outcomes',
    /missed game[\s\S]*record_session_outcome[\s\S]*never fixture_change/i.test(
      COACH_INTENT_SYSTEM_PROMPT));
  ok('prompt keeps workout movement as program adjustment',
    /Moving a workout[\s\S]*request_program_adjustment[\s\S]*never fixture_change/i.test(
      COACH_INTENT_SYSTEM_PROMPT));
}

section('[3] canonical accepted injury context');
{
  const secret = 'SECRET_RAW_INJURY_MESSAGE';
  const earlier = episode({
    id: 'episode-earlier',
    bodyPart: 'hamstring',
    bucket: 'hamstring',
    onset: '2026-07-01',
    updatedAt: '2026-07-16T09:00:00.000Z',
    secret,
  });
  const later = episode({
    id: 'episode-later',
    bodyPart: 'shoulder',
    bucket: 'shoulder',
    onset: '2026-07-10',
    updatedAt: '2026-07-12T09:00:00.000Z',
    status: 'improving',
    secret,
  });
  const resolved = episode({
    id: 'episode-resolved',
    bodyPart: 'calf',
    bucket: 'calf',
    onset: '2026-06-01',
    status: 'resolved',
    secret,
  });
  const context = {
    ...createEmptyAcceptedMaterialContext(),
    revision: 19,
    injuryEpisodes: [later, resolved, earlier],
    temporarySourceFacts: [later, resolved, earlier],
  };
  const built = buildAcceptedInjuryContext(context);
  eq('canonical revision and every active episode are preserved', {
    revision: built.revision,
    ids: built.activeEpisodes.map((candidate) => candidate.episodeId),
  }, {
    revision: 19,
    ids: ['episode-earlier', 'episode-later'],
  });
  eq('deterministic ordering is independent of input order',
    built,
    buildAcceptedInjuryContext({
      ...context,
      injuryEpisodes: [earlier, resolved, later],
      temporarySourceFacts: [earlier, resolved, later],
    }));
  const serialized = JSON.stringify(built);
  ok('canonical context exposes no raw notes/messages', !serialized.includes(secret));
  ok('canonical context exposes only the targeting contract fields',
    built.activeEpisodes.every((candidate) =>
      Object.keys(candidate).sort().join(',') === [
        'bodyPart',
        'bucket',
        'episodeId',
        'onsetOrReportedDate',
        'seriousSymptoms',
        'severity',
        'status',
        'updatedAt',
      ].sort().join(',')));
}

section('[4] typed pending injury state is exclusive, TTL-aware, and resettable');
{
  const NOW = 1_800_000_000_000;
  const store = usePendingCoachClarifierStore.getState();
  store.reset();
  store.setPending({
    operation: 'swap_conditioning_modality_once',
    partialPayload: {
      operation: 'swap_conditioning_modality_once',
      from: 'rower',
      to: 'bike',
      bikeLabel: null,
    },
    scope: 'one_off',
    missingFields: ['target_session'],
    originalMessage: 'make it a bike',
    askedQuestion: 'Which session?',
    createdAt: NOW,
  });
  ok('generic pending starts effective', !!getPendingClarifierSnapshot(NOW));
  ok('generic pending clears injury pending', store.pendingInjury === null);

  store.setPendingInjury({
    operation: 'report',
    bodyPart: 'shoulder',
    originalMessage: 'shoulder hurts',
    askedQuestion: 'How bad is it?',
    createdAt: NOW,
  });
  ok('setting injury pending clears generic pending',
    usePendingCoachClarifierStore.getState().pending === null);
  ok('fresh injury pending is returned', !!getPendingInjuryClarifierSnapshot(NOW));
  ok('injury pending expires after TTL',
    getPendingInjuryClarifierSnapshot(NOW + PENDING_CLARIFIER_TTL_MS + 1) === null);

  usePendingCoachClarifierStore.getState().setPending({
    operation: 'swap_conditioning_modality_once',
    partialPayload: {
      operation: 'swap_conditioning_modality_once',
      from: 'rower',
      to: 'bike',
      bikeLabel: null,
    },
    scope: 'one_off',
    missingFields: ['target_session'],
    originalMessage: 'make it a bike',
    askedQuestion: 'Which session?',
    createdAt: NOW,
  });
  ok('setting generic pending retires injury pending',
    usePendingCoachClarifierStore.getState().pendingInjury === null);
  usePendingCoachClarifierStore.getState().setPendingInjury({
    operation: 'report',
    bodyPart: 'knee',
    originalMessage: 'knee hurts',
    askedQuestion: 'How bad is it?',
    createdAt: NOW,
  });
  usePendingCoachClarifierStore.getState().reset();
  eq('reset clears both slots', {
    generic: usePendingCoachClarifierStore.getState().pending,
    injury: usePendingCoachClarifierStore.getState().pendingInjury,
  }, { generic: null, injury: null });
}

section('[5] pure target resolution order and ambiguity invariants');
{
  const hamstring = acceptedEpisode({
    id: 'hamstring-old', bodyPart: 'hamstring', bucket: 'hamstring', onset: '2026-07-01',
  });
  const shoulder = acceptedEpisode({
    id: 'shoulder', bodyPart: 'shoulder', bucket: 'shoulder', onset: '2026-07-02',
  });

  const pendingReport: PendingInjuryClarifier = {
    operation: 'report',
    bodyPart: 'calf',
    originalMessage: 'calf hurts',
    askedQuestion: 'How bad is it?',
    createdAt: 1,
  };
  const pendingBound = resolveCoachInjuryTarget({
    intent: injuryIntent('injury_severity_reply', { severity: 7 }),
    acceptedInjuryContext: acceptedContext([hamstring, shoulder]),
    pendingInjury: pendingReport,
    currentMessage: { severity: 7 },
  });
  eq('pending severity binds before active episodes', {
    kind: pendingBound.kind,
    bodyPart: pendingBound.kind === 'resolved_report' ? pendingBound.bodyPart : null,
  }, { kind: 'resolved_report', bodyPart: 'calf' });

  const superseded = resolveCoachInjuryTarget({
    intent: injuryIntent('new_injury_report', { bodyPart: 'knee', severity: 5 }),
    acceptedInjuryContext: acceptedContext([hamstring]),
    pendingInjury: pendingReport,
    currentMessage: { bodyPart: 'knee', severity: 5 },
  });
  eq('explicit different body part supersedes pending severity', {
    kind: superseded.kind,
    reason: superseded.kind === 'superseded_pending' ? superseded.reason : null,
    nextKind: superseded.kind === 'superseded_pending' ? superseded.next.kind : null,
  }, {
    kind: 'superseded_pending',
    reason: 'new_report',
    nextKind: 'resolved_report',
  });

  const exact = resolveCoachInjuryTarget({
    intent: injuryIntent('active_injury_followup', {
      bodyPart: 'shoulder', followupKind: 'unchanged',
    }),
    acceptedInjuryContext: acceptedContext([hamstring, shoulder]),
    currentMessage: { bodyPart: 'shoulder' },
  });
  eq('exact normalized body-part match resolves exact episode', {
    kind: exact.kind,
    id: exact.kind === 'exact_episode' ? exact.episodeId : null,
    source: exact.kind === 'exact_episode' ? exact.source : null,
  }, { kind: 'exact_episode', id: 'shoulder', source: 'explicit_body_part' });

  const bucket = resolveCoachInjuryTarget({
    intent: injuryIntent('active_injury_followup', {
      bodyPart: 'hammy', followupKind: 'resolved',
    }),
    acceptedInjuryContext: acceptedContext([hamstring, shoulder]),
    currentMessage: { bodyPart: 'hammy' },
  });
  eq('canonical bucket match resolves alias', {
    kind: bucket.kind,
    id: bucket.kind === 'exact_episode' ? bucket.episodeId : null,
    source: bucket.kind === 'exact_episode' ? bucket.source : null,
  }, { kind: 'exact_episode', id: 'hamstring-old', source: 'canonical_bucket' });

  const newerDuplicate = acceptedEpisode({
    id: 'hamstring-new',
    bodyPart: 'hamstring',
    bucket: 'hamstring',
    onset: '2026-07-12',
    updatedAt: '2026-07-17T10:00:00.000Z',
  });
  const ambiguous = resolveCoachInjuryTarget({
    intent: injuryIntent('active_injury_followup', {
      bodyPart: 'hammy', followupKind: 'worsening', severity: 8,
    }),
    acceptedInjuryContext: acceptedContext([newerDuplicate, hamstring]),
    currentMessage: { bodyPart: 'hammy', severity: 8 },
  });
  eq('multiple bucket matches clarify without newest-first tiebreak', {
    kind: ambiguous.kind,
    ids: ambiguous.kind === 'target_clarification'
      ? ambiguous.candidateEpisodeIds
      : [],
  }, {
    kind: 'target_clarification',
    ids: ['hamstring-old', 'hamstring-new'],
  });
  ok('duplicate target labels include onset/report dates',
    ambiguous.kind === 'target_clarification' &&
      ambiguous.candidateLabels.every((label) => /\(2026-07-\d{2}\)/.test(label)));

  const unique = resolveCoachInjuryTarget({
    intent: injuryIntent('active_injury_followup', { followupKind: 'resolved' }),
    acceptedInjuryContext: acceptedContext([shoulder]),
    currentMessage: {},
  });
  eq('one active episode resolves with no body part', {
    kind: unique.kind,
    id: unique.kind === 'exact_episode' ? unique.episodeId : null,
    source: unique.kind === 'exact_episode' ? unique.source : null,
  }, { kind: 'exact_episode', id: 'shoulder', source: 'unique_active_episode' });

  eq('no active episodes returns no match', resolveCoachInjuryTarget({
    intent: injuryIntent('active_injury_followup', { followupKind: 'resolved' }),
    acceptedInjuryContext: acceptedContext([]),
    currentMessage: {},
  }), { kind: 'no_match', reason: 'no_active_episodes' });

  const newReport = resolveCoachInjuryTarget({
    intent: injuryIntent('new_injury_report', { bodyPart: 'hamstring', severity: 6 }),
    acceptedInjuryContext: acceptedContext([hamstring]),
    currentMessage: { bodyPart: 'hamstring', severity: 6 },
  });
  eq('new injury report stays a report despite similar active episode',
    newReport.kind, 'resolved_report');

  const pendingExact: PendingInjuryClarifier = {
    operation: 'update',
    episodeId: 'shoulder',
    bodyPart: 'shoulder',
    change: 'improving',
    originalMessage: 'shoulder is better',
    askedQuestion: 'What is it out of 10?',
    createdAt: 1,
  };
  const exactFromPending = resolveCoachInjuryTarget({
    intent: injuryIntent('injury_severity_reply', { severity: 3 }),
    acceptedInjuryContext: acceptedContext([hamstring, shoulder]),
    pendingInjury: pendingExact,
    currentMessage: { severity: 3 },
  });
  eq('stored exact pending episode id resolves before general matching', {
    kind: exactFromPending.kind,
    id: exactFromPending.kind === 'exact_episode' ? exactFromPending.episodeId : null,
    source: exactFromPending.kind === 'exact_episode' ? exactFromPending.source : null,
  }, { kind: 'exact_episode', id: 'shoulder', source: 'pending_episode_id' });

  const pendingTarget: PendingInjuryClarifier = {
    operation: 'resolve',
    candidateEpisodeIds: ['hamstring-old', 'shoulder'],
    candidateLabels: ['hamstring (reported 2026-07-01)', 'shoulder (reported 2026-07-02)'],
    originalMessage: 'it is better now',
    askedQuestion: 'Which injury do you mean?',
    createdAt: 1,
  };
  const pendingStillAmbiguous = resolveCoachInjuryTarget({
    intent: injuryIntent('active_injury_followup', { followupKind: 'resolved' }),
    acceptedInjuryContext: acceptedContext([shoulder, hamstring]),
    pendingInjury: pendingTarget,
    currentMessage: {},
  });
  eq('pending target clarification preserves its stable candidate snapshot', {
    kind: pendingStillAmbiguous.kind,
    labels: pendingStillAmbiguous.kind === 'target_clarification'
      ? pendingStillAmbiguous.candidateLabels
      : [],
  }, {
    kind: 'target_clarification',
    labels: ['hamstring (reported 2026-07-01)', 'shoulder (reported 2026-07-02)'],
  });
  const selectedPendingTarget = resolveCoachInjuryTarget({
    intent: injuryIntent('active_injury_followup', { followupKind: 'resolved' }),
    acceptedInjuryContext: acceptedContext([shoulder, hamstring]),
    pendingInjury: pendingTarget,
    currentMessage: { selectedEpisodeId: 'shoulder' },
  });
  eq('valid pending target answer resolves the selected exact episode first', {
    kind: selectedPendingTarget.kind,
    id: selectedPendingTarget.kind === 'exact_episode'
      ? selectedPendingTarget.episodeId
      : null,
    source: selectedPendingTarget.kind === 'exact_episode'
      ? selectedPendingTarget.source
      : null,
  }, { kind: 'exact_episode', id: 'shoulder', source: 'pending_target_answer' });
}

console.log(`\n— Summary —`);
console.log(`  Pass: ${pass}`);
console.log(`  Fail: ${fail}`);
if (fail > 0) {
  console.log('\n— Failures —');
  for (const failure of failures) console.log(`  • ${failure}`);
  process.exit(1);
}
