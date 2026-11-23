// Muestra un tema con sus bloques numerados, para escribir el guion de audio (content/audio/README.md).
//   node scripts/outline-tema.mjs sistemas/2
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const [course, n] = (process.argv[2] || '').split('/');
const tema = JSON.parse(await readFile(path.join(root, 'content/temas', course, `tema-${String(n).padStart(2, '0')}.json`), 'utf8'));
const flat = b => b.type === 'table' ? `${b.title || ''} | ${b.head.join(' | ')} || ${b.rows.map(r => r.join(' | ')).join(' || ')}`
  : b.type === 'diagram' ? `(${b.kind}) ${b.title || ''} ${JSON.stringify(b).replace(/"(type|kind|icon|tone|title)":"[^"]*",?/g, '').replace(/["{}\[\]]/g, ' ').replace(/\s+/g, ' ')}`.slice(0, 500)
  : [b.term, b.title, b.text, ...(b.items || [])].filter(Boolean).join(' · ');
console.log(`# ${tema.title}\n`);
for (const s of tema.sections) {
  console.log(`\n## ${s.id} — ${s.title}`);
  s.blocks.forEach((b, i) => console.log(`[${i}] ${b.type}: ${flat(b)}`));
}
