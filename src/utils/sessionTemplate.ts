import type { Workout } from '../types/domain';
import { getSessionComponentRows } from './sessionComponents';
import { getTeamTrainingWorkoutState } from './teamTraining';
import { projectConditioningVisibleIdentity } from './conditioningVisibleIdentity';
import {
  SESSION_ROLE_ORDER,
  classifyExerciseRole,
  sessionRoleRank,
  type SessionRole,
} from './sessionRoles';

/**
 * D13 — the single composition owner for the session screen.
 *
 * Spec: `docs/SESSION_TEMPLATE_SPEC_2026-07-25.md`. "The session is ONE list.
 * No separate boxes for trunk/support, recovery add-ons, or the power block —
 * every exercise renders in the single session list, each carrying a role
 * badge."
 *
 * ## Why this is an owner rather than a render tidy-up
 *
 * The screen used to mount ONE of three mutually-exclusive branches
 * (`isConditioning` / `isRecovery` / default-strength), with several boxes
 * nested inside whichever branch happened to win. That structure is what hid
 * team training on conditioning days (spec §2 item 4c): `TeamTrainingBlock`
 * only existed inside the strength branch, so a conditioning day carrying a
 * club session rendered none of it. The fix is not a fourth mount site — it is
 * building the list ONCE, from the whole workout, so every applicable row is
 * emitted unconditionally and no branch can swallow one.
 *
 * This module is pure and React-free so the ordering and badging rules are
 * testable without a renderer.
 *
 * ## What it deliberately does NOT do
 *
 * It never touches the counting fences. Roles here are render badges only —
 * `SessionComponentKind`, conditioning credit, hard-exposure accounting and the
 * feedback prompts all continue to read `getSessionComponentRows` exactly as
 * before. D13: "internal counting fences are unchanged."
 */

export type SessionTemplateMode = 'badged_list' | 'recovery';

/**
 * `'d2'` — power → main → accessory → midline → prehab → conditioning (§3.1).
 * `'phase'` — a conditioning-only day runs in the order its phases already
 * carry (warm-up → main effort → cool-down); D2's five-tier order has nothing
 * to order on a day with no strength content (§6 item 4).
 */
export type SessionTemplateOrdering = 'd2' | 'phase';

export interface SessionSupersetTag {
  groupId: string;
  /** 0-based position within the pairing. */
  index: number;
  size: number;
}

export type SessionTemplateItem =
  | {
      kind: 'exercise';
      role: SessionRole;
      /** Which row shape the renderer should use — the data differs, the badge does not. */
      presentation: 'strength' | 'conditioning_phase' | 'addon';
      row: any;
      /** Kept as a small in-list pairing indicator, never a badge (§2 item 4a). */
      superset: SessionSupersetTag | null;
      /** Add-on rows stay no-penalty optional after the box dies. */
      optional: boolean;
    }
  | {
      kind: 'conditioning_choice';
      role: 'conditioning';
      options: Array<{ title: string; description: string; rows: any[] }>;
    }
  | {
      kind: 'team_training';
      role: null;
    };

export interface SessionTemplate {
  mode: SessionTemplateMode;
  ordering: SessionTemplateOrdering;
  items: SessionTemplateItem[];
}

const CONDITIONING_ONLY_TYPES: ReadonlySet<string> = new Set([
  'Conditioning',
  'Flush-Out',
  'Sprint-Intervals',
  'Hill-Sprints',
  'MAS-Training',
  'Quality-Sprints',
  'MetCon',
  'Flog-Friday',
  'Long-Run',
  '6x1km',
  'Tempo-Run',
]);

function isRecoveryWorkout(workout: any): boolean {
  return workout?.workoutType === 'Recovery' || workout?.sessionTier === 'recovery';
}

function rowName(row: any): string {
  return String(row?.exercise?.name ?? row?.name ?? '').trim();
}

/**
 * Stable rank sort with superset groups kept contiguous.
 *
 * A pairing can span two tiers (a main lift supersetted with a midline hold).
 * Tearing it apart to satisfy the tier order would destroy the prescription, so
 * the GROUP sorts at its highest-ranked member and its members keep their
 * authored order inside it. Each member still shows its own badge — the pairing
 * is a placement fact, not a role.
 */
function orderItems(
  items: SessionTemplateItem[],
  rankOf: (item: SessionTemplateItem) => number,
): SessionTemplateItem[] {
  type Cluster = { rank: number; seq: number; items: SessionTemplateItem[] };
  const clusters: Cluster[] = [];
  const byGroup = new Map<string, Cluster>();

  items.forEach((item, seq) => {
    const rank = rankOf(item);
    const groupId =
      item.kind === 'exercise' && item.superset ? item.superset.groupId : null;

    if (groupId) {
      const existing = byGroup.get(groupId);
      if (existing) {
        existing.rank = Math.min(existing.rank, rank);
        existing.items.push(item);
        return;
      }
      const cluster: Cluster = { rank, seq, items: [item] };
      byGroup.set(groupId, cluster);
      clusters.push(cluster);
      return;
    }
    clusters.push({ rank, seq, items: [item] });
  });

  return clusters
    .slice()
    .sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : a.seq - b.seq))
    .flatMap((cluster) => cluster.items);
}

/**
 * Optional work is a GROUP, not a tier.
 *
 * Sam's run-7 ruling 1 gives the optional cluster one header instead of a label
 * on every row. A single header is only honest if it covers exactly the rows it
 * claims, so "optional" has to outrank the role: before this, an add-on was
 * ranked by `classifyExerciseRole(name)` like anything else, so an optional Side
 * Plank sorted as `midline` and landed between prescribed midline and prescribed
 * prehab work. A header over that would have told the athlete their prescribed
 * groin work was optional.
 *
 * Adding the role count as an offset (rather than a separate sort key) keeps D2's
 * order INSIDE the cluster for free: optional prehab still follows optional
 * midline. Being optional changes which group a row is in, not what kind of work
 * it is.
 */
function isOptional(item: SessionTemplateItem): boolean {
  return item.kind === 'exercise' && item.optional;
}

/** D2's five-tier order (§3.1), with the optional cluster below all of it. */
function d2Rank(item: SessionTemplateItem): number {
  // The banner is context, not work — it stays absolute last, below even the
  // optional cluster (Sam, run-7).
  if (item.kind === 'team_training') return SESSION_ROLE_ORDER.length * 2;
  return sessionRoleRank(item.role) + (isOptional(item) ? SESSION_ROLE_ORDER.length : 0);
}

/**
 * A conditioning-only day runs its phases in the order the content already
 * carries (§6 item 4). D2's power→main→…→finisher order has nothing to order on
 * a day with no strength content, so the only ranking left is: the session's
 * own phases, then anything attached to them, then the optional cluster, then
 * the team-training banner.
 */
function phaseRank(item: SessionTemplateItem): number {
  if (item.kind === 'team_training') return 3;
  if (isOptional(item)) return 2;
  return item.role === 'conditioning' ? 0 : 1;
}

function supersetTagsFor(rows: any[]): Map<any, SessionSupersetTag> {
  const sizes = new Map<string, number>();
  for (const row of rows) {
    const groupId = row?.supersetGroup;
    if (!groupId) continue;
    sizes.set(String(groupId), (sizes.get(String(groupId)) ?? 0) + 1);
  }

  const seen = new Map<string, number>();
  const tags = new Map<any, SessionSupersetTag>();
  for (const row of rows) {
    const groupId = row?.supersetGroup ? String(row.supersetGroup) : null;
    if (!groupId) continue;
    const size = sizes.get(groupId) ?? 1;
    // A "pairing" of one is not a pairing — no indicator, no clustering.
    if (size < 2) continue;
    const index = seen.get(groupId) ?? 0;
    seen.set(groupId, index + 1);
    tags.set(row, { groupId, index, size });
  }
  return tags;
}

function exerciseItem(
  row: any,
  presentation: 'strength' | 'conditioning_phase' | 'addon',
  options: { role?: SessionRole; superset?: SessionSupersetTag | null; optional?: boolean } = {},
): SessionTemplateItem {
  return {
    kind: 'exercise',
    // AUTHORED role first. `classifyExerciseRole` reads the name, and a power
    // row named `Explosive Push-up` classifies as ordinary pressing work — it
    // would badge and ORDER as an accessory instead of leading the session. Role
    // is authored, not inferred; the name classifier is the fallback for rows
    // nobody has authored yet.
    role: options.role ?? row?.role ?? classifyExerciseRole(rowName(row)),
    presentation,
    row,
    superset: options.superset ?? null,
    optional: options.optional ?? false,
  };
}

/**
 * Build the one list for a day.
 *
 * Recovery-type days short-circuit to `mode: 'recovery'` with no items: Sam
 * ruled (§6 item 3) they keep their own simple template — no badges, and no
 * Mobility & Prehab flow, since a whole recovery day would make the flow
 * redundant.
 */
export function buildSessionTemplate(
  workout: Partial<Workout> | null | undefined,
): SessionTemplate {
  if (!workout) return { mode: 'badged_list', ordering: 'd2', items: [] };
  if (isRecoveryWorkout(workout)) {
    return { mode: 'recovery', ordering: 'd2', items: [] };
  }

  const teamState = getTeamTrainingWorkoutState(workout);
  const componentRows = getSessionComponentRows(workout);
  const isConditioningOnly =
    !teamState.isTeamTrainingOnly &&
    CONDITIONING_ONLY_TYPES.has(String(workout.workoutType ?? ''));
  const isCombinedDay = !!(workout as any).hasCombinedConditioning && !isConditioningOnly;

  const items: SessionTemplateItem[] = [];

  // Strength and trunk/support rows are one population here. The shared
  // component owner splits them for counting purposes, but a superset can pair
  // across that split (a main lift with a midline hold), so the pairing must be
  // read from the AUTHORED row order, not from the split halves — otherwise the
  // two members arrive in different passes and the pairing is lost.
  // Power joins the one list as an ordinary row. The component owner gives it
  // its own population so counters never see it; the SCREEN has no such need —
  // Sam's one-list ruling is that every exercise renders in the single session
  // list, and D2's order (which `d2Rank` applies from the authored role) puts
  // power first without the renderer knowing anything special about it.
  const sessionRows = inAuthoredOrder(workout, [
    ...componentRows.powerRows,
    ...componentRows.strengthRows,
    ...componentRows.supportRows,
  ]);
  const supersetTags = supersetTagsFor(sessionRows);
  for (const row of sessionRows) {
    items.push(exerciseItem(row, 'strength', { superset: supersetTags.get(row) ?? null }));
  }

  // The add-on box dies, but its content does not: every add-on exercise
  // becomes an ordinary badged row so nothing the athlete was prescribed can
  // vanish in the move. §6 item 6 is explicit that important prehab must live
  // in the session as a badged row, never only inside the collapsed flow.
  for (const addon of (workout as any).recoveryAddons ?? []) {
    for (const row of addon?.exercises ?? []) {
      items.push(exerciseItem(row, 'addon', { optional: true }));
    }
  }

  if (isConditioningOnly) {
    for (const row of componentRows.conditioningRows) {
      items.push(exerciseItem(row, 'conditioning_phase', { role: 'conditioning' }));
    }
  } else if (isCombinedDay) {
    const options = resolveConditioningOptions(workout, componentRows.conditioningRows);
    if (options.length > 0) {
      items.push({ kind: 'conditioning_choice', role: 'conditioning', options });
    }
  }

  if (teamState.hasTeamTraining) {
    items.push({ kind: 'team_training', role: null });
  }

  const ordering: SessionTemplateOrdering = isConditioningOnly ? 'phase' : 'd2';
  return {
    mode: 'badged_list',
    ordering,
    items: orderItems(items, ordering === 'phase' ? phaseRank : d2Rank),
  };
}

/**
 * Restore the workout's authored row order across a set gathered from separate
 * component buckets. Rows the workout doesn't list (defensive: a bucket row
 * with no matching id) keep their gathered position at the end.
 */
function inAuthoredOrder(workout: Partial<Workout>, rows: any[]): any[] {
  const authored = new Map<string, number>();
  (workout.exercises ?? []).forEach((row: any, index: number) => {
    const id = String(row?.id ?? '').trim();
    if (id) authored.set(id, index);
  });
  return rows
    .map((row, gathered) => ({
      row,
      position: authored.get(String(row?.id ?? '').trim()) ?? authored.size + gathered,
    }))
    .sort((a, b) => a.position - b.position)
    .map((entry) => entry.row);
}

/**
 * The numeric index each row shows: "1", "2", "3", with a superset taking ONE
 * slot and lettering its members "2a" / "2b".
 *
 * Sam ruled the index back on 2026-07-27, after the first build replaced it with
 * a role badge. It reads exactly as it did before — this is
 * `buildStrengthLabels`' rule, driven off list order rather than off the raw
 * exercise array, which is the only change the one-list model forces.
 *
 * Returns a value parallel to `items`, with `null` for anything that was never
 * numbered: the power row, add-on rows, conditioning phases and the team-
 * training banner. Numbering an optional add-on alongside prescribed work would
 * quietly promote it.
 */
export function sessionListLabels(
  items: SessionTemplateItem[],
): Array<string | null> {
  const slotForGroup = new Map<string, number>();
  let counter = 0;

  return items.map((item) => {
    if (item.kind !== 'exercise' || item.presentation !== 'strength') return null;

    if (!item.superset) {
      counter += 1;
      return String(counter);
    }
    const { groupId, index } = item.superset;
    if (!slotForGroup.has(groupId)) {
      counter += 1;
      slotForGroup.set(groupId, counter);
    }
    return `${slotForGroup.get(groupId)}${String.fromCharCode(97 + index)}`;
  });
}

/**
 * Combined-day conditioning options, resolved exactly as the screen's hook did.
 * Structured `conditioningBlock` first, legacy keyword-tail fallback second.
 */
function resolveConditioningOptions(
  workout: Partial<Workout>,
  conditioningRows: any[],
): Array<{ title: string; description: string; rows: any[] }> {
  const identity = projectConditioningVisibleIdentity(workout as Workout);
  const block = (workout as any).conditioningBlock;

  if (block?.options?.length) {
    return block.options
      .map((option: any) => {
        const ids = new Set<string>((option.exerciseIds ?? []).map(String));
        return {
          title: identity?.attachedLabel ?? option.title,
          description: option.description ?? '',
          rows: conditioningRows.filter((row: any) => ids.has(String(row?.id))),
        };
      })
      .filter((option: { rows: any[] }) => option.rows.length > 0);
  }

  if (conditioningRows.length === 0) return [];
  return [
    {
      title: identity?.attachedLabel ?? legacyFlavourTitle(workout),
      description: '',
      rows: conditioningRows,
    },
  ];
}

const LEGACY_FLAVOUR_TITLE: Record<string, string> = {
  aerobic: 'Aerobic Conditioning',
  tempo: 'Tempo Conditioning',
  'high-intensity': 'High-Intensity Conditioning',
};

function legacyFlavourTitle(workout: Partial<Workout>): string {
  const flavour = (workout as any).conditioningFlavour;
  return (flavour && LEGACY_FLAVOUR_TITLE[flavour]) || 'Conditioning';
}
