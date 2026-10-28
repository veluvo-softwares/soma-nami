import { PHRASES, type PhraseId } from '../speech/phrases';
import { checkTranslation } from './numberCheck';
import { EXPIRY_YEARS, spokenClipsFor } from './spokenTemplate';

const TAB_WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const swText = (clips: PhraseId[]) => clips.map((c) => PHRASES[c].sw).join(' ');
const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

describe('every clip the templates can use exists', () => {
  it('is in phrases.json with Swahili text', () => {
    const ids = Object.keys(PHRASES).filter((id) => id.startsWith('tpl_') || id.startsWith('tafsiri_'));
    expect(ids.length).toBe(69);
    for (const id of ids) expect(PHRASES[id as PhraseId].sw.trim()).not.toBe('');
  });
});

describe('dose lines: count, form, frequency, duration', () => {
  it.each(NUMBERS)('Take %i tablet(s) with its own clip', (n) => {
    const line = `Take ${n} tablet${n > 1 ? 's' : ''}.`;
    expect(spokenClipsFor(line)).toEqual(['tpl_take', `tpl_tab_${n}`]);
    expect(spokenClipsFor(`Take ${TAB_WORDS[n - 1]} tablet${n > 1 ? 's' : ''}`)).toEqual(['tpl_take', `tpl_tab_${n}`]);
  });

  it.each(NUMBERS)('Take %i capsule(s) with its own clip', (n) => {
    expect(spokenClipsFor(`Take ${n} capsule${n > 1 ? 's' : ''}.`)).toEqual(['tpl_take', `tpl_cap_${n}`]);
  });

  it('reads "a tablet" as one', () => {
    expect(spokenClipsFor('Take a tablet.')).toEqual(['tpl_take', 'tpl_tab_1']);
  });

  it.each([
    ['Take half a tablet.', 'tpl_tab_half'],
    ['Take 1/2 tablet.', 'tpl_tab_half'],
    ['Take ½ tablet.', 'tpl_tab_half'],
    ['Take half of a tablet.', 'tpl_tab_half'],
    ['Take a quarter of a tablet.', 'tpl_tab_quarter'],
    ['Take 1/4 tablet.', 'tpl_tab_quarter'],
    ['Take 1 and a half tablets.', 'tpl_tab_1_5'],
    ['Take 1½ tablets.', 'tpl_tab_1_5'],
    ['Take 2 and a half tablets.', 'tpl_tab_2_5'],
    ['Take 2.5 tablets.', 'tpl_tab_2_5'],
  ])('fractions: %s', (line, clip) => {
    expect(spokenClipsFor(line)).toEqual(['tpl_take', clip]);
  });

  it.each([
    ['once daily', 1],
    ['once a day', 1],
    ['daily', 1],
    ['twice daily', 2],
    ['twice a day', 2],
    ['thrice daily', 3],
    ['3 times a day', 3],
    ['three times a day', 3],
    ['4 times a day', 4],
    ['five times daily', 5],
    ['6 times a day', 6],
  ])('frequency "%s" is %i a day', (freq, n) => {
    expect(spokenClipsFor(`Take 1 tablet ${freq}.`)).toEqual(['tpl_take', 'tpl_tab_1', `tpl_freq_${n}`]);
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 14])('duration for %i days', (d) => {
    expect(spokenClipsFor(`Take 2 tablets 3 times a day for ${d} days.`)).toEqual([
      'tpl_take',
      'tpl_tab_2',
      'tpl_freq_3',
      `tpl_days_${d}`,
    ]);
  });

  it('allows a duration with no frequency, and "for 1 day"', () => {
    expect(spokenClipsFor('Take 2 tablets for 5 days.')).toEqual(['tpl_take', 'tpl_tab_2', 'tpl_days_5']);
    expect(spokenClipsFor('Take 1 tablet twice daily for 1 day')).toEqual(['tpl_take', 'tpl_tab_1', 'tpl_freq_2', 'tpl_days_1']);
  });

  it('is not bothered by case or spacing', () => {
    expect(spokenClipsFor('  TAKE  2   TABLETS  TWICE  DAILY ')).toEqual(['tpl_take', 'tpl_tab_2', 'tpl_freq_2']);
  });

  it('takes every number from the original line (all combinations)', () => {
    for (const n of NUMBERS) {
      for (const f of [1, 2, 3, 4, 5, 6]) {
        for (const d of [1, 5, 10, 14]) {
          const line = `Take ${n} tablets ${f} times a day for ${d} days.`;
          expect(spokenClipsFor(line)).toEqual(['tpl_take', `tpl_tab_${n}`, `tpl_freq_${f}`, `tpl_days_${d}`]);
        }
      }
    }
  });
});

describe('what is spoken says the same as the original (number check on the clip text)', () => {
  const lines = [
    ...NUMBERS.map((n) => `Take ${n} tablet${n > 1 ? 's' : ''}.`),
    ...NUMBERS.map((n) => `Take ${n} capsule${n > 1 ? 's' : ''} twice daily.`),
    'Take half a tablet once daily.',
    'Take a quarter of a tablet.',
    'Take 1 and a half tablets 3 times a day.',
    'Take 2 and a half tablets for 7 days.',
    ...[1, 2, 3, 4, 5, 6].map((f) => `Take 1 tablet ${f} times a day for 5 days.`),
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 14].map((d) => `Take 2 tablets 3 times a day for ${d} days.`),
  ];
  it.each(lines)('%s', (line) => {
    const clips = spokenClipsFor(line)!;
    expect(clips).not.toBeNull();
    const r = checkTranslation(line, swText(clips));
    expect({ line, sw: swText(clips), ...r }).toMatchObject({ safe: true });
  });
});

describe('expiry lines', () => {
  // The number check can't read a spoken year ("elfu mbili ishirini na nane"),
  // so the spoken text is pinned here instead.
  it.each([
    ['Expiry: 03/2028.', 'Tumia kabla ya Machi elfu mbili ishirini na nane'],
    ['Use before December 2031', 'Tumia kabla ya Desemba elfu mbili thelathini na moja'],
    ['Exp: Jan 2026', 'Tumia kabla ya Januari elfu mbili ishirini na sita'],
    ['Expiry: 05/2030', 'Tumia kabla ya Mei elfu mbili thelathini'],
    ['Expiry: 11/2035', 'Tumia kabla ya Novemba elfu mbili thelathini na tano'],
  ])('says %s as "%s"', (line, sw) => {
    expect(swText(spokenClipsFor(line)!)).toBe(sw);
  });

  it.each([
    ['Expiry: 03/2028', 'tpl_month_3', 'tpl_year_2028'],
    ['EXP 12-2030.', 'tpl_month_12', 'tpl_year_2030'],
    ['Exp: 1/2027', 'tpl_month_1', 'tpl_year_2027'],
    ['Expiry date: March 2028', 'tpl_month_3', 'tpl_year_2028'],
    ['Use before Dec 2031', 'tpl_month_12', 'tpl_year_2031'],
    ['Best before: September 2035', 'tpl_month_9', 'tpl_year_2035'],
    ['Expires May 2029', 'tpl_month_5', 'tpl_year_2029'],
  ])('%s', (line, month, year) => {
    expect(spokenClipsFor(line)).toEqual(['tpl_expiry_lead', month, year]);
  });

  it('has a month clip for 1-12 and a year clip for every supported year', () => {
    for (let m = 1; m <= 12; m++) {
      expect(spokenClipsFor(`Expiry: ${String(m).padStart(2, '0')}/2028`)).toEqual(['tpl_expiry_lead', `tpl_month_${m}`, 'tpl_year_2028']);
    }
    for (const y of EXPIRY_YEARS) {
      expect(spokenClipsFor(`Expiry: 06/${y}`)).toEqual(['tpl_expiry_lead', 'tpl_month_6', `tpl_year_${y}`]);
    }
  });
});

describe('lines that do not fit are not spoken', () => {
  it.each([
    ['empty', ''],
    ['no number to take', 'Take tablets.'],
    ['11 is past the clips', 'Take 11 tablets.'],
    ['0 tablets', 'Take 0 tablets.'],
    ['half a capsule has no clip', 'Take half a capsule.'],
    ['a quarter of a capsule', 'Take 1/4 capsule.'],
    ['3 and a half tablets has no clip', 'Take 3 and a half tablets.'],
    ['an unknown frequency', 'Take 1 tablet every 8 hours.'],
    ['7 times a day is past the clips', 'Take 1 tablet 7 times a day.'],
    ['12 days has no clip', 'Take 1 tablet twice daily for 12 days.'],
    ['an extra instruction', 'Take 1 tablet twice daily after meals.'],
    ['an extra sentence', 'Take 1 tablet. Do not drive.'],
    ['a different verb', 'Chew 1 tablet.'],
    ['a different form', 'Take 5 ml twice daily.'],
    ['a strength in the line', 'Paracetamol 500 mg tablets. Take 2 tablets.'],
    ['a maximum', 'Do not take more than 8 tablets in 24 hours.'],
    ['shorthand', 'Dose: 1x3 for 5 days.'],
    ['a pack count', '30 tablets.'],
    ['a year outside 2026-2035', 'Expiry: 03/2036'],
    ['a year before 2026', 'Expiry: 03/2025'],
    ['a two-digit year', 'Expiry: 03/28'],
    ['month 13', 'Expiry: 13/2028'],
    ['month 0', 'Expiry: 00/2028'],
    ['a year with no month', 'Expiry: 2028'],
    ['a day as well', 'Expiry: 15/03/2028'],
    ['a verb "may"', 'This may cause drowsiness 2028'],
    ['a Swahili line', 'Chukua kidonge kimoja kila siku.'],
    ['a batch', 'Batch: B2417'],
  ])('%s', (_why, line) => {
    expect(spokenClipsFor(line)).toBeNull();
  });
});
