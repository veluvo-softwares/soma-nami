import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { PHRASE_IDS, PHRASES } from './phrases';

const MOBILE = join(__dirname, '..', '..');

describe('pre-rendered Swahili phrases', () => {
  it('every phrase has Swahili and English text', () => {
    for (const id of PHRASE_IDS) {
      expect(PHRASES[id].sw.trim()).not.toBe('');
      expect(PHRASES[id].en.trim()).not.toBe('');
    }
  });

  // Fails if a phrase was added to phrases.json without running
  // `node scripts/phrases/generate.mjs`, so the app never ships a silent prompt.
  it('every phrase has its clip on disk and in the generated asset index', () => {
    const index = readFileSync(join(MOBILE, 'src/speech/phraseAssets.ts'), 'utf8');
    for (const id of PHRASE_IDS) {
      expect({ id, clip: existsSync(join(MOBILE, `assets/phrases/sw/${id}.m4a`)) }).toEqual({ id, clip: true });
      expect(index).toContain(`  ${id}: require('../../assets/phrases/sw/${id}.m4a'),`);
    }
  });

  it('every clip was rendered from the current text (phrases.lock.json)', () => {
    const lock = JSON.parse(readFileSync(join(MOBILE, 'assets/phrases/phrases.lock.json'), 'utf8'));
    expect(Object.keys(lock).sort()).toEqual([...PHRASE_IDS].sort());
  });
});
