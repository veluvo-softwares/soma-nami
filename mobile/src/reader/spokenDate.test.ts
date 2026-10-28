import { MONTHS_EN, MONTHS_SW, speakDates } from './spokenDate';

describe('speakDates (printed date -> what the voice says)', () => {
  const cases: [string, string, string][] = [
    ['MM/YYYY', 'Exp: 08/2028', 'Exp: August 2028'],
    ['MM/YYYY, no space', 'EXP08/2028', 'EXP August 2028'],
    ['DD/MM/YYYY, no space', 'EXP12/08/2028', 'EXP 12 August 2028'],
    ['MM/YY', 'Exp 08/28', 'Exp August 2028'],
    ['MM-YYYY', 'Expiry: 03-2029', 'Expiry: March 2029'],
    ['MM.YYYY', 'Use by 12.2027', 'Use by December 2027'],
    ['MM-YY', 'EXP 11-27', 'EXP November 2027'],
    ['DD/MM/YYYY (day first)', 'EXP 12/08/2028', 'EXP 12 August 2028'],
    ['DD/MM/YYYY where it could be MM/DD', 'Exp 05/06/2027', 'Exp 5 June 2027'],
    ['DD-MM-YYYY', 'Exp: 01-02-2029', 'Exp: 1 February 2029'],
    ['DD.MM.YYYY', 'Exp: 31.12.2028', 'Exp: 31 December 2028'],
    ['leap day', 'Exp 29/02/2028', 'Exp 29 February 2028'],
    ['month word, short', 'EXP AUG 2028', 'EXP August 2028'],
    ['month word, full', 'Best before: august 2028', 'Best before: August 2028'],
    ['month word with a full stop', 'Exp Sept. 2027', 'Exp September 2027'],
    ['month word with a slash', 'EXP JUN/2028', 'EXP June 2028'],
    ['month word with a day', 'Exp 12 AUG 2028', 'Exp 12 August 2028'],
    ['date at the end of a sentence', 'Use before 08/2028.', 'Use before August 2028.'],
    ['date with text after it', 'Exp: 08/2028 Store below 30°C', 'Exp: August 2028 Store below 30°C'],
    ['two dates on a line', 'Exp 08/2028 or 09/2028', 'Exp August 2028 or September 2028'],
  ];
  it.each(cases)('%s: %s', (_name, input, expected) => {
    expect(speakDates(input, 'en', true)).toBe(expected);
  });

  it('uses Swahili month names for the Swahili template clips', () => {
    expect(speakDates('Exp: 08/2028', 'sw')).toBe('Exp: Agosti 2028');
    expect(speakDates('EXP 12/03/2029', 'sw')).toBe('EXP 12 Machi 2029');
    expect(speakDates('EXP DEC 2027', 'sw')).toBe('EXP Desemba 2027');
  });

  const notDates: [string, string][] = [
    ['month 13', 'Exp: 13/2028'],
    ['month 00', 'Exp: 00/2028'],
    ['month 13 with a day', 'Exp 12/13/2028'],
    ['day 32', 'Exp 32/08/2028'],
    ['day 0', 'Exp 00/08/2028'],
    ['30 February', 'Exp 30/02/2028'],
    ['29 February in a non-leap year', 'Exp 29/02/2027'],
    ['two-digit year with a day', 'Exp 12/08/28'],
    ['mixed separators', 'Exp 12/08-2028'],
    ['year out of range', 'Exp 08/1928'],
    ['year out of range, two digits', 'Exp 08/12'],
    ['OCR noise in the date', 'Exp: 0B/2O28'],
    ['three-digit year', 'Exp: 08/202'],
    ['five-digit year', 'Exp: 08/20288'],
    ['a fraction', 'Take 1/2 tablet'],
    ['a dose ratio', 'Strength 10/20 mg'],
    ['a longer run of numbers', 'Ref 12/08/2028/05'],
    ['a decimal', 'Contains 1.08/2028 g'],
    ['month word, month-looking word', 'Exp: MARCH 2O28'],
    ['a dose, not a month and year', 'Take may 25 mg'],
    ['month word without a year', 'Store in AUG'],
    ['plain text', 'Take one capsule three times a day'],
    ['empty', ''],
  ];
  it.each(notDates)('leaves it as it is: %s (%s)', (_name, input) => {
    expect(speakDates(input)).toBe(input);
  });

  it('says a two-digit year only when told the line has an expiry word', () => {
    expect(speakDates('08/28', 'en', false)).toBe('08/28');
    expect(speakDates('08/2028', 'en', false)).toBe('August 2028');
    expect(speakDates('12/08/2028', 'en', false)).toBe('12 August 2028');
  });

  it('has twelve months in each language, in calendar order', () => {
    expect(MONTHS_EN).toHaveLength(12);
    expect(MONTHS_SW).toHaveLength(12);
    expect(MONTHS_EN[0]).toBe('January');
    expect(MONTHS_SW[11]).toBe('Desemba');
  });
});
