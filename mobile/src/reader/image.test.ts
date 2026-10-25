import { fitLongSide, uriToPath } from './image';
import { encodeWav } from '../speech/wav';

describe('fitLongSide', () => {
  it('shrinks a full iPhone 12 photo to 1280 px on the long side, keeping the aspect', () => {
    expect(fitLongSide(4032, 3024)).toEqual({ width: 1280, height: 960, resized: true });
    expect(fitLongSide(3024, 4032)).toEqual({ width: 960, height: 1280, resized: true });
  });

  it('never enlarges a small photo', () => {
    expect(fitLongSide(1000, 600)).toEqual({ width: 1000, height: 600, resized: false });
    expect(fitLongSide(1280, 720)).toEqual({ width: 1280, height: 720, resized: false });
  });
});

describe('uriToPath', () => {
  it('turns a file:// URI into the plain path QVAC expects', () => {
    expect(uriToPath('file:///var/mobile/Containers/Data/Caches/Camera/A%20B.jpg')).toBe(
      '/var/mobile/Containers/Data/Caches/Camera/A B.jpg',
    );
    expect(uriToPath('/already/a/path.jpg')).toBe('/already/a/path.jpg');
  });
});

describe('encodeWav', () => {
  it('writes a 16-bit mono PCM WAV header and little-endian clamped samples', () => {
    const wav = encodeWav([0, 1000, -1000, 40000, -40000], 44100);
    const v = new DataView(wav.buffer);
    const text = (o: number, n: number) => String.fromCharCode(...wav.slice(o, o + n));
    expect(wav.length).toBe(44 + 10);
    expect(text(0, 4)).toBe('RIFF');
    expect(v.getUint32(4, true)).toBe(36 + 10);
    expect(text(8, 8)).toBe('WAVEfmt ');
    expect(v.getUint16(20, true)).toBe(1);
    expect(v.getUint16(22, true)).toBe(1);
    expect(v.getUint32(24, true)).toBe(44100);
    expect(v.getUint32(28, true)).toBe(88200);
    expect(v.getUint16(34, true)).toBe(16);
    expect(text(36, 4)).toBe('data');
    expect(v.getUint32(40, true)).toBe(10);
    expect([0, 1, 2, 3, 4].map((i) => v.getInt16(44 + i * 2, true))).toEqual([0, 1000, -1000, 32767, -32768]);
  });
});
