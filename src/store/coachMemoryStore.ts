import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CoachNote {
  id: string;
  note: string;
  createdAt: string;
}

interface CoachMemoryState {
  notes: CoachNote[];
  addNote: (note: string) => void;
  removeNote: (id: string) => void;
  clearNotes: () => void;
}

export const useCoachMemoryStore = create<CoachMemoryState>()(
  persist(
    (set) => ({
      notes: [],

      addNote: (note: string) =>
        set((state) => ({
          notes: [
            ...state.notes,
            {
              id: Date.now().toString(),
              note,
              createdAt: new Date().toISOString(),
            },
          ],
        })),

      removeNote: (id: string) =>
        set((state) => ({
          notes: state.notes.filter((n) => n.id !== id),
        })),

      clearNotes: () => set({ notes: [] }),
    }),
    {
      name: 'coach-memory-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
