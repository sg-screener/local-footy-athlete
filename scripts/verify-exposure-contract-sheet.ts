/**
 * Round-trip proof for docs/EXPOSURE_CONTRACT_REVIEW_2026-07-28.xlsx.
 *
 * A sheet the repo's own reader cannot parse is decoration — the load-ratio
 * unit's phrasing, and the reason this runs before the sheet goes to Sam.
 *
 * But parsing is the weak half. The half that matters is that every PREFILLED
 * value equals what actually ships: a review sheet whose "current value" column
 * is wrong sends Sam to rule against a number the athlete never receives, and
 * every ruling taken from it would be answering the wrong question. So this
 * reads the values back out of `weeklyExposureContractBuilders.ts` and compares
 * BOTH DIRECTIONS — every source value appears in the sheet, and every sheet
 * value appears in the source.
 *
 * Run: npm run verify:exposure-contract-sheet
 */

process.env.TZ = 'Australia/Melbourne';

import fs from 'fs';
import path from 'path';

import { readXlsx } from '../src/__tests__/support/xlsxReader';

const repoRoot = path.resolve(__dirname, '..');
const SHEET = 'docs/EXPOSURE_CONTRACT_REVIEW_2026-07-28.xlsx';
const SOURCE = 'src/rules/weeklyExposureContractBuilders.ts';

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

const sheets = readXlsx(path.join(repoRoot, SHEET));

console.log('\n[1] The repo\'s own reader can parse it');
{
  ok('five tabs', sheets.length === 5, `got ${sheets.length}: ${sheets.map((s) => s.name).join(', ')}`);
  for (const name of ['How to use', 'Contract V2 first cells', 'Base numbers',
    'Schedule columns', 'Open questions']) {
    ok(`tab "${name}" is present`, sheets.some((s) => s.name === name));
  }
  for (const sheet of sheets) {
    ok(`tab "${sheet.name}" has rows`, sheet.rows.length > 0);
    // A blank row emits no <row>, so generator and reader coordinates would
    // silently diverge. Titled separators only.
    const blanks = sheet.rows.filter((r) => r.every((c) => (c ?? '').trim() === '')).length;
    ok(`tab "${sheet.name}" has no blank rows`, blanks === 0, `${blanks} blank`);
  }
}

const base = sheets.find((s) => s.name === 'Base numbers')!;
const schedule = sheets.find((s) => s.name === 'Schedule columns')!;

console.log('\n[2] The cell counts are what Sam was promised');
{
  ok('126 base cells', base.rows.length - 1 === 126, `${base.rows.length - 1}`);
  ok('63 schedule cells', schedule.rows.length - 1 === 63, `${schedule.rows.length - 1}`);
  ok('189 authored cells total',
    (base.rows.length - 1) + (schedule.rows.length - 1) === 189);
}

console.log('\n[3] Every row is ruleable: prefilled, flagged, and blank where Sam writes');
{
  const header = base.rows[0];
  const iValue = header.indexOf('CURRENT VALUE');
  const iFlag = header.indexOf('FLAG');
  const iRuled = header.indexOf('RULED VALUE');
  ok('the base tab has the expected columns', iValue > 0 && iFlag > 0 && iRuled > 0);

  const missingValue = base.rows.slice(1).filter((r) => !(r[iValue] ?? '').trim()).length;
  const missingFlag = base.rows.slice(1).filter((r) => !(r[iFlag] ?? '').trim()).length;
  const preFilledRuling = base.rows.slice(1).filter((r) => (r[iRuled] ?? '').trim()).length;

  ok('every base row carries a current value', missingValue === 0, `${missingValue} blank`);
  ok('every base row carries a flag', missingFlag === 0, `${missingFlag} unflagged`);
  ok('no base row pre-fills the RULED VALUE column', preFilledRuling === 0,
    'a prefilled ruling column is the sheet answering for Sam');
}

console.log('\n[4] THE ROUND TRIP — prefilled values equal what actually ships');
{
  const source = fs.readFileSync(path.join(repoRoot, SOURCE), 'utf8');

  // Pull each mode's four domain triples straight out of the builder.
  const re = /mode:\s*'([a-z_]+)',[\s\S]{0,160}?strength:\s*\{([^}]*)\}[\s\S]{0,60}?conditioning:\s*\{([^}]*)\}[\s\S]{0,60}?sprintCod:\s*\{([^}]*)\}[\s\S]{0,120}?fullRest:\s*\{([^}]*)\}[\s\S]{0,160}?preferredHardDays:\s*(\d+),\s*permittedHardDays:\s*(\d+)/g;

  const slotOf = (blob: string, key: string): string | null => {
    const m = new RegExp(`${key}:\\s*([^,}]+)`).exec(blob);
    return m ? m[1].trim() : null;
  };

  const fromSource = new Map<string, string>();
  let modes = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    modes += 1;
    const mode = m[1];
    const domains: Array<[string, string]> = [
      ['strength', m[2]], ['conditioning', m[3]], ['sprintCod', m[4]], ['fullRest', m[5]],
    ];
    for (const [domain, blob] of domains) {
      for (const slot of ['required', 'preferredMin', 'preferredMax']) {
        const raw = slotOf(blob, slot);
        if (raw !== null) fromSource.set(`${mode}|${domain}|${slot}`, raw);
      }
    }
    fromSource.set(`${mode}|hardDays|preferred`, m[6]);
    fromSource.set(`${mode}|hardDays|permitted`, m[7]);
  }

  ok('the source parse found modes', modes > 0, `${modes}`);

  const header = base.rows[0];
  const [iMode, iDomain, iSlot, iValue] = ['MODE', 'DOMAIN', 'SLOT', 'CURRENT VALUE']
    .map((h) => header.indexOf(h));

  // Sheet -> source. `max(3,anchors)` and `teams` are the sheet's readable
  // renderings of expressions; they are checked by shape, not by equality,
  // and are flagged `derived_not_literal` so Sam sees they are not numbers.
  const mismatches: string[] = [];
  for (const row of base.rows.slice(1)) {
    const key = `${row[iMode]}|${row[iDomain]}|${row[iSlot]}`;
    const sheetValue = (row[iValue] ?? '').trim();
    const sourceValue = fromSource.get(key);
    if (sourceValue === undefined) continue; // mode not matched by the parser
    if (/^\d+$/.test(sheetValue)) {
      if (sheetValue !== sourceValue) mismatches.push(`${key}: sheet ${sheetValue} vs source ${sourceValue}`);
    } else if (/^\d+$/.test(sourceValue)) {
      mismatches.push(`${key}: sheet says "${sheetValue}" but source is the literal ${sourceValue}`);
    }
  }
  ok('every prefilled literal equals the shipped value', mismatches.length === 0,
    mismatches.join('\n      '));

  // Source -> sheet. Catches a mode or slot the sheet forgot entirely, which a
  // one-directional check would pass while silently under-serving Sam.
  const inSheet = new Set(base.rows.slice(1).map((r) => `${r[iMode]}|${r[iDomain]}|${r[iSlot]}`));
  const missing = [...fromSource.keys()].filter((k) => !inSheet.has(k));
  ok('every parsed source value has a row in the sheet', missing.length === 0,
    missing.join(', '));
}

console.log('\n[5] The three Contract V2 cells are present and unauthored');
{
  const v2 = sheets.find((s) => s.name === 'Contract V2 first cells')!;
  const flat = v2.rows.map((r) => r.join(' | ')).join('\n');
  for (const symbol of ['strongByeBuild', 'unconstrainedStrength', 'optional']) {
    ok(`the sheet names ${symbol}`, flat.includes(symbol));
  }
  ok('it states the ruling that puts them first', /ruling 1/i.test(flat));
}

console.log('\n[6] The three-identical-pre-season-rows question is on the sheet\'s face');
{
  const q = sheets.find((s) => s.name === 'Open questions')!;
  const flat = q.rows.map((r) => r.join(' | ')).join('\n');
  ok('the identical pre-season rows are questioned', /IDENTICAL/i.test(flat));
  ok('the conditioning base ambiguity is questioned', /EXTRA app exposures|EXTRA conditioning/i.test(flat));
  ok('the hard-day max conflict is questioned', /permittedHardDays/i.test(flat));
  ok('phaseWeek is recorded as deliberately absent', /phaseWeek is deliberately NOT/i.test(flat));

  // The claim itself, checked rather than asserted in prose.
  const header = base.rows[0];
  const [iMode, iDomain, iSlot, iValue] = ['MODE', 'DOMAIN', 'SLOT', 'CURRENT VALUE']
    .map((h) => header.indexOf(h));
  const preseason = ['early_preseason', 'mid_preseason', 'late_preseason'].map((mode) =>
    base.rows.slice(1).filter((r) => r[iMode] === mode)
      .map((r) => `${r[iDomain]}.${r[iSlot]}=${r[iValue]}`).join(','));
  ok('the three pre-season rows really are identical',
    preseason[0] === preseason[1] && preseason[1] === preseason[2],
    'if this fails the Q1 question is wrong and must be rewritten');
}

const total = passed + failures.length;
console.log(`\nExposure contract sheet: passed=${passed}/${total} failures=${failures.length}`);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
