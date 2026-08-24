# STATUS — HEADERALIGN

## 2026-08-25 — Day-card header alignment

Sam asked for the plan-options dots to be slightly larger and for the dots,
CORE badge and Strength title to share one vertical middle.

Two options compared: change the shared tier badge alignment everywhere, or
override it only in the selected Day-card header. The local override landed so
week rows and every other badge consumer keep their existing geometry. The dots
grow from 18 to 22 while the existing 24-point visible button and 10-point hit
slop preserve its physical target.

Focused guard: `test:session-change-hub`.

NOT COVERED: screenshots, broad audits, physical iPhone and other badge surfaces.
