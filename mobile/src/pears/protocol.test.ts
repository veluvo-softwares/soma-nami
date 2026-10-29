import { checkInstruction, formatInvite, makeCode, MAX_INSTRUCTION_CHARS, parseInvite, PEARS_PORT } from './protocol';

describe('parseInvite', () => {
  it.each([
    ['192.168.43.1-4821', '192.168.43.1'],
    ['172.20.10.1-0007', '172.20.10.1'],
    ['10.0.0.5-1234', '10.0.0.5'],
    ['  192.168.1.20 4821 ', '192.168.1.20'],
    ['192.168.1.20:4821', '192.168.1.20'],
    ['169.254.3.4-1111', '169.254.3.4'],
  ])('accepts %s', (input, host) => {
    expect(parseInvite(input)).toEqual({ host, port: PEARS_PORT, code: input.replace(/\D/g, '').slice(-4) });
  });

  it.each([
    ['public IP, so the app never talks to the internet', '8.8.8.8-4821'],
    ['a carrier address', '41.90.1.2-4821'],
    ['172.15.0.1 is outside the private block', '172.15.0.1-4821'],
    ['172.32.0.1 is outside the private block', '172.32.0.1-4821'],
    ['loopback', '127.0.0.1-4821'],
    ['a hostname', 'example.com-4821'],
    ['octet over 255', '192.168.1.256-4821'],
    ['leading zero octet', '192.168.01.1-4821'],
    ['code too short', '192.168.1.20-482'],
    ['code too long', '192.168.1.20-48211'],
    ['no code', '192.168.1.20'],
    ['empty', ''],
  ])('refuses %s', (_why, input) => {
    expect(parseInvite(input)).toBeNull();
  });

  it('round-trips what the pharmacist screen shows', () => {
    expect(parseInvite(formatInvite('192.168.43.1', '0420'))).toEqual({ host: '192.168.43.1', port: PEARS_PORT, code: '0420' });
  });
});

describe('makeCode', () => {
  it('is four digits, including leading zeros', () => {
    expect(makeCode(() => 0)).toBe('0000');
    expect(makeCode(() => 0.999999)).toBe('9999');
    expect(makeCode()).toMatch(/^\d{4}$/);
  });
});

describe('checkInstruction', () => {
  it('sends the text exactly as typed, trimmed', () => {
    const text = 'Chukua 1 mara 3 baada ya chakula.\nTake 1 tablet 3 times a day.';
    expect(checkInstruction(`  ${text}  `)).toEqual({ ok: true, text });
  });
  it('keeps numbers and units untouched', () => {
    expect(checkInstruction('500 mg 1×3 for 5 days')).toEqual({ ok: true, text: '500 mg 1×3 for 5 days' });
  });
  it('strips control characters so they never reach the voice', () => {
    expect(checkInstruction('Take\u0000 1\u0007 tablet')).toEqual({ ok: true, text: 'Take 1 tablet' });
  });
  it('refuses empty and whitespace-only input', () => {
    expect(checkInstruction('')).toEqual({ ok: false, reason: 'empty' });
    expect(checkInstruction(' \n\t ')).toEqual({ ok: false, reason: 'empty' });
  });
  it('refuses an instruction over the limit and accepts one at the limit', () => {
    expect(checkInstruction('a'.repeat(MAX_INSTRUCTION_CHARS))).toMatchObject({ ok: true });
    expect(checkInstruction('a'.repeat(MAX_INSTRUCTION_CHARS + 1))).toEqual({ ok: false, reason: 'too-long' });
  });
});
