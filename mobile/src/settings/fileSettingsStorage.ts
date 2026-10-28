import { File, Paths } from 'expo-file-system';

import type { Settings, SettingsStorage } from './settings';

/** Settings as a small JSON file in the app's document folder. Never leaves the phone. */
export const fileSettingsStorage: SettingsStorage = {
  async load() {
    const file = new File(Paths.document, 'soma-nami-settings.json');
    if (!file.exists) return null;
    return JSON.parse(await file.text());
  },
  async save(settings: Settings) {
    const file = new File(Paths.document, 'soma-nami-settings.json');
    if (!file.exists) file.create();
    file.write(JSON.stringify(settings));
  },
};
