import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isOnline: true,
      activeTab: 'home',
      theme: 'dark',
      designVersion: 'classic',

      setOnline: (online) => set({ isOnline: online }),

      setActiveTab: (tab) => set({ activeTab: tab }),

      setTheme: (theme) => set({ theme }),

      setDesignVersion: (v) => set({ designVersion: v }),

      clear: () => {
        set({
          isOnline: true,
          activeTab: 'home',
          theme: 'dark',
          designVersion: 'classic',
        });
      },
    }),
    {
      name: 'ui-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
