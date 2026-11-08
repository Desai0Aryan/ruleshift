import { Canvas, Picture, type SkPicture } from '@shopify/react-native-skia';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChainReplay, replayStages } from '../game/replay';
import { RULES } from '../rules';
import type { Chain } from '../social/chain';
import { track } from '../telemetry';
import { gameFeedback } from './feedback';
import { shareReplayGif } from './exportGif';
import { renderScene } from './skiaScene';
import { C } from './theme';
import { fitView } from './view';

/** Plays a whole chain back from its stored inputs: original puzzle, then each twist, solved on screen. */
export function ReplayScreen({ chain }: { chain: Chain }) {
  const insets = useSafeAreaInsets();
  const stages = useMemo(() => replayStages(chain), [chain]);
  const replay = useMemo(() => (stages ? new ChainReplay(stages) : null), [stages]);
  const [pic, setPic] = useState<SkPicture | null>(null);
  const [banner, setBanner] = useState('');
  const [color, setColor] = useState<string>(C.text);
  const [gifP, setGifP] = useState<number | null>(null);
  const size = useRef({ w: 0, h: 0 });

  useEffect(() => { track('replay_watched', { depth: chain.links.length }); }, [chain]);
  useEffect(() => {
    if (!replay) return;
    replay.onStage = () => { replay.ctl.onEvent = gameFeedback; };
    replay.ctl.onEvent = gameFeedback;
    let raf = 0;
    let last = performance.now();
    let lastBanner = '';
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      replay.advance(dt);
      if (replay.banner !== lastBanner) {
        lastBanner = replay.banner;
        setBanner(lastBanner);
        setColor(replay.stage.rule ? RULES[replay.stage.rule].color : C.text);
      }
      const { w, h } = size.current;
      if (w > 0) {
        const L = replay.ctl.level;
        setPic(renderScene(replay.ctl, fitView(w, h, L.w, L.h, 8, 70), now / 1000, null, false));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [replay]);

  if (!replay) return <View style={s.root}><Text style={s.err}>This replay can{'’'}t be loaded.</Text></View>;
  return (
    <View style={s.root} onLayout={(e) => { size.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height }; }}>
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">{pic && <Picture picture={pic} />}</Canvas>
      <View style={[s.bar, { top: insets.top + 6 }]}>
        <Pressable style={s.ibtn} onPress={() => router.back()} accessibilityLabel="Back"><Text style={s.ibtnT}>{'‹'}</Text></Pressable>
        <Text style={[s.title, { flex: 1 }]}>Chain replay</Text>
        <Pressable style={s.gifBtn} disabled={gifP !== null} onPress={async () => { setGifP(0); track('gif_export', { depth: chain.links.length }); await shareReplayGif(chain, setGifP); setGifP(null); }}>
          <Text style={s.gifT}>{gifP === null ? 'Share GIF' : `${Math.round(gifP * 100)}%`}</Text>
        </Pressable>
      </View>
      <Text style={[s.banner, { top: insets.top + 56, color }]}>{banner}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgTop },
  bar: { position: 'absolute', left: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  ibtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.panel, borderWidth: 1, borderColor: C.panelEdge, alignItems: 'center', justifyContent: 'center' },
  ibtnT: { color: C.text, fontSize: 18 },
  title: { color: C.text, fontWeight: '700', fontSize: 15 },
  gifBtn: { height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: C.panel, borderWidth: 1, borderColor: C.mint, alignItems: 'center', justifyContent: 'center' },
  gifT: { color: C.mint, fontWeight: '700', fontSize: 12 },
  banner: { position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 22, fontWeight: '800' },
  err: { color: C.text, textAlign: 'center', marginTop: 120 },
});
