/**
 * ══ THE ELEMENT NAMES A FLOW TAPS ARE A CONTRACT, AND UNTIL NOW NOTHING
 *    CONNECTED THE TWO SIDES ══
 *
 * Sam asked, of the stale golden flows: *"why would this even be an issue?"*
 * The honest answer was that nothing checked. A flow taps by name; a screen
 * owns the name; a redesign renames or deletes it; the flow silently stops
 * finding it — and because nobody ran the flows between 18 July and 10 August,
 * six of them rotted in place with no signal at all.
 *
 * That is the same disease as the dead rig, the impossible seed profile and the
 * type-check baseline: TWO THINGS THAT MUST AGREE, WITH NOTHING CHECKING THAT
 * THEY DO. This is the cheap half of the cure, and it is deliberately cheap —
 * the ids are literals on both sides, so the check is a read of two directories.
 *
 * ══ WHAT THIS PROVES, AND — SAID OUT LOUD — WHAT IT DOES NOT ══
 *
 * PROVES: every element name any `.maestro` flow depends on is a name product
 * source can actually produce. A rename or a deletion reddens this in the same
 * commit that makes it, instead of a month later when somebody finally runs a
 * device.
 *
 * DOES NOT PROVE: that the name is REACHABLE by the path the flow takes.
 * EXISTENCE IS NOT REACHABILITY, and the distinction is not academic — it is
 * exactly how the golden flows broke. `make-change-link` never stopped existing
 * in `HomeScreenV2.tsx`; the day-first redesign moved it behind a shape the
 * flow's first tap navigated away from. This gate would have been GREEN through
 * that entire failure. Only a run on glass answers reachability, which is why
 * `day-week-profile.yaml` exists and why this file is not a substitute for it.
 *
 * ══ WHY A PREFIX VOCABULARY AND NOT A GREP FOR THE WHOLE ID ══
 *
 * Half these ids are built, not written: `day-row-mon` appears nowhere in
 * source because the screen writes `` `day-row-${dayToken}` ``, and
 * `session-delete-action-w-coach-1` is `explorerTestId.sessionDeleteIngress`
 * applied to an id the generator mints at runtime. So the check collects the
 * VOCABULARY product source can emit — exact literals, plus the fixed prefix of
 * every template — and asks whether a flow's id is a word in it. A flow id that
 * matches no literal and no prefix is a name this app cannot produce.
 */

import fs from 'fs';
import path from 'path';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing, cleared only by the printed
// report. This suite reports by COUNT of orphans rather than pass/fail tallies,
// so the clear takes `orphans.length` — the same number its own exit uses.
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
armTotalsOrRed();

const repoRoot = path.resolve(__dirname, '..', '..');
const flowRoot = path.join(repoRoot, '.maestro');
const productRoots = [path.join(repoRoot, 'src'), repoRoot];

/** Every file a screen's ids could be written in. */
function collectSourceFiles(dir: string, depth = 0): string[] {
  if (depth > 12) return [];
  const skip = new Set([
    'node_modules', '.git', '.maestro', 'ios', 'android', 'dist', 'artifacts',
    'test-results', '.claude', 'supabase', 'assets', 'docs', '__tests__',
    'local-footy-athlete-preview',
  ]);
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.maestro') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (skip.has(entry.name)) continue;
      out.push(...collectSourceFiles(full, depth + 1));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function collectFlowFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectFlowFiles(full));
    else if (/\.ya?ml$/.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * The names product source can emit.
 *
 * `literals` are ids written whole. `prefixes` are the fixed head of a template
 * — `day-row-` from `` `day-row-${dayToken}` `` — which is everything that can
 * be checked about a built id without running the app.
 */
/** A name shaped like an element id: kebab-case, at least two segments. */
const ID_SHAPE = /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/;

/**
 * A HOLE IN A TEMPLATE MATCHES ONE SEGMENT-RUN, NOT ANYTHING.
 *
 * This is the difference between a gate and a rubber stamp. Matching only a
 * template's fixed HEAD would accept `fixture-move-action` against
 * `` `fixture-${action}-action-${id}` `` — because it starts with `fixture-` —
 * and that id is precisely one of the two dead names this gate was written to
 * catch. Rebuilding the WHOLE pattern keeps the tail honest: the real name has
 * a fixture identity after `-action-`, and the flow's did not.
 */
function templateToPattern(template: string): RegExp | null {
  const parts = template.split(/\$\{[^}]*\}/);
  if (parts.length < 2) return null;
  const head = parts[0]!;
  if (head.length < 4 || !/^[a-z][a-z0-9-]*$/.test(head)) return null;
  const escaped = parts.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`^${escaped.join('[a-z0-9-]+')}$`);
}

function buildProductVocabulary(files: string[]): {
  literals: Set<string>;
  patterns: RegExp[];
} {
  const literals = new Set<string>();
  const patterns = new Map<string, RegExp>();
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    // Every plain string in product source that is SHAPED like an element id.
    // Deliberately wider than `testID=` attributes: the dev-E2E status markers
    // are authored as a bare array of strings in `devE2EState.ts` and only
    // become testIDs at the renderer, so an attribute-only reader called every
    // one of them missing.
    for (const match of source.matchAll(/['"`]([a-z][a-z0-9-]{5,})['"`]/g)) {
      if (ID_SHAPE.test(match[1]!)) literals.add(match[1]!);
    }
    // Built ids: `day-row-${dayToken}`, `session-delete-scope-${a}-${b}`, …
    for (const match of source.matchAll(/`([^`\\\n]*\$\{[^`\n]*)`/g)) {
      const pattern = templateToPattern(match[1]!);
      if (pattern) patterns.set(pattern.source, pattern);
    }
  }
  return { literals, patterns: [...patterns.values()] };
}

/**
 * The ids a flow depends on. Maestro spells them `id: "..."` in `tapOn`,
 * `assertVisible`, `assertNotVisible` and `extendedWaitUntil`/`element` blocks —
 * one shape, so one reader.
 */
function collectFlowIds(file: string): string[] {
  const source = fs.readFileSync(file, 'utf8');
  const ids: string[] = [];
  for (const line of source.split('\n')) {
    if (/^\s*#/.test(line)) continue;
    const match = /^\s*id:\s*"([^"]+)"\s*$/.exec(line);
    if (match) ids.push(match[1]!);
  }
  return ids;
}

/**
 * A flow's id may itself carry holes: `${SEED_ID}` is a runner variable and
 * `.*` is Maestro's own regex, used where a flow means "this day's session"
 * rather than the generator's id for it. Both stand for a real segment-run at
 * run time, so both become one here — which lets a flow pattern be checked
 * against a product pattern instead of being skipped as unknowable.
 */
function resolvableForm(id: string): string {
  return id.replace(/\$\{[^}]*\}/g, 'x').replace(/\.\*/g, 'x');
}

const sourceFiles = collectSourceFiles(productRoots[0]!)
  .concat(fs.readdirSync(repoRoot)
    .filter((name) => /^App\.tsx$/.test(name))
    .map((name) => path.join(repoRoot, name)));
const { literals, patterns } = buildProductVocabulary(sourceFiles);
const flowFiles = collectFlowFiles(flowRoot);

interface Orphan { flow: string; id: string }
const orphans: Orphan[] = [];
const seen = new Set<string>();
let checked = 0;

let unnameable = 0;
for (const flow of flowFiles) {
  for (const id of collectFlowIds(flow)) {
    // A whole-id variable (`${CONTROL_ID}`) names nothing until the runner
    // fills it. Counted and reported rather than quietly dropped: a gate that
    // hides what it could not check is claiming coverage it does not have.
    if (/^\$\{[^}]*\}$/.test(id)) { unnameable += 1; continue; }
    checked += 1;
    const resolved = resolvableForm(id);
    if (literals.has(id) || literals.has(resolved)) continue;
    if (patterns.some((pattern) => pattern.test(resolved))) continue;
    const key = `${flow}::${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    orphans.push({ flow: path.relative(repoRoot, flow), id });
  }
}

console.log(`Maestro element contract: ${flowFiles.length} flows, ${checked} named ids checked,`
  + ` ${unnameable} runner-variable ids NOT checkable,`
  + ` ${literals.size} product literals, ${patterns.length} product templates`);
totalsPrinted(orphans.length);

if (orphans.length > 0) {
  console.log('\n  ✗ flow ids no product source can produce:');
  for (const orphan of orphans) console.log(`      ${orphan.flow}: ${orphan.id}`);
  console.log('\n  A flow taps by name and a screen owns the name. If a redesign renamed');
  console.log('  or removed one of these, the flow above is now aimed at nothing.');
  process.exit(1);
}

console.log(`  ✓ every checkable flow id is a name product source can emit`);
console.log('  ! TWO LIMITS, STATED SO THEY ARE NOT DISCOVERED LATER:');
console.log('    1. EXISTENCE, NOT REACHABILITY. This stays green while an id the flow');
console.log('       can no longer REACH still exists — which is exactly how the golden');
console.log('       flows broke. Only a device run answers that (`day-week-profile`).');
console.log('    2. A TEMPLATE HOLE ABSORBS A WORD. `fixture-actions-open` satisfies');
console.log('       `fixture-actions-${fixtureId}` because "open" is a legal identity');
console.log('       token, so a dead id shaped like a live one passes. Ids DELETED');
console.log('       outright are caught; ids that merely stopped being produced are not.');
