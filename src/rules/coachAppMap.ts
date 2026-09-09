/**
 * THE APP MAP — every door the coach may name (plan slice S3, 2026-09-10).
 *
 * A door is a control the athlete can tap. Each row carries the door's exact
 * on-screen LABEL read from the owner that renders it — a signed-copy id, an
 * exported copy constant, or (where the screen still holds a literal) the
 * literal pinned by `coachAppMapTests` against its file — so a renamed
 * button changes this map on the next build and reds the freshness cell in
 * `test:coach-chat-integration` until the bundle is rebuilt.
 *
 * WRITER: this file and `scripts/build-coach-app-map.ts` (→
 * `docs/generated/COACH_APP_MAP.md`, authority `app_map`). READERS: the
 * retriever (one chunk per DOOR row), the model (APP DOORS block), the
 * response contract (`doorClaimGrounded` — a quoted control the words send
 * the athlete to must be one of these labels). TEST: `coachAppMapTests`.
 *
 * L-C4 (parity): the coach may only name what the athlete's own buttons say;
 * nothing here is a paraphrase. R-249 and LAW-coach-empty-state stand — the
 * coach names doors in words; it renders no button and no doorway.
 */
import { registerProjectionCopy } from './projectionCopy';
import { signedCopyEntry } from './signedCopy';
import { COACH_TAB_COPY } from './coachTabCopy';
import { PROGRESS_TAB_COPY } from './progressTabCopy';
import { FEEDBACK_FORM_SECTION_LABELS } from '../utils/sessionFeedbackForm';
// The Tired / Sick / Injured tile labels live in a React Native component
// (`CHANGE_ACTION_LABEL` in SessionChangeHub.tsx), which cannot be imported
// here — this file also runs on the server. They are pinned as literals and
// `coachAppMapTests` greps the component for each.
const CHANGE_HUB = 'src/components/SessionChangeHub.tsx';
const CHANGE_ACTION_LABEL = { tired: 'Tired', sick: 'Sick', injured: 'Injured' } as const;

export type CoachAppDoorSource =
  | { readonly kind: 'signed'; readonly id: string }
  | { readonly kind: 'constant'; readonly name: string }
  /** A literal still living in a screen; `coachAppMapTests` greps the file for it. */
  | { readonly kind: 'literal'; readonly file: string };

export interface CoachAppDoor {
  readonly id: `DOOR-${string}`;
  readonly label: string;
  /** The choices the door offers, by their exact labels (tiers, Yes/No, chips). */
  readonly options?: readonly string[];
  /** Tab → screen → control, in the athlete's words. */
  readonly path: readonly string[];
  readonly does: string;
  readonly when: string;
  readonly source: CoachAppDoorSource;
}

function signed(id: string): string {
  registerProjectionCopy();
  const entry = signedCopyEntry(id);
  if (!entry) throw new Error(`coachAppMap: signed copy "${id}" is not on the sheet`);
  return entry.text;
}

const TAB_PROGRAM = 'Program';
const TAB_COACH = 'Coach';
const TAB_PROGRESS = 'Progress';
const TAB_PROFILE = 'Profile';
const NAVIGATOR = 'src/navigation/AppNavigator.tsx';
const HOME = 'src/screens/home/HomeScreenV2.tsx';
const PLAN_SHEET = 'src/screens/home/PlanChangeSheet.tsx';
const SESSION = 'src/screens/home/DayWorkoutScreenV2.tsx';
const STATUS = 'src/screens/coach/CoachStatusScreen.tsx';
const NOTE_SHEET = 'src/components/CoachNoteSheet.tsx';
const PROFILE = 'src/screens/profile/ProfileScreen.tsx';
const INJURY_FLOW = 'src/screens/home/GuidedInjuryFlowSheet.tsx';

const notFeeling = signed('day.change_card.heading');
const myStatus = signed('coach.status.title');
const sessionOptions = signed('plan_change.session_options');
const adjustWeek = signed('week.edit_sheet.title');
const manageWeek = signed('week.edit_sheet.manage_sessions.label');

export const COACH_APP_MAP: readonly CoachAppDoor[] = [
  // ── Program tab ──────────────────────────────────────────────────────────
  { id: 'DOOR-program-tab', label: TAB_PROGRAM, path: [TAB_PROGRAM], source: { kind: 'literal', file: NAVIGATOR },
    does: 'Shows today (Day) or the whole week (Week), the session card, team training and the Not feeling 100%? card.',
    when: 'Anything about today or this week.' },
  { id: 'DOOR-day-week-toggle', label: 'Week', path: [TAB_PROGRAM, 'Day / Week'], source: { kind: 'literal', file: HOME },
    does: 'Switches the Program tab between one day and the seven-day week.',
    when: 'The athlete wants to see or change the whole week.' },
  { id: 'DOOR-plan-options', label: sessionOptions, path: [TAB_PROGRAM, "TODAY'S FOCUS card", '•••'], options: [signed('plan_change.add_to_session'), signed('plan_change.remove_session'), 'Move this session'], source: { kind: 'signed', id: 'plan_change.session_options' },
    does: `Opens ${sessionOptions}: ${signed('plan_change.add_to_session')}, ${signed('plan_change.remove_session')}, and from the Week view, Move this session.`,
    when: 'The athlete wants to add to, remove or move the day\'s session.' },
  { id: 'DOOR-add-to-session', label: signed('plan_change.add_to_session'), path: [TAB_PROGRAM, "TODAY'S FOCUS card", '•••', sessionOptions], source: { kind: 'signed', id: 'plan_change.add_to_session' },
    does: 'Adds a session of a chosen kind (Strength, Conditioning, Gunshow, Primer, Mobility, Recovery, Accessories) to this day.',
    when: 'The athlete wants more work on a day.' },
  { id: 'DOOR-remove-session', label: signed('plan_change.remove_session'), path: [TAB_PROGRAM, "TODAY'S FOCUS card", '•••', sessionOptions], source: { kind: 'signed', id: 'plan_change.remove_session' },
    does: signed('plan_change.remove_to_rest'),
    when: 'The athlete wants a day off or a session gone.' },
  { id: 'DOOR-move-session', label: 'Move this session', path: [TAB_PROGRAM, 'Week', 'a session', '•••', sessionOptions], source: { kind: 'literal', file: PLAN_SHEET },
    does: 'Moves the session to another legal day; the app refuses a day that breaks the week (a club night, game day, a full day).',
    when: 'The athlete cannot train on the planned day.' },
  { id: 'DOOR-start-session', label: 'Start Session', path: [TAB_PROGRAM, "TODAY'S FOCUS card"], source: { kind: 'literal', file: HOME },
    does: 'Opens today\'s session: tick exercises, log weights, skip a row, swap or remove an exercise, then log it.',
    when: 'The athlete is about to train.' },
  { id: 'DOOR-add-optional-session', label: signed('day.add_session.action'), path: [TAB_PROGRAM, 'a rest day'], source: { kind: 'signed', id: 'day.add_session.action' },
    does: 'Adds an optional session to a rest day.',
    when: 'The athlete wants to train on a rest day.' },
  { id: 'DOOR-log-training', label: signed('day.club_training.log_action'), path: [TAB_PROGRAM, signed('day.club_training.title')], source: { kind: 'signed', id: 'day.club_training.log_action' },
    does: 'Records whether the athlete got to team training and how it went.',
    when: 'A club night has happened.' },
  { id: 'DOOR-log-game', label: 'Log Game', path: [TAB_PROGRAM, 'Game Day'], source: { kind: 'literal', file: HOME },
    does: 'Records the game and how it felt.',
    when: 'A game has been played.' },
  { id: 'DOOR-move-game-day', label: 'Move Game Day This Week', path: [TAB_PROGRAM, 'Game Day', 'Game day sheet'], source: { kind: 'literal', file: HOME },
    does: 'Moves this week\'s game to another day and re-shapes the week around it.',
    when: 'The fixture changed day.' },
  { id: 'DOOR-remove-game-day', label: 'Remove Game Day', path: [TAB_PROGRAM, 'Game Day', 'Game day sheet'], source: { kind: 'literal', file: HOME },
    does: 'Removes this week\'s game (a bye) and re-shapes the week.',
    when: 'There is no game this week.' },
  { id: 'DOOR-not-feeling-100', label: notFeeling, path: [TAB_PROGRAM], source: { kind: 'signed', id: 'day.change_card.heading' },
    does: signed('day.change_card.subline'),
    when: 'The athlete is tired, sick or injured.' },
  { id: 'DOOR-tired', label: CHANGE_ACTION_LABEL.tired, path: [TAB_PROGRAM, notFeeling], options: ['Bit tired today', 'Pretty flat', 'Totally cooked', 'Yes — make today lighter', 'No thanks — keep it as planned'], source: { kind: 'literal', file: CHANGE_HUB },
    does: `${signed('day.change_card.tired_detail')} Asks What's closest?: Bit tired today, Pretty flat, Totally cooked. Then offers Make today lighter?`,
    when: 'Low energy, flat, cooked — ordinary fatigue, no illness or pain.' },
  { id: 'DOOR-sick', label: CHANGE_ACTION_LABEL.sick, path: [TAB_PROGRAM, notFeeling], options: ['A bit off', 'Properly sick', "Can't get out of bed", 'Yes — make today lighter', 'No thanks — keep it as planned'], source: { kind: 'literal', file: CHANGE_HUB },
    does: `${signed('day.change_card.sick_detail')} Asks How bad?: A bit off (logged only), Properly sick (the week is lightened while it is active), Can't get out of bed (nothing is required this week).`,
    when: 'Illness of any degree.' },
  { id: 'DOOR-injured', label: CHANGE_ACTION_LABEL.injured, path: [TAB_PROGRAM, notFeeling], source: { kind: 'literal', file: CHANGE_HUB },
    does: `${signed('day.change_card.injured_detail')} Asks Where is the issue?, how bad it is and what hurts, then adapts the affected work.`,
    when: 'Pain, a niggle or an injury — anything that changes movement.' },
  { id: 'DOOR-missed-session', label: signed('missed.prompt.yes'), path: [TAB_PROGRAM, 'Did you do … ? notice'], options: [signed('missed.prompt.yes'), signed('missed.prompt.no'), signed('missed.prompt.move')], source: { kind: 'signed', id: 'missed.prompt.yes' },
    does: `The notice asks about a session that was not logged: ${signed('missed.prompt.yes')}, ${signed('missed.prompt.no')}, ${signed('missed.prompt.move')}.`,
    when: 'A past session has no answer yet.' },
  { id: 'DOOR-adjust-this-week', label: adjustWeek, path: [TAB_PROGRAM, 'Week', 'pen'], options: [signed('week.edit_sheet.away.label'), manageWeek], source: { kind: 'signed', id: 'week.edit_sheet.title' },
    does: `Asks ${signed('week.edit_sheet.question')}: ${signed('week.edit_sheet.away.label')} or ${manageWeek}.`,
    when: 'The athlete is going away or wants to rearrange the week.' },
  { id: 'DOOR-going-away', label: signed('week.edit_sheet.away.label'), path: [TAB_PROGRAM, 'Week', 'pen', adjustWeek], source: { kind: 'signed', id: 'week.edit_sheet.away.label' },
    does: `${signed('week.edit_sheet.away.subline')} Asks the leave and return dates and what gear is there (same gear, some gear, bodyweight only).`,
    when: 'Travel, holidays, time away from the usual gym.' },
  { id: 'DOOR-manage-week', label: manageWeek, path: [TAB_PROGRAM, 'Week', 'pen', adjustWeek], options: [signed('week.board.add.training.label'), signed('week.board.add.game.label'), signed('week.board.save')], source: { kind: 'signed', id: 'week.edit_sheet.manage_sessions.label' },
    does: `${signed('week.edit_sheet.manage_sessions.subline')} Drag a session to another day, add to an empty day (${signed('week.board.add.training.label')} or ${signed('week.board.add.game.label')}), remove one, then ${signed('week.board.save')}.`,
    when: 'The athlete wants to move, add or remove sessions across the week.' },
  // ── Session screen ───────────────────────────────────────────────────────
  { id: 'DOOR-session-options', label: sessionOptions, path: [TAB_PROGRAM, 'Start Session', '•••'], options: [signed('session.options.injury.label'), signed('session.options.equipment.label')], source: { kind: 'signed', id: 'plan_change.session_options' },
    does: `Inside a session: ${signed('session.options.injury.label')} (${signed('session.options.injury.subline')}) and ${signed('session.options.equipment.label')} (${signed('session.options.equipment.subline')}).`,
    when: 'Something hurts mid-session, or the gear is not there.' },
  { id: 'DOOR-something-hurts', label: signed('session.options.injury.label'), path: [TAB_PROGRAM, 'Start Session', '•••', sessionOptions], source: { kind: 'signed', id: 'session.options.injury.label' },
    does: signed('session.options.injury.subline'),
    when: 'Pain during the session.' },
  { id: 'DOOR-equipment-changed', label: signed('session.options.equipment.label'), path: [TAB_PROGRAM, 'Start Session', '•••', sessionOptions], options: [signed('session.equipment.update_action')], source: { kind: 'signed', id: 'session.options.equipment.label' },
    does: `${signed('session.options.equipment.subline')} ${signed('session.equipment.description')} Then ${signed('session.equipment.update_action')}.`,
    when: 'A machine, bar or rack is missing today.' },
  { id: 'DOOR-log-session', label: signed('session.log_action'), path: [TAB_PROGRAM, 'Start Session'], options: [FEEDBACK_FORM_SECTION_LABELS.completion, FEEDBACK_FORM_SECTION_LABELS.feeling, signed('feedback.save_action')], source: { kind: 'signed', id: 'session.log_action' },
    does: `Asks ${FEEDBACK_FORM_SECTION_LABELS.completion} and ${FEEDBACK_FORM_SECTION_LABELS.feeling}, lets the athlete add a note, then ${signed('feedback.save_action')}.`,
    when: 'The session is finished, partly done, or skipped.' },
  // ── My Status (from the Program header) ──────────────────────────────────
  { id: 'DOOR-my-status', label: myStatus, path: [TAB_PROGRAM, myStatus], source: { kind: 'signed', id: 'coach.status.title' },
    does: 'Shows the season phase with a Review control, and every active adjustment (injury, sickness, fatigue, equipment) with Keep active or Clear adjustment, and How are you feeling now?',
    when: 'The athlete wants to see or clear what is currently changing their program, or review the season phase.' },
  { id: 'DOOR-clear-adjustment', label: 'Clear adjustment', path: [TAB_PROGRAM, myStatus, 'an active adjustment'], options: ['Keep active', signed('status_update.good_now'), signed('status_update.still_not_right'), signed('status_update.still_pretty_sick'), signed('status_update.still_cooked'), signed('status_update.worse')], source: { kind: 'literal', file: NOTE_SHEET },
    does: `Ends the adjustment; the week returns to normal. The sheet also asks How are you feeling now?: ${signed('status_update.good_now')}, ${signed('status_update.still_not_right')}, ${signed('status_update.worse')}.`,
    when: 'The athlete is better and wants the program back.' },
  { id: 'DOOR-season-phase-review', label: 'REVIEW', path: [TAB_PROGRAM, myStatus, 'SEASON PHASE'], source: { kind: 'literal', file: STATUS },
    does: 'Changes the season phase (Off-season, Pre-season, In-season) and rebuilds the program for it.',
    when: 'The season moved on and the app still shows the old phase.' },
  // ── Coach tab ────────────────────────────────────────────────────────────
  { id: 'DOOR-coach-tab', label: TAB_COACH, path: [TAB_COACH], options: ['Keep it as is'], source: { kind: 'literal', file: NAVIGATOR },
    does: `This conversation. Placeholder: "${COACH_TAB_COPY.placeholder}". When the app has a question about how many sessions a week, it asks here with chips to answer.`,
    when: 'Any question; the weekly sessions question.' },
  // ── Progress tab ─────────────────────────────────────────────────────────
  { id: 'DOOR-progress-tab', label: TAB_PROGRESS, path: [TAB_PROGRESS], source: { kind: 'literal', file: NAVIGATOR },
    does: `${PROGRESS_TAB_COPY.load} with its history, ${PROGRESS_TAB_COPY.mainLifts}, ${PROGRESS_TAB_COPY.performanceTests} (${PROGRESS_TAB_COPY.saveResult}) and ${PROGRESS_TAB_COPY.measurements} (${PROGRESS_TAB_COPY.saveMeasurements}).`,
    when: 'Load, lifts, a new 2 km or sprint time, bodyweight.' },
  { id: 'DOOR-save-result', label: PROGRESS_TAB_COPY.saveResult, path: [TAB_PROGRESS, PROGRESS_TAB_COPY.performanceTests], source: { kind: 'constant', name: 'PROGRESS_TAB_COPY.saveResult' },
    does: 'Records a performance test: 2 km or 3 km time trial, 400 m, 1 min max cal air bike, 100 m or 20 m sprint. The 2 km sets the running speed the conditioning is built on.',
    when: 'The athlete ran a test.' },
  { id: 'DOOR-save-measurements', label: PROGRESS_TAB_COPY.saveMeasurements, path: [TAB_PROGRESS, PROGRESS_TAB_COPY.measurements], source: { kind: 'constant', name: 'PROGRESS_TAB_COPY.saveMeasurements' },
    does: 'Records height and weight.',
    when: 'Bodyweight changed.' },
  // ── Profile tab ──────────────────────────────────────────────────────────
  { id: 'DOOR-profile-tab', label: TAB_PROFILE, path: [TAB_PROFILE], source: { kind: 'literal', file: NAVIGATOR },
    does: 'PROGRAM SETUP rows, each with a pen: Name, Footy role, Training Experience, Season phase, Gym days, Team Training, Game Day, Main goal/s, Equipment. Also FAQ, Leave Feedback, Ask a Human, and Full reset.',
    when: 'A standing fact changed: position, experience, phase, gym days, club nights, game day, goals, equipment.' },
  { id: 'DOOR-profile-gym-days', label: 'Gym days', path: [TAB_PROFILE, 'PROGRAM SETUP'], source: { kind: 'literal', file: PROFILE },
    does: 'Changes the days the athlete can get to the gym; future weeks are built around them.',
    when: 'The athlete can train on different days now, or fewer.' },
  { id: 'DOOR-profile-team-training', label: 'Team Training', path: [TAB_PROFILE, 'PROGRAM SETUP'], source: { kind: 'literal', file: PROFILE },
    does: 'Changes the club training nights.',
    when: 'Club nights changed.' },
  { id: 'DOOR-profile-game-day', label: 'Game Day', path: [TAB_PROFILE, 'PROGRAM SETUP'], source: { kind: 'literal', file: PROFILE },
    does: 'Changes the usual game day.',
    when: 'Games moved to another day for the season.' },
  { id: 'DOOR-profile-equipment', label: 'Equipment', path: [TAB_PROFILE, 'PROGRAM SETUP'], source: { kind: 'literal', file: PROFILE },
    does: 'Changes the gear the athlete has in general (for one session only, use Equipment changed inside the session).',
    when: 'A new gym, or gear bought or lost.' },
  { id: 'DOOR-profile-season-phase', label: 'Season phase', path: [TAB_PROFILE, 'PROGRAM SETUP'], source: { kind: 'literal', file: PROFILE },
    does: 'Changes the season phase and rebuilds the program for it.',
    when: 'Off-season, pre-season or in-season has started.' },
  { id: 'DOOR-full-reset', label: 'Full reset', path: [TAB_PROFILE, 'DANGER ZONE'], source: { kind: 'literal', file: PROFILE },
    does: 'Wipes profile, program, calendar and coach history and returns to onboarding.',
    when: 'Only when the athlete wants to start completely over.' },
];

/** Every label the coach may send the athlete to, for the response contract's door gate. */
export const COACH_APP_DOOR_LABELS: readonly string[] = Array.from(
  new Set(COACH_APP_MAP.flatMap((door) => [door.label, ...(door.options ?? [])])),
);
