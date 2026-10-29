import { localFile } from '../storage/localStore';

import type { Settings, SettingsStorage } from './settings';

/** Settings as a small JSON file in the backup-excluded local folder (the helper's number is in it). Never leaves the phone. */
export const fileSettingsStorage: SettingsStorage = {
  async load() {
    const file = localFile('soma-nami-settings.json');
    if (!file.exists) return null;
    return JSON.parse(await file.text());
  },
  async save(settings: Settings) {
    const file = localFile('soma-nami-settings.json');
    if (!file.exists) file.create();
    file.write(JSON.stringify(settings));
  },
};
