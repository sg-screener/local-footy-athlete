# Coach Lab — slice S1 tapes (2026-09-10)

Seat PHONEBUILD. Twelve questions from the S1 bench (`coachLabCases.ts`,
source `coach-90-plan-slice-s1-2026-09-10`), asked through `askCoachReadOnly`
→ the DEPLOYED `coach-chat` v10, with the Lab fixture athlete now carrying a
season (In-season, block 2 week 2, build), a standing pattern (Saturday game,
Tuesday club, Monday/Thursday gym), fixtures ahead, next week, two recorded
outcomes and a measured MAS. All twelve are `PENDING` until Sam's recorded
review (LAW-coach-lab-before-provider-or-release). Raw log:
`/private/tmp/lfa-yearfix-evidence/s1-tapes.log`.

| # | id | athlete | coach | pre-grade |
| --- | --- | --- | --- | --- |
| 1 | s1-phase | what phase am i in | You're in-season: build week, week 6 of the phase and week 2 of block 2. You've got a game this Saturday, so the priority is maintaining strength and fitness while staying fresh for it. | phase from the fact ✓ |
| 2 | s1-block-week | what block and week is this | This is In-season, build week: Block 2, Week 2. It's Phase Week 6 and not a deload week. | ✓ |
| 3 | s1-deload | is this a deload week | No — this is not a deload week. It's marked as an in-season build week, with the deload flag off. Today's quick check shows low energy, but there's no active program modifier visible. Use that as a cue to keep today's lower session controlled; if you feel flatter once you start, back off volume or intensity rather than forcing it. | ✓; "program modifier" is jargon (LAW-plain-coach-english) |
| 4 | s1-next-week | whats next week look like | Next week is set around your Saturday game: Lower Hinge on Monday, team training Tuesday, rest Wednesday, Upper Pull plus conditioning Thursday, rest Friday, game Saturday, then rest Sunday. It's an in-season build week, with the two gym sessions kept early enough to protect freshness for game day. | next week from the projection ✓ |
| 5 | s1-next-game | when is my next game after this one | After this Saturday's game, your next game is Saturday 5 September. | fixturesAhead ✓ |
| 6 | s1-club-nights | what nights do i train with the club | You train with the club on Tuesday nights. This week's Tuesday session is Team Training. | standing ✓ |
| 7 | s1-nordic-swap-in-season | can i do leg curls instead of nordics | Yes—leg curls are a suitable alternative to Nordics for this week's hamstring work. With Saturday's game and today's low-energy quick check, keep them controlled and don't chase failure or extra volume. Your lower session is today, so use the swap only if it's available in the app; I can't make the change here. | **✗ R-394 not applied.** The phase is now a fact, but the ruling was not retrieved this run (an earlier run of the same question cited it). Retrieval is Rock 2a, slice S2. |
| 8 | s1-flat-all-week | ive been flat all week whats going on | You've recorded low energy and moderate soreness today, so being flat may reflect normal accumulated load rather than anything specific we can pin down. Your measured load is still in the target band (1.08), and you completed Thursday's session and Saturday's game. For today's Lower Squat, keep the main work only if you're moving well; trim volume and skip any finisher. If the flatness persists or worsens through the week, use the readiness check so the week can be reduced. | history read ✓; "readiness check" not the door's label (Rock 3) |
| 9 | s1-last-week | how did i go last week | I can see two full sessions from last week: Thursday felt good, then Saturday was hard. That's solid work, but there's no full weekly completion or load summary here, so I can't fairly score the whole week. Your load is currently in the target range, and your Back Squat has moved from 95 kg to 100 kg for 5 reps this week. | outcomes read, honest about the gap ✓ |
| 10 | s1-why-changed | why did my week change | Nothing in the current snapshot shows a recorded program change or a visible modifier. Your week is set around Tuesday team training and the Saturday game: lower today, upper plus conditioning Thursday, with rest Wednesday, Friday and Sunday to protect freshness. Today's quick check recorded low energy and moderate soreness, but it is a today-only observation and hasn't produced a visible change. If you meant a specific session or exercise, which one changed? | empty ledger read honestly ✓; one focused question ✓ |
| 11 | s1-one-rm | whats my squat 1rm | Your current estimated Back Squat 1RM is about 117 kg, based on 100 kg for 5 reps this week (Brzycki estimate). That's up from roughly 111 kg off 95 kg for 5 last week. | the fixture carries no estimate rows, so the model computed one and said how; on the phone `estimates[]` is the app's own number |
| 12 | s1-mas-pace | what pace should i run my 4 min efforts at | For 4-minute efforts, use about 90–100% of your MAS: roughly 15.4–17.1 km/h from your measured 17.1 MAS. Start nearer 15.5–16 km/h and aim to hold the same pace across all reps rather than blasting the first one. You've recorded low energy today, so keep it controlled if you're doing them today; if you fade badly, stop the hard work rather than forcing the pace. | MAS from the fact ✓; the % band is judgement, labelled only as "about" |

**What Sam decides:** approve / correct each row. A corrected row's ideal
answer becomes its `ownerReview.idealAnswer`. Row 7 is a known S2 defect,
not a review question.

**Sam, 2026-09-10: "approve all".** Recorded in `coachLabCases.ts` as
`ownerReview.status: 'approved'` for rows 1–6 and 8–12, `idealAnswer` = the
exact words above, model `gpt-5.6-terra`, prompt `coach-lab-openai-v4-situation`.
Row 7 stays PENDING: its answer contradicts R-394, so it cannot be the
benchmark; it is re-taped after S2 and reviewed then.

**Row 7 re-taped after slice S2a deployed (coach-chat v11, 2026-09-10), three
runs of "can i do leg curls instead of nordics", log
`/private/tmp/lfa-yearfix-evidence/s2-post-deploy-smoke.log`:**
1. Not as a straight swap in-season: leg curls are useful, but they don't replace Nordics when Nordics are legal. The in-season minimum prioritises a Nordic, with curls able to sit alongside it. Your lower session is today, five days before Saturday's game, which is suitable spacing. You logged low energy today, so keep the Nordic dose controlled and prioritise clean reps; if you can't do them safely, use curls and flag why in the app.
2. Not as a straight replacement by default. In-season, Nordics are prioritised weekly; hamstring curls can stay alongside them but don't replace them when Nordics are practical. If Nordics aggravate something or you can't perform them safely, use the app's injury/equipment pathway rather than forcing them. You're flat today, so keep Monday's lower work crisp and reduce volume if movement quality is off.
3. Not as a straight swap this week. In-season, Nordics are the priority hamstring exercise; leg curls can stay alongside them but don't replace them when Nordics are available. With low energy logged today, keep the Nordic dose controlled and focus on clean reps rather than pushing fatigue. If Nordics cause pain or you can't do them safely, get clinician advice and use the app's restriction pathway.

Three of three apply R-394. Pending Sam's word on which of the three is the
ideal (the first is proposed). "The app's injury/equipment pathway" is not a
door's name — slice S3.
