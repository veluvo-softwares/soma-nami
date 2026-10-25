export type LineLanguage = 'en' | 'sw';

/**
 * Common Swahili words on medicine packs and notices. Used only to decide
 * which voice may read a line: Supertonic speaks English and has no Swahili,
 * so a Swahili line is shown but not spoken by it (docs/scope.md §6).
 */
const SWAHILI_WORDS = new Set([
  'ya', 'na', 'kwa', 'wa', 'za', 'la', 'cha', 'vya', 'ni', 'si', 'katika', 'ndani', 'hii', 'huu', 'hiki',
  'mara', 'siku', 'saa', 'kila', 'kabla', 'baada', 'bila', 'au', 'pia', 'tu', 'zaidi', 'chini', 'juu',
  'dawa', 'kidonge', 'vidonge', 'kijiko', 'vijiko', 'maji', 'safi', 'chakula', 'pakiti', 'lita', 'tumia',
  'meza', 'kunywa', 'yeyusha', 'hifadhi', 'weka', 'mbali', 'watoto', 'mtoto', 'watu', 'wazima', 'wakubwa',
  'mwilini', 'kurejesha', 'chumvi', 'usitumie', 'usizidishe', 'muulize', 'daktari', 'mfamasia', 'moja',
  'mbili', 'tatu', 'nne', 'tano', 'asubuhi', 'mchana', 'jioni', 'usiku', 'tarehe', 'mwisho', 'matumizi',
  'maelekezo', 'tahadhari', 'hospitali', 'mgonjwa', 'kipimo', 'dozi',
]);

/**
 * 'sw' when at least a third of a line's words (and at least one) are known
 * Swahili words; otherwise 'en'. Digits and punctuation are ignored. A line of
 * only numbers or codes counts as English, which Supertonic reads fine.
 */
export function detectLineLanguage(text: string): LineLanguage {
  const words = text
    .toLowerCase()
    .split(/[^a-zà-ÿ]+/)
    .filter((w) => w.length > 0);
  if (words.length === 0) return 'en';
  const hits = words.filter((w) => SWAHILI_WORDS.has(w)).length;
  return hits >= 1 && hits / words.length >= 1 / 3 ? 'sw' : 'en';
}
