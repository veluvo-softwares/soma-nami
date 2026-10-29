import { ImageManipulator, SaveFormat, type ImageManipulatorContext } from 'expo-image-manipulator';
import { launchImageLibraryAsync } from 'expo-image-picker';

import { createListenService } from '../listen/qvacListen';
import { createExpoAudioBackend } from '../speech/expoAudioBackend';
import { fitLongSide, frameCrop, type CropRect, type Size } from './image';
import { recognize, releaseModels, synthesize, translateLine } from './qvacReader';
import type { Photo, ReaderServices } from './types';

async function preparePhoto(photo: Photo): Promise<Photo> {
  // A camera photo is cropped to the aiming frame first, so text around the
  // label (another pack, the table, a screen) is never read, and OCR has less
  // to look at. The crop is worked out on the photo as the user saw it, so
  // render it once with its EXIF rotation applied before measuring.
  if (photo.preview) {
    const upright = ImageManipulator.manipulate(photo.uri);
    try {
      const image = await upright.renderAsync();
      try {
        const rect = frameCrop({ width: image.width, height: image.height }, photo.preview);
        if (rect) return await cropAndShrink(ImageManipulator.manipulate(image), rect, rect);
      } finally {
        image.release();
      }
    } finally {
      upright.release();
    }
  }
  return cropAndShrink(ImageManipulator.manipulate(photo.uri), null, photo);
}

/** Applies the crop (if any), shrinks `size` to OCR_MAX_SIDE and saves a JPEG. Releases `ctx`. */
async function cropAndShrink(ctx: ImageManipulatorContext, rect: CropRect | null, size: Size): Promise<Photo> {
  try {
    if (rect) ctx.crop(rect);
    const target = fitLongSide(size.width, size.height);
    // Re-encode even when small enough: it applies the EXIF rotation, so the
    // text boxes OCR returns match what the user saw.
    if (target.resized) ctx.resize({ width: target.width, height: target.height });
    const image = await ctx.renderAsync();
    try {
      const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
      return { uri: saved.uri, width: saved.width, height: saved.height };
    } finally {
      // Free the decoded full-size bitmap now, before OCR needs the memory.
      image.release();
    }
  } finally {
    ctx.release();
  }
}

async function pickPhoto(): Promise<Photo | null> {
  // iOS's photo picker runs out of process and needs no library permission.
  const result = await launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  return { uri: asset.uri, width: asset.width, height: asset.height };
}

/** The real device services: QVAC OCR, Supertonic and Whisper, expo-audio, expo-image-*. */
export function createReaderServices(): ReaderServices {
  return {
    preparePhoto,
    pickPhoto,
    recognize,
    translate: translateLine,
    speech: createExpoAudioBackend(synthesize),
    listen: createListenService(),
    release: releaseModels,
  };
}
