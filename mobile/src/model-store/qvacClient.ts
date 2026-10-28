import {
  cancel,
  downloadAsset,
  getModelInfo,
  OCR_CRAFT,
  OCR_LATIN,
  QWEN3_1_7B_INST_Q4,
  TRANSLATEPSY_AFRISLM_0_8B_TRANSLATION_Q4_K_M,
  TTS_MULTILINGUAL_SUPERTONIC3_Q4_0,
  WHISPER_SMALL_Q8_0,
} from '@qvac/sdk';

import type { ModelClient } from './ensureModels';
import type { ModelName } from './manifest';

/**
 * Registry descriptors for every model in the manifest. Typechecking this
 * object is what proves each manifest name exists in @qvac/sdk 0.22.0.
 */
export const MODEL_DESCRIPTORS = {
  OCR_CRAFT,
  OCR_LATIN,
  TTS_MULTILINGUAL_SUPERTONIC3_Q4_0,
  WHISPER_SMALL_Q8_0,
  QWEN3_1_7B_INST_Q4,
  TRANSLATEPSY_AFRISLM_0_8B_TRANSLATION_Q4_K_M,
} satisfies Record<ModelName, { name: string; src: string }>;

/** The real QVAC-backed client. Not unit tested: it needs the native worker. */
export const qvacModelClient: ModelClient = {
  async isCached(name) {
    const info = await getModelInfo({ name: MODEL_DESCRIPTORS[name].name });
    return info.isCached && info.cacheFiles.every((f) => f.isCached);
  },
  download(name, onProgress) {
    const op = downloadAsset({
      assetSrc: MODEL_DESCRIPTORS[name],
      onProgress: (p) => {
        const total = p.fileSetInfo?.overallTotal ?? p.total;
        const downloaded = p.fileSetInfo?.overallDownloaded ?? p.downloaded;
        onProgress(downloaded, total);
      },
    });
    return {
      done: op.then(() => undefined),
      cancel: () => {
        void cancel({ requestId: op.requestId }).catch(() => {
          // The download may already have finished or failed; nothing to cancel.
        });
      },
    };
  },
};
