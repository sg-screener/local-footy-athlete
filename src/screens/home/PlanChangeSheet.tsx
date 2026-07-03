import React, { useMemo, useState, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../components/common/Text';
import { Button, Sheet } from '../../components/ui';
import { useProgramStore } from '../../store';
import { todayISOLocal } from '../../utils/appDate';
import type { ResolvedDay } from '../../utils/sessionResolver';
import {
  applyPlanChange,
  listPlanChangeOptionsForDay,
  planChangeWarningForCategory,
  type PlanChange,
  type PlanChangeBinScopeId,
  type PlanChangeCategoryId,
  type PlanChangeDayOptions,
} from '../../utils/planChangeProducer';

/**
 * PlanChangeSheet — the tap-first change door (ATHLETE_CHANGE_VOCABULARY.md
 * group 1, Phase 1).
 *
 * The athlete tapped a day, so there is no date ambiguity; they pick an
 * action, so there is no intent ambiguity; and the menu only lists options
 * the shared policy validates (bye gating, edit horizon, rest-day move
 * destinations), so nothing offered can be refused downstream. Changes
 * apply deterministically through the same writer as the chat coach —
 * no LLM in this path.
 *
 * "Something else" folds the chat coach in as the layered escape hatch
 * (signed-off decision 4): it hands a day-scoped prefill to the Coach tab.
 */

type Step =
  | { kind: 'menu' }
  | { kind: 'pick_category'; mode: 'swap' | 'add' }
  | { kind: 'pick_conditioning'; mode: 'swap' | 'add' }
  | {
      kind: 'confirm_warning';
      mode: 'swap' | 'add';
      category: PlanChangeCategoryId;
      message: string;
    }
  | { kind: 'pick_destination' }
  | { kind: 'pick_bin_scope' }
  | { kind: 'confirm_remove'; scope: PlanChangeBinScopeId; label: string }
  | { kind: 'result'; ok: boolean; message: string };

interface PlanChangeSheetProps {
  visible: boolean;
  date: string | null;
  weekDays: ResolvedDay[];
  onClose: () => void;
  onAskCoach: (prefill: string) => void;
}

function weekdayLabel(dateISO: string): string {
  const day = new Date(`${dateISO}T12:00:00`);
  return day.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' });
}

export function PlanChangeSheet({
  visible, date, weekDays, onClose, onAskCoach,
}: PlanChangeSheetProps) {
  const [step, setStep] = useState<Step>({ kind: 'menu' });

  // Fresh menu every time the sheet opens for a (new) day.
  useEffect(() => {
    if (visible) setStep({ kind: 'menu' });
  }, [visible, date]);

  const todayISO = todayISOLocal();
  const options: PlanChangeDayOptions | null = useMemo(() => {
    if (!visible || !date) return null;
    return listPlanChangeOptionsForDay({ visibleWeek: weekDays, date, todayISO });
  }, [visible, date, weekDays, todayISO]);

  if (!date) return null;

  const apply = (change: PlanChange, opts?: { closeOnSuccess?: boolean }) => {
    const result = applyPlanChange({
      change,
      visibleWeek: weekDays,
      todayISO,
      setManualOverride: (overrideDate, workout, context) =>
        useProgramStore.getState().setManualOverride(overrideDate, workout, context),
    });
    if (result.ok && opts?.closeOnSuccess) {
      // Destructive flows (bin) skip the result screen: the change is
      // already confirmed, so close straight back to the weekly plan.
      // The host's onClose handles any needed navigation (e.g. the
      // session screen goBacks when its workout no longer exists).
      onClose();
      return;
    }
    setStep({ kind: 'result', ok: result.ok, message: result.message });
  };

  const applyCategory = (mode: 'swap' | 'add', category: PlanChangeCategoryId) =>
    apply(
      mode === 'swap'
        ? { kind: 'swap_category', date, category }
        : { kind: 'add_category', date, category },
    );

  // Athlete override principle: nothing is blocked, but the coach gets a
  // word in first. If the producer flags this pick (hard session on a game
  // week / already a heavy week), route through a warning step.
  const chooseCategory = (mode: 'swap' | 'add', category: PlanChangeCategoryId) => {
    const warning = planChangeWarningForCategory({
      category,
      date,
      visibleWeek: weekDays,
    });
    if (warning) {
      setStep({ kind: 'confirm_warning', mode, category, message: warning.message });
      return;
    }
    applyCategory(mode, category);
  };

  // Bin entry point: multi-session days pick WHICH part first; single-part
  // days go straight to the are-you-sure.
  const startBin = () => {
    const scopes = options?.binScopes ?? [];
    if (scopes.length > 1) {
      setStep({ kind: 'pick_bin_scope' });
      return;
    }
    setStep({ kind: 'confirm_remove', scope: 'whole_day', label: 'this session' });
  };

  const askCoach = () => {
    onClose();
    onAskCoach(`About ${weekdayLabel(date)}: `);
  };

  return (
    <Sheet visible={visible} onClose={onClose} testID="plan-change-sheet">
      <Text style={styles.title}>{weekdayLabel(date)}</Text>

      {options?.locked === 'outside_horizon' && (
        <Text style={styles.lockedText}>
          This week is view-only for now — the plan firms up closer to the
          date, just like a real coach programs it.
        </Text>
      )}
      {(options?.locked === 'game_day' || options?.locked === 'not_visible') && (
        <Text style={styles.lockedText}>
          Nothing to change here right now.
        </Text>
      )}

      {options && options.locked === null && step.kind === 'menu' && (
        <View>
          {options.hasSession ? (
            <>
              <MenuOption
                label="Swap this session"
                sub="Conditioning, recovery or rest — we pick the session"
                onPress={() => setStep({ kind: 'pick_category', mode: 'swap' })}
              />
              {options.addOnTopCategories.length > 0 && (
                <MenuOption
                  label="Add to this day"
                  sub="Stack conditioning on top of this session"
                  onPress={() => setStep({ kind: 'pick_category', mode: 'add' })}
                />
              )}
              {options.moveDestinations.length > 0 && (
                <MenuOption
                  label="Move it to another day"
                  sub="Shift the whole session"
                  onPress={() => setStep({ kind: 'pick_destination' })}
                />
              )}
              <MenuOption
                label="Bin this session"
                sub={(options.binScopes.length > 1)
                  ? 'Remove part of the day, or all of it'
                  : 'Remove it — the day becomes rest'}
                danger
                onPress={startBin}
              />
            </>
          ) : (
            <MenuOption
              label="Add a session"
              sub="Conditioning or recovery for this day"
              onPress={() => setStep({ kind: 'pick_category', mode: 'add' })}
            />
          )}
          <MenuOption
            label="Something else — ask the coach"
            sub="Injury, fatigue, or anything the menu doesn't cover"
            onPress={askCoach}
          />
        </View>
      )}

      {/* Russian dolls level 1: what KIND of session. The athlete picks a
          category; the producer deterministically picks the session
          (sheet v2 — Strength and Sprint arrive in later phases).
          Add mode on an OCCUPIED day is restricted to what the producer
          says can stack (conditioning only). */}
      {options && step.kind === 'pick_category' && (() => {
        const stepCategories =
          step.mode === 'add' && options.hasSession
            ? options.addOnTopCategories
            : options.categories;
        return (
        <View>
          <Text style={styles.sectionLabel}>
            {step.mode === 'swap' ? 'Swap to:' : 'Add:'}
          </Text>
          {stepCategories.some((c) => c.id.startsWith('conditioning_')) && (
            <MenuOption
              label="Conditioning"
              sub="Bike, row, ski or intervals — we pick it for you"
              onPress={() => setStep({ kind: 'pick_conditioning', mode: step.mode })}
            />
          )}
          {stepCategories.filter((c) => c.id === 'recovery').map((c) => (
            <MenuOption
              key={c.id}
              label={c.label}
              sub={c.sub}
              onPress={() => chooseCategory(step.mode, c.id)}
            />
          ))}
          {step.mode === 'swap' && (
            <MenuOption
              label="Rest day"
              sub="Clear the day — same as binning the session"
              danger
              onPress={() =>
                setStep({ kind: 'confirm_remove', scope: 'whole_day', label: 'this session' })}
            />
          )}
          <BackRow onPress={() => setStep({ kind: 'menu' })} />
        </View>
        );
      })()}

      {/* Russian dolls level 2: conditioning intensity. Availability is
          policy — Hard only appears when the producer offered it (bye
          weeks); the producer picks the concrete template. */}
      {options && step.kind === 'pick_conditioning' && (
        <View>
          <Text style={styles.sectionLabel}>Conditioning:</Text>
          {(step.mode === 'add' && options.hasSession
            ? options.addOnTopCategories
            : options.categories)
            .filter((c) => c.id.startsWith('conditioning_'))
            .map((c) => (
              <MenuOption
                key={c.id}
                label={c.label}
                sub={c.sub}
                onPress={() => chooseCategory(step.mode, c.id)}
              />
            ))}
          <BackRow onPress={() => setStep({ kind: 'pick_category', mode: step.mode })} />
        </View>
      )}

      {/* Advisory warning — the athlete can always proceed; the coach just
          gets a word in first (game-week freshness / burnout volume). */}
      {step.kind === 'confirm_warning' && (
        <View>
          <Text style={styles.confirmText}>{step.message}</Text>
          <MenuOption
            label="Add it anyway — I'm good"
            onPress={() => applyCategory(step.mode, step.category)}
          />
          <BackRow
            onPress={() => setStep({ kind: 'pick_conditioning', mode: step.mode })}
          />
        </View>
      )}

      {options && step.kind === 'pick_destination' && (
        <View>
          <Text style={styles.sectionLabel}>Move to:</Text>
          {options.moveDestinations.map((destination) => (
            <MenuOption
              key={destination.date}
              label={weekdayLabel(destination.date)}
              sub={destination.occupiedBy
                ? `Swap with ${destination.occupiedBy}`
                : 'Currently a rest day'}
              onPress={() =>
                apply({ kind: 'move_session', fromDate: date, toDate: destination.date })}
            />
          ))}
          <BackRow onPress={() => setStep({ kind: 'menu' })} />
        </View>
      )}

      {/* Multi-session days: pick WHICH part to bin before the
          are-you-sure. Options come from the producer (single owner of
          what's individually binnable on this day). */}
      {options && step.kind === 'pick_bin_scope' && (
        <View>
          <Text style={styles.sectionLabel}>Bin what?</Text>
          {options.binScopes.map((scope) => (
            <MenuOption
              key={scope.id}
              label={scope.label}
              sub={scope.sub}
              danger={scope.id === 'whole_day'}
              onPress={() =>
                setStep({
                  kind: 'confirm_remove',
                  scope: scope.id,
                  label: scope.id === 'whole_day'
                    ? 'everything on this day'
                    : scope.label.toLowerCase(),
                })}
            />
          ))}
          <BackRow onPress={() => setStep({ kind: 'menu' })} />
        </View>
      )}

      {step.kind === 'confirm_remove' && (
        <View>
          <Text style={styles.confirmText}>
            {step.scope === 'whole_day'
              ? 'Are you sure? This will be removed and the day becomes rest.'
              : `Are you sure? This bins ${step.label} — the rest of the day stays.`}
          </Text>
          <MenuOption
            label="Yes, bin it"
            danger
            onPress={() =>
              apply(
                { kind: 'remove_session', date, scope: step.scope },
                { closeOnSuccess: true },
              )}
          />
          <MenuOption
            label="No, keep it"
            onPress={() => setStep({ kind: 'menu' })}
          />
        </View>
      )}

      {step.kind === 'result' && (
        <View>
          <Text style={step.ok ? styles.resultOk : styles.resultBad}>
            {step.message}
          </Text>
          <Button label="Done" size="lg" glow={false} onPress={onClose} />
        </View>
      )}
    </Sheet>
  );
}

function MenuOption({ label, sub, danger, onPress }: {
  label: string;
  sub?: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.option, pressed && { opacity: 0.7 }]}
    >
      <Text style={[styles.optionLabel, danger && styles.optionDanger]}>{label}</Text>
      {sub ? <Text style={styles.optionSub} numberOfLines={2}>{sub}</Text> : null}
    </Pressable>
  );
}

function BackRow({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.back, pressed && { opacity: 0.7 }]}>
      <Text style={styles.backText}>‹ Back</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 8,
  },
  confirmText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 20,
    marginBottom: 8,
  },
  lockedText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 20,
    marginBottom: 8,
  },
  option: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  optionDanger: {
    color: '#F44336',
  },
  optionSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  back: {
    paddingVertical: 14,
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#C8FF00',
  },
  resultOk: {
    fontSize: 15,
    color: '#C8FF00',
    lineHeight: 21,
    marginBottom: 16,
  },
  resultBad: {
    fontSize: 15,
    color: '#F44336',
    lineHeight: 21,
    marginBottom: 16,
  },
});
