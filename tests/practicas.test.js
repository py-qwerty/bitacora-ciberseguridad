import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { validatePracticas } from '../scripts/build-practicas.mjs';
import { selfScore, pickWriting, EXAM_RULES } from '../dist/practicas.js';

const bank = JSON.parse(readFileSync(new URL('../dist/bank.json', import.meta.url), 'utf8'));
const dir = c => new URL(`../content/practicas/${c}/`, import.meta.url);
const all = bank.courses.flatMap(c => existsSync(dir(c.id)) ? readdirSync(dir(c.id)).filter(f => /^tema-\d{2}\.json$/.test(f)).map(f => JSON.parse(readFileSync(new URL(f, dir(c.id)), 'utf8'))) : []);

test('every writing practice file is valid against its digital topic', async () => {
  assert.ok(all.length > 0);
  for (const p of all) await validatePracticas(p, `${p.course}/${p.number}`);
});
test('ids are unique across all writing practices', () => {
  const ids = all.flatMap(p => [...p.open, ...p.cases, ...(p.order || [])].map(x => x.id));
  assert.equal(new Set(ids).size, ids.length);
});
test('self score is proportional to checked key points and rounded to quarters', () => {
  const q = { points: 3, keyPoints: ['a', 'b', 'c', 'd'] };
  assert.equal(selfScore(q, []), 0);
  assert.equal(selfScore(q, [[true, true]]), 1.5);
  assert.equal(selfScore(q, [[true, true, true, true]]), 3);
  const c = { points: 3, questions: [{ keyPoints: ['a', 'b', 'c'] }, { keyPoints: ['d', 'e', 'f'] }] };
  assert.equal(selfScore(c, [[true], [true, true]]), 1.5);
});
test('real exam writing part adds up to 6 points and follows each subject structure', () => {
  const byCourse = c => all.filter(p => p.course === c).map(p => ({ ...p, topic: bank.topics.find(t => t.course === c && t.number === p.number).id }));
  for (const c of bank.courses.map(x => x.id)) {
    const data = byCourse(c); if (data.length < 4) continue;
    assert.ok(EXAM_RULES[c]);
    for (let i = 0; i < 20; i++) {
      const picked = pickWriting(c, data);
      const items = picked.map(w => data.flatMap(d => [...d.open, ...d.cases]).find(x => x.id === w.id));
      assert.equal(items.reduce((s, x) => s + x.points, 0), 6, c);
      if (c === 'ciberdelitos') assert.ok(items.every(x => x.questions), 'ciberdelitos: casos prácticos');
      if (c === 'gobierno') { const nums = picked.map(w => data.find(d => d.topic === w.topic).number).sort((a, b) => a - b); assert.ok(nums[0] <= 4 && nums[1] >= 6, 'gobierno: una de cada parte'); }
    }
  }
});
test('Claude corrector only accepts Console API keys, never subscription tokens', async () => {
  const { saveSettings } = await import('../dist/corrector.js');
  assert.throws(() => saveSettings('sk-ant-oat01-abc'), /suscripción/);
  assert.throws(() => saveSettings('hola'), /sk-ant-api/);
});
