/**
 * ScheduleDebugPanel — Dev-only schedule inspection overlay.
 *
 * Shows engine decisions, resolver output, and day-level explanations
 * in a scrollable modal. Activated by a floating "DBG" button.
 *
 * Gated by __DEV__ at import site — never ships to production.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Modal,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import { Text } from '../common/Text';
import { useProfileStore } from '../../store/profileStore';
import { useCalendarStore } from '../../store/calendarStore';
import { useProgramStore } from '../../store/programStore';
import {
  buildWeekDebugInfo,
  buildDayDebugInfo,
  type WeekDebugInfo,
  type DayDebugInfo,
  type Mismatch,
  type MismatchSeverity,
} from '../../utils/scheduleDebug';
import type { ResolvedDay, ScheduleState } from '../../utils/sessionResolver';
import {
  DEFAULT_ATHLETE_CONTEXT,
} from '../../utils/sessionBuilder';
import { resolveEquipmentAvailability } from '../../utils/equipmentAvailability';

// ═══════════════════════════════════════════════
// PROPS
// ═══════════════════════════════════════════════

interface Props {
  weekDays: ResolvedDay[];
}

// ═══════════════════════════════════════════════
// INTERNAL HOOK — mirror useScheduleState from useSchedule.ts
// ═══════════════════════════════════════════════

function useScheduleState(): ScheduleState {
  const currentProgram = useProgramStore((s) => s.currentProgram);
  const currentMicrocycle = useProgramStore((s) => s.currentMicrocycle);
  const manualOverrides = useProgramStore((s) => s.dateOverrides);
  const sessionFeedback = useProgramStore((s) => s.sessionFeedback);
  const weightOverrides = useProgramStore((s) => s.weightOverrides);
  const markedDays = useCalendarStore((s) => s.markedDays);
  const onboardingData = useProfileStore((s) => s.onboardingData);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useCoachUpdatesStore } = require('../../store/coachUpdatesStore');
  const activeConstraints =
    useCoachUpdatesStore((s: any) => s.activeConstraints) ?? [];

  const trainingLocation = onboardingData?.trainingLocation || 'Commercial gym';
  const athleteContext = onboardingData
    ? { injuries: onboardingData.injuries || [], equipmentTags: resolveEquipmentAvailability(onboardingData, activeConstraints), trainingLocation }
    : DEFAULT_ATHLETE_CONTEXT;

  const seasonPhase = onboardingData?.seasonPhase || null;

  return {
    currentProgram,
    currentMicrocycle,
    manualOverrides: manualOverrides || {},
    markedDays: markedDays || {},
    athleteContext,
    seasonPhase,
    readiness: 'medium',
    sessionFeedback: sessionFeedback || {},
    weightOverrides: weightOverrides || {},
  };
}

// ═══════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════

export function ScheduleDebugPanel({ weekDays }: Props) {
  const [visible, setVisible] = useState(false);
  const [tab, setTab] = useState<'week' | 'days'>('week');
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const onboarding = useProfileStore((s) => s.onboardingData);
  const state = useScheduleState();

  const weekInfo = useMemo(
    () => buildWeekDebugInfo(onboarding, weekDays, state),
    [onboarding, weekDays, state],
  );

  const dayInfos = useMemo(
    () => weekDays.map(d => buildDayDebugInfo(d, state)),
    [weekDays, state],
  );

  if (!weekInfo) return null;

  return (
    <>
      {/* Floating trigger button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.fabText}>DBG</Text>
      </TouchableOpacity>

      {/* Debug modal */}
      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Schedule Debug</Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Text style={styles.headerClose}>Close</Text>
              </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
              <TouchableOpacity
                style={[styles.tab, tab === 'week' && styles.tabActive]}
                onPress={() => setTab('week')}
              >
                <Text style={[styles.tabText, tab === 'week' && styles.tabTextActive]}>WEEK</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, tab === 'days' && styles.tabActive]}
                onPress={() => setTab('days')}
              >
                <Text style={[styles.tabText, tab === 'days' && styles.tabTextActive]}>DAYS</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
              {tab === 'week' ? (
                <WeekTab info={weekInfo} />
              ) : (
                <DaysTab
                  dayInfos={dayInfos}
                  expandedDay={expandedDay}
                  onToggle={(d) => setExpandedDay(expandedDay === d ? null : d)}
                />
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// ═══════════════════════════════════════════════
// WEEK TAB
// ═══════════════════════════════════════════════

function WeekTab({ info }: { info: WeekDebugInfo }) {
  const critCount = info.mismatches.filter(m => m.severity === 'critical').length;
  const warnCount = info.mismatches.filter(m => m.severity === 'warning').length;
  const infoCount = info.mismatches.filter(m => m.severity === 'info').length;

  return (
    <View style={styles.section}>
      {/* One-line health summary */}
      {critCount > 0 ? (
        <View style={styles.summaryBannerCritical}>
          <Text style={styles.summaryTextCritical}>
            {critCount} critical{warnCount > 0 ? `, ${warnCount} warning` : ''}
          </Text>
        </View>
      ) : warnCount > 0 ? (
        <View style={styles.summaryBannerWarning}>
          <Text style={styles.summaryTextWarning}>
            {warnCount} warning{infoCount > 0 ? `, ${infoCount} info` : ''}
          </Text>
        </View>
      ) : info.mismatches.length > 0 ? (
        <View style={styles.summaryBannerOk}>
          <Text style={styles.summaryTextOk}>{infoCount} info (no issues)</Text>
        </View>
      ) : (
        <View style={styles.summaryBannerOk}>
          <Text style={styles.summaryTextOk}>No mismatches</Text>
        </View>
      )}

      {/* Engine Inputs */}
      <Text style={styles.sectionTitle}>ENGINE INPUTS</Text>
      <Row label="Season" value={info.seasonPhase} />
      <Row label="Game day" value={info.gameDay || 'none'} />
      <Row label="Has game" value={String(info.hasGame)} />
      <Row label="Training days" value={info.selectedDays.join(', ') || 'none'} />
      <Row label="Available days" value={String(info.availableDays)} />
      <Row label="Team training" value={info.teamTrainingDays.join(', ') || 'none'} />
      <Row label="Team intensity" value={info.teamTrainingIntensity || 'none'} />

      {/* Engine Decisions */}
      <Text style={[styles.sectionTitle, { marginTop: 16 }]}>ENGINE DECISIONS</Text>
      <Row label="Readiness" value={info.readiness} highlight={info.readiness === 'low' ? 'warn' : undefined} />
      {info.readinessFactors.map((f, i) => (
        <Text key={i} style={styles.factorText}>  {f}</Text>
      ))}
      <Row label="Hard cap" value={String(info.hardExposureCap)} />
      <Row label="Existing hard" value={String(info.existingHardExposures)} />
      <Row label="Remaining budget" value={String(info.remainingHardBudget)} highlight={info.remainingHardBudget === 0 ? 'warn' : undefined} />
      <Row label="Core" value={String(info.coreSessions)} highlight="accent" />
      <Row label="Optional" value={String(info.optionalSessions)} />
      <Row label="Recovery" value={String(info.recoverySessions)} />

      {/* Weekly Plan */}
      <Text style={[styles.sectionTitle, { marginTop: 16 }]}>ENGINE WEEKLY PLAN</Text>
      {info.weeklyPlan.map((s, i) => (
        <View key={i} style={styles.planRow}>
          <Text style={styles.planDay}>{s.day.substring(0, 3).toUpperCase()}</Text>
          <Text style={[styles.planTier, tierColor(s.tier)]}>{s.tier}</Text>
          <Text style={styles.planFocus} numberOfLines={1}>{s.focus}</Text>
          {s.isHardExposure && <Text style={styles.hardBadge}>HARD</Text>}
        </View>
      ))}

      {/* Mismatches */}
      {info.mismatches.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, styles.mismatchTitle]}>
            MISMATCHES ({info.mismatches.length})
          </Text>
          {info.mismatches.map((m, i) => (
            <View key={i} style={[styles.mismatchRow, severityRowStyle(m.severity)]}>
              <View style={styles.mismatchHeader}>
                <Text style={[styles.mismatchDay, severityTextColor(m.severity)]}>{m.day}</Text>
                <Text style={severityBadgeStyle(m.severity)}>
                  {m.severity.toUpperCase()}
                </Text>
                <Text style={styles.mismatchArrow} numberOfLines={1}>
                  {m.engineTier} "{truncate(m.engineFocus, 22)}" → {m.resolvedSource} "{m.resolvedName || 'none'}"
                </Text>
              </View>
              <Text style={styles.mismatchReason}>{m.reason}</Text>
            </View>
          ))}
        </>
      )}
      {info.mismatches.length === 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>MISMATCHES</Text>
          <Text style={styles.noMismatchText}>Engine plan matches resolver output</Text>
        </>
      )}

      {/* Resolver Output */}
      <Text style={[styles.sectionTitle, { marginTop: 16 }]}>RESOLVER OUTPUT</Text>
      {info.resolverSummary.map((s, i) => (
        <View key={i} style={styles.planRow}>
          <Text style={styles.planDay}>{s.day}</Text>
          <Text style={[styles.planTier, sourceColor(s.source)]}>{s.source}</Text>
          <Text style={styles.planFocus} numberOfLines={1}>{s.sessionName || '(none)'}</Text>
        </View>
      ))}
    </View>
  );
}

// ═══════════════════════════════════════════════
// DAYS TAB
// ═══════════════════════════════════════════════

function DaysTab({
  dayInfos,
  expandedDay,
  onToggle,
}: {
  dayInfos: DayDebugInfo[];
  expandedDay: string | null;
  onToggle: (date: string) => void;
}) {
  return (
    <View style={styles.section}>
      {dayInfos.map((d) => {
        const isExpanded = expandedDay === d.date;
        return (
          <Pressable key={d.date} onPress={() => onToggle(d.date)}>
            {/* Summary row */}
            <View style={[styles.dayRow, isExpanded && styles.dayRowExpanded]}>
              <Text style={styles.dayRowDay}>{d.dayOfWeek.substring(0, 3).toUpperCase()}</Text>
              <Text style={[styles.dayRowSource, sourceColor(d.source)]}>{d.source}</Text>
              <Text style={styles.dayRowName} numberOfLines={1}>
                {d.resolvedSessionName || '(none)'}
              </Text>
              <Text style={styles.dayRowArrow}>{isExpanded ? '▼' : '▶'}</Text>
            </View>

            {/* Expanded detail */}
            {isExpanded && (
              <View style={styles.dayDetail}>
                <Text style={styles.explanationText}>{d.sourceExplanation}</Text>

                <Row label="Date" value={d.date} />
                <Row label="Tier" value={d.resolvedTier || '-'} />
                <Row label="Type" value={d.resolvedWorkoutType || '-'} />
                <Row label="Intensity" value={d.resolvedIntensity || '-'} />
                <Row label="Exercises" value={String(d.exerciseCount)} />

                <Text style={[styles.sectionTitle, { marginTop: 10 }]}>ORIGIN</Text>
                <Row label="Template session" value={d.templateSessionName || '(none)'} />
                <Row label="Resolved session" value={d.resolvedSessionName || '(none)'} />
                <FlagRow label="wasTemplateReplaced" value={d.wasTemplateReplaced} />
                <FlagRow label="wasEmptySlotFilled" value={d.wasEmptySlotFilled} />
                <FlagRow label="wasDerived" value={d.wasDerived} />
                {d.replacementReason && (
                  <Row label="Reason" value={d.replacementReason} />
                )}

                <Text style={[styles.sectionTitle, { marginTop: 10 }]}>FLAGS</Text>
                <FlagRow label="isGameDay" value={d.isGameDay} />
                <FlagRow label="isGMinus1" value={d.isGMinus1} />
                <FlagRow label="isGMinus2" value={d.isGMinus2} />
                <FlagRow label="isGPlus1" value={d.isGPlus1} />
                <FlagRow label="gameProximityModified" value={d.gameProximityModified} />
                <FlagRow label="cameFromTemplate" value={d.cameFromTemplate} />
                <FlagRow label="cameFromDerived" value={d.cameFromDerived} />
                <FlagRow label="wasOverridden" value={d.wasOverridden} />
                <FlagRow label="isOptional" value={d.isOptional} />
                <FlagRow label="isRecovery" value={d.isRecovery} />
                <FlagRow label="isConditioning" value={d.isConditioning} />

                {d.daysToNextGame !== null && (
                  <Row label="Days to next game" value={String(d.daysToNextGame)} />
                )}
                {d.daysSinceLastGame !== null && (
                  <Row label="Days since last game" value={String(d.daysSinceLastGame)} />
                )}
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

// ═══════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════

function Row({ label, value, highlight }: { label: string; value: string; highlight?: 'warn' | 'accent' }) {
  const valueStyle = highlight === 'warn' ? styles.valueWarn
    : highlight === 'accent' ? styles.valueAccent
    : styles.value;
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={valueStyle}>{value}</Text>
    </View>
  );
}

function FlagRow({ label, value }: { label: string; value: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={value ? styles.flagTrue : styles.flagFalse}>{value ? 'true' : 'false'}</Text>
    </View>
  );
}

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.substring(0, maxLen - 1) + '…' : str;
}

const SEVERITY_COLORS: Record<MismatchSeverity, string> = {
  critical: '#EF5350',
  warning: '#FFB74D',
  info: '#666',
};

function severityRowStyle(severity: MismatchSeverity) {
  return {
    borderLeftColor: SEVERITY_COLORS[severity],
    backgroundColor: severity === 'critical' ? 'rgba(239, 83, 80, 0.12)'
      : severity === 'warning' ? 'rgba(255, 183, 77, 0.08)'
      : 'rgba(100, 100, 100, 0.06)',
  };
}

function severityTextColor(severity: MismatchSeverity) {
  return { color: SEVERITY_COLORS[severity] };
}

function severityBadgeStyle(severity: MismatchSeverity) {
  return {
    color: SEVERITY_COLORS[severity],
    fontSize: 8,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
    opacity: severity === 'info' ? 0.6 : 1,
  };
}

function tierColor(tier: string) {
  switch (tier) {
    case 'core': return { color: '#C8FF00' };
    case 'optional': return { color: '#64B5F6' };
    case 'recovery': return { color: '#81C784' };
    default: return { color: '#888' };
  }
}

function sourceColor(source: string) {
  switch (source) {
    case 'template': return { color: '#C8FF00' };
    case 'gameProximity': return { color: '#FFB74D' };
    case 'game': return { color: '#EF5350' };
    case 'conditioning': return { color: '#64B5F6' };
    case 'recovery': return { color: '#81C784' };
    case 'manual': return { color: '#CE93D8' };
    case 'rest': return { color: '#555' };
    case 'none': return { color: '#444' };
    default: return { color: '#888' };
  }
}

// ═══════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════

const MONO = { fontFamily: undefined }; // RN doesn't have monospace by default, but numbers are fine

const styles = StyleSheet.create({
  // Floating button
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 16,
    backgroundColor: 'rgba(200, 255, 0, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 0, 0.4)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    zIndex: 999,
  },
  fabText: {
    color: '#C8FF00',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },

  // Modal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#111',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '85%',
    paddingBottom: 40,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    color: '#C8FF00',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  headerClose: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },

  // Tabs
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#1A1A1A',
  },
  tabActive: {
    backgroundColor: 'rgba(200, 255, 0, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 0, 0.3)',
  },
  tabText: {
    color: '#666',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  tabTextActive: {
    color: '#C8FF00',
  },

  // Body
  body: {
    paddingHorizontal: 16,
  },
  section: {
    paddingBottom: 20,
  },
  sectionTitle: {
    color: '#666',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 6,
    marginTop: 4,
  },

  // Data rows
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  label: {
    color: '#888',
    fontSize: 12,
  },
  value: {
    color: '#DDD',
    fontSize: 12,
    ...MONO,
  },
  valueWarn: {
    color: '#FFB74D',
    fontSize: 12,
    fontWeight: '700',
    ...MONO,
  },
  valueAccent: {
    color: '#C8FF00',
    fontSize: 12,
    fontWeight: '700',
    ...MONO,
  },

  // Flags
  flagTrue: {
    color: '#C8FF00',
    fontSize: 12,
    fontWeight: '700',
  },
  flagFalse: {
    color: '#444',
    fontSize: 12,
  },

  // Readiness factors
  factorText: {
    color: '#777',
    fontSize: 11,
    paddingLeft: 8,
    paddingVertical: 1,
  },

  // Plan rows
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 8,
  },
  planDay: {
    color: '#888',
    fontSize: 11,
    fontWeight: '700',
    width: 32,
  },
  planTier: {
    fontSize: 10,
    fontWeight: '700',
    width: 80,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  planFocus: {
    color: '#CCC',
    fontSize: 11,
    flex: 1,
  },
  hardBadge: {
    color: '#EF5350',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Day rows (days tab)
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#222',
  },
  dayRowExpanded: {
    backgroundColor: '#1A1A1A',
    borderBottomWidth: 0,
  },
  dayRowDay: {
    color: '#AAA',
    fontSize: 12,
    fontWeight: '700',
    width: 32,
  },
  dayRowSource: {
    fontSize: 10,
    fontWeight: '700',
    width: 80,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayRowName: {
    color: '#CCC',
    fontSize: 11,
    flex: 1,
  },
  dayRowArrow: {
    color: '#555',
    fontSize: 10,
  },

  // Day detail
  dayDetail: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 4,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  explanationText: {
    color: '#FFB74D',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    fontStyle: 'italic',
  },

  // Summary banner
  summaryBannerCritical: {
    backgroundColor: 'rgba(239, 83, 80, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 83, 80, 0.4)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  summaryTextCritical: {
    color: '#EF5350',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  summaryBannerWarning: {
    backgroundColor: 'rgba(255, 183, 77, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 183, 77, 0.3)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  summaryTextWarning: {
    color: '#FFB74D',
    fontSize: 12,
    fontWeight: '700',
  },
  summaryBannerOk: {
    backgroundColor: 'rgba(76, 175, 80, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.25)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  summaryTextOk: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '600',
  },

  // Mismatch section
  mismatchTitle: {
    marginTop: 16,
    color: '#EF5350',
  },
  mismatchRow: {
    backgroundColor: 'rgba(239, 83, 80, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: '#EF5350',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 4,
    borderRadius: 4,
  },
  mismatchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mismatchDay: {
    color: '#EF5350',
    fontSize: 11,
    fontWeight: '800',
    width: 30,
  },
  mismatchArrow: {
    color: '#DDD',
    fontSize: 10,
    flex: 1,
  },
  mismatchReason: {
    color: '#FFB74D',
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 2,
    paddingLeft: 36,
  },
  noMismatchText: {
    color: '#4CAF50',
    fontSize: 11,
    fontStyle: 'italic',
    paddingVertical: 4,
  },
});
