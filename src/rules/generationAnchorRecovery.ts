/**
 * RECOVERING A GENERATION ANCHOR FROM A WORLD THAT NEVER STORED ONE.
 *
 * **A real device could not open.** Sam's install-over world, 2026-08-09:
 *
 *   [boot][hydration] the derived-world rebuild failed
 *   {"error":{"code":"missing_generation_anchor"}}
 *
 * and Try Again was correctly useless, because the refusal is deterministic.
 *
 * WHY HIS WORLD HAS NO ANCHOR — root-caused, with receipts.
 * "THE ANCHOR RIDES THE PROGRAM IT ANCHORS" (Sam, 2026-08-06,
 * `programStore.ts:1996`). `generationAnchorForProgram` reads
 * `program.generationAnchorISO` and returns null when the field is absent, and
 * `generateProgram.ts:998` is what stamps it. **A program generated before that
 * ruling carries no such field**, so the store hydrates `null`, and the
 * old-shape envelope migration faithfully carries the absence forward
 * (`programStore.ts:361`, `state.generationAnchorISO ?? null`). A world built
 * across pre-anchor eras therefore reaches the boot with no anchor **anywhere**,
 * and `quiescentBoot.ts:333` refuses by design.
 *
 * THE REFUSAL IS RIGHT AND MUST STAY. The no-fallback comment above that line
 * records what `?? todayISOLocal()` cost: it was not a fallback, it was the
 * only branch that ever ran, and it re-anchored every worn athlete's program to
 * today and deleted the week they were in. **Nothing here may consult the
 * device clock.**
 *
 * SO THE WORLD IS ASKED WHAT IT REMEMBERS INSTEAD — the
 * `preRebuildEnvelopeMigration` precedent: when the old world stored a RESULT
 * whose intent nobody recorded, the honest move is to read the result rather
 * than invent the intent. A program's own microcycles testify to when it was
 * generated; a ledger's oldest decision testifies to when the athlete first
 * acted. Both are FACTS the world already holds.
 *
 * A world with NO evidence at all is still refused, and that is the boundary:
 * this recovers an anchor that exists implicitly, and never manufactures one.
 */

import type { DecisionLedgerEntry } from '../types/decisionLedger';

/** Where a recovered anchor came from. Reported, never guessed at later. */
export type GenerationAnchorEvidence =
  /** The program's own recorded anchor — not a recovery at all. */
  | 'stored_anchor'
  /** The earliest week the stored program actually holds. */
  | 'earliest_microcycle_start'
  /** The earliest decision the athlete is recorded as making. */
  | 'earliest_ledger_decision';

export interface RecoveredGenerationAnchor {
  anchorISO: string;
  evidence: GenerationAnchorEvidence;
}

interface AnchorWorld {
  storedAnchorISO?: string | null;
  program?: {
    generationAnchorISO?: string;
    microcycles?: ReadonlyArray<{ startDate?: string }>;
  } | null;
  ledger?: readonly DecisionLedgerEntry[];
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Total by construction: a persisted payload's shape is never trusted here. */
function day(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const candidate = value.slice(0, 10);
  return ISO_DAY.test(candidate) ? candidate : null;
}

/**
 * The anchor this world testifies to, or null.
 *
 * ORDER IS THE CLAIM, STRONGEST EVIDENCE FIRST:
 *
 * 1. **A stored anchor** is not evidence, it IS the anchor. Present for every
 *    world built after 2026-08-06.
 * 2. **The earliest microcycle start.** The program's own geometry. Generation
 *    anchors to a day and lays weeks from the Monday of it, so the earliest
 *    week start is the closest thing the world holds to the day it was built —
 *    and re-generating from it reproduces the same week boundaries, which is
 *    the property that matters. It cannot drift forward the way a clock can.
 * 3. **The earliest ledger decision.** Only reached when a world has decisions
 *    but no readable program — a shape that should not exist, kept because a
 *    world that can be opened is worth more than a tidy branch count.
 *
 * NOT USED, EVER: the device clock, `todayISOLocal`, or anything derived from
 * them. Re-anchoring to today is the defect this whole module exists beside.
 */
export function recoverGenerationAnchor(
  world: AnchorWorld,
): RecoveredGenerationAnchor | null {
  const stored = day(world.storedAnchorISO) ?? day(world.program?.generationAnchorISO);
  if (stored) return { anchorISO: stored, evidence: 'stored_anchor' };

  const starts = (world.program?.microcycles ?? [])
    .map((microcycle) => day(microcycle?.startDate))
    .filter((value): value is string => value !== null)
    .sort();
  if (starts.length > 0) {
    return { anchorISO: starts[0]!, evidence: 'earliest_microcycle_start' };
  }

  const decisions = (world.ledger ?? [])
    .map((entry) => day(entry?.occurredAt))
    .filter((value): value is string => value !== null)
    .sort();
  if (decisions.length > 0) {
    return { anchorISO: decisions[0]!, evidence: 'earliest_ledger_decision' };
  }

  // A WORLD THAT TESTIFIES TO NOTHING IS STILL REFUSED. There is no honest
  // anchor to recover, and inventing one is the forbidden move.
  return null;
}
