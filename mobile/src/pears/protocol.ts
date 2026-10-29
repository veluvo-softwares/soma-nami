/**
 * Pharmacist -> patient send (card C7): the parts that don't need a network.
 *
 * Two phones on one Wi-Fi or hotspot, no internet. The pharmacist's phone is
 * the Hyperswarm bootstrap node; the patient's phone is given its address and
 * a 4-digit code. Hyperswarm's built-in bootstrap nodes are on the internet,
 * so the app must never be pointed at anything else than a local address:
 * `parseInvite` refuses public IPs.
 */

export const PEARS_PORT = 49737;
export const CODE_LENGTH = 4;
/** One instruction. Matches the worklet's frame limit with room for the JSON around it. */
export const MAX_INSTRUCTION_CHARS = 600;

export interface Invite {
  host: string;
  port: number;
  code: string;
}

function isLocalIPv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const o = m.slice(1).map((x) => Number(x));
  if (o.some((n, i) => n > 255 || String(n) !== m[i + 1])) return false; // no leading zeros, no 256
  const [a, b] = o as [number, number, number, number];
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
}

/** A fresh pairing code. `random` is injectable for tests; it returns [0, 1). */
export function makeCode(random: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < CODE_LENGTH; i++) s += Math.floor(random() * 10);
  return s;
}

/** What the pharmacist's screen shows and the patient types: `192.168.43.1-4821`. */
export function formatInvite(host: string, code: string): string {
  return `${host}-${code}`;
}

/** Parses what the patient typed. Null if it isn't a local address plus a code. */
export function parseInvite(input: string): Invite | null {
  const m = /^\s*(\d{1,3}(?:\.\d{1,3}){3})\s*[-\s:]\s*(\d{4})\s*$/.exec(input);
  if (!m) return null;
  const host = m[1]!;
  if (!isLocalIPv4(host)) return null;
  return { host, port: PEARS_PORT, code: m[2]! };
}

export type InstructionCheck = { ok: true; text: string } | { ok: false; reason: 'empty' | 'too-long' };

/** Tidies what the pharmacist typed. The text is otherwise sent exactly as typed. */
export function checkInstruction(raw: string): InstructionCheck {
  // Control characters (a paste from a PDF, say) never reach the patient's voice.
  const text = raw.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, ' ').replace(/[ \t]+/g, ' ').trim();
  if (text.length === 0) return { ok: false, reason: 'empty' };
  if (text.length > MAX_INSTRUCTION_CHARS) return { ok: false, reason: 'too-long' };
  return { ok: true, text };
}
