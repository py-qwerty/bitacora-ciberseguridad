import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => JSON.parse(readFileSync(new URL('../' + name, import.meta.url), 'utf8'));
const bank = read('dist/bank.json');
const sources = read('content/source-index.json');

test('all fifty topics have thirty distinct questions with valid source pages', () => {
  assert.equal(sources.length, 50);
  for (const topic of bank.topics) {
    const qs = bank.questions.filter(q => q.topic === topic.id);
    const source = sources.find(s => s.course === topic.course && s.topic === topic.number);
    assert.ok(source, `Missing source: ${topic.course}/${topic.number}`);
    assert.equal(qs.filter(q => !q.fromClass && !q.fromCampus && !q.fromExtra).length, 30);
    assert.ok(qs.filter(q => q.fromExtra).length <= 50);
    assert.ok(qs.filter(q => q.fromCampus).length <= 10);
    assert.ok(qs.filter(q => q.fromClass).length <= 10);
    const signatures = qs.map(q => JSON.stringify([q.text.toLocaleLowerCase('es'), q.options.map(o => o.text.toLocaleLowerCase('es'))]));
    assert.equal(new Set(signatures).size, qs.length, `Duplicate: ${topic.course}/${topic.number}`);
    for (const q of qs) {
      assert.ok(q.fromClass || (Number.isInteger(q.source.page) && q.source.page > 0 && q.source.page <= source.pages), q.id);
      assert.equal(new Set(q.options.map(o => o.text.toLowerCase())).size, 4, q.id);
      assert.ok(q.explanation.length >= 35, `Feedback too short: ${q.id}`);
      assert.ok(!q.source.adaptation || q.source.kind === 'practice', `Adaptation provenance: ${q.id}`);
    }
  }
});

test('campus confirmation is limited to the ten observed Windows Server answers', () => {
  const confirmed = bank.questions.filter(q => q.source.kind === 'campus-confirmed');
  assert.equal(confirmed.length, 10);
  assert.ok(confirmed.every(q => q.course === 'sistemas' && q.topic === 1));
  assert.deepEqual(confirmed.map(q => q.correct), ['a','b','c','a','b','c','d','b','a','b']);
});

test('distributed data excludes private campus attempts and host source paths', () => {
  const text = JSON.stringify(bank);
  assert.doesNotMatch(text, /\/Users\/(?!\[USUARIO\])/);
  assert.doesNotMatch(text, /quiz\/review\.php\?attempt=|source_pdf|MoodleSession|access_token|refresh_token/);
});

test('campus tests keep the campus order and only reference questions of their own course', () => {
  const byId = new Map(bank.questions.map(q => [q.id, q]));
  for (const [topicId, ids] of Object.entries(bank.campus || {})) {
    const topic = bank.topics.find(t => t.id === Number(topicId));
    assert.ok(topic && ids.length >= 1 && ids.length <= 10, topicId);
    for (const id of ids) assert.equal(byId.get(id)?.course, topic.course, id);
  }
  for (const q of bank.questions.filter(q => q.fromCampus)) {
    assert.equal(q.source.kind, 'campus-reasoned', q.id);
    assert.match(q.id, /-t\d{2}-c\d{2}$/);
    assert.ok(Object.values(bank.campus).some(ids => ids.includes(q.id)), `Huérfana: ${q.id}`);
  }
});
