import { Canvas, Picture, type SkPicture } from '@shopify/react-native-skia';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { type GestureResponderEvent, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlayController } from '../game/controller';
import { EditorController, type Tool } from '../editor/controller';
import { loadDraft, saveDraft } from '../editor/draft';
import { useMoney } from '../monetization';
import { encodeCustom } from '../social/codec';
import { track } from '../telemetry';
import { renderScene } from './skiaScene';
import { C } from './theme';
import { fitView, toWorld, type View as WView } from './view';

const kv = { get: (k: string) => AsyncStorage.getItem(k), set: (k: string, v: string) => AsyncStorage.setItem(k, v) };
const TOOLS: Array<{ id: Tool; label: string; glyph: string }> = [
  { id: 'wall', label: 'Wall', glyph: '╱' },
  { id: 'bumper', label: 'Bumper', glyph: '●' },
  { id: 'ball', label: 'Ball', glyph: '◉' },
  { id: 'goal', label: 'Goal', glyph: '◎' },
  { id: 'erase', label: 'Erase', glyph: '⌫' },
];
const HINTS: Record<Tool, string> = {
  wall: 'Drag to draw a wall.', bumper: 'Tap to place a bouncy bumper.', ball: 'Drag to move the ball.',
  goal: 'Drag to move the gold goal.', erase: 'Tap a wall or bumper to erase it.',
};

/** Creator mode editor: draw a puzzle, test it, then (with the Creator Pass) twist it and send it. */
export function EditorScreen() {
  const insets = useSafeAreaInsets();
  const money = useMoney();
  const ed = useRef(new EditorController()).current;
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const [loaded, setLoaded] = useState(false);
  const [picture, setPicture] = useState<SkPicture | null>(null);
  const stage = useRef<React.ComponentRef<typeof View>>(null);
  const box = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const viewRef = useRef<WView>(fitView(300, 500, 90, 160));

  useEffect(() => {
    void loadDraft(kv).then((d) => { ed.def = d; ed.revision++; setLoaded(true); bump(); });
    track('editor_opened');
  }, [ed]);

  // autosave whenever the drawing changes
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => void saveDraft(kv, ed.def), 400);
    return () => clearTimeout(t);
  });

  const measure = useCallback(() => {
    stage.current?.measureInWindow((x, y, w, h) => {
      box.current = { x, y, w, h };
      if (w > 0 && h > 0) viewRef.current = fitView(w, h, 90, 160, 8, 0);
    });
  }, []);

  const lvlKey = ed.revision;
  const play = useMemo(() => new PlayController(ed.level()), [lvlKey, loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let raf = 0;
    const loop = (now: number) => {
      if (box.current.w > 0) setPicture(renderScene(play, viewRef.current, now / 1000, null, false, ed.preview));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [play, ed]);

  const at = (e: GestureResponderEvent): [number, number] =>
    toWorld(viewRef.current, e.nativeEvent.pageX - box.current.x, e.nativeEvent.pageY - box.current.y);
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => { measure(); const [x, y] = at(e); ed.down(x, y); bump(); },
    onPanResponderMove: (e) => { const [x, y] = at(e); ed.move(x, y); },
    onPanResponderRelease: (e) => { const [x, y] = at(e); ed.up(x, y); bump(); },
    onPanResponderTerminate: (e) => { const [x, y] = at(e); ed.up(x, y); bump(); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [ed]);

  const problem = loaded ? ed.problem() : null;
  const test = () => {
    const p = ed.problem();
    if (p) { ed.message = p; bump(); return; }
    track('editor_test');
    router.push({ pathname: '/play', params: { custom: encodeCustom(ed.def) } });
  };
  const act = (fn: () => void) => () => { fn(); bump(); };

  return (
    <View style={s.root}>
      <View style={[s.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable style={s.ibtn} onPress={() => router.back()} accessibilityLabel="Back"><Text style={s.ibtnT}>{'‹'}</Text></Pressable>
        <Text style={s.title}>Create a puzzle</Text>
        <Pressable style={[s.ibtn, !ed.canUndo && { opacity: 0.4 }]} onPress={act(() => ed.undo())} accessibilityLabel="Undo"><Text style={s.ibtnT}>{'↶'}</Text></Pressable>
        <Pressable style={s.ibtn} onPress={act(() => ed.clear())} accessibilityLabel="Clear everything"><Text style={s.ibtnT}>{'✕'}</Text></Pressable>
      </View>

      <View ref={stage} style={s.stage} onLayout={measure} {...pan.panHandlers} collapsable={false}>
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">{picture && <Picture picture={picture} />}</Canvas>
      </View>

      <Text style={[s.msg, !!(ed.message || problem) && { color: C.pink }]} accessibilityLiveRegion="polite">
        {ed.message || problem || HINTS[ed.tool]}
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tools}>
        {TOOLS.map((t) => (
          <Pressable key={t.id} style={[s.tool, ed.tool === t.id && s.toolOn]} onPress={act(() => ed.setTool(t.id))} accessibilityRole="button" accessibilityLabel={t.label} accessibilityState={{ selected: ed.tool === t.id }}>
            <Text style={[s.toolG, ed.tool === t.id && { color: '#fff' }]}>{t.glyph}</Text>
            <Text style={[s.toolT, ed.tool === t.id && { color: '#fff' }]}>{t.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={s.opts}>
        <Pressable style={s.opt} onPress={act(() => ed.cycleBumperSize())}><Text style={s.optT}>Bumper size {ed.bumperR / 2}</Text></Pressable>
        <Pressable style={s.opt} onPress={act(() => ed.cycleGoalSize())}><Text style={s.optT}>Goal size {ed.def.t[2] / 2}</Text></Pressable>
        <View style={s.planks}>
          <Pressable style={s.pm} onPress={act(() => ed.removePlank())} accessibilityLabel="Fewer planks"><Text style={s.optT}>{'−'}</Text></Pressable>
          {ed.def.p.map((l, i) => (
            <Pressable key={i} onPress={act(() => ed.cyclePlank(i))} accessibilityLabel={`Plank ${i + 1}, length ${l}. Tap to change`}>
              <View style={[s.plankBar, { width: l * 1.5 }]} />
            </Pressable>
          ))}
          <Pressable style={s.pm} onPress={act(() => ed.addPlank())} accessibilityLabel="More planks"><Text style={s.optT}>+</Text></Pressable>
        </View>
      </View>

      <View style={[s.foot, { paddingBottom: insets.bottom + 10 }]}>
        <Pressable style={[s.go, !!problem && { opacity: 0.55 }]} onPress={test} accessibilityRole="button" accessibilityLabel="Test your puzzle">
          <Text style={s.goT}>Test it {'▶'}</Text>
        </Pressable>
        <Text style={s.fine}>
          {money.creatorUnlocked
            ? 'Solve it yourself, then twist one rule and send it.'
            : money.storeConfigured ? 'Testing is free. Sending needs the Creator Pass.' : 'Solve it yourself, then twist one rule and send it.'}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgTop },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingBottom: 6 },
  title: { flex: 1, color: C.text, fontSize: 18, fontWeight: '800' },
  ibtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.panel, borderWidth: 1, borderColor: C.panelEdge, alignItems: 'center', justifyContent: 'center' },
  ibtnT: { color: C.text, fontSize: 18 },
  stage: { flex: 1 },
  msg: { color: C.dim, fontSize: 13, textAlign: 'center', paddingHorizontal: 14, minHeight: 20 },
  tools: { paddingHorizontal: 12, gap: 8, paddingVertical: 8 },
  tool: { minWidth: 70, height: 52, borderRadius: 14, backgroundColor: C.panel, borderWidth: 1, borderColor: C.panelEdge, alignItems: 'center', justifyContent: 'center' },
  toolOn: { backgroundColor: C.accent, borderColor: C.accent },
  toolG: { color: C.text, fontSize: 18 },
  toolT: { color: C.dim, fontSize: 11, fontWeight: '700' },
  opts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingBottom: 6 },
  opt: { height: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1, borderColor: C.panelEdge, alignItems: 'center', justifyContent: 'center' },
  optT: { color: C.text, fontSize: 12, fontWeight: '700' },
  planks: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' },
  pm: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: C.panelEdge, alignItems: 'center', justifyContent: 'center' },
  plankBar: { height: 10, borderRadius: 5, backgroundColor: '#cfd4ff' },
  foot: { paddingHorizontal: 14, paddingTop: 6, alignItems: 'center', gap: 6 },
  go: { alignSelf: 'stretch', height: 50, borderRadius: 25, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  goT: { color: '#fff', fontWeight: '800', fontSize: 17 },
  fine: { color: C.dim, fontSize: 12 },
});
