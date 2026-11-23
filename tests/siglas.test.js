import test from 'node:test';
import assert from 'node:assert/strict';
import { sgStart, sgEnd, sgApply, sgList } from '../dist/siglas.js';

const MAP = { AEPD: 'Agencia Española de Protección de Datos.', API: 'Application Programming Interface, interfaz de programación.', SQLi: 'SQL injection, inyección SQL.', SQL: 'Structured Query Language, lenguaje de consultas.' };

test('first mention of an acronym is explained inline, later ones are only expandable', () => {
  sgStart(MAP);
  const a = sgApply('La AEPD multa.', 'inline');
  const b = sgApply('Otra vez la AEPD.', 'inline');
  sgEnd();
  assert.match(a, /<abbr class="sg"[^>]*data-sg="AEPD"[^>]*>AEPD<\/abbr><span class="sg-exp"> \(Agencia Española de Protección de Datos\)<\/span>/);
  assert.match(b, /data-tip="Agencia Española de Protección de Datos\."/);
  assert.doesNotMatch(b, /sg-exp/);
});

test('acronyms already expanded by the text, in titles or in tables are not explained twice', () => {
  sgStart(MAP);
  assert.doesNotMatch(sgApply('Agencia de Datos (AEPD) y más', 'inline'), /sg-exp/);
  assert.doesNotMatch(sgApply('La AEPD vuelve', 'inline'), /sg-exp/, 'counts as explained after the text expanded it');
  assert.doesNotMatch(sgApply('<strong>API</strong> (interfaz) aquí', 'inline'), /sg-exp/, 'expansion after a closing tag');
  assert.doesNotMatch(sgApply('Una API en una tabla'), /sg-exp/);

  sgEnd();
  sgStart(MAP);
  assert.doesNotMatch(sgApply('SQL', 'define'), /sg-exp/);
  assert.doesNotMatch(sgApply('El SQL', 'inline'), /sg-exp/, 'a «term» heading counts as the explanation');
  sgEnd();
});

test('longest acronym wins, plurals and boundaries are respected, tags are left alone', () => {
  sgStart(MAP);
  const html = sgApply('Las APIs y la <strong>SQLi</strong>; RAPIDO no es API.', 'x');
  sgEnd();
  assert.match(html, /data-sg="API"[^>]*>API<\/abbr>s/);
  assert.match(html, /<strong><abbr[^>]*data-sg="SQLi"/);
  assert.doesNotMatch(html, /RAP<abbr|R<abbr/);
  assert.equal((html.match(/<abbr/g) || []).length, 3);
});

test('without an active map the text is unchanged and the list is sorted', () => {
  sgEnd();
  assert.equal(sgApply('La AEPD', 'inline'), 'La AEPD');
  assert.deepEqual(sgList(MAP).map(([k]) => k), ['AEPD', 'API', 'SQL', 'SQLi']);
});
