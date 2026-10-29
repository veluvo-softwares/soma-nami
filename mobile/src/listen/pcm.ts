/**
 * Whisper wants 16 kHz mono 16-bit little-endian PCM. The phone records a WAV
 * (asked for 16 kHz mono 16-bit, see expoRecorder.ts), but iOS may add extra
 * chunks before the samples (`FLLR` padding) or hand back another rate or
 * channel count, so the file is parsed chunk by chunk and converted if needed.
 *
 * The result is raw PCM with no header. QVAC streams a raw file straight to
 * Whisper; a `.wav` would go through its FFmpeg decoder, which the app does
 * not bundle (qvac.config.json `includeAudioDecoder: false`).
 */
export const WHISPER_RATE = 16000;

export interface Pcm16k {
  /** s16le mono samples at 16 kHz. */
  bytes: Uint8Array;
  durationMs: number;
}

export class WavFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WavFormatError';
  }
}

const tag = (v: DataView, at: number) => String.fromCharCode(v.getUint8(at), v.getUint8(at + 1), v.getUint8(at + 2), v.getUint8(at + 3));

export function wavToPcm16k(file: Uint8Array): Pcm16k {
  const v = new DataView(file.buffer, file.byteOffset, file.byteLength);
  if (file.byteLength < 12 || tag(v, 0) !== 'RIFF' || tag(v, 8) !== 'WAVE') {
    throw new WavFormatError('not a WAV file');
  }
  let fmt: { format: number; channels: number; rate: number; bits: number } | null = null;
  let data: { start: number; length: number } | null = null;
  let at = 12;
  while (at + 8 <= file.byteLength) {
    const id = tag(v, at);
    const size = v.getUint32(at + 4, true);
    const body = at + 8;
    if (id === 'fmt ') {
      if (size < 16 || body + 16 > file.byteLength) throw new WavFormatError('short fmt chunk');
      let format = v.getUint16(body, true);
      // WAVE_FORMAT_EXTENSIBLE: the real format is the first two bytes of the sub-format GUID.
      if (format === 0xfffe && size >= 40) format = v.getUint16(body + 24, true);
      fmt = { format, channels: v.getUint16(body + 2, true), rate: v.getUint32(body + 4, true), bits: v.getUint16(body + 14, true) };
    } else if (id === 'data') {
      // A recorder stopped mid-write can leave the size too big: use what is there.
      data = { start: body, length: Math.min(size, file.byteLength - body) };
      break;
    }
    at = body + size + (size % 2); // chunks are padded to an even length
  }
  if (!fmt) throw new WavFormatError('no fmt chunk');
  if (!data) throw new WavFormatError('no data chunk');
  const { format, channels, rate, bits } = fmt;
  const pcm16 = format === 1 && bits === 16;
  const float32 = format === 3 && bits === 32;
  if ((!pcm16 && !float32) || channels < 1 || rate < 1000) {
    throw new WavFormatError(`unsupported WAV: format ${format}, ${bits} bit, ${channels} ch, ${rate} Hz`);
  }

  const frameBytes = (bits / 8) * channels;
  const frames = Math.floor(data.length / frameBytes);
  // Downmix to mono floats in -1..1.
  const mono = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) {
      const p = data.start + f * frameBytes + c * (bits / 8);
      sum += pcm16 ? v.getInt16(p, true) / 32768 : v.getFloat32(p, true);
    }
    mono[f] = sum / channels;
  }

  const out = rate === WHISPER_RATE ? mono : resampleLinear(mono, rate, WHISPER_RATE);
  const bytes = new Uint8Array(out.length * 2);
  const w = new DataView(bytes.buffer);
  for (let i = 0; i < out.length; i++) {
    const s = Math.max(-1, Math.min(1, out[i]!));
    w.setInt16(i * 2, Math.round(s < 0 ? s * 32768 : s * 32767), true);
  }
  return { bytes, durationMs: Math.round((out.length / WHISPER_RATE) * 1000) };
}

/** Linear interpolation. Good enough for speech going into Whisper's 16 kHz front end. */
function resampleLinear(input: Float32Array, from: number, to: number): Float32Array {
  const n = Math.floor((input.length * to) / from);
  const out = new Float32Array(n);
  const step = from / to;
  for (let i = 0; i < n; i++) {
    const x = i * step;
    const j = Math.floor(x);
    const a = input[j] ?? 0;
    const b = input[j + 1] ?? a;
    out[i] = a + (b - a) * (x - j);
  }
  return out;
}
