#!/usr/bin/env python3
"""
Build docs/INJURY_MATRIX_REVIEW_2026-07-28.xlsx on Sam's FINAL 12-region
vocabulary (ruled 2026-07-28), migrating the old 10-key matrix onto it.

In the load-ratio sheet's mould: prose on its own tab, headers on row 1 of every
data tab, no blank row above any header (see SIGNOFF note), no shared-string
table.
"""
import json
import sys

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

MATRIX_JSON, OUT_XLSX = sys.argv[1], sys.argv[2]

# ── Sam's final region list, his order, his exact labels (2026-07-28) ──
REGIONS = ['groin', 'hip', 'quad', 'hamstring', 'knee', 'calf',
           'ankle/foot', 'lowerBack', 'neck', 'shoulder', 'elbow', 'wrist/hand']

# Old 10-key -> new region. 'adductor' and 'pubalgia' BOTH land on groin: Sam's
# merge ruling. hip / quad / neck are new and have no predecessor at all.
OLD_TO_NEW = {
    'adductor': 'groin',
    'pubalgia': 'groin',
    'lowerBack': 'lowerBack',
    'knee': 'knee',
    'hamstring': 'hamstring',
    'calf': 'calf',
    'ankle': 'ankle/foot',
    'shoulder': 'shoulder',
    'elbow': 'elbow',
    'wrist': 'wrist/hand',
}
NEW_REGIONS = ['hip', 'quad', 'neck']

# ── Flag rules, re-pointed onto the 12 ──
MUSCLE_TO_REGION = {
    'Quads': ['quad', 'knee'],
    'Glutes': ['hip'],
    'Hamstrings': ['hamstring'],
    'Hips': ['hip'],
    'Groin': ['groin', 'hip'],
    'Calves': ['calf', 'ankle/foot'],
    'Low back': ['lowerBack'],
    'Upper back': ['shoulder'],
    'Lats': ['shoulder'],
    'Chest': ['shoulder'],
    'Shoulders': ['shoulder'],
    'Triceps': ['elbow'],
    'Biceps': ['elbow'],
    'Traps': ['neck', 'shoulder'],
    'Midline': ['lowerBack'],
    'Knee': ['knee'],
    'Feet': ['ankle/foot'],
    'Outer hip': ['hip', 'groin'],
    'Grip': ['wrist/hand'],
}

PATTERN_TO_REGION = {
    'squat': ['knee', 'quad', 'lowerBack', 'hip'],
    'lunge': ['knee', 'quad', 'groin', 'hip'],
    'hinge': ['lowerBack', 'hamstring', 'hip'],
    'plyo': ['knee', 'quad', 'calf', 'ankle/foot', 'hamstring'],
    'carry': ['lowerBack', 'shoulder', 'wrist/hand', 'neck'],
    'core': ['lowerBack'],
    'horizontal_push': ['shoulder', 'elbow', 'wrist/hand'],
    'vertical_push': ['shoulder', 'elbow', 'wrist/hand'],
    'horizontal_pull': ['shoulder', 'elbow'],
    'vertical_pull': ['shoulder', 'elbow', 'wrist/hand'],
    'isolation_upper': ['shoulder', 'elbow', 'wrist/hand'],
    'isolation_lower': ['knee', 'quad', 'calf', 'ankle/foot'],
    # 'conditioning' deliberately absent — no rule fires, so those rows are
    # marked unreviewed-by-flags rather than allowed to look flag-clean.
}

GROUP_ORDER = [
    'LOWER BODY — SQUAT / LUNGE',
    'LOWER BODY — HINGE',
    'LOWER BODY — POWER / PLYO',
    'LOWER BODY — ISOLATION (rehab / prehab / tissue work)',
    'CONDITIONING',
    'CARRIES',
    'CORE / TRUNK',
    'UPPER BODY — VERTICAL PUSH',
    'UPPER BODY — HORIZONTAL PUSH',
    'UPPER BODY — VERTICAL PULL',
    'UPPER BODY — HORIZONTAL PULL',
    'UPPER BODY — POWER / PLYO',
    'SHOULDERS / UPPER BACK',
    'ARMS — BICEPS',
    'ARMS — TRICEPS',
]

DEFAULTED = 'good (defaulted)'
DEFAULTED_CHECK = 'good (defaulted — CHECK)'
NEW_REGION = 'unruled (new region)'
NEW_REGION_CHECK = 'unruled (new region — CHECK)'

data = json.load(open(MATRIX_JSON))
records = data['records']

missing = {r['group'] for r in records} - set(GROUP_ORDER)
if missing:
    raise SystemExit(f'group order is missing: {sorted(missing)}')

# ── Migrate each record onto the 12 ──
conflicts = []
for r in records:
    old = r['explicit']
    new = {}
    provenance = ''

    for old_key, value in old.items():
        if old_key in ('adductor', 'pubalgia'):
            continue
        new[OLD_TO_NEW[old_key]] = value

    add, pub = old.get('adductor'), old.get('pubalgia')
    if add and pub:
        if add == pub:
            new['groin'] = add
            provenance = f'adductor={add} + pubalgia={pub} (agreed)'
        else:
            # Sam's ruling: nothing auto-picked. Left UNRULED for him, showing
            # both prior values.
            provenance = f'CONFLICT — adductor={add} vs pubalgia={pub}'
            conflicts.append({'exercise': r['name'], 'group': r['group'],
                              'adductor': add, 'pubalgia': pub})
    elif add:
        new['groin'] = add
        provenance = f'adductor={add} (no pubalgia rating)'
    elif pub:
        new['groin'] = pub
        provenance = f'pubalgia={pub} (no adductor rating)'

    r['new'] = new
    r['groin_provenance'] = provenance
    r['conflicted'] = bool(add and pub and add != pub)

# ── Flags ──
for r in records:
    primary = (r['muscle'] or {}).get('primary', [])
    r['has_signal'] = bool(primary) or r['movement'] in PATTERN_TO_REGION
    regions = set()
    for m in primary:
        if m not in MUSCLE_TO_REGION:
            raise SystemExit(f'unmapped muscle group "{m}" on {r["name"]}')
        regions.update(MUSCLE_TO_REGION[m])
    regions.update(PATTERN_TO_REGION.get(r['movement'], []))
    for region in regions:
        if region not in REGIONS:
            raise SystemExit(f'flag rule targets unknown region "{region}"')

    # A conflicted groin cell is already the loudest thing on its row; do not
    # also flag it, or the row says two different things about the same cell.
    flagged = sorted(
        k for k in regions
        if k not in r['new'] and not (k == 'groin' and r['conflicted'])
    )
    r['flagged'] = flagged

    if not r['has_signal']:
        r['flag_note'] = 'no flag rule — unreviewed by flags'
    elif flagged:
        why = []
        for k in flagged:
            src = []
            if any(k in MUSCLE_TO_REGION.get(m, []) for m in primary):
                src.append('primary muscle')
            if k in PATTERN_TO_REGION.get(r['movement'], []):
                src.append(r['movement'] + ' pattern')
            why.append(f'{k} ({" + ".join(src)})')
        r['flag_note'] = 'CHECK: ' + '; '.join(why)
    else:
        r['flag_note'] = 'no flag — primary muscles and pattern miss every unruled region'

records.sort(key=lambda r: (GROUP_ORDER.index(r['group']), r['name']))


def cell_for(r, region):
    if r['conflicted'] and region == 'groin':
        return f'CONFLICT — adductor={r["explicit"]["adductor"]} vs pubalgia={r["explicit"]["pubalgia"]}'
    if region in r['new']:
        return r['new'][region]
    if region in NEW_REGIONS:
        return NEW_REGION_CHECK if region in r['flagged'] else NEW_REGION
    return DEFAULTED_CHECK if region in r['flagged'] else DEFAULTED


# ── Styling ──
HEAD = Font(bold=True)
TITLE = Font(bold=True, size=13)
FILL_DEFAULTED = PatternFill('solid', fgColor='FFF2CC')
FILL_CHECK = PatternFill('solid', fgColor='F8CBAD')
FILL_EXPLICIT = PatternFill('solid', fgColor='E2EFDA')
FILL_BLIND = PatternFill('solid', fgColor='D9D9D9')
FILL_NEW = PatternFill('solid', fgColor='DEEBF7')       # pale blue — never existed
FILL_CONFLICT = PatternFill('solid', fgColor='FF9999')  # red — Sam must pick
WRAP = Alignment(wrap_text=True, vertical='top')

wb = Workbook()

n = len(records)
pairs = n * len(REGIONS)
authored = sum(len(r['new']) for r in records)
conflict_cells = len(conflicts)
new_region_cells = n * len(NEW_REGIONS)
unruled = pairs - authored - conflict_cells
flag_cells = sum(len(r['flagged']) for r in records)
blind_rows = [r for r in records if not r['has_signal']]

# ═══ Tab 1 — README ═══
ws = wb.active
ws.title = 'README'
readme = [
    ('INJURY MATRIX REVIEW — for Sam to correct and sign', TITLE),
    ('Built on your FINAL 12-region list, ruled 2026-07-28.', None),
    ('', None),
    ('What this is', HEAD),
    ('EXERCISE_TAGS.injury decides whether an exercise is offered to an athlete with', None),
    ('an active injury. Each entry carries one rating per injury region —', None),
    ("'good', 'caution' or 'avoid'.", None),
    ('', None),
    ("THE DEFECT: the inj() helper fills any key you do not write with 'good'. A pair", None),
    ('nobody ever assessed and a pair you reviewed and passed as safe are identical', None),
    ('once merged. Absence renders as approval.', None),
    ('', None),
    (f'{n} exercises x {len(REGIONS)} regions = {pairs} pairs.', HEAD),
    (f'  Authored — carried through the migration below: {authored}', None),
    (f'  Never ruled by anyone: {unruled} ({round(100 * unruled / pairs)}%)', None),
    (f'  Conflicted — you must pick: {conflict_cells}', None),
    ('', None),
    ('A correction to the provenance inventory: it reported 934 of 1,240 on the old', None),
    ('10-key vocabulary. That covered only the 124 entries calling inj({...}) and', None),
    ("missed 25 written as `injury: SAFE` — a bare all-good constant, the same defect", None),
    ('with no override at all. On the old ten the real figure was 1,184 of 1,490.', None),
    ('', None),
    ('The 10 -> 12 migration', HEAD),
    ('Your list adds hip, quad and neck, renames two, and merges two into one:', None),
    ('', None),
    ('  adductor + pubalgia -> groin      MERGED, per your ruling', None),
    ('  ankle               -> ankle/foot  renamed and widened (foot rolls in)', None),
    ('  wrist               -> wrist/hand  renamed and widened (fingers/hand roll in)', None),
    ('  hamstring, knee, calf, lowerBack, shoulder, elbow — unchanged', None),
    ('  hip, quad, neck     -> NEW. No predecessor, so no current value exists.', None),
    ('', None),
    ('THE MERGE CARRIED NOTHING SILENTLY. 16 exercises had adductor and pubalgia', None),
    ('agreeing, and 13 more had a pubalgia rating with no adductor rating; all 29', None),
    ('carry over as authored. 5 CONFLICT and are left for you — see tab 5. The', None),
    ('"groin — prior labels" column on tab 2 shows, for every groin cell, which old', None),
    ('label it came from, so nothing about that column is untraceable.', None),
    ('', None),
    ('Worth knowing: pubalgia was UNREACHABLE. No free-text input in either engine', None),
    ('ever resolved to that bucket — not "pubalgia", not "sports hernia", not', None),
    ('"osteitis pubis". Those 34 ratings were real thinking that never once fired.', None),
    ('Merging them into groin is what makes them reachable for the first time.', None),
    ('', None),
    ('How to rule', HEAD),
    ("Tab 2 is the matrix. Overwrite a cell with a bare 'good', 'caution' or 'avoid'.", None),
    ('', None),
    ('  caution / avoid            — authored, a real decision someone made', None),
    ("  good                       — authored as an explicit 'safe'", None),
    ('  good (defaulted)           — NEVER RULED. The helper wrote it, not a person.', None),
    ('  good (defaulted — CHECK)   — never ruled, and a flag rule says look harder', None),
    ('  unruled (new region)       — hip/quad/neck. No value ever existed here.', None),
    ('  unruled (new region — CHECK) — same, and flagged', None),
    ('  CONFLICT — adductor=… vs pubalgia=… — the 5. Pick one.', None),
    ('', None),
    ('The suffixes are the whole point: they are what let the ingest tell an untouched', None),
    ('cell from one you ruled. Do not tidy them away.', None),
    ('', None),
    ('"unruled (new region)" is NOT the same as "good (defaulted)".', HEAD),
    ('A defaulted cell has been silently acting as \'good\' in the app. A new-region', None),
    ('cell has never existed at all — today a hip complaint is routed to adductor, a', None),
    ('quad complaint to knee, a neck complaint to shoulder. Those three proxies die', None),
    ('when these columns are ruled. They are kept visually distinct so an empty new', None),
    ('column is never mistaken for a reviewed-and-safe one.', None),
    ('', None),
    ('Tab 3 is the sign-off, and it is not optional.', HEAD),
    ('Correcting cells is only half a ruling. The cells you LEAVE alone are still on', None),
    ('the blank default, and they are not promoted to an authored \'good\' on my', None),
    ('reading. Per group, tab 3 asks whether the remaining unruled cells are safe.', None),
    ('A group with no sign-off keeps them unruled, and Phase 2 fails the build on', None),
    ('them rather than assume.', None),
    ('', None),
    ('The flags are MINE, not yours', HEAD),
    (f'{flag_cells} unruled cells are flagged. A flag means this exercise\'s own PRIMARY', None),
    ('muscles (from MUSCLE_EXPERIENCE_FINAL_2026-07-25.xlsx, your sheet) or its', None),
    ('movement pattern overlap that region, so a blank "good" there is the kind most', None),
    ('likely to be wrong. Tab 4 lists every rule. They are inference, not evidence —', None),
    ('an unflagged cell is not endorsed, it merely did not trip a rule.', None),
    ('', None),
    (f'{len(blind_rows)} rows are marked "no flag rule — unreviewed by flags".', HEAD),
    ('The conditioning entries. They are in your muscle sheet, but you authored their', None),
    ('muscle lists EMPTY on purpose — "session format, not an individual movement" —', None),
    ("and 'conditioning' has no movement-pattern rule either. So no rule fires. That is", None),
    ('flag-clean by BLINDNESS, not by analysis, and it is marked and shaded', None),
    ('differently so it is never read as a quiet all-clear. These rows need your eye', None),
    ('more than the flagged ones, not less — they cover sprinting.', None),
    ('', None),
    ('Tab 5 also carries the ROUTING RULES', HEAD),
    ('Free text an athlete types has to reach a region. Today three of your new', None),
    ('regions are silent proxies (quad->knee, hip->adductor, neck->shoulder) and', None),
    ('hand/fingers reach NOTHING at all. Those candidate routes need your ruling too,', None),
    ('or the new columns will be authored and still unreachable — exactly what', None),
    ('happened to pubalgia.', None),
    ('', None),
    ('Two things deliberately NOT here', HEAD),
    ('  Mobility contraindications — a different mechanism (exercisePools InjuryTag,', None),
    ('    its own vocabulary), already yours, your standing ruling. Untouched.', None),
    ('  Any code change — this is Phase 1. Code follows the signed sheet, held equal', None),
    ('    in both directions.', None),
]
for i, (text, font) in enumerate(readme, start=1):
    c = ws.cell(row=i, column=1, value=text or None)
    if font:
        c.font = font
ws.column_dimensions['A'].width = 92

# ═══ Tab 2 — Injury matrix ═══
ws = wb.create_sheet('Injury matrix')
header = (['Group', 'Exercise', 'Pattern', 'Load', 'Primary muscles']
          + REGIONS + ['groin — prior labels', 'Flags'])
ws.append(header)
for c in ws[1]:
    c.font = HEAD
    c.alignment = WRAP

for r in records:
    primary = (r['muscle'] or {}).get('primary', [])
    row = [r['group'], r['name'], r['movement'], r['load'],
           ', '.join(primary) if primary else '—']
    row += [cell_for(r, region) for region in REGIONS]
    row += [r['groin_provenance'] or '—', r['flag_note']]
    ws.append(row)

    excel_row = ws.max_row
    for offset, region in enumerate(REGIONS):
        cell = ws.cell(row=excel_row, column=6 + offset)
        if r['conflicted'] and region == 'groin':
            cell.fill = FILL_CONFLICT
        elif region in r['new']:
            cell.fill = FILL_EXPLICIT
        elif region in NEW_REGIONS:
            cell.fill = FILL_NEW
        elif not r['has_signal']:
            cell.fill = FILL_BLIND
        elif region in r['flagged']:
            cell.fill = FILL_CHECK
        else:
            cell.fill = FILL_DEFAULTED

widths = [46, 30, 17, 10, 28] + [21] * len(REGIONS) + [40, 68]
for i, w in enumerate(widths, start=1):
    ws.column_dimensions[get_column_letter(i)].width = w
ws.freeze_panes = 'C2'

# ═══ Tab 3 — Group sign-off ═══
ws = wb.create_sheet('Group sign-off')
# Written by explicit row index, not append(): an empty append() writes no cells
# and does NOT advance max_row.
#
# AND NO BLANK SPACER ROW ABOVE ANY HEADER. Not because a blank row corrupts the
# file — a blank row emits no <row> element, so a reader never sees it at all.
# The hazard is entirely on THIS side: if the generator counts a blank row when
# computing a header's position, it is working in spreadsheet coordinates while
# the reader works in emitted-row coordinates, and the two silently differ by
# one. That is what made readSheetRecords treat a data row as the header and
# quietly lose a sign-off group on the first build. Keeping every tab free of
# blank rows keeps the two coordinate systems identical, so the index below is
# correct in both.
SIGNOFF_PREAMBLE = [
    'Read this before signing anything below.',
    'Signing a group promotes EVERY unruled cell in it that you did not correct',
    "on tab 2 into an explicitly authored 'good' — including the new hip, quad and",
    'neck cells. Leave a group blank and they stay unruled; Phase 2 then fails the',
    'build on them rather than guess.',
]
for i, line in enumerate(SIGNOFF_PREAMBLE, start=1):
    c = ws.cell(row=i, column=1, value=line)
    if i == 1:
        c.font = HEAD

SIGNOFF_HEADER_ROW = len(SIGNOFF_PREAMBLE) + 1   # NO blank spacer — see above
signoff_header = ['Group', 'Exercises', 'Unruled cells', 'of which new-region',
                  'Flagged cells', 'Conflicts', 'Flag coverage',
                  'SAM: remaining unruled are…', 'SAM: notes']
for col, text in enumerate(signoff_header, start=1):
    c = ws.cell(row=SIGNOFF_HEADER_ROW, column=col, value=text)
    c.font = HEAD
    c.alignment = WRAP

row_at = SIGNOFF_HEADER_ROW
for g in GROUP_ORDER:
    rows = [r for r in records if r['group'] == g]
    if not rows:
        continue
    unruled_g = sum(len(REGIONS) - len(r['new']) - (1 if r['conflicted'] else 0) for r in rows)
    new_g = len(rows) * len(NEW_REGIONS)
    flagged_g = sum(len(r['flagged']) for r in rows)
    conflicts_g = sum(1 for r in rows if r['conflicted'])
    blind = sum(1 for r in rows if not r['has_signal'])
    coverage = (f'NO FLAG RULE RAN on {blind} of {len(rows)} rows'
                if blind else 'all rows flag-reviewed')
    row_at += 1
    for col, value in enumerate(
            [g, len(rows), unruled_g, new_g, flagged_g, conflicts_g, coverage], start=1):
        ws.cell(row=row_at, column=col, value=value)

if row_at - SIGNOFF_HEADER_ROW != len(GROUP_ORDER):
    raise SystemExit(f'sign-off wrote {row_at - SIGNOFF_HEADER_ROW} group rows, '
                     f'expected {len(GROUP_ORDER)}')

for i, w in enumerate([46, 11, 14, 18, 13, 11, 32, 30, 40], start=1):
    ws.column_dimensions[get_column_letter(i)].width = w

# ═══ Tab 4 — Flag rules ═══
ws = wb.create_sheet('Flag rules')
ws.append(['The rules behind every CHECK on tab 2. Mine, not authored — reject a rule '
           'here rather than argue with forty cells.'])
ws['A1'].font = HEAD
ws.append([])
ws.append(["A cell is flagged when the exercise's own PRIMARY muscles or its movement "
           'pattern overlap that region.'])
ws.append(['Secondary muscles deliberately do not fire — they would flag most of the '
           'sheet and the signal would be worthless.'])
ws.append(['neck is deliberately CONSERVATIVE: it fires only from a Traps primary muscle '
           'and from loaded carries. I did not invent a neck rule for pressing or core.'])
ws.append([])
ws.append(['Muscle group (Sam-authored)', 'Flags these regions'])
for c in ws[ws.max_row]:
    c.font = HEAD
for m in sorted(MUSCLE_TO_REGION):
    ws.append([m, ', '.join(MUSCLE_TO_REGION[m]) or '— (no region)'])
ws.append([])
ws.append(['Movement pattern', 'Flags these regions'])
for c in ws[ws.max_row]:
    c.font = HEAD
for p in sorted(PATTERN_TO_REGION):
    ws.append([p, ', '.join(PATTERN_TO_REGION[p])])
ws.append(['conditioning', 'NO RULE — these rows are marked unreviewed by flags'])
ws.column_dimensions['A'].width = 34
ws.column_dimensions['B'].width = 62

# ═══ Tab 5 — Conflicts & routing ═══
ws = wb.create_sheet('Conflicts & routing')
PREAMBLE_5 = [
    'TWO things need your ruling here. Nothing on this tab was auto-decided.',
    'PART A — the 5 groin conflicts. adductor and pubalgia disagreed, so the merge',
    'left the cell UNRULED rather than pick a winner. Taking caution under-restricts;',
    'taking avoid over-restricts. Both prior values are shown. Write one.',
]
for i, line in enumerate(PREAMBLE_5, start=1):
    c = ws.cell(row=i, column=1, value=line)
    if i == 1:
        c.font = HEAD

CONFLICT_HEADER_ROW = len(PREAMBLE_5) + 1
for col, text in enumerate(
        ['Exercise', 'Group', 'adductor said', 'pubalgia said', 'SAM: groin =', 'SAM: notes'],
        start=1):
    c = ws.cell(row=CONFLICT_HEADER_ROW, column=col, value=text)
    c.font = HEAD

row_at = CONFLICT_HEADER_ROW
for c in conflicts:
    row_at += 1
    for col, value in enumerate(
            [c['exercise'], c['group'], c['adductor'], c['pubalgia']], start=1):
        cell = ws.cell(row=row_at, column=col, value=value)
        if col in (3, 4):
            cell.fill = FILL_CONFLICT

# PART B — routing rules, separated by a TITLED row, never a blank one, so that
# spreadsheet coordinates and emitted-row coordinates stay identical on a tab
# that carries TWO headers. See the note above the sign-off preamble.
row_at += 1
ws.cell(row=row_at, column=1,
        value='PART B — routing. Free text an athlete types must reach a region.').font = HEAD
row_at += 1
ws.cell(row=row_at, column=1,
        value='Three of your new regions are silent PROXIES today, and hand/fingers reach '
              'nothing at all. Author these or the new columns stay unreachable.')
row_at += 1
ROUTING_HEADER_ROW = row_at
for col, text in enumerate(
        ['Athlete types…', 'Routes to TODAY', 'Status', 'SAM: routes to', 'SAM: notes'],
        start=1):
    c = ws.cell(row=ROUTING_HEADER_ROW, column=col, value=text)
    c.font = HEAD

ROUTING = [
    ('quad / quads / quadriceps', 'knee', 'PROXY — code labels it one. quad is now a real region.'),
    ('hip / hips', 'adductor', 'PROXY. hip is now a real region.'),
    ('neck', 'shoulder', 'PROXY. neck is now a real region.'),
    ('hand / hands / fingers / thumb', 'NOTHING — resolves to null', 'HOLE. Your ruling rolls these into wrist/hand.'),
    ('foot / feet', 'ankle', 'Already correct — your ankle/foot ruling blesses it.'),
    ('glute / glutes', 'hamstring', 'PROXY. No glute region in your twelve — hip or hamstring?'),
    ('upper back', 'lowerBack', 'PROXY. You ruled NO upper back — is lowerBack where it should land?'),
    ('achilles', 'calf', 'Proxy, but an anatomically reasonable one. Confirm or move to ankle/foot.'),
    ('pubalgia / sports hernia / osteitis pubis', 'NOTHING — resolves to null', 'HOLE. Should these now reach groin?'),
    ('hip flexor', 'NOTHING — resolves to null', 'HOLE. hip, quad, or groin?'),
    ('rib / ribs', 'NOTHING — resolves to null', 'You ruled no ribs. Confirm these stay unroutable.'),
]
for athlete, today, status in ROUTING:
    row_at += 1
    for col, value in enumerate([athlete, today, status], start=1):
        cell = ws.cell(row=row_at, column=col, value=value)
        if col == 2 and 'NOTHING' in str(value):
            cell.fill = FILL_CONFLICT

for i, w in enumerate([40, 26, 62, 22, 34], start=1):
    ws.column_dimensions[get_column_letter(i)].width = w

wb.save(OUT_XLSX)

print(f'rows {n} | regions {len(REGIONS)} | pairs {pairs}')
print(f'authored {authored} | unruled {unruled} | conflicts {conflict_cells} | '
      f'new-region cells {new_region_cells}')
print(f'flagged {flag_cells} | rows with flags {sum(1 for r in records if r["flagged"])} | '
      f'flag-clean by analysis {sum(1 for r in records if r["has_signal"] and not r["flagged"])} | '
      f'unreviewed by flags {len(blind_rows)}')
print(f'signoff header row {SIGNOFF_HEADER_ROW} | conflict header row {CONFLICT_HEADER_ROW} | '
      f'routing header row {ROUTING_HEADER_ROW}')
