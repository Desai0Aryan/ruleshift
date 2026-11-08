import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

export interface AppState {
  loaded: boolean;
  solved: string[];
  sound: boolean;
  haptics: boolean;
}

const KEY = 'ruleshift.state.v1';
let state: AppState = { loaded: false, solved: [], sound: true, haptics: true };
const listeners = new Set<() => void>();

function set(patch: Partial<AppState>, persist = true) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
  if (persist) {
    const { loaded: _l, ...rest } = state;
    void _l;
    AsyncStorage.setItem(KEY, JSON.stringify(rest)).catch(() => {});
  }
}

export const getState = () => state;
export function useAppState(): AppState {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => state,
  );
}

export async function loadStore(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<AppState>;
      set({
        solved: Array.isArray(p.solved) ? p.solved.filter((x) => typeof x === 'string') : [],
        sound: p.sound !== false,
        haptics: p.haptics !== false,
        loaded: true,
      }, false);
      return;
    }
  } catch { /* corrupted or unavailable storage: start fresh */ }
  set({ loaded: true }, false);
}

export const markSolved = (id: string) => { if (!state.solved.includes(id)) set({ solved: [...state.solved, id] }); };
export const setSound = (v: boolean) => set({ sound: v });
export const setHaptics = (v: boolean) => set({ haptics: v });
export const resetProgress = () => set({ solved: [] });
