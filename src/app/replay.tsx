import { Redirect, useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { decodeChain } from '../social/codec';
import { ReplayScreen } from '../ui/ReplayScreen';

export default function Replay() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const chain = useMemo(() => { const d = code ? decodeChain(code) : null; return d && d.ok ? d.chain : null; }, [code]);
  if (!chain) return <Redirect href="/" />;
  return <ReplayScreen chain={chain} />;
}
