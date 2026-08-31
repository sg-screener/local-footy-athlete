import type { WeekBoardBox, WeekBoardBoxKind } from '../../rules/weekBoard';

export type WeekBoardSnapFrame = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type WeekBoardSnapRow = {
  readonly date: string;
  readonly frame: WeekBoardSnapFrame;
  readonly boxes: readonly {
    readonly box: WeekBoardBox;
    readonly frame: WeekBoardSnapFrame;
  }[];
};

/**
 * Resolve the destination the way the board is drawn: first lock to a DAY,
 * then to the most useful slot on that day.
 *
 * The old implementation required the release point to land inside the exact
 * rectangle. Gaps between rows and the date gutter were dead zones. More
 * importantly, a missed session dragged onto a future day with one existing
 * session hit that occupied box and attempted an impossible swap back into the
 * past, even though the day had an empty slot beside it.
 *
 * This is presentation geometry only. It chooses the box the athlete is
 * pointing at; `weekBoardDropRefusal` and the plan-change producer still own
 * whether the resulting move is legal.
 */
export function resolveWeekBoardSnapTarget(args: {
  readonly x: number;
  readonly y: number;
  readonly sourceKind: WeekBoardBoxKind;
  readonly preferOpenSlot: boolean;
  readonly rows: readonly WeekBoardSnapRow[];
}): { readonly date: string; readonly box: WeekBoardBox } | null {
  const measured = args.rows
    .filter((row) => row.boxes.length > 0 && row.frame.height > 0)
    .slice()
    .sort((a, b) => a.frame.y - b.frame.y);
  if (measured.length === 0) return null;

  const first = measured[0].frame;
  const last = measured[measured.length - 1].frame;
  if (args.y < first.y || args.y > last.y + last.height) return null;

  // Nearest centre makes the visual gap between two rows belong to the nearer
  // day. There is no tiny strip where a deliberate drag simply disappears.
  const row = measured.reduce((best, candidate) => {
    const bestDistance = Math.abs(args.y - (best.frame.y + best.frame.height / 2));
    const candidateDistance = Math.abs(
      args.y - (candidate.frame.y + candidate.frame.height / 2),
    );
    return candidateDistance < bestDistance ? candidate : best;
  });

  if (args.preferOpenSlot && args.sourceKind !== 'game') {
    const empty = row.boxes.find((candidate) => candidate.box.kind === 'empty');
    if (empty) return { date: row.date, box: empty.box };
  }

  const nearest = row.boxes.reduce((best, candidate) => {
    const bestDistance = Math.abs(args.x - (best.frame.x + best.frame.width / 2));
    const candidateDistance = Math.abs(
      args.x - (candidate.frame.x + candidate.frame.width / 2),
    );
    return candidateDistance < bestDistance ? candidate : best;
  });
  return { date: row.date, box: nearest.box };
}
