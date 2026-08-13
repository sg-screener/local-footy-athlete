# STATUS — seat `elegance`

Opened 2026-08-14 for Sam's full audit of why LFA is complicated, bloated and
still not producing programming close to the intended standard. `elegance` was
not present in `docs/STATUS_*.md` when this seat started.

This is measurement and review only. This seat writes no app code. Findings are
recorded here only after the real generation, projection, edit or adaptation
path has been traced or run.

## 2026-08-14 — conclusion

The app's main failure is not that it lacks rules. It is that it has no single
composition owner that consumes those rules and athlete inputs before choosing
the week. The real path builds a candidate, rewrites it, validates it, repairs
it, may regenerate it, adds work after acceptance, checks that added work again,
then resolves and projects it again for the screen. Several recent fixes proved
that changing one late layer is inert or is undone by a later one.

Measured receipts and the two architectural options are in
`docs/ELEGANCE_AUDIT_2026-08-14.md`.

Key current runs:

- `npm run print:week`: 6 weeks, 18 athlete-visible findings, including 8 in the
  bodyweight-only week.
- `npm run sim:changeover`: 5 different four-week histories, identical week 5;
  the logging control stored 67 loads across 23 days.
- `npm run test:scenarios`: 64/65.
- `npm run test:qa`: 168 assertions passed / 10 failed across 17 scenarios.
- `npm run test:ladder-wide`: 92 deficient of 318 laddered days, above the
  banked ceiling of 88.
- `npm run test:compile`: gate green against a baseline containing 35 product,
  51 devtool and 373 test errors (459 total).
- `npm run test:repo-law-guards`: 61/4.
- `npm run test:law-registry`: 21 of 125 laws unenforced.
- `npm run test:vocabulary-census`: 93 unchecked crosswalks; 29 concepts have
  42 redundant declarations.
- `npm run test:computed-must-be-consumed`: 16 of 43 assigned contract fields
  have no reader.

Architecture measurement (`node scripts/measure-elegance-audit.js`): 549
production TypeScript files / 266,430 lines; 59 files over 1,000 lines; a
232-file circular import group; 242 production files are in cycles. The
coach/edit surface alone is 79 files / 73,031 lines.

Yesterday's git range (`45e34bdb..HEAD`): 617 commits, 323 files changed,
54,459 lines added and 2,685 removed. Net production source grew 6,791 lines;
tests/scripts 14,995; docs 29,086. The support system grew about 6.5 times as
much as the product source.
