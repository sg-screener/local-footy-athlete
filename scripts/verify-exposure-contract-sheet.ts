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

console.log('\n[2] The cell counts, after Q1 collapsed the pre-season rows');
{
  // 189 was the pre-ruling figure, at nine modes. Sam's Q1 ruled the three
  // identical pre-season rows into ONE, so the authored sheet is seven modes:
  // 7 x 14 = 98 base, 7 x 7 = 49 schedule. The shrink IS the ruling landing.
  ok('98 base cells', base.rows.length - 1 === 98, `${base.rows.length - 1}`);
  ok('49 schedule cells', schedule.rows.length - 1 === 49, `${schedule.rows.length - 1}`);
  ok('147 authored cells total',
    (base.rows.length - 1) + (schedule.rows.length - 1) === 147);
}

console.log('\n[3] Every row is AUTHORED: a ruled value, a flag, and a ruling date');
{
  const header = base.rows[0];
  const iValue = header.indexOf('RULED VALUE');
  const iFlag = header.indexOf('FLAG');
  const iStatus = header.indexOf('STATUS');
  ok('the base tab has the expected columns', iValue > 0 && iFlag > 0 && iStatus > 0);

  const missingValue = base.rows.slice(1).filter((r) => !(r[iValue] ?? '').trim()).length;
  const missingFlag = base.rows.slice(1).filter((r) => !(r[iFlag] ?? '').trim()).length;
  const unruled = base.rows.slice(1).filter((r) => !/RULED/.test(r[iStatus] ?? '')).length;

  ok('every base row carries a ruled value', missingValue === 0, `${missingValue} blank`);
  ok('every base row carries a flag', missingFlag === 0, `${missingFlag} unflagged`);
  ok('every base row is marked ruled', unruled === 0,
    `${unruled} rows are not marked ruled — an unruled cell in an AUTHORED sheet is the `
    + 'absence-rendered-as-approval defect this whole unit exists to remove');
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
  const [iMode, iDomain, iSlot, iValue] = ['MODE', 'DOMAIN', 'SLOT', 'RULED VALUE']
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

  // THE HOLE THIS CLOSES. Collapsing pre-season onto a spread (`...PRE_SEASON_
  // TARGETS`) removed its literals from the inline shape the parser above
  // matches — so the pre-season row silently stopped being compared at all. The
  // Q1 fix would have quietly un-gated the very cells it authored. Compared
  // explicitly against the one authored object instead.
  const targets = /const PRE_SEASON_TARGETS = \{([\s\S]*?)\n\} as const;/.exec(source);
  ok('PRE_SEASON_TARGETS is readable', !!targets);
  if (targets) {
    const blob = targets[1];
    const domainBlob = (d: string): string =>
      new RegExp(`${d}:\\s*\\{([^}]*)\\}`).exec(blob)?.[1] ?? '';
    const expected: Record<string, string> = {};
    for (const domain of ['strength', 'conditioning', 'sprintCod', 'fullRest']) {
      for (const slot of ['required', 'preferredMin', 'preferredMax']) {
        const v = slotOf(domainBlob(domain), slot);
        if (v !== null) expected[`${domain}|${slot}`] = v;
      }
    }
    expected['hardDays|preferred'] = /preferredHardDays:\s*(\d+)/.exec(blob)?.[1] ?? '';
    expected['hardDays|permitted'] = /permittedHardDays:\s*(\d+)/.exec(blob)?.[1] ?? '';

    const sheetPreseason = new Map(base.rows.slice(1)
      .filter((r) => r[iMode] === 'preseason')
      .map((r) => [`${r[iDomain]}|${r[iSlot]}`, (r[iValue] ?? '').trim()]));

    ok('the pre-season row has all 14 slots', sheetPreseason.size === 14,
      `${sheetPreseason.size}`);

    const preMismatch: string[] = [];
    for (const [key, value] of Object.entries(expected)) {
      const sheetValue = sheetPreseason.get(key);
      if (sheetValue !== value) preMismatch.push(`${key}: sheet ${sheetValue} vs code ${value}`);
    }
    ok('the authored pre-season row equals PRE_SEASON_TARGETS', preMismatch.length === 0,
      preMismatch.join('\n      '));
  }
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
  const [iMode, iDomain, iSlot, iValue] = ['MODE', 'DOMAIN', 'SLOT', 'RULED VALUE']
    .map((h) => header.indexOf(h));
  // Q1 is now RULED, so the assertion inverts: there must be exactly ONE
  // pre-season row, and the three enum modes must reference it in code rather
  // than restating it. Three copies of one decision are three chances to edit
  // one and not the others, which is what this ruling removed.
  const preseasonRows = new Set(base.rows.slice(1)
    .filter((r) => /preseason/.test(r[iMode])).map((r) => r[iMode]));
  ok('there is exactly one authored pre-season row', preseasonRows.size === 1,
    `found: ${[...preseasonRows].join(', ')}`);

  const builders = fs.readFileSync(path.join(repoRoot, SOURCE), 'utf8');
  ok('the code has a single pre-season target object',
    /const PRE_SEASON_TARGETS/.test(builders));
  for (const mode of ['early_preseason', 'mid_preseason', 'late_preseason']) {
    const block = new RegExp(`\\.\\.\\.PRE_SEASON_TARGETS, mode: '${mode}'`);
    ok(`${mode} references the one authored row`, block.test(builders),
      'a subphase that restates the numbers is a second representation');
  }
}

const total = passed + failures.length;
console.log(`\nExposure contract sheet: passed=${passed}/${total} failures=${failures.length}`);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
