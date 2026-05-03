/**
 * Athlete Scenario QA Harness — main entry point.
 *
 * Run:
 *   npm run qa:athlete            (personas + sweep, human report, exit non-zero on fail)
 *   npm run qa:athlete -- --only=in-season-game-removed   (filter to one persona)
 *   npm run qa:athlete -- --no-sweep                       (skip combinatorial sweep)
 *   npm run qa:athlete -- --verbose                        (print weekly plan for every step, not just failures)
 *
 * Output format (per failure):
 *   ❌ <scenario name>
 *      action path: onboard → shift→In-season → removeGame
 *      step #N (<action>):
 *        FAIL [<rule>] <detail>
 *      week shape:
 *          Mon | Tue | Wed | Thu | Fri | Sat | Sun
 *          ... (tier + focus per day)
 */

import { runScenario, describeActionPath } from './actions';
import { PERSONA_SCENARIOS } from './personas';
import { generateSweepScenarios } from './sweep';
import { STANDARD_INVARIANTS } from './invariants';
import type { Scenario, ScenarioResult, StepResult } from './types';
import { describeAction } from './types';

// ─────────────────────────────────────────────────────────────────
// Args
// ─────────────────────────────────────────────────────────────────

interface Args {
  only: string | null;
  noSweep: boolean;
  verbose: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { only: null, noSweep: false, verbose: false };
  for (const a of argv) {
    if (a.startsWith('--only=')) args.only = a.slice('--only='.length);
    else if (a === '--no-sweep') args.noSweep = true;
    else if (a === '--verbose') args.verbose = true;
  }
  return args;
}

// ─────────────────────────────────────────────────────────────────
// Output formatting
// ─────────────────────────────────────────────────────────────────

const C = {
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatWeekShape(step: StepResult): string {
  const lines: string[] = [];
  lines.push('  ' + DAY_SHORT.map((d) => d.padEnd(28)).join('| '));
  const cells = DAYS.map((d) => {
    const s = step.plan.weeklyPlan.find((p) => p.dayOfWeek === d);
    if (!s) return C.dim('—');
    const tier = s.tier.toUpperCase().padEnd(8);
    const focus = (s.focus || '').substring(0, 18);
    return `[${tier}]${focus}`;
  });
  lines.push('  ' + cells.map((c) => c.padEnd(28)).join('| '));
  return lines.join('\n');
}

function formatScenarioFailure(result: ScenarioResult): string {
  const out: string[] = [];
  out.push('');
  out.push(C.red('❌ ' + C.bold(result.scenario.name)));
  if (result.scenario.intent) out.push('   ' + C.dim('intent: ' + result.scenario.intent));
  out.push('   ' + C.dim('actions: ') + describeActionPath(result.scenario.actions));

  result.steps.forEach((step, i) => {
    const failed = step.invariants.filter((r) => !r.passed);
    if (failed.length === 0) return;
    out.push('');
    out.push(`   ${C.yellow(`step #${i + 1}`)} (${describeAction(step.action)})`);
    for (const f of failed) {
      out.push(`     ${C.red('FAIL')} [${f.rule}]`);
      out.push(`       ${f.detail}`);
    }
    // Show expected vs actual week shape — context for the diff.
    out.push('   ' + C.dim('week shape after this step:'));
    out.push(formatWeekShape(step));
  });
  return out.join('\n');
}

function formatVerboseScenario(result: ScenarioResult): string {
  const out: string[] = [];
  const status = result.passed ? C.green('✅') : C.red('❌');
  out.push('');
  out.push(`${status} ${C.bold(result.scenario.name)}`);
  if (result.scenario.intent) out.push('   ' + C.dim(result.scenario.intent));
  out.push('   ' + C.dim('actions: ') + describeActionPath(result.scenario.actions));
  result.steps.forEach((step, i) => {
    out.push(`   step #${i + 1} (${describeAction(step.action)})`);
    out.push(formatWeekShape(step));
    for (const inv of step.invariants) {
      const tick = inv.passed ? C.green('✓') : C.red('✗');
      out.push(`     ${tick} [${inv.rule}] ${inv.detail}`);
    }
  });
  return out.join('\n');
}

// ─────────────────────────────────────────────────────────────────
// Runner
// ─────────────────────────────────────────────────────────────────

function runAll(scenarios: Scenario[]): ScenarioResult[] {
  return scenarios.map((s) => runScenario(s, s.invariants ?? STANDARD_INVARIANTS));
}

function summarise(label: string, results: ScenarioResult[]): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  for (const r of results) {
    if (r.passed) passed++;
    else failed++;
  }
  const status = failed === 0 ? C.green('✓') : C.red('✗');
  console.log(`${status} ${label}: ${passed}/${results.length} scenarios passed${failed > 0 ? `, ${C.red(`${failed} failed`)}` : ''}`);
  return { passed, failed };
}

/**
 * The engine emits unconditional [ENGINE-TRACE] / [ENGINE-VALIDATE]
 * logs that pollute the QA report. Wrap a scope so they're swallowed
 * but everything else still prints normally. Restored in finally.
 *
 * Note: ENGINE-VALIDATE lines surface real engine-detected invariant
 * violations + emergency promotions. They're useful in dev but for the
 * QA report we want our own assertions to be the signal.
 */
const NOISY_PREFIXES = ['[ENGINE-TRACE]', '[ENGINE-VALIDATE]'];

function withSilencedEngineTrace<T>(fn: () => T): T {
  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;
  const filter = (orig: typeof console.log) => (...args: unknown[]) => {
    const first = args[0];
    if (typeof first === 'string' && NOISY_PREFIXES.some((p) => first.startsWith(p))) return;
    orig.apply(console, args as []);
  };
  console.log = filter(origLog);
  console.warn = filter(origWarn);
  console.error = filter(origError);
  try {
    return fn();
  } finally {
    console.log = origLog;
    console.warn = origWarn;
    console.error = origError;
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log(C.bold('Athlete Scenario QA Harness'));
  console.log(C.dim('────────────────────────────'));

  // ── Personas ──
  const personas = args.only
    ? PERSONA_SCENARIOS.filter((s) => s.name.includes(args.only!))
    : PERSONA_SCENARIOS;
  if (args.only && personas.length === 0) {
    console.log(C.red(`No persona matches --only=${args.only}`));
    process.exit(2);
  }
  console.log(`\nRunning ${personas.length} persona scenarios...`);
  const personaResults = withSilencedEngineTrace(() => runAll(personas));

  if (args.verbose) {
    for (const r of personaResults) console.log(formatVerboseScenario(r));
  } else {
    for (const r of personaResults) {
      if (!r.passed) console.log(formatScenarioFailure(r));
    }
  }
  const personaSummary = summarise('Personas', personaResults);

  // ── Sweep ──
  let sweepSummary = { passed: 0, failed: 0 };
  if (!args.noSweep && !args.only) {
    const sweepScenarios = generateSweepScenarios();
    console.log(`\nRunning ${sweepScenarios.length} combinatorial sweep scenarios (sanity-only)...`);
    const sweepResults = withSilencedEngineTrace(() => runAll(sweepScenarios));
    for (const r of sweepResults) {
      if (!r.passed) console.log(formatScenarioFailure(r));
    }
    sweepSummary = summarise('Sweep', sweepResults);
  } else if (args.only) {
    console.log(C.dim('\nSweep skipped (--only filter active)'));
  } else {
    console.log(C.dim('\nSweep skipped (--no-sweep)'));
  }

  // ── Final ──
  console.log(C.dim('\n────────────────────────────'));
  const totalFailed = personaSummary.failed + sweepSummary.failed;
  if (totalFailed === 0) {
    console.log(C.green(C.bold('All scenarios passed.')));
    process.exit(0);
  } else {
    console.log(C.red(C.bold(`${totalFailed} scenario(s) failed.`)));
    process.exit(1);
  }
}

try {
  main();
} catch (e: any) {
  console.error(C.red('Harness crashed:'), e?.stack || e?.message || e);
  process.exit(2);
}
