/**
 * THE APP MAP IS THE ATHLETE'S OWN BUTTONS (plan slice S3, 2026-09-10).
 *
 * Every door label is read from the owner that renders it, or pinned to the
 * file that still holds it as a literal; the generated map file is byte-fresh;
 * and the response contract's door gate refuses a quoted control the map does
 * not hold while letting ordinary prose through.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { armTotalsOrRed } from './support/totalsOrRed';
import { COACH_APP_DOOR_LABELS, COACH_APP_MAP } from '../rules/coachAppMap';
import { registerProjectionCopy } from '../rules/projectionCopy';
import { signedCopyEntry } from '../rules/signedCopy';
import { CANONICAL_COACH_KNOWLEDGE } from '../../supabase/functions/coach-chat/canonicalCoachKnowledge.generated';
import {
  coachResponseGroundingFacts,
  doorClaimGrounded,
  doorClaimViolation,
  doorLabelsFromKnowledge,
  evaluateCoachResponseContract,
  coachResponseContractFailureCode,
} from '../rules/coachResponseContract';
import { coachLabFixtureSnapshot } from '../dev/coachLab/coachLabCases';
import { buildCoachModelInput } from '../rules/coachModelContext';

armTotalsOrRed();
registerProjectionCopy();

const ROOT = resolve(__dirname, '../..');
let passed = 0;
let failed = 0;
function ok(name: string, condition: unknown, detail?: unknown): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failed += 1;
  console.error(`  FAIL ${name}${detail === undefined ? '' : `\n      ${JSON.stringify(detail)}`}`);
}
const read = (relative: string): string => readFileSync(resolve(ROOT, relative), 'utf8');

console.log('\n[1] EVERY LABEL IS A LIVE OWNER\'S WORD');
{
  ok('every door has a non-empty label, a path and a purpose',
    COACH_APP_MAP.every((door) => door.label.trim().length > 0 && door.path.length > 0
      && door.does.trim().length > 10 && door.when.trim().length > 5));
  ok('door ids are unique and DOOR-shaped',
    new Set(COACH_APP_MAP.map((door) => door.id)).size === COACH_APP_MAP.length
      && COACH_APP_MAP.every((door) => /^DOOR-[a-z0-9-]+$/.test(door.id)));
  const signedMismatch = COACH_APP_MAP.filter((door) => door.source.kind === 'signed'
    && signedCopyEntry(door.source.id)?.text !== door.label);
  ok('every signed label is exactly the sheet\'s text', signedMismatch.length === 0, signedMismatch.map((d) => d.id));
  const literalMisses = COACH_APP_MAP.filter((door) => door.source.kind === 'literal'
    && !read(door.source.file).includes(door.label));
  ok('every literal label still exists in the file that renders it', literalMisses.length === 0,
    literalMisses.map((door) => `${door.id}: "${door.label}" not in ${(door.source as { file: string }).file}`));
  ok('every path starts on a tab', COACH_APP_MAP.every((door) =>
    ['Program', 'Coach', 'Progress', 'Profile'].includes(door.path[0])));
  ok('the three Not feeling 100%? tiles and the three profile schedule rows are doors',
    ['Tired', 'Sick', 'Injured', 'Gym days', 'Team Training', 'Game Day'].every((label) => COACH_APP_DOOR_LABELS.includes(label)));
}

console.log('\n[2] THE GENERATED MAP IS FRESH');
{
  const generated = read('docs/generated/COACH_APP_MAP.md');
  ok('one row per door, each carrying its label and its place',
    COACH_APP_MAP.every((door) => generated.includes(`**${door.id}** · Label: "${door.label}" · Where: ${door.path.join(' → ')}`)),
    COACH_APP_MAP.filter((door) => !generated.includes(`**${door.id}** · Label: "${door.label}"`)).map((d) => d.id));
  ok('no row is stale: the generated file names exactly the doors in the map',
    (generated.match(/^\*\*DOOR-/gm) ?? []).length === COACH_APP_MAP.length);
  ok('the map is a knowledge source of the app_map authority',
    /docs\/generated\/COACH_APP_MAP\.md[^\n]*app_map/.test(read('src/rules/coachKnowledgeManifest.ts')));
}

console.log('\n[3] THE DOOR GATE: A QUOTED CONTROL MUST BE A DOOR');
{
  const facts = coachResponseGroundingFacts(
    buildCoachModelInput({ athleteMessage: 'x', snapshot: coachLabFixtureSnapshot() }).currentAthleteSnapshot,
    COACH_APP_DOOR_LABELS,
  );
  const fromBundle = doorLabelsFromKnowledge(CANONICAL_COACH_KNOWLEDGE);
  ok('the server learns the same labels from the bundled map that the app passes directly',
    JSON.stringify([...fromBundle].sort()) === JSON.stringify([...COACH_APP_DOOR_LABELS].sort()),
    { fromBundle: fromBundle.length, app: COACH_APP_DOOR_LABELS.length });
  ok('the facts carry every door label, lower-cased', facts.doorLabels.includes('sick') && facts.doorLabels.includes('log training'));
  ok('naming a real door passes',
    doorClaimGrounded('On the Program tab, under Not feeling 100%?, tap "Sick" and choose Properly sick.', facts));
  ok('naming a control the app does not have is refused',
    !doorClaimGrounded('Open the app and tap "Reduce this week" to soften it.', facts));
  ok('an unquoted Title-Case phrase is prose, never refused (v14 refused real answers on it)',
    doorClaimGrounded('Tap Log Injury on the session screen.', facts));
  ok('a quoted control that is not a door is named in the violation detail',
    doorClaimViolation('Tap "Log Injury" on the session screen.', facts) === 'Log Injury');
  ok('ordinary prose after the same verbs is not a claim',
    doorClaimGrounded("Use Monday's session as a lighter day and open with a longer warm-up.", facts));
  const grounded = {
    message: 'Tap "Reduce this week" on the Coach tab.',
    answerMode: 'answer',
    basis: ['athlete_snapshot', 'app_door'],
    snapshotFieldsUsed: ['visibleWeek'],
    knowledgeSources: [],
    judgementLabel: 'not_needed',
    programActions: [],
  };
  const refused = evaluateCoachResponseContract(grounded, {
    requiresLiveProgramFacts: true, allowedKnowledgeSourceIds: [], facts,
  });
  ok('the contract refuses an invented control as a refusal, not an invalid answer',
    !refused.ok && refused.automaticChecks.doorClaimsGrounded === false
      && coachResponseContractFailureCode(refused) === 'refused', refused.violations);
  ok('app_door is a basis the contract accepts', refused.automaticChecks.schemaValid === true);
  const doorOnly = evaluateCoachResponseContract({
    ...grounded,
    message: 'On the Program tab, under Not feeling 100%?, tap "Sick" and pick how bad it is; the week is lightened while it is active.',
    basis: ['app_door'],
    snapshotFieldsUsed: [],
    knowledgeSources: [{ id: 'docs/generated/COACH_APP_MAP.md:L20-L20', authority: 'app_map', sourceReference: 'docs/generated/COACH_APP_MAP.md:L20-L20' }],
  }, { requiresLiveProgramFacts: true, allowedKnowledgeSourceIds: ['docs/generated/COACH_APP_MAP.md:L20-L20'], facts });
  ok('a "how do I" answer grounded only in a cited door passes the live-facts requirement',
    doorOnly.ok, doorOnly.violations);
  const doorMislabelled = evaluateCoachResponseContract({
    ...grounded,
    message: 'On the Program tab, under Not feeling 100%?, tap "Sick".',
    basis: ['app_door'],
    snapshotFieldsUsed: [],
    knowledgeSources: [{ id: 'docs/generated/COACH_APP_MAP.md:L20-L20', authority: 'active_rule', sourceReference: 'docs/generated/COACH_APP_MAP.md:L20-L20' }],
  }, { requiresLiveProgramFacts: true, allowedKnowledgeSourceIds: ['docs/generated/COACH_APP_MAP.md:L20-L20'], facts });
  ok('a DOOR chunk cited under the wrong authority label still counts as the door (the path is the truth)',
    doorMislabelled.ok, doorMislabelled.violations);
  const doorUnreceipted = evaluateCoachResponseContract({
    ...grounded,
    message: 'On the Program tab, under Not feeling 100%?, tap "Sick".',
    basis: ['app_door'],
    snapshotFieldsUsed: [],
    knowledgeSources: [],
  }, { requiresLiveProgramFacts: true, allowedKnowledgeSourceIds: [], facts });
  ok('a door basis with no DOOR chunk cited is refused',
    !doorUnreceipted.ok && doorUnreceipted.automaticChecks.lfaClaimsGrounded === false, doorUnreceipted.violations);
}

console.log(`\nCoach app map totals: ${passed} passed, ${failed} failed`);
console.log('  NOT COVERED: whether the model names the door in practice — the Coach Lab tapes own that.');
process.exit(failed === 0 ? 0 : 1);
