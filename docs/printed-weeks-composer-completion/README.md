# The weeks this app builds now

Every word below came out of the app itself — the same program builder the
Rebuild button runs, and the same one screen the Program tab reads. Nothing
was written by hand and no week was invented.

```
npx sucrase-node scripts/print-composer-completion-weeks.ts
```

## What the run found

**5 of 7 weeks built. 2 refused.**

The refusals are not crashes. The app would rather say it cannot build
a week than hand over a bad one, and each refused page prints the reason in
the app's own words.

| | Week | What it is testing | Built? | Problems |
| --- | --- | --- | --- | --- |
| 1 | [In-season, two nights, both at the club](1-in-season-2d-club-full-gym.md) | In-season/2d/club/Full Gym/w1 | yes | 0 |
| 2 | [In-season, two nights at the club](2-in-season-2d-club-dumbbells.md) | In-season/2d/club/Dumbbells/w1 | yes | 0 |
| 3 | [Pre-season, two nights at the club](3-pre-season-2d-club-full-gym.md) | Pre-season/2d/club/Full Gym/w1 | yes | 0 |
| 4 | [Pre-season, five days, no club](4-pre-season-5d-no-club-full-gym-REFUSES.md) | Pre-season/5d/noclub/Full Gym/w1 | **no** | 2 |
| 5 | [In-season, four days, two club nights](5-in-season-4d-club-full-gym.md) | In-season/4d/club/Full Gym/w1 | yes | 1 |
| 6 | [Off-season, four days, no club](6-off-season-4d-no-club-full-gym.md) | Off-season/4d/noclub/Full Gym/w1 | yes | 0 |
| 7 | [In-season, four days, nothing but a floor (STILL REFUSES)](7-in-season-4d-club-bodyweight.md) | In-season/4d/club/Bodyweight Only/w1 | **no** | 1 |

## Read 1 first

File 1 is the week the order said was broken. It was not broken — the deadlift
is on the second night. That is the single most important thing here.
