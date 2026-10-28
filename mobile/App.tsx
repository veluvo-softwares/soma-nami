import { useState } from 'react';

import { AppShell } from './src/AppShell';
import { MODEL_MANIFEST } from './src/model-store/manifest';
import { qvacModelClient } from './src/model-store/qvacClient';
import { createReaderServices } from './src/reader/services';
import { fileSettingsStorage } from './src/settings/fileSettingsStorage';

export default function App() {
  const [reader] = useState(createReaderServices);
  return (
    <AppShell client={qvacModelClient} manifest={MODEL_MANIFEST} reader={reader} settingsStorage={fileSettingsStorage} />
  );
}
