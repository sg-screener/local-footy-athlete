# Christmas question notification — 2026-09-03

Owner: christmasnotice.

## Sam's ruling

Keep the existing 10 December finish question and 3 January return question.
Present the live question as a compact notification at the top of Program, in
the style of Active modifiers / missed-session questions, with a small icon and
the app's yellow accent. Use the clearer wording agreed in chat.

## Options compared

1. Restyle the existing Christmas-only card and duplicate the missed-session
   dimensions.
2. Give compact Program questions one shared presentation owner, then render
   both missed-session and Christmas questions through it.

Option 2 landed. This is the third top-of-Program notice and the old source
comment explicitly named the third as the point to share the shape. Calendar,
date decisions and the durable Christmas-break writer are unchanged.

## Change

- December reads **When does team training finish before Christmas?**
- January reads **When does team training start again?**
- One compact question notice is mounted above the shared Day/Week branch, so it
  is available in both Program views.
- The notice uses a yellow calendar-and-snowflake icon, a yellow date action and
  the existing **We train through Christmas** answer in December.
- The established Christmas calendar sheet still owns date selection.
- The return threshold remains 3 January.

## Verification

- The new focused first arm of `test:christmas-break`: 9/9 green.
- Red first: the same arm began 2/9 green and 7 red against the large Week-only
  card and old wording.
- `test:missed-session-prompt`: 35/35 green after moving it onto the shared owner.
- `npx tsc --noEmit`: green.
- `test:accent-colour`: 7/7 green.
- `test:approved-icons`: 26/26 green.
- `test:signed-copy-extraction`: 7/7 green; 513 distinct-per-file strings remain
  below its 580 ceiling.
- `test:day-first-timeline`: 57/57 green; its chained Week-board suite retains
  one inherited adapter-fixture failure at 89/90.
- `test:accessibility-contracts` retains its existing 41/47 boundary; its six
  failures predate and do not name this notice.

## Not covered

- Simulator pixels with the clock set to December and January.
- Dynamic Type, VoiceOver reading order and physical-iPhone Release acceptance.
- The older long Christmas suite cannot complete on this candidate because it
  reaches the existing normal-week fixture failure and then calls the removed
  `weekIdentityForWeekForTest` diagnostic export. The focused presentation arm
  runs before that inherited stop.
