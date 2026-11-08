import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { initMonetization } from '../monetization';
import { initPostHog } from '../telemetry/posthog';
import { loadStore } from '../ui/store';
import { track } from '../telemetry';
import { C } from '../ui/theme';

export default function RootLayout() {
  useEffect(() => {
    initPostHog();
    void loadStore();
    track('app_open');
    // let the first screen render before the (iOS) tracking prompt and ad/store setup
    const t = setTimeout(() => { void initMonetization(); }, 1200);
    return () => clearTimeout(t);
  }, []);
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: C.bgTop }, gestureEnabled: false }} />
    </>
  );
}
