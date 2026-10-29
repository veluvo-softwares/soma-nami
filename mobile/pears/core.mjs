// Pharmacist -> patient send over Hyperswarm with NO internet (card C7).
//
// Hyperswarm's default bootstrap nodes are on the internet, so this never uses
// them. The pharmacist's phone runs its own bootstrap node on its Wi-Fi or
// hotspot address; the patient's phone is pointed at it. Both then meet on a
// topic derived from a short pairing code. All traffic is Noise-encrypted by
// Hyperswarm.
//
// Pure of Bare/React Native: everything native is injected, so the same code
// runs in the phone's worklet and in selftest.mjs.
//
// Commands in : { cmd: 'host', port, code } | { cmd: 'join', host, port, code } | { cmd: 'send', id, text } | { cmd: 'stop' }
// Events out  : ready {host} | peer | peer-left | message {id,text} | delivered {id} | error {message,id?}
//
// 'host' binds the phone's own private address (found by `localAddress`) and
// reports it in `ready`; the pharmacist's screen shows it to the patient.

export const MAX_FRAME = 4096;
const TOPIC_PREFIX = 'soma-nami/v1/';

/**
 * Picks the address the other phone should use from os.networkInterfaces().
 * A phone sharing its hotspot (iOS "bridge", Android "ap" or "swlan" interfaces) is preferred;
 * otherwise the first private IPv4 on any other interface. Never a public or
 * loopback address.
 */
export function pickLocalAddress(interfaces) {
  const found = [];
  for (const [name, addrs] of Object.entries(interfaces || {})) {
    for (const a of addrs || []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      const m = /^(\d+)\.(\d+)\./.exec(a.address);
      if (!m) continue;
      const x = Number(m[1]);
      const y = Number(m[2]);
      const priv = x === 10 || (x === 172 && y >= 16 && y <= 31) || (x === 192 && y === 168);
      if (priv) found.push({ address: a.address, hotspot: /^(bridge|ap|swlan)/.test(name) });
    }
  }
  const best = found.find((f) => f.hotspot) || found[0];
  return best ? best.address : null;
}

export function createPears({ emit, DHT, Hyperswarm, b4a, localAddress }) {
  let swarm = null;
  let boot = null;
  let epoch = 0; // a new host/join or a stop supersedes everything started before it
  const conns = new Set();

  async function teardown() {
    epoch++;
    const s = swarm;
    const b = boot;
    swarm = null;
    boot = null;
    for (const c of conns) c.destroy();
    conns.clear();
    // Every owned resource is released, even if an earlier one throws.
    await Promise.allSettled([s?.destroy(), b?.destroy()]);
  }

  function wire(conn, mine) {
    conns.add(conn);
    let buf = '';
    conn.on('error', () => {}); // surfaced through 'close'
    conn.on('close', () => {
      if (conns.delete(conn) && mine === epoch) emit({ ev: 'peer-left' });
    });
    conn.on('data', (chunk) => {
      if (mine !== epoch) return;
      buf += b4a.toString(chunk);
      if (buf.length > MAX_FRAME * 2) {
        buf = '';
        conn.destroy();
        emit({ ev: 'error', message: 'frame-too-large' });
        return;
      }
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (line.length > MAX_FRAME) continue;
        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          continue; // not ours; ignore, never crash the worklet
        }
        if (msg && msg.t === 'ack' && typeof msg.id === 'string') {
          emit({ ev: 'delivered', id: msg.id });
        } else if (msg && msg.t === 'text' && typeof msg.id === 'string' && typeof msg.text === 'string') {
          emit({ ev: 'message', id: msg.id, text: msg.text });
          conn.write(JSON.stringify({ t: 'ack', id: msg.id }) + '\n');
        }
      }
    });
    emit({ ev: 'peer' });
  }

  async function start(role, { host, port, code }) {
    await teardown();
    const mine = epoch;
    try {
      if (role === 'host') {
        host = localAddress();
        if (!host) return emit({ ev: 'error', message: 'no-local-network' });
      }
      const bootstrap = [{ host, port }];
      if (role === 'host') {
        boot = DHT.bootstrapper(port, host);
        await boot.ready();
      }
      if (mine !== epoch) return;
      swarm = new Hyperswarm({ dht: new DHT({ bootstrap, host, port: 0 }) });
      swarm.on('connection', (conn) => wire(conn, mine));
      const topic = DHT.hash(b4a.from(TOPIC_PREFIX + code));
      swarm.join(topic, role === 'host' ? { server: true, client: false } : { server: false, client: true });
      if (role === 'host') await swarm.flush();
      if (mine === epoch) emit({ ev: 'ready', host });
    } catch (e) {
      if (mine === epoch) emit({ ev: 'error', message: String(e && e.message ? e.message : e) });
    }
  }

  return {
    async handle(cmd) {
      if (!cmd || typeof cmd !== 'object') return;
      if (cmd.cmd === 'host' || cmd.cmd === 'join') return start(cmd.cmd, cmd);
      if (cmd.cmd === 'stop') return teardown();
      if (cmd.cmd === 'send') {
        if (conns.size === 0) return emit({ ev: 'error', message: 'no-peer', id: cmd.id });
        const frame = JSON.stringify({ t: 'text', id: cmd.id, text: cmd.text }) + '\n';
        if (frame.length > MAX_FRAME) return emit({ ev: 'error', message: 'too-long', id: cmd.id });
        for (const c of conns) c.write(frame);
      }
    },
    stop: teardown,
  };
}
