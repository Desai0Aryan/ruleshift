import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { type DailyChallenge, dayIndex, getDailyChallenge } from '../daily/daily';
import { asyncStorageKV } from '../daily/store';
import { track } from '../telemetry';
import { PlayScreen } from '../ui/PlayScreen';
import { C } from '../ui/theme';

/** Today's puzzle. Built (or loaded from cache) on this device; identical for everyone with the same date. */
export default function Daily() {
  const [state, setState] = useState<{ challenge?: DailyChallenge; error?: string; progress: number }>({ progress: 0 });
  useEffect(() => {
    let alive = true;
    getDailyChallenge(dayIndex(), asyncStorageKV, (f) => alive && setState((s) => ({ ...s, progress: f })))
      .then((challenge) => { if (alive) { track('daily_started'); setState({ challenge, progress: 1 }); } })
      .catch((e) => alive && setState({ error: e instanceof Error ? e.message : 'Couldn’t build today’s puzzle.', progress: 0 }));
    return () => { alive = false; };
  }, []);
  if (state.error) {
    return (
      <View style={s.c}>
        <Text style={s.t}>{state.error}</Text>
        <Pressable style={s.b} onPress={() => router.replace('/')}><Text style={s.bt}>Home</Text></Pressable>
      </View>
    );
  }
  if (!state.challenge) {
    return (
      <View style={s.c}>
        <ActivityIndicator color={C.accent} size="large" />
        <Text style={s.t}>Building today{'’'}s puzzle{'…'} {Math.round(state.progress * 100)}%</Text>
      </View>
    );
  }
  return <PlayScreen key={`daily-${state.challenge.day}`} challenge={state.challenge} />;
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: C.bgTop, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  t: { color: C.text, textAlign: 'center', fontSize: 15 },
  b: { height: 44, paddingHorizontal: 26, borderRadius: 22, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  bt: { color: '#fff', fontWeight: '700' },
});
