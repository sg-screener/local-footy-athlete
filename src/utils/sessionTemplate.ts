import type { Workout } from '../types/domain';
import {
  getSessionComponentRows,
  sessionOrderIsAuthored,
} from './sessionComponents';
import { getTeamTrainingWorkoutState } from './teamTraining';
import { projectConditioningVisibleIdentity, conditioningModeLabel, conditioningModeLabelForRow, conditioningRowForDisplay } from './conditioningVisibleIdentity';
import {
  SESSION_ROLE_ORDER,
  sessionRoleForRow,
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

export type SessionTemplateMode = 'badged_list';

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
      presentation: 'strength' | 'speed' | 'mobility' | 'recovery' | 'conditioning_phase' | 'addon';
      row: any;
      /** Kept as a small in-list pairing indicator, never a badge (§2 item 4a). */
      superset: SessionSupersetTag | null;
      /** Add-on rows stay no-penalty optional after the box dies. */
      optional: boolean;
      modalityLabel?: string;
    }
  | {
      kind: 'conditioning_choice';
      role: 'conditioning';
      optional?: boolean;
      options: Array<{ title: string; description: string; rows: any[]; modalityLabel?: string }>;
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
  return (item.kind === 'exercise' || item.kind === 'conditioning_choice') && item.optional === true;
}

/** D2's five-tier order (§3.1), with the optional cluster below all of it. */
function d2Rank(item: SessionTemplateItem): number {
  // The banner is context, not work — it stays absolute last, below even the
  // optional cluster (Sam, run-7).
  if (item.kind === 'team_training') return SESSION_ROLE_ORDER.length * 2;
  // Speed is its own execution section immediately before Conditioning. The
  // rows retain their counting role (`conditioning`); presentation is the
  // typed fact that distinguishes them from the conditioning finisher here.
  if (item.kind === 'exercise' && item.presentation === 'speed') {
    return sessionRoleRank('conditioning') - 0.5;
  }
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

/**
 * WITHIN A PAIRING, THE AUTHORED PAIR ORDER WINS — SAM, 2026-08-20.
 *
 * *"For valid contrast training, preserve the authored pair at the main slot:
 * heavy lift → paired explosive movement → rest. The explosive row must appear
 * immediately after its heavy partner, not at the top of the session."*
 *
 * ⚠ **THIS IS NOT A SECOND SORTING RULE, AND IT MUST NOT BECOME ONE.** It adds
 * no policy and ranks nothing: it reads `supersetOrder`, which
 * `powerRowAlignment` ALREADY stamps when it forms a contrast pair (heavy = 1,
 * explosive = 2) and `mobilityPairing` already stamps on an R-015 pair. The
 * field was written by the pairing owner and read by nobody but the `1a`/`1b`
 * letter in `dayWorkoutHelpers` — so the pair's own statement of its order was
 * being ignored by the one module that decides what order the athlete sees.
 *
 * **WHY IT BELONGS HERE AND NOWHERE ELSE.** This is the canonical session
 * template. The day card reaches the same answer through
 * `orderRowsAsSessionPresents`, which REPORTS this placement rather than
 * computing its own — so fixing it here fixes both surfaces at once, and adding
 * anything to the projection instead would create the rival authority Sam's
 * instruction forbids.
 *
 * **THE GROUP KEEPS ITS PLACE; ONLY ITS MEMBERS ARE ORDERED.** The cluster still
 * sorts at its highest-ranked member in `orderItems` — a contrast pair still
 * sits at the main slot, because power outranks the main lift — and everything
 * outside a pairing is untouched. Rows with no `supersetOrder` keep the authored
 * order they arrived in, so this can only ever act on a pairing that stated one.
 *
 * **MEASURED BEFORE IT WAS WRITTEN:** across generated Off/Pre/In-season worlds
 * at three experience levels, ZERO superset groups of two or more reach a
 * generated program today, so this changes nothing an athlete can currently see.
 * It is the correction for the moment a contrast pair does form — which, on the
 * evidence in `docs/STATUS_SESSIONUI.md`, it cannot yet.
 */
function inPairOrder(rows: any[]): any[] {
  const positions = new Map<string, number[]>();
  rows.forEach((row, index) => {
    const groupId = row?.supersetGroup ? String(row.supersetGroup) : null;
    if (!groupId) return;
    const slots = positions.get(groupId) ?? [];
    slots.push(index);
    positions.set(groupId, slots);
  });
  if (positions.size === 0) return rows;

  const out = rows.slice();
  for (const [groupId, slots] of positions) {
    if (slots.length < 2) continue;
    const members = slots.map((index) => rows[index]);
    // STABLE, and inert when the pairing did not state an order: equal keys keep
    // the order they arrived in. `Number.MAX_SAFE_INTEGER` puts an unstamped row
    // after the stamped ones rather than silently ahead of the heavy lift.
    const ordered = members
      .map((row, seq) => ({ row, seq, key: typeof row?.supersetOrder === 'number'
        ? row.supersetOrder : Number.MAX_SAFE_INTEGER }))
      .sort((a, b) => (a.key !== b.key ? a.key - b.key : a.seq - b.seq))
      .map((entry) => entry.row);
    slots.forEach((index, position) => { out[index] = ordered[position]; });
    void groupId;
  }
  return out;
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
  presentation: 'strength' | 'speed' | 'mobility' | 'recovery' | 'conditioning_phase' | 'addon',
  options: { role?: SessionRole; superset?: SessionSupersetTag | null; optional?: boolean } = {},
): SessionTemplateItem {
  return {
    kind: 'exercise',
    // AUTHORED role first. `classifyExerciseRole` reads the name, and a power
    // row named `Explosive Push-up` classifies as ordinary pressing work — it
    // would badge and ORDER as an accessory instead of leading the session. Role
    // is authored, not inferred; the name classifier is the fallback for rows
    // nobody has authored yet.
    //
    // ⚠ **AND THE COMPOSER'S SEAT DECISION SITS BETWEEN THE TWO** (Sam,
    // 2026-09-04). `sessionRoleForRow` reads `section18Evidence.role` — the
    // role R-092 already made the composer's to decide — before falling back to
    // the name. Without it the athlete's squat day showed NO main lift on 14 of
    // 14 measured weeks, because the chosen squat came off the accessory bench.
    role: options.role ?? row?.role ?? sessionRoleForRow(row, rowName(row)),
    presentation,
    row,
    superset: options.superset ?? null,
    optional: options.optional ?? false,
  };
}

/**
 * Build the one list for a day.
 *
 * Mobility and Recovery use this same list and row template as every other
 * stored session. Their load-neutral tier remains a programming fact, not a
 * presentation switch.
 */
export function buildSessionTemplate(
  workout: Partial<Workout> | null | undefined,
): SessionTemplate {
  if (!workout) return { mode: 'badged_list', ordering: 'd2', items: [] };
  const teamState = getTeamTrainingWorkoutState(workout);
  const componentRows = getSessionComponentRows(workout);
  const isConditioningOnly =
    !teamState.isTeamTrainingOnly &&
    CONDITIONING_ONLY_TYPES.has(String(workout.workoutType ?? ''));
  const conditioningBlockRowIds = new Set<string>(
    (workout.conditioningBlock?.options ?? [])
      .flatMap((option) => option.exerciseIds ?? [])
      .map(String),
  );

  const items: SessionTemplateItem[] = [];

  // Standalone Mobility and Recovery retain distinct typed populations while
  // sharing the ordinary exercise-card route. Force one common role so their
  // authored order is preserved instead of being rearranged by name inference.
  for (const row of componentRows.mobilityRows) {
    items.push(exerciseItem(row, 'mobility', { role: 'prehab' }));
  }
  for (const row of componentRows.recoveryRows) {
    const belongsToConditioningBlock = conditioningBlockRowIds.has(String(row?.id ?? ''));
    items.push(exerciseItem(
      row,
      belongsToConditioningBlock ? 'conditioning_phase' : 'recovery',
      { role: belongsToConditioningBlock ? 'conditioning' : 'prehab' },
    ));
  }

  // A speed block is real prescribed row content, not component metadata.
  // `getSessionComponentRows` already owns the typed membership through
  // SpeedBlock.exerciseIds; consume that bucket exactly as the Day view does.
  // The special d2Rank above places it immediately before Conditioning without
  // disguising these non-counting rows as power or strength work.
  for (const row of componentRows.speedRows) {
    items.push(exerciseItem(row, 'speed', { role: 'conditioning' }));
  }

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
  const sessionRows = inPairOrder(inAuthoredOrder(workout, [
    ...componentRows.powerRows,
    ...componentRows.strengthRows,
    ...componentRows.supportRows,
  ]));
  const supersetTags = supersetTagsFor(sessionRows);
  /*
   * ⚠ **A SESSION WHOSE ORDER SAM AUTHORED KEEPS IT.**
   *
   * `orderItems(..., d2Rank)` at the end of this function ranks by ROLE — power,
   * main lift, accessories — which is right for a gym session the app composed
   * and wrong for one Sam wrote slot by slot. R-129's Primer builds from
   * stretches to something explosive and ends on two skippable heavy sets; D2
   * classified those two as main lifts and sorted them to the TOP. Sam, seeing
   * it: *"the order of the session is important and right now it's wrong"*.
   *
   * Authored order is independent of the row's role. Keep the existing stable
   * sort and optional grouping, but rank authored rows equally instead of
   * disguising explosive work as prehab to make the sorter leave it alone.
   */
  const oneRole = sessionOrderIsAuthored(workout);
  for (const row of sessionRows) {
    items.push(exerciseItem(row, 'strength', {
      superset: supersetTags.get(row) ?? null,
      ...(oneRole && row.role !== 'power' ? { role: 'prehab' as const } : {}),
      // A row the composer marked skippable joins the OPTIONAL WORK cluster —
      // the same cluster add-on rows use, so there is one optional group on the
      // screen rather than two ways of saying the same thing.
      ...((row as { optionalNoPenalty?: boolean }).optionalNoPenalty
        ? { optional: true }
        : {}),
    }));
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

  // THE LIST IS DRIVEN BY THE DAY'S PARTS, NOT BY TWO workoutType PREDICATES.
  //
  // Every other population above reads `componentRows` — the day's parts.
  // Conditioning alone was gated behind `isConditioningOnly` (a
  // `CONDITIONING_ONLY_TYPES` workoutType) and `isCombinedDay`
  // (`hasCombinedConditioning`), and A TEAM NIGHT CARRYING CONDITIONING IS
  // NEITHER — so `resolveConditioningOptions` never ran and the rows never
  // entered the one list. The athlete saw a team night with none of the
  // conditioning the projection says is on it.
  //
  // That is the same shape D13 was written to fix with the two kinds swapped:
  // "team training hid on conditioning days because `TeamTrainingBlock` only
  // existed inside the strength branch" (spec §2 item 4c). Under the
  // one-projection ruling the parts decide WHETHER rows appear; the workout's
  // type decides only HOW they are presented — a phase list for a pure
  // conditioning day, the choice box for a day that carries conditioning
  // alongside anything else.
  if (componentRows.conditioningRows.length > 0) {
    const optionalConditioning = workout.attachedConditioningKind === 'finisher';
    if (isConditioningOnly) {
      for (const row of componentRows.conditioningRows) {
        items.push(exerciseItem(row, 'conditioning_phase', { role: 'conditioning', optional: optionalConditioning }));
      }
    } else {
      // Athlete additions are extra work, never another alternative to the
      // existing block. Its original option IDs remain authoritative.
      const blockIds = new Set<string>(((workout as Workout).conditioningBlock?.options ?? [])
        .flatMap(option => option.exerciseIds ?? []));
      const additions = blockIds.size ? componentRows.conditioningRows
        .filter(row => row.sessionSection && !blockIds.has(row.id)) : [];
      for (const row of additions) items.push(exerciseItem(row, 'conditioning_phase', { role: 'conditioning' }));
      const addedIds = new Set(additions.map(row => row.id));
      const options = resolveConditioningOptions(workout, componentRows.conditioningRows.filter(row => !addedIds.has(row.id)));
      if (options.length === 1) {
        /* One prescription is not a choice. The old wrapper printed the
         * category label (for example "Hard Intervals") and then nested the
         * real row ("Classic 4×4") beneath it, making one session look like
         * two mismatched parts. The row already owns its title and complete
         * structured dose, so hand it straight to the ordinary phase renderer.
         * Multiple genuinely equivalent options keep the picker below. */
        for (const row of options[0].rows) {
          items.push(exerciseItem(row, 'conditioning_phase', { role: 'conditioning', optional: optionalConditioning }));
        }
      } else if (options.length > 1) {
        items.push({ kind: 'conditioning_choice', role: 'conditioning', options,
          ...(optionalConditioning ? { optional: true } : {}) });
      }
    }
  }

  /**
   * ⚠ **CLUB TRAINING IS NOT A ROW IN THE GYM SESSION ANY MORE** (Sam,
   * 2026-08-21: *"remove the club training from the other view of strength /
   * mobility / conditioning days - so it is two separate feedback forms"*).
   *
   * It used to push a `team_training` item, which the session screen drew as a
   * TEAM TRAINING section holding one "Club session" tick — a checkbox for
   * something that happens at the club, sitting inside the checklist for the
   * work done in the gym. Its own door is the day card's "Log training" button,
   * and its own form is `ClubTrainingFeedbackPanel`.
   *
   * The FACT is untouched: `teamTraining` is still written to the same day
   * record and still read by `journalLoad.teamTrainingSRPE`. Only the row moved.
   *
   * ⚠ **EXCEPT ON A TEAM-ONLY DAY, WHERE IT IS THE WHOLE SESSION.** Sam's words
   * name the days it leaves — *"the other view of strength / mobility /
   * conditioning days"*. A Tuesday with no gym work is not one of those: strip
   * the row there and the session screen renders NOTHING, which
   * `sessionTemplateOneListTests`' *"a team-only day is just the banner"* has
   * been guarding all along. So the row goes only when it had company.
   */
  if (teamState.hasTeamTraining && items.length === 0) {
    items.push({ kind: 'team_training', role: null });
  }

  const ordering: SessionTemplateOrdering = isConditioningOnly ? 'phase' : 'd2';
  return {
    mode: 'badged_list',
    ordering,
    items: orderItems(items, oneRole
      ? item => item.kind === 'team_training' ? 2 : isOptional(item) ? 1 : 0
      : item => item.kind === 'exercise' && item.row.composedOptionalKind === 'primer'
        ? 0 : ordering === 'phase' ? phaseRank(item) : d2Rank(item)).map(item => {
      if (item.kind !== 'exercise') return item;
      const modalityLabel = conditioningModeLabelForRow(workout, String(item.row?.id ?? ''));
      // Typed conditioning-block ownership outranks the surrounding session's
      // presentation bucket. A standalone Recovery session deliberately keeps
      // its recovery section, but an Erg Flush row inside it still needs the
      // selected machine and modality-specific wording on its card.
      if (item.presentation !== 'conditioning_phase' && item.presentation !== 'speed' && !modalityLabel) {
        return item;
      }
      return {
        ...item,
        row: conditioningRowForDisplay(workout, item.row),
        modalityLabel,
      };
    }),
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
    if (
      item.kind !== 'exercise' ||
      !['strength', 'mobility', 'recovery'].includes(item.presentation)
    ) return null;

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
): Array<{ title: string; description: string; rows: any[]; modalityLabel?: string }> {
  const identity = projectConditioningVisibleIdentity(workout as Workout);
  const block = (workout as any).conditioningBlock;

  if (block?.options?.length) {
    return block.options
      .map((option: any) => {
        const ids = new Set<string>((option.exerciseIds ?? []).map(String));
        return {
          title: identity?.attachedLabel ?? option.title,
          description: option.description ?? '',
          modalityLabel: conditioningModeLabel(option.modality, option.modalitySequence),
          rows: conditioningRows.filter((row: any) => ids.has(String(row?.id)))
            .map(row => conditioningRowForDisplay(workout, row)),
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

/**
 * **THE ORDER THE ATHLETE WILL ACTUALLY PERFORM THIS SESSION IN — one owner.**
 *
 * ## The defect this exists to end, measured on glass 2026-08-18
 *
 * The day card and the opened session showed the SAME five exercises in two
 * different orders, and the session then NUMBERED its own:
 *
 * | stored (`workout.exercises`) | what the session numbered 1..5 |
 * | --- | --- |
 * | Back Squat, RDLs, **Cossack Squat**, Single-Leg RDL, Band Pallof Press | 1 Back Squat, 2 RDLs, 3 Single-Leg RDL, 4 Band Pallof Press, **5 Cossack Squat** |
 *
 * So the athlete read *"Cossack Squat, third of five"* on the card and
 * *"5 Cossack Squat"* when they opened it. Nothing was missing; the ORDER
 * disagreed. `rules/dayTimeline.ts` asserts the opposite in its own docstring —
 * *"not a re-order … the card's drop-down and the session screen cannot come to
 * disagree … they are one list asked twice"* — and they were not one list: the
 * card read the raw component buckets, the session read this template.
 *
 * ## Why the answer is THIS function and not a second sort
 *
 * **No new programming policy is invented here, and none may be.** D2's order
 * (`SESSION_ROLE_ORDER`: power → main → accessory → midline/prehab → …) is
 * already authored, already shipped, and already what the athlete performs.
 * Re-implementing a comparator beside it would be the third representation of
 * one fact — the defect class this repo exists to fight. So this reads the
 * template that is ALREADY BUILT and simply reports the position it gave each
 * row. Supersets stay clustered for free, because `orderItems` clustered them.
 *
 * Rows the template does not place keep their incoming order, AFTER the placed
 * ones. That is deliberate and it is the safe direction: an unrecognised row is
 * never dropped and never silently promoted above authored work.
 *
 * STABLE. Two rows the template ranks equally stay in the order they arrived,
 * so this can never reshuffle a day it has nothing to say about.
 */
export function orderRowsAsSessionPresents<T>(
  workout: Partial<Workout> | null | undefined,
  rows: readonly T[],
): T[] {
  if (!workout || rows.length < 2) return [...rows];
  const position = new Map<string, number>();
  buildSessionTemplate(workout).items.forEach((item, index) => {
    if (item.kind !== 'exercise') return;
    const id = String((item.row as any)?.id ?? '').trim();
    if (id && !position.has(id)) position.set(id, index);
  });
  if (position.size === 0) return [...rows];
  const unplaced = position.size + rows.length;
  return rows
    .map((row, arrivalIndex) => {
      const id = String((row as any)?.id ?? '').trim();
      const placed = id ? position.get(id) : undefined;
      return { row, arrivalIndex, rank: placed ?? unplaced };
    })
    .sort((a, b) => (a.rank - b.rank) || (a.arrivalIndex - b.arrivalIndex))
    .map((entry) => entry.row);
}
