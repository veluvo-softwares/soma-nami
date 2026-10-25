// Shared helpers for the C2 spike: process-tree RSS sampling, timing, WAV
// writing and simple text-distance metrics. No QVAC imports here.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// ---- memory -------------------------------------------------------------
// The SDK may run inference in child processes, so we sum VmRSS over this
// process and every descendant, sampled every `intervalMs`.

function childrenOf(pid) {
  try {
    const tasks = readdirSync(`/proc/${pid}/task`);
    const kids = [];
    for (const t of tasks) {
      try {
        const c = readFileSync(`/proc/${pid}/task/${t}/children`, 'utf8').trim();
        if (c) kids.push(...c.split(/\s+/).map(Number));
      } catch { /* thread gone */ }
    }
    return kids;
  } catch { return []; }
}

function rssKb(pid) {
  try {
    const m = readFileSync(`/proc/${pid}/status`, 'utf8').match(/VmRSS:\s+(\d+)/);
    return m ? Number(m[1]) : 0;
  } catch { return 0; }
}

const CLK_TCK = 100; // Linux default USER_HZ

// utime + stime of one process, in seconds
function cpuS(pid) {
  try {
    const s = readFileSync(`/proc/${pid}/stat`, 'utf8');
    const f = s.slice(s.lastIndexOf(')') + 2).split(' ');
    return (Number(f[11]) + Number(f[12])) / CLK_TCK;
  } catch { return 0; }
}

export function treeRssMb(root = process.pid, cpuByPid = null) {
  const seen = new Set();
  const stack = [root];
  let kb = 0;
  while (stack.length) {
    const p = stack.pop();
    if (seen.has(p)) continue;
    seen.add(p);
    kb += rssKb(p);
    if (cpuByPid) cpuByPid.set(p, Math.max(cpuByPid.get(p) ?? 0, cpuS(p)));
    stack.push(...childrenOf(p));
  }
  return { mb: kb / 1024, procs: seen.size };
}

export class MemSampler {
  constructor(intervalMs = 100) {
    this.intervalMs = intervalMs;
    this.peak = 0;
    this.procs = 0;
    this.timer = null;
  }
  start() {
    this.peak = 0;
    this.cpu = new Map();
    this.baseline = treeRssMb(process.pid, this.cpu).mb;
    this.timer = setInterval(() => this.sample(), this.intervalMs);
    this.timer.unref?.();
    return this;
  }
  sample() {
    const { mb, procs } = treeRssMb(process.pid, this.cpu);
    if (mb > this.peak) { this.peak = mb; this.procs = procs; }
  }
  // Cumulative CPU seconds (user+sys) of the process tree so far. Unlike wall
  // time this does not grow when the sandbox is throttled or contended.
  cpuSeconds() {
    this.sample();
    let s = 0;
    for (const v of this.cpu.values()) s += v;
    return s;
  }
  // Returns peak tree RSS in MB since start().
  stop() {
    this.sample();
    clearInterval(this.timer);
    return { peakMb: round(this.peak), baselineMb: round(this.baseline), procs: this.procs, cpuS: round(this.cpuSeconds()) };
  }
}

export const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

export async function timed(fn) {
  const t0 = performance.now();
  const value = await fn();
  return { value, ms: Math.round(performance.now() - t0) };
}

// Wall time plus CPU seconds consumed by the whole process tree.
export async function timedCpu(mem, fn) {
  const c0 = mem.cpuSeconds();
  const r = await timed(fn);
  return { ...r, cpuS: round(mem.cpuSeconds() - c0, 2) };
}

// The SDK runs inference in a `bare` child process that survives if node is
// killed. Kill descendants when we are interrupted so no 2 GB orphan remains.
function descendants(pid) {
  const out = [];
  for (const c of childrenOf(pid)) out.push(c, ...descendants(c));
  return out;
}
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    for (const p of descendants(process.pid)) { try { process.kill(p, 'SIGKILL'); } catch { /* gone */ } }
    process.exit(130);
  });
}

// ---- files --------------------------------------------------------------

export function writeJson(path, obj) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(obj, null, 2) + '\n');
}

export function writeWav(path, samples, sampleRate) {
  mkdirSync(dirname(path), { recursive: true });
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-32768, Math.min(32767, Math.round(samples[i] ?? 0)));
    data.writeInt16LE(v, i * 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(sampleRate, 24); h.writeUInt32LE(sampleRate * 2, 28); h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  writeFileSync(path, Buffer.concat([h, data]));
}

// ---- metrics ------------------------------------------------------------

export function normalise(s) {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

export function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

// Character error rate on normalised text (0 = perfect).
export function cer(ref, hyp) {
  const r = normalise(ref), h = normalise(hyp);
  return r.length ? levenshtein([...r], [...h]) / r.length : (h.length ? 1 : 0);
}

// Word error rate on normalised text.
export function wer(ref, hyp) {
  const r = normalise(ref).split(' ').filter(Boolean);
  const h = normalise(hyp).split(' ').filter(Boolean);
  return r.length ? levenshtein(r, h) / r.length : (h.length ? 1 : 0);
}

export const progress = (label) => (p) => {
  if (p?.percentage !== undefined && Math.round(p.percentage) % 25 === 0) {
    process.stderr.write(`  [${label}] download ${p.percentage.toFixed(0)}%\n`);
  }
};
