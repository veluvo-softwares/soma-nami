import type { OcrBlock } from './ocrLines';
import type { SpeechBackend } from '../speech/session';

export interface Photo {
  uri: string;
  width: number;
  height: number;
}

/**
 * Everything the read flow needs from the device. The app wires in QVAC,
 * expo-audio, the camera roll and the image resizer (services.ts); tests pass
 * fakes, since @qvac/sdk needs its native worker.
 */
export interface ReaderServices {
  /** Shrinks a camera or library photo so OCR fits in memory (OCR_MAX_SIDE). */
  preparePhoto(photo: Photo): Promise<Photo>;
  /** Lets the user choose a photo from the library; null if they cancel. */
  pickPhoto(): Promise<Photo | null>;
  /** QVAC OCR on a prepared photo. */
  recognize(photoUri: string): Promise<OcrBlock[]>;
  speech: SpeechBackend;
  /** Unloads models when the reader goes away. */
  release(): Promise<void>;
}
