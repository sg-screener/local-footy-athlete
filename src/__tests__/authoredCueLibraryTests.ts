/**
 * Sam's authored cue + video pass — conformance to the authored sources.
 *
 *   docs/EXERCISE_MASTER_SHEET_2026-07-28.xlsx   ← THE cue source
 *   docs/CUE_CHANGESET_2026-07-23.md             (renames + deletions only)
 *   docs/VIDEO_CHANGESET_2026-07-24.md
 *
 * The sources are parsed here and treated as the source of truth, so "apply
 * EXACTLY — no rewording" is machine-checked rather than trusted. If Sam edits
 * a cue in the sheet, this suite fails until the library matches.
 *
 * CUES ARE BOUND IN BOTH DIRECTIONS (2026-07-28 reconciliation). Every sheet
 * cue must ship verbatim AND every shipped cue must be on the sheet. The old
 * one-directional bind let 31 cues accumulate in code that the gate's document
 * had never heard of — all authored, but spread across three documents with
 * nothing reconciling them. A new cue can now only enter through the sheet.
 *
 * The cue library no longer lives in `docs/CUE_CHANGESET_2026-07-23.md`. That
 * document is NOT retired: its Renames and Deletions sections still drive §4's
 * ban, and rewriting a dated sign-off record would falsify it. Only its "Final
 * cue library" section is superseded.
 *
 * Run: npm run test:authored-cues
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';


import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import fs from 'fs';
import path from 'path';

import { EXERCISE_CUES } from '../data/exerciseCues';
import { resolveTemplateByName } from '../rules/conditioningSelection';
import { selectableExerciseNames, isExempt } from '../data/selectableExerciseVocabulary';
import { POOL_REGISTRY } from '../data/exercisePools';
import { STRENGTH_POOLS } from '../data/exercisePoolsStrength';
import { EXERCISE_DEMO_VIDEOS, lookupExerciseDemo } from '../services/exerciseVideoService';
import {
  EXERCISE_LOAD_MAP,
  isTrueBodyweightExercise,
  resolveExerciseName,
} from '../utils/loadEstimation';
import { CONDITIONING_META } from '../data/exerciseTags';
import { readSheetRecords, readXlsx } from './support/xlsxReader';

const repoRoot = path.resolve(__dirname, '../..');
const src = path.resolve(__dirname, '..');

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

/* ── Parse Sam's changesets ── */

const cueDoc = fs.readFileSync(
  path.join(repoRoot, 'docs/CUE_CHANGESET_2026-07-23.md'), 'utf8');
const videoDoc = fs.readFileSync(
  path.join(repoRoot, 'docs/VIDEO_CHANGESET_2026-07-24.md'), 'utf8');

/**
 * Names a LATER Sam changeset overrode, parsed from each document's own
 * "Superseded by the locked list" section.
 *
 * Two Sam sign-offs can both be true at once: the 2026-07-23 cue sheet is a
 * record of what he approved then, and the 2026-07-24 locked list is what
 * ships now. Rewriting the earlier document would falsify a record; ignoring
 * it would let this suite demand retired content. So the earlier document
 * declares its own supersessions and they are subtracted here — DERIVED from
 * the document, never a literal list in this file, for the same reason §4's
 * retired names are.
 */
function parseSuperseded(source: string): Set<string> {
  const section = source.split('## Superseded by the locked list')[1] ?? '';
  const names = new Set<string>();
  for (const line of section.split('\n')) {
    const match = line.match(/^- (.+?) — /);
    if (match) names.add(match[1].trim());
  }
  return names;
}

const supersededVideos = parseSuperseded(videoDoc);

const MASTER_SHEET = path.join(repoRoot, 'docs/EXERCISE_MASTER_SHEET_2026-07-28.xlsx');
const MASTER_SHEET_TAB = 'Exercise Master';
/** Five authored preamble rows sit above the header — see the muscle suite. */
const MASTER_SHEET_HEADER_ROW = 6;
const masterSheetRows = readSheetRecords(MASTER_SHEET, MASTER_SHEET_TAB, MASTER_SHEET_HEADER_ROW);

/**
 * Sam's cue columns, read off the master sheet.
 *
 * A row reads either an authored pair or the PENDING marker — never blank.
 * Blank is what "absence rendered as approval" looks like in a spreadsheet, so
 * §3 rejects it rather than skipping the row.
 */
const PENDING_MARKER = 'PENDING — Stage B';

interface SheetCue {
  readonly primary: string;
  readonly secondary: string;
  readonly pending: boolean;
}

function parseAuthoredCues(): Map<string, SheetCue> {
  const cues = new Map<string, SheetCue>();
  for (const row of masterSheetRows) {
    const name = row.Exercise;
    if (!name) continue;
    const primary = row.primaryCue ?? '';
    cues.set(name, {
      primary,
      secondary: row.secondaryCue ?? '',
      pending: primary === PENDING_MARKER,
    });
  }
  return cues;
}

/** `- **Name**: https://…` from the video set/replace section. */
function parseAuthoredVideos(): Map<string, string> {
  const section = videoDoc.split('## Set / replace')[1]?.split('## Still no video')[0] ?? '';
  const videos = new Map<string, string>();
  for (const line of section.split('\n')) {
    const match = line.match(/^- \*\*(.+?)\*\*:\s*(\S+)\s*$/);
    if (match && !supersededVideos.has(match[1])) videos.set(match[1], match[2]);
  }
  return videos;
}

const authoredCues = parseAuthoredCues();
const authoredVideos = parseAuthoredVideos();

/* ── Collect every pool exercise the app can actually prescribe ── */

function poolExerciseNames(): string[] {
  const names = new Set<string>();
  for (const pool of Object.values(POOL_REGISTRY)) {
    for (const entry of pool) names.add(entry.name);
  }
  for (const slot of Object.values(STRENGTH_POOLS)) {
    for (const definition of [slot.anchor, slot.accessory]) {
      for (const entry of definition.entries) names.add(entry.name);
    }
  }
  return [...names].sort();
}

/* ── Source scan helpers ── */

function allSourceFiles(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        walk(full);
        continue;
      }
      if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) found.push(full);
    }
  };
  walk(src);
  return found;
}

function main(): void {
  console.log('\n[1] The authored sources parsed cleanly');
  {
    ok('the master sheet yielded a full library', authoredCues.size >= 190,
      `parsed ${authoredCues.size} sheet rows — expected the full exercise list`);

    // Blank is not a value. A sheet cell left empty is indistinguishable from
    // one nobody has looked at, which is the exact defect this unit closes.
    const blank = [...authoredCues]
      .filter(([, cue]) => cue.primary.trim() === '')
      .map(([name]) => name);
    ok('no sheet row has a blank cue', blank.length === 0, blank.join(', '));

    const pendingWithSecondary = [...authoredCues]
      .filter(([, cue]) => cue.pending && cue.secondary !== '')
      .map(([name]) => name);
    ok('a PENDING row carries no secondary', pendingWithSecondary.length === 0,
      pendingWithSecondary.join(', '));
    // 36 original picks, + 5 added on 2026-07-24 when applying the changeset
    // exposed four real gaps and Sam added the new Abductor Machine, + 1 for
    // the unified Groin Squeeze = 42 supplied. The locked list then retired the
    // two machine exercises the same day, so 40 of those still ship. Sam added
    // 2 more on 2026-07-27 (Vertical Jump, Explosive Push-up) when the
    // power-pool wiring made them pool exercises = 44 supplied, 42 shipping.
    ok('video changeset yielded Sam\'s 44 picks, less the 2 it superseded',
      authoredVideos.size === 42 && supersededVideos.size === 2,
      `parsed ${authoredVideos.size} live video URLs (expected 42), `
        + `${supersededVideos.size} superseded (expected 2)`);

    ok('the video supersessions are declared by the document itself',
      supersededVideos.size === 2,
      `video supersessions=${supersededVideos.size} (expected 2)`);

    /**
     * The superseded artifacts must keep saying so.
     *
     * Both still exist and both still look authoritative — one is titled "Sam's
     * sign-off pass", the other opens "Source of truth". A reader who finds
     * either and edits a cue there would be authoring into a document nothing
     * reads. The markers are the only thing preventing that, so they are gated
     * rather than trusted.
     */
    ok('the changeset declares its cue library superseded',
      /THE "Final cue library" SECTION BELOW IS SUPERSEDED/.test(cueDoc));
    ok('the changeset still declares its renames + deletions live',
      /The rest of this document is LIVE/.test(cueDoc));

    const reviewSheetTitle = readXlsx(path.join(repoRoot, 'docs/CUE_REVIEW_2026-07-23.xlsx'))[0]
      .rows[0]?.[0] ?? '';
    ok('the blank review workbook is marked non-canonical',
      /NON-CANONICAL — HISTORICAL POINTER ONLY/.test(reviewSheetTitle),
      `A1 reads: ${JSON.stringify(reviewSheetTitle.slice(0, 120))}`);
  }

  console.log('\n[2] The cue library IS Sam\'s authored text — BOTH directions');
  {
    /* ── sheet → code ── */
    const mismatches: string[] = [];
    const missing: string[] = [];
    for (const [name, authored] of authoredCues) {
      if (authored.pending) continue;
      const shipped = EXERCISE_CUES[name];
      if (!shipped) {
        missing.push(name);
        continue;
      }
      if (shipped.primaryCue !== authored.primary) {
        mismatches.push(
          `${name} primary:\n        sheet: ${JSON.stringify(authored.primary)}\n        code:  ${JSON.stringify(shipped.primaryCue)}`);
      }
      if (shipped.secondaryCue !== authored.secondary) {
        mismatches.push(
          `${name} secondary:\n        sheet: ${JSON.stringify(authored.secondary)}\n        code:  ${JSON.stringify(shipped.secondaryCue)}`);
      }
    }
    ok('every authored cue is present', missing.length === 0,
      `absent from EXERCISE_CUES: ${missing.join(', ')}`);
    ok('no authored cue was reworded', mismatches.length === 0,
      mismatches.join('\n      '));

    /* ── code → sheet: the direction that was missing ── */
    //
    // Without this, a cue can be added straight to the library and no gate
    // notices — which is how 31 cues came to exist in code that the gate's
    // document had never heard of. They were all Sam's; they had just never
    // been filed. The reverse bind makes filing structural: a cue that is not
    // on the sheet is not a cue.
    const unfiled = Object.keys(EXERCISE_CUES).filter((name) => !authoredCues.has(name));
    ok('every shipped cue is on the sheet', unfiled.length === 0,
      `in EXERCISE_CUES, absent from the master sheet: ${unfiled.join(', ')}`);

    // A PENDING row must NOT have quietly acquired a cue in code: that would be
    // an unruled cue shipping under the appearance of an authored one.
    const pendingButCued = [...authoredCues]
      .filter(([name, cue]) => cue.pending && EXERCISE_CUES[name])
      .map(([name]) => name);
    ok('no PENDING row carries a cue in code', pendingButCued.length === 0,
      pendingButCued.join(', '));
  }

  console.log('\n[3] Cue rules');
  {
    const overCap: string[] = [];
    for (const [name, cue] of Object.entries(EXERCISE_CUES)) {
      for (const [which, text] of [['primary', cue.primaryCue], ['secondary', cue.secondaryCue]] as const) {
        const words = text.trim().split(/\s+/).filter(Boolean).length;
        if (words > 18) overCap.push(`${name} ${which}: ${words} words`);
      }
    }
    ok('no cue exceeds the 18-word cap', overCap.length === 0, overCap.join('\n      '));

    const cueSource = fs.readFileSync(path.join(src, 'data/exerciseCues.ts'), 'utf8');
    ok('the file carries Sam\'s provenance header',
      /Authored by Sam, 2026-07-23\. Additions require Sam sign-off\./.test(cueSource));
    ok('the retired 12-word cap is gone from the header',
      !/12 words hard cap/.test(cueSource));
    ok('the header names the master sheet as the source',
      /EXERCISE_MASTER_SHEET_2026-07-28\.xlsx/.test(cueSource));

    /**
     * The family-fallback TABLE is deleted, not shrunk (Sam, 2026-07-28).
     *
     * Twelve of its thirteen pairs fired for no exercise and appeared in no
     * document — a safety net nobody authored. Shrinking the table to its one
     * live key would leave twelve empty slots that a later unit could refill
     * with no gate noticing, which is the shape of the very defect this unit
     * closes. So the mechanism goes and the surviving pair becomes a single
     * named constant: there is no longer a table to add an unauthored cue to.
     */
    const fallbackOffenders = allSourceFiles()
      .filter((file) => file !== __filename)
      .filter((file) => /FAMILY_FALLBACKS/.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(src, file));
    ok('the FAMILY_FALLBACKS table exists nowhere in src', fallbackOffenders.length === 0,
      fallbackOffenders.join(', '));

    // The one surviving pair is UNRULED and must stay labelled as such. Sam
    // deferred it to Stage B rather than blessing it; if this assertion is ever
    // "fixed" by deleting the label, the pair silently becomes authored.
    ok('the surviving conditioning pair is labelled unruled',
      /NOT Sam-authored/.test(cueSource) && /PENDING_CONDITIONING_CUE/.test(cueSource));
  }

  console.log('\n[4] Deletions and renames are complete across src');
  {
    // The retired names are DERIVED from the changeset's own Renames and
    // Deletions sections, not written as literals here. A future blanket rename
    // sweep across src would rewrite literals in this file and silently disarm
    // the guard; deriving them from the document cannot be disarmed that way.
    const retired = new Set<string>();
    const renameSection = cueDoc.split('## Renames')[1]?.split('##')[0] ?? '';
    for (const line of renameSection.split('\n')) {
      const match = line.match(/^- (.+?) → /);
      if (!match) continue;
      // "Tib Raise / Tibialis Raise → Tib Raises" retires both left-hand names.
      for (const name of match[1].split(' / ')) retired.add(name.trim());
    }
    const deleteSection = cueDoc.split('## Deletions')[1]?.split('##')[0] ?? '';
    for (const line of deleteSection.split('\n')) {
      const match = line.match(/^- (.+)$/);
      if (!match) continue;
      // Strip Sam's trailing rationale parenthetical, which starts lowercase or
      // with a quote — a real name's parenthetical is capitalised, e.g.
      // "Groin Squeeze (Band Adductor)".
      retired.add(match[1].replace(/\s\((?:Sam:|['a-z])[\s\S]*\)$/, '').trim());
    }
    // MetCon is a live workout type elsewhere in the app; only its cue entry
    // was retired, so it is not a banned string.
    retired.delete('MetCon');

    ok('retired names were derived from the changeset', retired.size >= 9,
      `derived only ${retired.size}: ${[...retired].join(', ')}`);

    /**
     * Names whose new form CONTAINS the old one, so a bare match would flag the
     * replacement itself. The lookahead excludes the surviving form.
     */
    const survivingForm: Record<string, string> = {
      'Copenhagen Plank': '(?! \\(Half\\))',
      'Tib Raise': '(?!s)',
      // "Assault Bike Sprints" is a coach term Sam keeps; "Air Bike Sprints" is
      // the new canonical name. Only the unqualified name is retired.
      'Bike Sprints': '',
    };
    const precedingGuard: Record<string, string> = {
      'Bike Sprints': '(?<!Assault )(?<!Air )',
    };

    const banned = [...retired].map((name) => ({
      label: name,
      pattern: new RegExp(
        (precedingGuard[name] ?? '')
        + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        + (survivingForm[name] ?? ''),
      ),
    }));

    for (const { label, pattern } of banned) {
      const offenders: string[] = [];
      for (const file of allSourceFiles()) {
        // This suite necessarily names the retired exercises in order to ban
        // them; it is the guard, not a consumer.
        if (file === __filename) continue;
        const text = fs.readFileSync(file, 'utf8');
        if (pattern.test(text)) offenders.push(path.relative(src, file));
      }
      ok(`"${label}" appears nowhere in src`, offenders.length === 0,
        offenders.join(', '));
    }
  }

  console.log('\n[5] Renamed exercises resolve under their new names');
  {
    const renamed = [
      'Air Bike Sprints',
      'Single-Arm Pulldown',
      'Tib Raises',
      'Copenhagen Plank (Half)',
    ];
    for (const name of renamed) {
      ok(`${name} has a cue`, Boolean(EXERCISE_CUES[name]));

      // Conditioning modalities are sessions, not demoed movements — they have
      // never been in the video map (nor had 'Bike Sprints' before the rename).
      if (!CONDITIONING_META[name]) {
        const demo = lookupExerciseDemo(name);
        ok(`${name} resolves a video entry`, Boolean(demo.url),
          `lookupExerciseDemo returned ${JSON.stringify(demo)}`);
      }

      // Load handling is defined two ways in this app: an entry in
      // EXERCISE_LOAD_MAP, or membership of TRUE_BODYWEIGHT_EXERCISES. The
      // rename must not drop the exercise out of BOTH.
      //
      // Conditioning modalities are exempt for the SAME reason they are exempt
      // from the video assertion just above: they are sessions, not movements.
      // A bike sprint has no external load to handle.
      //
      // That exemption was previously unnecessary — not because the reasoning
      // did not apply, but because `isTrueBodyweightExercise` promoted anything
      // tagged `movement: 'conditioning'` to bodyweight. This gate was being
      // satisfied by the very inference that made the athlete-facing label
      // dishonest (render-truth, Sam 2026-07-28). With the inference gone the
      // exemption has to be stated rather than accidentally supplied.
      if (!CONDITIONING_META[name]) {
        const resolved = resolveExerciseName(name);
        ok(`${name} keeps defined load handling`,
          Boolean(EXERCISE_LOAD_MAP[resolved]) || isTrueBodyweightExercise(name),
          `resolveExerciseName('${name}') gave '${resolved}': no load profile and not bodyweight`);
      }
    }
  }

  console.log('\n[6] Pool coverage — every prescribable exercise is complete');
  {
    const names = poolExerciseNames();
    ok('pools are non-empty', names.length > 50, `found ${names.length} pool exercises`);

    const withoutCue = names.filter((name) => !EXERCISE_CUES[name]);
    ok('every pool exercise has an authored cue', withoutCue.length === 0,
      withoutCue.join(', '));

    /**
     * Coverage derives from SELECTABILITY, not from the two pool registries.
     *
     * `poolExerciseNames()` reads POOL_REGISTRY + STRENGTH_POOLS. Conditioning
     * modalities reach selectability through a different source entirely, so
     * the assertion just above could never see them — and eight selectable
     * conditioning sessions were rendering an unauthored family-fallback cue
     * with no gate able to notice. Deriving from `selectableExerciseNames()`
     * closes the hiding place: if an athlete can be given it, it is covered.
     */
    // STAGE B LANDED (2026-08-05): the 55 signed conditioning templates are
    // selectable and their cue is AUTHORED — Sam's own `effortCue`, served
    // verbatim from the workbook via `getExerciseCue` step 3, equality-gated
    // by `conditioningTemplateEqualityTests`. A name that resolves to a
    // template is covered by that second authored source, not by this sheet
    // (docs/STAGE_B_STAGE2_SWITCHOVER_PREDICTION_2026-08-05.md).
    const uncovered = selectableExerciseNames().filter(
      (name) => !EXERCISE_CUES[name]
        && !authoredCues.get(name)?.pending
        && !resolveTemplateByName(name),
    );
    ok('every selectable exercise is authored or explicitly PENDING',
      uncovered.length === 0,
      `neither cued nor marked PENDING on the sheet: ${uncovered.join(', ')}`);

    /**
     * The pending set is PINNED, so a twenty-fourth cannot join it silently.
     *
     * Sam's ruling: the conditioning pair stays unruled and attributed until
     * Stage B, where template `effortCue`s supersede it. That is a deliberate
     * hole with a known size — an accidental one is what this pin catches.
     * Growth means someone shipped a selectable exercise without a cue.
     */
    const pending = [...authoredCues].filter(([, cue]) => cue.pending).map(([name]) => name);
    ok('exactly 23 rows are pending Stage B', pending.length === 23,
      `${pending.length} pending: ${pending.join(', ')}`);

    // Zone-1 cyclical recovery is out of the video map by design — they are not
    // movements to demo. Documented in exerciseVideoService's header and in the
    // video changeset.
    const ZONE_1_BY_DESIGN = new Set([
      'Light Walk or Stationary Bike',
      'Incline Treadmill Walk',
      'Outdoor Walk',
      'Light Skipping',
    ]);
    const withoutVideo = names
      .filter((name) => !ZONE_1_BY_DESIGN.has(name) && !CONDITIONING_META[name])
      .filter((name) => !lookupExerciseDemo(name).url);
    ok('every demoable pool exercise resolves a working video', withoutVideo.length === 0,
      withoutVideo.join(', '));
  }

  console.log('\n[7] Pool additions Sam approved are present');
  {
    // 'Speed Bench' is deliberately absent: it classifies as `power`, so the
    // power policy strips it from strength content — pooling it silently
    // deleted the athlete's accessory. Owned by the power-pool unit.
    const additions = [
      'Goblet Squat',
      'Bottoms-Up KB Press',
      'Single-Arm DB Bench Press',
      'Single-Leg Leg Press',
      'Single-Leg Squat (to Box)',
      'Long-Lever Copenhagen',
      'Scap Push-Up',
    ];
    const names = new Set(poolExerciseNames());
    const absent = additions.filter((name) => !names.has(name));
    ok('every approved pool addition is in a pool', absent.length === 0, absent.join(', '));
  }

  console.log('\n[8] Sam\'s 36 video URLs, exactly');
  {
    const wrong: string[] = [];
    for (const [name, url] of authoredVideos) {
      const shipped = EXERCISE_DEMO_VIDEOS[name];
      if (shipped !== url) {
        wrong.push(`${name}\n        doc:  ${url}\n        code: ${String(shipped)}`);
      }
    }
    ok('every authored URL is applied verbatim', wrong.length === 0, wrong.join('\n      '));
    // Was a hardcoded sentence, then derived from AWAITING_SAM_VIDEO. That
    // exemption is RETIRED (Sam supplied both URLs, 2026-07-27), so the check
    // returns to its strongest form: derive from what actually ships. Every
    // selectable, demoable exercise must resolve a video — no list to consult.
    const videolessSelectable = selectableExerciseNames().filter(
      (name) => !isExempt(name, 'video') && !lookupExerciseDemo(name).url,
    );
    ok('every selectable exercise resolves a video', videolessSelectable.length === 0,
      videolessSelectable.join(', '));

    ok('the changeset records no remaining gaps',
      /NONE — every pool exercise has a video after this changeset\./.test(videoDoc));
  }

  console.log('\n[9] Depth Jumps / Lateral Bounds power-pool spec matches the sheet');
  {
    for (const name of ['Depth Jumps', 'Lateral Bounds']) {
      const authored = authoredCues.get(name);
      ok(`${name} is in the authored sheet`, Boolean(authored));
      if (!authored) continue;
      const shipped = EXERCISE_CUES[name];
      ok(`${name} cue matches the sheet`,
        shipped?.primaryCue === authored.primary && shipped?.secondaryCue === authored.secondary,
        `code: ${JSON.stringify(shipped)}\n      doc: ${JSON.stringify(authored)}`);
      // The power pool carries its own spec cues; they must not diverge.
      const strengthSource = fs.readFileSync(path.join(src, 'data/exercisePoolsStrength.ts'), 'utf8');
      const block = strengthSource.split(`name: '${name}'`)[1]?.slice(0, 400) ?? '';
      if (/cue/i.test(block)) {
        ok(`${name} power-pool spec cue aligns with the sheet`,
          block.includes(authored.primary),
          `power pool spec near '${name}' does not carry the authored primary cue`);
      }
    }
  }

  const total = passed + failures.length;
  console.log(`\nAuthored cue + video totals: passed=${passed}/${total} failures=${failures.length}`);
  totalsPrinted(failures.length);
  if (failures.length > 0) {
    console.error(`Failing: ${failures.join(', ')}`);
    process.exit(1);
  }
}

main();
