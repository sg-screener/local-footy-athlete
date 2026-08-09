(global as unknown as { __DEV__: boolean }).__DEV__ = false;

/**
 * THE MONDAY REMINDER — Sam's decision C6, 2026-08-09.
 *
 * VERIFICATION STRATEGY (L12). What would catch the NEXT defect of each class:
 *
 *   - THE SENTENCE COULD FIRE UNSIGNED. C6's own requirement, and the one thing
 *     here that cannot be caught after the fact — a notification is the only
 *     athlete-visible surface Sam cannot review by using the app, because it
 *     appears on a lock screen and nowhere else. [1] asserts the gate refuses
 *     BEFORE the permission branch, and [5] asserts the service reaches the
 *     words through the door rather than around it.
 *   - A REFUSAL COULD BECOME AN ERROR. Sam's words. [2] asserts `refused` is a
 *     returned state and [5] asserts nothing retries it.
 *   - THE SCHEDULE COULD DRIFT. "Monday morning" is arithmetic over a weekday
 *     and an hour, and every boundary in it is a real athlete's Monday: [3]
 *     walks all seven days plus both sides of 08:00 plus a year rollover.
 *   - A SECOND STORE COULD APPEAR. The OS owns the permission; a mirrored flag
 *     would go stale in silence. [4] sweeps the source for a writer.
 *   - THE DECISION COULD MIGRATE INTO THE SURFACE. [5] requires the rule stay
 *     pure and the native module stay in exactly one file.
 *
 * DEPTH AND WHAT THIS CANNOT DO — read the NOT COVERED line at the bottom
 * before trusting any of it. **No cell here schedules a notification**, because
 * the native module is not in the running binary until Sam rebuilds with pods.
 *
 * Run: npm run test:journal-reminder
 */

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
armTotalsOrRed();

import {
  JOURNAL_REMINDER_HOUR,
  JOURNAL_REMINDER_WEEKDAY,
  decideJournalReminder,
  nextMondayMorning,
} from '../rules/journalReminder';
import {
  JOURNAL_REMINDER_COPY,
  JOURNAL_REMINDER_COPY_ID,
  isJournalReminderSentenceSigned,
} from '../rules/journalReminderCopy';
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

const GRANTED = { granted: true, canAskAgain: false };
const FRESH = { granted: false, canAskAgain: true };
const DECLINED = { granted: false, canAskAgain: false };

/** A Wednesday, 2026-08-12, mid-afternoon local. */
const WEDNESDAY = new Date(2026, 7, 12, 15, 30, 0, 0);

// ─── [1] The sentence gate — C6's own requirement ────────────────────────

console.log('\n[1] THE SENTENCE MUST BE SIGNED BEFORE ANYTHING FIRES');
{
  // ─── SIGNED 2026-08-09, AND THESE TWO CELLS ARE RE-AIMED ───────────────
  //
  // They asserted `proposed` and went red the day Sam signed batch 28 — which
  // is what they were for. Re-aimed rather than deleted: an entry that stops
  // being checked is an entry that can drift back.
  ok('the sentence is SIGNED — batch 28, and that is what arms the feature',
    JOURNAL_REMINDER_COPY.provenance === 'signed'
    && isJournalReminderSentenceSigned() === true);
  ok('and the SIGNED entry names Sam and no longer reads PROPOSED',
    JOURNAL_REMINDER_COPY.source.includes('Sam 2026-08-09')
    && !JOURNAL_REMINDER_COPY.source.includes('PROPOSED'),
    JOURNAL_REMINDER_COPY.source);

  // ─── THE VACUITY CHECK — this morning's compression, applied ───────────
  //
  // "WHEN A GATE'S SUBJECT CHANGES STATE, ASK NOT ONLY WHICH CELLS RED BUT
  // WHICH ARE NOW VACUOUS." Two cells reddened and announced themselves. The
  // silent problem is below them: **every cell in this section passes
  // `copySigned` explicitly**, so not one of them exercises the DEFAULT path —
  // the `??` that reads the module. Delete `isJournalReminderSentenceSigned()`
  // from `decideJournalReminder` and this suite stays green, because nothing
  // ever calls it without an override.
  //
  // THAT GAP EXISTED BEFORE THE SIGNING TOO, and the signing is only what made
  // it visible: while the module read `proposed`, "the feature is dark" was true
  // for a reason nobody had tied to the wiring. So the copy entry is mutated AT
  // RUNTIME and the DEFAULT path read back, exactly as `journalLoadTests` [2b]
  // does for the constants.
  {
    const entry = JOURNAL_REMINDER_COPY as unknown as { provenance: string };
    const restore = entry.provenance;

    entry.provenance = 'proposed';
    const applied = isJournalReminderSentenceSigned() === false;
    // NO `copySigned` ARGUMENT — that omission is the entire subject.
    const darkByDefault = decideJournalReminder({ permission: GRANTED, now: WEDNESDAY })
      .kind === 'unsigned_copy';

    entry.provenance = restore;
    const restored = isJournalReminderSentenceSigned() === true;
    const litByDefault = decideJournalReminder({ permission: GRANTED, now: WEDNESDAY })
      .kind === 'scheduled';

    ok('the DEFAULT path reads the copy module — un-signing it darkens, signing lights',
      applied && darkByDefault && restored && litByDefault,
      { applied, darkByDefault, restored, litByDefault });
  }

  ok('and the entry is left exactly as Sam signed it',
    JOURNAL_REMINDER_COPY.provenance === 'signed');

  ok('an unsigned sentence returns `unsigned_copy`, naming the entry',
    decideJournalReminder({ permission: GRANTED, now: WEDNESDAY, copySigned: false })
      .kind === 'unsigned_copy');

  // THE ORDERING IS THE ASSERTION, NOT THE OUTCOME. iOS grants ONE permission
  // prompt. If the gate ran after the permission branch, an athlete would be
  // asked for a notification that cannot fire — and the OS does not give the
  // prompt back. So the refusal must survive PERMISSION ALREADY GRANTED, which
  // is the only state that proves the check is upstream of the branch.
  const state = decideJournalReminder({
    permission: GRANTED, now: WEDNESDAY, copySigned: false,
  });
  ok('it refuses even with permission ALREADY GRANTED — the gate is upstream',
    state.kind === 'unsigned_copy'
    && 'copyId' in state && state.copyId === JOURNAL_REMINDER_COPY_ID, state);

  // BOTH DIRECTIONS. A gate that only ever says no is indistinguishable from a
  // feature that does not work, and this one is dark on the day it ships — so
  // the release path is asserted rather than assumed.
  ok('and SIGNING IT alone schedules — no other change, exactly like the constants',
    decideJournalReminder({ permission: GRANTED, now: WEDNESDAY, copySigned: true })
      .kind === 'scheduled');
}

// ─── [2] A refusal is a FACT, not an error ───────────────────────────────

console.log('\n[2] A REFUSAL IS A FACT, NOT AN ERROR (Sam, C6)');
{
  ok('an athlete who declined reads as `refused`, a state and not a throw',
    decideJournalReminder({ permission: DECLINED, now: WEDNESDAY, copySigned: true })
      .kind === 'refused');
  ok('an athlete never asked reads as `may_ask` — not the same answer',
    decideJournalReminder({ permission: FRESH, now: WEDNESDAY, copySigned: true })
      .kind === 'may_ask');

  // THE DISTINCTION IS THE CELL. Collapsing "declined" and "not yet asked" into
  // one falsy state is the easy build, and it produces an app that asks an
  // athlete who already said no, every week, forever.
  ok('and the two are DIFFERENT states, so nothing can nag a refusal',
    decideJournalReminder({ permission: DECLINED, now: WEDNESDAY, copySigned: true }).kind
      !== decideJournalReminder({ permission: FRESH, now: WEDNESDAY, copySigned: true }).kind);

  ok('permission granted outranks both',
    decideJournalReminder({ permission: GRANTED, now: WEDNESDAY, copySigned: true })
      .kind === 'scheduled');
}

// ─── [3] Monday morning, at every boundary ───────────────────────────────

console.log('\n[3] "MONDAY MORNING" — every boundary an athlete can be standing on');
{
  ok('the weekday constant is Monday in `getDay()` terms', JOURNAL_REMINDER_WEEKDAY === 1);

  // ALL SEVEN DAYS, because a `% 7` is exactly the arithmetic that works for six
  // of them and fails for the seventh.
  for (let offset = 0; offset < 7; offset += 1) {
    const from = new Date(2026, 7, 9 + offset, 12, 0, 0, 0); // Sun 9 Aug .. Sat 15
    const fire = nextMondayMorning(from);
    ok(`from ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][from.getDay()]} noon `
      + 'the next fire is a Monday at 08:00',
    fire.getDay() === JOURNAL_REMINDER_WEEKDAY
      && fire.getHours() === JOURNAL_REMINDER_HOUR
      && fire.getMinutes() === 0
      && fire.getTime() > from.getTime(),
    { from: from.toString(), fire: fire.toString() });
  }

  // THE TWO SIDES OF 08:00 ON A MONDAY — the boundary the naive version gets
  // wrong. Before it, today; after it, next week. A single "next Monday" test
  // would pass against an implementation that always skips a week.
  const mondayEarly = new Date(2026, 7, 10, 7, 59, 0, 0);
  const mondayLate = new Date(2026, 7, 10, 8, 1, 0, 0);
  ok('at 07:59 on a Monday the reminder is TODAY, an hour away',
    nextMondayMorning(mondayEarly).getDate() === 10,
    nextMondayMorning(mondayEarly).toString());
  ok('at 08:01 on a Monday it is NEXT Monday, not a minute ago',
    nextMondayMorning(mondayLate).getDate() === 17,
    nextMondayMorning(mondayLate).toString());

  // EXACTLY 08:00 IS THE OFF-BY-ONE. `<=` rather than `<`, so a call landing on
  // the instant does not schedule a notification for the instant itself.
  const mondayExact = new Date(2026, 7, 10, 8, 0, 0, 0);
  ok('at EXACTLY 08:00 it is next Monday — the boundary is closed, not open',
    nextMondayMorning(mondayExact).getDate() === 17,
    nextMondayMorning(mondayExact).toString());

  // A YEAR ROLLOVER, because `setDate(getDate() + 7)` is only correct if you
  // trust it to carry the month and the year, and that is worth one cell.
  const newYearEve = new Date(2026, 11, 31, 23, 0, 0, 0); // Thu 31 Dec 2026
  const rollover = nextMondayMorning(newYearEve);
  ok('it carries across a year boundary',
    rollover.getFullYear() === 2027 && rollover.getMonth() === 0
    && rollover.getDay() === JOURNAL_REMINDER_WEEKDAY,
    rollover.toString());

  // LOCAL, NOT UTC, AND THIS CELL IS THE REASON THE MODULE DEPARTS FROM THE
  // REST OF THE JOURNAL. Every other date in this unit is parsed as UTC because
  // a week's IDENTITY must not shift with the reader. A notification is the
  // opposite: "Monday morning" means morning where the athlete is standing.
  ok('the fire time is 08:00 LOCAL — a UTC 08:00 would be evening in Melbourne',
    nextMondayMorning(WEDNESDAY).getHours() === 8
    && nextMondayMorning(WEDNESDAY).getUTCHours() !== 8,
    { local: nextMondayMorning(WEDNESDAY).getHours(),
      utc: nextMondayMorning(WEDNESDAY).getUTCHours() });
}

// ─── [4] Zero new stored state ───────────────────────────────────────────

console.log('\n[4] ZERO NEW STORED STATE — the OS is the store');
{
  const rule = readFileSync(join(__dirname, '..', 'rules', 'journalReminder.ts'), 'utf8');
  const service = readFileSync(
    join(__dirname, '..', 'services', 'journalReminderService.ts'), 'utf8');
  const code = (text: string) =>
    text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  ok('both modules were read', rule.length > 1000 && service.length > 1000);

  // A MIRRORED PERMISSION FLAG IS THE DEFECT THIS SWEEPS FOR. It would go stale
  // the moment the athlete changes their mind in Settings — silently, which is
  // how an app becomes certain of a permission it does not have.
  for (const writer of [
    'AsyncStorage', 'useProgramStore', 'persist(', 'setItem', 'SecureStore',
    'create(', 'zustand',
  ]) {
    ok(`the rule opens no store: no \`${writer}\``, !code(rule).includes(writer), writer);
    ok(`the service opens no store: no \`${writer}\``, !code(service).includes(writer), writer);
  }

  // AND THE PERMISSION IS READ, NEVER REMEMBERED.
  //
  // THE FIRST VERSION OF THIS CELL COUNTED `getPermissionsAsync()` AND WANTED
  // THREE. There are two — because the reads go through `readPermission()`,
  // which is the tidier code. **The number named the raw API call while the
  // claim was about the DECISION being freshly fed**, which is
  // `a-count-taken-for-a-record` in a cell I had just written. Re-aimed at the
  // claim: no cache exists, and the helper is called at every decision point.
  ok('the service holds no cached permission — nothing to go stale',
    !/^\s*let\s+\w+/m.test(code(service)),
    code(service).match(/^\s*let\s+\w+.*$/m));
  ok('and every decision is fed from a fresh read of the OS',
    (code(service).match(/await readPermission\(\)/g) ?? []).length === 3,
    code(service).match(/await readPermission\(\)/g)?.length);
}

// ─── [5] The ownership boundary ──────────────────────────────────────────

console.log('\n[5] ONE FILE TOUCHES THE NATIVE MODULE, AND THE RULE STAYS PURE');
{
  const root = join(__dirname, '..');
  const rule = readFileSync(join(root, 'rules', 'journalReminder.ts'), 'utf8');
  const service = readFileSync(join(root, 'services', 'journalReminderService.ts'), 'utf8');
  const screen = readFileSync(join(root, 'screens', 'journal', 'JournalScreen.tsx'), 'utf8');
  const strip = (text: string) =>
    text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  // L14 — the rule must be callable from a plain test with explicit inputs, and
  // this whole suite is the proof that it is.
  ok('the RULE imports no native module and no React',
    !strip(rule).includes('expo-notifications') && !strip(rule).includes('react'), rule);

  ok('the SERVICE is the one place `expo-notifications` is imported for work',
    strip(service).includes("from 'expo-notifications'"));
  ok('and the SCREEN reaches it only through the service, never directly',
    !strip(screen).includes('expo-notifications')
    && strip(screen).includes("from '../../services/journalReminderService'"));

  // THE WORDS GO THROUGH THE DOOR. A service that inlined the sentence would
  // ship an unsigned string to a lock screen with the gate still green.
  ok('the service takes its words from the copy module, not a literal',
    strip(service).includes('JOURNAL_REMINDER_COPY.title')
    && strip(service).includes('JOURNAL_REMINDER_COPY.body')
    && !strip(service).includes('Your week is in the Journal'));

  // NOTHING RETRIES A REFUSAL — Sam's fact, asserted as an absence of a loop.
  ok('nothing retries or loops around the permission request',
    (strip(service).match(/requestPermissionsAsync/g) ?? []).length === 1,
    strip(service).match(/requestPermissionsAsync/g)?.length);

  // THE MOUNT MUST NOT PROMPT. `readJournalReminderState` is what the surface
  // calls on mount; if it could request, opening the Journal tab would raise a
  // system dialog nobody tapped for — the impolite build C6 rules out.
  const readStart = strip(service).indexOf('export async function readJournalReminderState');
  const readEnd = strip(service).indexOf('export async function enableJournalReminder');
  ok('the read-only path was located', readStart > 0 && readEnd > readStart,
    { readStart, readEnd });
  ok('and the MOUNT path cannot raise a prompt — it never requests',
    !strip(service).slice(readStart, readEnd).includes('requestPermissionsAsync'),
    strip(service).slice(readStart, readEnd));

  // THE SCHEDULE IS IDEMPOTENT. Without the cancel, every visit to the Journal
  // tab stacks another weekly trigger and the athlete collects duplicates.
  //
  // THIS CELL SURVIVED ITS OWN MUTATION ON THE FIRST RUN, and the reason is the
  // source-scan law almost word for word. It asserted the cancel appeared in
  // the FILE; deleting it from `scheduleJournalReminder` left the suite green
  // because `disableJournalReminder` calls the same function two screens down.
  // **The occurrence was in the file and the claim was about one function.** So
  // the region is located, proven non-trivial, and the ORDER asserted inside it
  // — a cancel that runs after the schedule would be worse than none.
  const scheduleStart = strip(service).indexOf('async function scheduleJournalReminder');
  const scheduleEnd = strip(service).indexOf('\nexport async function', scheduleStart + 1);
  ok('the scheduling function was located and is substantial',
    scheduleStart > 0 && scheduleEnd > scheduleStart
    && scheduleEnd - scheduleStart > 200, { scheduleStart, scheduleEnd });
  const scheduleFn = strip(service).slice(scheduleStart, scheduleEnd);
  const cancelAt = scheduleFn.indexOf('cancelScheduledNotificationAsync');
  const scheduleAt = scheduleFn.indexOf('scheduleNotificationAsync');
  ok('a reschedule CANCELS FIRST inside the scheduler, so visits do not stack',
    cancelAt > 0 && scheduleAt > cancelAt, { cancelAt, scheduleAt });

  // C6: "opens the Journal tab". The route travels in the payload — and it
  // still does, because the machinery is FROZEN rather than retired.
  ok('the scheduled notification carries the Journal route in its payload',
    strip(service).includes("route: 'JournalTab'"));

  // ─── RE-AIMED 2026-08-09: THE TAP DOOR WENT WITH THE TAB ───────────────
  //
  // These two cells asserted the navigator HANDLED a tap and guarded the
  // route. Sam hid the Journal (docs/JOURNAL_HIDDEN_RULING_2026-08-09.md), so
  // the tab the handler navigated to no longer exists — and navigating to a
  // name the navigator does not know THROWS, with the athlete not yet in the
  // app. The old cells' own comment called that the worst place in this app to
  // crash, which is why the door is removed rather than left guarded.
  //
  // THEY ARE INVERTED, NOT DELETED, AND THE SECOND ONE IS THE STRONGER CLAIM.
  // "Nothing can ever fire" is the ruling's own wording and it is only true of
  // FUTURE schedules: the OS is this feature's store, and a weekly trigger it
  // accepted before today keeps firing whether this app is opened or not. So
  // the navigator must CANCEL, not merely decline to navigate.
  const nav = strip(readFileSync(join(root, 'navigation', 'AppNavigator.tsx'), 'utf8'));
  ok('the navigator handles NO notification tap — the door went with the tab',
    !nav.includes('addNotificationResponseReceivedListener')
    && !nav.includes('content.data?.route'));
  ok('and it cancels the reminder on mount, because the OS kept what it was given',
    /disableJournalReminder\s*\(\s*\)/.test(nav));

  // THREE OF THE FIVE STATES RENDER NOTHING — the exception rule, holding for
  // the block with every excuse to become furniture.
  const rowStart = strip(screen).indexOf('function MondayReminderRow(');
  const rowEnd = strip(screen).indexOf('\nfunction ', rowStart + 1);
  const row = rowStart >= 0 ? strip(screen).slice(rowStart,
    rowEnd > rowStart ? rowEnd : undefined) : '';
  ok('the reminder row was located and is substantial', row.length > 300, row.length);
  ok('refused, unsigned and unavailable ALL render nothing',
    /reminder\.kind !== 'may_ask' && reminder\.kind !== 'scheduled'/.test(row)
    && /return null/.test(row), row);
}

// ─── [6] The native dependency is declared ───────────────────────────────

// ─── [5b] The proof path — Sam's bench instrument ────────────────────────
//
// Ordered 2026-08-09: a way for SAM (never an athlete) to make the reminder
// fire ~2 minutes from now on his own device.
//
// THE CELLS BELOW GUARD TWO THINGS THAT MATTER MORE THAN THE BUTTONS. First,
// that the proof fires the REAL trigger and the REAL content — a proof that
// built its own would prove its own, and the weekday conversion is exactly the
// byte a hand-written copy gets right by accident. Second, that the proof is
// UNREACHABLE for an athlete, which is the order's own constraint.

console.log('\n[5b] THE PROOF PATH — real objects, and a door an athlete cannot open');
{
  const root = join(__dirname, '..');
  const strip = (text: string) =>
    text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const proof = strip(readFileSync(join(root, 'services', 'journalReminderProof.ts'), 'utf8'));
  const service = strip(readFileSync(
    join(root, 'services', 'journalReminderService.ts'), 'utf8'));
  const screen = strip(readFileSync(join(root, 'screens', 'journal', 'JournalScreen.tsx'), 'utf8'));
  ok('the proof module was read', proof.length > 1000, proof.length);

  // THE REAL OBJECTS, NOT COPIES. `a fixture is a claim too` — the whole value
  // of this path is that it exercises what ships.
  ok('the proof fires the REAL weekly trigger from the service',
    proof.includes('journalReminderWeeklyTrigger()')
    && !/SchedulableTriggerInputTypes\.WEEKLY/.test(proof), proof.match(/WEEKLY/g));
  ok('and the REAL content, so the tap proves the navigation too',
    proof.includes('journalReminderContent()')
    && !proof.includes('Your week is in the Journal'));
  ok('the service exports them rather than holding two copies',
    service.includes('export function journalReminderWeeklyTrigger')
    && service.includes('export function journalReminderContent'));

  // THE SCHEDULER USES THE SAME EXPORTS — otherwise the proof would exercise a
  // trigger the athlete never gets, which is the failure it exists to prevent.
  const scheduleStart = service.indexOf('async function scheduleJournalReminder');
  const scheduleEnd = service.indexOf('\nexport async function', scheduleStart + 1);
  ok('the scheduler was located', scheduleStart > 0 && scheduleEnd > scheduleStart);
  const scheduleFn = service.slice(scheduleStart, scheduleEnd);
  ok('and the REAL scheduler reads the same two exports — one owner each',
    scheduleFn.includes('journalReminderContent()')
    && scheduleFn.includes('journalReminderWeeklyTrigger()'), scheduleFn);

  // A SEPARATE IDENTIFIER, so running the proof can never cancel or overwrite a
  // real pending Monday reminder.
  //
  // THIS CELL SURVIVED ITS OWN MUTATION, AND IT IS THE SAME SHAPE AS N7 IN THIS
  // FILE — the second time in one slice. It asserted that the source mentions
  // `JOURNAL_REMINDER_PROOF_IDENTIFIER`; the mutation changed that constant's
  // VALUE to the athlete's string and left the name alone. **The instrument
  // counted a name, the claim was about two schedule slots being distinct.**
  // Both constants are exported, so the honest assertion is a comparison of
  // VALUES rather than a search for words — and a source scan was never the
  // right tool for a claim two imports could settle.
  // THE VALUES ARE PARSED, NOT IMPORTED, and the reason is worth recording: both
  // modules import `expo-notifications`, which cannot load in node at all. That
  // is exactly why this whole section reads source as text — so the comparison
  // is done on the literals lifted out of it, which is still the VALUE and not
  // the name.
  const literal = (text: string, name: string): string | null =>
    new RegExp(`${name} = '([^']+)'`).exec(text)?.[1] ?? null;
  const realId = literal(service, 'JOURNAL_REMINDER_IDENTIFIER');
  const proofId = literal(proof, 'JOURNAL_REMINDER_PROOF_IDENTIFIER');
  ok('both identifier literals were found — proven present before compared',
    realId !== null && proofId !== null, { realId, proofId });
  ok('the proof\'s identifier is a DIFFERENT string from the athlete\'s',
    realId !== null && proofId !== null && realId !== proofId,
    { proof: proofId, real: realId });

  // THE WEEKDAY CHECK IS THE POINT. A 2-minute fire uses TIME_INTERVAL and
  // never touches the weekday — proving delivery while leaving the one flagged
  // unknown exactly as unproven, which would read as a pass.
  ok('there is a weekday check that asks the OS, not our own arithmetic',
    proof.includes('getNextTriggerDateAsync'));
  ok('and its verdict is the weekday the OS lands on, compared with Monday',
    proof.includes('landsOnMonday')
    && proof.includes('getDay() === JOURNAL_REMINDER_WEEKDAY'));
  ok('the preview schedules nothing and requests nothing',
    !proof.slice(proof.indexOf('export async function previewWeeklyFireDate'),
      proof.indexOf('export async function fireJournalReminderIn'))
      .includes('scheduleNotificationAsync'));

  // UNREACHABLE FOR AN ATHLETE — the order's constraint, at the door.
  ok('the panel is required behind __DEV__',
    /const JournalReminderProofPanel = __DEV__/.test(screen));
  ok('and rendered behind __DEV__ too — the double gate, both halves',
    /\{__DEV__ && JournalReminderProofPanel\s*[&?]/.test(screen));
  ok('the athlete-facing service does not reach the proof module at all',
    !service.includes('journalReminderProof'));
}

console.log('\n[6] THE DEPENDENCY AND THE PLUGIN — Sam rebuilds with pods');
{
  const root = join(__dirname, '..', '..');
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  ok('`expo-notifications` is a real dependency, not an assumed one',
    typeof pkg.dependencies['expo-notifications'] === 'string',
    pkg.dependencies['expo-notifications']);

  // THE PLUGIN IS THE HALF THAT IS EASY TO FORGET, and forgetting it produces a
  // build that compiles, installs, and silently never delivers anything.
  const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8'));
  ok('and the config plugin is registered, so a prebuild wires the native side',
    (app.expo.plugins ?? []).includes('expo-notifications'), app.expo.plugins);
}

console.log(`\njournalReminderTests: ${pass} passed, ${fail} failed`);
totalsPrinted(fail);
console.log('  DEPTH (L13): 0 — a unit sweep over a pure rule plus SOURCE reads of the '
  + 'service, the screen and the navigator. No walked athlete.');
console.log('  NOT COVERED, and it is most of what matters: NO NOTIFICATION HAS EVER BEEN '
  + 'SCHEDULED OR DELIVERED. `expo-notifications` ships native code, so it is absent from '
  + 'the binary Sam is running until he rebuilds with pods — and no cell here calls the '
  + 'notification centre at all. That the permission prompt appears, that iOS accepts a '
  + 'WEEKLY trigger with this shape, that expo\'s Sunday-is-1 weekday numbering is what '
  + 'this code assumes, that the payload survives a cold start, and that tapping the '
  + 'notification lands on the Journal tab are ALL unverified. Everything above proves '
  + 'the DECISION; nothing proves the DELIVERY.');
console.log('  WHAT CHANGED 2026-08-09: the weekday conversion is still UNVERIFIED but it '
  + 'is no longer UNVERIFIABLE. The dev proof panel asks the OS what date the real weekly '
  + 'trigger would next fire and names the weekday it lands on — so the one thing this '
  + 'suite flagged as most likely to be wrong now has an instrument, and it takes Sam a '
  + 'tap rather than a week of waiting. THE CELLS HERE PROVE THE INSTRUMENT IS WIRED TO '
  + 'THE REAL TRIGGER. They do not and cannot run it: only a device with the rebuilt '
  + 'binary can, and until Sam taps it the answer is unknown rather than assumed.');
if (failures.length > 0) console.log(`Failures:\n  - ${failures.join('\n  - ')}`);
