import { AppShell } from './src/AppShell';
import { MODEL_MANIFEST } from './src/model-store/manifest';
import { qvacModelClient } from './src/model-store/qvacClient';

export default function App() {
  return <AppShell client={qvacModelClient} manifest={MODEL_MANIFEST} />;
}
