import { Redirect, useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { decodeChain } from '../social/codec';
import { challengeFromBase, challengeFromChain } from '../social/flow';
import { PlayScreen } from '../ui/PlayScreen';

export default function Play() {
  const { level, code } = useLocalSearchParams<{ level?: string; code?: string }>();
  const challenge = useMemo(() => {
    if (code) {
      const d = decodeChain(code);
      if (!d.ok) return null;
      const c = challengeFromChain(d.chain);
      return c.ok ? c.challenge : null;
    }
    return challengeFromBase(level ?? 'L01');
  }, [level, code]);
  if (!challenge) return <Redirect href="/" />;
  return <PlayScreen key={`${level ?? ''}${code ?? ''}`} challenge={challenge} />;
}
