#!/usr/bin/env python3
"""
Build docs/EXPOSURE_CONTRACT_REVIEW_2026-07-28.xlsx — the Batch 2 review sheet.

    python3 scripts/build-exposure-contract-sheet.py \
            docs/EXPOSURE_CONTRACT_REVIEW_2026-07-28.xlsx
    npm run verify:exposure-contract-sheet

In the load-ratio mould: every cell prefilled with the CURRENT shipped value, a
flag, the Bible coverage where it exists, and a blank RULED VALUE column. Sam
rules conversationally; Cowork extracts this for the sitting.

NO BLANK ROWS ON ANY DATA TAB. A blank row emits no <row> element, so the reader
never sees one — which puts this generator in spreadsheet coordinates while the
reader is in emitted-row coordinates, silently off by one. That is how an
earlier build lost a whole sign-off group. Separate sections with TITLED rows.
"""
import sys

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

OUT_XLSX = sys.argv[1]

HEAD = Font(bold=True)
TITLE = Font(bold=True, size=13)
WRAP = Alignment(wrap_text=True, vertical='top')
FILL_RULE = PatternFill('solid', fgColor='DEEBF7')       # blue  — Sam authors here
FILL_CONFLICT = PatternFill('solid', fgColor='FF9999')   # red   — outside a Bible range
FILL_AMBIG = PatternFill('solid', fgColor='FFF2CC')      # amber — two Bible lines disagree
FILL_NONE = PatternFill('solid', fgColor='F2F2F2')       # grey  — nothing states it
FILL_OK = PatternFill('solid', fgColor='E2EFDA')         # green — inside a Bible range

wb = Workbook()


def write_header(ws, row, columns):
    for column, text in enumerate(columns, start=1):
        cell = ws.cell(row=row, column=column, value=text)
        cell.font = HEAD
        cell.alignment = WRAP


def widths(ws, spec):
    for i, w in enumerate(spec, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w


# ═══════════════════════════════ source data ═══════════════════════════════
# Current shipped values, read from rules/weeklyExposureContractBuilders.ts.
# mode -> (phase, strength, conditioning, sprintCod, fullRest, hard)
# each domain triple is (required, preferredMin, preferredMax)
MODES = [
    ('in_season_game_week',    'In-season',  ('2', '2', '3'), ('max(3,anchors)',) * 3, ('1', '1', '1'), ('1', '1', '2'), ('4', '5')),
    ('in_season_bye_build',    'In-season',  ('2', '3', '4'), ('3', '3', '3'),         ('1', '1', '1'), ('1', '1', '2'), ('4', '5')),
    ('in_season_bye_recovery', 'In-season',  ('2', '2', '2'), ('0', '0', 'teams'),     ('1', '1', '1'), ('2', '2', '3'), ('2', '4')),
    ('early_offseason',        'Off-season', ('0', '2', '3'), ('0', '1', '2'),         ('0', '0', '0'), ('2', '2', '3'), ('2', '4')),
    ('mid_offseason',          'Off-season', ('3', '3', '4'), ('3', '3', '4'),         ('1', '1', '1'), ('2', '2', '2'), ('4', '5')),
    ('late_offseason',         'Off-season', ('3', '3', '4'), ('3', '3', '4'),         ('1', '1', '2'), ('1', '1', '2'), ('4', '5')),
    ('early_preseason',        'Pre-season', ('3', '4', '4'), ('3', '4', '4'),         ('1', '1', '1'), ('2', '2', '2'), ('4', '5')),
    ('mid_preseason',          'Pre-season', ('3', '4', '4'), ('3', '4', '4'),         ('1', '1', '1'), ('2', '2', '2'), ('4', '5')),
    ('late_preseason',         'Pre-season', ('3', '4', '4'), ('3', '4', '4'),         ('1', '1', '1'), ('2', '2', '2'), ('4', '5')),
]

SLOTS = ['required', 'preferredMin', 'preferredMax']

BIBLE = {
    ('strength', 'In-season'):  ('S3', 'you can have 2-4 strength days (depending on preference and availability)'),
    ('strength', 'Pre-season'): ('S3', '2-4 strength - again double ups are good'),
    ('strength', 'Off-season'): ('S3', 'up to 4 strengths pluys recovery mobility gunshow if wanted'),
    ('conditioning', 'In-season'):  ('S2/S3', 'How many conditioning exposures per week: 3-5 depending on phase of year'),
    ('conditioning', 'Pre-season'): ('S3', '1-3 extra conditioning depending on team training'),
    ('conditioning', 'Off-season'): ('S3', '3-5 conditioning'),
    ('sprintCod', '*'):  ('S2', 'the year-round required minimum is 1 genuine sprint/high-speed exposure per week except early off-season'),
    ('fullRest', '*'):   ('S2', "I'd almost prefer it so give them 1-2 days fully off each week"),
    ('hardDays', '*'):   ('S2', 'How many hard days per week max: 4'),
}


def bible_for(domain, phase):
    return BIBLE.get((domain, phase)) or BIBLE.get((domain, '*')) or ('', '')


def classify(mode, domain, slot, value):
    """Flag + note. Deliberately conservative: only claims a conflict where the
    Bible states a number the value plainly sits outside."""
    if not value.isdigit():
        return 'derived_not_literal', FILL_NONE, (
            'Value is an expression, not a literal — it varies with the athlete\'s anchors. '
            'Ruling it means ruling the EXPRESSION, or replacing it with a fixed number.')

    n = int(value)

    if domain == 'hardDays':
        if slot == 'permitted' and n > 4:
            return 'bible_conflict', FILL_CONFLICT, (
                'Bible S2 states a hard-DAY max of 4. This permits 5. Also the unit question: '
                'the Bible counts DAYS ("6 sessions ... spread over 3-4 days"), the engine '
                'spends this on SESSIONS. Batch 3 owns the unit; this cell owns the number.')
        return 'bible_range', FILL_OK, 'Bible S2 states a hard-day max of 4.'

    if domain == 'sprintCod':
        if n == 0 and mode != 'early_offseason':
            return 'bible_conflict', FILL_CONFLICT, (
                'Bible S2 sets a year-round floor of 1 and exempts EARLY OFF-SEASON only.')
        if n == 0:
            return 'bible_range', FILL_OK, 'Bible S2 exempts early off-season from the floor of 1.'
        return 'bible_range', FILL_OK, 'Bible S2 floor is 1; 2-3 is the usual maximum.'

    if domain == 'fullRest':
        if n > 2:
            return 'bible_conflict', FILL_CONFLICT, (
                'Bible S2 says 1-2 days fully off each week. This allows 3.')
        return 'bible_range', FILL_OK, 'Bible S2: 1-2 days fully off each week.'

    if domain == 'conditioning':
        if mode == 'early_offseason':
            return 'bible_range', FILL_OK, (
                'Bible S1: off-season weeks 1-2 are the OPTIONAL block, nothing compulsory.')
        if mode == 'in_season_bye_recovery' and n == 0:
            return 'bible_range', FILL_OK, (
                'Bible S2 allows a bye to be "a really good time to rest and recover".')
        return 'bible_ambiguous', FILL_AMBIG, (
            'Two Bible lines give different BASES: S2 says 3-5 conditioning exposures TOTAL '
            '(team training and games included), S3 says 1-3 EXTRA conditioning. Which base '
            'this cell counts in is unruled, so neither line can confirm or refute it.')

    if domain == 'strength':
        if mode == 'early_offseason' and n == 0:
            return 'bible_range', FILL_OK, (
                'Bible S1: weeks 1-2 optional, "zero completed sessions is a valid honest week".')
        if n > 4:
            return 'bible_conflict', FILL_CONFLICT, 'Bible caps strength days at 4 in every phase.'
        return 'bible_range', FILL_OK, 'Within the Bible\'s 2-4 strength days for this phase.'

    return 'no_bible', FILL_NONE, 'Nothing in the Bible states this.'


# ═══════════════════════ Tab 1 — How to use this sheet ═══════════════════════
ws = wb.active
ws.title = 'How to use'
widths(ws, [110])
lines = [
    ('WEEKLY EXPOSURE CONTRACT — REVIEW SHEET (Batch 2)', TITLE),
    ('Prefilled with CURRENT shipped values. Nothing here is ruled yet.', None),
    ('Generated by scripts/build-exposure-contract-sheet.py — regenerate, never hand-edit.', None),
    ('WHY THIS SHEET EXISTS', HEAD),
    ('Sam ruled (2026-07-28) that the week-mode exposure contract is the SINGLE OWNER of', None),
    ('"how many sessions this week". coachingEngine\'s counts, budget arithmetic and three', None),
    ('override floors become derivations or deletions. That makes these numbers the only', None),
    ('weekly structure authority in the app — so they have to be authored, not inherited.', None),
    ('THE RULING THAT SHAPES THE SHEET', HEAD),
    ('"Structure comes from phase + schedule facts; capacity/readiness affects DOSE only."', None),
    ('So there is NO readiness axis and NO injury axis in this workbook. Injury reaches the', None),
    ('week through its own law family; readiness changes the dose, never the count.', None),
    ('THE TABS', HEAD),
    ('  2. Contract V2 first cells  - 3 cells. AUTHOR THESE FIRST (ruling 1).', None),
    ('  3. Base numbers             - 126 cells. 9 modes x 14 slots.', None),
    ('  4. Schedule columns         - 63 cells. 9 modes x 7 schedule-conditioned behaviours.', None),
    ('  5. Open questions           - 4 questions that change what the cells mean.', None),
    ('  Base + schedule = 189 authored cells. The 3 on tab 2 come first and are extra.', None),
    ('HOW TO READ A ROW', HEAD),
    ('  CURRENT VALUE  what ships today. Not evidence that anyone chose it.', None),
    ('  FLAG           bible_range = inside a stated range. bible_conflict = outside one.', None),
    ('                 bible_ambiguous = two Bible lines disagree on the base being counted.', None),
    ('                 no_bible = nothing states it. derived_not_literal = an expression.', None),
    ('  BIBLE          the section and the sentence fragment, so a claim can be checked.', None),
    ('  RULED VALUE    blank. Sam fills this, or confirms the current value explicitly.', None),
    ('A BLANK RULED VALUE IS NOT APPROVAL', HEAD),
    ('This is the defect the whole provenance unit keeps finding: an empty list read as a', None),
    ('completed review. Confirming a current value is a RULING and must be said out loud.', None),
    ('WHAT THIS SHEET DOES NOT AUTHOR', HEAD),
    ('phaseWeek and the week-counting mechanism. Sam ruled subphase derives from two anchor', None),
    ('dates per season, never a fixed week count, so the INPUT that selects a mode is due to', None),
    ('change. This sheet authors the VALUES a mode carries, not how the mode is selected.', None),
]
for row, (text, font) in enumerate(lines, start=1):
    cell = ws.cell(row=row, column=1, value=text)
    if font:
        cell.font = font
    cell.alignment = WRAP

# ═══════════════════ Tab 2 — Contract V2 first cells (ruling 1) ═══════════════════
ws = wb.create_sheet('Contract V2 first cells')
widths(ws, [30, 46, 26, 18, 18, 60])
rows = [
    ('AUTHOR THESE FIRST — Sam ruling 1, 2026-07-28', '', '', '', '', ''),
    ('The designated OWNER carries its own readiness axis. Until these three go, the '
     'Batch 0 deletion would MOVE the axis into the owner rather than remove it.', '', '', '', '', ''),
    ('SYMBOL', 'WHAT IT DECIDES', 'CURRENT (readiness-conditioned)', 'IF HIGH', 'IF NOT HIGH', 'WHAT THE RULING REQUIRES'),
    ('strongByeBuild',
     'Forces 4 main strength in an in-season bye BUILD week.',
     "mode == bye_build && readiness == 'high' && teamTrainingCount <= 1 && availableDayCount >= 4",
     '4', 'policy default',
     'The team-day and available-day conjuncts are SCHEDULE facts and survive as columns. '
     'The readiness conjunct dies. One number for "bye build, <=1 team day, >=4 available days".'),
    ('unconstrainedStrength (early off-season)',
     'Early off-season main strength target.',
     "min(policy.strength.max, availableDayCount, readiness == 'high' ? 3 : 2)",
     '3', '2',
     'One plain number. The availableDayCount clamp is a schedule fact and stays.'),
    ('optional (early off-season)',
     'Early off-season optional session count.',
     "min(readiness == 'high' && teamTrainingCount < 3 ? 2 : 1, max(0, availableDayCount - mainStrength))",
     '2', '1',
     'The teamTrainingCount conjunct is a schedule fact and may stay as a column. '
     'The readiness conjunct dies.'),
    ('RULED VALUE — Sam fills below', '', '', '', '', ''),
    ('strongByeBuild strength target', '', '', '', '', ''),
    ('early off-season strength target', '', '', '', '', ''),
    ('early off-season optional target', '', '', '', '', ''),
]
for r, values in enumerate(rows, start=1):
    for c, v in enumerate(values, start=1):
        cell = ws.cell(row=r, column=c, value=v)
        cell.alignment = WRAP
        if r in (1, 3, 7):
            cell.font = HEAD
        if r in (8, 9, 10) and c == 2:
            cell.fill = FILL_RULE

# ═══════════════════════ Tab 3 — Base numbers (126 cells) ═══════════════════════
ws = wb.create_sheet('Base numbers')
widths(ws, [24, 13, 15, 15, 15, 20, 12, 62, 16, 70])
write_header(ws, 1, ['MODE', 'PHASE', 'DOMAIN', 'SLOT', 'CURRENT VALUE',
                     'FLAG', 'BIBLE §', 'BIBLE SAYS', 'RULED VALUE', 'NOTE'])
r = 2
base_cells = 0
for mode, phase, s, c, sp, fr, hard in MODES:
    for domain, triple in (('strength', s), ('conditioning', c), ('sprintCod', sp), ('fullRest', fr)):
        for slot, value in zip(SLOTS, triple):
            flag, fill, note = classify(mode, domain, slot, value)
            sec, says = bible_for(domain, phase)
            for col, v in enumerate([mode, phase, domain, slot, value, flag, sec, says, '', note], start=1):
                cell = ws.cell(row=r, column=col, value=v)
                cell.alignment = WRAP
                if col == 6:
                    cell.fill = fill
                if col == 9:
                    cell.fill = FILL_RULE
            r += 1
            base_cells += 1
    for slot, value in (('preferred', hard[0]), ('permitted', hard[1])):
        flag, fill, note = classify(mode, 'hardDays', slot, value)
        sec, says = bible_for('hardDays', phase)
        for col, v in enumerate([mode, phase, 'hardDays', slot, value, flag, sec, says, '', note], start=1):
            cell = ws.cell(row=r, column=col, value=v)
            cell.alignment = WRAP
            if col == 6:
                cell.fill = fill
            if col == 9:
                cell.fill = FILL_RULE
        r += 1
        base_cells += 1

# ══════════════════════ Tab 4 — Schedule columns (63 cells) ══════════════════════
ws = wb.create_sheet('Schedule columns')
widths(ws, [24, 13, 40, 22, 16, 16, 70])
SCHEDULE_COLUMNS = [
    ('strengthTargetWithTwoOrMoreTeamDays',
     'Strength target when the athlete has >= 2 team-training days.',
     'Gym work layered onto an already-hard team day is not a new hard day. This is the '
     'behaviour all three deleted engine floors encoded.'),
    ('minimumAvailableDaysForPreferredTarget',
     'Available days needed before the preferred (not required) target applies.',
     'All three engine floors used >= 5. Nothing states why 5.'),
    ('strengthTargetBelowThatAvailability',
     'Strength target when the athlete has fewer days than the line above.',
     'Today this is an implicit fall-through, never stated anywhere.'),
    ('targetAtOrBelowThreeAvailableDays',
     'Target when the athlete has <= 3 available days.',
     'Only early off-season has this today (2 vs 3). Every other mode is silent — which is '
     'absence rendered as approval, not a decision that low availability changes nothing.'),
    ('moderateStrengthAllowance',
     'Extra CORE strength permitted that does not consume hard-day budget.',
     'The G-2 upper session is core but low-fatigue. Engine adds +1 in-season only.'),
    ('optionalSessionCap',
     'Optional sessions permitted on days beyond the core target.',
     'Engine caps this by READINESS today (low 1 / medium 2 / high 2), which the ruling '
     'forbids. Needs a schedule-conditioned value instead.'),
    ('recoverySessionCap',
     'Recovery sessions permitted on remaining days.',
     'Engine derives this as availableDays - core - optional. Never authored.'),
]
CURRENT = {
    ('in_season_game_week', 'strengthTargetWithTwoOrMoreTeamDays'): '3 (engine floor)',
    ('early_preseason', 'strengthTargetWithTwoOrMoreTeamDays'): '4 no-game / 3 game (engine floors)',
    ('mid_preseason', 'strengthTargetWithTwoOrMoreTeamDays'): '4 no-game / 3 game (engine floors)',
    ('late_preseason', 'strengthTargetWithTwoOrMoreTeamDays'): '4 no-game / 3 game (engine floors)',
    ('early_offseason', 'targetAtOrBelowThreeAvailableDays'): '2 (else 3)',
    ('in_season_game_week', 'moderateStrengthAllowance'): '+1',
    ('in_season_bye_build', 'moderateStrengthAllowance'): '+1',
    ('in_season_bye_recovery', 'moderateStrengthAllowance'): '+1',
}
write_header(ws, 1, ['MODE', 'PHASE', 'SCHEDULE COLUMN', 'CURRENT BEHAVIOUR',
                     'FLAG', 'RULED VALUE', 'WHY THIS COLUMN EXISTS'])
r = 2
schedule_cells = 0
for mode, phase, *_ in MODES:
    for name, _what, why in SCHEDULE_COLUMNS:
        current = CURRENT.get((mode, name))
        if name == 'minimumAvailableDaysForPreferredTarget':
            current = current or '5 (engine floors, in-season + pre-season only)'
        if name == 'optionalSessionCap':
            current = current or 'readiness-conditioned (1/2/2) — FORBIDDEN by the ruling'
        if name == 'recoverySessionCap':
            current = current or 'availableDays - core - optional (derived, unauthored)'
        if current is None:
            current = 'none — this mode has no behaviour here today'
            flag, fill = 'silent_today', FILL_NONE
        elif 'FORBIDDEN' in current:
            flag, fill = 'ruling_violation', FILL_CONFLICT
        else:
            flag, fill = 'engine_behaviour_to_migrate', FILL_AMBIG
        for col, v in enumerate([mode, phase, name, current, flag, '', why], start=1):
            cell = ws.cell(row=r, column=col, value=v)
            cell.alignment = WRAP
            if col == 5:
                cell.fill = fill
            if col == 6:
                cell.fill = FILL_RULE
        r += 1
        schedule_cells += 1

# ═══════════════════════ Tab 5 — Open questions ═══════════════════════
ws = wb.create_sheet('Open questions')
widths(ws, [8, 46, 100])
qs = [
    ('#', 'QUESTION', 'WHY IT CHANGES WHAT THE CELLS MEAN'),
    ('Q1', 'The three pre-season rows are numerically IDENTICAL. '
           'Is that right?',
     'early_preseason, mid_preseason and late_preseason declare the same 14 numbers: '
     'strength 3/4/4, conditioning 3/4/4, sprint 1/1/1, rest 2/2/2, hard 4/5. Either the '
     'subphase distinction does no programming work here — in which case there is one '
     'pre-season row, not three — or the numbers are wrong. Ruling 42 identical cells one '
     'at a time is the most expensive way to discover which.'),
    ('Q2', 'Does the conditioning target count TOTAL exposures or EXTRA app exposures?',
     'Bible S2 says 3-5 conditioning exposures per week and names team training and games as '
     'part of that. Bible S3 says 1-3 EXTRA conditioning. Every conditioning cell in this '
     'sheet is flagged bible_ambiguous because neither line can confirm or refute a number '
     'until the base is fixed. One answer settles 27 cells.'),
    ('Q3', 'permittedHardDays is 5 in six of the nine modes. Bible S2 says the max is 4.',
     'Two separate issues in one cell. (a) 5 exceeds the stated 4. (b) The Bible counts hard '
     'DAYS — "6 sessions, even though that may be spread over 3-4 days" — while the engine '
     'spends this budget on SESSIONS. Batch 3 owns the unit question; this sheet owns the '
     'number, and the number cannot be sensibly ruled without knowing which it counts.'),
    ('Q4', 'Should the schedule columns be per-mode, or one shared table?',
     'This sheet assumes PER-MODE, because the two-team-day floor already resolves '
     'differently by phase (pre-season targets 4, in-season 3) and a shared table would need '
     'a phase axis — which is per-mode under another name. If Sam prefers a shared table the '
     'schedule tab collapses from 63 cells to 7 and this sheet should be regenerated.'),
    ('NOTE', 'phaseWeek is deliberately NOT in this sheet.',
     'Sam ruled subphase derives from two anchor dates per season, never a fixed week count, '
     'so the mechanism that SELECTS a mode is unsettled and owned by the onboarding unit. '
     'This sheet authors the values a mode carries. Nothing here depends on how many weeks '
     'into a phase the athlete is.'),
]
for r, values in enumerate(qs, start=1):
    for c, v in enumerate(values, start=1):
        cell = ws.cell(row=r, column=c, value=v)
        cell.alignment = WRAP
        if r == 1:
            cell.font = HEAD

wb.save(OUT_XLSX)
print(f'wrote {OUT_XLSX}')
print(f'  base cells     : {base_cells}')
print(f'  schedule cells : {schedule_cells}')
print(f'  authored total : {base_cells + schedule_cells}')
print(f'  contract V2    : 3 (author first)')
