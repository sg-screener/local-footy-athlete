/**
 * A FIELD CANNOT DRIFT INTO COACH-FLAVOUR SILENTLY.
 *
 * SAM'S RULING 5, 2026-07-30: "The coach-context category is SIGNED as a mechanism: a
 * typed declaration + gate, so a field can be ruled coach-flavour but can never drift
 * there silently."
 *
 * THE DEFECT IT CLOSES. `docs/ONBOARDING_INFLUENCE_MAP_2026-07-30.md` found EIGHT
 * onboarding answers that influence nothing about the program — `ageRange` reaching only
 * the coach prompt, `teamTrainingDuration` asked and shown back and never used. None of
 * them was noticed for months, because "influences nothing" had no representation: a field
 * that quietly stops mattering looks exactly like a field that never did.
 *
 * SO THE GATE RUNS IN BOTH DIRECTIONS, and neither alone is worth having:
 *
 *   declared -> code   a field declared coach-context must have NO programming consumer.
 *                      If one appears, the declaration is stale and the ruling needs
 *                      revisiting — the field now shapes a program Sam was told it did not.
 *   code -> declared   a field with no programming consumer must be DECLARED. This is the
 *                      direction that catches the next `ageRange`: a question the app asks
 *                      whose answer reaches nothing, with nobody having decided that.
 *
 * WHAT COUNTS AS A PROGRAMMING CONSUMER: a reference from `src/rules`, `src/data` or the
 * generation/engine modules. Screens, the onboarding flow itself, the review rows, the
 * coach prompt and the profile mirror are NOT programming — they collect, display or
 * narrate the answer.
 *
 * DEPTH (L13): 0 — a static sweep over declared fields and the source tree.
 *
 * Run: npm run test:onboarding-field-influence
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';


import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import fs from 'fs';
import { ONBOARDING_STEPS } from '../utils/onboardingSteps';
import path from 'path';

import {
  ONBOARDING_FIELD_DECLARATIONS,
  isCoachContextOnlyField,
  onboardingFieldDeclaration,
} from '../rules/onboardingFieldInfluence';

const src = path.resolve(__dirname, '..');
let passed = 0; const failures: string[] = [];
function ok(name: string, condition: unknown, detail?: unknown): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail !== undefined ? `\n      ${
    typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
}

/** Every `.ts` under a directory, excluding tests. */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string): void => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'dev') continue;
        walk(full);
        continue;
      }
      if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) out.push(full);
    }
  };
  walk(dir);
  return out;
}

/**
 * The modules that SHAPE A PROGRAM, as opposed to collecting or narrating an answer.
 *
 * Named as directories rather than as a file list so a new rule module is covered the day
 * it exists — a hand-maintained file list is the second representation this repo keeps
 * paying for.
 */
const PROGRAMMING_DIRS = ['rules', 'data'];
/** Engine and generation modules that live outside those directories. */
const PROGRAMMING_FILES = [
  'utils/coachingEngine.ts',
  // Decides which equipment an athlete has, which decides which exercises exist. As
  // programming as it gets, and the gate said so: `equipmentSelectionCompleteness` reaches
  // only this module and the profile transaction, and was reported undeclared until this
  // list admitted the module.
  'utils/equipmentAvailability.ts',
  'utils/sessionBuilder.ts',
  'utils/loadEstimation.ts',
  'utils/recoveryAddonBuilder.ts',
  'utils/optionalTopUpPlacement.ts',
  'data/defaultProgram.ts',
];
/**
 * NOT programming, however many times they mention a field. The coach PROMPT is the
 * point: `generateProgram` builds it, so a coach-context field legitimately appears
 * there — and that appearance must not read as a programming consumer.
 */
const NARRATING_FILES = new Set([
  'services/api/generateProgram.ts',
]);

const programmingSources = (() => {
  const files = new Set<string>();
  for (const dir of PROGRAMMING_DIRS) {
    for (const file of sourceFiles(path.join(src, dir))) {
      files.add(path.relative(src, file));
    }
  }
  for (const file of PROGRAMMING_FILES) files.add(file);
  const out = new Map<string, string>();
  for (const rel of files) {
    if (NARRATING_FILES.has(rel)) continue;
    const full = path.join(src, rel);
    if (!fs.existsSync(full)) continue;
    out.set(rel, fs.readFileSync(full, 'utf8'));
  }
  return out;
})();

/** Files in the programming set that reference this field name. */
function programmingConsumers(field: string): string[] {
  const rx = new RegExp(`\\b${field}\\b`);
  const hits: string[] = [];
  for (const [rel, text] of programmingSources) {
    // The declaration module itself names every declared field by definition.
    if (rel === 'rules/onboardingFieldInfluence.ts') continue;
    if (rx.test(text)) hits.push(rel);
  }
  return hits;
}

console.log('\n[1] The declarations are well-formed and carry their authority');
{
  ok('there is at least one declaration', ONBOARDING_FIELD_DECLARATIONS.length > 0);
  const fields = ONBOARDING_FIELD_DECLARATIONS.map((entry) => entry.field);
  ok('no field is declared twice', new Set(fields).size === fields.length,
    fields.filter((f, i) => fields.indexOf(f) !== i));
  for (const entry of ONBOARDING_FIELD_DECLARATIONS) {
    ok(`${entry.field}: quotes the ruling that declared it`,
      entry.ruling.includes('Sam') && entry.ruling.length > 40,
      'a declaration without its ruling is an assertion, not an authority');
    ok(`${entry.field}: exists on OnboardingData`,
      fs.readFileSync(path.join(src, 'types/domain.ts'), 'utf8').includes(`${entry.field}?:`),
      'a declaration for a field that does not exist is stale');
    if (entry.role === 'coach_context_and_estimate_seed') {
      ok(`${entry.field}: names the sheet that will supersede it`,
        !!entry.supersededBy && entry.supersededBy.endsWith('.md'),
        'an estimate seed with no named successor is a permanent estimate');
      ok(`${entry.field}: that sheet exists`,
        fs.existsSync(path.resolve(src, '..', entry.supersededBy!)), entry.supersededBy);
    }
  }
}

console.log('\n[2] DECLARED -> CODE: a coach-context field shapes no program');
{
  for (const entry of ONBOARDING_FIELD_DECLARATIONS) {
    const consumers = programmingConsumers(entry.field);
    ok(`${entry.field} has no programming consumer`, consumers.length === 0,
      `it is declared ${entry.role} but is read by ${consumers.join(', ')}. Either the `
      + 'declaration is stale — the field now shapes a program Sam was told it did not — '
      + 'or the consumer should not exist.');
  }
}

console.log('\n[3] CODE -> DECLARED: a field that shapes nothing must SAY so');
{
  // The direction that catches the next `ageRange`. Every onboarding field is either read
  // by a programming module or declared above; silence is not an option.
  const domain = fs.readFileSync(path.join(src, 'types/domain.ts'), 'utf8');
  const start = domain.indexOf('export interface OnboardingData {');
  const body = domain.slice(start, domain.indexOf('\n}', start));
  const fields = Array.from(body.matchAll(/^\s{2}([a-zA-Z][a-zA-Z0-9]*)\??:/gm))
    .map((match) => match[1]);
  ok('the field sweep found the whole interface', fields.length >= 30, `${fields.length} fields`);

  /**
   * Fields whose role is COPY, not programming and not coach context.
   *
   * `firstName` is the athlete's name and `trainingDaysUnsure` records which onboarding
   * path they took. Neither is an answer about training, so neither belongs in the
   * declaration list — but both must be named HERE rather than passing silently, which is
   * the same discipline the declarations enforce.
   */
  const NOT_AN_ANSWER_ABOUT_TRAINING = new Set(['firstName', 'trainingDaysUnsure']);

  const undeclared: string[] = [];
  for (const field of fields) {
    if (NOT_AN_ANSWER_ABOUT_TRAINING.has(field)) continue;
    if (isCoachContextOnlyField(field)) continue;
    if (programmingConsumers(field).length === 0) undeclared.push(field);
  }
  ok('every onboarding answer either shapes a program or is DECLARED', undeclared.length === 0,
    `${undeclared.join(', ')} reach no programming module and are not declared. An answer `
    + 'the app asks for and nothing consumes is the silent-swallow class — get it ruled: '
    + 'give it a consumer, stop asking, or declare it coach-context.');
}

console.log('\n[4] The estimate-seed role means what it says');
{
  const seeds = ONBOARDING_FIELD_DECLARATIONS.filter(
    (entry) => entry.role === 'coach_context_and_estimate_seed');
  // BOTH team-night answers LEFT this role on 2026-07-31, in opposite directions, and the
  // role is empty as a result. Duration was RETIRED (Sam: it stops being asked); intensity
  // GRADUATED (its mechanism shipped, so it has a real consumer and needs no declaration).
  //
  // Asserted as empty rather than deleted, because empty is the meaningful state: no
  // answer is currently waiting on a promised mechanism. A future seed re-populates it and
  // the per-entry checks below start applying again on their own.
  ok('no answer is currently waiting on a promised mechanism',
    seeds.length === 0, seeds.map((e) => e.field));
  for (const seed of seeds) {
    const declaration = onboardingFieldDeclaration(seed.field);
    ok(`${seed.field}: the ruling says it is a starting assumption`,
      /starting assumption|seed/i.test(declaration?.ruling ?? ''));
  }
}

console.log('\n[5] A retired answer is retired ON THE RECORD, never merely forgotten');
{
  const retired = ONBOARDING_FIELD_DECLARATIONS.filter(
    (entry) => entry.role === 'retired_no_longer_asked');
  ok('teamTrainingDuration is the retired answer', 
    retired.map((entry) => entry.field).join(',') === 'teamTrainingDuration',
    retired.map((e) => e.field));

  for (const entry of retired) {
    ok(`${entry.field}: names the ruling that retired it`,
      /stops being asked|stop asking|no longer asked/i.test(entry.ruling), entry.ruling);

    // THE DIRECTION THAT MATTERS: retired means NO STEP COLLECTS IT. Without this, the
    // declaration is a comment — the field could go on being asked while a rule file
    // claims it was retired, which is the exact "influences nothing has no
    // representation" problem inverted.
    const collectors = ONBOARDING_STEPS
      .filter((step) => (step.collects as readonly string[]).includes(entry.field))
      .map((step) => step.name);
    ok(`${entry.field}: no onboarding step collects it any more`,
      collectors.length === 0, collectors);
  }
}

console.log(`\nOnboarding field influence: ${passed} passed, ${failures.length} failed`);
totalsPrinted(failures.length);
console.log('  DEPTH (L13): 0 — a static sweep over declared fields and the source tree.');
console.log('  NOT COVERED: whether a programming consumer USES the value meaningfully.');
console.log('  A field read once and ignored still counts as consumed here.');
if (failures.length > 0) { console.error(`FAILURES:\n  ${failures.join('\n  ')}`); process.exit(1); }
