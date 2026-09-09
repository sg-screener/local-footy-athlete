/**
 * COACH RETRIEVAL REGRESSION — the ruling that OWNS a question must be in the
 * rulings the coach is shown (plan slice S2, 2026-09-10).
 *
 * Measured before this suite: the registry was cut into 72-line sliding
 * windows and two windows were allowed per question, chosen by word overlap
 * with the question plus the athlete's readiness words. "can i do leg curls
 * instead of nordics" reached R-394 on one run in two. Now the registry is
 * one chunk per ruling, the athlete's own words seat five rulings before the
 * context fills the rest, and each pair below names the row that owns it.
 *
 * Adding a ruling that owns a new question shape means adding its pair here.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { armTotalsOrRed } from './support/totalsOrRed';
import { COACH_KNOWLEDGE_SOURCE_SPECS } from '../rules/coachKnowledgeManifest';
import { retrieveCoachLabKnowledge } from '../dev/coachLab/coachLabKnowledgeRetriever';
import { coachLabFixtureSnapshot } from '../dev/coachLab/coachLabCases';
import { buildCoachModelInput } from '../rules/coachModelContext';

armTotalsOrRed();

const ROOT = resolve(__dirname, '../..');
let passed = 0;
let failed = 0;

function ok(name: string, condition: unknown, detail?: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL ${name}${detail === undefined ? '' : `\n      ${JSON.stringify(detail)}`}`);
}

const sources = COACH_KNOWLEDGE_SOURCE_SPECS.map((source) => ({
  ...source,
  content: readFileSync(resolve(ROOT, source.path), 'utf8'),
}));

/** The Lab athlete, with today's session rows filled the way the phone fills them. */
function fixtureWithRows() {
  const base = coachLabFixtureSnapshot() as unknown as {
    visibleWeek: { days: { parts: { rows: unknown[] }[] }[] };
  };
  base.visibleWeek.days[0].parts[0].rows = [
    { name: 'Back Squat', prescription: '4 x 5', dose: ['4 sets', '5 reps'], cue: '' },
    { name: 'Romanian Deadlift', prescription: '3 x 8', dose: ['3 sets', '8 reps'], cue: '' },
    { name: 'Nordic Curl', prescription: '3 x 4', dose: ['3 sets', '4 reps'], cue: '' },
  ];
  return base as unknown as ReturnType<typeof coachLabFixtureSnapshot>;
}

function rulingsFor(message: string): readonly string[] {
  const snapshot = buildCoachModelInput({ athleteMessage: message, snapshot: fixtureWithRows() })
    .currentAthleteSnapshot;
  return retrieveCoachLabKnowledge({ athleteMessage: message, snapshot, sources }).chunks
    .filter((chunk) => chunk.authority === 'active_rule')
    .map((chunk) => chunk.ruling ?? chunk.id);
}

/** question → the ruling(s) that own the answer; any one of them suffices. */
const PAIRS: readonly { readonly message: string; readonly owners: readonly string[]; readonly why: string }[] = [
  { message: 'can i do leg curls instead of nordics', owners: ['R-394'], why: 'in season a curl does not replace the Nordic' },
  { message: 'is this a deload week', owners: ['R-310', 'R-063'], why: 'a genuine deload reduces the whole visible week' },
  { message: 'im sick should i train', owners: ['R-037', 'R-038'], why: 'the three sick doors' },
  { message: 'im away next week with no gym', owners: ['R-018', 'R-020', 'R-075'], why: 'away follows the same program or reselects' },
  { message: 'i missed mondays session', owners: ['R-275', 'R-227'], why: 'missed-session move and fatigue sequence' },
  { message: 'dont have a barbell today', owners: ['R-212', 'R-072', 'R-102'], why: 'session equipment asks what is available today' },
  { message: 'whats in the gunshow', owners: ['R-052', 'R-236'], why: 'gunshow composition' },
  { message: 'how much should i lift to start with', owners: ['R-026'], why: 'starting load is 50% of calculated' },
  { message: 'do i have to sprint every week', owners: ['R-062', 'R-311', 'R-330'], why: 'the year-round sprint minimum' },
  // 'change of direction' in words does not reach R-003 (the row says COD); a
  // vocabulary miss keyword retrieval cannot close — recorded, not asserted.
  { message: 'can i do cod drills this week', owners: ['R-003', 'R-329', 'R-331'], why: 'the COD gate, or the COD rows it governs' },
  { message: 'what happens to training over christmas', owners: ['R-002', 'R-004'], why: 'the Christmas break' },
  { message: 'i can only get to the gym twice a week now', owners: ['R-235', 'R-237', 'R-105'], why: 'gym days are what the athlete lists; the reduction lives in the coach' },
  { message: 'why are rdls and nordics in the same session', owners: ['R-233'], why: 'RDLs and Nordics together, not RDL and single-leg RDL' },
  { message: 'should wednesday be harder than a flush in season', owners: ['R-395', 'R-265'], why: 'one Monday/Wednesday session may be harder than a flush' },
];

console.log('\n[1] THE OWNING RULING IS IN THE RULINGS THE COACH IS SHOWN');
for (const pair of PAIRS) {
  const shown = rulingsFor(pair.message);
  ok(`"${pair.message}" reaches ${pair.owners.join(' or ')} (${pair.why})`,
    pair.owners.some((owner) => shown.includes(owner)), shown);
}

console.log('\n[1b] SORENESS IS OWNED BY THE BIBLE, AND THE BIBLE ROW IS SHOWN');
{
  const message = 'my quads are sore from monday is that ok';
  const snapshot = buildCoachModelInput({ athleteMessage: message, snapshot: fixtureWithRows() })
    .currentAthleteSnapshot;
  const chunks = retrieveCoachLabKnowledge({ athleteMessage: message, snapshot, sources }).chunks;
  ok('a soreness question shows a Bible excerpt that speaks of soreness',
    chunks.some((chunk) => chunk.authority === 'lfa_bible' && /sorenes/i.test(chunk.content)),
    chunks.map((chunk) => chunk.id));
}

console.log('\n[2] THE REGISTRY IS ONE CHUNK PER RULING, AND EIGHT RULINGS FIT');
{
  const shown = rulingsFor('can i do leg curls instead of nordics');
  ok('every registry chunk shown names exactly one ruling', shown.every((id) => /^R-\d{3}$/.test(id)), shown);
  ok('up to eight rulings are shown, not two', shown.length >= 6 && shown.length <= 8, shown.length);
  ok('the question seats its own rulings: the Nordic row is shown for the Nordic question',
    shown.includes('R-394'));
}

console.log(`\nCoach retrieval regression totals: ${passed} passed, ${failed} failed`);
console.log('  NOT COVERED: this suite proves which rulings reach the prompt, not what the model says with them (Coach Lab tapes own that).');
process.exit(failed === 0 ? 0 : 1);
