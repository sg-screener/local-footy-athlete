(global as unknown as { __DEV__: boolean }).__DEV__ = false;
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  },
};

/**
 * NIGGLE HISTORY + NOTE RESURFACING — addendum Group 2 item 9.
 *
 * VERIFICATION STRATEGY (L12). Four classes, and every one of them is about
 * saying more than the facts support:
 *
 *   - A RESURFACED NOTE CAN READ AS A CAUSE. The load ruling's second law —
 *     observation, never diagnosis — is why [4] asserts the note comes back as
 *     the athlete's own text, unparsed, and why the module composes no sentence
 *     about it.
 *   - THE WRONG NOTE CAN COME BACK. A note written during a bad month is not a
 *     note about the injury. [3] asserts injury-tagged only, past episodes only,
 *     same region only — three filters, each with a cell that fails alone.
 *   - A RECORD COUNT CAN MASQUERADE AS AN INJURY COUNT. `superseded` means this
 *     record was replaced, not that the athlete had another niggle. [2] asserts
 *     it is excluded — the cell that stops "3 episodes" being 3 rows.
 *   - A REGION CAN BE RE-DERIVED. `data/injuryRegions.ts` owns body-part routing
 *     and five copies of it once disagreed. [5] sweeps the source and requires
 *     this module classifies nothing.
 *
 * Run: npm run test:journal-niggle-history
 */

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();

import { buildJournalNiggleHistory, flaggedNiggleRegions } from '../rules/journalNiggleHistory';
import type { InjuryEpisodeV1 } from '../rules/injuryEpisode';
import type { NiggleNoteView } from '../rules/journalNiggleHistory';
import { readFileSync } from 'fs';
import { join } from 'path';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: unknown): void {
  if (condition) {
    pass += 1;
    console.log(`  ✓ ${name}`);
  } else {
    fail += 1;
    failures.push(name);
    console.log(`  ✗ ${name}${detail === undefined ? '' : `\n      ${JSON.stringify(detail)}`}`);
  }
}

// ─── Fixtures ────────────────────────────────────────────────────────────

function episode(over: Partial<InjuryEpisodeV1> = {}): InjuryEpisodeV1 {
  return {
    episodeId: 'ep-1',
    bodyPart: 'hamstring',
    status: 'resolved',
    onsetOrReportedDate: '2026-03-02',
    resolvedAt: '2026-03-16',
    affectedWeeks: ['2026-03-02', '2026-03-09'],
    ...over,
  } as InjuryEpisodeV1;
}

function note(over: Partial<NiggleNoteView> = {}): NiggleNoteView {
  return {
    id: 'n-1',
    weekStart: '2026-03-02',
    text: 'Hammy tightened up in the second half.',
    tags: ['injury'],
    createdAt: '2026-03-03T10:00:00.000Z',
    ...over,
  } as NiggleNoteView;
}

const build = (episodes: InjuryEpisodeV1[], notes: NiggleNoteView[] = []) =>
  buildJournalNiggleHistory({ episodes, notes });

// ─── [1] The history ─────────────────────────────────────────────────────

console.log('\n[1] THE HISTORY');
{
  const empty = build([]);
  ok('no episodes yields no regions and nothing resurfaced',
    empty.regions.length === 0 && empty.resurfaced.length === 0);

  const history = build([
    episode({ episodeId: 'ep-old', onsetOrReportedDate: '2026-01-05' }),
    episode({ episodeId: 'ep-new', onsetOrReportedDate: '2026-03-02' }),
  ]);
  ok('episodes in one region group under it',
    history.regions.length === 1 && history.regions[0].episodes.length === 2,
    history.regions);
  ok('and the most recent episode is first',
    history.regions[0].episodes[0].episodeId === 'ep-new',
    history.regions[0].episodes.map((e) => e.episodeId));

  const twoRegions = build([
    episode({ episodeId: 'a', bodyPart: 'knee', onsetOrReportedDate: '2026-01-05' }),
    episode({ episodeId: 'b', bodyPart: 'hamstring', onsetOrReportedDate: '2026-03-02' }),
  ]);
  ok('regions are ordered by their most recent trouble',
    twoRegions.regions[0].region === 'hamstring',
    twoRegions.regions.map((r) => r.region));

  // TWO REGIONS TROUBLED ON THE SAME DAY. Without the tie-break these swap with
  // Map insertion order between renders — a diff nobody can explain and a
  // screenshot nobody can reproduce. No other fixture creates the tie, which is
  // exactly why a mutation deleting the tie-break survived the first pass.
  const tied = build([
    episode({ episodeId: 'k', bodyPart: 'knee', onsetOrReportedDate: '2026-03-02' }),
    episode({ episodeId: 'h', bodyPart: 'hamstring', onsetOrReportedDate: '2026-03-02' }),
  ]);
  ok('regions troubled on the SAME day break by name, so the order never wobbles',
    tied.regions.map((r) => r.region).join(',') === 'hamstring,knee',
    tied.regions.map((r) => r.region));

  ok('an unresolved episode marks its region as going now',
    build([episode({ status: 'active', resolvedAt: null })]).regions[0].active === true);
  ok('and `improving` is still going, not an ending',
    build([episode({ status: 'improving', resolvedAt: null })]).regions[0].active === true);
  ok('a resolved episode leaves the region quiet',
    build([episode()]).regions[0].active === false);
}

// ─── [2] A record count is not an injury count ───────────────────────────

console.log('\n[2] `superseded` IS BOOKKEEPING, NOT A SECOND NIGGLE');
{
  // The believable defect: `superseded` means THIS RECORD was replaced by
  // another. Counting it tells the athlete they had two niggles where they had
  // one — a count of rows wearing the name of a count of injuries.
  const history = build([
    episode({ episodeId: 'live', status: 'resolved' }),
    episode({ episodeId: 'replaced', status: 'superseded' }),
  ]);
  ok('a superseded record is excluded from the history',
    history.regions[0].episodes.length === 1
    && history.regions[0].episodes[0].episodeId === 'live',
    history.regions[0].episodes.map((e) => e.episodeId));

  ok('a region whose only record is superseded disappears entirely',
    build([episode({ status: 'superseded' })]).regions.length === 0);
}

// ─── [3] Only the right note comes back ──────────────────────────────────

console.log('\n[3] RESURFACING — three filters, each one load-bearing');
{
  const past = episode({ episodeId: 'past', status: 'resolved' });
  const nowFlaring = episode({
    episodeId: 'now',
    status: 'active',
    resolvedAt: null,
    onsetOrReportedDate: '2026-08-03',
    affectedWeeks: ['2026-08-03'],
  });

  const resurfaced = build([past, nowFlaring], [note()]).resurfaced;
  ok('a note written during a PAST episode comes back while the region flares',
    resurfaced.length === 1 && resurfaced[0].episodeId === 'past', resurfaced);

  // FILTER 1 — the region must be flaring NOW. Nothing resurfaces into a quiet
  // week; the point is the moment, not the archive.
  ok('nothing resurfaces when the region is quiet',
    build([past], [note()]).resurfaced.length === 0);

  // FILTER 2 — a note from THIS episode is not a memory.
  ok('a note from the CURRENT episode is not resurfaced as a memory',
    build([past, nowFlaring], [note({ id: 'n-now', weekStart: '2026-08-03' })])
      .resurfaced.length === 0);

  // FILTER 3 — injury-tagged only. Every note written during a bad month is not
  // a note about the injury; a diet note beside a hamstring flare is noise
  // wearing the clothes of insight.
  ok('a note from the right weeks but tagged `diet` does not come back',
    build([past, nowFlaring], [note({ tags: ['diet'] })]).resurfaced.length === 0);

  // AND THE REGION MUST MATCH. A knee note is not about a hamstring.
  const kneePast = episode({ episodeId: 'knee-past', bodyPart: 'knee', status: 'resolved' });
  const kneeNoteOnly = build([kneePast, nowFlaring], [note()]).resurfaced;
  ok('a note from another region\'s episode does not come back',
    kneeNoteOnly.every((r) => r.region === 'hamstring')
    && kneeNoteOnly.length === 0,
    kneeNoteOnly);

  ok('a flaring region with nothing written at the time resurfaces nothing',
    build([past, nowFlaring], []).resurfaced.length === 0);
}

// ─── [4] Observation, never diagnosis ────────────────────────────────────

console.log('\n[4] THE NOTE COMES BACK AS THE ATHLETE\'S OWN WORDS');
{
  const past = episode({ episodeId: 'past' });
  const flaring = episode({
    episodeId: 'now', status: 'active', resolvedAt: null,
    onsetOrReportedDate: '2026-08-03', affectedWeeks: ['2026-08-03'],
  });
  const written = note({ text: 'Hammy tightened up in the second half.' });
  const [entry] = build([past, flaring], [written]).resurfaced;

  ok('the note is returned whole and unparsed',
    entry.note.text === 'Hammy tightened up in the second half.', entry?.note);
  ok('and it carries WHICH past episode it belongs to, not a conclusion',
    entry.episodeId === 'past' && entry.region === 'hamstring', entry);

  // THE MODULE COMPOSES NO SENTENCE ABOUT THE NOTE. "You wrote this the last
  // time" is the surface's line and is PROPOSED copy; a causal sentence built
  // here would be a diagnosis the ruling forbids outright.
  const source = readFileSync(join(__dirname, '..', 'rules', 'journalNiggleHistory.ts'), 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  ok('the module source was read', source.length > 2000, source.length);
  ok('the module builds no athlete-facing sentence at all',
    !/`[^`]*\$\{[^`]*\}[^`]*`/.test(code) || !/because|caused|why|due to/i.test(code),
    code.match(/because|caused|due to/gi));
}

// ─── [5] The region owner, and the surface ───────────────────────────────

console.log('\n[5] OWNERSHIP AND THE SURFACE');
{
  const source = readFileSync(join(__dirname, '..', 'rules', 'journalNiggleHistory.ts'), 'utf8');
  ok('the module source was read', source.length > 2000, source.length);
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  // FIVE COPIES OF BODY-PART ROUTING ONCE DISAGREED. This module groups by the
  // region an episode ALREADY CARRIES and routes nothing.
  ok('it declares no body-part routing table of its own',
    !/'(knee|hamstring|groin|calf|ankle|quad|hip)'\s*:/.test(code),
    code.match(/'(knee|hamstring|groin|calf)'/g));
  // IT ASKS THE OWNER — that is the opposite of a rival table, and the point.
  ok('it routes body parts through the region owner rather than its own map',
    /\bresolveInjuryRegion\s*\(/.test(code));

  // AND IT DOES NOT USE `episode.region`, WHICH IS A COARSE CONSTRAINT BUCKET
  // ('lower_body'), not one of Sam's thirteen. Grouping by it would file a knee
  // and a hamstring together AND put an internal word on the athlete's screen.
  ok('it does not group by the coarse constraint bucket',
    !/episode\.region\b/.test(code), code.match(/episode\.region\b/g));

  // THE LINE SLICE 2 BUILT, AND THIS MODULE TRIPPED ON ITS FIRST RUN: no
  // `rules/` module reads the note store. Even a type-only import is the shape
  // that law forbids, so the note arrives as a narrow structural view instead.
  ok('this rules/ module does not name the note store at all',
    !/journalNoteStore/.test(source), source.match(/journalNoteStore/g));

  // ── [5b] WHICH NIGGLES EARN A CARD — behavioural, not a source scan ──
  //
  // Sam's UI ruling makes niggle history an EARNED card: "only with an active
  // issue or repeat flag — never standing furniture". The predicate lives in
  // `rules/` precisely so this block can call it; written in the JSX it would be
  // assertable only as "a `.filter(` appears near the word niggle", which a
  // filter with the wrong predicate satisfies perfectly.
  console.log('\n[5b] THE EARNED-CARD PREDICATE');
  {
    // THE CASE THE RULING IS ABOUT: one healed niggle from March. Before the
    // ruling this athlete carried a "Niggles" heading forever.
    const healedOnce = build([episode({ status: 'resolved' })]);
    ok('a single healed episode earns NO card',
      flaggedNiggleRegions(healedOnce).length === 0,
      healedOnce.regions.map((r) => ({ region: r.region, n: r.episodes.length })));

    // A REPEAT IS THE SIGNAL, even when nothing is wrong right now — the second
    // time a hamstring goes is news about the first time.
    const healedTwice = build([
      episode({ episodeId: 'ep-1', onsetOrReportedDate: '2026-01-05' }),
      episode({ episodeId: 'ep-2', onsetOrReportedDate: '2026-03-02' }),
    ]);
    ok('two healed episodes in one region DO earn a card — a repeat is the flag',
      flaggedNiggleRegions(healedTwice).length === 1,
      flaggedNiggleRegions(healedTwice).map((r) => r.region));

    // AND AN ACTIVE ONE ALWAYS DOES, first time or not.
    const activeOnce = build([
      episode({ status: 'active', resolvedAt: null }),
    ]);
    ok('one ACTIVE episode earns a card on its own',
      flaggedNiggleRegions(activeOnce).length === 1,
      activeOnce.regions.map((r) => ({ region: r.region, active: r.active })));

    // TWO REGIONS, ONE FLAG — the predicate selects, it does not pass through.
    // A `filter` that returned everything would satisfy the two cells above and
    // fail this one, which is the whole reason it is here.
    const mixed = build([
      episode({ episodeId: 'k', bodyPart: 'knee', status: 'active', resolvedAt: null }),
      episode({ episodeId: 'h', bodyPart: 'hamstring', status: 'resolved' }),
    ]);
    const flagged = flaggedNiggleRegions(mixed);
    ok('the healed region is dropped while the active one is kept',
      mixed.regions.length === 2 && flagged.length === 1 && flagged[0].region !== undefined,
      { all: mixed.regions.map((r) => r.region), flagged: flagged.map((r) => r.region) });
  }

  const screen = readFileSync(
    join(__dirname, '..', 'screens', 'journal', 'JournalScreen.tsx'), 'utf8');
  ok('the screen source was read', screen.length > 4000, screen.length);
  ok('the screen builds the history rather than joining episodes itself',
    /\bbuildJournalNiggleHistory\s*\(/.test(screen));
  ok('the screen renders `journal-niggle-resurfaced`',
    /testID="journal-niggle-resurfaced"/.test(screen));

  // ── `journal-niggles-none` IS RETIRED, AND THE CELL IS RE-POINTED ──
  //
  // Sam's UI ruling (2026-08-09): "NIGGLE HISTORY surfaces only with an active
  // issue or repeat flag — never standing furniture." So "No niggles recorded."
  // is gone: an athlete with nothing wrong sees no niggle surface at all.
  //
  // THE CELL ASSERTS THE STRONGER LAW RATHER THAN DISAPPEARING WITH THE STRING.
  // A cell quietly deleted because its own unit made it red is how a gate stops
  // meaning anything — the same move slice 2 made for slice 1's "no writer"
  // cell. What replaces it is BEHAVIOURAL, which the old one was not: the
  // predicate moved out of the JSX into `flaggedNiggleRegions`, so "a healed
  // single episode is not shown" is now proven by calling it.
  // COMMENTS ARE STRIPPED FIRST, AND THIS CELL EARNED THAT ON ITS FIRST RUN: it
  // went red on the screen's own header comment, which documents the retirement
  // by QUOTING the retired sentence. The claim is "an athlete cannot see this
  // string", and a comment is the one place the string can appear without being
  // visible to anyone. Stripping is not loosening — a live literal still reds.
  const screenCode = screen
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  ok('the stripped screen source is substantial, not an empty slice',
    screenCode.length > 4000, screenCode.length);
  ok('the retired empty state is gone from the screen entirely',
    !/journal-niggles-none/.test(screenCode) && !/No niggles recorded/.test(screenCode),
    screenCode.match(/No niggles recorded[^\n]*/g));
  ok('and the screen asks the derivation which regions are worth showing',
    /\bflaggedNiggleRegions\s*\(/.test(screen));

  // A ZUSTAND SELECTOR THAT MINTS A NEW ARRAY RE-RENDERS FOREVER. `?? []` inline
  // compares unequal every time; the frozen constant is the fix.
  ok('the episodes selector uses a stable empty array, not an inline `?? []`',
    /EMPTY_EPISODES/.test(screen) && !/injuryEpisodes \?\? \[\]\s*,\s*\n?\s*\)/.test(screen));
}

console.log(`\njournalNiggleHistoryTests: ${pass} passed, ${fail} failed`);
totalsPrinted(fail);
console.log('  DEPTH (L13): 0 — a unit sweep over the pure join with hand-built episodes '
  + 'and notes. No walked athlete, and no cell mounts a surface.');
console.log('  NOT COVERED: resurfacing is BY TIME, not by tag — a note cannot be '
  + 'knee-tagged, because `JOURNAL_NOTE_TAGS` is a closed eight with no region and slice 2 '
  + 'closed it deliberately. Route (b), adding a region to a note, reopens a vocabulary '
  + 'Sam ruled and is HIS call (docs/JOURNAL_NIGGLE_SLICE_PLAN_2026-08-09.md §2). '
  + 'Whether `affectedWeeks` is kept complete by the episode transaction on a live device '
  + 'is NOT asserted here and is the one thing that would silently resurface nothing. '
  + 'No device evidence.');
if (failures.length > 0) console.log(`Failures:\n  - ${failures.join('\n  - ')}`);
