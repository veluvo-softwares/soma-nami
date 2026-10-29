import { createIpcLink, receiveReducer, sendReducer, type LinkEvent, type SendState, type Transport } from './link';

class FakeTransport implements Transport {
  written: string[] = [];
  private handler: (d: string) => void = () => undefined;
  write(data: string) {
    this.written.push(data);
  }
  onData(h: (d: string) => void) {
    this.handler = h;
  }
  push(data: string) {
    this.handler(data);
  }
}

describe('createIpcLink', () => {
  it('writes one JSON line per command, matching core.mjs', () => {
    const t = new FakeTransport();
    const link = createIpcLink(t);
    link.host({ port: 49737, code: '4821' });
    link.join({ host: '192.168.43.1', port: 49737, code: '4821' });
    link.send('m1', 'Take 1 tablet');
    link.stop();
    expect(t.written.map((w) => JSON.parse(w))).toEqual([
      { cmd: 'host', port: 49737, code: '4821' },
      { cmd: 'join', host: '192.168.43.1', port: 49737, code: '4821' },
      { cmd: 'send', id: 'm1', text: 'Take 1 tablet' },
      { cmd: 'stop' },
    ]);
    expect(t.written.every((w) => w.endsWith('\n') && w.indexOf('\n') === w.length - 1)).toBe(true);
  });

  it('delivers events split across chunks and several in one chunk', () => {
    const t = new FakeTransport();
    const link = createIpcLink(t);
    const seen: LinkEvent[] = [];
    link.subscribe((e) => seen.push(e));
    t.push('{"ev":"ready","host":"192.168');
    expect(seen).toEqual([]);
    t.push('.43.1"}\n{"ev":"peer"}\n{"ev":"mess');
    t.push('age","id":"m1","text":"Chukua 1 mara 3"}\n');
    expect(seen).toEqual([
      { ev: 'ready', host: '192.168.43.1' },
      { ev: 'peer' },
      { ev: 'message', id: 'm1', text: 'Chukua 1 mara 3' },
    ]);
  });

  it('ignores garbage lines and keeps going', () => {
    const t = new FakeTransport();
    const link = createIpcLink(t);
    const seen: LinkEvent[] = [];
    link.subscribe((e) => seen.push(e));
    t.push('not json\n{"nope":1}\n[1,2]\nnull\n{"ev":"peer"}\n');
    expect(seen).toEqual([{ ev: 'peer' }]);
  });

  it('stops delivering after unsubscribe', () => {
    const t = new FakeTransport();
    const link = createIpcLink(t);
    const seen: LinkEvent[] = [];
    const off = link.subscribe((e) => seen.push(e));
    off();
    t.push('{"ev":"peer"}\n');
    expect(seen).toEqual([]);
  });
});

const reduce = (events: Parameters<typeof sendReducer>[1][], from: SendState = { phase: 'starting' }) =>
  events.reduce(sendReducer, from);

describe('sendReducer (pharmacist)', () => {
  it('starting -> waiting (with the address to show) -> connected -> sending -> delivered', () => {
    expect(reduce([{ ev: 'ready', host: '192.168.43.1' }])).toEqual({ phase: 'waiting', host: '192.168.43.1' });
    expect(reduce([{ ev: 'ready', host: 'h' }, { ev: 'peer' }])).toEqual({ phase: 'connected', host: 'h' });
    expect(reduce([{ ev: 'ready', host: 'h' }, { ev: 'peer' }, { ev: 'sent', id: 'm1' }])).toEqual({ phase: 'sending', host: 'h', id: 'm1' });
    expect(reduce([{ ev: 'ready', host: 'h' }, { ev: 'peer' }, { ev: 'sent', id: 'm1' }, { ev: 'delivered', id: 'm1' }])).toEqual({ phase: 'delivered', host: 'h' });
  });

  it('cannot send before the patient is connected', () => {
    expect(reduce([{ ev: 'ready', host: 'h' }, { ev: 'sent', id: 'm1' }])).toEqual({ phase: 'waiting', host: 'h' });
  });

  it('ignores a late ack for an older instruction', () => {
    const s = reduce([{ ev: 'ready', host: 'h' }, { ev: 'peer' }, { ev: 'sent', id: 'm1' }, { ev: 'delivered', id: 'm1' }, { ev: 'sent', id: 'm2' }, { ev: 'delivered', id: 'm1' }]);
    expect(s).toEqual({ phase: 'sending', host: 'h', id: 'm2' });
  });

  it('a patient leaving mid-send is not "delivered"; they can reconnect and it is sendable again', () => {
    const left = reduce([{ ev: 'ready', host: 'h' }, { ev: 'peer' }, { ev: 'sent', id: 'm1' }, { ev: 'peer-left' }]);
    expect(left).toEqual({ phase: 'waiting', host: 'h' });
    // the ack that never came, or one that arrives after, cannot mark it delivered
    expect(sendReducer(left, { ev: 'delivered', id: 'm1' })).toEqual(left);
    expect(sendReducer(left, { ev: 'peer' })).toEqual({ phase: 'connected', host: 'h' });
  });

  it('a failed send returns to connected with the reason so the pharmacist can retry', () => {
    const s = reduce([{ ev: 'ready', host: 'h' }, { ev: 'peer' }, { ev: 'sent', id: 'm1' }, { ev: 'error', message: 'no-peer', id: 'm1' }]);
    expect(s).toEqual({ phase: 'connected', host: 'h', failed: 'no-peer' });
    expect(sendReducer(s, { ev: 'sent', id: 'm2' })).toEqual({ phase: 'sending', host: 'h', id: 'm2' });
  });

  it('an error for an older instruction does not disturb a newer send', () => {
    const s = reduce([{ ev: 'ready', host: 'h' }, { ev: 'peer' }, { ev: 'sent', id: 'm2' }, { ev: 'error', message: 'too-long', id: 'm1' }]);
    expect(s).toEqual({ phase: 'sending', host: 'h', id: 'm2' });
  });

  it('a link error with no id ends in the error state, and a stray peer after it does not revive it', () => {
    const s = reduce([{ ev: 'error', message: 'no-local-network' }, { ev: 'peer' }, { ev: 'ready', host: 'h' }]);
    expect(s).toEqual({ phase: 'error', message: 'no-local-network' });
  });
});

describe('receiveReducer (patient)', () => {
  const start: Parameters<typeof receiveReducer>[0] = { phase: 'connecting' };
  it('connecting -> waiting -> received', () => {
    const w = receiveReducer(start, { ev: 'ready' });
    expect(w).toEqual({ phase: 'waiting' });
    expect(receiveReducer(w, { ev: 'message', id: 'm1', text: 'Take 1' })).toEqual({ phase: 'received', id: 'm1', text: 'Take 1' });
  });
  it('keeps the instruction when the pharmacist disconnects or the link errors afterwards', () => {
    const got = receiveReducer(start, { ev: 'message', id: 'm1', text: 'Take 1 tablet' });
    expect(receiveReducer(got, { ev: 'peer-left' })).toEqual(got);
    expect(receiveReducer(got, { ev: 'error', message: 'x' })).toEqual(got);
  });
  it('a newer instruction replaces the older one', () => {
    const a = receiveReducer(start, { ev: 'message', id: 'm1', text: 'A' });
    expect(receiveReducer(a, { ev: 'message', id: 'm2', text: 'B' })).toEqual({ phase: 'received', id: 'm2', text: 'B' });
  });
  it('shows an error before anything was received', () => {
    expect(receiveReducer({ phase: 'waiting' }, { ev: 'error', message: 'boom' })).toEqual({ phase: 'error', message: 'boom' });
  });
});
