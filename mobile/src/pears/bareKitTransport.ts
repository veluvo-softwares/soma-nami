import { Worklet } from 'react-native-bare-kit';

import { createIpcLink, type PearsLink } from './link';

/**
 * Starts the Pears worklet (mobile/pears/worker.mjs) and returns a link to it.
 * Thin on purpose: all the behaviour is in link.ts (tested with a fake
 * transport) and core.mjs (tested under Bare by `npm run selftest`).
 *
 * The bundle is generated, not committed: `npm run bundle` in mobile/pears
 * writes src/pears/pears.bundle.cjs. Its native addons (udx-native,
 * sodium-native) must also be linked into the app: see mobile/README.md →
 * Pharmacist send.
 */
export function startPearsLink(): PearsLink {
  // Required here, not imported at the top, so tests and type checks don't need the generated file.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bundle = require('./pears.bundle.cjs') as string;
  const worklet = new Worklet();
  worklet.start('/pears.bundle', bundle);
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  return createIpcLink({
    write: (data) => {
      worklet.IPC.write(encoder.encode(data) as never);
    },
    onData: (handler) => {
      worklet.IPC.on('data', (chunk: unknown) => handler(decoder.decode(chunk as Uint8Array, { stream: true })));
    },
  });
}
