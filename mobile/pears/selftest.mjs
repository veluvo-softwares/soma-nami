// Two instances of the real core in one Bare process, a local bootstrap, no internet bootstrap.
// Run: npm install && npm run selftest [bind-address]
import b4a from 'b4a'
import DHT from 'hyperdht'
import Hyperswarm from 'hyperswarm'
import { createPears, pickLocalAddress } from './core.mjs'

const host = Bare.argv[2] || '127.0.0.1'
const log = (...a) => console.log(...a)
let failed = 0
const check = (name, ok, extra = '') => {
  log(ok ? 'PASS' : 'FAIL', name, extra)
  if (!ok) failed++
}

function node(name) {
  const events = []
  const waiters = []
  const p = createPears({
    emit: (e) => {
      events.push(e)
      for (const w of [...waiters]) if (w.pred(e)) { waiters.splice(waiters.indexOf(w), 1); w.res(e) }
    },
    DHT,
    Hyperswarm,
    b4a,
    localAddress: () => host,
  })
  const next = (pred, ms = 15000) => {
    const hit = events.find(pred)
    if (hit) return Promise.resolve(hit)
    return new Promise((res, rej) => {
      const w = { pred, res }
      waiters.push(w)
      setTimeout(() => rej(new Error(`${name}: timeout`)), ms)
    })
  }
  return { name, events, p, next }
}

const pharmacist = node('pharmacist')
const patient = node('patient')
const net = { host, port: 49737, code: '4821' }

await pharmacist.p.handle({ cmd: 'send', id: 'x0', text: 'nobody here' })
check('send with no peer is an error, not a crash', pharmacist.events.some((e) => e.ev === 'error' && e.message === 'no-peer'))

const t0 = Date.now()
await pharmacist.p.handle({ cmd: 'host', ...net })
const ready = await pharmacist.next((e) => e.ev === 'ready')
check('the host reports the address it bound', ready.host === host)
await patient.p.handle({ cmd: 'join', ...net })
await Promise.all([pharmacist.next((e) => e.ev === 'peer'), patient.next((e) => e.ev === 'peer')])
check('peers find each other through the local bootstrap', true, `${Date.now() - t0} ms`)

const text = 'Chukua 1 mara 3 baada ya chakula. Take 1 tablet three times a day after food.'
await pharmacist.p.handle({ cmd: 'send', id: 'm1', text })
const got = await patient.next((e) => e.ev === 'message')
check('the instruction arrives verbatim', got.text === text && got.id === 'm1')
await pharmacist.next((e) => e.ev === 'delivered' && e.id === 'm1')
check('the pharmacist is told it was delivered', true)

await pharmacist.p.handle({ cmd: 'send', id: 'm2', text: 'x'.repeat(5000) })
check('an oversized instruction is refused', pharmacist.events.some((e) => e.ev === 'error' && e.message === 'too-long' && e.id === 'm2'))

await patient.p.handle({ cmd: 'stop' })
await pharmacist.next((e) => e.ev === 'peer-left')
check('the pharmacist sees the patient leave', true)
await pharmacist.p.handle({ cmd: 'send', id: 'm3', text: 'after leave' })
check('send after the peer left is an error', pharmacist.events.some((e) => e.ev === 'error' && e.id === 'm3'))

// Wrong code: same bootstrap, different topic, must not connect.
const nic = (family, address) => ({ family, internal: false, address })
const lo = { lo0: [{ family: 'IPv4', internal: true, address: '127.0.0.1' }] }
check('picks the hotspot interface over Wi-Fi', pickLocalAddress({ ...lo, en0: [nic('IPv4', '192.168.1.20')], bridge100: [nic('IPv4', '172.20.10.1')] }) === '172.20.10.1')
check('falls back to a private Wi-Fi address', pickLocalAddress({ ...lo, wlan0: [nic('IPv6', 'fe80::1'), nic('IPv4', '192.168.43.7')] }) === '192.168.43.7')
check('never offers a public or loopback address', pickLocalAddress({ ...lo, rmnet0: [nic('IPv4', '41.90.1.2')] }) === null)

const stranger = node('stranger')
await stranger.p.handle({ cmd: 'join', ...net, code: '0000' })
await stranger.next((e) => e.ev === 'ready')
await new Promise((r) => setTimeout(r, 2500))
check('a different pairing code never connects', !stranger.events.some((e) => e.ev === 'peer') && !pharmacist.events.slice(-3).some((e) => e.ev === 'peer'))

await Promise.all([pharmacist.p.stop(), patient.p.stop(), stranger.p.stop()])
log(failed ? `${failed} FAILED` : 'ALL PASSED')
Bare.exit(failed ? 1 : 0)
