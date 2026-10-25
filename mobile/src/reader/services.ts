import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { launchImageLibraryAsync } from 'expo-image-picker';

import { createExpoAudioBackend } from '../speech/expoAudioBackend';
import { fitLongSide } from './image';
import { recognize, releaseModels, synthesize } from './qvacReader';
import type { Photo, ReaderServices } from './types';

async function preparePhoto(photo: Photo): Promise<Photo> {
  const target = fitLongSide(photo.width, photo.height);
  // Re-encode even when small enough: it applies the EXIF rotation, so the
  // text boxes OCR returns match what the user saw.
  const ctx = ImageManipulator.manipulate(photo.uri);
  try {
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

/** The real device services: QVAC OCR and Supertonic, expo-audio, expo-image-*. */
export function createReaderServices(): ReaderServices {
  return {
    preparePhoto,
    pickPhoto,
    recognize,
    speech: createExpoAudioBackend(synthesize),
    release: releaseModels,
  };
}
