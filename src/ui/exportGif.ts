import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { renderReplayGif } from '../export/replayGif';
import type { Chain } from '../social/chain';

/** Renders the chain replay to a GIF on-device (pure TS, no native video encoder) and opens the share sheet. */
export async function shareReplayGif(chain: Chain, onProgress: (f: number) => void): Promise<'shared' | 'unavailable' | 'failed'> {
  try {
    const gif = await renderReplayGif(chain, {
      width: 216,
      onProgress,
      yieldFn: () => new Promise<void>((r) => setTimeout(r, 0)),
    });
    if (!gif) return 'failed';
    const file = new File(Paths.cache, `ruleshift-${Date.now()}.gif`);
    file.create({ overwrite: true });
    file.write(gif.bytes);
    if (!(await Sharing.isAvailableAsync())) return 'unavailable';
    await Sharing.shareAsync(file.uri, { mimeType: 'image/gif', UTI: 'com.compuserve.gif', dialogTitle: 'Share your RULESHIFT replay' });
    return 'shared';
  } catch {
    return 'failed';
  }
}
