import { checkTranslation, quantities } from './numberCheck';

/**
 * Real TranslatePsy-AfriSLM 0.8B Q4 output for the 20 synthetic label lines of
 * the C2 spike (spike branch `spike/c2`, results/translate-0.8b.json). The
 * spike's first check flagged three of them only because the model wrote
 * "kidonge kimoja" for "1 tablet"; the number check here reads Swahili number
 * words, so all twenty pass, and the cases below break them on purpose.
 */
const C2_PAIRS: [string, string][] = [
  ['Take 1 tablet twice daily after meals.', 'Chukua kidonge kimoja mara mbili kila siku baada ya chakula.'],
  ['Paracetamol 500 mg tablets. Take 2 tablets every 8 hours.', 'Paracetamol 500 mg vidonge. Chukua vidonge 2 kila saa 8.'],
  ['Dose: 1x3 for 5 days.', 'Kipimo: 1x3 kwa siku 5.'],
  ['Amoxicillin 250 mg/5 ml oral suspension. Give 5 ml three times a day.', 'Amoxicillin 250 mg/5 ml suspension ya mdomo. Toa 5 ml mara tatu kwa siku.'],
  ['Do not take more than 8 tablets in 24 hours.', 'Usitumie zaidi ya vidonge 8 kwa saa 24.'],
  ['30 tablets.', 'Vidonge 30.'],
  ['Take 1 capsule once daily in the morning.', 'Chukua kidonge kimoja mara moja kila siku asubuhi.'],
  ['Metformin 850 mg. Take 1 tablet twice a day with food.', 'Metformin 850 mg. Chukua vidonge 1 mara mbili kwa siku pamoja na chakula.'],
  ['Amlodipine 5 mg. 1 tablet at night.', 'Amlodipine 5 mg. 1 vidonge usiku.'],
  ['Shake well before use. Take 10 ml every 6 hours.', 'Tetepeta vizuri kabla ya kutumia. Chukua 10 ml kila baada ya saa 6.'],
  ['Store below 25°C. Keep out of reach of children.', 'Hifadhi chini ya 25°C. Weka nje ya kupatikana kwa watoto.'],
  ['Take 2 tablets on day 1, then 1 tablet daily for 4 days.', 'Chukua vidonge 2 siku ya 1, kisha vidonge 1 kila siku kwa siku 4.'],
  [
    'Ibuprofen 400 mg. Take 1 tablet every 8 hours with food. Maximum 3 tablets a day.',
    'Ibuprofen 400 mg. Chukua vidonge 1 kila baada ya saa 8 pamoja na chakula. Kiasi cha juu cha vidonge 3 kwa siku.',
  ],
  ['Use within 14 days of opening.', 'Tumia ndani ya siku 14 baada ya kufunguliwa.'],
  ['Apply a thin layer 2 times a day for 7 days.', 'Tumia safu nyembamba mara 2 kwa siku kwa siku 7.'],
  ['Insulin 100 IU/ml. Inject 12 units before breakfast.', 'Insulin 100 IU/ml. Ingiza uniti 12 kabla ya kiamsha kinywa.'],
  [
    'Children 6 to 12 years: half a tablet (250 mg) every 6 hours.',
    'Watoto wenye umri wa miaka 6 hadi 12: nusu kibao (250 mg) kila saa 6.',
  ],
  ['Expiry: 03/2028. Batch: B2417.', 'Muda wa kumalizika: 03/2028. Kundi: B2417.'],
  [
    'Take 1 tablet every 12 hours. Complete the full course of 14 tablets.',
    'Chukua kidonge kimoja kila baada ya saa 12. Kamilisha kozi nzima ya vidonge 14.',
  ],
  ['Hydrochlorothiazide 12.5 mg. Take 1 tablet in the morning.', 'Hydrochlorothiazide 12.5 mg. Chukua vidonge 1 asubuhi.'],
];

const safe = (en: string, sw: string) => checkTranslation(en, sw).safe;

describe('the real C2 translations', () => {
  it.each(C2_PAIRS)('passes: %s', (en, sw) => {
    const r = checkTranslation(en, sw);
    expect({ line: en, ...r }).toMatchObject({ line: en, safe: true });
  });
});

describe('a number that changed', () => {
  it.each([
    ['Take 2 tablets every 8 hours.', 'Chukua vidonge 3 kila saa 8.', 'dose'],
    ['Take 2 tablets every 8 hours.', 'Chukua vidonge 2 kila saa 6.', 'interval'],
    ['Paracetamol 500 mg tablets.', 'Paracetamol 50 mg vidonge.', 'strength'],
    ['Hydrochlorothiazide 12.5 mg.', 'Hydrochlorothiazide 125 mg.', 'decimal point'],
    ['Dose: 1x3 for 5 days.', 'Kipimo: 1x2 kwa siku 5.', 'times sign'],
    ['Dose: 1x3 for 5 days.', 'Kipimo: 1x3 kwa siku 7.', 'days'],
    ['Do not take more than 8 tablets in 24 hours.', 'Usitumie zaidi ya vidonge 6 kwa saa 24.', 'limit'],
    ['Expiry: 03/2028.', 'Muda wa kumalizika: 03/2029.', 'year'],
    ['Insulin 100 IU/ml. Inject 12 units.', 'Insulin 100 IU/ml. Ingiza uniti 21.', 'digits swapped'],
  ])('refuses: %s -> %s (%s)', (en, sw) => {
    expect(safe(en, sw)).toBe(false);
  });

  it('says which number changed', () => {
    const r = checkTranslation('Take 2 tablets every 8 hours.', 'Chukua vidonge 3 kila saa 8.');
    expect(r.numbers).toEqual({ missing: ['2'], extra: ['3'] });
  });
});

describe('a number that went missing or appeared', () => {
  it.each([
    ['Complete the full course of 14 tablets.', 'Kamilisha kozi nzima ya vidonge.', 'dropped 14'],
    ['Take 1 tablet every 12 hours.', 'Chukua kidonge kila baada ya saa.', 'dropped 1 and 12'],
    ['Take 1 tablet in the morning.', 'Chukua vidonge 2 asubuhi.', 'invented 2'],
    ['Take the tablet with water.', 'Meza vidonge 2 pamoja na maji.', 'invented 2'],
    ['Expiry: 03/2028.', 'Muda wa kumalizika: 2028.', 'dropped month'],
    ['Keep for 5 days.', 'Weka kwa siku tano na siku saba.', 'invented a number word'],
  ])('refuses: %s -> %s (%s)', (en, sw) => {
    expect(safe(en, sw)).toBe(false);
  });
});

describe('frequency words carry numbers without digits', () => {
  it.each([
    ['Take 1 tablet twice daily.', 'Chukua kidonge 1 mara tatu kila siku.'],
    ['Take 1 tablet twice daily.', 'Chukua kidonge 1 mara moja kila siku.'],
    ['Take 1 tablet once daily.', 'Chukua kidonge 1 mara mbili kila siku.'],
    ['Take 1 tablet three times a day.', 'Chukua kidonge 1 mara nne kwa siku.'],
    ['Take 1 tablet 3 times a day.', 'Chukua kidonge 1 mara 2 kwa siku.'],
    ['Take 1 tablet twice a day.', 'Chukua kidonge 1 kwa siku.'],
    ['Take 1 tablet daily.', 'Chukua kidonge 1 mara mbili kwa siku.'],
  ])('refuses: %s -> %s', (en, sw) => {
    expect(safe(en, sw)).toBe(false);
  });

  it.each([
    ['Take 1 tablet twice daily.', 'Chukua kidonge kimoja mara mbili kila siku.'],
    ['Take 1 tablet twice a day.', 'Chukua kidonge 1 mara 2 kwa siku.'],
    ['Take 1 tablet three times a day.', 'Chukua kidonge kimoja mara tatu kwa siku.'],
    ['Take 1 tablet thrice daily.', 'Chukua kidonge kimoja mara tatu kwa siku.'],
    ['Take 1 tablet once daily.', 'Chukua kidonge kimoja mara moja kwa siku.'],
    ['Take 1 tablet daily.', 'Chukua kidonge kimoja kila siku.'],
    ['Take 1 tablet four times a day.', 'Chukua kidonge kimoja mara nne kwa siku.'],
  ])('accepts: %s -> %s', (en, sw) => {
    expect(safe(en, sw)).toBe(true);
  });

  it('does not count "once opened" as a frequency', () => {
    expect(quantities('Use within 14 days once opened.', 'en').frequencies).toEqual([]);
  });
});

describe('number words in Swahili and English', () => {
  it.each([
    ['Take 1 tablet.', 'Chukua kidonge kimoja.'],
    ['Take 2 tablets.', 'Chukua vidonge viwili.'],
    ['Take 3 tablets.', 'Chukua vidonge vitatu.'],
    ['Take 4 tablets.', 'Chukua vidonge vinne.'],
    ['Take 5 tablets.', 'Chukua vidonge vitano.'],
    ['Take 6 tablets.', 'Chukua vidonge sita.'],
    ['Take 7 tablets.', 'Chukua vidonge saba.'],
    ['Take 8 tablets.', 'Chukua vidonge nane.'],
    ['Take 9 tablets.', 'Chukua vidonge tisa.'],
    ['Take 10 tablets.', 'Chukua vidonge kumi.'],
    ['Take 12 ml every 6 hours.', 'Chukua mililita kumi na mbili kila saa sita.'],
    ['Take 25 ml.', 'Chukua mililita ishirini na tano.'],
    ['Take two tablets.', 'Chukua vidonge 2.'],
    ['Take twenty-one drops.', 'Chukua matone 21.'],
    ['Take a tablet.', 'Chukua kidonge kimoja.'],
  ])('reads %s / %s as the same', (en, sw) => {
    expect(safe(en, sw)).toBe(true);
  });

  it('refuses the neighbouring word', () => {
    expect(safe('Take 5 tablets.', 'Chukua vidonge sita.')).toBe(false);
    expect(safe('Take 3 tablets.', 'Chukua vidonge viwili.')).toBe(false);
    expect(safe('Take 12 ml.', 'Chukua mililita kumi na tatu.')).toBe(false);
    expect(safe('Take 12 ml.', 'Chukua mililita kumi.')).toBe(false);
  });
});

describe('fractions', () => {
  it.each([
    ['Take half a tablet.', 'Chukua nusu kidonge.'],
    ['Take 1/2 tablet.', 'Chukua nusu ya kidonge.'],
    ['Take ½ tablet.', 'Chukua nusu ya kidonge.'],
    ['Take a quarter of a tablet.', 'Chukua robo ya kidonge.'],
    ['Take 1/4 tablet.', 'Chukua robo ya kidonge.'],
    ['Take 1 and a half tablets.', 'Chukua kidonge kimoja na nusu.'],
    ['Take 1½ tablets.', 'Chukua kidonge kimoja na nusu.'],
    ['Take 2.5 ml.', 'Chukua mililita mbili na nusu.'],
    ['Take 2 and a half tablets.', 'Chukua vidonge 2.5.'],
  ])('accepts: %s / %s', (en, sw) => {
    expect(safe(en, sw)).toBe(true);
  });

  it.each([
    ['Take half a tablet.', 'Chukua kidonge kimoja.'],
    ['Take half a tablet.', 'Chukua robo ya kidonge.'],
    ['Take a quarter of a tablet.', 'Chukua nusu ya kidonge.'],
    ['Take 1 tablet.', 'Chukua kidonge kimoja na nusu.'],
    ['Take 1 and a half tablets.', 'Chukua vidonge viwili.'],
    ['Take 1/2 tablet.', 'Chukua kidonge 1.'],
    ['Take 1½ tablets.', 'Chukua vidonge 2.'],
  ])('refuses: %s / %s', (en, sw) => {
    expect(safe(en, sw)).toBe(false);
  });
});

describe('units', () => {
  it.each([
    ['Take 5 mg.', 'Chukua 5 ml.', 'mg to ml'],
    ['Take 5 ml.', 'Chukua 5 mg.', 'ml to mg'],
    ['Take 500 mg.', 'Chukua 500 mcg.', 'mg to mcg'],
    ['Take 1 tablet every 8 hours.', 'Chukua kidonge 1 kila siku 8.', 'hours to days'],
    ['Take 1 tablet every 8 hours.', 'Chukua kidonge 1 kila dakika 8.', 'hours to minutes'],
    ['Take 2 tablets.', 'Chukua kapsuli 2.', 'tablet to capsule'],
    ['Take 2 tablets for 3 days.', 'Chukua vidonge 2 kwa wiki 3.', 'days to weeks'],
    ['Take 2 tablets.', 'Chukua 2.', 'unit dropped'],
    ['Take 1 tablet before meals.', 'Chukua kidonge 1 baada ya chakula.', 'before to after'],
    ['Take 1 tablet after meals.', 'Chukua kidonge 1 kabla ya chakula.', 'after to before'],
    ['Take 1 tablet in the morning.', 'Chukua kidonge 1 usiku.', 'morning to night'],
    ['Store below 25°C.', 'Hifadhi chini ya 25°F.', 'celsius to fahrenheit'],
    ['Contains 5%.', 'Ina 5.', 'percent dropped'],
  ])('refuses: %s -> %s (%s)', (en, sw) => {
    expect(safe(en, sw)).toBe(false);
  });

  it('is fine with units written the other language\u2019s way', () => {
    expect(safe('Take 5 ml.', 'Chukua mililita 5.')).toBe(true);
    expect(safe('Take 500 milligrams.', 'Chukua miligramu 500.')).toBe(true);
    expect(safe('Take 500 micrograms.', 'Chukua mikrogramu 500.')).toBe(true);
    expect(safe('Take 1 tablet after meals.', 'Chukua kidonge 1 baada ya chakula.')).toBe(true);
    expect(safe('Take 1 tablet with food.', 'Chukua kidonge 1 pamoja na chakula.')).toBe(true);
    expect(safe('Take 2 tablets for 3 weeks.', 'Chukua vidonge 2 kwa wiki 3.')).toBe(true);
  });
});

describe('months', () => {
  it.each([
    ['Expiry: March 2028.', 'Muda wa kumalizika: Machi 2028.', true],
    ['Expiry: March 2028.', 'Muda wa kumalizika: Aprili 2028.', false],
    ['Use before Dec 2027.', 'Tumia kabla ya Desemba 2027.', true],
    ['Use before Dec 2027.', 'Tumia kabla ya Novemba 2027.', false],
    ['Expiry: May 2028.', 'Muda wa kumalizika: Mei 2028.', true],
    ['This may cause drowsiness.', 'Hii inaweza kusababisha usingizi.', true],
  ])('%s / %s -> %s', (en, sw, expected) => {
    expect(safe(en, sw)).toBe(expected);
  });
});

describe('edge cases', () => {
  it('passes lines with no quantities at all', () => {
    expect(safe('Shake well before use.', 'Tikisa vizuri kabla ya kutumia.')).toBe(true);
  });

  it('refuses a translation that is empty', () => {
    expect(safe('Take 1 tablet.', '')).toBe(false);
  });

  it('refuses an empty translation of a line with no numbers only if it adds something', () => {
    expect(safe('Shake well.', '')).toBe(true);
  });

  it('treats 1,000 and 1000 as one number', () => {
    expect(safe('Contains 1,000 IU.', 'Ina IU 1000.')).toBe(true);
  });

  it('treats 12,5 and 12.5 as one number', () => {
    expect(safe('Take 12.5 mg.', 'Chukua mg 12,5.')).toBe(true);
  });

  it('is not fooled by a number inside a batch code', () => {
    expect(safe('Batch: B2417.', 'Kundi: B2418.')).toBe(false);
  });
});
