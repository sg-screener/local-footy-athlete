# Conditioning exact-dose and copy checkpoint — 1 September 2026

Owner: `conddosecopy`

## Outcome

The app now has 55 readable conditioning catalogue records: 51 available to
current programming and four retained only so historical saved sessions still
open. Every current athlete card receives one exact prescription before final
composition. No current card exposes a dose range or uses `block(s)` as its
athlete-facing structure word.

The shared prescription resolver now owns exact build-week changes. Continuous
Aerobic Run resolves to 30, 35 and 40 minutes across build weeks one to three.
The exact rung is put into the finished workout row, so the visible card and a
saved/reopened program read the same prescription rather than recalculating a
default.

Run conditioning uses an exact 10-minute running warm-up. Machine conditioning
uses an exact 5-minute warm-up on the selected machine. Existing typed modality
rules remain intact: MAS and personal pace are Run-only; machine work displays
Effort out of 10.

The revised 55-record copy is implemented, including seven 200 m repetitions
with a matching seven-rep cue and the corrected 2-Minute Flush work line. The
four current-program retirements are:

- `Bodyweight Circuit (no-equipment fallback)`
- `Deceleration and Landing Work`
- `Easy Aerobic Flush`
- `Erg EMOM`

They remain display-compatible at legacy ingress but are excluded from current
automatic selection, including the legacy selector.

## Design choice

Two options were compared:

1. Patch the displayed strings on the Session screen.
2. Resolve one exact prescription at the shared conditioning composition
   boundary and make every display/save/restart route consume it.

Option 2 was used. A screen-only patch would have allowed Day, Session, saved
rows and rebuilt weeks to disagree, and it could not correctly vary 30/35/40 by
the program's build week.

## Verification

- `test:conditioning-templates`: 170/170 equality/behaviour cells plus 5/5
  modality cells.
- `test:conditioning-copy-census`: 35/35 athlete-copy census cells.
- `test:conditioning-dose`: 12/12; 220 authored dose cells inspected across 55
  readable catalogue records.
- `test:conditioning-modality-persistence`: green, including 2,738 intensity
  route checks, save/restart and final Erg Flush modality.
- `test:programming-selection-release`: exit 0. Its two-year reversal witness
  changed 0/728 athlete-days and found 0 identity/modality mismatches across 272
  displayed conditioning/speed rows.
- Product TypeScript: zero errors.
- `git diff --check`: clean.

The exact-copy gate is now a direct member of
`test:programming-selection-release`; it is no longer protected only by the much
larger Bible chain.

### Mutation/liveness receipts

- Changing week three Continuous Aerobic Run from 40 back to 30 minutes killed
  the named 30/35/40 cell: 169/170.
- Removing `Erg EMOM`'s retirement flag killed the exact retirement cell:
  168/169 on the mutated active catalogue.
- Both mutations were restored and the final focused gate returned 170/170.

## Existing diagnostic debt kept separate

`test:conditioning-rotation` still asserts the retired pre-selector contract:
that every pool is walked in catalogue order without eligibility/ranking. It is
red against the existing stable ranked selector and is not part of the small
programming release gate. This change did not rewrite the product back toward
that obsolete expectation.

Two repository-wide process gates also retain their inherited reds:

- `test:ruling-registry`: 5 passing checks and 3 failures concerning an old
  missing enforcement file, nine older UNENFORCED rulings and uncited questions
  elsewhere in the shared inbox/status documents.
- `test:law-registry`: 212 guarded laws and 21 inherited UNENFORCED laws. The
  R-300 row itself is guarded, resolves and names a real in-chain script.

## NOT COVERED

- Physical-iPhone Release installation or visual acceptance.
- Regenerated full-year PDFs after this checkpoint.
- VoiceOver, Dynamic Type and localisation.
- Independent sports-science or clinical approval of the revised prescriptions.
- Historical saved sessions whose original data is malformed rather than one of
  the four deliberately retained retired identities.
