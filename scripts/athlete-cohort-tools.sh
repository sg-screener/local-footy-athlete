#!/bin/zsh
# Per-preset PDFs + page QA for a cohort directory: cohort-tools.sh <worktree> <cohort-dir>
set -u
W=$1; A=$2; REV=$(cat $A/REVISION); T0=/Users/samgeurts/Documents/local-footy-athlete/output/final-full-year-audit-71ff5788/tools
VENV=/private/tmp/claude-501/-Users-samgeurts-Documents-local-footy-athlete/f96599e1-7090-4a38-94d1-8bc7b3699a08/scratchpad/venv
for p in $(ls $A); do
  [ -f "$A/$p/run/year-programs.json" ] || continue
  D=$A/$p; mkdir -p $D/tools; cp $T0/build_final_pdfs.py $T0/qa_pages.py $T0/build-full-evidence.cjs $D/tools/
  # Evidence builder: one athlete, N weeks, one level deeper than the pair layout
  python3 - "$D/tools/build-full-evidence.cjs" <<'PY'
import sys
p=sys.argv[1]; s=open(p).read()
def rep(a,b):
    global s
    assert s.count(a)==1, a[:60]
    s=s.replace(a,b)
rep("const repo = path.resolve(__dirname, '../../..');", "const repo = path.resolve(__dirname, '../../../..');")
rep("const femaleDays = new Map(female.weeks.flatMap(", "const femaleDays = new Map((female && male && female !== male ? female : { weeks: [] }).weeks.flatMap(")
rep("for (const week of male.weeks) for (const day of week.days) {\n  const counterpart = femaleDays.get(day.date);", "for (const week of (male && female && male !== female ? male : { weeks: [] }).weeks) for (const day of week.days) {\n  const counterpart = femaleDays.get(day.date);")
rep("coldSaveRestartReconstruction: athlete.restarts.length === 52 && athlete.restarts.every(row => row.ok === true),", "coldSaveRestartReconstruction: athlete.restarts.length === athlete.weeks.length && athlete.restarts.every(row => row.ok === true),")
rep("    weeksRequired: 52,", "    weeksRequired: athlete.weeks.length,")
open(p,'w').write(s)
PY
  (cd $W && node scripts/programming-final-year-acceptance.cjs $D/run > $D/acceptance.log 2>&1; echo "acceptance exit $?" >> $D/acceptance.log; node $D/tools/build-full-evidence.cjs > $D/build-evidence.log 2>&1; echo "evidence exit $?" >> $D/build-evidence.log)
  sed -i '' "s#^ROOT = Path('.*')#ROOT = Path('$W')#; s#^WORK = ROOT / '.*'#WORK = Path('$D')#; s#^REVISION = '.*'#REVISION = '$REV'#" $D/tools/build_final_pdfs.py
  # QA: iterate the PDFs present and size the week/date expectations from the run itself
  python3 - "$D/tools/qa_pages.py" <<'PY'
import sys,re
p=sys.argv[1]; s=open(p).read()
s=s.replace("for gender in ('male', 'female'):\n    pdf = PDF_DIR / f'LFA_FINAL_FULL_YEAR_{gender.upper()}_{REVISION[:8]}.pdf'",
 "import json\nYEAR = json.loads((WORK / 'run' / 'year-programs.json').read_text())\nWEEKS = len(YEAR['athletes'][0]['weeks'])\nfor pdf in sorted(PDF_DIR.glob('LFA_FINAL_FULL_YEAR_*.pdf')):\n    gender = pdf.stem.split('_')[4].lower()")
s=s.replace("'all52WeeksPresentOnce': all(week in week_pages for week in range(1, 53)) and len(re.findall(r'Week \\d+:', joined)) == 52,",
 "'allWeeksPresentOnce': all(week in week_pages for week in range(1, WEEKS + 1)) and len(re.findall(r'Week \\d+:', joined)) == WEEKS,")
s=s.replace("'all364DateHeadings': len(dates) == 364,", "'allDateHeadings': len(dates) == WEEKS * 7,")
open(p,'w').write(s)
PY
  python3 - "$D/tools/build_final_pdfs.py" <<'PY'
import sys
p=sys.argv[1]; s=open(p).read()
s=s.replace("DATA_PATH = WORK / 'run/year-programs.json'", "DATA_PATH = WORK / 'run/year-programs.json'\nimport json as _json\nWEEKS = len(_json.loads(DATA_PATH.read_text())['athletes'][0]['weeks'])")
s=s.replace("'52-week program'", "f'{WEEKS}-week program'")
s=s.replace("f'52 lived weeks |", "f'{WEEKS} lived weeks |")
s=s.replace("subject=f'52-week lived programme", "subject=f'{WEEKS}-week lived programme")
s=s.replace("'both_52_weeks': all(result['week_heading_count'] == 52 for result in results),", "'both_52_weeks': all(result['week_heading_count'] == WEEKS for result in results),")
s=s.replace("    if len(data['athletes']) != 2:\n        raise RuntimeError('Expected two athletes')", "    if len(data['athletes']) < 1:\n        raise RuntimeError('Expected at least one athlete')")
open(p,'w').write(s)
PY
  (cd $W && $VENV/bin/python $D/tools/build_final_pdfs.py > $D/pdf-build.log 2>&1; echo "pdf exit $?" >> $D/pdf-build.log; $VENV/bin/python $D/tools/qa_pages.py $D $REV > $D/qa-pages.log 2>&1; echo "qa exit $?" >> $D/qa-pages.log)
  echo "$p :: $(tail -1 $D/build-evidence.log) :: $(tail -1 $D/pdf-build.log) :: $(tail -1 $D/qa-pages.log) :: $(ls $D/pdf/*.pdf 2>/dev/null | xargs -n1 basename | tr '\n' ' ')"
done
