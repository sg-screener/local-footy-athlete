# Off-season deload — Sam's EXISTING law, reconfirmed 2026-08-05

**This is not a new ruling.** Sam already authored this law and the review
seat failed to find it before asking again. The authorities:

- LFA_PROGRAMMING_BIBLE.md:110 — "the off-season deload ladder runs in
  three stages. Weeks 1-2 (early off-season) are the OPTIONAL block …
  no deload applies … Weeks 3-4 are the TRANSITION block … week 4 does
  not automatically deload. From week 5 onward, normal 3-4 week deload
  cycles begin."
- LFA_PROGRAMMING_BIBLE.md:4609 — "Do not automatically deload at the end
  of Week 4 of this first early/mid block."
- L2_REPORT_BIBLE_AMENDMENT_PASS_2026-07-27.md, amendment 23 (D16).

Sam's reconfirmation today, verbatim: "off season early an doff season
mid are 2x2 block weeks - we dont deload here = only in off season late
should deloads take place"

**Consequence for the unit-7 declared gap (test:deload-week, off-season
block 2):** the defect is not "the deload week reshapes the build week" —
it is that a deload is being SCHEDULED in weeks 1–4 of the off-season at
all, which violates Bible :110/:4609 directly. The payment is enforcement
of the existing law: no deload in the early/mid 2x2 blocks; deload cycles
begin week 5+ (off-season late). The reshaping observation stays recorded
as evidence only.

Build instructions (terminal):
- Survey where generation currently places off-season deloads; report the
  athlete-visible change before regenerating any golden.
- Enforce Bible :110/:4609. The unit-7 declared GAP resolves by this
  route. Differential prediction before code, as usual.
- The Bible is the authority here; if generation's phase model cannot
  express "weeks 1-4 no deload, cycles from week 5", THAT finding comes
  back before any workaround.
