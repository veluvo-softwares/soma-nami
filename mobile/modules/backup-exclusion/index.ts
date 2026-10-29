import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

interface BackupExclusionNative {
  excludeFromBackup(uri: string): void;
}

const native = requireOptionalNativeModule<BackupExclusionNative>('BackupExclusion');
let warned = false;

/**
 * iOS: marks a file or folder (by file:// URI) as excluded from iCloud and
 * iTunes backup. Throws if iOS refuses. Android: no-op (Auto Backup is off in
 * app.json). If the running build predates this module (an old dev build), it
 * warns once and does nothing, so the app still works; make a new dev build.
 */
export function excludeFromBackup(uri: string): void {
  if (Platform.OS !== 'ios') return;
  if (!native) {
    if (!warned) {
      warned = true;
      console.warn('[soma] BackupExclusion native module missing; files are NOT excluded from backup. Make a new dev build.');
    }
    return;
  }
  native.excludeFromBackup(uri);
}
