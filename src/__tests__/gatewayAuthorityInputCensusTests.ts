/**
 * THE GATEWAY'S AUTHORITY-BEARING INPUTS HAVE A CENSUS, BY CALL SITE.
 *
 * THE CLASS THIS EXISTS TO KILL — named on its second sighting, 2026-08-07:
 * *an authority carried on the WRITE path only, while a new READ path
 * re-derives the same week without it.* Both sightings cost a full pass:
 *
 *   1. `governedFromISO` — the contract's fact horizon. The staging owners
 *      carried it; the safety finaliser and the offer placer never read it,
 *      so tier 4 at READ rewrote days the athlete had already completed
 *      (`docs/R53_TIER4_WRITE_NAMED_SAFETY_FINALISER_2026-08-07.md`).
 *   2. `activeFixtureDates` — the exact-date fixture authority. The staging
 *      owners thread it everywhere; `sessionResolver` had ZERO occurrences of
 *      it, so the expiry guard's `fixture_absent` check degraded to
 *      day-of-week membership in THIS week's contract — structurally false for
 *      any cross-week dependency — and tier 4 at read expired every
 *      fixture-linked derived session the write path deliberately preserved.
 *      That one input explained THREE of the six reds
 *      (`docs/R53_SIX_ROOTS_SETTLED_2026-08-07.md`).
 *
 * Both times the code was correct on the path it was written for and wrong on
 * the path that arrived later, and nothing in the repo could tell. Sighting 2
 * is a mandatory compression under the loop-audit law
 * (`docs/SEAT_LOOP_AUDIT_LAW_2026-08-07.md`), and this is it: the question
 * "does every caller hand the gateway the authority it needs?" gets ASKED by a
 * gate instead of being rediscovered by a tape.
 *
 * THE SHAPE is `369af59d`'s — a DECLARED census, checked in BOTH directions:
 *
 *   - a call site that does not supply the authority and is NOT declared fails
 *     immediately. That is the half that stops the class growing: a new read
 *     path cannot be added silently.
 *   - a DECLARED entry whose call site now DOES supply it ALSO fails, so
 *     paying the debt drops the declaration in the same commit and the census
 *     can never quietly overstate what is owed.
 *
 * Run: npm run test:gateway-authority-census
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function run(name: string, body: () => void): void {
  try {
    body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`  FAIL ${name}: ${(error as Error).message}`);
  }
}

const SRC = join(__dirname, '..');
const GATEWAY_MODULE = 'rules/section18AcceptedWeekGateway.ts';

/**
 * THE AUTHORITY THIS CENSUS COUNTS. It is an INPUT — a fact about the world
 * that only the caller can know — which is exactly why it is forgettable and
 * why forgetting it degrades a guard into a weaker guard rather than an error.
 */
const AUTHORITY = 'activeFixtureDates';

/**
 * DECLARED EXEMPT — call sites that legitimately have no fixture horizon to
 * pass. Each entry names WHY. A product entry here would be a defect waiting
 * to happen; there are none, and the gate below proves that separately.
 *
 * Every entry is a UNIT FIXTURE that hand-builds a contract and asserts on the
 * gateway's own arithmetic. There is no profile, no marked days and no rolling
 * horizon in those worlds, so there is no authority to carry — the guard the
 * input feeds is not what the cell is measuring.
 */
const DECLARED_NO_FIXTURE_HORIZON: Readonly<Record<string, string>> = {
  '__tests__/illnessRecoveryModeTests.ts':
    'hand-built contract; measures illness mode derivation, not fixture expiry',
  '__tests__/powerCountingDifferential/buildCountSnapshot.ts':
    'differential harness over synthetic weeks; no profile horizon exists',
  '__tests__/section18AcceptedWeekGatewayTests.ts':
    "the gateway's own unit cells; each builds the contract it asserts on",
  '__tests__/stageBGenerationDifferential/buildGenerationSnapshot.ts':
    'generation differential over synthetic weeks; no profile horizon exists',
  '__tests__/weekIdentityOwnershipTests.ts':
    'week-identity cells; the rejected candidate is constructed, not resolved',
};

/** A call site inside the owner itself is the declaration or its own re-entry. */
function isTheOwner(relativePath: string): boolean {
  return relativePath === GATEWAY_MODULE;
}

interface CallSite {
  file: string;
  line: number;
  suppliesAuthority: boolean;
}

/** The argument object of a call, sliced by balanced parentheses. */
function callArgument(source: string, openParenIndex: number): string {
  let depth = 0;
  for (let index = openParenIndex; index < source.length; index++) {
    if (source[index] === '(') depth += 1;
    else if (source[index] === ')') {
      depth -= 1;
      if (depth === 0) return source.slice(openParenIndex, index + 1);
    }
  }
  return source.slice(openParenIndex);
}

/**
 * Does this argument object actually PASS the authority?
 *
 * Substring matching is not enough, and the mutation run proved it: renaming
 * the key to `MUTANT_activeFixtureDates` left the substring in place and the
 * gate stayed green. So the test is a property KEY, with comments stripped
 * first — a call site that only mentions the field in prose has not supplied it.
 *
 * Both spellings count, and the second mutation run is why the shorthand is
 * here: `programStore` passes `activeFixtureDates,` and a `key:` -only pattern
 * called the app's own hydration door blind.
 */
function suppliesAuthority(argument: string): boolean {
  const code = argument
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  return new RegExp(
    String.raw`(^|[^A-Za-z0-9_])${AUTHORITY}\s*(:|,|\}|$)`, 'm',
  ).test(code);
}

function gatewayCallSites(): CallSite[] {
  const found: CallSite[] = [];
  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        walk(join(dir, entry.name), relative);
        continue;
      }
      if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue;
      const source = readFileSync(join(dir, entry.name), 'utf8');
      const pattern = /runSection18AcceptedWeekGateway\(/g;
      let match = pattern.exec(source);
      while (match) {
        const openParen = match.index + match[0].length - 1;
        const argument = callArgument(source, openParen);
        found.push({
          file: relative,
          line: source.slice(0, match.index).split('\n').length,
          suppliesAuthority: suppliesAuthority(argument),
        });
        match = pattern.exec(source);
      }
    }
  };
  walk(SRC, '');
  return found.filter((site) => !isTheOwner(site.file))
    .sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line);
}

const isProduct = (file: string): boolean =>
  !file.startsWith('__tests__/') && !file.startsWith('dev/');

console.log('\nGateway authority-input census\n');

run('the scan finds gateway call sites at all (non-vacuity)', () => {
  const sites = gatewayCallSites();
  assert(sites.length > 0,
    'the walker found no calls to runSection18AcceptedWeekGateway at all — the '
    + 'scan or the pattern is broken, and a gate that cannot fail is not a gate');
  assert(sites.some((site) => site.suppliesAuthority),
    `no call site supplies \`${AUTHORITY}\` — the detector cannot tell the two `
    + 'states apart, so a green result here would mean nothing');
  assert(sites.some((site) => !site.suppliesAuthority),
    `every call site supplies \`${AUTHORITY}\` — the detector has never seen a `
    + 'negative, so its negative half is unproven');
});

run(`every PRODUCT call site hands the gateway \`${AUTHORITY}\``, () => {
  const blind = gatewayCallSites()
    .filter((site) => isProduct(site.file) && !site.suppliesAuthority);
  assert(blind.length === 0,
    `${blind.length} product call site(s) run the §18 gateway without `
    + `\`${AUTHORITY}\`: ${blind.map((site) => `${site.file}:${site.line}`).join(', ')}. `
    + 'This is the authority-carried-on-the-write-path-only class — the expiry '
    + "guard degrades to day-of-week membership in THIS week's contract and "
    + 'kills every cross-week fixture-linked session. Derive the authority from '
    + 'the facts the caller already carries (profile + markedDays), as the '
    + 'tier-4 host does, or declare the exemption with its reason.');
});

run('the census is EXACT — no undeclared blind caller', () => {
  const undeclared = gatewayCallSites()
    .filter((site) => !site.suppliesAuthority)
    .filter((site) => !(site.file in DECLARED_NO_FIXTURE_HORIZON));
  assert(undeclared.length === 0,
    `${undeclared.length} call site(s) omit \`${AUTHORITY}\` without being `
    + `declared: ${undeclared.map((site) => `${site.file}:${site.line}`).join(', ')}. `
    + 'Supply the authority, or add the file to DECLARED_NO_FIXTURE_HORIZON '
    + 'with the reason it has no fixture horizon to carry.');
});

run('the census is EXACT the other way — no stale declaration', () => {
  const blindFiles = new Set(gatewayCallSites()
    .filter((site) => !site.suppliesAuthority)
    .map((site) => site.file));
  const stale = Object.keys(DECLARED_NO_FIXTURE_HORIZON)
    .filter((file) => !blindFiles.has(file));
  assert(stale.length === 0,
    `${stale.length} declared entr(y/ies) no longer omit \`${AUTHORITY}\`: `
    + `${stale.join(', ')}. The declaration drops in the SAME commit that pays `
    + 'the debt, or the census overstates what is owed.');
});

/**
 * THE OTHER MEMBER OF THE CLASS, and the reason this file says "inputs" rather
 * than naming one field. `governedFromISO` cannot be censused by call site — it
 * rides INSIDE the contract, so every caller carries it whether they know it or
 * not. The two writers that ignored it were fixed structurally instead: the
 * boundary is read ONCE, where the mutable day-set is assembled, and every
 * writer downstream receives only governable days.
 *
 * That is a stronger guarantee than a census, and this cell pins it: if a
 * second reader of `governedFromISO` ever appears inside the gateway, the
 * one-owner property has silently become a two-owner property and the class is
 * back — at which point this file's census shape is the answer for it too.
 */
run('`governedFromISO` has exactly ONE owner inside the gateway', () => {
  const source = readFileSync(join(SRC, GATEWAY_MODULE), 'utf8');
  // A READ is a property ACCESS. The field also appears in the local cast that
  // types it and in prose above it, and counting those made this cell red on
  // its first run against a boundary that has exactly one owner — the
  // gate-passing-on-coordinates-it-never-builds shape, inverted.
  const readers = source.split('\n')
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => /\.governedFromISO\b/.test(line) &&
      !line.trimStart().startsWith('*') && !line.trimStart().startsWith('//'));
  // Non-vacuity: the detector has to be able to see the read it is counting.
  assert(readers.length > 0,
    'no property read of `governedFromISO` found inside the gateway at all — '
    + 'either the boundary is gone or this detector no longer matches it');
  assert(readers.length === 1,
    `\`governedFromISO\` is read at ${readers.length} place(s) inside the `
    + `gateway (line(s) ${readers.map(({ number }) => number).join(', ')}); the `
    + 'boundary ruling makes it exactly one, at the candidate assembly. A '
    + 'second reader means a writer is being trusted to know the law again.');
});

/**
 * `surfaces` is the third member, and it is enforced by the COMPILER — it was
 * optional, six doors forgot it, and making it required killed the class
 * outright (`docs/SURFACES_CONTEXT_RULING_2026-08-06.md`). Pinned here so the
 * three members of the class are visible in one place with the mechanism that
 * holds each: compiler / census / one-owner.
 */
run('`surfaces` stays REQUIRED on the gateway input', () => {
  const source = readFileSync(join(SRC, GATEWAY_MODULE), 'utf8');
  assert(/\n\s+surfaces: AcceptedEffectiveWeekSurfaces;/.test(source),
    'the gateway input no longer declares `surfaces` as a required field. '
    + 'Optional is what made it forgettable — 328 measured entries where the '
    + 'gateway was told the athlete had binned nothing while their bin sat full.');
});

console.log(`\nGateway authority census totals: ${passed} passed, ${failed} failed\n`);
totalsPrinted(failed);
process.exit(failed === 0 ? 0 : 1);
