import { AIM_FRAME, bestPictureSize, fitLongSide, FRAME_SLACK, frameCrop, uriToPath } from './image';
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

describe('frameCrop: the part of a camera photo inside the aiming frame', () => {
  const noSlack = (image: { width: number; height: number }, view: { width: number; height: number }) =>
    frameCrop(image, view, AIM_FRAME, 0);

  it('same aspect as the preview: the frame maps straight across (8% sides, 12% top and bottom)', () => {
    // iOS's expo-camera already trims the photo to the preview's aspect.
    expect(noSlack({ width: 1000, height: 2000 }, { width: 400, height: 800 })).toEqual({
      originX: 80,
      originY: 240,
      width: 840,
      height: 1520,
    });
  });

  it('a 3:4 photo under a taller preview: the sides the preview hid are left out too', () => {
    // 3024 x 4032 photo, 390 x 600 preview. Cover scale = max(390/3024, 600/4032) = 600/4032, so
    // the photo shows 600 px tall and 450 px wide on screen, 30 px hidden on each side.
    const scale = 600 / 4032;
    const rect = noSlack({ width: 3024, height: 4032 }, { width: 390, height: 600 })!;
    const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(1);
    near(rect.originX, (0.08 * 390 + 30) / scale);
    near(rect.originX + rect.width, (0.92 * 390 + 30) / scale);
    near(rect.originY, (0.12 * 600) / scale);
    near(rect.originY + rect.height, (0.88 * 600) / scale);
    // Narrower than 84% of the photo, because 60 of the 450 px on screen were hidden.
    expect(rect.width / 3024).toBeCloseTo((0.84 * 390) / 450, 2);
  });

  it('a photo wider than the preview by a lot: the crop stays centred', () => {
    const rect = noSlack({ width: 4000, height: 1000 }, { width: 600, height: 500 })!;
    expect(rect.originX + rect.width / 2).toBeCloseTo(2000, 0);
    expect(rect.originY + rect.height / 2).toBeCloseTo(500, 0);
    // Cover scale 0.5: the preview shows the middle 1200 px of the 4000 px width.
    expect(rect).toMatchObject({ originX: 1496, width: 1008 });
  });

  it('a landscape photo through a portrait preview (phone turned sideways) is not cropped', () => {
    expect(frameCrop({ width: 4032, height: 3024 }, { width: 390, height: 600 })).toBeNull();
  });

  it('keeps a little more than the frame (FRAME_SLACK), so a label just past the line is not cut', () => {
    expect(FRAME_SLACK).toBe(0.03);
    // 5% and 9% in from the edges instead of 8% and 12%.
    expect(frameCrop({ width: 1000, height: 2000 }, { width: 400, height: 800 })).toEqual({
      originX: 50,
      originY: 180,
      width: 900,
      height: 1640,
    });
  });

  it('never reaches outside the photo, even with a frame at the very edge', () => {
    const rect = frameCrop({ width: 1000, height: 1000 }, { width: 300, height: 300 }, { top: 0, bottom: 0, left: 0, right: 0 })!;
    expect(rect).toEqual({ originX: 0, originY: 0, width: 1000, height: 1000 });
  });

  it('returns null for an unknown size, so the photo is read uncropped', () => {
    expect(frameCrop({ width: 0, height: 100 }, { width: 300, height: 300 })).toBeNull();
    expect(frameCrop({ width: 1000, height: 1000 }, { width: 0, height: 0 })).toBeNull();
  });
});

describe('bestPictureSize', () => {
  it('takes the full-sensor "Photo" preset on iOS', () => {
    expect(bestPictureSize(['Low', 'Medium', 'High', '1920x1080', '3840x2160', 'Photo'])).toBe('Photo');
  });
  it('otherwise the size with the most pixels', () => {
    expect(bestPictureSize(['1280x720', '4032x3024', '1920x1080'])).toBe('4032x3024');
  });
  it('nothing usable: leave the camera default', () => {
    expect(bestPictureSize([])).toBeUndefined();
    expect(bestPictureSize(['High', 'Medium'])).toBeUndefined();
  });
});
