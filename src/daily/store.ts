import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import type { KV } from '../social/kv';
import { type DailyProgress, type DailyResult, emptyProgress, parseProgress, recordSolve } from './progress';

const KEY = 'ruleshift.daily.progress.v1';
let state: { loaded: boolean; p: DailyProgress } = { loaded: false, p: emptyProgress() };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const asyncStorageKV: KV = {
  get: (k) => AsyncStorage.getItem(k),
  set: (k, v) => AsyncStorage.setItem(k, v),
};

export function useDailyProgress() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state);
}

export async function loadDailyProgress(): Promise<void> {
  try { state = { loaded: true, p: parseProgress(await AsyncStorage.getItem(KEY)) }; } catch { state = { loaded: true, p: emptyProgress() }; }
  emit();
}

export function recordDailySolve(day: number, result: DailyResult): DailyProgress {
  state = { loaded: true, p: recordSolve(state.p, day, result) };
  emit();
  AsyncStorage.setItem(KEY, JSON.stringify(state.p)).catch(() => {});
  return state.p;
}
