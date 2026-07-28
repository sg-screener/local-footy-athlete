#!/usr/bin/env python3
"""
Build docs/INJURY_MATRIX_REVIEW_2026-07-28.xlsx — now the AUTHORED FINAL for the
injury matrix, generated from Sam's ruling set.

    node    scripts/extract-injury-matrix.js      /tmp/matrix.json
    node    scripts/derive-injury-matrix-rules.js /tmp/matrix.json \
            docs/INJURY_MATRIX_RULINGS_2026-07-28.json /tmp/rules.json
    python3 scripts/build-injury-matrix-sheet.py  /tmp/rules.json \
            docs/INJURY_MATRIX_REVIEW_2026-07-28.xlsx
    npm run verify:injury-matrix-sheet

NO BLANK ROWS ON ANY DATA TAB. Not because a blank row corrupts the file — it
emits no <row> element, so a reader never sees one. The hazard is generator-side:
counting a blank row puts this script in spreadsheet coordinates while the reader
is in emitted-row coordinates, and the two silently differ by one. That is what
lost a sign-off group on an earlier build. Separate sections with TITLED rows.
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
declaration = data['declaration']

HEAD = Font(bold=True)
TITLE = Font(bold=True, size=13)
WRAP = Alignment(wrap_text=True, vertical='top')
FILL_EVIDENCE = PatternFill('solid', fgColor='E2EFDA')   # green — reverse-engineered
FILL_SAM = PatternFill('solid', fgColor='DEEBF7')        # blue  — Sam authored it
FILL_NONE = PatternFill('solid', fgColor='F2F2F2')       # grey  — no rule
FILL_EXCEPTION = PatternFill('solid', fgColor='FFF2CC')  # amber — exception
FILL_AVOID = PatternFill('solid', fgColor='FF9999')      # red   — avoid
FILL_BLOCKED = PatternFill('solid', fgColor='FFC000')    # orange— blocked

wb = Workbook()


def write_header(ws, row, columns):
    for column, text in enumerate(columns, start=1):
        cell = ws.cell(row=row, column=column, value=text)
        cell.font = HEAD
        cell.alignment = WRAP


# ═══════════════════════ Tab 1 — Architecture & Rules ═══════════════════════
ws = wb.active
ws.title = 'Architecture & Rules'
dist = summary['distribution']
lines = [
    ('INJURY MATRIX — AUTHORED FINAL (Sam, 2026-07-28)', TITLE),
    ('SOURCE OF TRUTH for injury-based exercise gating. Changes require Sam.', None),
    ('', None),
    ('STATUS: every rule in this workbook is RULED. It is generated from', HEAD),
    ('docs/INJURY_MATRIX_RULINGS_2026-07-28.json, which is the transcript of Sam\'s', None),
    ('ruling set. Nothing here is hand-edited; regenerate rather than patch.', None),
    ('', None),
    ('THE DECLARATION — signed by Sam, 2026-07-28', HEAD),
    (f'  "{declaration["text"]}"', None),
    ('', None),
    ('That signature is what makes an unmatched cell mean something. Before it, an', None),
    ('unmatched cell was UNRULED and had to fail the build. The old inj() default', None),
    ('made absence look like approval; now every \'good\' traces to either a rule, an', None),
    ('exception, or this declaration.', None),
    ('', None),
    ('RESOLUTION MODEL', HEAD),
    ('  Rules live on EITHER axis — movement pattern or primary muscle.', None),
    ('  The STRICTEST matching rule wins.        avoid > caution > good', None),
    ('  Named exercise exceptions beat all rules.', None),
    ('  There is no precedence ordering to author.', None),
    ('', None),
    ('A lattice join plus an override. "Strictest" is associative and commutative,', None),
    ('so the axes cannot disagree about who goes first — which is exactly why no', None),
    ('ordering needs authoring.', None),
    ('', None),
    ('THE THIRTEEN REGIONS', HEAD),
    ('  ' + ', '.join(REGIONS), None),
    ('', None),
    ('  ankle/foot and wrist/hand are single combined regions; the slash is part of', None),
    ('  the athlete-facing label. No upper back; concussion stays with the illness', None),
    ('  doors. ribs was added by amendment on 2026-07-28, superseding both the', None),
    ('  earlier twelve and the "ribs stay unroutable" line.', None),
    ('', None),
    (f'  NEW, with no predecessor: {", ".join(NEW_REGIONS)} — no evidence could exist', None),
    ('  for these, so every rule on them is Sam\'s directly.', None),
    ('', None),
    ('THE NUMBERS', HEAD),
    (f'  {summary["exercises"]} exercises x {summary["regions"]} regions = {summary["cells"]} cells', None),
    (f'  caution {dist.get("caution", 0)} | avoid {dist.get("avoid", 0)} | good {dist.get("good", 0)}', None),
    ('', None),
    (f'  Rules: {summary["ruleCells"]} ({summary["samRuleCells"]} authored by Sam for the new regions)', None),
    (f'  Exceptions: {summary["exceptions"]} ({summary["exceptionsStricter"]} stricter, '
     f'{summary["exceptionsLooser"]} looser)', None),
    (f'  adductor/pubalgia conflicts Sam resolved by hand: {summary["conflictsResolved"]}', None),
    ('', None),
    ('  Where each final cell comes from:', None),
] + [(f'    {source}: {count}', None) for source, count in sorted(
        summary['sourceCounts'].items(), key=lambda kv: -kv[1])] + [
    ('', None),
    (f'ONLY {summary["bindingRules"]} OF THE {summary["ruleCells"]} RULES CURRENTLY BIND.', HEAD),
    (f'The other {summary["redundantRules"]} are redundant: both axes were derived from the same', None),
    ('ratings, so they agree, and removing one leaves the other returning the same', None),
    ('answer. Not a fault — two agreeing axes are belt-and-braces — but asymmetric:', None),
    ('LOOSENING a non-binding rule appears to do nothing, while TIGHTENING any rule', None),
    ('always has effect. Binding rules are shown in BOLD on tabs 2 and 3.', None),
    ('', None),
    ('CONDITIONING — ruled by hand, no new taxonomy', HEAD),
    ('Both rule axes are structurally blind to the 21 conditioning rows: no', None),
    ('movement-pattern rule, and their muscle lists are authored EMPTY on purpose', None),
    ('("session format, not an individual movement"). So Sam ruled them directly.', None),
    ('', None),
    ("Sam's authored principle, recorded verbatim for the future quality-grid unit:", None),
    (f'  "{data["principle"]}"', None),
    ('', None),
    ('STRICTER-WINS applies: the existing sprint hamstring/calf avoids stand above', None),
    ('the blanket cautions. Easy Bike stays good deliberately — it is the escape', None),
    ('hatch.', None),
    ('', None),
    ('FOLLOW-UP, logged not done: conditioning ratings should key to Sam\'s authored', None),
    ('quality grid rather than being per-exercise, once Stage B templates land.', None),
    ('Separate unit, separate sitting.', None),
    ('', None),
    ('TWO THINGS THAT ARE RULED BUT NOT YET LIVE', HEAD),
    ('  1. Three DUAL routes (hip flexor -> hip+quad, achilles -> calf+ankle/foot,', None),
    ('     upper back -> shoulder+neck) are BLOCKED. The resolver is single-target', None),
    ('     in the mechanism. Recorded on tab 6, not implemented, per Sam\'s own stop', None),
    ('     condition.', None),
]
if summary['inertRules']:
    lines += [
        ('  2. The Traps -> neck muscle rule is INERT. "Traps" is in the authored', None),
        ('     muscle vocabulary but is never a PRIMARY muscle on any strength', None),
        ('     exercise, so the rule can never fire. Shrugs — the most neck-loading', None),
        ('     lift in the pool — has primary "Upper back" and pattern', None),
        ('     isolation_upper, so it matches no neck rule and lands on good via the', None),
        ('     declaration. Recorded, flagged, and awaiting Sam. This is the same', None),
        ('     failure mode as pubalgia: authored, and unreachable.', None),
    ]
for index, (text, font) in enumerate(lines, start=1):
    cell = ws.cell(row=index, column=1, value=text or None)
    if font:
        cell.font = font
ws.column_dimensions['A'].width = 92


# ═══════════════════ Tabs 2 & 3 — the rule grids ═══════════════════

def rule_text(rule):
    if rule is None:
        return '—'
    if rule.get('source') == 'sam':
        return f"{rule['value']} ·Sam"
    return f"{rule['value']} ·{rule['support']}/{rule['total']}" + (
        '' if rule['unanimous'] else ' split')


def build_rule_tab(title, axis_label, keys, rules, preamble):
    ws = wb.create_sheet(title)
    for index, line in enumerate(preamble, start=1):
        cell = ws.cell(row=index, column=1, value=line)
        if index == 1:
            cell.font = HEAD
    header_row = len(preamble) + 1
    write_header(ws, header_row, [axis_label] + REGIONS + ['binds'])
    row_at = header_row
    for key in keys:
        row_at += 1
        ws.cell(row=row_at, column=1, value=key)
        binds_total = 0
        for offset, region in enumerate(REGIONS):
            rule = rules[key][region]
            cell = ws.cell(row=row_at, column=2 + offset, value=rule_text(rule))
            if rule is None:
                cell.fill = FILL_NONE
            elif rule.get('source') == 'sam':
                cell.fill = FILL_SAM
            else:
                cell.fill = FILL_EVIDENCE
            if rule is not None and rule.get('binds'):
                cell.font = HEAD          # BOLD = this rule decides something
                binds_total += rule['binds']
        ws.cell(row=row_at, column=2 + len(REGIONS), value=binds_total)
    for i, w in enumerate([22] + [15] * len(REGIONS) + [8], start=1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = f'B{header_row + 1}'
    return header_row, row_at


PATTERN_HEADER_ROW, last = build_rule_tab(
    'Rules — pattern', 'Movement pattern', PATTERNS, data['patternRules'],
    ['RULES ON THE MOVEMENT-PATTERN AXIS — RULED. Strictest wins across both axes.',
     '·n/n = reverse-engineered from ratings already authored, with its support.',
     '·Sam = authored directly by Sam (the new regions, where no evidence could exist).',
     'BOLD = this rule currently binds. "binds" counts the cells it decides.'])
ws = wb['Rules — pattern']
ws.cell(row=last + 1, column=1,
        value=f'DECLARATION (signed {declaration["by"]}, {declaration["date"]}): '
              f'{declaration["text"]}').font = HEAD
DECLARATION_ROW = last + 1

MUSCLE_HEADER_ROW, _ = build_rule_tab(
    'Rules — muscle', 'Primary muscle', MUSCLES, data['muscleRules'],
    ['RULES ON THE PRIMARY-MUSCLE AXIS — RULED. Same vocabulary, same resolution.',
     'Uses Sam\'s authored primary muscles. Secondary muscles carry no rules.',
     'NOTE: a rule naming a muscle that is never PRIMARY anywhere cannot fire —',
     'see the Traps/neck note on tab 1. Inert rules are reported, never dropped.'])

# ═══════════════════════ Tab 4 — Exceptions ═══════════════════════
ws = wb.create_sheet('Exceptions')
EXC = ['NAMED EXERCISE EXCEPTIONS — RULED. These beat every rule.',
       'All 18 stand as authored (Sam, 2026-07-28). None dissolved into the new rules.',
       'Each is where Sam already made a judgement no general rule can express.']
for index, line in enumerate(EXC, start=1):
    cell = ws.cell(row=index, column=1, value=line)
    if index == 1:
        cell.font = HEAD
EXCEPTION_HEADER_ROW = len(EXC) + 1
write_header(ws, EXCEPTION_HEADER_ROW,
             ['Exercise', 'Region', 'The rules say', 'RULED', 'Direction'])
row_at = EXCEPTION_HEADER_ROW
for exception in data['exceptions']:
    row_at += 1
    for column, value in enumerate(
            [exception['exercise'], exception['region'], exception['ruleSays'],
             exception['authored'], exception['direction']], start=1):
        cell = ws.cell(row=row_at, column=column, value=value)
        if column == 4:
            cell.fill = FILL_AVOID if value == 'avoid' else FILL_EXCEPTION
for i, w in enumerate([30, 13, 18, 12, 12], start=1):
    ws.column_dimensions[get_column_letter(i)].width = w

# ═══════════════════════ Tab 5 — Conditioning ═══════════════════════
ws = wb.create_sheet('Conditioning')
COND = ['CONDITIONING — RULED BY HAND (Sam, 2026-07-28). No new taxonomy.',
        f'Principle: "{data["principle"]}"',
        'Stricter-wins: the existing sprint hamstring/calf avoids stand above the',
        'blanket cautions. Easy Bike stays good deliberately — it is the escape hatch.']
for index, line in enumerate(COND, start=1):
    cell = ws.cell(row=index, column=1, value=line)
    if index == 1:
        cell.font = HEAD
CONDITIONING_HEADER_ROW = len(COND) + 1
write_header(ws, CONDITIONING_HEADER_ROW, ['Exercise', 'Family'] + REGIONS)
row_at = CONDITIONING_HEADER_ROW
for row in data['conditioning']:
    row_at += 1
    ws.cell(row=row_at, column=1, value=row['name'])
    ws.cell(row=row_at, column=2, value=row['family'])
    for offset, region in enumerate(REGIONS):
        value = row['final'][region]
        cell = ws.cell(row=row_at, column=3 + offset, value=value)
        cell.fill = (FILL_AVOID if value == 'avoid'
                     else FILL_EVIDENCE if value == 'caution' else FILL_NONE)
for i, w in enumerate([34, 12] + [13] * len(REGIONS), start=1):
    ws.column_dimensions[get_column_letter(i)].width = w
ws.freeze_panes = f'C{CONDITIONING_HEADER_ROW + 1}'

# ═══════════════════════ Tab 6 — Routing ═══════════════════════
ws = wb.create_sheet('Routing')
ROUTE = ['ROUTING — free text an athlete types must reach a region. RULED.',
         'A region nobody can reach is a region that does not exist: that is exactly',
         'what happened to pubalgia, authored on 34 exercises and never once fired.',
         'PART A — single-target routes. Ruled and implementable.']
for index, line in enumerate(ROUTE, start=1):
    cell = ws.cell(row=index, column=1, value=line)
    if index in (1, 4):
        cell.font = HEAD
ROUTING_HEADER_ROW = len(ROUTE) + 1
write_header(ws, ROUTING_HEADER_ROW, ['Athlete types…', 'RULED region', 'Status'])
row_at = ROUTING_HEADER_ROW
for phrase, target in data['routing']['single'].items():
    if phrase == '_':
        continue
    row_at += 1
    ws.cell(row=row_at, column=1, value=phrase)
    ws.cell(row=row_at, column=2, value=target).fill = FILL_EVIDENCE
    ws.cell(row=row_at, column=3, value='ruled — single target, implementable')

row_at += 1
ws.cell(row=row_at, column=1,
        value='PART B — DUAL-TARGET routes: NONE. Ruled out by Sam, 2026-07-28.').font = HEAD
row_at += 1
ws.cell(row=row_at, column=1,
        value='Routing is SINGLE-TARGET everywhere: hip flexor -> hip, achilles -> calf, '
              'upper back -> shoulder. Episode-identity semantics (bucket equality in '
              'coachInjuryTargetResolver) therefore stay untouched. Logged as a possible '
              'future refinement ONLY if athlete complaints expose coverage gaps.')
DUAL_HEADER_ROW = row_at
if [k for k in data['routing']['dual'] if k != '_']:
    raise SystemExit('duals are ruled out — the ruling file should carry none')
for i, w in enumerate([42, 26, 46], start=1):
    ws.column_dimensions[get_column_letter(i)].width = w

# ═══════════════════════ Tab 7 — Final matrix ═══════════════════════
ws = wb.create_sheet('Final matrix')
FINAL = ['THE DERIVED MATRIX — every exercise x every region, fully authored.',
         'Generated from the rules, exceptions, conditioning rulings and the signed',
         'declaration. Not a ruling surface: change the rules, not these cells.',
         '(exc) = a named exception decided it. (dec) = the declaration decided it.']
for index, line in enumerate(FINAL, start=1):
    cell = ws.cell(row=index, column=1, value=line)
    if index == 1:
        cell.font = HEAD
FINAL_HEADER_ROW = len(FINAL) + 1
write_header(ws, FINAL_HEADER_ROW, ['Group', 'Exercise', 'Pattern'] + REGIONS)
row_at = FINAL_HEADER_ROW
for row in data['strength'] + data['conditioning']:
    row_at += 1
    for column, value in enumerate([row['group'], row['name'], row['movement']], start=1):
        ws.cell(row=row_at, column=column, value=value)
    for offset, region in enumerate(REGIONS):
        value = row['final'][region]
        source = row['finalSource'][region]
        suffix = ' (exc)' if source == 'exception' else ' (dec)' if source == 'declaration' else ''
        cell = ws.cell(row=row_at, column=4 + offset, value=f'{value}{suffix}')
        cell.fill = (FILL_AVOID if value == 'avoid'
                     else FILL_EXCEPTION if source == 'exception'
                     else FILL_EVIDENCE if value == 'caution' else FILL_NONE)
for i, w in enumerate([46, 30, 17] + [15] * len(REGIONS), start=1):
    ws.column_dimensions[get_column_letter(i)].width = w
ws.freeze_panes = f'C{FINAL_HEADER_ROW + 1}'

wb.save(OUT_XLSX)

print(f'tabs {len(wb.sheetnames)}: {", ".join(wb.sheetnames)}')
print(f'header rows — pattern {PATTERN_HEADER_ROW}, muscle {MUSCLE_HEADER_ROW}, '
      f'exceptions {EXCEPTION_HEADER_ROW}, conditioning {CONDITIONING_HEADER_ROW}, '
      f'routing {ROUTING_HEADER_ROW}, dual {DUAL_HEADER_ROW}, final {FINAL_HEADER_ROW}, '
      f'declaration {DECLARATION_ROW}')
