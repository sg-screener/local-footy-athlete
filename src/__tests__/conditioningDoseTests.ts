/**
 * The conditioning dose parse — one ingress, held against the REAL 55.
 *
 * FIXTURE LAW. Every case below is either a hand-written unit case that pins a
 * documented rule, or a sweep over `CONDITIONING_TEMPLATES` itself — Sam's
 * signed doses, not invented strings that happen to suit the parser. A parser
 * tested only on strings its author imagined is the fixture-fidelity failure
 * this repo has paid for repeatedly.
 *
 * NON-VACUITY. The sweep prints a census and FAILS if the parse rate collapses,
 * so a regression that makes the parser refuse everything cannot pass as
 * "no unexpected refusals".
 */
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';

armTotalsOrRed();

import {
  parseConditioningDose,
  doseSeconds,
  doseMidpoint,
  type ConditioningDoseUnit,
  type ConditioningDoseQuantity,
  type ConditioningDoseParse,
} from '../rules/conditioningDose';
import { CONDITIONING_TEMPLATES } from '../data/conditioningTemplates';

let passed = 0;
const failures: string[] = [];

function run(name: string, body: () => void): void {
  try {
    body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failures.push(name);
    console.log(`  FAIL ${name}`);
    console.log(`      ${error instanceof Error ? error.message : String(error)}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

/**
 * The tests scope runs without strict null checks, so a discriminated-union
 * narrow on `ok` does not hold here. Reading the refusal through one accessor
 * keeps every cell honest without scattering casts.
 */
function refusalReason(parsed: ConditioningDoseParse): string {
  return (parsed as { reason?: string }).reason ?? 'PARSED';
}

function quantity(text: string): ConditioningDoseQuantity {
  const parsed = parseConditioningDose(text);
  if (!parsed.ok) {
    throw new Error(`expected "${text}" to parse, got refusal ${refusalReason(parsed)}`);
  }
  return (parsed as { quantity: ConditioningDoseQuantity }).quantity;
}

console.log('-- Conditioning dose parse (one ingress) --');

run('[1] a plain single value', () => {
  const q = quantity('2 min');
  assert(q.min === 2 && q.max === 2 && q.unit === 'minutes',
    `got ${JSON.stringify(q)}`);
  assert(q.approximate === false, 'plain value is not approximate');
});

run('[2] an EN-DASH range — the shape a hyphen regex silently misses', () => {
  // The sheet writes ranges with a true en dash. This is the single most
  // likely place a hand-rolled caller regex would fail while looking correct.
  const q = quantity('45–60 s walk-back (full recovery)');
  assert(q.min === 45 && q.max === 60 && q.unit === 'seconds',
    `got ${JSON.stringify(q)}`);
});

run('[3] the approximation marker is carried, not discarded', () => {
  const q = quantity('≈2 s (10 m)');
  assert(q.approximate === true, 'the ≈ must survive the parse');
  assert(q.min === 2 && q.unit === 'seconds',
    `the governing quantity is the SECONDS, not the parenthetical metres: ${JSON.stringify(q)}`);
});

run('[4] the authored string always survives verbatim', () => {
  const raw = '≈6 s (20 m build + 20 m fly)';
  const q = quantity(raw);
  assert(q.raw === raw, 'raw must be the authored string, byte for byte');
});

run('[5] a qualitative dose REFUSES rather than defaulting to zero', () => {
  const parsed = parseConditioningDose('Maximal — sets should mirror each other');
  assert(!parsed.ok, 'a dose with no governing quantity must not parse');
  assert(refusalReason(parsed) === 'no_leading_quantity',
    `wrong refusal reason: ${JSON.stringify(parsed)}`);
});

run('[6] an empty dose refuses distinctly from an unreadable one', () => {
  const empty = parseConditioningDose('');
  const unknown = parseConditioningDose('12 fortnights');
  assert(refusalReason(empty) === 'empty', 'empty must say empty');
  assert(refusalReason(unknown) === 'unknown_unit',
    `an unrecognised unit is a build-time question, not a silent default: ${
      JSON.stringify(unknown)}`);
});

run('[7] a cross-unit range does not coerce its high end', () => {
  // "90 s–2 min" is not 90–2 of anything. The governing low end stands and the
  // high end stays authored detail rather than being silently unit-swapped.
  const q = quantity('90 s–2 min (full recovery)');
  assert(q.unit === 'seconds' && q.min === 90 && q.max === 90,
    `a cross-unit range must not fabricate a range: ${JSON.stringify(q)}`);
});

run('[8] seconds conversion refuses to invent a speed', () => {
  assert(doseSeconds(quantity('2 min'))?.min === 120, 'minutes convert');
  assert(doseSeconds(quantity('45–60 s'))?.max === 60, 'seconds pass through');
  assert(doseSeconds(quantity('30 m')) === null,
    'metres are not seconds without a speed, and the speed is the athlete\'s');
});

run('[9] collapsing a range is explicit at the call site', () => {
  assert(doseMidpoint(quantity('45–60 s')) === 52.5, 'midpoint of the authored range');
  assert(doseMidpoint(quantity('8 reps')) === 8, 'a single value is its own midpoint');
});

// ── The sweep over Sam's signed doses ─────────────────────────────────────

interface Refusal { template: string; field: string; raw: string; reason: string }

const refusals: Refusal[] = [];
const parsedUnits = new Map<ConditioningDoseUnit, number>();
let attempted = 0;

const QUANTITY_FIELDS = ['workPeriod', 'restPeriod', 'setsRounds', 'totalSessionTime'] as const;

for (const template of CONDITIONING_TEMPLATES) {
  for (const field of QUANTITY_FIELDS) {
    const raw = (template as unknown as Record<string, string>)[field];
    if (typeof raw !== 'string' || raw.length === 0) continue;
    attempted += 1;
    const parsed = parseConditioningDose(raw);
    if (parsed.ok) {
      parsedUnits.set((parsed as { quantity: ConditioningDoseQuantity }).quantity.unit, (parsedUnits.get(
        (parsed as { quantity: ConditioningDoseQuantity }).quantity.unit) ?? 0) + 1);
    } else {
      refusals.push({ template: template.name, field, raw, reason: refusalReason(parsed) });
    }
  }
}

run('[10] no authored dose is refused for an UNKNOWN UNIT', () => {
  // `no_leading_quantity` is legitimate (a qualitative cell). `unknown_unit`
  // means Sam's sheet carries a shape this owner was never taught — which is a
  // question for the sheet's reader, not something to absorb at runtime.
  const unknown = refusals.filter((entry) => entry.reason === 'unknown_unit');
  assert(unknown.length === 0,
    'the authored sheet uses a unit this parse does not know — teach the owner, '
    + `never default at the call site:\n      ${unknown
      .map((entry) => `${entry.template} .${entry.field} = "${entry.raw}"`)
      .join('\n      ')}`);
});

run('[10b] an N x M composition refuses as a COMPOSITION, not an unknown unit', () => {
  // Keeping these apart is what lets [10] stay a sharp question about the
  // sheet: an unknown unit means teach the owner; a composition means the
  // owner is deliberately declining to pick which half of the dose survives.
  const parsed = parseConditioningDose('3 x 8 min, or 4 x 6 min');
  assert(refusalReason(parsed) === 'composite_dose', `got ${JSON.stringify(parsed)}`);
  // ...while a composition that DOES lead with a unit still parses.
  const blocks = quantity('2 blocks x 5 rounds (5 min per block)');
  assert(blocks.unit === 'blocks' && blocks.min === 2,
    `a leading unit governs even when a composition follows: ${JSON.stringify(blocks)}`);
});

run('[11] the sweep is NON-VACUOUS — most authored doses really do parse', () => {
  const parsedCount = attempted - refusals.length;
  assert(attempted >= 150,
    `only ${attempted} dose cells swept — the sweep is not reading the sheet`);
  assert(parsedCount / attempted >= 0.8,
    `only ${parsedCount}/${attempted} authored doses parsed. A parser that refuses `
    + 'most of the sheet would pass [10] while being useless');
  assert(parsedUnits.size >= 3,
    `only ${parsedUnits.size} distinct unit(s) reached — the sweep is not exercising the parse`);
});

console.log(`\n  Swept ${attempted} authored dose cells across ${
  CONDITIONING_TEMPLATES.length} templates`);
for (const [unit, count] of [...parsedUnits.entries()].sort()) {
  console.log(`    parsed as ${unit.padEnd(10)} ${String(count).padStart(3)}`);
}
for (const reason of ['no_leading_quantity', 'composite_dose'] as const) {
  console.log(`    refused (${reason}) ${
    refusals.filter((entry) => entry.reason === reason).length}`);
}

console.log('\n  NOT COVERED: this owner reads the GOVERNING quantity only. '
  + 'Parenthetical distances, recovery qualifiers ("full recovery"), framework '
  + 'notes and set×rep composition are authored detail it deliberately does not '
  + 'interpret — a consumer needing those asks the sheet, not a second regex.');

console.log(`\nConditioning dose totals: ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) console.log(`FAILURES:\n  ${failures.join('\n  ')}`);
totalsPrinted(failures.length);
