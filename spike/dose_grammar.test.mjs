import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDose, doseKey, agree } from './dose_grammar.mjs';

const key = (s) => doseKey(parseDose(s));

test('parses the label shapes the app must handle', () => {
  assert.equal(key('1x3'), '1 x3');
  assert.equal(key('1 x 3'), '1 x3');
  assert.equal(key('1×3'), '1 x3');
  assert.equal(key('1X3'), '1 x3');
  assert.equal(key('2 bd'), '2 bd');
  assert.equal(key('1 nocte'), '1 nocte');
  assert.equal(key('1 mara 3'), '1 x3');
  assert.equal(key('½ tab od'), 'tab 1/2 od');
  assert.equal(key('Tab 1 tds\nafter food'), 'tab 1 tds after food');
  assert.equal(key(['Tab 1 tds', 'after food']), 'tab 1 tds after food');
  assert.equal(key('2 bd x 7/7'), '2 bd x 7/7');
  assert.equal(key('2 bd × 7/7'), '2 bd x 7/7');
  assert.equal(key('1 x 3  \nx 5 days'), '1 x3 x 5d');
  assert.equal(key('1x3 x 5 days'), '1 x3 x 5d');
  assert.equal(key('$2 \\text{ bd } x \\ 7/7$'), '2 bd x 7/7');
  assert.equal(key('2 ml tds'), 'ml 2 tds');
});

test('anything that does not parse exactly is not-sure (no OCR repair)', () => {
  for (const bad of ['', 'nocte', 'bd', 'tds', 'Ax3', 'I13', '143', '2 &d', '2 led', '1 note', '1 +ds',
    'Tab td5', 'ld + 7', '1 bj x 7/7', '$z \\quad bd$', 'Jale / tds', '3 bd', '2 bd 7/7 7/7', '1 x 2 x " days', 'bd x 7/7']) {
    assert.equal(parseDose(bad), null, `should reject ${JSON.stringify(bad)}`);
  }
});

test('"x 5 days" is a duration, not a frequency', () => {
  assert.equal(parseDose('1 bd x 3 days').duration, '3d');
  assert.equal(parseDose('1 x 3 days'), null);
});

test('speaks only when every reader parses and all agree exactly', () => {
  assert.equal(agree(['1x3', '1 x 3']).speak, '1 x3');
  assert.equal(agree(['Tab 4 tds', 'Tab 1 tds']).speak, null); // the C2 "4 for 1" case
  assert.equal(agree(['nocte', '1 nocte']).speak, null); // dropped count
  assert.equal(agree(['2 bd', 'garbage']).speak, null);
  assert.equal(agree(['garbage', 'garbage']).speak, null); // equal but unparsed
  assert.equal(agree(['2 bd', '2 bd x 7/7']).speak, null); // dropped duration
  assert.equal(agree(['1 tds', 'tab 1 tds']).speak, null); // form disagreement
});
