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
    return { titulo: c.titulo, fecha: c.fecha || '', url: c.url, ...(Number.isInteger(c.minutos) ? { minutos: c.minutos } : {}), ...(c.embed ? { embed: c.embed } : {}), ...(c.nota ? { nota: c.nota } : {}) };
  }).sort((a, b) => a.fecha.localeCompare(b.fecha));
}
// Camino de estudio entre asignaturas (content/camino.json): orden por etapas y apartados que conviene ver antes.
const caminoSrc = await readJson('content/camino.json', null);
const allTemas = new Map();
for (const course of bank.courses) {
  const dir = path.join(root, 'content/temas', course.id);
  for (const file of (await readdir(dir).catch(() => [])).filter(f => /^tema-\d{2}\.json$/.test(f))) {
    const t = JSON.parse(await readFile(path.join(dir, file), 'utf8'));
    allTemas.set(`${t.course}/${t.number}`, t);
  }
}
const caminoTopic = ref => {
  const t = allTemas.get(ref); const topic = bank.topics.find(x => `${x.course}/${x.number}` === ref);
  if (!t || !topic) throw Error(`camino.json: el tema «${ref}» no existe`);
  return { t, topic };
};
const caminoLink = (from, l) => {
  const { t, topic } = caminoTopic(l.ref);
  if (l.ref === from) throw Error(`camino.json: ${from} se enlaza a sí mismo`);
  if (!Array.isArray(l.apartados) || !l.apartados.length || !l.por) throw Error(`camino.json: enlace incompleto en ${from} → ${l.ref}`);
  const apartados = l.apartados.map(id => { const s = t.sections.find(s => s.id === id); if (!s) throw Error(`camino.json: ${from} → ${l.ref}: no existe el apartado «${id}»`); return { id, title: s.title }; });
  return { topic: topic.id, course: topic.course, number: topic.number, title: t.title, apartados, por: l.por };
};
const caminoPorTema = new Map();
let caminoOut = null;
if (caminoSrc) {
  const seen = new Set();
  const etapas = caminoSrc.etapas.map((e, ei) => ({ id: e.id, titulo: e.titulo, idea: e.idea, temas: e.temas.map(ref => {
    if (seen.has(ref)) throw Error(`camino.json: ${ref} aparece dos veces en las etapas`); seen.add(ref);
    const { t, topic } = caminoTopic(ref);
    return { topic: topic.id, course: topic.course, number: topic.number, title: t.title, sections: t.sections.length, minutes: t.minutes ?? null };
  }) }));
  for (const ref of allTemas.keys()) if (!seen.has(ref)) throw Error(`camino.json: falta ${ref} en las etapas`);
  for (const ref of Object.keys(caminoSrc.temas)) caminoTopic(ref);
  let pos = 0;
  etapas.forEach((e, ei) => e.temas.forEach(x => {
    const ref = `${x.course}/${x.number}`; const src = caminoSrc.temas[ref] || {};
    const antes = (src.antes || []).map(l => caminoLink(ref, l)); const conecta = (src.conecta || []).map(l => caminoLink(ref, l));
    x.antes = antes.map(l => l.topic); x.pos = ++pos;
    caminoPorTema.set(ref, { etapa: ei + 1, etapaTitulo: e.titulo, pos, antes, conecta });
  }));
  const posOf = new Map([...caminoPorTema].map(([ref, c]) => [ref, c.pos]));
  for (const [ref, c] of caminoPorTema) for (const l of c.antes) if (posOf.get(`${l.course}/${l.number}`) > c.pos) throw Error(`camino.json: ${ref} pide ver antes ${l.course}/${l.number}, pero en las etapas va después`);
  caminoOut = { total: pos, etapas };
}
for (const course of bank.courses) {
  const dir = path.join(root, 'content/temas', course.id);
  const files = (await readdir(dir).catch(() => [])).filter(f => /^tema-\d{2}\.json$/.test(f)).sort();
  for (const file of files) {
    const tema = JSON.parse(await readFile(path.join(dir, file), 'utf8'));
    if (tema.course !== course.id || `tema-${String(tema.number).padStart(2, '0')}.json` !== file) throw Error(`${course.id}/${file}: asignatura o número no coinciden con el nombre`);
    const topic = validateTema(tema, bank);
    await writeFile(path.join(out, `${topic.id}.json`), JSON.stringify({ ...tema, topic: topic.id, siglas: siglasDe(tema, course.id), clases: clasesDe(course.id, tema.number), ...(caminoPorTema.has(`${course.id}/${tema.number}`) ? { camino: caminoPorTema.get(`${course.id}/${tema.number}`) } : {}) }) + '\n');
    index.push({ topic: topic.id, sections: tema.sections.length, minutes: tema.minutes ?? null, doubts: Object.values(tema.questions).filter(q => q.doubt).length });
  }
}
if (caminoOut) await writeFile(path.join(root, 'dist/camino.json'), JSON.stringify(caminoOut) + '\n');
await writeFile(path.join(out, 'index.json'), JSON.stringify({ version: bank.version, temas: index }, null, 2) + '\n');
console.log(`${index.length} temas digitales publicados`, index.map(t => t.topic).join(', '));
