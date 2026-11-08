import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import type { GameEvent } from '../game/controller';
import { getState } from './store';

const SOURCES = {
  tick: require('../../assets/sfx/tick.wav'),
  pop: require('../../assets/sfx/pop.wav'),
  boing: require('../../assets/sfx/boing.wav'),
  whoosh: require('../../assets/sfx/whoosh.wav'),
  portal: require('../../assets/sfx/portal.wav'),
  ding: require('../../assets/sfx/ding.wav'),
  win: require('../../assets/sfx/win.wav'),
  lose: require('../../assets/sfx/lose.wav'),
} as const;
export type SoundName = keyof typeof SOURCES;

const pools: Partial<Record<SoundName, AudioPlayer[]>> = {};

/** Plays a short effect; players are created lazily and pooled so rapid bounces can overlap. */
export function playSound(name: SoundName, volume = 1): void {
  if (!getState().sound) return;
  try {
    let pool = pools[name];
    if (!pool) {
      pool = [createAudioPlayer(SOURCES[name]), createAudioPlayer(SOURCES[name])];
      pools[name] = pool;
    }
    const p = pool.find((x) => !x.playing) ?? pool[0];
    p.volume = Math.max(0, Math.min(1, volume));
    void p.seekTo(0);
    p.play();
  } catch { /* audio is garnish: never crash the game */ }
}

type Impact = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'select';
export function haptic(kind: Impact): void {
  if (!getState().haptics) return;
  try {
    if (kind === 'success') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (kind === 'warning') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    else if (kind === 'select') void Haptics.selectionAsync();
    else void Haptics.impactAsync(kind === 'light' ? Haptics.ImpactFeedbackStyle.Light : kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Heavy);
  } catch { /* unsupported device */ }
}

/** One mapping from game events to sound + haptics, used by both play and replay. */
export function gameFeedback(e: GameEvent, d?: { speed?: number }): void {
  switch (e) {
    case 'place': playSound('tick'); haptic('light'); break;
    case 'pickup': playSound('tick', 0.6); break;
    case 'rotate': playSound('tick', 0.35); haptic('select'); break;
    case 'start': playSound('whoosh', 0.7); haptic('medium'); break;
    case 'bounce': playSound('pop', Math.min(1, 0.3 + (d?.speed ?? 30) / 140)); break;
    case 'bumper': playSound('boing', 0.8); haptic('medium'); break;
    case 'portal': playSound('portal', 0.7); break;
    case 'goal': playSound('ding'); break;
    case 'win': playSound('win'); haptic('success'); break;
    case 'lose': playSound('lose', 0.7); haptic('warning'); break;
    case 'invalid': haptic('warning'); break;
  }
}
