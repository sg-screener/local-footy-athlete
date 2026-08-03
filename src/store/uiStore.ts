import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { asyncStorageCompat } from './asyncStorageCompat';
import {
  decideQuarantinedWrite,
  registerQuarantineBoundary,
  releaseQuarantine,
} from './refusedPayloadQuarantine';
import {
  beginAthleteActionTrace,
  emitAthleteActionEvent,
} from '../utils/athleteActionDiagnostics';
import { logger } from '../utils/logger';

type Theme = 'dark' | 'light';

/**
 * Runtime toggle between the classic Home experience and the V2 redesign.
 * Lives in `uiStore` so it's persisted across launches alongside the other
 * UI prefs. Flip via the Profile "Experimental" toggle.
 *
 * - 'classic' : the original HomeScreen render (pixel-identical to today)
 * - 'v2'      : the redesigned Home screen built on components/ui/ primitives
 *
 * Logic, stores, engine, data all remain identical between versions;
 * this flag only gates the presentation layer.
 */
export type DesignVersion = 'classic' | 'v2';

/**
 * ARMOURED 2026-08-03 (`docs/STORE_ARMOUR_RECIPE_2026-08-03.md`, fleet tail) —
 * with the honest MINIMUM, decided rather than defaulted:
 *
 * This store is PRESENTATION ONLY. Nothing in it is an athlete answer: `theme`
 * and `designVersion` are chosen settings a lost copy of which costs one tap
 * to restore; `activeTab` and `isOnline` are runtime convenience. So the door
 * (`applyUiSettingsWrite`) owns the durable chosen-settings slice and names
 * its writers on the tape, but it has NO wipe refusal — refusing a write of
 * the defaults here would refuse the athlete's own resets to protect state
 * that strands nobody. With no refusal path, the registered quarantine
 * boundary can never arm; it is declared anyway so the L12 audit enumerates
 * this store instead of excusing it, and so any future material field
 * inherits the machinery instead of the wipe.
 *
 * `activeTab`/`isOnline` stay outside the door and OFF the tape deliberately:
 * a tab switch on every navigation would flood the 200-entry ring with
 * non-decisions (export 6's lesson, from the other direction).
 */
interface UIState {
  isOnline: boolean;
  activeTab: string;
  theme: Theme;
  designVersion: DesignVersion;
  setOnline: (online: boolean) => void;
  setActiveTab: (tab: string) => void;
  setTheme: (theme: Theme) => void;
  setDesignVersion: (v: DesignVersion) => void;
  clear: () => void;
}

/** The durable chosen-settings slice — what the door owns. */
export interface UiSettingsSlice {
  theme: Theme;
  designVersion: DesignVersion;
}

/** The store's built-in defaults, exported for comparison. */
export const INITIAL_UI_SETTINGS: UiSettingsSlice = {
  theme: 'dark',
  designVersion: 'classic',
};

export const UI_STORE_PERSISTENCE_KEY = 'ui-store';

/**
 * THE STORE'S WRITER BOUNDARY, declared once. A payload "carries material"
 * when a non-default chosen setting survives in it — the most this store can
 * lose. See the armour note above: with no refusal path in the door, nothing
 * can arm this hold today; the declaration exists for the audit's enumeration
 * and for whatever this store grows next.
 */
registerQuarantineBoundary(UI_STORE_PERSISTENCE_KEY, {
  carriesMaterial: (envelope) => {
    try {
      const state = (JSON.parse(envelope) as { state?: {
        theme?: Theme;
        designVersion?: DesignVersion;
      } }).state;
      if (!state) return false;
      return (state.theme !== undefined && state.theme !== INITIAL_UI_SETTINGS.theme)
        || (state.designVersion !== undefined
          && state.designVersion !== INITIAL_UI_SETTINGS.designVersion);
    } catch {
      return false;
    }
  },
});

/**
 * The single persistence writer, asking the law's one question before every
 * write. Inert until a hold exists (and no refusal can create one today) —
 * wired anyway so the boundary is real at the writer, not a registry entry.
 */
export const uiGuardedStorage = {
  getItem: (name: string): Promise<string | null> => asyncStorageCompat.getItem(name),
  setItem: async (name: string, value: string): Promise<void> => {
    const decision = decideQuarantinedWrite(name, value);
    if (!decision.allowed) {
      logger.error('[uiStore] refused to persist over a quarantined payload.',
        { store: name, reason: decision.reason });
      return;
    }
    releaseQuarantine(name);
    await asyncStorageCompat.setItem(name, value);
  },
  removeItem: (name: string): Promise<void> => asyncStorageCompat.removeItem(name),
};

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isOnline: true,
      activeTab: 'home',
      theme: 'dark',
      designVersion: 'classic',

      // Runtime convenience — outside the door, off the tape (see above).
      setOnline: (online) => set({ isOnline: online }),

      setActiveTab: (tab) => set({ activeTab: tab }),

      // Chosen settings — through the door, named on the tape.
      setTheme: (theme) => {
        applyUiSettingsWrite({
          next: { ...currentUiSettings(), theme },
          writer: 'settings_control',
        });
      },

      setDesignVersion: (v) => {
        applyUiSettingsWrite({
          next: { ...currentUiSettings(), designVersion: v },
          writer: 'settings_control',
        });
      },

      clear: () => {
        applyUiSettingsWrite({
          next: INITIAL_UI_SETTINGS,
          writer: 'reset',
        });
        set({ isOnline: true, activeTab: 'home' });
      },
    }),
    {
      name: UI_STORE_PERSISTENCE_KEY,
      storage: createJSONStorage(() => uiGuardedStorage),
    },
  ),
);

/* ══ THE UI SETTINGS WRITE OWNER ══
 *
 * The recipe's door, at this store's honest size: one writer boundary and a
 * named tape entry per write — and NO refusal, because nothing here is an
 * athlete answer and the built-in default is a legitimate state the athlete
 * (and the app reset) may choose at any time. The ownership suite pins that
 * absence as a decision, so a future refusal is added on purpose or not at
 * all.
 */

export type UiWriterId = 'settings_control' | 'reset' | 'dev_seed';

function currentUiSettings(): UiSettingsSlice {
  const state = useUIStore.getState();
  return { theme: state.theme, designVersion: state.designVersion };
}

export function applyUiSettingsWrite(args: {
  next: UiSettingsSlice;
  writer: UiWriterId;
}): { ok: true } {
  const before = currentUiSettings();
  useUIStore.setState({
    theme: args.next.theme,
    designVersion: args.next.designVersion,
  });
  const after = currentUiSettings();
  emitAthleteActionEvent(beginAthleteActionTrace({
    source: args.writer === 'settings_control' ? 'tap' : 'system',
    actionType: 'program_change',
    route: 'applyUiSettingsWrite',
  }, undefined, { forceRoot: true }), 'ui_store_write', {
    writer: args.writer,
    outcome: 'applied',
    // Flags only — cheap, and consistent with every other armoured tape.
    themeChanged: before.theme !== after.theme,
    designVersionChanged: before.designVersion !== after.designVersion,
    nonDefaultAfter: after.theme !== INITIAL_UI_SETTINGS.theme
      || after.designVersion !== INITIAL_UI_SETTINGS.designVersion,
  });
  return { ok: true };
}
