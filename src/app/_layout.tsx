import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { loadStore } from '../ui/store';
import { track } from '../telemetry';
import { C } from '../ui/theme';

export default function RootLayout() {
  useEffect(() => { void loadStore(); track('app_open'); }, []);
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: C.bgTop }, gestureEnabled: false }} />
    </>
  );
}
