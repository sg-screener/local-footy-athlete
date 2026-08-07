/**
 * TALLY — the `a-count-taken-for-a-record` compression, seat-endorsed
 * 2026-08-07.
 *
 * THE LOOP THIS CLOSES, at its third sighting:
 *   1. "3 red both sides" hid one cell improving and two regressing.
 *   2. A `| tail -3` totals line said six-for-six green while four suites
 *      exited 1.
 *   3. "159 athlete-removal DECISIONS the ledger does not record" was 330
 *      per-store-write OCCURRENCES of 40 reduction rows authored by 23
 *      decisions — and it became the premise of a whole ruling before the
 *      write side refuted it.
 *
 * THE STANDING RULE:
 *
 *   > A number reported by an instrument names the INSTRUMENT'S unit, not the
 *   > domain noun. Before a count enters a ruling, state its unit and its
 *   > denominator, and give the distinct count of the domain object beside it.
 *
 * A `Tally` makes obeying it cheaper than not. It cannot report a bare number:
 * every `add` supplies the domain object's identity, and the serialised form
 * always carries `occurrences`, `distinct`, and the NAME of the dedup key, so a
 * reader of the output can never mistake one for the other. Where a measurement
 * has two meaningful identities — a reduction row and the decision that
 * authored it — pass both and both are counted.
 *
 * This is a reporting instrument, not product code. Nothing outside `src/dev`
 * and the test harness may import it.
 */

export interface TallySnapshot {
  /** What one `add` means, in words. Written into the output. */
  unit: string;
  /** Every `add`, including repeats. The number an unguarded loop produces. */
  occurrences: number;
  /** Distinct values of the primary identity. */
  distinct: number;
  /** What `distinct` counts, in words. */
  distinctKey: string;
  /** Optional coarser identity — e.g. rows vs the decisions behind them. */
  distinctSecondary?: number;
  secondaryKey?: string;
  /** Breakdown by an arbitrary label, in DISTINCT terms. */
  byLabel: Record<string, number>;
}

export class Tally {
  private occurrences = 0;
  private readonly seen = new Set<string>();
  private readonly seenSecondary = new Set<string>();
  private readonly byLabel: Record<string, number> = {};

  constructor(
    private readonly unit: string,
    private readonly distinctKey: string,
    private readonly secondaryKey?: string,
  ) {}

  /**
   * Record one sighting.
   *
   * @param identity the domain object's identity — what `distinct` counts.
   * @param secondary an optional coarser identity (the decision behind a row).
   * @param label an optional breakdown bucket, counted in DISTINCT terms so a
   *   ranked list never inherits the occurrence inflation.
   * @returns true when this identity is newly seen.
   */
  add(identity: string, options?: { secondary?: string; label?: string }): boolean {
    this.occurrences += 1;
    if (options?.secondary !== undefined) this.seenSecondary.add(options.secondary);
    if (this.seen.has(identity)) return false;
    this.seen.add(identity);
    if (options?.label !== undefined) {
      this.byLabel[options.label] = (this.byLabel[options.label] ?? 0) + 1;
    }
    return true;
  }

  snapshot(): TallySnapshot {
    return {
      unit: this.unit,
      occurrences: this.occurrences,
      distinct: this.seen.size,
      distinctKey: this.distinctKey,
      ...(this.secondaryKey
        ? { distinctSecondary: this.seenSecondary.size, secondaryKey: this.secondaryKey }
        : {}),
      byLabel: { ...this.byLabel },
    };
  }

  /**
   * The one-line form for a report or a commit message. Never prints a lone
   * number, which is the whole point.
   */
  describe(): string {
    const snapshot = this.snapshot();
    const secondary = snapshot.distinctSecondary === undefined
      ? ''
      : ` = ${snapshot.distinctSecondary} ${snapshot.secondaryKey}`;
    return `${snapshot.occurrences} ${snapshot.unit} = ` +
      `${snapshot.distinct} ${snapshot.distinctKey}${secondary}`;
  }
}
