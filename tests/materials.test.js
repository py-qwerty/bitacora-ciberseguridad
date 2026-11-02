import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const read = name => JSON.parse(readFileSync(new URL(name, root), 'utf8'));
const bank = read('dist/bank.json');
const materials = read('content/materials.json');

test('all fifty topics point to the matching named PDF with original bytes', () => {
  assert.equal(materials.length, 50);
  const paths = new Set();
  for (const topic of bank.topics) {
    const source = materials.find(m => m.course === topic.course && m.number === topic.number);
    assert.ok(source, `Missing material ${topic.course}/${topic.number}`);
    assert.equal(topic.title, source.title);
    assert.equal(topic.material.title, `Tema ${topic.number}. ${topic.title}`);
    assert.equal(topic.material.url, source.url);
    assert.match(source.url, /^materials\/[a-z-]+\/tema-\d{2}-[a-z0-9-]+\.pdf$/);
    assert.ok(!paths.has(source.url)); paths.add(source.url);
    const bytes = readFileSync(new URL('dist/' + source.url, root));
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
    assert.equal(bytes.length, source.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), source.sha256);
    assert.equal(topic.material.pages, source.pages);
  }
  assert.equal(readdirSync(new URL('dist/materials/', root), { recursive: true }).filter(name => name.endsWith('.pdf')).length, 50);
});

test('each subject contains exactly the numbered topics one to ten in order', () => {
  for (const course of bank.courses) {
    assert.deepEqual(bank.topics.filter(t => t.course === course.id).map(t => t.number), [1,2,3,4,5,6,7,8,9,10]);
  }
});
