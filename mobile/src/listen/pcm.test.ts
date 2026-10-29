import { WavFormatError, wavToPcm16k, WHISPER_RATE } from './pcm';
import { makeWav } from './testing';

const samples = (bytes: Uint8Array) => new Int16Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));

describe('wavToPcm16k', () => {
  it('passes 16 kHz mono 16-bit samples through unchanged, without the header', () => {
    const wav = makeWav(1000);
    const pcm = wavToPcm16k(wav);
    expect(pcm.durationMs).toBe(1000);
    expect(pcm.bytes.length).toBe(WHISPER_RATE * 2);
    expect(Array.from(pcm.bytes.slice(0, 64))).toEqual(Array.from(wav.slice(44, 44 + 64)));
  });

  it('skips the padding chunk iOS puts before the samples', () => {
    const pcm = wavToPcm16k(makeWav(800, { extraChunk: true }));
    expect(pcm.durationMs).toBe(800);
  });

  it('downmixes stereo and resamples 44.1 kHz to 16 kHz', () => {
    const pcm = wavToPcm16k(makeWav(1000, { rate: 44100, channels: 2 }));
    expect(pcm.durationMs).toBe(1000);
    expect(pcm.bytes.length).toBe(WHISPER_RATE * 2);
    // Still a 440 Hz tone at about a quarter of full scale.
    const s = samples(pcm.bytes);
    expect(Math.max(...Array.from(s))).toBeGreaterThan(0.2 * 32767);
    expect(Math.max(...Array.from(s))).toBeLessThan(0.3 * 32767);
  });

  it('reads 32-bit float WAVs', () => {
    const pcm = wavToPcm16k(makeWav(600, { float: true }));
    expect(pcm.durationMs).toBe(600);
    expect(Math.max(...Array.from(samples(pcm.bytes)))).toBeGreaterThan(0.2 * 32767);
  });

  it('uses what is there when the recorder stopped before fixing the data size', () => {
    const wav = makeWav(1000);
    new DataView(wav.buffer).setUint32(40, 0xffffffff, true);
    expect(wavToPcm16k(wav).durationMs).toBe(1000);
  });

  it('an empty recording is 0 ms long (the caller calls that too short)', () => {
    expect(wavToPcm16k(makeWav(0)).durationMs).toBe(0);
  });

  it('refuses anything that is not a PCM WAV', () => {
    expect(() => wavToPcm16k(new Uint8Array([1, 2, 3]))).toThrow(WavFormatError);
    const aac = makeWav(500);
    new DataView(aac.buffer).setUint16(20, 0x00ff, true);
    expect(() => wavToPcm16k(aac)).toThrow(/unsupported WAV/);
    const noData = makeWav(500).slice(0, 36);
    expect(() => wavToPcm16k(noData)).toThrow(/no data chunk/);
  });
});
