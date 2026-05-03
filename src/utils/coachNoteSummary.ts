/**
 * coachNoteSummary — turns the engine's verbose coachNotes into the
 * short, app-store-friendly strings rendered on V2 surfaces.
 *
 * Why this exists:
 *   The exposure engine emits one note per decision ("Removed: X",
 *   "Replaced X with Y", "Focus: Easy aerobic", "Adjusted for active
 *   hammy — update coach if symptoms improve."). That detail is great
 *   for QA + audit logs but visually overwhelming on the Program tab.
 *   This module collapses N notes into ONE useful coach-note line for the row +
 *   banner surfaces, and exposes the originals as `detailLines` for
 *   an optional "Show details" disclosure.
 *
 *   Pure: no I/O, no React. Both V2 surfaces and the Coach Update card
 *   call into this so the rules stay in one place.
 */

/** Hard caps that match the MVP simplification spec. */
export const COACH_NOTE_LIMITS = {
  /** Max characters in a single summary line (DayRow + banner). */
  summaryMaxChars: 55,
  /** Coach Update card limits — enforced at render time. */
  card: {
    activeIssues: 2,
    avoid: 3,
    doInstead: 3,
    keep: 2,
  },
} as const;

export interface CoachNoteSummary {
  /** ≤55 char single-line summary. Missing when no useful note exists. */
  summaryLine?: string;
  /** Meaningful extra details beyond the summary. Hidden behind "Show changes". */
  detailLines: string[];
  /** True only when detailLines add useful information beyond summaryLine. */
  shouldShowDetails: boolean;
  /** True when the engine emitted at least one mutation. */
  hasMutations: boolean;
  /** Active constraint labels detected, e.g. ["hammy"], ["hammy", "shoulder"]. */
  constraintLabels: string[];
}

const ATTRIBUTION_RE =
  /^adjusted for active (.+?)\s*(?:—|-)\s*update coach.*$/i;
const REMOVED_RE = /^removed:\s*/i;
const REPLACED_RE = /^replaced\s+/i;
const FOCUS_RE = /^focus:\s*/i;
const GENERIC_RE = /^coach adjusted\.?$/i;
const AUDIT_RE = /^(removed:|replaced\s+|focus:|caution:|switched to|lightened|marked optional|swapped running)/i;

export interface CoachNoteDisplayContext {
  workoutName?: string;
  workoutType?: string;
  exercisesBefore?: readonly string[];
  exercisesAfter?: readonly string[];
}

function dedupe(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of arr) {
    const v = (raw ?? '').trim();
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function clamp(s: string, max: number): string {
  if (s.length <= max) return s;
  // Reserve space for the ellipsis (single char per spec — keep tight).
  if (max <= 1) return s.slice(0, max);
  return s.slice(0, max - 1).trimEnd() + '…';
}

function stripBullet(raw: string): string {
  return (raw ?? '').replace(/^\s*(?:[•*-]\s*)+/, '').trim();
}

function slashNoPhrases(s: string): string {
  return s
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*,?\s+or\s+/gi, ' / ')
    .replace(/\s*,\s*/g, ' / ')
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isRunningSession(context?: CoachNoteDisplayContext): boolean {
  const text = `${context?.workoutName ?? ''} ${context?.workoutType ?? ''}`.toLowerCase();
  return /\b(team training|captain'?s run|conditioning|running|sprint|speed|field)\b/.test(text);
}

function inferLocalChangeSummary(notes: readonly string[]): string | undefined {
  const joined = notes.join(' | ').toLowerCase();

  const hasHinge = /\b(deadlift|rdl|nordic|hinge|trap bar)\b/i.test(joined);
  if (hasHinge) return 'No heavy hinge / hamstring loading';

  const hasPressing = /\b(press|bench|ohp|overhead|push-up|push up|pushup)\b/i.test(joined);
  if (hasPressing) return 'No pressing / overhead loading';

  const hasBoxJump = /\b(box jump|jump|plyo|explosive lower)\b/i.test(joined);
  const hasHeavyLower = /\b(back squat|front squat|squat|heavy lower)\b/i.test(joined);
  if (hasBoxJump && hasHeavyLower) return 'No heavy lower / jumping';
  if (hasBoxJump) return 'No jumping / explosive lower';
  if (hasHeavyLower) return 'No heavy lower loading';

  const hasSprint =
    /\b(no|limited|reduce|removed:|caution:).*?(sprint|high-speed|high speed|flying\s*\d|running)/i.test(joined) ||
    /\b(sprint|high-speed|high speed|flying\s*\d).*?(removed|caution|limited|reduce)\b/i.test(joined);
  if (hasSprint) return 'No sprinting / high-speed running';

  return undefined;
}

function inferGlobalRestrictionSummary(
  notes: readonly string[],
  constraintLabels: readonly string[],
  context?: CoachNoteDisplayContext,
): string | undefined {
  const joined = notes.join(' | ').toLowerCase();

  const hasHeavyHinge =
    /\b(no|limited|reduce|removed:|caution:).*?(heavy\s+hinge|hinge|deadlift|rdl|nordic)/i.test(joined) ||
    /\b(heavy\s+hinge|hinge|deadlift|rdl|nordic).*?(removed|caution|limited|reduce)\b/i.test(joined);
  if (hasHeavyHinge) return 'No heavy hinge / hamstring loading';

  const hasPressing = /\b(no|limited|reduce|removed:|caution:).*?(press|bench|overhead|push)/i.test(joined) ||
    /\b(press|bench|overhead|push).*?(removed|caution|limited|reduce)\b/i.test(joined);
  if (hasPressing) return 'No pressing / overhead loading';

  const hasJumping =
    /\b(no|limited|reduce|removed:|caution:).*?(jump|plyo|explosive lower|box jump)/i.test(joined) ||
    /\b(jump|plyo|explosive lower|box jump).*?(removed|caution|limited|reduce)\b/i.test(joined);
  if (hasJumping) return 'No jumping / explosive lower';

  const hasSprint =
    /\b(no|limited|reduce|removed:|caution:).*?(sprint|high-speed|high speed|flying\s*\d|running)/i.test(joined) ||
    /\b(sprint|high-speed|high speed|flying\s*\d).*?(removed|caution|limited|reduce)\b/i.test(joined);
  if (hasSprint && isRunningSession(context)) return 'No sprinting / high-speed running';

  if (constraintLabels.some((l) => /hammy|hamstring/i.test(l))) return 'Hammy restriction active';
  if (constraintLabels.some((l) => /shoulder/i.test(l))) return 'Shoulder restriction active';
  if (constraintLabels.some((l) => /fatigue/i.test(l))) return 'Fatigue guidance active';

  const directRule = notes.find((n) => {
    if (!/^(no|reduce|limit|avoid)\b/i.test(n) || AUDIT_RE.test(n)) return false;
    if (/\b(sprint|high-speed|high speed|running)\b/i.test(n) && !isRunningSession(context)) {
      return false;
    }
    return true;
  });
  return directRule ? slashNoPhrases(directRule) : undefined;
}

function normalizeForCompare(s: string): string {
  return slashNoPhrases(stripBullet(s))
    .replace(/^no\s+/i, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

function isDuplicateOfSummary(line: string, summaryLine?: string): boolean {
  if (!summaryLine) return false;
  const a = normalizeForCompare(line);
  const b = normalizeForCompare(summaryLine);
  return a === b || a.includes(b) || b.includes(a);
}

function detailLinesForDisplay(cleaned: readonly string[], summaryLine?: string): string[] {
  const detailCandidates = cleaned.filter((n) =>
    (REMOVED_RE.test(n) || REPLACED_RE.test(n) || /^caution:\s*/i.test(n)) &&
    !GENERIC_RE.test(n) &&
    !isDuplicateOfSummary(n, summaryLine),
  );
  return dedupe(detailCandidates);
}

/**
 * Produce the row/banner-friendly view of an engine coachNotes array.
 *
 *   summariseCoachNotesForDisplay([
 *     'Removed: Trap Bar Deadlift',
 *     'Removed: Box Jumps',
 *     'Focus: Upper body',
 *     'No sprinting or high-speed running',
 *   ])
 *   // → { summaryLine: 'No sprinting / high-speed running',
 *   //     detailLines: [...], hasMutations: true, constraintLabels: ['hammy'] }
 */
export function summariseCoachNotesForDisplay(
  notes: readonly string[] | null | undefined,
  context?: CoachNoteDisplayContext,
): CoachNoteSummary {
  return getCoachNoteDisplay(notes, context);
}

export function getCoachNoteDisplay(
  notes: readonly string[] | null | undefined,
  context?: CoachNoteDisplayContext,
): CoachNoteSummary {
  const cleaned = dedupe([...(notes ?? [])].map(stripBullet));
  if (cleaned.length === 0) {
    return { detailLines: [], shouldShowDetails: false, hasMutations: false, constraintLabels: [] };
  }

  // Pull out attribution lines so we can derive the active constraint label.
  const constraintLabels: string[] = [];
  for (const note of cleaned) {
    const m = note.match(ATTRIBUTION_RE);
    if (m && m[1]) {
      // Body parts may be joined: "hammy + shoulder"
      const parts = m[1]
        .split(/\s*\+\s*/)
        .map((p) => p.trim().toLowerCase())
        .filter(Boolean);
      for (const p of parts) {
        if (!constraintLabels.includes(p)) constraintLabels.push(p);
      }
    }
  }

  // hasMutations: ANY non-attribution, non-empty line counts as a real
  // engine action. Focus-only is treated as a mutation too — the session
  // was reshaped even if no exercise was removed.
  const mutationLines = cleaned.filter((n) => !ATTRIBUTION_RE.test(n));
  const hasMutations = mutationLines.length > 0;

  const usefulNotes = cleaned.filter((n) => !GENERIC_RE.test(n));
  const localChangeNotes = usefulNotes.filter((n) => REMOVED_RE.test(n) || REPLACED_RE.test(n) || /^caution:\s*/i.test(n));
  const summary =
    inferLocalChangeSummary(localChangeNotes) ??
    inferGlobalRestrictionSummary(usefulNotes, constraintLabels, context);
  const summaryLine = summary ? clamp(summary, COACH_NOTE_LIMITS.summaryMaxChars) : undefined;
  const detailLines = detailLinesForDisplay(cleaned, summaryLine);

  return {
    ...(summaryLine ? { summaryLine } : {}),
    detailLines,
    shouldShowDetails: detailLines.length > 0,
    hasMutations,
    constraintLabels,
  };
}

/**
 * DayWorkoutScreen banner — one explanatory sentence at most.
 *
 *   buildBannerLine(['No sprinting or high-speed running'])
 *   // → "No sprinting / high-speed running"
 *
 * Kept as a compatibility wrapper around getCoachNoteDisplay().
 */
export interface BannerConstraintContext {
  label: string; // body part / "fatigue" / "soreness" / "busy week"
  severity?: number;
  rules?: string[];
}

export function buildBannerLine(
  notes: readonly string[] | null | undefined,
  contexts: readonly BannerConstraintContext[] = [],
): string {
  const summary = getCoachNoteDisplay(notes);
  if (!summary.summaryLine) return '';

  void contexts;
  return summary.summaryLine;
}
