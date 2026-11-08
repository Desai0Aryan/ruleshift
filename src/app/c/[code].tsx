import { Redirect, useLocalSearchParams } from 'expo-router';
import React from 'react';

/** Deep link target: ruleshift://c/<code> and https://<your-domain>/c/<code> */
export default function ChallengeLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <Redirect href={{ pathname: '/play', params: { code } }} />;
}
