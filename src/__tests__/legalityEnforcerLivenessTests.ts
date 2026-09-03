/**
 * A NAMED ENFORCER MUST BE ALIVE.
 *
 *   npm run test:legality-enforcer-liveness
 *
 * `weeklyLegality`'s LEGALITY_RULES may delegate a clause with
 * `enforcedElsewhere: '<owner>'` instead of a `violated` check. Until
 * 2026-09-03 WC-135 read `enforcedElsewhere: 'appSprintDay placement'` while
 * `appSprintDay` was an exported function with ZERO callers — the note named a
 * ghost, and the existing "names its real owner" cell in
 * `clauseEnforcementTests` was satisfied by any non-empty string. The live
 * owner was `scheduleWeek`'s own app-sprint block (`plannedSprintDay` via
 * `selectFreshSpeedDay`). Found by the weekly-writer census audit
 * (`docs/WEEKLY_WRITER_CENSUS_AUDIT_2026-09-03.md` §4.3.8).
 *
 * THE RULE THIS HOLDS: when a delegation note names a function — a camelCase
 * identifier — that function must be exported from `src/rules` AND called from
 * production code outside its own file. Prose owners ("composer daily movement
 * ceiling", "WC-043 spacing above") are not identifiers and are not checked
 * here; the first identifier in the note is taken as the owner.
 *
 * This is its own suite, not a cell in `clauseEnforcementTests`, because that
 * suite is quarantined (`rewrite_test`: WC-136/WC-138 carry no modality and
 * WC-031 is orphaned) and a live guard may not ride inside a red one.
 */
import fs from 'fs';
import path from 'path';
import { LEGALITY_RULES } from '../rules/weeklyLegality';

let pass = 0;
let fail = 0;
const failures: string[] = [];
function ok(label: string, condition: boolean, detail = ''): void {
  if (condition) { pass += 1; console.log(`  PASS ${label}`); return; }
  fail += 1; failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
  console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

const SRC_DIR = path.join(__dirname, '..');

/** Every production module under src/ (tests, mocks and the dev harness excluded), by relative path. */
function productionSources(root: string): Map<string, string> {
  const found = new Map<string, string>();
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '__tests__', '__mocks__', 'dev'].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (/\.tsx?$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) {
        found.set(path.relative(root, full).split(path.sep).join('/'), fs.readFileSync(full, 'utf8'));
      }
    }
  };
  walk(root);
  return found;
}

/**
 * Pure: is `identifier` a function DEFINED in production source that production
 * source CALLS? A definition with zero call sites is a ghost — exported or not.
 * (WC-062's owner `coachingInputsToSchedulerInputs` is a private function called
 * inside its own module; that is live. `appSprintDay` was exported and called by
 * nobody; that was dead.)
 */
export function enforcerLiveness(
  sources: ReadonlyMap<string, string>,
  identifier: string,
): { defined: boolean; callSites: number; definer: string | null } {
  const definer = [...sources.entries()]
    .find(([, text]) => new RegExp(`(?:^|\\n)\\s*(?:export\\s+)?(?:async\\s+)?function\\s+${identifier}\\b`).test(text)
      || new RegExp(`(?:^|\\n)\\s*(?:export\\s+)?const\\s+${identifier}\\s*=`).test(text));
  if (!definer) return { defined: false, callSites: 0, definer: null };
  let callSites = 0;
  for (const text of sources.values()) {
    const stripped = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    callSites += (stripped.match(new RegExp(`(?<!function\\s)(?<![A-Za-z0-9_$.])${identifier}\\s*\\(`, 'g')) ?? []).length;
  }
  return { defined: true, callSites, definer: definer[0] };
}

/** The first camelCase identifier in a delegation note, or null for prose. */
export function namedEnforcer(note: string): string | null {
  return note.match(/\b[a-z][a-z0-9]*[A-Z][A-Za-z0-9]*\b/)?.[0] ?? null;
}

console.log('\n-- Every named legality enforcer is alive --');

const sources = productionSources(SRC_DIR);
ok('ANCHOR — the check read a real production tree', sources.size > 300, `${sources.size} files`);

/* ── LIVENESS of the instrument itself ─────────────────────────────────── */
const ghost = new Map(sources);
ghost.set('rules/ghostEnforcer.ts', 'export function ghostEnforcer(): null { return null; }\n');
const ghostVerdict = enforcerLiveness(ghost, 'ghostEnforcer');
ok('LIVENESS — an exported function nobody calls is reported dead',
  ghostVerdict.defined && ghostVerdict.callSites === 0, JSON.stringify(ghostVerdict));
const revived = new Map(ghost);
revived.set('rules/ghostCaller.ts', "import { ghostEnforcer } from './ghostEnforcer';\nexport const x = ghostEnforcer();\n");
ok('LIVENESS — the same function with one production call site is reported live',
  enforcerLiveness(revived, 'ghostEnforcer').callSites === 1);
ok('LIVENESS — a name defined nowhere is reported undefined',
  !enforcerLiveness(sources, 'appSprintDay').defined,
  'appSprintDay was deleted on 2026-09-03; if it is back, this cell says so');
ok('the note parser takes the first identifier and ignores prose',
  namedEnforcer('scheduleWeek — app-sprint placement (plannedSprintDay via selectFreshSpeedDay)') === 'scheduleWeek'
    && namedEnforcer('composer daily movement ceiling') === null
    && namedEnforcer('WC-043 spacing above') === null);

/* ── THE RULE, over the real table ─────────────────────────────────────── */
const delegated = LEGALITY_RULES.filter((rule) => rule.enforcedElsewhere);
ok('ANCHOR — the legality table delegates at least one clause', delegated.length > 0);
let named = 0;
for (const rule of delegated) {
  const owner = namedEnforcer(rule.enforcedElsewhere ?? '');
  if (!owner) continue;
  named += 1;
  const verdict = enforcerLiveness(sources, owner);
  ok(`${rule.clauseId} names a LIVE enforcer — ${owner} is defined in production src and called at least once`,
    verdict.defined && verdict.callSites > 0,
    `enforcedElsewhere: ${rule.enforcedElsewhere}; ${JSON.stringify(verdict)}`);
}
ok('ANCHOR — at least one delegation note names a function (WC-135 does)', named > 0);
ok('WC-135 is delegated to scheduleWeek by name',
  delegated.some((rule) => rule.clauseId === 'WC-135' && namedEnforcer(rule.enforcedElsewhere ?? '') === 'scheduleWeek'));

console.log(`\nLegality enforcer liveness: passed=${pass} failures=${fail}`);
if (fail > 0) {
  console.log('FAILURES:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
