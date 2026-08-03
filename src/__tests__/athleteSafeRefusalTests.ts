/**
 * athleteSafeRefusal — the display gate that keeps raw internal transaction
 * reasons off the athlete's screen.
 *
 * L10 device finding (2026-07-24): a no-op Wednesday session move surfaced the
 * literal internal diagnostic "The deterministic executor did not apply a
 * candidate." straight into the PlanChangeSheet result step
 * (programControlActions.ts returned `transaction.reason` verbatim as the
 * user-facing message). Internal reasons — executor/candidate/fingerprint/
 * accepted-state diagnostics and snake_case route codes — must never reach the
 * athlete; they resolve to one honest fallback sentence instead. Athlete-framed
 * domain copy (the game-day/cap sentences riskReason already owns) passes
 * through untouched.
 *
 * Run: npm run test:athlete-safe-refusal
 */

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import { athleteSafeRefusal } from '../utils/planChangeRefusalCopy';

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

console.log('\n[athlete-safe refusal] raw internal reasons never reach the athlete');
{
  const fallback = athleteSafeRefusal(undefined);

  ok('an undefined reason yields the safe fallback', typeof fallback === 'string' && fallback.length > 0);
  ok('an empty/whitespace reason yields the safe fallback', athleteSafeRefusal('   ') === fallback);

  // The exact strings coachMutationTransaction can emit.
  ok(
    'the deterministic-executor diagnostic is replaced',
    athleteSafeRefusal('The deterministic executor did not apply a candidate.') === fallback,
  );
  ok(
    'the accepted-state candidate diagnostic is replaced',
    athleteSafeRefusal('The candidate changed accepted state before returning a failure.') === fallback,
  );
  ok(
    'the presentation/programming-field diagnostic is replaced',
    athleteSafeRefusal('Only presentation fields changed; no programming field changed.') === fallback,
  );
  ok(
    'a snake_case route code is replaced',
    athleteSafeRefusal('coach_mutation_not_applied') === fallback,
  );
  ok(
    'a durable-transaction developer message is replaced',
    athleteSafeRefusal('Illness reports require the durable source-fact transaction.') === fallback,
  );
  ok(
    'a raw §18 rejection string is replaced',
    athleteSafeRefusal('Section 18 final-week rejection (full_rest_miscount:full_rest:"active recovery cannot be full rest")') === fallback,
  );
  ok(
    'an embedded snake_case diagnostic token is replaced',
    athleteSafeRefusal("I couldn't add a session: full_rest_miscount shortfall") === fallback,
  );

  // Athlete-framed domain copy passes straight through.
  ok(
    'a game-day refusal sentence passes through unchanged',
    athleteSafeRefusal('This puts hard work too close to game day.') ===
      'This puts hard work too close to game day.',
  );
  ok(
    'a cap sentence passes through unchanged',
    athleteSafeRefusal("This gives you 4 hard days this week. That's the upper edge.") ===
      "This gives you 4 hard days this week. That's the upper edge.",
  );
  ok('the fallback itself is athlete-safe (idempotent)', athleteSafeRefusal(fallback) === fallback);
}

console.log(`\n${passed} passed, ${failures.length} failed`);
totalsPrinted(failures.length);
if (failures.length > 0) process.exit(1);
