/**
 * ── THE SECTION-ICON MAPS — REACT-FREE, SO A GUARD CAN READ THEM ───────────
 *
 * Sam, 2026-08-20 (R-116): *"Reuse the exact established Day-screen icon and
 * colour mapping through one shared owner … Unknown section kinds must fail a
 * guard rather than silently render without an icon."*
 *
 * The RENDERING lives in `components/icons/SectionIcon`; the two MAPS live here,
 * with no React and no `react-native` import, for one reason: a suite that has
 * to `import` a component to check a table cannot run in this repo's harness
 * (sucrase-node cannot parse React Native's Flow types), so the guard would be
 * reduced to reading source text with a regex. A table that decides what the
 * athlete SEES deserves a cell that runs it.
 *
 * ⚠ **BOTH MAPS ARE TOTAL `Record`s, AND THAT IS THE GUARD ITSELF.** Adding a
 * member to `VisiblePartKind` or `SessionExecutionSectionId` stops this file
 * compiling until somebody chooses its icon. A `Partial` would let a new section
 * render iconless and silent — which is exactly how Team Training lost its glyph
 * on the Session screen and Sam caught it on the mock.
 */

import type { VisiblePartKind } from './visibleProjection';
import type { SessionExecutionSectionId } from '../utils/sessionExecutionChecklist';

export type RowIconKind =
  | 'strength'
  | 'team'
  | 'game'
  | 'recovery'
  | 'pulse'
  | 'refresh'
  | 'bolt'
  | 'flame'
  | 'mobility'
  | 'prehab'
  | 'core'
  | 'activity';

/**
 * THE DAY CARD'S PARTS. Verbatim from `HomeScreenV2.PART_ICON_KIND`.
 */
export const PART_ICON_KIND: Readonly<Record<VisiblePartKind, RowIconKind>> = {
  strength: 'strength',
  // ⚠ `power: 'bolt'` IS GONE BECAUSE THE KIND IS (Sam, 2026-08-20). A power
  // component projects as a strength PART now, so its timeline row carries the
  // strength glyph — the same one the work it sits beside carries, which is the
  // visual half of "power is part of the Strength work".
  speed: 'bolt',
  // Sam, 2026-08-26: "conditioning on a day view is a little fire icon =
  // should be the pulse as well" — one pulse for conditioning on every
  // surface (the weekly card already wears it).
  conditioning: 'pulse',
  support: 'core',
  recovery: 'recovery',
  team_training: 'team',
  game: 'game',
};

/**
 * THE SESSION SCREEN'S SECTIONS — the SAME `RowIconKind` values, so the two
 * surfaces cannot draw different glyphs for the same work.
 *
 * ⚠ **`strength` COVERS POWER**, because R-110 folded power into the Strength
 * section on both surfaces. There is no power entry to disagree about.
 *
 * `accessories`, `optional` and `other` have no part-kind twin: they are
 * session-only buckets. They take `core`, `activity` and `activity` — chosen
 * once, here, where the Day screen's values are visible beside them.
 */
export const SESSION_SECTION_ICON_KIND:
  Readonly<Record<SessionExecutionSectionId, RowIconKind>> = {
  mobility: 'mobility',
  strength: 'strength',
  accessories: 'core',
  conditioning: 'pulse',
  team_training: 'team',
  recovery: 'recovery',
  optional: 'activity',
  other: 'activity',
};
