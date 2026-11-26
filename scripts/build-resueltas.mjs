// Páginas paso a paso que usan los mismos bloques que los temas digitales (TEMA_BLOCKS):
//  · Actividades resueltas: content/resueltas/<id>.json  → dist/resueltas/<id>.json + index.json
//  · Experimentos (laboratorios): content/experimentos/<id>.json → dist/experimentos/<id>.json + index.json
// Se comprueba lo básico y que las figuras existan.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { TEMA_BLOCKS, validateDiagram } from '../dist/core.js';
const KINDS = [
  { src: 'content/resueltas', out: 'dist/resueltas', name: 'actividad resuelta', required: ['course', 'title', 'intro'] },
  { src: 'content/experimentos', out: 'dist/experimentos', name: 'experimento', required: ['title', 'intro'] },
];
for (const K of KINDS) {
  if (!existsSync(K.src)) continue;
  mkdirSync(K.out, { recursive: true });
  const fail = (id, msg) => { throw new Error(`${K.name} ${id}: ${msg}`); };
  const index = [];
  for (const f of readdirSync(K.src).filter(f => f.endsWith('.json')).sort()) {
    const a = JSON.parse(readFileSync(`${K.src}/${f}`, 'utf8'));
    if (a.id + '.json' !== f) fail(f, 'el id no coincide con el nombre del archivo');
    for (const k of K.required) if (typeof a[k] !== 'string' || !a[k].trim()) fail(a.id, `falta ${k}`);
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
        if (b.type === 'diagram') validateDiagram(b, s.id, msg => fail(a.id, `esquema: ${msg}`));
      }
    }
    writeFileSync(`${K.out}/${a.id}.json`, JSON.stringify(a));
    index.push({ id: a.id, course: a.course ?? null, topic: a.topic ?? null, order: a.order ?? null, title: a.title, subtitle: a.subtitle ?? '', intro: a.intro, time: a.time ?? '', sections: a.sections.length });
  }
  index.sort((x, y) => (x.order ?? 999) - (y.order ?? 999) || x.id.localeCompare(y.id));
  writeFileSync(`${K.out}/index.json`, JSON.stringify(index));
  console.log(`${index.length} ${K.name}${index.length === 1 ? '' : 's'} → ${K.out}`);
}
