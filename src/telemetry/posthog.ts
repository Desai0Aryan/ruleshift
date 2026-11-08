import { PostHog } from 'posthog-react-native';
import { POSTHOG_HOST, POSTHOG_KEY } from '../config';
import { setSink } from './index';

/**
 * Optional PostHog sink. No key => nothing is sent (the on-device stats in Settings still work).
 * Anonymous by design: no account, no email, no device ids beyond PostHog's own random anonymous id.
 */
export function initPostHog() {
  if (!POSTHOG_KEY) return;
  try {
    const ph = new PostHog(POSTHOG_KEY, { host: POSTHOG_HOST, captureAppLifecycleEvents: true, flushAt: 20, flushInterval: 30000 });
    setSink((r) => { try { ph.capture(r.name, r.props); } catch { /* never crash the game */ } });
  } catch { /* analytics are optional */ }
}
