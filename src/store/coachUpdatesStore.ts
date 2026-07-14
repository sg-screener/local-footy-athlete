/**
 * coachUpdatesStore.ts — week-level Coach Update notes surfaced on the
 * Program tab. The store keeps one entry per Mon-Sun week (keyed by
 * `weekStartISO`); the HomeScreen reads it on render and hides the
 * card when the entry is missing or `active === false`.
 *
 * WRITE PATH
 *   CoachScreen.handleSend writes here ONLY after applyAdjustmentEvents
 *   reports applied.length > 0 AND the visible-diff verifier confirms
 *   the user-facing surface actually moved. So if the card is rendered,
 *   the program tab MUST have a corresponding visible change.
 *
 * READ PATH
 *   HomeScreen calls `getActiveCoachUpdate(weekStartISO)`. If null →
 *   render nothing. If present → render the card with reason / rules /
 *   changes / "Update coach" button.
 *
 * LIFECYCLE
 *   - upsertCoachUpdate(weekStartISO, payload)  — coach made changes
 *   - deactivateCoachUpdate(weekStartISO)       — athlete dismissed it
 *     OR a follow-up turn replaces the prior entry
 *   - clearAllCoachUpdates                       — nuke (test/reset use)
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  InjuryState,
  InjuryHistoryEntry,
  InjuryStatus,
} from '../utils/injuryProgression';
import type { EquipmentTag } from '../data/exercisePools';
import type { ConditioningEquipmentModality } from '../types/domain';

export type CoachUpdateSource = 'coach' | 'uae';

export interface CoachUpdate {
  /** Stable id (timestamp + week key). */
  id: string;
  /** ISO date of Monday (Mon-Sun week boundary). */
  weekStartISO: string;
  /** Origin of the update — manual coach action or the deterministic UAE. */
  source: CoachUpdateSource;
  /** Athlete-facing summary of WHY the week changed. */
  reason: string;
  /** Bucketed rules (e.g. "No sprinting or high-speed running"). */
  rules: string[];
  /** Per-session change bullets for THIS week (event-derived). */
  changes: string[];
  /**
   * Per-session change bullets for NEXT week (constraint-projection
   * derived — the activeInjury / exposure engine reshaped future
   * sessions silently; this surfaces them on the card). Optional for
   * back-compat — older entries simply don't render the section.
   */
  nextWeekChanges?: string[];
  /**
   * Plan-driven concise card fields (live-derived path only — stored
   * entries leave these undefined and fall back to legacy rendering).
   * The card prefers these when present so the athlete sees the same
   * spec the engine validates against.
   *
   * NOTE — these are LEGACY shape (Avoid / Sub in / Keep). Pre-MVP
   * the card was rewritten around the truth gate (Applied / Guidance
   * / Optional) — see `appliedChanges`/`activeGuidance`/`optionalAdvice`
   * below. New entries SHOULD populate the truth-gate fields. The
   * legacy fields remain so older AsyncStorage entries still render.
   */
  avoid?: string[];
  /** Substitution suggestions, plan-derived (legacy only). */
  substituteWith?: string[];
  /** Safe focus, plan-derived (legacy only). */
  keep?: string[];
  /** Closing physio nudges + advice, deduped. */
  advice?: string[];

  /**
   * TRUTH-GATE FIELDS (preferred — see verifiedCoachCommunication.ts).
   * The card renders these when present. They guarantee the athlete
   * never sees a claim ("Sub in: bike") that has no counterpart in the
   * visible program.
   *
   * appliedChanges — only items derived from the actual visible diff.
   * activeGuidance — restrictions the athlete must respect this week.
   * optionalAdvice — suggestions IF the athlete chooses to add work.
   * canSayProgramUpdated — gate for "program updated" / "I adjusted"
   *                         phrasing in any reply built from this card.
   */
  appliedChanges?: import('../utils/verifiedCoachCommunication').AppliedChange[];
  activeGuidance?: string[];
  optionalAdvice?: string[];
  canSayProgramUpdated?: boolean;
  unchangedReason?: string;
  /** ISO timestamp when the update was created. */
  createdAt: string;
  /** False when the athlete dismisses or the engine supersedes. */
  active: boolean;
}

/**
 * Multi-constraint model. Every active issue (injury, fatigue,
 * soreness, schedule, preference) becomes one ActiveConstraint entry.
 * The visible projection + Coach Update card derive from the array,
 * so adding a second injury never silently overwrites the first.
 *
 * `activeInjury` is kept as a derived alias for the FIRST active
 * injury constraint — back-compat for callers that haven't migrated
 * to the array yet.
 */
export type ActiveConstraintType =
  | 'injury'
  | 'fatigue'
  | 'soreness'
  | 'schedule'
  | 'equipment'
  | 'missed_session'
  | 'preference';

export type ActiveConstraintModifierAffect =
  | 'current_day'
  | 'current_week'
  | 'future_generation';

export interface ActiveConstraintModifierMetadata {
  /** Optional Coach Notes display override for this constraint. */
  modifierTitle?: string;
  /** Optional Coach Notes body override for this constraint. */
  modifierBody?: string;
  /** Program surfaces this modifier is currently changing. */
  modifierAffects?: ActiveConstraintModifierAffect[];
  /** Manual overrides that should be removed when this modifier clears. */
  linkedOverrideDates?: string[];
  /** ISO date after which this temporary constraint is no longer active. */
  expiresAt?: string;
}

export interface ActiveConstraintGameChangeProofRow {
  date: string;
  workoutName: string | null;
  workoutType: string | null;
  sessionTier?: string | null;
}

export interface ActiveConstraintNoteProof {
  kind: 'game_change';
  /** Stable owner key for dedupe/update: one game-change note per affected week. */
  lifecycleKey: string;
  changedDates: string[];
  after: ActiveConstraintGameChangeProofRow[];
}

export interface ActiveInjuryConstraint extends ActiveConstraintModifierMetadata {
  id: string;
  type: 'injury';
  bodyPart: string;
  bucket: InjuryState['bucket'];
  severity: number;
  /** Immediately-previous severity when improving — drives staged reintroduction. */
  priorSeverity?: number;
  status: InjuryStatus;
  startDate: string;
  lastUpdatedAt: string;
  source?: 'coach' | 'uae' | 'tap' | 'guided_injury_flow';
  region?: 'upper_body' | 'lower_body' | 'back_midline' | 'other';
  severityBand?: 'mild' | 'slight' | 'moderate' | 'avoid';
  adjustmentLevel?: 'minimal' | 'slight' | 'moderate' | 'avoid_affected' | 'training_paused';
  triggers?: string[];
  seriousSymptoms?: boolean;
  seriousSymptom?: string;
  rules: string[];
  /** Free-text bullets the card surfaces under "Keep". */
  safeFocus: string[];
  /** Free-text bullets the card surfaces under "Get a physio…" advice. */
  advice: string[];
}

export interface ActiveFatigueConstraint extends ActiveConstraintModifierMetadata {
  id: string;
  type: 'fatigue';
  severity: number;
  status: InjuryStatus;
  startDate: string;
  lastUpdatedAt: string;
  /** Optional display override for derived constraints such as readiness chips. */
  reasonLabel?: string;
  /** Optional origin for derived/non-chat constraints. */
  source?: 'coach' | 'readiness' | 'tap';
  /** Typed readiness reason for deterministic non-chat flows. */
  readinessKind?: 'poor_sleep';
  /** One poor night is day-scoped; repeated poor sleep is week-scoped. */
  readinessPattern?: 'single_night' | 'repeated';
  /** Optional single-day scope. If present, projection only applies on this date. */
  appliesToDate?: string;
  rules: string[];
  safeFocus: string[];
  advice: string[];
}

/**
 * Soreness — region-aware, milder than injury. The engine downscales
 * severity by 2 (see `buildSorenessConstraint`) so a 6/10 soreness is
 * roughly equivalent to a 4/10 injury — limits, not full blocks.
 */
export interface ActiveSorenessConstraint extends ActiveConstraintModifierMetadata {
  id: string;
  type: 'soreness';
  /** Athlete-facing free-text — "quads", "calves", "shoulders". */
  bodyPart: string;
  /** Mapped to the engine's ConstraintRegion taxonomy. */
  bucket: InjuryState['bucket'];
  severity: number;
  status: InjuryStatus;
  startDate: string;
  lastUpdatedAt: string;
  reasonLabel?: string;
  source?: 'coach' | 'readiness' | 'tap';
  appliesToDate?: string;
  rules: string[];
  safeFocus: string[];
  advice: string[];
}

/**
 * Busy-week / schedule constraint — the athlete signalled limited
 * capacity for the current week. Severity drives how aggressively the
 * engine drops hard exposures (max effort, heavy lower, etc.).
 */
export interface ActiveScheduleConstraint extends ActiveConstraintModifierMetadata {
  id: string;
  type: 'schedule';
  /** 1..10 — perceived capacity hit. Defaults to 5 (moderate). */
  severity: number;
  status: InjuryStatus;
  startDate: string;
  lastUpdatedAt: string;
  reasonLabel?: string;
  source?: 'coach' | 'readiness' | 'tap';
  appliesToDate?: string;
  /** Optional Mon-Sun ISO of the affected week. */
  weekStartISO?: string;
  /** Visible proof used to suppress stale week-scoped Coach Notes. */
  noteProof?: ActiveConstraintNoteProof;
  /** Optional cap on total sessions for the week. */
  maxSessionsThisWeek?: number;
  rules: string[];
  safeFocus: string[];
  advice: string[];
}

export interface ActiveEquipmentConstraint extends ActiveConstraintModifierMetadata {
  id: string;
  type: 'equipment';
  /** only = use only these tags plus bodyweight; without = subtract these tags. */
  mode: 'only' | 'without';
  tags: EquipmentTag[];
  /** Optional exact conditioning-machine subset for no-bike/no-row style limits. */
  conditioningModalities?: ConditioningEquipmentModality[];
  severity: number;
  status: InjuryStatus;
  startDate: string;
  lastUpdatedAt: string;
  source: 'tap' | 'chat' | 'system';
  reasonLabel?: string;
  /** Program surfaces this equipment modifier is changing. Required to avoid hidden effects. */
  modifierAffects: ActiveConstraintModifierAffect[];
  rules: string[];
  safeFocus: string[];
  advice: string[];
}

/**
 * Missed-session constraint — informational. Surfaces a Coach Update
 * card so the athlete sees the missed day was acknowledged. Does not
 * mutate exposures by default; the coach reply explains what to keep
 * doing this week.
 */
export interface ActiveMissedSessionConstraint {
  id: string;
  type: 'missed_session';
  /** ISO date the athlete missed (or the team session). */
  missedDate?: string;
  /** Free-text label — "Tuesday Lower", "Field session", etc. */
  sessionName?: string;
  /** Always severity 0 — not an injury / soreness signal. */
  severity: number;
  status: InjuryStatus;
  startDate: string;
  lastUpdatedAt: string;
  rules: string[];
  safeFocus: string[];
  advice: string[];
}

export interface ActivePreferenceConstraint {
  id: string;
  type: 'preference';
  preferenceKind: 'avoid_exercise' | 'preferred_alternative' | 'add_focus';
  /** Athlete-facing label shown under Profile -> Coach Adjustments. */
  label: string;
  /** Canonical exercise name excluded from future generation, when relevant. */
  exercise?: string;
  /** Canonical preferred/pinned exercise name, when relevant. */
  alternative?: string;
  /** Human-readable focus bucket, such as "core" or "upper body". */
  focus?: string;
  severity: number;
  status: InjuryStatus;
  startDate: string;
  lastUpdatedAt: string;
  rules: string[];
  safeFocus: string[];
  advice: string[];
}

export type ActiveConstraint =
  | ActiveInjuryConstraint
  | ActiveFatigueConstraint
  | ActiveSorenessConstraint
  | ActiveScheduleConstraint
  | ActiveEquipmentConstraint
  | ActiveMissedSessionConstraint
  | ActivePreferenceConstraint;

const INJURY_MODIFIER_AFFECTS: ActiveConstraintModifierAffect[] = [
  'current_week',
  'future_generation',
];

const EQUIPMENT_MODIFIER_AFFECTS: ActiveConstraintModifierAffect[] = [
  'current_week',
  'future_generation',
];

function withDefaultModifierMetadata(c: ActiveConstraint): ActiveConstraint {
  if (c.type === 'equipment') {
    return {
      ...c,
      modifierAffects: Array.isArray(c.modifierAffects) && c.modifierAffects.length > 0
        ? [...c.modifierAffects]
        : [...EQUIPMENT_MODIFIER_AFFECTS],
    };
  }
  if (c.type !== 'injury') return c;
  return {
    ...c,
    modifierAffects: Array.isArray(c.modifierAffects) && c.modifierAffects.length > 0
      ? [...c.modifierAffects]
      : [...INJURY_MODIFIER_AFFECTS],
  };
}

interface CoachUpdatesState {
  /** weekStartISO → CoachUpdate. One per week. */
  updatesByWeek: Record<string, CoachUpdate>;

  /**
   * All active constraints — injuries / fatigue / soreness / etc.
   * The visible-program projection and the weekly Coach Update card
   * derive from this array. Multiple injuries are first-class.
   */
  activeConstraints: ActiveConstraint[];

  /**
   * Single active injury — DERIVED ALIAS for the FIRST active injury
   * constraint. Kept for back-compat with callers (resolver,
   * progression handler) that haven't migrated to `activeConstraints`
   * yet. Setting `activeInjury` is a write-through that adds/updates
   * the matching constraint in the array.
   */
  activeInjury: InjuryState | null;

  /** Upsert (creates a new entry or replaces the existing one for the same week). */
  upsertCoachUpdate: (
    weekStartISO: string,
    payload: Omit<CoachUpdate, 'id' | 'weekStartISO' | 'createdAt' | 'active'>,
  ) => CoachUpdate;

  /** Deactivate the entry for a week (keeps history; UI hides it). */
  deactivateCoachUpdate: (weekStartISO: string) => void;

  /** Wipe everything (used by tests + Settings → Reset). */
  clearAllCoachUpdates: () => void;

  /**
   * Set the active injury — used on the very first injury report. Past
   * the first report, prefer `transitionInjuryStatus` so history is
   * preserved.
   */
  setActiveInjury: (state: InjuryState | null) => void;

  /**
   * Apply a status/severity transition + append a history entry.
   * Returns the resulting InjuryState (or null if there was nothing to
   * transition from).
   */
  transitionInjuryStatus: (
    args: {
      toStatus: InjuryStatus;
      severity: number;
      note: string;
      timestamp?: string;
    },
  ) => InjuryState | null;

  // ─── Multi-constraint API ────────────────────────────────────────
  /** Add a new active constraint (or upsert by id). */
  upsertActiveConstraint: (constraint: ActiveConstraint) => void;
  /** Remove an active constraint by id. */
  removeActiveConstraint: (id: string) => void;
  /** Replace the entire active constraint set. */
  setActiveConstraints: (constraints: ActiveConstraint[]) => void;
}

export const useCoachUpdatesStore = create<CoachUpdatesState>()(
  persist(
    (set, get) => ({
      updatesByWeek: {},
      activeInjury: null,
      activeConstraints: [],

      upsertCoachUpdate: (weekStartISO, payload) => {
        // Composite id: timestamp + random suffix so two upserts in the
        // same millisecond (back-to-back tests / fast user input) still
        // produce distinct ids.
        const suffix = Math.random().toString(36).slice(2, 8);
        const update: CoachUpdate = {
          id: `cu-${weekStartISO}-${Date.now()}-${suffix}`,
          weekStartISO,
          source: payload.source,
          reason: payload.reason,
          rules: [...payload.rules],
          changes: [...payload.changes],
          // Optional next-week constraint-projection bullets. Cloned
          // for store-immutability; absent → field is omitted.
          ...(payload.nextWeekChanges
            ? { nextWeekChanges: [...payload.nextWeekChanges] }
            : {}),
          ...(payload.avoid ? { avoid: [...payload.avoid] } : {}),
          ...(payload.substituteWith ? { substituteWith: [...payload.substituteWith] } : {}),
          ...(payload.keep ? { keep: [...payload.keep] } : {}),
          ...(payload.advice ? { advice: [...payload.advice] } : {}),
          createdAt: new Date().toISOString(),
          active: true,
        };
        set((state) => ({
          updatesByWeek: { ...state.updatesByWeek, [weekStartISO]: update },
        }));
        return update;
      },

      deactivateCoachUpdate: (weekStartISO) =>
        set((state) => {
          const existing = state.updatesByWeek[weekStartISO];
          if (!existing) return state;
          return {
            updatesByWeek: {
              ...state.updatesByWeek,
              [weekStartISO]: { ...existing, active: false },
            },
          };
        }),

      clearAllCoachUpdates: () =>
        set({ updatesByWeek: {}, activeInjury: null, activeConstraints: [] }),

      setActiveInjury: (state) => {
        // Write-through: the legacy single-slot setter ALSO mirrors
        // into activeConstraints so multi-constraint consumers see
        // the new injury without a separate call.
        if (state === null) {
          // Clearing the legacy slot removes any injury constraints
          // for the same body part — but other injury constraints
          // (e.g. shoulder when this clears hammy) survive.
          const prior = get().activeInjury;
          set({ activeInjury: null });
          if (prior) {
            const id = `injury-${(prior.bucket || prior.bodyPart || 'unknown').toLowerCase()}`;
            const remaining = get().activeConstraints.filter(
              (c) => c.id !== id,
            );
            set({ activeConstraints: remaining });
          }
          return;
        }
        const id = `injury-${(state.bucket || state.bodyPart || 'unknown').toLowerCase()}`;
        // Staged reintroduction: when this update improves on a previous
        // severity for the same injury, record that previous value so the
        // restriction pipeline relaxes at most one band at a time. Respect a
        // caller-provided priorSeverity (guided flow); otherwise derive it from
        // the value being replaced. Cleared/worsening/stable reports carry none.
        const prevConstraint = get().activeConstraints.find(
          (c): c is ActiveInjuryConstraint => c.id === id && c.type === 'injury',
        );
        const prevSeverity = prevConstraint?.severity ?? get().activeInjury?.severity;
        const priorSeverity =
          typeof state.priorSeverity === 'number'
            ? state.priorSeverity
            : typeof prevSeverity === 'number' && state.severity > 0 && state.severity < prevSeverity
              ? prevSeverity
              : undefined;
        const stateWithPrior: InjuryState =
          priorSeverity === undefined ? state : { ...state, priorSeverity };
        set({ activeInjury: stateWithPrior });
        const next: ActiveInjuryConstraint = {
          id,
          type: 'injury',
          bodyPart: state.bodyPart,
          bucket: state.bucket,
          severity: state.severity,
          ...(priorSeverity === undefined ? {} : { priorSeverity }),
          status: state.status,
          startDate: state.startDate,
          lastUpdatedAt: state.lastUpdatedAt,
          // Defensive: older callers / test fixtures may build an
          // InjuryState without `rules` populated. Default to [] so
          // we never crash spreading undefined.
          rules: Array.isArray(state.rules) ? [...state.rules] : [],
          safeFocus: [],
          advice: [],
          modifierAffects: [...INJURY_MODIFIER_AFFECTS],
        };
        const existing = get().activeConstraints.filter((c) => c.id !== id);
        set({ activeConstraints: [...existing, next] });
      },

      upsertActiveConstraint: (c) => {
        const nextConstraint = withDefaultModifierMetadata(c);
        const filtered = get().activeConstraints.filter((x) => x.id !== nextConstraint.id);
        set({ activeConstraints: [...filtered, nextConstraint] });
        // Mirror back to legacy activeInjury when the constraint is
        // an injury — pick the most recently-touched as "primary".
        if (nextConstraint.type === 'injury') {
          const allInjuries = [...filtered, nextConstraint]
            .filter((x): x is ActiveInjuryConstraint => x.type === 'injury' && x.status !== 'resolved');
          const primary = allInjuries.sort((a, b) =>
            (b.lastUpdatedAt || '').localeCompare(a.lastUpdatedAt || ''),
          )[0];
          if (primary) {
            const legacy: InjuryState = {
              bodyPart: primary.bodyPart,
              bucket: primary.bucket,
              severity: primary.severity,
              initialSeverity: primary.severity,
              status: primary.status,
              rules: Array.isArray(primary.rules) ? [...primary.rules] : [],
              startDate: primary.startDate,
              lastUpdatedAt: primary.lastUpdatedAt,
              createdAt: primary.startDate,
              history: get().activeInjury?.history ?? [],
            };
            set({ activeInjury: legacy });
          } else {
            set({ activeInjury: null });
          }
        }
      },

      removeActiveConstraint: (id) => {
        const removed = get().activeConstraints.find((c) => c.id === id);
        const remaining = get().activeConstraints.filter((c) => c.id !== id);
        set({ activeConstraints: remaining });
        // activeInjury is a derived alias. Recompute whenever any injury is
        // removed; constraint ids are not required to use the legacy format.
        if (removed?.type === 'injury') {
          const fallbackInjury = remaining.find(
            (c): c is ActiveInjuryConstraint => c.type === 'injury' && c.status !== 'resolved',
          );
          if (fallbackInjury) {
            const legacy: InjuryState = {
              bodyPart: fallbackInjury.bodyPart,
              bucket: fallbackInjury.bucket,
              severity: fallbackInjury.severity,
              initialSeverity: fallbackInjury.severity,
              status: fallbackInjury.status,
              rules: Array.isArray(fallbackInjury.rules) ? [...fallbackInjury.rules] : [],
              startDate: fallbackInjury.startDate,
              lastUpdatedAt: fallbackInjury.lastUpdatedAt,
              createdAt: fallbackInjury.startDate,
              history: [],
            };
            set({ activeInjury: legacy });
          } else {
            set({ activeInjury: null });
          }
        }
      },

      setActiveConstraints: (constraints) => {
        const nextConstraints = constraints.map(withDefaultModifierMetadata);
        set({ activeConstraints: [...nextConstraints] });
        const primary = nextConstraints
          .filter((c): c is ActiveInjuryConstraint => c.type === 'injury' && c.status !== 'resolved')
          .sort((a, b) => (b.lastUpdatedAt || '').localeCompare(a.lastUpdatedAt || ''))[0];
        if (primary) {
          const legacy: InjuryState = {
            bodyPart: primary.bodyPart,
            bucket: primary.bucket,
            severity: primary.severity,
            initialSeverity: primary.severity,
            status: primary.status,
            rules: Array.isArray(primary.rules) ? [...primary.rules] : [],
            startDate: primary.startDate,
            lastUpdatedAt: primary.lastUpdatedAt,
            createdAt: primary.startDate,
            history: get().activeInjury?.history ?? [],
          };
          set({ activeInjury: legacy });
        } else {
          set({ activeInjury: null });
        }
      },

      transitionInjuryStatus: ({ toStatus, severity, note, timestamp }) => {
        const current = get().activeInjury;
        if (!current) return null;
        const nowISO = timestamp ?? new Date().toISOString();
        const entry: InjuryHistoryEntry = {
          timestamp: nowISO,
          fromStatus: current.status,
          toStatus,
          severity,
          note,
        };
        // Refresh the rules snapshot to match the new severity. The
        // resolver-level filter doesn't read this field (it derives
        // from `severity` directly), but UI surfaces (Coach Update
        // card, debug screens) read `state.rules` as a fast path.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { buildInjuryPolicy } = require('../utils/programAdjustmentEngine');
        const refreshedRules: string[] =
          toStatus === 'resolved'
            ? []
            : [...buildInjuryPolicy(current.bucket as any, severity).globalRules];
        const next: InjuryState = {
          ...current,
          severity,
          status: toStatus,
          rules: refreshedRules,
          lastUpdatedAt: nowISO,
          history: [...current.history, entry],
        };
        set({ activeInjury: next });
        return next;
      },
    }),
    {
      name: 'coach-updates',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

let safetyProjectionInProgress = false;
useCoachUpdatesStore.subscribe((state, previous) => {
  if (state.activeConstraints === previous.activeConstraints || safetyProjectionInProgress) return;
  safetyProjectionInProgress = true;
  try {
    // Dynamic loading keeps store initialisation acyclic. The validator reads
    // the already-committed constraint state and projects it through the same
    // final safety boundary used by generation, rebuilds and edits.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('../utils/postGenerationConstraintValidation').revalidateLiveStoredProgramSafety();
  } finally {
    safetyProjectionInProgress = false;
  }
});

/**
 * Read helper used by HomeScreen. Returns null when no entry exists
 * for the week OR when the entry is inactive — both are "don't render".
 */
export function getActiveCoachUpdate(weekStartISO: string): CoachUpdate | null {
  const update = useCoachUpdatesStore.getState().updatesByWeek[weekStartISO];
  if (!update || !update.active) return null;
  return update;
}
