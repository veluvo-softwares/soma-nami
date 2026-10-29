// Entry point of the Bare worklet started by react-native-bare-kit.
// Newline-delimited JSON over BareKit.IPC; the logic is in core.mjs.
import b4a from 'b4a'
import DHT from 'hyperdht'
import Hyperswarm from 'hyperswarm'
import os from 'bare-os'
import { createPears, pickLocalAddress } from './core.mjs'

const { IPC } = BareKit

const pears = createPears({
  emit: (event) => IPC.write(b4a.from(JSON.stringify(event) + '\n')),
  DHT,
  Hyperswarm,
  b4a,
  localAddress: () => pickLocalAddress(os.networkInterfaces()),
})

let buf = ''
IPC.on('data', (chunk) => {
  buf += b4a.toString(chunk)
  let nl
  while ((nl = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, nl)
    buf = buf.slice(nl + 1)
    try {
      pears.handle(JSON.parse(line))
    } catch {
      // a bad line from the app must not take the worklet down
    }
  }
})
