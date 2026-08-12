/**
 * WHICH CODE EACH UI PICTURE SHOWS — the manifest, because the pictures
 * themselves cannot say.
 *
 * ## The failure this exists to stop
 *
 * SEAT_INBOX item 12. `docs/UI_STATE_2026-08-12.md` pinned its four surfaces to
 * `a9c82856` — **a docs-only commit landing 14h48m after the newest screenshot**
 * — and the seat then cited a stale UI location with confidence. A picture index
 * whose SHA names a commit that touched no code is worse than no SHA: it reads
 * as provenance and carries none.
 *
 * ## WHY A COMMITTED FILE AND NOT THE FILESYSTEM
 *
 * **`artifacts/` is gitignored** (`.gitignore:26`). So the screenshots are not
 * in the repo, and every instinct for "is this shot current" dies at
 * `git clone`: no file, no mtime, nothing. Whatever records the answer has to be
 * TRACKED, and that is this file.
 *
 * ## THE THREE PARTS, AND ALL THREE ARE NEEDED
 *
 * 1. **The SHA goes in the FILENAME.** A loose PNG in someone's `artifacts/`
 *    then still says which code it shows, even with this file out of reach.
 * 2. **This manifest**, tracked, mapping surface -> shot -> the commit it shows.
 * 3. **A gate** (`test:ui-picture-manifest`) asserting the pinned commit
 *    actually TOUCHED UI CODE — the exact thing `a9c82856` did not.
 *
 * ## DELIBERATELY NOT RE-SHOT
 *
 * Item 12: *"Do NOT just re-shoot (Sam has more UI coming; they would restale
 * immediately)... Then shoot once, after Sam's UI work settles."* So every row
 * below is `STALE` and says so. **The mechanism ships first; the pictures come
 * when the UI stops moving.** A manifest full of honest STALE rows is worth more
 * than four fresh PNGs that are wrong again next week.
 */

/** A shot is either pinned to a code commit, or openly stale. */
export type PictureState =
  | {
      readonly state: 'pinned';
      /**
       * The commit the picture SHOWS. Must be a commit that touched UI code —
       * the gate checks this, because pinning to a docs commit is the founding
       * defect.
       */
      readonly showsCode: string;
      /** `<surface>-<sha>.png` under `artifacts/ui-walk/`. */
      readonly file: string;
    }
  | {
      readonly state: 'STALE';
      /** What is known about the last shot, so the row is not merely empty. */
      readonly lastKnown: string;
      /** One line: what re-shooting it would take. */
      readonly wouldTake: string;
    };

export interface UiPictureRow {
  /** Stable surface id. */
  readonly surface: string;
  /** What an agent is looking at this picture to learn. */
  readonly showsWhat: string;
  readonly picture: PictureState;
}

/**
 * WHY EVERY ROW READS `STALE` TODAY, AND IT IS NOT AN OVERSIGHT.
 *
 * The four shots `UI_STATE_2026-08-12.md` indexes predate a run of UI work —
 * `e231a6bc` alone merged week-navigation bounds, a tired-icon ladder and a
 * phase-shift day grid, and `8de98d3f` changed My Status itself. Marking them
 * pinned would restate the defect item 12 is about. They are stale, they say so,
 * and the gate makes a false `pinned` impossible rather than trusting care.
 */
export const UI_PICTURE_MANIFEST: readonly UiPictureRow[] = [
  {
    surface: 'day',
    showsWhat: 'Today: the session card, its parts, and the life-fact chips under it.',
    picture: {
      state: 'STALE',
      lastKnown: 'artifacts/ui-walk/walk-1-day.png, indexed against a9c82856 — a DOCS-ONLY commit, so it never named the code it showed.',
      wouldTake: 'Seed standard-in-season-week and photograph the Program tab, filename `day-<sha>.png`.',
    },
  },
  {
    surface: 'week',
    showsWhat: 'The week view and its per-day rows.',
    picture: {
      state: 'STALE',
      lastKnown: 'artifacts/ui-walk/week-prototype-parity.png, same docs-only pin. Week navigation BOUNDS changed in e231a6bc since.',
      wouldTake: 'Same seed, toggle to Week, filename `week-<sha>.png`.',
    },
  },
  {
    surface: 'coach_my_status',
    showsWhat: 'The coach conversation, the modifiers strip, and My Status behind it.',
    picture: {
      state: 'STALE',
      lastKnown: 'artifacts/ui-walk/coach-my-status.png. SUPERSEDED BY CODE: 8de98d3f made all eight modifier controls live and deleted the not-yet caption this shot still shows.',
      wouldTake: 'The golden flow already photographs it — `.maestro/golden/coach-my-status.yaml` writes coach-my-status{,-expanded,-action-live}.png. It needs the SHA in the filename, not a new run.',
    },
  },
  {
    surface: 'profile',
    showsWhat: 'Profile and the setup sheets reached from it.',
    picture: {
      state: 'STALE',
      lastKnown: 'artifacts/ui-walk/walk-3-profile.png and profile-setup-*.png, same docs-only pin.',
      wouldTake: 'Open Profile on a seeded world; note the setup sheet CTA sits below the fold and needs scrollUntilVisible with visibilityPercentage 40.',
    },
  },
];

/**
 * The index that must never pin itself to a docs-only commit.
 *
 * Named here so the gate has one place to look, and so moving or renaming the
 * index is a decision rather than an accident that silently un-checks it.
 */
export const UI_PICTURE_INDEX_DOC = 'docs/UI_STATE_2026-08-12.md';

/** `<surface>-<sha>.png` — the SHA travels with the file, not only the manifest. */
export function pictureFileName(surface: string, sha: string): string {
  return `${surface}-${sha}.png`;
}

/**
 * The commit a picture filename claims to show, or null.
 *
 * Deliberately strict about the SHA shape: a filename that merely ends in
 * `-something.png` is not provenance, and accepting one would let any old shot
 * look pinned.
 */
export function shaFromPictureFileName(file: string): string | null {
  const match = /-([0-9a-f]{7,40})\.png$/.exec(file);
  return match ? match[1] : null;
}
