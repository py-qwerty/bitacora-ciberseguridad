// Actividades resueltas: content/resueltas/<id>.json → dist/resueltas/<id>.json + dist/resueltas/index.json.
// Usan los mismos bloques que los temas digitales (TEMA_BLOCKS); se comprueba lo básico y que las figuras existan.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { TEMA_BLOCKS } from '../dist/core.js';
const SRC = 'content/resueltas', OUT = 'dist/resueltas';
mkdirSync(OUT, { recursive: true });
const fail = (id, msg) => { throw new Error(`resuelta ${id}: ${msg}`); };
const index = [];
for (const f of readdirSync(SRC).filter(f => f.endsWith('.json')).sort()) {
  const a = JSON.parse(readFileSync(`${SRC}/${f}`, 'utf8'));
  if (a.id + '.json' !== f) fail(f, 'el id no coincide con el nombre del archivo');
  for (const k of ['course', 'title', 'intro']) if (typeof a[k] !== 'string' || !a[k].trim()) fail(a.id, `falta ${k}`);
  if (!Array.isArray(a.sections) || !a.sections.length) fail(a.id, 'sin apartados');
  const ids = new Set();
  for (const s of a.sections) {
    if (!/^[a-z0-9-]+$/.test(s.id) || ids.has(s.id)) fail(a.id, `id de apartado no válido: ${s.id}`);
    ids.add(s.id);
    if (!s.title || !Array.isArray(s.blocks) || !s.blocks.length) fail(a.id, `apartado vacío: ${s.id}`);
    for (const b of s.blocks) {
      if (!TEMA_BLOCKS.includes(b.type)) fail(a.id, `bloque desconocido ${b.type} en ${s.id}`);
      if (b.type === 'figure' && !existsSync(`dist/${b.src}`)) fail(a.id, `no existe ${b.src}`);
      if (b.type === 'code' && typeof b.text !== 'string') fail(a.id, `código sin texto en ${s.id}`);
    }
  }
  writeFileSync(`${OUT}/${a.id}.json`, JSON.stringify(a));
  index.push({ id: a.id, course: a.course, topic: a.topic ?? null, title: a.title, subtitle: a.subtitle ?? '', intro: a.intro });
}
writeFileSync(`${OUT}/index.json`, JSON.stringify(index));
console.log(`${index.length} actividades resueltas → ${OUT}`);
