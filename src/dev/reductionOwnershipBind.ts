/**
 * THE EQUALITY BIND FOR REDUCTION OWNERSHIP — seat ruling, 2026-08-07.
 *
 * The restoration consumers now DERIVE which of a week's authorised reductions
 * an adjustment owns, from the constraint ids the adjustment records, instead
 * of reading the stored `linkedTypedReductions` mirror. The seat's (c) is that
 * Restore's meaning is the signed behaviour being PROTECTED, not changed, and
 * that the equality bind IS the proof:
 *
 *   > If equality fails on any witness, STOP with the row named.
 *
 * So both answers are computed at every consumer call and compared. This module
 * records agreement, and — the part that matters — records every DISAGREEMENT
 * verbatim, with the week, the adjustment kind, and the reduction rows on each
 * side. A count of divergences would be the same
 * `a-count-taken-for-a-record` error this unit just paid for, so the rows
 * travel with the count.
 *
 * ALWAYS ON IN-PROCESS (the comparison is two small set builds); it only WRITES
 * when `LFA_OWNERSHIP_BIND` names a file. A bind that were flag-gated in the
 * comparison itself could not be relied on to have run.
 */
const OUT_PATH = process.env.LFA_OWNERSHIP_BIND ?? '';

interface ReductionRow {
  metric?: unknown;
  reason?: unknown;
  originalApprovedTarget?: unknown;
  reducedTarget?: unknown;
  deletionIdentity?: unknown;
}

const control = {
  calls: 0,
  callsAtReverse: 0,
  callsAtRecompose: 0,
  callsWithConstraintIds: 0,
  callsWithoutConstraintIds: 0,
  contractReductionsSeen: 0,
  derivedTotal: 0,
  storedTotal: 0,
  /** Mirror entries naming rows the contract in hand does not carry. */
  storedNamingAbsentRows: 0,
};

const results = {
  /** Both sides name exactly the same reductions. */
  equal: 0,
  /** Both sides name nothing — equal, but recorded apart so it is never
   * mistaken for a proof that anything was compared. */
  equalBothEmpty: 0,
  /** THE STOP CONDITION. */
  divergent: 0,
  divergentDerivedOnly: 0,
  divergentStoredOnly: 0,
  byKind: {} as Record<string, number>,
  divergenceByKind: {} as Record<string, number>,
  /** Verbatim divergences — a count is not a record. */
  divergences: [] as Array<{
    site: string;
    weekStart: string;
    adjustmentKind: string;
    constraintIds: string[];
    derivedOnly: string[];
    storedOnly: string[];
    contractRows: string[];
  }>,
};

function bump(bucket: Record<string, number>, name: string): void {
  bucket[name] = (bucket[name] ?? 0) + 1;
}

function describe(entry: ReductionRow): string {
  return [entry.metric, entry.reason, entry.originalApprovedTarget,
    entry.reducedTarget, entry.deletionIdentity ?? null].join('|');
}

export function bindOwnership(args: {
  site: 'reverse' | 'recompose';
  weekStart: string;
  adjustmentKind: string;
  constraintIds: readonly string[];
  /** The week's authorised reductions, each with the fingerprint the consumers
   * match on — the only rows either method can ever act upon. */
  rows: ReadonlyArray<{ fingerprint: string; entry: ReductionRow }>;
  derived: ReadonlySet<string>;
  stored: ReadonlySet<string>;
}): void {
  control.calls += 1;
  if (args.site === 'reverse') control.callsAtReverse += 1;
  else control.callsAtRecompose += 1;
  if (args.constraintIds.length > 0) control.callsWithConstraintIds += 1;
  else control.callsWithoutConstraintIds += 1;
  control.contractReductionsSeen += args.rows.length;

  // WHAT EACH METHOD ACTUALLY SELECTS from the contract in hand.
  const derivedRows = args.rows.filter((row) => args.derived.has(row.fingerprint));
  const storedRows = args.rows.filter((row) => args.stored.has(row.fingerprint));
  control.derivedTotal += derivedRows.length;
  control.storedTotal += storedRows.length;
  // Mirror entries naming rows this contract does not carry. Recorded, because
  // "the mirror is stale" is a finding in its own right even though neither
  // consumer can act on them.
  control.storedNamingAbsentRows += args.stored.size - storedRows.length;
  bump(results.byKind, args.adjustmentKind);

  const derivedKeys = new Set(derivedRows.map((row) => row.fingerprint));
  const storedKeys = new Set(storedRows.map((row) => row.fingerprint));
  const derivedOnly = derivedRows.filter((row) => !storedKeys.has(row.fingerprint));
  const storedOnly = storedRows.filter((row) => !derivedKeys.has(row.fingerprint));

  if (derivedOnly.length === 0 && storedOnly.length === 0) {
    if (derivedRows.length === 0) results.equalBothEmpty += 1;
    else results.equal += 1;
    return;
  }
  results.divergent += 1;
  if (derivedOnly.length > 0) results.divergentDerivedOnly += 1;
  if (storedOnly.length > 0) results.divergentStoredOnly += 1;
  bump(results.divergenceByKind, args.adjustmentKind);
  if (results.divergences.length < 60) {
    results.divergences.push({
      site: args.site,
      weekStart: args.weekStart,
      adjustmentKind: args.adjustmentKind,
      constraintIds: [...args.constraintIds],
      derivedOnly: derivedOnly.map((row) => describe(row.entry)),
      storedOnly: storedOnly.map((row) => describe(row.entry)),
      // The contract rows in hand, so a divergence can be read without
      // re-running: a fingerprint alone names nothing a human can check.
      contractRows: args.rows.map((row) => describe(row.entry)),
    });
  }
}

/**
 * The bind's live counters, for a harness cell that must prove it EXERCISED the
 * comparison rather than merely not failing it. A bind cell asserting only
 * `divergent === 0` passes in a world where the consumer never ran — the
 * `gate-passing-on-coordinates-it-never-builds` shape. Assert `equal` moved.
 */
export function snapshotOwnershipBind(): {
  calls: number; equal: number; equalBothEmpty: number; divergent: number;
  derivedTotal: number; storedTotal: number;
} {
  return {
    calls: control.calls,
    equal: results.equal,
    equalBothEmpty: results.equalBothEmpty,
    divergent: results.divergent,
    derivedTotal: control.derivedTotal,
    storedTotal: control.storedTotal,
  };
}

export function writeOwnershipBind(tag: string): void {
  if (!OUT_PATH) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs') as typeof import('fs');
    const suite = (process.argv[1] ?? '').split('/').pop() ?? 'unknown';
    fs.appendFileSync(OUT_PATH, `${JSON.stringify({
      tag, suite, control: { ...control }, results,
    })}\n`);
  } catch {
    // ignored
  }
}

if (OUT_PATH) {
  process.on('exit', () => writeOwnershipBind(process.env.LFA_OWNERSHIP_TAG ?? 'run'));
}
