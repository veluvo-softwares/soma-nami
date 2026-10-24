// Download (and cache) every model the spike needs, one at a time, then unload.
// Usage: node prefetch.mjs [NAME ...]   (default: all)
import * as sdk from '@qvac/sdk';
import { timed } from './lib/common.mjs';

const ALL = [
  ['OCR_LATIN', { langList: ['en'] }],
  ['TTS_MULTILINGUAL_SUPERTONIC3_Q4_0', { ttsEngine: 'supertonic', language: 'en', voice: 'F1' }],
  ['TTS_T3_MULTILINGUAL_CHATTERBOX_Q4_0', { ttsEngine: 'chatterbox', language: 'sw', s3genModelSrc: sdk.TTS_S3GEN_MULTILINGUAL_CHATTERBOX_Q4_0 }],
  ['QWEN3_600M_INST_Q4', {}],
  ['QWEN3_1_7B_INST_Q4', {}],
  ['WHISPER_BASE_Q8_0', { language: 'sw' }],
  ['WHISPER_SMALL_Q8_0', { language: 'sw' }],
];

const want = process.argv.slice(2);
const list = want.length ? ALL.filter(([n]) => want.includes(n)) : ALL;
for (const [name, modelConfig] of list) {
  let last = -1;
  try {
    const { value: id, ms } = await timed(() => sdk.loadModel({
      modelSrc: sdk[name], modelConfig,
      onProgress: (p) => {
        const pc = Math.floor((p.percentage ?? 0) / 10) * 10;
        if (pc !== last) { last = pc; console.log(`${name} ${pc}%`); }
      },
    }));
    console.log(`OK ${name} loaded in ${(ms / 1000).toFixed(1)} s`);
    await sdk.unloadModel({ modelId: id, clearStorage: false });
  } catch (e) {
    console.log(`FAIL ${name}: ${e?.message ?? e}`);
  }
}
await sdk.close?.();
process.exit(0);
