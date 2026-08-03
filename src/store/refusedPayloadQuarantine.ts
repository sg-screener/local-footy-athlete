/**
 * A REFUSAL MUST NEVER PERSIST THE STATE IT REFUSED INTO (Sam, 2026-07-30).
 *
 * The profile-mirror wipe law, generalised to every persisted store after it
 * recurred at the program store. On 2026-07-29 hydration read revision 43
 * intact, the acceptance transaction refused and rolled back cleanly — and
 * fourteen seconds later, after the boot gate timed out and the error screen's
 * Try Again ran a second cycle from an empty baseline, that empty baseline was
 * written over the only copy of the athlete's program.
 *
 * Nothing was wrong with the refusal or the rollback. What was missing was
 * anywhere for the refused payload to BE: it existed only in memory and in an
 * envelope no writer was told to protect. This module is that place.
 *
 * TWO RULES, AND THEY ARE THE WHOLE MODULE:
 *
 *   1. A refused payload is HELD, byte for byte, exactly as it was on disk when
 *      it was refused. Held — not repaired here, not reduced here, not reported
 *      here. Those are decisions for the lift, and a quarantine that edits what
 *      it holds is not a quarantine.
 *   2. While a store holds one, that store will not persist a payload with LESS
 *      material in it. A bare fallback is unpersistable while the athlete's real
 *      state is the thing being held.
 *
 * IN MEMORY ONLY, DELIBERATELY. A quarantine that outlived the process would
 * turn a transient refusal into a permanent block on writing, and a fresh
 * install — delete the app, onboard again — must be completely unaffected. The
 * quarantine dies with the process, exactly like the refusal that created it.
 *
 * PER STORE, NOT PER CALL. Each persisted store registers ONE writer boundary
 * and ONE question — "does this payload carry the athlete's material?" — because
 * the wipe is a property of a store's writer, not of any individual caller. A
 * store with no registration cannot be protected, which is what makes the
 * registry auditable: `storedStateWriterAudit` enumerates every persisted store
 * and fails when one has no boundary.
 */

export interface QuarantineRegistration {
  /**
   * Does this serialized envelope carry the athlete's material state?
   *
   * Deliberately a question about the PAYLOAD, not about the live store: the
   * writer boundary sees bytes on their way to disk, and bytes are what the wipe
   * destroyed. Returning false for an unparseable payload is correct — an
   * envelope we cannot read is not one we can prove carries anything.
   */
  readonly carriesMaterial: (serializedEnvelope: string) => boolean;
}

const registrations = new Map<string, QuarantineRegistration>();
const quarantined = new Map<string, string>();

export function registerQuarantineBoundary(
  storeKey: string,
  registration: QuarantineRegistration,
): void {
  registrations.set(storeKey, registration);
}

/** Every store that has declared a writer boundary. Used by the L12 audit. */
export function quarantineBoundaryKeys(): readonly string[] {
  return Array.from(registrations.keys()).sort();
}

/**
 * Hold what was refused.
 *
 * `envelope` must be what is ON DISK at the moment of refusal, not what is in
 * memory — the in-memory state after a rollback is a restoration of the same
 * thing, but the disk copy is the one a later writer can destroy, and it is the
 * one the athlete actually still has.
 *
 * A null or empty envelope quarantines nothing: there is no payload to protect,
 * and holding "nothing" would block every subsequent write for no reason.
 */
export function quarantineRefusedPayload(storeKey: string, envelope: string | null): void {
  if (!envelope) return;
  const registration = registrations.get(storeKey);
  if (!registration) return;
  if (!registration.carriesMaterial(envelope)) return;
  quarantined.set(storeKey, envelope);
}

export function quarantinedPayload(storeKey: string): string | null {
  return quarantined.get(storeKey) ?? null;
}

/**
 * Let the payload go.
 *
 * Called when a write carries material — the lift, repair or re-acceptance
 * succeeded and the athlete's state is safely on disk again — and by an explicit
 * athlete act that legitimately empties a store (profile reset, program delete).
 * Releasing on a MATERIAL write rather than on "any successful transaction" is
 * deliberate: the transaction that follows a refusal is exactly the one that
 * wiped him, and its success is not evidence that his program survived it.
 */
export function releaseQuarantine(storeKey: string): void {
  quarantined.delete(storeKey);
}

/** Test/reset seam — a fresh install has no quarantine by construction. */
export function clearAllQuarantines(): void {
  quarantined.clear();
}

export interface QuarantineWriteDecision {
  readonly allowed: boolean;
  readonly reason?: string;
}

/**
 * The guarded persistence write, shared by every armoured store's storage
 * wrapper (2026-08-03, found by onboardingReliabilityTests B2 the day its
 * silent exit was repaired).
 *
 * WHY THIS IS NOT async/await: zustand's persist middleware fire-and-forgets
 * (`void setItem(...)`). An `async` wrapper returns a NEW promise nobody
 * handles, so a failing device write became an UNHANDLED REJECTION — a crash
 * on the exact path the armour exists to protect. Returning the base write's
 * own promise keeps the compat layer's handling semantics (its tracked chain
 * is already caught, and `flushPendingStorageWrites` still re-raises for
 * callers who await durability). Nine stores carried nine copies of the
 * async wrapper; this is the one owner that replaces them.
 */
export function guardedDurableWrite(args: {
  storeKey: string;
  envelope: string;
  base: { setItem(name: string, value: string): Promise<void> };
  /** Tape + log the refusal; the write itself resolves without travelling. */
  onRefused: (reason: string) => void;
}): Promise<void> {
  const decision = decideQuarantinedWrite(args.storeKey, args.envelope);
  if (!decision.allowed) {
    args.onRefused(decision.reason ?? `refused_payload_quarantined:${args.storeKey}`);
    return Promise.resolve();
  }
  releaseQuarantine(args.storeKey);
  return args.base.setItem(args.storeKey, args.envelope);
}

/**
 * The one question every registered writer boundary asks before it writes.
 *
 * Refuses exactly one thing: a payload with no material, while a payload WITH
 * material is being held for this store. Everything else is allowed, including
 * writes that change the material — a lift is supposed to change it, and a
 * quarantine that blocked the repair would strand the athlete as surely as the
 * wipe destroyed him.
 */
export function decideQuarantinedWrite(
  storeKey: string,
  serializedEnvelope: string,
): QuarantineWriteDecision {
  const held = quarantined.get(storeKey);
  if (!held) return { allowed: true };
  const registration = registrations.get(storeKey);
  if (!registration) return { allowed: true };
  if (registration.carriesMaterial(serializedEnvelope)) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: `refused_payload_quarantined:${storeKey}`,
  };
}
