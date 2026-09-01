#!/usr/bin/env python3
"""Render untouched annual-driver JSON into two readable 52-week audit PDFs."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from datetime import datetime, timedelta
from pathlib import Path
from xml.sax.saxutils import escape

from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import LongTable, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

NAVY = colors.HexColor('#16283D')
TEAL = colors.HexColor('#2A7D78')
INK = colors.HexColor('#17212B')
MUTED = colors.HexColor('#596775')
GRID = colors.HexColor('#CBD5DF')
PALE = colors.HexColor('#E8F4F2')


def text(value) -> str:
    if value is None:
        return ''
    return str(value).replace('\u2013', '-').replace('\u2014', '-').replace('\u00a0', ' ')


def para(value, style):
    return Paragraph(escape(text(value)).replace('\n', '<br/>'), style)


def pretty_date(value: str) -> str:
    return datetime.strptime(value[:10], '%Y-%m-%d').strftime('%a %d %b %Y')


def find_font(name: str) -> Path:
    candidates = [
        Path('/System/Library/Fonts/Supplemental') / name,
        Path('/usr/share/fonts/truetype/dejavu') / name,
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    raise FileNotFoundError(f'Cannot find {name}')


pdfmetrics.registerFont(TTFont('AuditSans', str(find_font('Arial.ttf') if Path('/System/Library/Fonts/Supplemental/Arial.ttf').exists() else find_font('DejaVuSans.ttf'))))
pdfmetrics.registerFont(TTFont('AuditSans-Bold', str(find_font('Arial Bold.ttf') if Path('/System/Library/Fonts/Supplemental/Arial Bold.ttf').exists() else find_font('DejaVuSans-Bold.ttf'))))

STYLES = getSampleStyleSheet()
STYLES.add(ParagraphStyle(name='AuditTitle', fontName='AuditSans-Bold', fontSize=23, leading=27, textColor=NAVY, spaceAfter=5 * mm))
STYLES.add(ParagraphStyle(name='AuditSubtitle', fontName='AuditSans', fontSize=9, leading=12, textColor=MUTED, spaceAfter=3 * mm))
STYLES.add(ParagraphStyle(name='WeekTitle', fontName='AuditSans-Bold', fontSize=15, leading=18, textColor=NAVY, spaceAfter=2 * mm))
STYLES.add(ParagraphStyle(name='DayTitle', fontName='AuditSans-Bold', fontSize=7.4, leading=9, textColor=INK))
STYLES.add(ParagraphStyle(name='Tiny', fontName='AuditSans', fontSize=5.4, leading=6.8, textColor=INK))
STYLES.add(ParagraphStyle(name='TinyBold', fontName='AuditSans-Bold', fontSize=5.4, leading=6.8, textColor=INK))
STYLES.add(ParagraphStyle(name='Body', fontName='AuditSans', fontSize=8, leading=10.5, textColor=INK))


def flatten_rows(day):
    rows = [dict(row) for row in day.get('rows') or []]
    seen = {(text(row.get('name')), text(row.get('dose')), text(row.get('notes'))) for row in rows}
    for row in day.get('speedRows') or []:
        key = (text(row.get('name')), text(row.get('dose')), text(row.get('notes')))
        if key not in seen:
            rows.append({**row, 'role': row.get('role') or 'speed'})
            seen.add(key)
    return rows


def row_cells(row):
    role = text(row.get('role') or 'exercise').replace('_', ' ').title()
    if row.get('optional'):
        role += ' (Optional)'
    load = text(row.get('load'))
    if not load and row.get('kg') is not None:
        load = f'{row["kg"]}kg'
    if row.get('rest'):
        load = ' | '.join(part for part in [load, f'Rest {text(row["rest"])}'] if part)
    muscles = ', '.join(text(muscle) for muscle in row.get('mainMuscles') or []) or '-'
    notes = ' | '.join(part for part in [text(row.get('modalityLabel')), text(row.get('notes'))] if part) or '-'
    return [role, row.get('name') or '(missing name)', muscles, row.get('dose') or '-', load or '-', notes]


def session_table(day):
    header = ['Role', 'Exercise / work', 'Main muscles', 'Prescription', 'Load / rest', 'Modality / instructions']
    rows = [[para(label, STYLES['TinyBold']) for label in header]]
    for warmup in day.get('warmup') or []:
        rows.append([para(value, STYLES['Tiny']) for value in row_cells({**warmup, 'role': 'warm-up'})])
    for row in flatten_rows(day):
        rows.append([para(value, STYLES['Tiny']) for value in row_cells(row)])
    table = LongTable(rows, colWidths=[17 * mm, 33 * mm, 27 * mm, 25 * mm, 27 * mm, 56 * mm], repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY), ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('BOX', (0, 0), (-1, -1), 0.4, GRID),
        ('INNERGRID', (0, 0), (-1, -1), 0.2, GRID),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFB')]),
        ('LEFTPADDING', (0, 0), (-1, -1), 2.5), ('RIGHTPADDING', (0, 0), (-1, -1), 2.5),
        ('TOPPADDING', (0, 0), (-1, -1), 2.2), ('BOTTOMPADDING', (0, 0), (-1, -1), 2.2),
    ]))
    return table


def page_header(canvas, doc, revision):
    canvas.saveState()
    width, height = A4
    canvas.setStrokeColor(GRID)
    canvas.line(doc.leftMargin, 14 * mm, width - doc.rightMargin, 14 * mm)
    canvas.setFont('AuditSans', 6.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(doc.leftMargin, 9 * mm, f'LFA canonical 52-week audit | {revision[:12]}')
    canvas.drawRightString(width - doc.rightMargin, 9 * mm, f'Page {doc.page}')
    if doc.page > 1:
        canvas.drawString(doc.leftMargin, height - 10 * mm, 'Full-year program - generated sessions, not manually repaired')
    canvas.restoreState()


def build_pdf(data, athlete, output_dir: Path):
    gender = athlete['gender']
    revision = data['revision']
    output = output_dir / f'LFA_FULL_YEAR_{gender.upper()}_{revision[:8]}.pdf'
    doc = SimpleDocTemplate(str(output), pagesize=A4, leftMargin=12 * mm, rightMargin=12 * mm, topMargin=16 * mm, bottomMargin=18 * mm,
                            title=f'LFA Full-Year Program - {gender.title()}', author='Local Footy Athlete')
    story = [para(f'52-week {gender.title()} full-year program', STYLES['AuditTitle']),
             para(f'Canonical compiler output at commit {revision}. Every programmed row is printed with its primary signed Main muscles metadata. This reporting column is not an athlete-app field.', STYLES['AuditSubtitle'])]
    profile = athlete.get('profile') or {}
    schedule = data.get('assumptions') or {}
    summary = [
        ['Period', f'{data.get("start")} to {data.get("end")}'],
        ['Athlete', f'{gender.title()} | {profile.get("experienceLevel", "advanced") or "advanced"} | full equipment'],
        ['Team training', text(schedule.get('teamTrainingSchedule') or 'Pre-season Monday/Wednesday; In-season Tuesday/Thursday')],
        ['Source', 'Annual driver JSON; no PDF/session hand edits'],
    ]
    info = Table([[para(k, STYLES['TinyBold']), para(v, STYLES['Body'])] for k, v in summary], colWidths=[38 * mm, 147 * mm])
    info.setStyle(TableStyle([('BOX', (0, 0), (-1, -1), 0.4, GRID), ('INNERGRID', (0, 0), (-1, -1), 0.2, GRID),
                              ('BACKGROUND', (0, 0), (0, -1), PALE), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                              ('LEFTPADDING', (0, 0), (-1, -1), 4), ('RIGHTPADDING', (0, 0), (-1, -1), 4),
                              ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4)]))
    story += [info, PageBreak()]
    for week_index, week in enumerate(athlete['weeks']):
        end = (datetime.strptime(week['start'], '%Y-%m-%d') + timedelta(days=6)).strftime('%Y-%m-%d')
        story.append(para(f'Week {week["number"]}: {week["phase"]} week {week["phaseWeek"]}', STYLES['WeekTitle']))
        story.append(para(f'{week["start"]} to {end}', STYLES['AuditSubtitle']))
        for day in week['days']:
            name = day.get('name') or 'REST'
            descriptor = ' | '.join(part for part in [pretty_date(day['date']), name, text(day.get('type'))] if part)
            head = Table([[para(descriptor, STYLES['DayTitle'])]], colWidths=[185 * mm])
            head.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), PALE if day.get('name') else colors.HexColor('#F1F3F5')),
                                      ('BOX', (0, 0), (-1, -1), 0.5, TEAL if day.get('name') else GRID),
                                      ('LEFTPADDING', (0, 0), (-1, -1), 4), ('RIGHTPADDING', (0, 0), (-1, -1), 4),
                                      ('TOPPADDING', (0, 0), (-1, -1), 3), ('BOTTOMPADDING', (0, 0), (-1, -1), 3)]))
            story += [Spacer(1, 1.2 * mm), head]
            if day.get('name'):
                story.append(session_table(day))
            else:
                story.append(para('Rest day - no programmed session.', STYLES['Tiny']))
        if week_index < len(athlete['weeks']) - 1:
            story.append(PageBreak())
    doc.build(story, onFirstPage=lambda c, d: page_header(c, d, revision), onLaterPages=lambda c, d: page_header(c, d, revision))
    reader = PdfReader(str(output))
    extracted = '\n'.join(page.extract_text() or '' for page in reader.pages)
    result = {
        'gender': gender, 'path': str(output), 'pages': len(reader.pages), 'bytes': output.stat().st_size,
        'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
        'weekHeadingCount': len(re.findall(r'Week \d+:', extracted)),
        'mainMusclesHeaderCount': extracted.count('Main muscles'),
    }
    if result['weekHeadingCount'] != 52 or result['mainMusclesHeaderCount'] < 52:
        raise RuntimeError(f'PDF verification failed: {result}')
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--data', required=True, type=Path)
    parser.add_argument('--output-dir', required=True, type=Path)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    data = json.loads(args.data.read_text())
    if len(data.get('athletes') or []) != 2:
        raise RuntimeError('Expected exactly two annual athletes')
    results = [build_pdf(data, athlete, args.output_dir) for athlete in data['athletes']]
    receipt = {'source': str(args.data), 'revision': data['revision'], 'results': results,
               'notCovered': ['Physical iPhone rendering', 'Clinical or coaching-quality sign-off', 'Profiles other than the two annual audit athletes']}
    (args.output_dir / 'pdf-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps(receipt, indent=2))


if __name__ == '__main__':
    main()
