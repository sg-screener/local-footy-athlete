/**
 * THE SELECTION-TRACE TAP HAS NO PRODUCTION OBSERVER — and may not grow one
 * without this suite going red.
 *
 * `publishAutomaticProgrammingSelectionTraces` (src/rules/programmingSelectionTrace.ts)
 * is called from inside the canonical compiler and from the render-time
 * Mobility & Prehab flow. It hands every automatic content decision to a
 * module-level observer. Production has no observer by design: the tap exists
 * for lived audits (`scripts/*.cjs`) and tests. The writer census cannot see the
 * tap at all (it is neither a domain construct nor a persistence sink), so the
 * day a screen or store installs an observer, the compiler chain would have a
 * silent second consumer of derived content and nothing would red
 * (`docs/WEEKLY_WRITER_CENSUS_AUDIT_2026-09-03.md` §4.3.7).
 *
 * Two halves, both required:
 *  - STATIC: no production file under `src/` (or the app roots) mentions the
 *    installer or the private observer slot; the defining module keeps the slot
 *    module-private. The scan is a pure function so the suite can prove, in the
 *    same run, that a planted installer would be caught (a source scan that is
 *    never shown a positive is a count, not a gate).
 *  - RUNTIME: with nothing installed, publishing is inert; an installed
 *    observer's disposer returns the tap to inert.
 */
import fs from 'fs';
import path from 'path';
import {
  installAutomaticProgrammingSelectionTraceObserver,
  publishAutomaticProgrammingSelectionTraces,
  type AutomaticProgrammingSelectionTrace,
} from '../rules/programmingSelectionTrace';

const ROOT = path.join(__dirname, '..', '..');
const DEFINING_FILE = 'src/rules/programmingSelectionTrace.ts';
const INSTALLER = 'installAutomaticProgrammingSelectionTraceObserver';
const SLOT = 'activeTraceObserver';
const PUBLISHER = 'publishAutomaticProgrammingSelectionTraces';

let pass = 0;
let fail = 0;
const failures: string[] = [];
function ok(label: string, condition: boolean, detail = ''): void {
  if (condition) { pass += 1; console.log(`  PASS ${label}`); return; }
  fail += 1; failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
  console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

/** Every production source under src/ plus the app roots; tests and mocks excluded. */
function productionSources(root: string): Map<string, string> {
  const found = new Map<string, string>();
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '__tests__', '__mocks__'].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (/\.[cm]?[jt]sx?$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) {
        found.set(path.relative(root, full).split(path.sep).join('/'), fs.readFileSync(full, 'utf8'));
      }
    }
  };
  walk(path.join(root, 'src'));
  for (const name of ['App.tsx', 'App.js', 'index.ts', 'index.js']) {
    const full = path.join(root, name);
    if (fs.existsSync(full)) found.set(name, fs.readFileSync(full, 'utf8'));
  }
  return found;
}

interface ObserverAudit {
  readonly definerFound: boolean;
  readonly definerExportsInstaller: boolean;
  readonly definerHasPublisher: boolean;
  readonly slotDeclaredPrivate: boolean;
  /** `file:line` of every mention of the installer outside its definition. */
  readonly installerMentions: readonly string[];
  /** `file:line` of every mention of the observer slot outside the definer. */
  readonly slotMentions: readonly string[];
}

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split('\n').length;
}

function mentions(sources: ReadonlyMap<string, string>, word: string, skipFile: string | null): string[] {
  const hits: string[] = [];
  const pattern = new RegExp(`\\b${word}\\b`, 'g');
  for (const [file, text] of sources) {
    if (file === skipFile) continue;
    for (const match of text.matchAll(pattern)) hits.push(`${file}:${lineOf(text, match.index ?? 0)}`);
  }
  return hits;
}

/** Pure: the static half of the guard over a file map. Exported for the mutation cells. */
export function auditTraceObserverInstallers(sources: ReadonlyMap<string, string>): ObserverAudit {
  const definer = sources.get(DEFINING_FILE) ?? null;
  return {
    definerFound: definer !== null,
    definerExportsInstaller: definer !== null && new RegExp(`export function ${INSTALLER}\\(`).test(definer),
    definerHasPublisher: definer !== null && new RegExp(`export function ${PUBLISHER}\\(`).test(definer),
    slotDeclaredPrivate: definer !== null
      && new RegExp(`^let ${SLOT}\\b`, 'm').test(definer)
      && !new RegExp(`export\\s+(let|const|var)\\s+${SLOT}\\b`).test(definer)
      && !new RegExp(`export\\s*\\{[^}]*\\b${SLOT}\\b`).test(definer),
    installerMentions: mentions(sources, INSTALLER, DEFINING_FILE),
    slotMentions: mentions(sources, SLOT, DEFINING_FILE),
  };
}

console.log('\n-- The selection-trace tap has no production observer --');

/* ── STATIC, on the real tree ─────────────────────────────────────────────── */
const sources = productionSources(ROOT);
ok('SETUP — the scan read a real production tree', sources.size > 300, `${sources.size} files`);
const audit = auditTraceObserverInstallers(sources);
ok('ANCHOR — the defining module was found and exports the installer and the publisher',
  audit.definerFound && audit.definerExportsInstaller && audit.definerHasPublisher,
  JSON.stringify({ found: audit.definerFound, installer: audit.definerExportsInstaller, publisher: audit.definerHasPublisher }));
ok('the observer slot is a module-private `let` in the defining module, never exported',
  audit.slotDeclaredPrivate);
ok('no production file under src/ (or the app roots) mentions the installer',
  audit.installerMentions.length === 0,
  `installer mentioned at: ${audit.installerMentions.join(', ')}`);
ok('no production file under src/ (or the app roots) reaches the observer slot',
  audit.slotMentions.length === 0,
  `slot mentioned at: ${audit.slotMentions.join(', ')}`);

/* ── STATIC, mutation cells: the scan must be able to say RED ─────────────── */
const planted = new Map(sources);
planted.set('src/screens/home/PlantedObserver.tsx',
  `import { ${INSTALLER} } from '../../rules/programmingSelectionTrace';\n${INSTALLER}(() => undefined);\n`);
const plantedAudit = auditTraceObserverInstallers(planted);
ok('LIVENESS — a planted production installer under src/screens is reported with its file and line',
  plantedAudit.installerMentions.length === 2
    && plantedAudit.installerMentions.every((hit) => hit.startsWith('src/screens/home/PlantedObserver.tsx:')),
  JSON.stringify(plantedAudit.installerMentions));

const reaching = new Map(sources);
reaching.set('src/store/PlantedSlotReach.ts', `const tap = (globalThis as any).${SLOT};\n`);
ok('LIVENESS — a planted reference to the observer slot outside the definer is reported',
  auditTraceObserverInstallers(reaching).slotMentions.length === 1);

const exported = new Map(sources);
exported.set(DEFINING_FILE, (sources.get(DEFINING_FILE) ?? '').replace(`let ${SLOT}`, `export let ${SLOT}`));
ok('LIVENESS — exporting the slot from the defining module is reported',
  !auditTraceObserverInstallers(exported).slotDeclaredPrivate);

const missing = new Map(sources);
missing.delete(DEFINING_FILE);
ok('LIVENESS — a tree without the defining module fails the anchor rather than passing vacuously',
  !auditTraceObserverInstallers(missing).definerFound);

/* ── RUNTIME: inert by default, inert again after the disposer ───────────── */
const trace: AutomaticProgrammingSelectionTrace = {
  schemaVersion: 1, decisionId: 'guard:trace', kind: 'strength_exercise', owner: 'blockExerciseSelection',
  need: { dateISO: '2026-09-07', weekStartISO: '2026-09-07', dayOfWeek: 1, phase: 'Pre-season',
    movementOrQuality: 'squat', role: 'main_bilateral', seatIndex: 0, equipment: [], experience: null,
    injuries: [], daysToGame: null },
  candidates: [{ name: 'Back Squat', eligible: true, rejectedBy: [], rank: 1,
    score: { phasePriority: 1, athletePreference: false, recentUsage: 0, annualUsage: 0,
      weeksOrBlocksSinceUse: null, weeklyUsage: 0 } }],
  selected: 'Back Squat', selectionReason: 'guard fixture',
};
let inertPublish = true;
try { publishAutomaticProgrammingSelectionTraces([trace]); } catch { inertPublish = false; }
ok('with no observer installed, publishing traces is inert (no throw, no consumer)', inertPublish);

let received = 0;
const dispose = installAutomaticProgrammingSelectionTraceObserver(() => { received += 1; });
publishAutomaticProgrammingSelectionTraces([trace]);
ok('CONTROL — an installed observer does receive published traces', received === 1, `received ${received}`);
dispose();
publishAutomaticProgrammingSelectionTraces([trace]);
ok('after the disposer the tap is inert again — an audit observer cannot leak into production',
  received === 1, `received ${received} after dispose`);

console.log(`\nSelection-trace observer guard: passed=${pass} failures=${fail}`);
if (fail > 0) {
  console.log('FAILURES:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
