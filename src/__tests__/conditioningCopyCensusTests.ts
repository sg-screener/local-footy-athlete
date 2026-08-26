/**
 * ── THE ATHLETE-FACING CONDITIONING COPY CENSUS ───────────────────────────
 *
 * Run: npx sucrase-node src/__tests__/conditioningCopyCensusTests.ts
 *
 * **Sam, 2026-08-20 (R-117):** *"Add a census that renders every authored
 * Conditioning session and fails on malformed percentage ranges, missing
 * punctuation, internal/debug vocabulary or incorrect pace units."*
 *
 * ## WHY A CENSUS AND NOT A HANDFUL OF CELLS
 *
 * The defect Sam photographed — `90 100%`, `max late`, a km/h number labelled as
 * a pace, and three lines of authoring metadata — was never a defect of ONE
 * card. It was the projection's, so every one of the sheet's templates carried
 * it and only one was on screen. A cell per template would have to be written
 * again for every template added; **this file enumerates
 * `CONDITIONING_TEMPLATES` itself, so a new template is audited the day it is
 * authored and a new defect cannot hide behind the one card nobody screenshots.**
 *
 * ⚠ **IT READS THE PROJECTION, NOT THE SHEET.** Every assertion runs over
 * `conditioningDisplayLines` and `personalPaceLine` — the exact owners the two
 * athlete surfaces render. A census over the raw fields would go green on a
 * formatter that mangles them.
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — the copy census must be deterministic');
};

import { CONDITIONING_TEMPLATES } from '../data/conditioningTemplates';
import {
  conditioningDisplayLines,
  CONDITIONING_INTERNAL_TERMS,
  paceMinPerKm,
  type ConditioningDisplayLine,
} from '../rules/conditioningDisplay';
import { personalPaceLine } from '../rules/masPace';
import { cleanNotes } from '../screens/home/dayWorkoutHelpers';

let pass = 0;
let fail = 0;
const failures: string[] = [];
function ok(name: string, cond: boolean, detail?: string) {
  if (cond) { pass += 1; console.log(`  ✓ ${name}`); }
  else { fail += 1; failures.push(name); console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`); }
}

const EN_DASH = '–';

/** Every line every athlete can read, tagged with the template it came from. */
interface Rendered {
  readonly name: string;
  readonly lines: readonly ConditioningDisplayLine[];
  readonly paceLine: string | null;
}

// A real measured athlete: a 2 km time trial of 8:00 → MAS 15 km/h. The pace
// line is only reachable with a time trial on file, so the census carries one.
const TRIAL = { seconds: 480 } as never;

const rendered: Rendered[] = (CONDITIONING_TEMPLATES as readonly never[]).map((t) => {
  const template = t as unknown as { name: string; intensity?: string };
  const pace = personalPaceLine({
    intensityText: template.intensity ?? '',
    answer: TRIAL,
    experienceLevel: '5+ years' as never,
  } as never);
  /* ⚠ **THROUGH `cleanNotes`, BECAUSE THE SCREEN RENDERS `cleanNotes(notes)`.**
   * The first cut of this census read `conditioningDisplayLines` directly and
   * went 35/35 green while the simulator showed `Intensity: 90 100% MAS` — the
   * exact line Sam rejected. The projection was right and the RENDERER ate the
   * en dash. A census that stops one call short of the glass measures the
   * sheets, not what the athlete reads. */
  const projected = conditioningDisplayLines({ template: t as never });
  const rendered = (cleanNotes(projected.map((l) => (l.label ? `${l.label}: ${l.text}` : l.text)).join('\n')) ?? '').split('\n');
  return {
    name: template.name,
    lines: projected.map((l, i) => {
      const shown = rendered[i] ?? '';
      const text = l.label && shown.startsWith(`${l.label}: `) ? shown.slice(l.label.length + 2) : shown;
      return { label: l.label, text };
    }),
    paceLine: pace == null ? null : String(pace),
  };
});

console.log(`\nCONDITIONING COPY CENSUS — ${rendered.length} authored templates\n`);

// ── NON-VACUITY ────────────────────────────────────────────────────────────
// A census over an empty list passes every criterion below. Two controls, so a
// broken import or a renamed export reds here rather than reporting a clean
// sweep of nothing.
ok('control: the census enumerates the whole authored sheet',
  rendered.length >= 20, `saw ${rendered.length}`);
ok('control: every template renders at least a Work line and a cue',
  rendered.every((r) => r.lines.some((l) => l.label === 'Work') && r.lines.some((l) => l.label === null)),
  rendered.filter((r) => !r.lines.some((l) => l.label === null)).map((r) => r.name).join(' | '));

const all = (r: Rendered) => r.lines.map((l) => (l.label ? `${l.label}: ${l.text}` : l.text));
const report = (bad: { name: string; line: string }[]) =>
  bad.slice(0, 8).map((b) => `${b.name} :: ${b.line}`).join('\n      ');

function sweep(criterion: string, predicate: (line: string, label: string | null) => boolean) {
  const bad: { name: string; line: string }[] = [];
  for (const r of rendered) {
    for (const l of r.lines) {
      const text = l.label ? `${l.label}: ${l.text}` : l.text;
      if (predicate(l.text, l.label)) bad.push({ name: r.name, line: text });
    }
  }
  ok(criterion, bad.length === 0, `${bad.length} line(s):\n      ${report(bad)}`);
}

// ── 1. PERCENTAGE RANGES ───────────────────────────────────────────────────
// `90 100%` — the shipped defect. A range separated by a space or a hyphen is
// not a range; it is two numbers the athlete has to guess the relationship of.
sweep(`percentage ranges use an en dash, never a space (\`90 100%\`)`,
  (text) => /\d\s+\d+\s*%/.test(text));
sweep('percentage ranges use an en dash, never a hyphen (`90-100%`)',
  (text) => /\d\s*-\s*\d+\s*%/.test(text));

// ── 2. PACE UNITS ──────────────────────────────────────────────────────────
// Sam: *"Do not relabel km/h values as min/km."* A speed may never appear on a
// line the athlete reads as a pace, and the pace itself is `m:ss min/km`.
sweep('no km/h speed reaches an athlete-facing line',
  (text) => /km\s*\/\s*h|kmh|km per hour/i.test(text));
{
  const shaped = new RegExp(`^Your pace: \\d:[0-5]\\d(?:${EN_DASH}\\d:[0-5]\\d)? min/km$`);
  const withPace = rendered.filter((r) => r.paceLine !== null);
  ok('control: MAS-referencing templates do produce a pace line',
    withPace.length >= 10, `${withPace.length} of ${rendered.length}`);
  const bad = withPace.filter((r) => !shaped.test(r.paceLine as string));
  ok(`every pace line reads \`m:ss${EN_DASH}m:ss min/km\``,
    bad.length === 0, bad.slice(0, 6).map((r) => `${r.name} :: ${r.paceLine}`).join('\n      '));
}
// The arithmetic itself, against Sam's stated formula rather than my own code.
ok('pace is `60 / kmh` rounded to the nearest second',
  paceMinPerKm(15) === '4:00' && paceMinPerKm(13.5) === '4:27' && paceMinPerKm(20) === '3:00',
  `${paceMinPerKm(15)} | ${paceMinPerKm(13.5)} | ${paceMinPerKm(20)}`);

// ── 3. LABELS ──────────────────────────────────────────────────────────────
const APPROVED_LABELS = ['Work', 'Recovery', 'Rounds', 'Reps', 'Sets', 'Blocks', 'Intensity'];
sweep('every label is an approved athlete-facing word',
  (_text, label) => label !== null && !APPROVED_LABELS.includes(label));
{
  const bad = rendered.filter((r) => {
    const recovery = r.lines.find((l) => l.label === 'Recovery');
    const sets = r.lines.find((l) => l.label === 'Sets');
    return Boolean(recovery) && Boolean(sets);
  });
  ok('interval work counts Rounds, never `Sets` (Sam: not "Sets: 4 reps")',
    bad.length === 0, bad.map((r) => r.name).join(' | '));
}
// `Rounds: 6–8 reps` says "rounds" and "reps" about one number. A bare quantity
// carries no unit word; a COMPOUND dose (`3 sets × 5 reps`) keeps every word,
// because there the units distinguish two different things.
sweep('a bare dose quantity carries no redundant unit word',
  (text, label) => label !== null && APPROVED_LABELS.includes(label)
    && /^[\d\s–\-]+\s*(reps?|rounds?|sets?|blocks?)$/i.test(text));

// ── 4. SENTENCES ───────────────────────────────────────────────────────────
// The cue is prose; the labelled dose lines are not.
const isProse = (label: string | null) => label === null;
sweep('every prose line ends in a full stop',
  (text, label) => isProse(label) && text.length > 0 && !/[.!?]$/.test(text));
sweep('every prose line starts with a capital',
  (text, label) => isProse(label) && text.length > 0 && /^[a-z]/.test(text));
/* A COMMA SPLICE IS A COMMA JOINING TWO INDEPENDENT CLAUSES WITH NO
 * CONJUNCTION — and the naive `, don't` test calls four sentences guilty that
 * are not. `If set 3 falls apart, that's the end point.` and `If you have to
 * open your mouth to breathe, you're going too hard.` are conditionals: the
 * comma is doing exactly its job. So each segment is tested only when it does
 * NOT open with a subordinator, which is what makes the leading clause
 * dependent. */
const SUBORDINATOR = /^(if|when|unless|because|though|although|while|as|after|before|since|once|until|whenever|where)\b/i;
sweep('no comma splice',
  (text) => text
    .split(/[.;—]/)
    .some((segment) => {
      const clause = segment.trim();
      if (!clause || SUBORDINATOR.test(clause)) return false;
      return /,\s+(don't|do not|it's|that's|this is|you're|we're|keep|hold)\b/i.test(clause);
    }));

/* ── THE WELDED HEART-RATE CLAUSE ────────────────────────────────────────
 * `Intensity: 90–100% MAS; HR 90–95% max late` was the shipped line. Two
 * different measurements welded with a semicolon, the second in note-form —
 * `HR`, `max`, `late` — with no verb telling the athlete what to do with it.
 *
 * ⚠ **THIS CELL EXISTS BECAUSE THE CENSUS DID NOT CATCH IT.** Restoring the
 * un-split intensity field passed all 33 cells: the line has en dashes, no
 * internal words, and lives under an approved label, so every criterion above
 * looked away. A heart-rate target must reach the athlete as a sentence under
 * its own label or not at all. */
sweep('no abbreviated heart-rate note survives on a dose line',
  /* `HR`, `HRmax` and `max late` are note-form and unambiguous. `95–100% max
   * velocity` is NOT one of them — it is a complete speed target and a broader
   * `% max` pattern called both Fly sessions defective. The rule names the
   * abbreviation, not the percent sign. */
  (text, label) => label !== 'Heart rate' && /\bHR\b|\bHRmax\b|\bmax late\b/i.test(text));
sweep('no heart-rate line reaches a conditioning card',
  (_text, label) => label === 'Heart rate');

// ── 5. INTERNAL VOCABULARY ─────────────────────────────────────────────────
// Every one of these is a real word lifted from the sheet's maintenance notes.
const EXTRA_INTERNAL = ['COD', 'ergos', 'duration menu', 'convention', 'D12', 'time native'];
for (const term of [...CONDITIONING_INTERNAL_TERMS, ...EXTRA_INTERNAL]) {
  const re = new RegExp(`(^|[^\\w-])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\w-]|$)`, 'i');
  const bad: { name: string; line: string }[] = [];
  for (const r of rendered) for (const l of all(r)) if (re.test(l)) bad.push({ name: r.name, line: l });
  ok(`no athlete reads the internal word "${term}"`, bad.length === 0, report(bad));
}
// An authoring signature is not coaching.
sweep('no authoring attribution reaches the athlete',
  (text) => /\bSam\b/.test(text));

// ── 6. NUMBER / UNIT SPACING ───────────────────────────────────────────────
sweep('a number and its unit are separated by one space',
  (text) => /\d(min|sec|km|kg|s)\b/.test(text.replace(/\d+:\d+/g, '')));

console.log(`\nSummary: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  failures.forEach((name) => console.log(`  - ${name}`));
  process.exit(1);
}
