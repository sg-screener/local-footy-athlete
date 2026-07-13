/**
 * coachNoteDisplayTests — proves the V2 coach-note UI uses useful
 * one-line restriction copy instead of the old generic system flag.
 *
 * Run: npm run test:coach-note-display
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import * as fs from 'fs';
import * as path from 'path';
import { getCoachNoteDisplay } from '../utils/coachNoteSummary';
import { suppressDuplicateWorkoutContext } from '../screens/home/homeScreenConstants';

let pass = 0;
let fail = 0;
const failures: string[] = [];
function ok(name: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  \u2713 ${name}`); }
  else { fail++; failures.push(name); console.log(`  \u2717 ${name}${detail ? '\n      ' + detail : ''}`); }
}
function eq<T>(name: string, a: T, b: T) {
  ok(name, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function section(label: string) { console.log(`\n${label}`); }

const HOME_V2 = fs.readFileSync(
  path.resolve(__dirname, '..', 'screens', 'home', 'HomeScreenV2.tsx'),
  'utf8',
);
const HOME_CLASSIC = fs.readFileSync(
  path.resolve(__dirname, '..', 'screens', 'home', 'HomeScreen.tsx'),
  'utf8',
);
const TODAY_CARD = fs.readFileSync(
  path.resolve(__dirname, '..', 'screens', 'home', 'TodayWorkoutCard.tsx'),
  'utf8',
);
const WEEK_CARD = fs.readFileSync(
  path.resolve(__dirname, '..', 'screens', 'home', 'WeekViewCard.tsx'),
  'utf8',
);
const READINESS_QUICK_CHECK = fs.readFileSync(
  path.resolve(__dirname, '..', 'components', 'ReadinessQuickCheck.tsx'),
  'utf8',
);
const DAY_V2 = fs.readFileSync(
  path.resolve(__dirname, '..', 'screens', 'home', 'DayWorkoutScreenV2.tsx'),
  'utf8',
);
const USE_HOME_SCREEN = fs.readFileSync(
  path.resolve(__dirname, '..', 'screens', 'home', 'useHomeScreen.ts'),
  'utf8',
);
const USE_DAY_WORKOUT = fs.readFileSync(
  path.resolve(__dirname, '..', 'screens', 'home', 'useDayWorkout.ts'),
  'utf8',
);

section('[1] helper — generic flag produces no summary');
{
  const display = getCoachNoteDisplay(['Coach adjusted']);
  ok('no summaryLine for generic-only notes', !display.summaryLine);
  ok('summary never equals Coach adjusted', display.summaryLine !== 'Coach adjusted');
}

section('[2] helper — useful restriction summary wins');
{
  const display = getCoachNoteDisplay([
    'Removed: Flying 30m Sprints',
    'No sprinting or high-speed running',
    'Focus: Upper body',
  ]);
  eq('summary is concise sprint restriction', display.summaryLine, 'No sprinting / high-speed running');
  ok('summary has no bullet prefix', !/^[•*-]/.test(display.summaryLine ?? ''));
  ok('summary is within row copy limit', (display.summaryLine ?? '').length <= 55);
}

section('[3] helper — one line only when many notes exist');
{
  const display = getCoachNoteDisplay([
    'Removed: Trap Bar Deadlift',
    'Replaced RDL with Goblet Squat',
    'Focus: Easy bike',
    'Focus: Trunk',
    'No heavy hinge work (RDLs, deadlifts, nordics)',
  ]);
  eq('summary picks one high-priority line', display.summaryLine, 'No heavy hinge / hamstring loading');
  ok('summary has no newline', !/\n/.test(display.summaryLine ?? ''));
}

section('[4] helper — audit notes translate without raw audit detail');
{
  const sprint = getCoachNoteDisplay(['Removed: Flying 30m Sprints']);
  eq('removed sprint becomes rule copy', sprint.summaryLine, 'No sprinting / high-speed running');
  ok('summary does not expose Removed audit text', !/^Removed:/i.test(sprint.summaryLine ?? ''));

  const press = getCoachNoteDisplay(['Removed: Bench Press', 'Removed: Overhead Press']);
  eq('pressing audit becomes rule copy', press.summaryLine, 'No pressing / overhead loading');

  const jump = getCoachNoteDisplay(['Removed: Box Jumps']);
  eq('jump audit becomes rule copy', jump.summaryLine, 'No jumping / explosive lower');
}

section('[5] helper — local session change beats global hammy sprint rule');
{
  const display = getCoachNoteDisplay([
    'no sprinting / no high-speed running',
    'Removed: Nordic Lower',
    'Replaced Deadlift with Goblet Squat',
  ], {
    workoutName: 'Lower Body Strength',
    workoutType: 'Strength',
  });
  eq('summary describes local hinge/hamstring change', display.summaryLine, 'No heavy hinge / hamstring loading');
  ok(
    'summary is NOT sprinting for non-running lower session',
    display.summaryLine !== 'No sprinting / high-speed running',
  );
  ok('details include removed Nordic', display.detailLines.some((l) => /Removed: Nordic Lower/i.test(l)));
  ok('details include replaced Deadlift', display.detailLines.some((l) => /Replaced Deadlift/i.test(l)));
  ok('real extra details trigger Show changes', display.shouldShowDetails);
}

section('[6] helper — team training can use sprint restriction');
{
  const display = getCoachNoteDisplay([
    'no sprinting / no high-speed running',
  ], {
    workoutName: 'Team Training',
    workoutType: 'Mixed',
  });
  eq('team training summary keeps sprint restriction', display.summaryLine, 'No sprinting / high-speed running');
  ok('duplicate-only detail is hidden', !display.shouldShowDetails);
  eq('duplicate-only detailLines empty', display.detailLines, []);
}

section('[7] helper — generic fallback only when local changes absent');
{
  const misleading = getCoachNoteDisplay([
    'no sprinting / no high-speed running',
  ], {
    workoutName: 'Lower Body Strength',
    workoutType: 'Strength',
  });
  ok('non-running lower session does not show global sprint rule alone', !misleading.summaryLine);

  const display = getCoachNoteDisplay([
    'Adjusted for active hammy — update coach if symptoms improve.',
  ], {
    workoutName: 'Lower Body Strength',
    workoutType: 'Strength',
  });
  eq('hammy attribution fallback', display.summaryLine, 'Hammy restriction active');
  ok('no details for attribution-only summary', !display.shouldShowDetails);
}

section('[8] HomeScreenV2 - Program rows keep active modifier copy out of week cards');
{
  eq('duplicate title/context is hidden',
    suppressDuplicateWorkoutContext('Easy Aerobic Flush', 'Easy Aerobic Flush'),
    null);
  eq('duplicate +context is hidden',
    suppressDuplicateWorkoutContext('Easy Aerobic Flush', '+ Easy Aerobic Flush'),
    null);
  eq('useful non-duplicate context is kept',
    suppressDuplicateWorkoutContext('Upper Push', '+ Team Training'),
    '+ Team Training');
  ok('HomeScreenV2 suppresses duplicate workout context', /suppressDuplicateWorkoutContext/.test(HOME_V2));
  ok('classic HomeScreen suppresses duplicate workout context', /suppressDuplicateWorkoutContext/.test(HOME_CLASSIC));
  ok('HomeScreenV2 removes the lower phase-shift section label', !/Changing season phase\?/.test(HOME_V2));
  ok('HomeScreenV2 keeps phase mode copy inside the card', /You’re in \{currentPhase\} mode/.test(HOME_V2));
  ok(
    'HomeScreenV2 does not render Today Feel quick check',
    !/ReadinessQuickCheck|readiness-quick-check|Today feel|Today Feel/.test(HOME_V2),
  );
  ok(
    'classic HomeScreen does not render Today Feel quick check',
    !/ReadinessQuickCheck|readiness-quick-check|Today feel|Today Feel/.test(HOME_CLASSIC),
  );
  ok(
    'stale ReadinessQuickCheck component is inert if mounted',
    /return null;/.test(READINESS_QUICK_CHECK)
      && !/Today feel|Today Feel|Short time|readiness-quick-check/.test(READINESS_QUICK_CHECK),
  );
  ok('HomeScreenV2 does not render CoachUpdateCard', !/CoachUpdateCard/.test(HOME_V2));
  ok('classic HomeScreen does not render CoachUpdateCard', !/CoachUpdateCard/.test(HOME_CLASSIC));
  const v2AddGameIdx = HOME_V2.indexOf('No game this week - add one');
  const v2WeekListIdx = HOME_V2.indexOf('Week list — all seven days');
  const v2PhaseShiftIdx = HOME_V2.indexOf('/* ── Phase shift card ── */');
  ok(
    'HomeScreenV2 places add-game CTA below weekly plan and above phase shift',
    v2AddGameIdx > v2WeekListIdx && v2AddGameIdx < v2PhaseShiftIdx,
    `indices add=${v2AddGameIdx} list=${v2WeekListIdx} phase=${v2PhaseShiftIdx}`,
  );
  const classicAddGameIdx = HOME_CLASSIC.indexOf('No game this week - add one');
  const classicDayRowsIdx = HOME_CLASSIC.indexOf('/* ─── Day Rows ─── */');
  const classicQuickActionsIdx = HOME_CLASSIC.indexOf('NEED TO ADJUST YOUR WEEKLY PLAN?');
  ok(
    'classic HomeScreen places add-game CTA below weekly plan',
    classicAddGameIdx > classicDayRowsIdx && classicAddGameIdx < classicQuickActionsIdx,
    `indices add=${classicAddGameIdx} rows=${classicDayRowsIdx} quick=${classicQuickActionsIdx}`,
  );
  ok(
    'Program rows do not render workout coach note summaries',
    !/day-row-coach-summary|rowCoachNoteText|getCoachNoteDisplay\(day\.workout\.coachNotes/.test(HOME_V2),
  );
  ok(
    'classic Program rows do not render workout coach note lists',
    !/coachNoteList|coachNoteText|day\.workout!\.coachNotes\.map/.test(HOME_CLASSIC),
  );
  ok(
    'Program row keeps attached + session lines large but muted',
    /const isAttachedContextLine = contextLabel\?\.startsWith\('\+ '\) \?\? false/.test(HOME_V2)
      && /<View style=\{styles\.selectedContextLine\}>[\s\S]{0,120}<RowIcon kind=\{contextIcon\} size=\{16\}/.test(HOME_V2)
      && /size=\{isAttachedContextLine \? 15 : 14\}/.test(HOME_V2)
      && /styles\.workoutContext,[\s\S]{0,160}isAttachedContextLine && styles\.attachedWorkoutContext[\s\S]{0,160}isAttachedContextLine && emphasized && styles\.attachedWorkoutContextSelected/.test(HOME_V2)
      && /attachedWorkoutContext:\s*{[\s\S]{0,80}color:\s*'#7A7A7A'[\s\S]{0,80}fontSize:\s*14/.test(HOME_V2)
      && /attachedWorkoutContextSelected:\s*{[\s\S]{0,80}color:\s*'#7A7A7A'[\s\S]{0,80}fontSize:\s*17/.test(HOME_V2)
      && !/attachedWorkoutContext:\s*{[\s\S]{0,120}#E8E8E8/.test(HOME_V2)
      && !/attachedWorkoutContext:\s*{[\s\S]{0,120}#C8FF00/.test(HOME_V2),
  );
  ok(
    'Program row has no lime-only workoutContextAccent style',
    !/workoutContextAccent/.test(HOME_V2),
  );
  ok(
    'HomeScreenV2 defines subtle row icon kinds',
    /type RowIconKind =[\s\S]{0,120}\| 'pulse'[\s\S]{0,120}\| 'refresh'[\s\S]{0,220}\| 'mobility'[\s\S]{0,80}\| 'prehab'[\s\S]{0,80}\| 'core'[\s\S]{0,80}\| 'activity'/.test(HOME_V2)
      && /function RowIcon/.test(HOME_V2),
  );
  ok(
    'HomeScreenV2 keeps row icons readable but restrained',
    /function RowIcon\(\{ kind, size = 15, color \}/.test(HOME_V2)
      && /strokeWidth=\{2\.3\}/.test(HOME_V2)
      && /rowIcon:\s*{[\s\S]{0,60}opacity:\s*0\.95/.test(HOME_V2),
  );
  ok(
    'HomeScreenV2 routes all conditioning labels through the original pulse icon owner',
    /weeklyConditioningIconKind/.test(HOME_V2)
      && /const conditioningKind = weeklyConditioningIconKind\(key\)/.test(HOME_V2)
      && /case 'pulse':[\s\S]{0,120}<Path d="M3 12h4l2-5 4 10 2-5h6" \/>/.test(HOME_V2)
      && !new RegExp('w' + 'ind|g' + 'auge').test(HOME_V2),
  );
  ok(
    'HomeScreenV2 no longer selects family-specific conditioning glyphs',
    !/case 'flush out':[\s\S]{0,80}return 'refresh'/.test(HOME_V2)
      && !/case 'sprint work':[\s\S]{0,80}return 'bolt'/.test(HOME_V2)
      && !/case 'hard conditioning':[\s\S]{0,80}return 'flame'/.test(HOME_V2),
  );
  ok(
    'HomeScreenV2 maps team, game, recovery, and strength title icons without data changes',
    /key === 'team training'[\s\S]{0,80}return 'team'/.test(HOME_V2)
      && /key === 'game' \|\| key === 'game day'[\s\S]{0,80}return 'game'/.test(HOME_V2)
      && /workout\?\.workoutType === 'Recovery'[\s\S]{0,160}return 'recovery'/.test(HOME_V2)
      && /return 'strength'/.test(HOME_V2),
  );
  ok(
    'HomeScreenV2 locks Team Training to MaterialCommunityIcons account-multiple-outline',
    /import MaterialCommunityIcons from '@expo\/vector-icons\/MaterialCommunityIcons'/.test(HOME_V2)
      && /if \(kind === 'team'\)[\s\S]{0,220}<MaterialCommunityIcons[\s\S]{0,80}name="account-multiple-outline"[\s\S]{0,80}size=\{16\}[\s\S]{0,120}color=\{iconColor\}/.test(HOME_V2)
      && /style=\{\[styles\.rowIcon, styles\.teamTrainingIcon\]\}/.test(HOME_V2)
      && !/TeamTrainingIconOption|TEAM_TRAINING_ICON_OPTION|teamTrainingIconPaths|function AflTrainingIcon|rotate\(-24 12 12\)|<Path d="M12 3l5 14H7L12 3z"/.test(HOME_V2),
  );
  ok(
    'HomeScreenV2 maps recovery and rest labels to battery recovery icons',
    /key === 'recovery'[\s\S]{0,160}key === 'rest day'[\s\S]{0,160}return 'recovery'/.test(HOME_V2)
      && /case 'recovery':[\s\S]{0,220}<Path d="M4 7h13a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V9a2 2 0 012-2z" \/>/.test(HOME_V2)
      && !/M20 15\.5A8 8 0 018\.5 4/.test(HOME_V2),
  );
  ok(
    'HomeScreenV2 maps mobility, prehab, core, and unknown labels',
    /key\.includes\('mobility'\)[\s\S]{0,180}return 'mobility'/.test(HOME_V2)
      && /key\.includes\('prehab'\)[\s\S]{0,120}key\.includes\('rehab'\)[\s\S]{0,120}return 'prehab'/.test(HOME_V2)
      && /key === 'core' \|\| key\.includes\('core'\)[\s\S]{0,80}return 'core'/.test(HOME_V2)
      && /return 'activity'/.test(HOME_V2),
  );
  ok(
    'HomeScreenV2 maps common Program strength labels to dumbbell',
    /key === 'lower body strength'/.test(HOME_V2)
      && /key === 'upper pull'/.test(HOME_V2)
      && /key === 'upper push'/.test(HOME_V2)
      && /key === 'upper arms pump'/.test(HOME_V2)
      && /key === 'gunshow'/.test(HOME_V2)
      && /return 'strength'/.test(HOME_V2),
  );
  ok(
    'HomeScreenV2 uses a trophy-style Game Day icon',
    /case 'game':[\s\S]{0,180}<Path d="M8 4h8v4a4 4 0 01-8 0V4z" \/>[\s\S]{0,240}<Path d="M9 20h6" \/>/.test(HOME_V2)
      && !/<Path d="M5 21V4" \/>/.test(HOME_V2),
  );
  ok(
    'HomeScreenV2 selected rows use row accent for border, tint, and glow',
    /function selectedDayRowStyle\(accentColor: string\)[\s\S]{0,260}backgroundColor: hexToRgba\(accentColor, 0\.08\)[\s\S]{0,80}borderColor: accentColor[\s\S]{0,80}shadowColor: accentColor/.test(HOME_V2)
      && /emphasized && selectedDayRowStyle\(accentColor\)/.test(HOME_V2)
      && /backgroundColor: accentColor/.test(HOME_V2),
  );
  ok(
    'HomeScreenV2 selected row accent resolves from display type',
    /if \(isGame\) return DAY_ROW_ACCENT\.game/.test(HOME_V2)
      && /titleKey === 'recovery'[\s\S]{0,120}return DAY_ROW_ACCENT\.recovery/.test(HOME_V2)
      && /titleKey === 'hard conditioning'[\s\S]{0,80}return '#D9874E'/.test(HOME_V2)
      && /titleKey === 'sprint work'[\s\S]{0,80}return DAY_ROW_ACCENT\.core/.test(HOME_V2)
      && /if \(!hasWorkout\) return DAY_ROW_ACCENT\.recovery/.test(HOME_V2),
  );
  ok(
    'HomeScreenV2 selected primary titles are near-white, including Rest',
    /workoutTitleSelected:\s*{[\s\S]{0,80}color:\s*'#FFFFFF'/.test(HOME_V2)
      && /restLabelSelected:\s*{[\s\S]{0,80}color:\s*'#F4F4F4'/.test(HOME_V2),
  );
  const selectedHeaderIdx = HOME_V2.indexOf('style={styles.selectedHeader}');
  const selectedMetaRowIdx = HOME_V2.indexOf('style={styles.selectedMetaRow}');
  const selectedBadgeClusterIdx = HOME_V2.indexOf('style={styles.selectedBadgeCluster}');
  const selectedTitleLineIdx = HOME_V2.indexOf('style={styles.selectedTitleLine}');
  const selectedTitleOneLineIdx = HOME_V2.indexOf('numberOfLines={1}', selectedTitleLineIdx);
  ok(
    'HomeScreenV2 selected rows split date badges from the primary title',
    /\{emphasized \? \([\s\S]{0,120}<View style=\{styles\.selectedHeader\}>/.test(HOME_V2)
      && selectedHeaderIdx >= 0
      && selectedMetaRowIdx > selectedHeaderIdx
      && selectedBadgeClusterIdx > selectedMetaRowIdx
      && selectedTitleLineIdx > selectedBadgeClusterIdx
      && selectedTitleOneLineIdx > selectedTitleLineIdx
      && /selectedWorkoutTitle:\s*{[\s\S]{0,80}textAlign:\s*'left'/.test(HOME_V2)
      && /styles\.dayHeader/.test(HOME_V2),
  );
  ok(
    'HomeScreenV2 selected Game Day helper says Good luck',
    /isSelected && isGame && normal[\s\S]{0,120}<Text style=\{styles\.expandedMeta\}>Good luck!<\/Text>/.test(HOME_V2)
      && !/<Text style=\{styles\.expandedMeta\}>Game Day<\/Text>/.test(HOME_V2),
  );
  ok(
    'HomeScreenV2 taps Game Day to select instead of opening the action sheet',
    /isGame && isNormal \? handleSelectDayOnly\(idx\) : handleDayTap\(idx\)/.test(HOME_V2)
      && /const handleSelectDayOnly = \(idx: number\) => \{[\s\S]{0,180}setSelectedIdx\(\(prev\) => \(prev === idx \? -1 : idx\)\)/.test(USE_HOME_SCREEN)
      && /handleSelectDayOnly,/.test(USE_HOME_SCREEN),
  );
  ok(
    'HomeScreenV2 selected Game Day card owns Log Game and move/remove actions',
    /isSelected && isGame && normal[\s\S]{0,260}label="Log Game"[\s\S]{0,120}onPress=\{onLogGame\}/.test(HOME_V2)
      && /testID="log-game-button"/.test(HOME_V2)
      && /testID="move-remove-game-link"[\s\S]{0,160}<Text style=\{styles\.makeChangeText\}>Move or remove game day<\/Text>/.test(HOME_V2)
      && /onLogGame=\{\(\) => handleLogGame\(day\.date\)\}/.test(HOME_V2)
      && /onGameDayActions=\{\(\) => handleOpenGameDayActions\(day\.date\)\}/.test(HOME_V2)
      && /const handleLogGame = \(dateOverride\?: unknown\)/.test(USE_HOME_SCREEN)
      && /const targetDate = typeof dateOverride === 'string' \? dateOverride : gameModalDate/.test(USE_HOME_SCREEN),
  );
  ok(
    'HomeScreenV2 Game Day sheet is move/remove only',
    /function GameDaySheet\(\{ visible, onClose, label, onMove, onRemove \}/.test(HOME_V2)
      && /label="Move Game Day This Week"/.test(HOME_V2)
      && /label="Remove Game Day"/.test(HOME_V2)
      && !/function GameDaySheet[\s\S]{0,900}label="Log Game"/.test(HOME_V2),
  );
  ok(
    'HomeScreenV2 normal selected sessions still show Start Session and change link',
    /isSelected && hasWorkout && !isGame && normal[\s\S]{0,700}label="Start Session"[\s\S]{0,420}<Text style=\{styles\.makeChangeText\}>Want to change something\?<\/Text>/.test(HOME_V2),
  );
  ok(
    'HomeScreenV2 normal selected sessions omit generic item counts',
    !/visibleWorkoutItemCountLabel/.test(HOME_V2)
      && !/\?\? '0 items'/.test(HOME_V2)
      && !/\{visibleWorkoutItemCountLabel\(day\.workout\)/.test(HOME_V2),
  );
  ok(
    'HomeScreenV2 Team Training expanded card has no metadata line',
    /isTeamOnly \? \([\s\S]{0,140}<Button label="Log Session"/.test(HOME_V2)
      && !/isTeamOnly \? \([\s\S]{0,140}expandedMeta/.test(HOME_V2),
  );
  ok(
    'HomeScreenV2 Recovery expanded card uses short recovery copy instead of count',
    /isRecoverySession = hasWorkout && \([\s\S]{0,140}workoutType === 'Recovery'[\s\S]{0,140}sessionTier === 'recovery'/.test(HOME_V2)
      && /isRecoverySession \? \([\s\S]{0,120}<Text style=\{styles\.expandedMeta\}>Move easy\. Feel better\.<\/Text>/.test(HOME_V2),
  );
  ok(
    'HomeScreenV2 selected Rest copy is specific and optional',
    /isSelected && !hasWorkout && normal[\s\S]{0,140}<Text style=\{styles\.expandedMeta\}>Freshen up\. Adapt\. Go again\.<\/Text>/.test(HOME_V2)
      && /testID="add-session-link"[\s\S]{0,180}<Text style=\{styles\.makeChangeText\}>Add optional session\?<\/Text>/.test(HOME_V2)
      && !/Recovery is where adaptation happens|Add a session\?/.test(HOME_V2),
  );
  ok(
    'HomeScreenV2 renders row icons beside title and context text',
    /<View style=\{styles\.rowTitleLine\}>[\s\S]{0,160}<RowIcon kind=\{titleIcon\}/.test(HOME_V2)
      && /<View style=\{styles\.rowContextLine\}>[\s\S]{0,220}<RowIcon[\s\S]{0,80}kind=\{contextIcon\}/.test(HOME_V2),
  );
  ok(
    'HomeScreenV2 row icons inherit the resolved row accent colour',
    /const iconColor = color \?\? rowIconColor\(kind\)/.test(HOME_V2)
      && /stroke=\{iconColor\}/.test(HOME_V2)
      && /<RowIcon kind=\{titleIcon\}[\s\S]{0,80}color=\{accentColor\}/.test(HOME_V2)
      && /<RowIcon[\s\S]{0,120}kind=\{contextIcon\}[\s\S]{0,120}color=\{accentColor\}/.test(HOME_V2)
      && /<RowIcon kind="recovery"[\s\S]{0,80}color=\{accentColor\}/.test(HOME_V2),
  );
  ok(
    'HomeScreenV2 renders a left accent strip on Program rows',
    /DAY_ROW_ACCENT/.test(HOME_V2) && /dayAccentStrip/.test(HOME_V2),
  );
  ok(
    'HomeScreenV2 maps visual game rows to amber',
    /game:\s*'#FFC247'/.test(HOME_V2) && /if \(isGame\) return DAY_ROW_ACCENT\.game/.test(HOME_V2),
  );
  ok(
    'HomeScreenV2 only shows Today badge when row badges are enabled',
    /showRowBadges && day\.isToday && <Badge label="Today"/.test(HOME_V2),
  );
  ok(
    'HomeScreenV2 only shows session tier badge when row badges are enabled',
    /showRowBadges && hasWorkout && day\.workout\.sessionTier[\s\S]{0,120}<SessionTierBadge/.test(HOME_V2),
  );
  ok(
    'HomeScreenV2 uses local amber GameBadge instead of lime outline GAME badge',
    /function GameBadge/.test(HOME_V2)
      && /showRowBadges && hasWorkout && isGame[\s\S]{0,80}<GameBadge \/>/.test(HOME_V2)
      && !/<Badge label="Game" tone="outline"/.test(HOME_V2),
  );
  const v2GameBadgeIdx = HOME_V2.indexOf('showRowBadges && hasWorkout && isGame');
  const v2TierBadgeIdx = HOME_V2.indexOf('showRowBadges && hasWorkout && day.workout.sessionTier');
  ok(
    'HomeScreenV2 gives GAME visual badge precedence over session tier badge',
    v2GameBadgeIdx >= 0 && v2TierBadgeIdx > v2GameBadgeIdx,
    `indices game=${v2GameBadgeIdx} tier=${v2TierBadgeIdx}`,
  );
}

section('[8b] Weekly cards hide conditioning dose while detail keeps prescription');
{
  ok(
    'classic and V2 weekly rows use the shared weekly secondary projection',
    /weeklyPlanSecondaryLabel\(day\.workout\)/.test(HOME_CLASSIC)
      && /weeklyPlanSecondaryLabel\(day\.workout\)/.test(HOME_V2),
  );
  ok(
    'Today and Week cards consume attached-only weekly conditioning context',
    /const titleContext = conditioningContext \? null : weeklyPlanSecondaryLabel\(workout\)/.test(TODAY_CARD)
      && /getConditioningContextLabel\(day\.workout\)/.test(WEEK_CARD),
  );
  ok(
    'weekly card sources never render doseLabel directly',
    ![HOME_CLASSIC, HOME_V2, TODAY_CARD, WEEK_CARD].some((source) => /\.doseLabel\b/.test(source)),
  );
  ok(
    'workout detail keeps conditioning description and linked prescription rows',
    /description: opt\.description/.test(USE_DAY_WORKOUT)
      && /rows: conditioningExercises\.filter/.test(USE_DAY_WORKOUT)
      && /conditioningOptions\.map/.test(DAY_V2)
      && /opt\.description/.test(DAY_V2)
      && /opt\.rows\.map/.test(DAY_V2),
  );
}

section('[9] DayWorkoutScreenV2 — card copy + expanded details');
{
  ok('card eyebrow is COACH UPDATE', />COACH UPDATE</.test(DAY_V2));
  ok('default body uses helper summary', /getCoachNoteDisplay\(notes,\s*{/.test(DAY_V2));
  ok('default body renders summaryLine', /\{summary\.summaryLine\}/.test(DAY_V2));
  ok('default body source does not render Coach adjusted literal', !/Coach adjusted/.test(DAY_V2));
  ok('detail toggle uses shouldShowDetails', /const hasDetails = summary\.shouldShowDetails/.test(DAY_V2));
  ok('expanded details testID exists', /testID="coach-note-banner-details"/.test(DAY_V2));
  ok('expanded state maps detailLines', /summary\.detailLines\.map/.test(DAY_V2));
}

console.log(`\n— Summary —`);
console.log(`  Pass: ${pass}`);
console.log(`  Fail: ${fail}`);
if (fail > 0) {
  console.log(`\n— Failures —`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
process.exit(0);
