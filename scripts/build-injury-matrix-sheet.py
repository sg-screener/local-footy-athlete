#!/usr/bin/env python3
"""
Build docs/INJURY_MATRIX_REVIEW_2026-07-28.xlsx — Sam's one-sitting ruling
package for the injury matrix, RULES-FIRST.

Step 3 of 3. Run from the repo root:

    node    scripts/extract-injury-matrix.js       /tmp/matrix.json
    node    scripts/derive-injury-matrix-rules.js  /tmp/matrix.json /tmp/rules.json
    python3 scripts/build-injury-matrix-sheet.py   /tmp/rules.json \
            docs/INJURY_MATRIX_REVIEW_2026-07-28.xlsx
    npm run verify:injury-matrix-sheet

── Sheet conventions, and one hard rule ──

Prose on its own tab; headers on a pinned row of every data tab; openpyxl emits
inline strings, which is what the repo's own xlsxReader models.

NO BLANK ROWS ON ANY DATA TAB. Not because a blank row corrupts the file — a
blank row emits no <row> element, so a reader never sees one at all. The hazard
is entirely on THIS side: if the generator counts a blank row when computing a
header's position, it is working in spreadsheet coordinates while the reader
works in emitted-row coordinates, and the two silently differ by one. That is
what made readSheetRecords treat a data row as a header and quietly lose a
sign-off group on an earlier build. Keeping every tab free of blank rows keeps
the two coordinate systems identical. Separate sections with TITLED rows.
"""
import json
import sys

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

RULES_JSON, OUT_XLSX = sys.argv[1], sys.argv[2]
data = json.load(open(RULES_JSON))

REGIONS = data['REGIONS']
NEW_REGIONS = data['NEW_REGIONS']
PATTERNS = data['PATTERNS']
MUSCLES = data['MUSCLES']
summary = data['summary']

NO_EVIDENCE = '—'
NO_EVIDENCE_NEW = '— new region'

HEAD = Font(bold=True)
TITLE = Font(bold=True, size=13)
WRAP = Alignment(wrap_text=True, vertical='top')
FILL_UNANIMOUS = PatternFill('solid', fgColor='E2EFDA')   # green — one value, no argument
FILL_SPLIT = PatternFill('solid', fgColor='FFF2CC')       # amber — split, see exceptions
FILL_BLANK = PatternFill('solid', fgColor='F2F2F2')       # grey — author fresh
FILL_NEW = PatternFill('solid', fgColor='DEEBF7')         # blue — new region
FILL_CONFLICT = PatternFill('solid', fgColor='FF9999')    # red — Sam must pick
FILL_AUTHORED = PatternFill('solid', fgColor='E2EFDA')

wb = Workbook()


def write_header(ws, row, columns):
    for column, text in enumerate(columns, start=1):
        cell = ws.cell(row=row, column=column, value=text)
        cell.font = HEAD
        cell.alignment = WRAP


def rule_cell(rule, region):
    """Cell text for one rule-grid cell, carrying its evidence inline."""
    if rule is None:
        return NO_EVIDENCE_NEW if region in NEW_REGIONS else NO_EVIDENCE
    if rule['unanimous']:
        return f"{rule['value']} ·{rule['support']}/{rule['total']}"
    return f"{rule['value']} ·{rule['support']}/{rule['total']} split"


# ═══════════════════════════ Tab 1 — README ═══════════════════════════
ws = wb.active
ws.title = 'README'
readme = [
    ('INJURY MATRIX — RULE TABLE, for Sam to correct and sign', TITLE),
    ('One sitting. Everything that needs your ruling is in this workbook.', None),
    ('', None),
    ('Why this is a rule table and not 1,788 cells', HEAD),
    ('EXERCISE_TAGS.injury decides whether an exercise is offered to an athlete with', None),
    ('an active injury. 149 exercises x 12 regions is 1,788 individual ratings, and', None),
    ('nobody should rule those one at a time.', None),
    ('', None),
    (f'So the rules come first. {summary["patternEvidence"]} pattern-axis and '
     f'{summary["muscleEvidence"]} muscle-axis cells are', None),
    ('pre-filled from the ratings you have ALREADY authored, with the evidence shown', None),
    (f'in the cell. {summary["exceptions"]} exercises break their rule and are named on tab 4.', None),
    ('', None),
    ('THE RULES REPRODUCE YOUR AUTHORED DATA EXACTLY. Rules plus those', HEAD),
    (f'{summary["exceptions"]} exceptions regenerate all {summary["authoredCells"]} '
     'ratings authored today with zero', None),
    ('divergences — checked every time this workbook is built, and the build FAILS if', None),
    ('it stops being true. This is a faithful compression of your own decisions, not', None),
    ('a summary that approximates them.', None),
    ('', None),
    ('How resolution works — your ruling, 2026-07-28', HEAD),
    ('  Rules live on EITHER axis: movement pattern (tab 2) or primary muscle (tab 3).', None),
    ('  The STRICTEST matching rule wins.       avoid > caution > good', None),
    ('  Named exercise exceptions (tab 4) beat all rules.', None),
    ('  There is no precedence ordering to author.', None),
    ('', None),
    ('That works because "strictest" does not care what order the axes are applied', None),
    ('in. A squat that is also quad-dominant simply takes the stricter of the two.', None),
    ('', None),
    ('Reading a rule cell', HEAD),
    ('  caution ·7/7        7 exercises authored this, all agreed. Strong.', None),
    ('  caution ·5/6 split  5 of 6 agreed; the odd one out is named on tab 4.', None),
    ('  —                   no evidence. Author fresh, or leave blank for "no rule".', None),
    ('  — new region        hip / quad / neck. No evidence CAN exist — they are new.', None),
    ('', None),
    ('  BOLD                this rule currently BINDS. Colour = evidence, weight = effect.', None),
    ('', None),
    (f'ONLY {summary["bindingRules"]} OF THE {summary["patternEvidence"] + summary["muscleEvidence"]} '
     f'PRE-FILLED RULES CURRENTLY BIND. The other', HEAD),
    (f'{summary["redundantRules"]} are redundant today: the two axes were derived from the same', None),
    ('ratings, so they mostly agree, and removing one still leaves the other', None),
    ('returning the same answer.', None),
    ('', None),
    ('This matters when you edit. LOOSENING a non-bold rule will appear to do', None),
    ('nothing — the other axis still binds. TIGHTENING any rule always has effect,', None),
    ('because strictest wins. So redundancy is asymmetric, not harmless, and it is', None),
    ('not a fault to fix: two agreeing axes are belt-and-braces. Tab 7 shows what the', None),
    ('rules actually produce, so you can always check where an edit landed.', None),
    ('', None),
    ('Overwrite a cell with a bare good / caution / avoid. The ·n/n suffix is', None),
    ('provenance and is stripped on the way in — do not tidy it away by hand.', None),
    ('', None),
    ('THE ONE THING THAT IS NOT A CELL', HEAD),
    ('If no rule matches an exercise/region and no exception names it, what is it?', None),
    ('The safe reading is \'good\' — but that is exactly the blank-means-safe default', None),
    ('this whole unit exists to kill, so it is not assumed. Tab 2 carries a single', None),
    ('declaration line for you to sign. Unsigned, those cells stay UNRULED and Phase 2', None),
    ('fails the build on them rather than guess.', None),
    ('', None),
    ('What is in this workbook', HEAD),
    ('  Tab 2  Rules — movement pattern      12 patterns x 12 regions', None),
    ('  Tab 3  Rules — primary muscle        16 muscles x 12 regions', None),
    (f'  Tab 4  Exceptions                    {summary["exceptions"]} named, plus blanks for more', None),
    ('  Tab 5  Conditioning — by hand        21 rows. Rules do not reach these.', None),
    ('  Tab 6  Conflicts & routing           5 groin conflicts + 11 routing rules', None),
    ('  Tab 7  Reference — every exercise    what the rules currently produce. Read-only.', None),
    ('', None),
    ('Why conditioning is ruled by hand', HEAD),
    ('Your ruling: no new tier/impact taxonomy gets invented for this. The 21', None),
    ('conditioning entries have no movement-pattern rule, and you authored their', None),
    ('muscle lists EMPTY on purpose ("session format, not an individual movement"),', None),
    ('so BOTH axes are blind to them. Neither axis can carry a rule, so they are ruled', None),
    ('directly on tab 5.', None),
    ('', None),
    ('FOLLOW-UP, logged not done: conditioning ratings should eventually key to your', None),
    ('authored quality grid rather than being per-exercise, once Stage B\'s templates', None),
    ('land. That is a separate unit with its own sitting — not smuggled in here.', None),
    ('', None),
    ('The 10 -> 12 migration, and what it cost', HEAD),
    ('  adductor + pubalgia -> groin        MERGED, your ruling', None),
    ('  ankle -> ankle/foot, wrist -> wrist/hand   renamed and widened', None),
    ('  hip, quad, neck                     NEW. No predecessor, no evidence.', None),
    ('', None),
    ('16 exercises had adductor and pubalgia agreeing, 13 had pubalgia only and 5 had', None),
    ('adductor only — all 34 carried over as authored. The 5 that DISAGREE are on tab 6', None),
    ('with both prior values, unruled. Nothing was auto-picked.', None),
    ('', None),
    ('Worth knowing: pubalgia was UNREACHABLE. No free-text input in either engine', None),
    ('ever resolved to it — not "pubalgia", not "sports hernia", not "osteitis pubis".', None),
    ('Those 34 ratings never once fired. That is also why tab 6 Part B matters: a', None),
    ('region nobody can reach is a region that does not exist.', None),
    ('', None),
    ('Out of scope: mobility contraindications (different mechanism, already yours),', None),
    ('and any code change — code follows the signed sheet, held equal both directions.', None),
]
for index, (text, font) in enumerate(readme, start=1):
    cell = ws.cell(row=index, column=1, value=text or None)
    if font:
        cell.font = font
ws.column_dimensions['A'].width = 92

# ═══════════════════ Tabs 2 & 3 — the rule grids ═══════════════════

DECLARATION = ('DECLARATION — sign here: an exercise/region with NO matching rule and no '
               'exception is  ->')

def build_rule_tab(title, axis_label, keys, rules, preamble):
    ws = wb.create_sheet(title)
    for index, line in enumerate(preamble, start=1):
        cell = ws.cell(row=index, column=1, value=line)
        if index == 1:
            cell.font = HEAD
    header_row = len(preamble) + 1
    write_header(ws, header_row, [axis_label] + REGIONS + ['SAM: notes'])

    row_at = header_row
    for key in keys:
        row_at += 1
        ws.cell(row=row_at, column=1, value=key)
        for offset, region in enumerate(REGIONS):
            rule = rules[key][region]
            cell = ws.cell(row=row_at, column=2 + offset, value=rule_cell(rule, region))
            if rule is None:
                cell.fill = FILL_NEW if region in NEW_REGIONS else FILL_BLANK
            elif rule['unanimous']:
                cell.fill = FILL_UNANIMOUS
            else:
                cell.fill = FILL_SPLIT
            # BOLD = this rule currently BINDS. Colour carries evidence quality,
            # weight carries whether the rule decides anything. A non-bold rule
            # can be loosened with no visible effect, because the other axis
            # already returns the same answer — see the README.
            if rule is not None and rule.get('binds'):
                cell.font = HEAD
    return ws, header_row, row_at


ws, PATTERN_HEADER_ROW, last = build_rule_tab(
    'Rules — pattern', 'Movement pattern', PATTERNS, data['patternRules'],
    [
        'RULES ON THE MOVEMENT-PATTERN AXIS. Overwrite any cell with good / caution / avoid.',
        'Strictest matching rule wins across BOTH axes; tab 4 exceptions beat every rule.',
        'A blank cell means this pattern contributes no rule for that region — that is a',
        'legitimate answer, not an omission.',
    ])
# The declaration goes on a TITLED row directly under the grid — never a blank row.
ws.cell(row=last + 1, column=1, value=DECLARATION).font = HEAD
ws.cell(row=last + 1, column=2, value=None).fill = FILL_CONFLICT
PATTERN_DECLARATION_ROW = last + 1
for i, w in enumerate([22] + [17] * len(REGIONS) + [40], start=1):
    ws.column_dimensions[get_column_letter(i)].width = w
ws.freeze_panes = 'B%d' % (PATTERN_HEADER_ROW + 1)

ws, MUSCLE_HEADER_ROW, last = build_rule_tab(
    'Rules — muscle', 'Primary muscle', MUSCLES, data['muscleRules'],
    [
        'RULES ON THE PRIMARY-MUSCLE AXIS. Same vocabulary, same resolution.',
        'These use YOUR authored primary muscles from MUSCLE_EXPERIENCE_FINAL_2026-07-25.',
        'Secondary muscles carry no rules — they would touch most of the sheet and the',
        'signal would be worthless.',
    ])
for i, w in enumerate([22] + [17] * len(REGIONS) + [40], start=1):
    ws.column_dimensions[get_column_letter(i)].width = w
ws.freeze_panes = 'B%d' % (MUSCLE_HEADER_ROW + 1)

# ═══════════════════════ Tab 4 — Exceptions ═══════════════════════
ws = wb.create_sheet('Exceptions')
EXC_PREAMBLE = [
    'NAMED EXERCISE EXCEPTIONS. These beat every rule on tabs 2 and 3.',
    'Each one is an exercise whose authored rating today DISAGREES with what the rules',
    'would produce. They are not errors — they are where you already made a judgement the',
    'general rule cannot express. Confirm, change, or delete each.',
    'Deleting an exception means that exercise falls back to its rules.',
]
for index, line in enumerate(EXC_PREAMBLE, start=1):
    cell = ws.cell(row=index, column=1, value=line)
    if index == 1:
        cell.font = HEAD
EXCEPTION_HEADER_ROW = len(EXC_PREAMBLE) + 1
write_header(ws, EXCEPTION_HEADER_ROW,
             ['Exercise', 'Region', 'The rules say', 'Authored today', 'Direction',
              'SAM: rating', 'SAM: notes'])
row_at = EXCEPTION_HEADER_ROW
for exception in data['exceptions']:
    row_at += 1
    for column, value in enumerate(
            [exception['exercise'], exception['region'], exception['ruleSays'],
             exception['authored'], exception['direction']], start=1):
        cell = ws.cell(row=row_at, column=column, value=value)
        if column == 4:
            cell.fill = FILL_AUTHORED
# Blank-but-titled rows for Sam to add exceptions, so he never has to insert rows
# (inserting a row above a header is the one edit that shifts the reader's index).
for spare in range(6):
    row_at += 1
    ws.cell(row=row_at, column=1, value=f'(spare {spare + 1} — add an exception here)')
for i, w in enumerate([30, 13, 18, 16, 12, 14, 44], start=1):
    ws.column_dimensions[get_column_letter(i)].width = w

# ═══════════════════ Tab 5 — Conditioning, by hand ═══════════════════
ws = wb.create_sheet('Conditioning')
COND_PREAMBLE = [
    'THE 21 CONDITIONING ROWS — ruled BY HAND, per your ruling. No new taxonomy.',
    'Both rule axes are blind here: conditioning has no movement-pattern rule, and you',
    'authored these muscle lists EMPTY on purpose ("session format, not an individual',
    'movement"). So no rule reaches them and no flag ever fired on them either.',
    'These cover sprinting. A wrong \'good\' on hamstring does the most damage here.',
    'FOLLOW-UP (logged, not done): these should eventually key to your authored quality',
    'grid rather than being per-exercise, once Stage B templates land. Separate unit.',
]
for index, line in enumerate(COND_PREAMBLE, start=1):
    cell = ws.cell(row=index, column=1, value=line)
    if index in (1, 5):
        cell.font = HEAD
CONDITIONING_HEADER_ROW = len(COND_PREAMBLE) + 1
write_header(ws, CONDITIONING_HEADER_ROW, ['Exercise'] + REGIONS + ['SAM: notes'])
row_at = CONDITIONING_HEADER_ROW
for row in data['conditioning']:
    row_at += 1
    ws.cell(row=row_at, column=1, value=row['name'])
    for offset, region in enumerate(REGIONS):
        authored = row['authored'].get(region)
        if authored:
            text, fill = authored, FILL_AUTHORED
        elif region in NEW_REGIONS:
            text, fill = 'unruled (new region)', FILL_NEW
        else:
            text, fill = 'unruled', FILL_BLANK
        ws.cell(row=row_at, column=2 + offset, value=text).fill = fill
for i, w in enumerate([34] + [19] * len(REGIONS) + [34], start=1):
    ws.column_dimensions[get_column_letter(i)].width = w
ws.freeze_panes = 'B%d' % (CONDITIONING_HEADER_ROW + 1)

# ═══════════════════ Tab 6 — Conflicts & routing ═══════════════════
ws = wb.create_sheet('Conflicts & routing')
PART_A = [
    'TWO things need ruling here. Nothing on this tab was auto-decided.',
    'PART A — the 5 groin conflicts. adductor and pubalgia disagreed, so the merge left',
    'the cell UNRULED rather than pick a winner. Taking caution under-restricts; taking',
    'avoid over-restricts. Both prior values are shown. Write one.',
]
for index, line in enumerate(PART_A, start=1):
    cell = ws.cell(row=index, column=1, value=line)
    if index == 1:
        cell.font = HEAD
CONFLICT_HEADER_ROW = len(PART_A) + 1
write_header(ws, CONFLICT_HEADER_ROW,
             ['Exercise', 'Group', 'adductor said', 'pubalgia said', 'SAM: groin =', 'SAM: notes'])
row_at = CONFLICT_HEADER_ROW
for row in data['rows']:
    if not row['conflict']:
        continue
    row_at += 1
    for column, value in enumerate(
            [row['name'], row['group'], row['conflict']['adductor'], row['conflict']['pubalgia']],
            start=1):
        cell = ws.cell(row=row_at, column=column, value=value)
        if column in (3, 4):
            cell.fill = FILL_CONFLICT

# PART B — separated by TITLED rows, never blank ones.
row_at += 1
ws.cell(row=row_at, column=1,
        value='PART B — ROUTING. Free text an athlete types must reach a region.').font = HEAD
row_at += 1
ws.cell(row=row_at, column=1,
        value='Three of your new regions are silent PROXIES today and several inputs reach '
              'NOTHING. Author these or the new columns are unreachable — which is exactly '
              'how pubalgia died.')
row_at += 1
ROUTING_HEADER_ROW = row_at
write_header(ws, ROUTING_HEADER_ROW,
             ['Athlete types…', 'Routes to TODAY', 'Status', 'SAM: routes to', 'SAM: notes'])
ROUTING = [
    ('quad / quads / quadriceps', 'knee', 'PROXY — the code labels it one. quad is now a real region.'),
    ('hip / hips', 'adductor', 'PROXY. hip is now a real region.'),
    ('neck', 'shoulder', 'PROXY. neck is now a real region.'),
    ('hand / hands / fingers / thumb', 'NOTHING — resolves to null', 'HOLE. Your ruling rolls these into wrist/hand.'),
    ('foot / feet', 'ankle', 'Already correct — your ankle/foot ruling blesses it.'),
    ('glute / glutes', 'hamstring', 'PROXY. No glute region in your twelve — hip or hamstring?'),
    ('upper back', 'lowerBack', 'PROXY. You ruled NO upper back — is lowerBack where it lands?'),
    ('achilles', 'calf', 'Proxy, anatomically reasonable. Confirm, or move to ankle/foot.'),
    ('pubalgia / sports hernia / osteitis pubis', 'NOTHING — resolves to null', 'HOLE. Should these now reach groin?'),
    ('hip flexor', 'NOTHING — resolves to null', 'HOLE. hip, quad, or groin?'),
    ('rib / ribs', 'NOTHING — resolves to null', 'You ruled no ribs. Confirm these stay unroutable.'),
]
for athlete, today, status in ROUTING:
    row_at += 1
    for column, value in enumerate([athlete, today, status], start=1):
        cell = ws.cell(row=row_at, column=column, value=value)
        if column == 2 and 'NOTHING' in str(value):
            cell.fill = FILL_CONFLICT
for i, w in enumerate([40, 26, 60, 22, 32], start=1):
    ws.column_dimensions[get_column_letter(i)].width = w

# ═══════════ Tab 7 — Reference: what the rules produce ═══════════
ws = wb.create_sheet('Reference')
REF_PREAMBLE = [
    'REFERENCE — READ-ONLY. Do not rule here; rule on tabs 2-6.',
    'This is what the rule table currently produces for every strength exercise, so you',
    'can sanity-check a rule by seeing where it lands. Cells marked (exc) come from a',
    'tab 4 exception; (conflict) is waiting on tab 6; blank means no rule matches and',
    'the tab 2 declaration decides it.',
]
for index, line in enumerate(REF_PREAMBLE, start=1):
    cell = ws.cell(row=index, column=1, value=line)
    if index == 1:
        cell.font = HEAD
REFERENCE_HEADER_ROW = len(REF_PREAMBLE) + 1
write_header(ws, REFERENCE_HEADER_ROW,
             ['Group', 'Exercise', 'Pattern', 'Primary muscles'] + REGIONS)
exception_keys = {(e['exercise'], e['region']) for e in data['exceptions']}
row_at = REFERENCE_HEADER_ROW
for row in data['strength']:
    row_at += 1
    for column, value in enumerate(
            [row['group'], row['name'], row['movement'],
             ', '.join(row['primary']) if row['primary'] else '—'], start=1):
        ws.cell(row=row_at, column=column, value=value)
    for offset, region in enumerate(REGIONS):
        if row['conflict'] and region == 'groin':
            text, fill = '(conflict — tab 6)', FILL_CONFLICT
        else:
            derived = row['derived'][region]
            if derived is None:
                text, fill = '(no rule)', FILL_BLANK
            elif (row['name'], region) in exception_keys:
                text, fill = f'{derived} (exc)', FILL_SPLIT
            else:
                text, fill = derived, FILL_UNANIMOUS
        ws.cell(row=row_at, column=5 + offset, value=text).fill = fill
for i, w in enumerate([46, 30, 17, 28] + [17] * len(REGIONS), start=1):
    ws.column_dimensions[get_column_letter(i)].width = w
ws.freeze_panes = 'C%d' % (REFERENCE_HEADER_ROW + 1)

wb.save(OUT_XLSX)

print(f'tabs {len(wb.sheetnames)}: {", ".join(wb.sheetnames)}')
print(f'pattern rules {summary["patternEvidence"]}/{summary["patternGridCells"]} | '
      f'muscle rules {summary["muscleEvidence"]}/{summary["muscleGridCells"]} | '
      f'exceptions {summary["exceptions"]} | conditioning {summary["conditioning"]} | '
      f'conflicts {summary["conflicts"]}')
print(f'header rows — pattern {PATTERN_HEADER_ROW}, muscle {MUSCLE_HEADER_ROW}, '
      f'exceptions {EXCEPTION_HEADER_ROW}, conditioning {CONDITIONING_HEADER_ROW}, '
      f'conflicts {CONFLICT_HEADER_ROW}, routing {ROUTING_HEADER_ROW}, '
      f'reference {REFERENCE_HEADER_ROW}, declaration {PATTERN_DECLARATION_ROW}')
