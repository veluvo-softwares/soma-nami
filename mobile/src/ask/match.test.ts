import { matchQuestion, similarity } from './match';
import type { QuestionId } from './questions';

// Whisper small's real Swahili transcripts from the C2 spike
// (spike/results/asrq_WHISPER_SMALL_Q8_0.json), and what they were meant to be.
const SPIKE_HEARD: [string, QuestionId][] = [
  ['Dawahi Naisha Mudalini', 'expiry'],
  ['Dawahi Naisha Muna Lini.', 'expiry'],
  ['Dawahii inaisha muda lini?', 'expiry'],
  ['Hii ni dawa gani?', 'what_is_it'],
  ['Hini dawagani?', 'what_is_it'],
  ['Ini dawa gani?', 'what_is_it'],
  ['Heeni dawagani.', 'what_is_it'],
  ['Ni sometena.', 'read_again'],
  ['Nemeze kabla aw baadia cha kula?', 'with_food'],
];

// Out-of-list questions from the spike: the matcher must not pick a list entry.
const SPIKE_OFF_LIST = [
  'Misalama kwa mtotu angu, ani',
  'Misalama kumto toangu, ani',
  'Naweza kuyona pombe.',
  'Naweza puhiyona pombe?',
  'Habariya asubuhi.',
  'Habari asubuhi',
];

describe('matchQuestion on rough Swahili transcripts', () => {
  it.each(SPIKE_HEARD)('"%s" -> %s', (heard, id) => {
    expect(matchQuestion(heard)).toMatchObject({ kind: 'match', id });
  });

  it.each(SPIKE_OFF_LIST)('off-list "%s" is not matched to a question', (heard) => {
    expect(matchQuestion(heard).kind).not.toBe('match');
  });

  it('short forms people actually say', () => {
    expect(matchQuestion('saa ngapi')).toMatchObject({ kind: 'match', id: 'time_of_day' });
    expect(matchQuestion('mara ngapi')).toMatchObject({ kind: 'match', id: 'times_a_day' });
    expect(matchQuestion('na chakula')).toMatchObject({ kind: 'match', id: 'with_food' });
    expect(matchQuestion('ni dawa gani')).toMatchObject({ kind: 'match', id: 'what_is_it' });
    expect(matchQuestion('soma tena')).toMatchObject({ kind: 'match', id: 'read_again' });
  });

  it('ignores case, accents, punctuation and where Whisper put the spaces', () => {
    expect(matchQuestion('  NI  DAWA, gani?! ')).toMatchObject({ kind: 'match', id: 'what_is_it' });
    expect(matchQuestion('nidawagani')).toMatchObject({ kind: 'match', id: 'what_is_it' });
  });

  it('an empty or blank transcript matches nothing', () => {
    expect(matchQuestion('')).toEqual({ kind: 'none', best: null });
    expect(matchQuestion('   ?! ')).toEqual({ kind: 'none', best: null });
  });

  it('English chatter and noise match nothing', () => {
    for (const t of ['Good morning.', 'Is it safe for my child?', 'hmm', 'the quick brown fox jumps']) {
      expect(matchQuestion(t).kind).not.toBe('match');
    }
  });

  it('topics the label never answers go to the pharmacist, whatever they sound like', () => {
    expect(matchQuestion('Naweza kunywa pombe na dawa hii, ni dawa gani')).toEqual({ kind: 'topic' });
    expect(matchQuestion('Is it safe for my child?')).toEqual({ kind: 'topic' });
    expect(matchQuestion('mimba')).toEqual({ kind: 'topic' });
  });

  it('a transcript close to two questions is rejected, not guessed', () => {
    const r = matchQuestion('mara');
    expect(r.kind).toBe('none');
  });
});

describe('similarity', () => {
  it('is 1 for the same letters and drops with edits', () => {
    expect(similarity('saa ngapi', 'saangapi')).toBe(1);
    expect(similarity('abc', 'xyz')).toBe(0);
    expect(similarity('', '')).toBe(0);
  });
});
