/**
 * CoachUpdateCard — week-level note rendered on the Program tab when
 * the coach (or the deterministic engine) has applied changes to the
 * current or future weeks.
 *
 * TRUTH-GATE REWRITE
 * ──────────────────
 *   The card now renders three honest sections:
 *
 *     Applied   — things that ACTUALLY changed in the visible program
 *                 (derived from the visible-week diff; sourced from
 *                 update.appliedChanges).
 *     Guidance  — restrictions the athlete must respect this week
 *                 (avoid sprinting / no max-effort etc).
 *     Optional  — suggestions IF the athlete chooses to add work
 *                 (easy bike/row, mobility, etc) — never claimed as
 *                 something the program already contains.
 *
 *   The pre-MVP card had a "Sub in" section that listed engine-
 *   suggested substitutes whether or not they actually appeared in the
 *   athlete's visible program. That created the live failure where
 *   "Sub in: Easy aerobic conditioning" was rendered without any
 *   bike/row session being added. The truth-gate fields written by
 *   `buildVerifiedCommunication` guarantee this can't happen again.
 *
 * MVP Program-tab card is collapsed by default: visible issue summary
 * + Update coach + Show details. All guidance/detail sections live behind
 * the local details toggle.
 *
 * Back-compat: stored entries that lack truth-gate fields fall back to
 *              the older Avoid/Sub in/Keep rendering so AsyncStorage
 *              entries written by previous app builds still show up.
 */

import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from './common/Text';
import { colors } from '../theme/colors';
import { spacing, borderRadius } from '../theme/spacing';
import type { CoachUpdate } from '../store/coachUpdatesStore';
import { COACH_NOTE_LIMITS } from '../utils/coachNoteSummary';
import { formatExerciseDisplayName } from '../utils/exerciseDisplay';

const APPLIED_MAX = 3;
const GUIDANCE_MAX = 3;
const OPTIONAL_MAX = 2;

interface CoachUpdateCardProps {
  update: CoachUpdate;
  onUpdateCoach: () => void;
}

function formatAppliedChange(c: NonNullable<CoachUpdate['appliedChanges']>[number]): string {
  const before = formatExerciseDisplayName(c.before) || c.before;
  const after = formatExerciseDisplayName(c.after) || c.after;
  switch (c.kind) {
    case 'exercise_removed':
      return before ? `${before} removed from ${c.sessionName}` : `${c.sessionName} adjusted`;
    case 'exercise_replaced':
      if (before && after) return `${before} → ${after} on ${c.sessionName}`;
      if (after) return `${after} added to ${c.sessionName}`;
      if (before) return `${before} removed from ${c.sessionName}`;
      return `${c.sessionName} adjusted`;
    case 'session_replaced':
      return c.before && c.after
        ? `${c.sessionName}: ${c.before} → ${c.after}`
        : `${c.sessionName} replaced`;
    case 'session_lightened':
      return `${c.sessionName} lightened`;
    case 'volume_reduced':
      return `${c.sessionName} volume reduced`;
    case 'conditioning_changed':
      return `${c.sessionName} conditioning adjusted`;
    case 'coach_note_added':
      return c.after ? `${c.sessionName}: ${c.after}` : `${c.sessionName} note added`;
    default:
      return c.sessionName;
  }
}

function issueLines(update: CoachUpdate): string[] {
  const activeIssues = (update as CoachUpdate & { activeIssues?: string[] }).activeIssues;
  const source = Array.isArray(activeIssues) && activeIssues.length > 0
    ? activeIssues
    : String(update.reason || '')
        .split(/\s+•\s+|\n+/)
        .map((line) => line.trim())
        .filter(Boolean);
  return source.length > 0 ? source : ['Coach update active'];
}

export function CoachUpdateCard({ update, onUpdateCoach }: CoachUpdateCardProps) {
  // ── TRUTH-GATE PATH (preferred) ───────────────────────────────────
  // Present when buildVerifiedCommunication has run for this update.
  const hasTruthGate =
    Array.isArray(update.appliedChanges) ||
    Array.isArray(update.activeGuidance) ||
    Array.isArray(update.optionalAdvice);

  const appliedAll = update.appliedChanges ?? [];
  const guidanceAll = update.activeGuidance ?? [];
  const optionalAll = update.optionalAdvice ?? [];
  const applied = appliedAll.slice(0, APPLIED_MAX);
  const guidance = guidanceAll.slice(0, GUIDANCE_MAX);
  const optional = optionalAll.slice(0, OPTIONAL_MAX);

  const truthGateOverflow =
    appliedAll.length > applied.length ||
    guidanceAll.length > guidance.length ||
    optionalAll.length > optional.length;

  // ── LEGACY PATH (older AsyncStorage entries) ─────────────────────
  const avoidAll = update.avoid ?? [];
  const substituteWithAll = update.substituteWith ?? [];
  const keepAll = update.keep ?? [];
  const adviceAll = update.advice ?? [];
  const avoid = avoidAll.slice(0, COACH_NOTE_LIMITS.card.avoid);
  const substituteWith = substituteWithAll.slice(0, COACH_NOTE_LIMITS.card.doInstead);
  const keep = keepAll.slice(0, COACH_NOTE_LIMITS.card.keep);
  const adviceLegacy = adviceAll.slice(0, 2);
  const hasPlanLayer = !hasTruthGate && (avoid.length + substituteWith.length + keep.length > 0);
  const legacyOverflow =
    avoidAll.length > avoid.length ||
    substituteWithAll.length > substituteWith.length ||
    keepAll.length > keep.length ||
    adviceAll.length > adviceLegacy.length;

  // Legacy "rules" fallback for the oldest entries.
  const legacyRulesAll = update.rules ?? [];
  const legacyRules = legacyRulesAll.slice(0, COACH_NOTE_LIMITS.card.avoid);
  const hasLegacyRules = !hasTruthGate && !hasPlanLayer && legacyRules.length > 0;

  // Per-session detail.
  const sessionsChanged = update.changes ?? [];
  const nextWeekChanges = update.nextWeekChanges ?? [];
  const hasAnySessionDetail = sessionsChanged.length > 0 || nextWeekChanges.length > 0;
  const [showDetails, setShowDetails] = React.useState(false);
  const issues = issueLines(update);

  // The "no visible program changes yet" branch — we always render the
  // card whenever there are guidance items or applied changes; only an
  // entirely empty truth-gate update suppresses Applied.
  const showAppliedSection = hasTruthGate;
  const appliedEmpty = applied.length === 0;
  const hasAdvice = hasPlanLayer && adviceLegacy.length > 0;
  const hasExpandableDetails =
    showAppliedSection ||
    (hasTruthGate && (guidance.length > 0 || optional.length > 0 || !!update.unchangedReason)) ||
    hasPlanLayer ||
    hasLegacyRules ||
    hasAnySessionDetail ||
    truthGateOverflow ||
    legacyOverflow;

  return (
    <View style={styles.card} testID="coach-update-card">
      <View style={styles.headerRow}>
        <Text variant="caption" style={styles.eyebrow}>
          COACH UPDATE
        </Text>
      </View>
      <View style={styles.issueList} testID="coach-update-issues">
        {issues.map((issue, i) => (
          <Text key={`issue-${i}`} variant="body" style={styles.reason}>
            {issue}
          </Text>
        ))}
      </View>

      <View style={styles.actionRow} testID="coach-update-actions">
        <Pressable
          onPress={onUpdateCoach}
          style={({ pressed }) => [
            styles.button,
            pressed && { opacity: 0.8 },
          ]}
          testID="coach-update-update-coach"
        >
          <Text variant="bodySmall" style={styles.buttonText}>
            Update coach
          </Text>
        </Pressable>

        {hasExpandableDetails && (
          <Pressable
            onPress={() => setShowDetails((v) => !v)}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && { opacity: 0.8 },
            ]}
            testID="coach-update-toggle-details"
          >
            <Text variant="bodySmall" style={styles.secondaryButtonText}>
              {showDetails ? 'Hide details' : 'Show details'}
            </Text>
          </Pressable>
        )}
      </View>

      {/* ── TRUTH-GATE SECTIONS (preferred) ──────────────────────── */}
      {showDetails && showAppliedSection && (
        <View style={styles.section} testID="coach-update-applied">
          <Text variant="caption" color={colors.text.secondary} style={styles.sectionLabel}>
            Applied
          </Text>
          {appliedEmpty ? (
            <Text
              variant="bodySmall"
              color={colors.text.secondary}
              style={[styles.bullet, styles.adviceLine]}
              testID="coach-update-applied-empty"
            >
              • No visible program changes yet
            </Text>
          ) : (
            applied.map((c, i) => (
              <Text
                key={`applied-${i}`}
                variant="bodySmall"
                color={colors.text.primary}
                style={styles.bullet}
              >
                • {formatAppliedChange(c)}
              </Text>
            ))
          )}
        </View>
      )}

      {showDetails && hasTruthGate && guidance.length > 0 && (
        <View style={styles.section} testID="coach-update-guidance">
          <Text variant="caption" color={colors.text.secondary} style={styles.sectionLabel}>
            Avoid
          </Text>
          {guidance.map((line, i) => (
            <Text
              key={`guidance-${i}`}
              variant="bodySmall"
              color={colors.text.primary}
              style={styles.bullet}
            >
              • {line}
            </Text>
          ))}
        </View>
      )}

      {showDetails && hasTruthGate && optional.length > 0 && (
        <View style={styles.section} testID="coach-update-optional">
          <Text variant="caption" color={colors.text.secondary} style={styles.sectionLabel}>
            Optional
          </Text>
          {optional.map((line, i) => (
            <Text
              key={`optional-${i}`}
              variant="bodySmall"
              color={colors.text.secondary}
              style={[styles.bullet, styles.adviceLine]}
            >
              • {line}
            </Text>
          ))}
        </View>
      )}

      {showDetails && hasTruthGate && update.unchangedReason && appliedEmpty && (
        <Text
          variant="bodySmall"
          color={colors.text.secondary}
          style={[styles.bullet, styles.adviceLine, { marginTop: spacing.sm }]}
          testID="coach-update-unchanged-reason"
        >
          {update.unchangedReason}
        </Text>
      )}

      {/* ── LEGACY plan-driven sections (older entries) ─────────── */}
      {showDetails && hasPlanLayer && avoid.length > 0 && (
        <View style={styles.section} testID="coach-update-avoid">
          <Text variant="caption" color={colors.text.secondary} style={styles.sectionLabel}>
            Avoid
          </Text>
          {avoid.map((line, i) => (
            <Text
              key={`avoid-${i}`}
              variant="bodySmall"
              color={colors.text.primary}
              style={styles.bullet}
            >
              • {line}
            </Text>
          ))}
        </View>
      )}

      {showDetails && hasPlanLayer && substituteWith.length > 0 && (
        <View style={styles.section} testID="coach-update-do-instead">
          <Text variant="caption" color={colors.text.secondary} style={styles.sectionLabel}>
            Do instead
          </Text>
          {substituteWith.map((line, i) => (
            <Text
              key={`sub-${i}`}
              variant="bodySmall"
              color={colors.text.primary}
              style={styles.bullet}
            >
              • {line}
            </Text>
          ))}
        </View>
      )}

      {showDetails && hasPlanLayer && keep.length > 0 && (
        <View style={styles.section} testID="coach-update-keep">
          <Text variant="caption" color={colors.text.secondary} style={styles.sectionLabel}>
            Keep
          </Text>
          {keep.map((line, i) => (
            <Text
              key={`keep-${i}`}
              variant="bodySmall"
              color={colors.text.primary}
              style={styles.bullet}
            >
              • {line}
            </Text>
          ))}
        </View>
      )}

      {showDetails && hasAdvice && (
        <View style={styles.section} testID="coach-update-advice">
          <Text variant="caption" color={colors.text.secondary} style={styles.sectionLabel}>
            Advice
          </Text>
          {adviceLegacy.map((line, i) => (
            <Text
              key={`advice-${i}`}
              variant="bodySmall"
              color={colors.text.secondary}
              style={[styles.bullet, styles.adviceLine]}
            >
              {line}
            </Text>
          ))}
        </View>
      )}

      {/* ── Oldest legacy: rules-only ────────────────────────────── */}
      {showDetails && hasLegacyRules && (
        <View style={styles.section}>
          <Text variant="caption" color={colors.text.secondary} style={styles.sectionLabel}>
            This week
          </Text>
          {legacyRules.map((rule, i) => (
            <Text
              key={`rule-${i}`}
              variant="bodySmall"
              color={colors.text.primary}
              style={styles.bullet}
            >
              • {rule}
            </Text>
          ))}
        </View>
      )}

      {/* Truth-gate overflow */}
      {hasTruthGate && showDetails && truthGateOverflow && (
        <View style={styles.section} testID="coach-update-truth-overflow">
          {appliedAll.length > applied.length && (
            <>
              <Text variant="caption" color={colors.text.secondary} style={styles.sectionLabel}>
                More applied
              </Text>
              {appliedAll.slice(applied.length).map((c, i) => (
                <Text
                  key={`applied-extra-${i}`}
                  variant="bodySmall"
                  color={colors.text.primary}
                  style={styles.bullet}
                >
                  • {formatAppliedChange(c)}
                </Text>
              ))}
            </>
          )}
          {guidanceAll.length > guidance.length && (
            <>
              <Text variant="caption" color={colors.text.secondary} style={[styles.sectionLabel, { marginTop: spacing.sm }]}>
                More guidance
              </Text>
              {guidanceAll.slice(guidance.length).map((line, i) => (
                <Text
                  key={`guidance-extra-${i}`}
                  variant="bodySmall"
                  color={colors.text.primary}
                  style={styles.bullet}
                >
                  • {line}
                </Text>
              ))}
            </>
          )}
          {optionalAll.length > optional.length && (
            <>
              <Text variant="caption" color={colors.text.secondary} style={[styles.sectionLabel, { marginTop: spacing.sm }]}>
                More optional
              </Text>
              {optionalAll.slice(optional.length).map((line, i) => (
                <Text
                  key={`optional-extra-${i}`}
                  variant="bodySmall"
                  color={colors.text.secondary}
                  style={[styles.bullet, styles.adviceLine]}
                >
                  • {line}
                </Text>
              ))}
            </>
          )}
        </View>
      )}

      {/* Legacy overflow + sessions changed */}
      {(hasPlanLayer || hasTruthGate) && showDetails && sessionsChanged.length > 0 && (
        <View style={styles.section}>
          <Text variant="caption" color={colors.text.secondary} style={styles.sectionLabel}>
            Sessions changed
          </Text>
          {sessionsChanged.map((change, i) => (
            <Text
              key={`change-${i}`}
              variant="bodySmall"
              color={colors.text.primary}
              style={styles.bullet}
            >
              • {change}
            </Text>
          ))}
        </View>
      )}

      {(hasPlanLayer || hasTruthGate) && showDetails && nextWeekChanges.length > 0 && (
        <View style={styles.section} testID="coach-update-next-week-section">
          <Text variant="caption" color={colors.text.secondary} style={styles.sectionLabel}>
            Next week
          </Text>
          {nextWeekChanges.map((change, i) => (
            <Text
              key={`next-${i}`}
              variant="bodySmall"
              color={colors.text.primary}
              style={styles.bullet}
            >
              • {change}
            </Text>
          ))}
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(200, 255, 0, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: '#C8FF00',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  eyebrow: {
    color: '#C8FF00',
    fontWeight: '700',
    letterSpacing: 1,
    fontSize: 10,
  },
  reason: {
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 2,
  },
  issueList: {
    marginBottom: spacing.sm,
  },
  section: {
    marginTop: spacing.sm,
  },
  sectionLabel: {
    fontWeight: '600',
    letterSpacing: 0.5,
    fontSize: 10,
    marginBottom: 4,
  },
  bullet: {
    marginTop: 2,
  },
  adviceLine: {
    fontStyle: 'italic',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
  button: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: '#C8FF00',
    backgroundColor: '#C8FF00',
  },
  buttonText: {
    color: colors.text.inverse,
    fontWeight: '600',
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'transparent',
  },
  secondaryButtonText: {
    color: colors.text.primary,
    fontWeight: '600',
  },
});
