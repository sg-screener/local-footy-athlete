/**
 * ONE BOTTOM-SHEET SHELL FOR ALL FIVE ACTIVE-SESSION ACTIONS.
 *
 * Sam, 2026-08-20 (R-123): *"Put all five Active Session actions into one
 * shared bottom-sheet shell — Equipment, Injury, Add, Remove, Swap. The shell
 * must be the single owner of opening and closing animation, safe-area
 * spacing, title and step header, scrolling, Back behaviour, Cancel
 * behaviour, resetting state when closed, and consistent height and layout.
 * Each action must keep ownership of its own questions and behaviour."*
 *
 * ## WHAT WAS THERE BEFORE, MEASURED
 *
 * Five actions, THREE separate `Sheet` call sites, and Injury crossing two of
 * them mid-flow:
 *
 * | concern | Equipment | Injury flow | Injury review / Add / Remove / Swap |
 * | --- | --- | --- | --- |
 * | height | `flexibleBody` — a fixed 92% | auto, uncapped | auto, uncapped |
 * | scrolling | one `ScrollView` over everything | NONE — 13 trigger chips ran off the bottom | a `maxHeight: 360` list on three add levels only; `pick_exercise`, `choose_swap` and `injury_review` had none |
 * | title | local `styles.title` 22/700 | local `styles.title` 22/800 | local `exerciseEditTitle` 21/800 |
 * | Back | none (single step) | its own `BackButton`, plus a secondary `Button` labelled "Back" on one step | its own `Pressable` + `goBack` |
 * | Cancel | none | none | none — an inline "Cancel" `Button` on two steps |
 * | closing animation | fades (stays mounted) | fades (stays mounted) | SNAPS — the component returned `null` |
 * | reset on close | its own `useEffect(visible)` | its own `useEffect(visible)` | the screen re-seeds the step |
 * | safe area | `Sheet`'s hard-coded `paddingBottom: 40` | same | overridden to 36 |
 *
 * ⚠ **THE INCREMENTAL ALTERNATIVE WAS CONSIDERED AND REJECTED.** Adding the
 * missing pieces where they were missing — a `ScrollView` to the injury flow, a
 * Back to Equipment, a Cancel to each — leaves EIGHT owners of eight decisions
 * and guarantees the next action drifts again, which is precisely how the table
 * above came to have three answers in every row. The shell is not a wrapper
 * around three sheets; it is the only thing that renders a `Sheet` for a
 * session action, and there is a gate on that.
 *
 * ## HOW A STEP REACHES THE SHELL
 *
 * The header must come from wherever the step state lives, and the step state
 * has to live INSIDE the shell for the shell to be able to reset it. So the
 * body publishes its header up rather than the shell taking it down as a prop:
 *
 *   function InjuryBody() {
 *     const [step, setStep] = useState('region');
 *     useSessionActionStep({ key: step, title: '…', onBack: … });
 *     return …;
 *   }
 *
 * `onBack` UNDEFINED MEANS THIS STEP IS A FIRST STEP — the shell then draws no
 * Back at all rather than one that closes the sheet. A Back that exits is not
 * "up one step", and this app already has a no-dead-buttons rule for exactly
 * this shape (`SessionChangeHub`).
 *
 * WRITER: the five action bodies. READER: the athlete.
 * TEST: `test:session-action-shell`.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Sheet, SheetDescription, SheetHeader } from './ui';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

export interface SessionActionStep {
  /**
   * THE STEP'S OWN IDENTITY, AND IT IS WHAT PUTS THE LIST BACK AT THE TOP.
   *
   * The shell renders ONE `ScrollView` in ONE position of the tree for every
   * step, so React reuses the instance across a step change and it keeps its
   * scroll offset. Measured on the simulator while the Add hierarchy was being
   * built (2026-08-20): scroll a heading list down, tap a row, and the next
   * level opens ALREADY SCROLLED, with its first rows above the fold reading as
   * absent. Keying by this remounts it, so every step opens at its first row.
   */
  key: string;
  title: string;
  subtitle?: string | null;
  /** The small uppercase line above the title — Injury's "Injury / pain". */
  eyebrow?: string | null;
  /**
   * Where Back goes. **UNDEFINED = there is nothing shallower inside this
   * action**, and the shell draws no Back button. Cancel is the exit.
   */
  onBack?: () => void;
  /**
   * THE EXIT'S WORD. Defaults to `Cancel`, which is the truth on a question:
   * nothing has been applied and closing applies nothing. It is `Close` on the
   * steps that come AFTER a change has landed — the removal-scope question, the
   * future-scope question and the two outcome screens — because "Cancel" there
   * would promise an undo the button does not do. (Undo is `UndoToast`'s, on
   * the screen behind, and it is untouched.)
   */
  cancelLabel?: string;
}

interface PublishedStep {
  epoch: number;
  key: string;
  title: string;
  subtitle: string | null;
  eyebrow: string | null;
  canGoBack: boolean;
  cancelLabel: string;
}

interface ShellChannel {
  epoch: number;
  publish: (step: PublishedStep) => void;
  backRef: React.MutableRefObject<(() => void) | null>;
}

const ShellContext = React.createContext<ShellChannel | null>(null);

/**
 * Declare the current step to the shell. Call it once, unconditionally, at the
 * top of a body component — it is a hook, so it may not sit inside a branch.
 */
export function useSessionActionStep(step: SessionActionStep): void {
  const channel = React.useContext(ShellContext);
  if (!channel) {
    throw new Error(
      'useSessionActionStep must be called inside a <SessionActionSheet>. '
      + 'A session action that renders its own Sheet is the thing R-123 removed.',
    );
  }
  const { epoch, publish, backRef } = channel;
  const { key, title, onBack } = step;
  const subtitle = step.subtitle ?? null;
  const eyebrow = step.eyebrow ?? null;
  const canGoBack = Boolean(onBack);
  const cancelLabel = step.cancelLabel ?? 'Cancel';

  /**
   * ⚠ **THE HANDLER GOES IN A REF, THE DESCRIPTION GOES IN STATE.** A body
   * rebuilds its `onBack` closure on every render, so publishing the function
   * itself would re-run this effect forever. What the shell needs to DRAW is
   * five primitives; what it needs to CALL is whatever the latest render made.
   */
  React.useLayoutEffect(() => {
    backRef.current = onBack ?? null;
  });

  React.useLayoutEffect(() => {
    publish({ epoch, key, title, subtitle, eyebrow, canGoBack, cancelLabel });
  }, [publish, epoch, key, title, subtitle, eyebrow, canGoBack, cancelLabel]);
}

/**
 * THE CHROME'S OWN NAMES — FIXED LITERALS, NOT `` `${testID}-back` ``.
 *
 * ⚠ **A TEMPLATE THAT STARTS WITH A HOLE NAMES NOTHING**, and this repo has a
 * gate that says so: `test:maestro-element-contract` refuses to build a pattern
 * from a template with no fixed head, so a flow tapping `exercise-edit-sheet-back`
 * would be reported as an id no product source can produce. It is right to. One
 * shell means one Back and one Cancel — there is never a second sheet open
 * behind the first — so they get one name each, and a walk can say
 * "no Back is drawn here" about the shell rather than about a string it built.
 */
export const SESSION_ACTION_BACK_TEST_ID = 'session-action-back';
export const SESSION_ACTION_CANCEL_TEST_ID = 'session-action-cancel';
export const SESSION_ACTION_TITLE_TEST_ID = 'session-action-title';
export const SESSION_ACTION_BODY_TEST_ID = 'session-action-body';

export interface SessionActionSheetProps {
  visible: boolean;
  /**
   * CANCEL, THE BACKDROP AND THE HARDWARE BACK ALL ARRIVE HERE, and none of
   * them may apply anything. The shell offers no other way out, so an action
   * whose close has to do something (`future_scope` keeps "today only") passes
   * that work in here rather than hanging it off a second affordance.
   */
  onClose: () => void;
  children: React.ReactNode;
  testID: string;
  /** Overridden only where a door's spoken name differs from "Cancel". */
  cancelAccessibilityLabel?: string;
}

export function SessionActionSheet({
  visible,
  onClose,
  children,
  testID,
  cancelAccessibilityLabel,
}: SessionActionSheetProps) {
  const insets = useSafeAreaInsets();
  const [header, setHeader] = React.useState<PublishedStep | null>(null);
  const backRef = React.useRef<(() => void) | null>(null);

  /**
   * ⚠ **RESETTING STATE WHEN CLOSED IS STRUCTURAL HERE, NOT A PER-ACTION
   * EFFECT.** Every open mints a new epoch, and the epoch keys the body's
   * wrapper — so React unmounts the whole subtree and mounts it again, and
   * every `useState` inside it is born fresh. Equipment's tick set and the
   * injury flow's five answers each used to reset themselves in their own
   * `useEffect(…, [visible])`; two implementations of one rule is how the
   * third action (Add/Remove/Swap, reset by the SCREEN) came to be reset
   * somewhere else again.
   */
  const [epoch, setEpoch] = React.useState(0);
  const wasVisible = React.useRef(false);
  React.useEffect(() => {
    if (visible && !wasVisible.current) setEpoch((current) => current + 1);
    wasVisible.current = visible;
  }, [visible]);

  const publish = React.useCallback((next: PublishedStep) => {
    setHeader((current) => (current
      && current.epoch === next.epoch
      && current.key === next.key
      && current.title === next.title
      && current.subtitle === next.subtitle
      && current.eyebrow === next.eyebrow
      && current.canGoBack === next.canGoBack
      && current.cancelLabel === next.cancelLabel
      ? current
      : next));
  }, []);

  const channel = React.useMemo<ShellChannel>(
    () => ({ epoch, publish, backRef }),
    [epoch, publish],
  );

  /**
   * ⚠ **THE STEP CHANGE SCROLLS THE LIST BACK TO THE TOP; IT MUST NOT REMOUNT
   * IT.** Keying the `ScrollView` by the step is the obvious way to reset the
   * offset, and it is WRONG here: the body renders inside that scroll view, and
   * the injury flow keeps its own current step in `useState` inside the body.
   * Remounting on a step change would throw that state away and the flow could
   * never leave its first question. (The add levels survive it, because their
   * step lives on the screen — which is exactly the kind of difference that
   * makes a shared shell worth having a rule about.) The offset is reset by
   * hand instead, which touches the scroll view and nothing else.
   *
   * `useLayoutEffect`, not `useEffect`: the reset must land before the frame is
   * shown, or the athlete sees the new list at the old offset first.
   */
  const scrollRef = React.useRef<ScrollView>(null);
  const stepKey = header?.key;
  React.useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [stepKey]);

  /**
   * A header from a PREVIOUS open is not this open's header. It is still drawn
   * while the sheet fades out (the epoch does not change on the way out, so the
   * athlete does not watch the title vanish first), and it is dropped the
   * instant a new open begins.
   */
  const step = header && header.epoch === epoch ? header : null;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      testID={testID}
      /* HUG THE CONTENT, STOP AT 92%. A named mode on the primitive, not a
       * `maxHeight` this file invents — three callers had each invented their
       * own, which is the drift R-123 is about. */
      cappedBody
      contentStyle={
        /* Safe area, once, for all five. `Sheet`'s own 40pt was a guess that
         * predates this and each caller had started overriding it. */
        { paddingBottom: Math.max(insets.bottom, spacing.sm) + spacing.md }
      }
    >
      {/* ── THE CHROME ROW: Back on the left, Cancel on the right ──────────
        * Fixed height whether or not Back is drawn, so a step with nowhere
        * shallower to go does not sit 20pt higher than the step before it. */}
      <View style={styles.chrome}>
        {step?.canGoBack ? (
          <Pressable
            onPress={() => backRef.current?.()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            testID={SESSION_ACTION_BACK_TEST_ID}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => [styles.chromeButton, pressed && styles.pressed]}
          >
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        ) : (
          <View style={styles.chromeButton} />
        )}
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={cancelAccessibilityLabel ?? step?.cancelLabel ?? 'Cancel'}
          testID={SESSION_ACTION_CANCEL_TEST_ID}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={({ pressed }) => [styles.chromeButton, pressed && styles.pressed]}
        >
          <Text style={styles.cancelText}>{step?.cancelLabel ?? 'Cancel'}</Text>
        </Pressable>
      </View>

      <SheetHeader
        title={step?.eyebrow ?? 'Session'}
        subtitle={step?.title ?? ''}
        subtitleTestID={SESSION_ACTION_TITLE_TEST_ID}
      />
      {step?.subtitle ? <SheetDescription>{step.subtitle}</SheetDescription> : null}

      {/* ── THE ONE SCROLL OWNER ───────────────────────────────────────────
        * ⚠ **`flexShrink: 1`, NOT `flex: 1`.** The sheet HUGS its content up to
        * `maxHeight` — a short confirm must not open as a 92%-tall sheet with
        * two lines in it. `flex: 1` is `flexBasis: 0`, which inside a hugging
        * parent has no definite free space to grow into and resolves to ZERO
        * height: the sliver-sheet defect recorded in `ui/Sheet`. A shrinkable
        * child with an AUTO basis measures its content first and then gives
        * space back when the cap binds, which is the behaviour this needs. */}
      <ScrollView
        ref={scrollRef}
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        testID={SESSION_ACTION_BODY_TEST_ID}
      >
        <View key={epoch}>
          <ShellContext.Provider value={channel}>{children}</ShellContext.Provider>
        </View>
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  chrome: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 24,
    marginBottom: spacing.xs,
  },
  chromeButton: { paddingVertical: 4, minWidth: 52 },
  pressed: { opacity: 0.72 },
  backText: {
    color: colors.accent.lime,
    fontSize: 13,
    fontWeight: '700',
  },
  cancelText: {
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  body: { flexShrink: 1 },
  bodyContent: { paddingBottom: spacing.xs },
});
