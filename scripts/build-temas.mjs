import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateTema } from '../dist/core.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const bank = JSON.parse(await readFile(path.join(root, 'dist/bank.json'), 'utf8'));
const out = path.join(root, 'dist/temas');
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const index = [];
// Siglas: glosario global + significados propios de cada asignatura. Clases grabadas: content/clases-grabadas.json.
const readJson = async (file, fallback) => JSON.parse(await readFile(path.join(root, file), 'utf8').catch(() => JSON.stringify(fallback)));
const glossary = await readJson('content/glossary.json', {});
const siglasCurso = await readJson('content/siglas-curso.json', {});
const clasesGrabadas = await readJson('content/clases-grabadas.json', {});
const escapeRE = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function siglasDe(tema, course) {
  const dict = { ...glossary, ...(siglasCurso[course] || {}) };
  const { questions, ...rest } = tema;
  const text = JSON.stringify(rest) + ' ' + Object.values(questions || {}).map(q => JSON.stringify(q)).join(' ');
  return Object.fromEntries(Object.keys(dict).sort().filter(k => typeof dict[k] === 'string' && new RegExp(`(?<![\\p{L}\\p{N}])${escapeRE(k)}s?(?![\\p{L}\\p{N}])`, 'u').test(text)).map(k => [k, dict[k]]));
}
function clasesDe(course, number) {
  const list = clasesGrabadas[course] || [];
  if (!Array.isArray(list)) throw Error(`clases-grabadas.json: ${course} debe ser una lista`);
  return list.filter(c => (c.temas || []).includes(number)).map(c => {
    if (!c.titulo || !/^https:\/\//.test(c.url || '') || (c.embed && !/^https:\/\//.test(c.embed))) throw Error(`clases-grabadas.json: clase mal formada en ${course}: ${JSON.stringify(c)}`);
    return { titulo: c.titulo, fecha: c.fecha || '', url: c.url, ...(c.embed ? { embed: c.embed } : {}), ...(c.nota ? { nota: c.nota } : {}) };
  }).sort((a, b) => a.fecha.localeCompare(b.fecha));
}
for (const course of bank.courses) {
  const dir = path.join(root, 'content/temas', course.id);
  const files = (await readdir(dir).catch(() => [])).filter(f => /^tema-\d{2}\.json$/.test(f)).sort();
  for (const file of files) {
    const tema = JSON.parse(await readFile(path.join(dir, file), 'utf8'));
    if (tema.course !== course.id || `tema-${String(tema.number).padStart(2, '0')}.json` !== file) throw Error(`${course.id}/${file}: asignatura o número no coinciden con el nombre`);
    const topic = validateTema(tema, bank);
    await writeFile(path.join(out, `${topic.id}.json`), JSON.stringify({ ...tema, topic: topic.id, siglas: siglasDe(tema, course.id), clases: clasesDe(course.id, tema.number) }) + '\n');
    index.push({ topic: topic.id, sections: tema.sections.length, minutes: tema.minutes ?? null, doubts: Object.values(tema.questions).filter(q => q.doubt).length });
  }
}
await writeFile(path.join(out, 'index.json'), JSON.stringify({ version: bank.version, temas: index }, null, 2) + '\n');
console.log(`${index.length} temas digitales publicados`, index.map(t => t.topic).join(', '));
