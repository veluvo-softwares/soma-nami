import type { Invite } from './protocol';

/** What the worklet tells the app. Mirrors mobile/pears/core.mjs. */
export type LinkEvent =
  | { ev: 'ready'; host?: string }
  | { ev: 'peer' }
  | { ev: 'peer-left' }
  | { ev: 'message'; id: string; text: string }
  | { ev: 'delivered'; id: string }
  | { ev: 'error'; message: string; id?: string };

export type LinkListener = (event: LinkEvent) => void;

export interface PearsLink {
  /** Pharmacist: start the bootstrap node on this phone's own address and wait for the patient. */
  host(options: Pick<Invite, 'port' | 'code'>): void;
  /** Patient: connect through the pharmacist's bootstrap node. */
  join(invite: Invite): void;
  /** Sends one instruction; `id` comes back in `delivered` or `error`. */
  send(id: string, text: string): void;
  stop(): void;
  subscribe(listener: LinkListener): () => void;
}

/** A duplex byte pipe to the worklet (react-native-bare-kit's IPC, or a fake). */
export interface Transport {
  write(data: string): void;
  onData(handler: (data: string) => void): void;
}

/** Newline-delimited JSON over a transport. A line that isn't an event is ignored, never thrown. */
export function createIpcLink(transport: Transport): PearsLink {
  const listeners = new Set<LinkListener>();
  let buf = '';
  transport.onData((chunk) => {
    buf += chunk;
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      let event: unknown;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }
      if (event && typeof event === 'object' && typeof (event as { ev?: unknown }).ev === 'string') {
        for (const l of [...listeners]) l(event as LinkEvent);
      }
    }
  });
  const command = (c: object) => transport.write(JSON.stringify(c) + '\n');
  return {
    host: (o) => command({ cmd: 'host', ...o }),
    join: (i) => command({ cmd: 'join', ...i }),
    send: (id, text) => command({ cmd: 'send', id, text }),
    stop: () => command({ cmd: 'stop' }),
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

/** Screen state for the pharmacist's side. */
export type SendState =
  | { phase: 'starting' }
  | { phase: 'waiting'; host: string }
  | { phase: 'connected'; host: string; failed?: string }
  | { phase: 'sending'; host: string; id: string }
  | { phase: 'delivered'; host: string }
  | { phase: 'error'; message: string };

export type SendAction = LinkEvent | { ev: 'sent'; id: string };

export function sendReducer(state: SendState, action: SendAction): SendState {
  const host = 'host' in state ? state.host : '';
  switch (action.ev) {
    case 'ready':
      return state.phase === 'starting' && action.host ? { phase: 'waiting', host: action.host } : state;
    case 'peer':
      // A peer before we're listening can't happen; ignore it rather than invent an address.
      return state.phase === 'starting' || state.phase === 'error' ? state : { phase: 'connected', host };
    case 'peer-left':
      // The patient can come back. An instruction in flight is NOT marked delivered.
      return state.phase === 'starting' || state.phase === 'error' ? state : { phase: 'waiting', host };
    case 'sent':
      return state.phase === 'connected' || state.phase === 'delivered'
        ? { phase: 'sending', host, id: action.id }
        : state;
    case 'delivered':
      // Only the instruction we're waiting on counts; a late ack for an older one is ignored.
      return state.phase === 'sending' && state.id === action.id ? { phase: 'delivered', host } : state;
    case 'error':
      // A failed send keeps the connection so the pharmacist can try again.
      if (action.id !== undefined) {
        return state.phase === 'sending' && state.id === action.id
          ? { phase: 'connected', host, failed: action.message }
          : state;
      }
      return { phase: 'error', message: action.message };
    default:
      return state;
  }
}

/** Screen state for the patient's side. */
export type ReceiveState =
  | { phase: 'connecting' }
  | { phase: 'waiting' }
  | { phase: 'received'; id: string; text: string }
  | { phase: 'error'; message: string };

export function receiveReducer(state: ReceiveState, event: LinkEvent): ReceiveState {
  switch (event.ev) {
    case 'ready':
      return state.phase === 'connecting' ? { phase: 'waiting' } : state;
    case 'message':
      // A newer instruction replaces the old one on screen.
      return { phase: 'received', id: event.id, text: event.text };
    case 'error':
      // A link error after an instruction arrived must not erase it from the screen.
      return state.phase === 'received' ? state : { phase: 'error', message: event.message };
    case 'peer-left':
      // What was received stays on screen; a lost connection must not erase the instruction.
      return state;
    default:
      return state;
  }
}
