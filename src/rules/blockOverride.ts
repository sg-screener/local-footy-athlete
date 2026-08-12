/**
 * WHETHER THE ATHLETE MAY GO AHEAD ANYWAY — the one reader of `canOverride`.
 *
 * ## Sam's ruling, and it is the whole specification
 *
 * **2026-08-12, verbatim:** *"should give warnings but allow them to do whatever
 * they want"*, and earlier: *"nothing so tight that ... the athlete can't choose
 * to do whatever they want"*.
 *
 * So the app WARNS, RECORDS that it warned, and then does what it was asked. A
 * refusal with no way through survives in exactly one case: **the action is
 * physically impossible**, which is what `canOverride: false` has always meant.
 *
 * ## WHY THIS FILE EXISTS AT ALL
 *
 * `canOverride` has been written in **nine places and read in NONE**
 * (`weekStructureValidator.ts`, `programEditRiskAssessment.ts`,
 * `planChangeProducer.ts`). Every finding has carried the answer to *"may the
 * athlete do this anyway?"* since the field was added, and every block screen
 * threw it away and showed one button labelled `OK`.
 *
 * `CLAUDE.md`: *"EVERY NEW DOMAIN FIELD NAMES ITS WRITER, ITS READER AND ITS
 * BEHAVIOURAL TEST... A field with no reader is not half-built, it is dead
 * weight that later code will trust."* This is the reader, arriving late.
 *
 * ## WHY A RULE AND NOT AN `if` IN THE SHEET
 *
 * `docs/SEAT_INBOX.md` item 9 names FOUR competing answers to *"is this the
 * athlete's will"* across the codebase and asks for them to collapse onto one
 * owner. A fifth answer written inline in a screen would be the defect the item
 * exists to end. It is pure so a cell can hold it, and it takes the findings
 * rather than an assessment so both finding shapes — `WeekFinding` and
 * `ProgramEditRiskFinding`, which agree on this field and on nothing else —
 * reach the same rule.
 */

/** The only part of a finding this rule reads. Both finding types satisfy it. */
export interface OverridableFinding {
  readonly canOverride: boolean;
}

/**
 * May the athlete proceed through this block?
 *
 * **EVERY finding must allow it.** One physically-impossible reason in a list of
 * five is still physically impossible, and offering a way through it would
 * promise something the app cannot deliver — a worse lie than the refusal.
 *
 * **AN EMPTY LIST IS NOT AN OVERRIDE.** A block with no stated reason is a
 * refusal the app could not explain, and `every` on an empty array is `true`,
 * which would silently turn "we don't know why" into "go ahead". That branch is
 * the reason this is a named function with a cell rather than an inline
 * `findings.every(...)`.
 */
export function mayOverrideBlock(
  findings: readonly OverridableFinding[] | null | undefined,
): boolean {
  if (!findings || findings.length === 0) return false;
  return findings.every((finding) => finding.canOverride === true);
}

/**
 * What the way-through control says.
 *
 * Plain, and deliberately not reassuring: the athlete is being told the app
 * still thinks this is a bad idea and is doing it anyway because they asked.
 * Sam's own framing is a warning, not a blessing.
 */
export const BLOCK_OVERRIDE_LABEL = 'Do it anyway';

/** What the athlete taps to take the app's advice instead. */
export const BLOCK_KEEP_LABEL = 'Keep my plan';
