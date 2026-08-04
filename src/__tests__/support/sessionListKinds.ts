/**
 * sessionListKinds — ONE owner for "what kinds of work does each surface say
 * this day holds?"
 *
 * Extracted 2026-08-04 because a SECOND consumer arrived
 * (`sessionListCombinationMatrixTests`, the day-type × domains-carried matrix)
 * and the mapping tables plus the offence string were about to be copied. A
 * copy would have been two answers to one question — the exact shape the
 * L-P3 family exists to remove — and worse, the walker's DECLARED_RED regexes
 * match the offence STRING, so a drifted second copy would have produced
 * offences no containment could match while looking correct.
 *
 * The comparison is deliberately the only thing here. Reaching the state, and
 * deciding what a disagreement means, belong to the callers.
 */
import { buildSessionTemplate, type SessionTemplateItem } from '../../utils/sessionTemplate';
import { getSessionComponentRows } from '../../utils/sessionComponents';

/** Template item presentation/kind → the domain the athlete reads it as. */
export const TEMPLATE_ITEM_KIND: Record<string, string> = {
  // A conditioning choice block, and a conditioning phase row on a
  // conditioning-only day, are both the day's conditioning work.
  conditioning_choice: 'conditioning',
  conditioning_phase: 'conditioning',
  // Add-on rows: `recoveryAddons`, rendered as ordinary optional rows since D13.
  addon: 'recovery',
  // The team-training banner.
  team_training: 'team_training',
};

export const STRENGTH_ROLE_KIND: Record<string, string> = {
  power: 'power',
  midline: 'support',
  main_lift: 'strength',
  accessory: 'strength',
  prehab: 'strength',
  conditioning: 'conditioning',
};

/** Part kinds the day-detail CONTENT list does not carry (title-only). */
export const TITLE_ONLY_PART_KINDS: ReadonlySet<string> = new Set(['game']);

/**
 * The kinds the SESSION LIST claims — `buildSessionTemplate`, D13's separate
 * composition of the same day, which is what fills the athlete's list.
 */
export function sessionTemplateKinds(workout: unknown): string[] {
  const template = buildSessionTemplate((workout ?? null) as never);
  const kinds = new Set<string>();
  if (template.mode === 'recovery') {
    // Sam's §6 item 3 exception: a recovery day keeps its own simple template —
    // `RecoveryBlock` over the workout's rows plus `RecoveryAddonSection`. No
    // items, and the whole day is recovery work.
    kinds.add('recovery');
    return [...kinds].sort();
  }
  for (const item of template.items as SessionTemplateItem[]) {
    if (item.kind === 'team_training') { kinds.add(TEMPLATE_ITEM_KIND.team_training); continue; }
    if (item.kind === 'conditioning_choice') {
      kinds.add(TEMPLATE_ITEM_KIND.conditioning_choice);
      continue;
    }
    if (item.presentation === 'strength') {
      kinds.add(STRENGTH_ROLE_KIND[String(item.role)] ?? `unmapped_role:${String(item.role)}`);
      continue;
    }
    kinds.add(TEMPLATE_ITEM_KIND[item.presentation] ?? `unmapped:${String(item.presentation)}`);
  }
  return [...kinds].sort();
}

/** The kinds the PROJECTION carries for a day (`parts`, title-only kinds dropped). */
export function projectionContentKinds(parts: readonly { kind: unknown }[]): string[] {
  return Array.from(new Set(parts
    .map((part) => String(part.kind))
    .filter((kind) => !TITLE_ONLY_PART_KINDS.has(kind)))).sort();
}

export interface TemplateProjectionDisagreement {
  omits: string[];
  invents: string[];
  templateKinds: string[];
  contentKinds: string[];
}

/** Null when the two surfaces agree. */
export function templateProjectionDisagreement(
  templateKinds: string[],
  contentKinds: string[],
): TemplateProjectionDisagreement | null {
  if (JSON.stringify(templateKinds) === JSON.stringify(contentKinds)) return null;
  return {
    omits: contentKinds.filter((kind) => !templateKinds.includes(kind)),
    invents: templateKinds.filter((kind) => !contentKinds.includes(kind)),
    templateKinds,
    contentKinds,
  };
}

/**
 * THE THIRD AXIS — row-level composition (stage 2 priority A, 2026-08-05).
 *
 * `day type × domains carried` could not distinguish the six agreeing
 * `team_night × [conditioning,strength]` observations from the one the deep
 * walker reds on — the blind spot the stage 1 report declared. The missing
 * coordinates are ROW-level: which roles the session list would badge the
 * day's rows with, and how the day's conditioning is WIRED (the template only
 * emits conditioning when `hasCombinedConditioning` is set, while the
 * component owner also accepts `conditioningBlock` ids without it — two
 * different questions that the domain axis collapses into one "conditioning").
 *
 * One owner, here, because the walker's diagnostic and the matrix must speak
 * the same coordinate vocabulary or the comparison is two answers again.
 */
export interface RowComposition {
  /** Sorted unique roles the TEMPLATE badges its strength-presentation rows with. */
  templateRoles: string[];
  /** Non-empty `getSessionComponentRows` buckets, sorted. */
  buckets: string[];
  /**
   * How the day's conditioning is wired, if any is attached:
   * - `none`             — no conditioning rows in the component owner's bucket
   * - `flagged`          — rows attached and `hasCombinedConditioning` is set
   * - `block_no_flag`    — a `conditioningBlock` names rows but the flag is off:
   *                        the component owner sees them, the template does not
   * - `rows_no_wiring`   — rows in the bucket with neither flag nor block
   *                        (standalone conditioning days land here)
   */
  conditioningWiring: 'none' | 'flagged' | 'block_no_flag' | 'rows_no_wiring';
}

export function rowComposition(workout: unknown): RowComposition {
  const template = buildSessionTemplate((workout ?? null) as never);
  const templateRoles = [...new Set(
    (template.items as SessionTemplateItem[])
      .filter((item) => item.kind === 'exercise' && item.presentation === 'strength')
      .map((item) => String((item as { role: unknown }).role)),
  )].sort();

  const rows = getSessionComponentRows((workout ?? null) as never);
  const buckets = (Object.entries(rows) as [string, unknown[]][])
    .filter(([, bucket]) => bucket.length > 0)
    .map(([name]) => name.replace(/Rows$/, ''))
    .sort();

  const hasConditioningRows = rows.conditioningRows.length > 0;
  const flag = !!(workout as { hasCombinedConditioning?: unknown } | null)?.hasCombinedConditioning;
  const block = !!((workout as { conditioningBlock?: { options?: unknown[] } } | null)
    ?.conditioningBlock?.options?.length);
  const conditioningWiring: RowComposition['conditioningWiring'] = !hasConditioningRows
    ? 'none'
    : flag
      ? 'flagged'
      : block
        ? 'block_no_flag'
        : 'rows_no_wiring';

  return { templateRoles, buckets, conditioningWiring };
}

/** The compact third-axis coordinate string. */
export function rowCompositionCoordinate(workout: unknown): string {
  const facts = rowComposition(workout);
  return `roles=[${facts.templateRoles.join(',')}] buckets=[${facts.buckets.join(',')}] `
    + `cond=${facts.conditioningWiring}`;
}

/**
 * The offence sentence. **The walker's DECLARED_RED regexes match this string**
 * — change its wording and every containment in `athleteActionWalkerTests`
 * silently stops matching, so the stale-debt ratchet is the thing that would
 * catch you, one run later. Treat it as a published format.
 */
export function templateProjectionOffence(
  date: string,
  disagreement: TemplateProjectionDisagreement,
): string {
  return `${date}: the session list omits ${JSON.stringify(disagreement.omits)} and invents `
    + `${JSON.stringify(disagreement.invents)} — template `
    + `${JSON.stringify(disagreement.templateKinds)} / `
    + `projection ${JSON.stringify(disagreement.contentKinds)}. The list the athlete reads `
    + 'and the projection tell one story or neither is the projection.';
}
