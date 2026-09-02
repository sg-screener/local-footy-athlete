import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Text } from '../../components/common/Text';
import { Button, SheetDescription } from '../../components/ui';
import {
  SessionActionSheet,
  useSessionActionStep,
} from '../../components/SessionActionSheet';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import {
  GUIDED_INJURY_AREA_OPTIONS,
  GUIDED_INJURY_REGION_OPTIONS,
  GUIDED_INJURY_SEVERITY_OPTIONS,
  type GuidedInjuryFlowResult,
  type GuidedInjuryRegion,
  GUIDED_INJURY_AREA_HINT,
} from '../../utils/guidedInjuryControl';
import { explorerTestId } from '../../utils/stableTestId';
import { LfaIcon } from '../../components/icons/LfaIcon';

// ── Icons (ruling 10) ──────────────────────────────────────────────────────
// Inline stroked SVG, the house pattern (`HomeScreenV2`'s `svg` helper /
// `PlanChangeSheet`'s `glyph` helper). One recognisable shape per top-level
// region. The next body-area step is deliberately a plain text list.
/**
 * ⚠ **THE THREE REGIONS WEAR THE APP'S THREE STATUS COLOURS — Sam, 2026-08-27**:
 * *"the injury one - needs updating - they're all lime green = they should match
 * the blue orange red"*.
 *
 * All three were `colors.accent.lime`, so this was the only status sheet whose
 * rows carried no colour of their own — the Fatigue sheet reads blue → amber →
 * red down its list, the Sick sheet the same, and Injury read lime, lime, lime.
 * These are the SAME three hexes those sheets use, not a fourth palette.
 *
 * The colour is an ORDER, not a severity: a back problem is not worse than a
 * shoulder one. It runs down the list the way the other two sheets do, so the
 * athlete reads three sheets with one visual grammar.
 */
const REGION_COLOR: Record<GuidedInjuryRegion, string> = {
  upper_body: '#67D7FF',
  lower_body: '#FFC247',
  back_midline: '#FF7F7F',
};
/** Upper body — the simple bicep mark used elsewhere in the app. */
const upperBodyIcon = (color: string) => <LfaIcon name="flexed-arm" color={color} />;
/** Lower body — a dedicated legs mark. */
const lowerBodyIcon = (color: string) => <LfaIcon name="lower-body" color={color} />;
/** Back / midline — the shared curved spine mark. */
const backMidlineIcon = (color: string) => <LfaIcon name="spine" color={color} />;
/* The `Other` region — a question-mark glyph, and the `glyph()` helper drawn
 * only for it — went with the row on 2026-08-21 (Sam). Three regions, three
 * authored marks, and no shape standing in for "somewhere else". */
const REGION_ICON: Record<GuidedInjuryRegion, (color: string) => React.ReactNode> = {
  upper_body: upperBodyIcon,
  lower_body: lowerBodyIcon,
  back_midline: backMidlineIcon,
};
/**
 * Severity — ascending bars, like a signal-strength meter: N bars lit for
 * severity level N (1 of 4 mild, up to 4 of 4 "avoid"). Colour climbs the
 * same ladder the sub-copy already describes (mild -> annoying -> limiting
 * -> bad), so the glyph and the words agree.
 */
const SEVERITY_BAR_COLORS = ['#4CAF50', '#FFC247', '#FF8A4C', '#F44336'];
const severityBarsIcon = (level: number, color: string) => {
  const bars = [
    { x: 2, h: 6 }, { x: 8, h: 10 }, { x: 14, h: 14 }, { x: 20, h: 18 },
  ].slice(0, level);
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      {bars.map((bar) => (
        <Path
          key={bar.x}
          d={`M${bar.x} 22h2v-${bar.h}h-2z`}
          fill={color}
        />
      ))}
    </Svg>
  );
};
const INJURY_AREA_TEST_IDS: Record<string, string> = {
  Neck: 'neck',
  Shoulder: 'shoulder',
  Elbow: 'elbow',
  'Wrist / hand': 'wrist-hand',
  'Chest / ribs': 'chest-ribs',
  'Other upper body': 'other-upper-body',
  'Hip / groin': 'hip-groin',
  Hamstring: 'hamstring',
  Quad: 'quad',
  Knee: 'knee',
  'Calf / Achilles': 'calf-achilles',
  'Ankle / foot': 'ankle-foot',
  'Other lower body': 'other-lower-body',
  'Lower back': 'lower-back',
  'Upper back': 'upper-back',
  'Abs / side': 'abs-side',
  'Other midline': 'other-midline',
};

/* `custom_area` — the typed-area step behind the `Other` region — is GONE
 * (Sam, 2026-08-21). Every body part the app can program around is on the
 * area list, so the only answers that step could take were ones already on the
 * menu, or ones it had to refuse. */
type FlowStep =
  | 'region'
  | 'area'
  | 'pain'
  | 'stop_training'
  | 'severity';

/**
 * THE WORDS AT THE TOP OF EACH STEP, IN ONE TABLE.
 *
 * They were `<Text style={styles.title}>` literals scattered through
 * `renderStep`, which is how `area` and `region` came to share a question and
 * nothing said so. `Record` over the closed union, so a seventh step cannot be
 * added without deciding what the athlete reads at the top of it.
 */
const STEP_TITLE: Record<FlowStep, string> = {
  region: 'Where is the issue?',
  area: 'Where is the issue?',
  pain: 'What hurts?',
  stop_training: 'Stop affected training',
  severity: 'How much is it limiting you?',
};

/** The one grey line under the title. `stop_training`'s two safety paragraphs
 *  are NOT here: they are the step's own copy, not a description of it. */
const STEP_SUBTITLE: Record<FlowStep, string | null> = {
  region: null,
  /* SAM'S WORDS, from the 2026-07-30 ruling — and now the ONLY thing the
     athlete whose exact area is not listed is told, since the `Other` escape
     hatch was removed on 2026-08-21. It has to carry that weight alone, which
     is why it stays on the step rather than becoming a one-off refusal. */
  area: GUIDED_INJURY_AREA_HINT,
  pain: 'Optional. Report a movement that hurts; your severity answer still follows.',
  stop_training: null,
  severity: null,
};

interface GuidedInjuryFlowSheetProps {
  visible: boolean;
  onClose: () => void;
  onComplete: (result: GuidedInjuryFlowResult) => void | Promise<void>;
  initial?: Partial<GuidedInjuryFlowResult>;
  titlePrefix?: string;
  episodeId?: string;
}

function GuidedInjuryFlowBody({
  onComplete,
  initial,
  titlePrefix,
  episodeId,
}: Omit<GuidedInjuryFlowSheetProps, 'visible' | 'onClose'>) {
  const [step, setStep] = useState<FlowStep>('region');
  const [region, setRegion] = useState<GuidedInjuryRegion | null>(null);
  const [area, setArea] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState(GUIDED_INJURY_SEVERITY_OPTIONS[1]);
  const [preservedTriggers, setPreservedTriggers] = useState<string[]>([]);
  const [seriousSymptoms, setSeriousSymptoms] = useState(false);

  /**
   * ⚠ **THIS NO LONGER WATCHES `visible`, AND IT IS NOT A RESET ANY MORE.** The
   * shell remounts this body on every open (R-123), so "start at the first
   * step" is structural. What is left is the one job the effect always also
   * did: adopt an `initial` answer set that arrives or changes while the flow
   * is open — the Coach tab's edit of an existing episode.
   */
  useEffect(() => {
    setStep('region');
    setRegion(initial?.region ?? null);
    setArea(initial?.region ? initial.area ?? '' : '');
    setPreservedTriggers(initial?.triggers ?? []);
    setSeriousSymptoms(initial?.seriousSymptoms === true);
    const severity = GUIDED_INJURY_SEVERITY_OPTIONS.find(
      (option) => option.severityBand === initial?.severityBand,
    ) ?? GUIDED_INJURY_SEVERITY_OPTIONS[1];
    setSelectedSeverity(severity);
  }, [
    initial?.area,
    initial?.region,
    initial?.severityBand,
    initial?.triggers,
    initial?.seriousSymptoms,
  ]);

  const selectedArea = area.trim();

  const submit = (
    trainingPaused: boolean,
    severityOption = selectedSeverity,
  ) => {
    /**
     * ⚠ **THE TWO FALLBACKS THAT USED TO SIT ON THESE LINES WERE
     * `region ?? 'other'` AND `area || 'unknown'`, AND BOTH ARE GONE.**
     *
     * Neither was reachable — severity is only ever reached by tapping a region
     * and then an area — but `'unknown'` resolves to no bucket, so if anything
     * ever HAD reached it, `buildGuidedInjuryConstraint` would have THROWN in
     * the athlete's face rather than refused. A structurally impossible state
     * now stops the submit instead of inventing an answer to send onward.
     */
    if (!region || !selectedArea) return;
    void onComplete({
      region,
      area: selectedArea,
      severity: severityOption.severity,
      severityBand: severityOption.severityBand,
      adjustmentLevel: trainingPaused ? 'training_paused' : severityOption.adjustmentLevel,
      // Optional new pain and historical reports travel together through the
      // existing injury transaction; the main flow stays simple.
      triggers: preservedTriggers,
      seriousSymptoms,
    });
  };

  /**
   * ⚠ **`region` NO LONGER HAS A BACK AT ALL.** It is the flow's first step, so
   * there is nothing shallower inside this action: the old `back()` closed the
   * sheet from there, which is an exit wearing a Back label. Cancel is the exit
   * now, on every step, drawn once by the shell (R-123).
   */
  const back = () => {
    if (step === 'area') {
      setStep('region');
    } else if (step === 'stop_training') {
      setStep('severity');
    } else if (step === 'pain') {
      setStep('severity');
    } else if (step === 'severity') {
      setStep('area');
    }
  };

  useSessionActionStep({
    key: step,
    eyebrow: titlePrefix ?? 'Injury',
    title: STEP_TITLE[step],
    subtitle: STEP_SUBTITLE[step],
    onBack: step === 'region' ? undefined : back,
  });

  const renderStep = () => {
    if (step === 'region') {
      return (
        <>
          {GUIDED_INJURY_REGION_OPTIONS.map((option) => (
            <FlowOption
              key={option.id}
              testID={`injury-region-${option.id}`}
              label={option.label}
              icon={REGION_ICON[option.id](REGION_COLOR[option.id])}
              selected={region === option.id}
              onPress={() => {
                setRegion(option.id);
                setStep('area');
              }}
            />
          ))}
        </>
      );
    }

    if (step === 'area' && region) {
      return (
        <>
          {GUIDED_INJURY_AREA_OPTIONS[region].map((option) => (
            <FlowOption
              key={option}
              testID={`injury-area-${INJURY_AREA_TEST_IDS[option]}`}
              label={option}
              selected={area === option}
              onPress={() => {
                setArea(option);
                setStep('severity');
              }}
            />
          ))}
        </>
      );
    }

    if (step === 'stop_training') {
      return (
        <>
          <SheetDescription>
            This is outside normal S&amp;C adjustment. LFA can't diagnose or rehab injuries.
            Stop affected training for now and get medical or physio advice.
          </SheetDescription>
          <Text style={styles.safetyNote}>
            If you had a sudden pop, numbness/tingling, chest pain, dizziness,
            head/neck symptoms, or can't walk normally, get proper medical advice.
          </Text>
          <Button
            label="Pause affected training"
            testID={explorerTestId.injuryIngress(episodeId ? 'update' : 'set', episodeId)}
            glow={false}
            onPress={() => submit(true)}
          />
        </>
      );
    }

    if (step === 'pain') {
      return (
        <>
          {['Pressing', 'Pulling', 'Squatting', 'Lunging', 'Hinging', 'Jumping', 'Carrying', 'Running', 'Cycling', 'Rowing', 'SkiErg'].map((movement) => (
            <FlowOption
              key={movement}
              testID={`injury-pain-${movement.toLowerCase()}`}
              label={movement}
              sub={initial?.triggers?.includes(movement) ? 'Previously reported — kept until this injury is resolved.' : undefined}
              disabled={initial?.triggers?.includes(movement)}
              selected={preservedTriggers.includes(movement)}
              onPress={() => setPreservedTriggers(current => initial?.triggers?.includes(movement)
                ? current : current.includes(movement) ? current.filter(value => value !== movement) : [...current, movement])}
            />
          ))}
        </>
      );
    }

    if (step === 'severity') {
      return (
        <>
          {GUIDED_INJURY_SEVERITY_OPTIONS.map((option, index) => (
            <FlowOption
              key={option.label}
              testID={`injury-severity-${option.severityBand}`}
              label={option.label}
              sub={option.sub}
              icon={severityBarsIcon(index + 1, SEVERITY_BAR_COLORS[index])}
              onPress={() => {
                setSelectedSeverity(option);
                if (option.adjustmentLevel === 'training_paused' || seriousSymptoms) {
                  setStep('stop_training');
                } else {
                  submit(false, option);
                }
              }}
            />
          ))}
          <FlowOption testID="injury-optional-pain" label="Add a painful movement (optional)"
            sub={preservedTriggers.length ? preservedTriggers.join(', ') : undefined}
            onPress={() => setStep('pain')} />
          <FlowOption testID="injury-serious-symptoms" label="Serious symptoms or trouble moving"
            sub={seriousSymptoms ? 'Reported. Choose your pain score above; training will be paused.'
              : 'Pop, numbness/tingling, chest pain, dizziness, head/neck symptoms, or unable to walk normally.'}
            selected={seriousSymptoms}
            disabled={initial?.seriousSymptoms === true}
            onPress={() => setSeriousSymptoms(current => initial?.seriousSymptoms === true || !current)} />
        </>
      );
    }

    return null;
  };

  return <>{renderStep()}</>;
}

/**
 * R-123 — THE CHROME BELONGS TO `SessionActionSheet`, THE QUESTIONS BELONG HERE.
 *
 * ⚠ **THIS FLOW IS ALSO THE DAY SCREEN'S "Injured" DOOR, the quick-action
 * sheet's and the Coach tab's.** There is one guided injury flow, so all four
 * entry points get the shared shell. Building a session-only copy to keep the
 * other three on the old chrome would be the duplication the ruling exists to
 * remove.
 */
export function GuidedInjuryFlowSheet({
  visible,
  onClose,
  onComplete,
  initial,
  titlePrefix,
  episodeId,
}: GuidedInjuryFlowSheetProps) {
  return (
    <SessionActionSheet
      visible={visible}
      onClose={onClose}
      testID={episodeId
        ? explorerTestId.injuryDetail(episodeId)
        : 'guided-injury-flow-sheet'}
    >
      <GuidedInjuryFlowBody
        onComplete={onComplete}
        initial={initial}
        titlePrefix={titlePrefix}
        episodeId={episodeId}
      />
    </SessionActionSheet>
  );
}

/**
 * Shared region/area/severity row. Top-level regions and severity choices can
 * carry the same 38x38 icon chip used by neighbouring sheets; body-area rows
 * intentionally omit it and render as a clean text list.
 */
function FlowOption({
  testID,
  label,
  sub,
  icon,
  selected,
  danger,
  onPress,
  disabled,
}: {
  testID?: string;
  label: string;
  sub?: string;
  icon?: React.ReactNode;
  selected?: boolean;
  danger?: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ disabled: !!disabled, selected: !!selected }}
      testID={testID}
      accessibilityRole="button"
      /* R-109 (Sam, 2026-08-20): *"fix the six accessibility labels so athletes hear
         exercise names, not internal IDs."* The row is ONE accessibility leaf
         (`accessibilityRole="button"`), so its label is the whole of what a
         screen-reader user hears — and it was the test id.
         ⚠ **THE IDENTITY IS NOT LOST: `testID` still sets
         `accessibilityIdentifier`, which is what Maestro's `id:` and the
         explorer match on.** Only the SPOKEN name changes. */
      accessibilityLabel={label}
      style={({ pressed }) => [
        icon ? styles.optionWithIcon : styles.option,
        selected && styles.optionSelected,
        pressed && { opacity: 0.72 },
      ]}
    >
      {icon ? (
        <View style={[styles.optionIcon, selected && styles.optionIconSelected]}>
          {icon}
        </View>
      ) : null}
      <View style={icon ? { flex: 1 } : undefined}>
        <Text style={[styles.optionLabel, danger && styles.optionDanger]}>
          {label}
        </Text>
        {sub ? <Text style={styles.optionSub}>{sub}</Text> : null}
      </View>
    </Pressable>
  );
}

/* `prefix`, `title`, `back`, `backText` and `secondaryButton` went with the
 * chrome they styled — the shell draws the eyebrow, the title, Back and Cancel
 * for all five actions now (R-123). */
const styles = StyleSheet.create({
  safetyNote: {
    color: colors.status.warning,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  option: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  optionWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  optionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#222222',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  optionIconSelected: {
    backgroundColor: 'rgba(216,216,0,0.12)',
  },
  optionSelected: {
    borderBottomColor: 'rgba(216,216,0,0.35)',
  },
  optionLabel: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  optionDanger: {
    color: colors.status.warning,
  },
  optionSub: {
    color: colors.text.secondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  /* `input` — the typed-area field's box — went with the step it styled
   * (Sam, 2026-08-21). This sheet has no text field left. */
});
