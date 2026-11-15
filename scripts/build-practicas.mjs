// Prácticas de redacción: preguntas abiertas, casos prácticos y ejercicios de ordenar.
// Fuente: content/practicas/<asignatura>/tema-NN.json  →  dist/practicas/<id del tema>.json + index.json
// Uso: node scripts/build-practicas.mjs            (valida todo y publica)
//      node scripts/build-practicas.mjs --check f  (solo valida uno o varios archivos)
import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const bank = JSON.parse(await readFile(path.join(root, 'dist/bank.json'), 'utf8'));

const isText = (v, min = 1) => typeof v === 'string' && v.trim().length >= min;
const textList = (v, min, max, minLen = 1) => Array.isArray(v) && v.length >= min && v.length <= max && v.every(x => isText(x, minLen));

export async function validatePracticas(p, file = 'practicas') {
  const fail = msg => { throw Error(`${file}: ${msg}`); };
  if (!p || typeof p !== 'object') fail('no es un objeto');
  const topic = bank.topics.find(t => t.course === p.course && t.number === p.number);
  if (!topic) fail(`no existe el tema ${p.course} ${p.number}`);
  const temaFile = path.join(root, 'content/temas', p.course, `tema-${String(p.number).padStart(2, '0')}.json`);
  const tema = JSON.parse(await readFile(temaFile, 'utf8'));
  const sectionIds = new Set(tema.sections.map(s => s.id));
  const prefix = `${p.course}-t${String(p.number).padStart(2, '0')}-`;
  const ids = new Set();
  const checkId = (id, kind) => {
    if (typeof id !== 'string' || !id.startsWith(prefix + kind) || !/^[a-z]+-t\d{2}-[dco]\d+$/.test(id)) fail(`id no válido «${id}» (debe ser ${prefix}${kind}N)`);
    if (ids.has(id)) fail(`id repetido ${id}`);
    ids.add(id);
  };
  const checkSections = (s, where) => {
    if (!Array.isArray(s) || !s.length) fail(`${where}: «sections» debe tener al menos un apartado`);
    for (const id of s) if (!sectionIds.has(id)) fail(`${where}: apartado inexistente «${id}». Existen: ${[...sectionIds].join(', ')}`);
  };
  const checkAnswer = (x, where) => {
    if (!isText(x.prompt, 10)) fail(`${where}: falta «prompt»`);
    if (!textList(x.keyPoints, 3, 8, 8)) fail(`${where}: «keyPoints» debe tener de 3 a 8 frases`);
    if (!textList(x.model, 1, 8, 20)) fail(`${where}: «model» debe ser una lista de 1 a 8 párrafos`);
  };
  if (!Array.isArray(p.open) || p.open.length < 1 || p.open.length > 8) fail('«open» debe tener de 1 a 8 preguntas');
  for (const [i, q] of p.open.entries()) {
    const where = `open[${i}]`;
    checkId(q.id, 'd');
    if (!['corta', 'larga'].includes(q.kind)) fail(`${where}: «kind» debe ser corta o larga`);
    if (q.points !== (q.kind === 'corta' ? 2 : 3)) fail(`${where}: «points» debe ser 2 (corta) o 3 (larga)`);
    if (!Number.isInteger(q.minutes) || q.minutes < 3 || q.minutes > 30) fail(`${where}: «minutes» entre 3 y 30`);
    checkAnswer(q, where);
    if (q.tip !== undefined && !isText(q.tip, 10)) fail(`${where}: «tip» vacío`);
    if (q.fromClass !== undefined && typeof q.fromClass !== 'boolean') fail(`${where}: «fromClass» debe ser booleano`);
    checkSections(q.sections, where);
  }
  if (!Array.isArray(p.cases) || p.cases.length > 4) fail('«cases» debe ser una lista (0 a 4)');
  for (const [i, c] of p.cases.entries()) {
    const where = `cases[${i}]`;
    checkId(c.id, 'c');
    if (!isText(c.title, 5)) fail(`${where}: falta «title»`);
    if (!textList(c.scenario, 1, 6, 30)) fail(`${where}: «scenario» debe ser una lista de 1 a 6 párrafos`);
    if (!Number.isInteger(c.minutes) || c.minutes < 5 || c.minutes > 40) fail(`${where}: «minutes» entre 5 y 40`);
    if (c.points !== 3) fail(`${where}: «points» debe ser 3`);
    if (!Array.isArray(c.questions) || c.questions.length < 1 || c.questions.length > 5) fail(`${where}: «questions» de 1 a 5`);
    c.questions.forEach((q, j) => checkAnswer(q, `${where}.questions[${j}]`));
    if (c.tip !== undefined && !isText(c.tip, 10)) fail(`${where}: «tip» vacío`);
    checkSections(c.sections, where);
  }
  if (p.order !== undefined) {
    if (!Array.isArray(p.order) || p.order.length > 4) fail('«order» debe ser una lista (0 a 4)');
    for (const [i, o] of p.order.entries()) {
      const where = `order[${i}]`;
      checkId(o.id, 'o');
      if (!isText(o.title, 5)) fail(`${where}: falta «title»`);
      if (!textList(o.items, 3, 9, 2)) fail(`${where}: «items» de 3 a 9 pasos`);
      if (new Set(o.items).size !== o.items.length) fail(`${where}: pasos repetidos`);
      if (!isText(o.why, 10)) fail(`${where}: falta «why»`);
      checkSections(o.sections, where);
    }
  }
  const allowed = new Set(['course', 'number', 'open', 'cases', 'order']);
  for (const k of Object.keys(p)) if (!allowed.has(k)) fail(`clave desconocida «${k}»`);
  return topic;
}

const args = process.argv.slice(2);
if (args[0] === '--check') {
  for (const f of args.slice(1)) {
    const p = JSON.parse(await readFile(f, 'utf8'));
    await validatePracticas(p, f);
    console.log(`OK ${f}: ${p.open.length} abiertas, ${p.cases.length} casos, ${(p.order || []).length} de ordenar`);
  }
} else {
  const out = path.join(root, 'dist/practicas');
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  const index = [];
  for (const course of bank.courses) {
    const dir = path.join(root, 'content/practicas', course.id);
    const files = (await readdir(dir).catch(() => [])).filter(f => /^tema-\d{2}\.json$/.test(f)).sort();
    for (const file of files) {
      const p = JSON.parse(await readFile(path.join(dir, file), 'utf8'));
      if (p.course !== course.id || `tema-${String(p.number).padStart(2, '0')}.json` !== file) throw Error(`${course.id}/${file}: asignatura o número no coinciden con el nombre`);
      const topic = await validatePracticas(p, `${course.id}/${file}`);
      await writeFile(path.join(out, `${topic.id}.json`), JSON.stringify({ ...p, topic: topic.id }) + '\n');
      index.push({ topic: topic.id, course: course.id, number: p.number, open: p.open.map(q => ({ id: q.id, kind: q.kind })), cases: p.cases.map(c => c.id), order: (p.order || []).length });
    }
  }
  await writeFile(path.join(out, 'index.json'), JSON.stringify({ version: bank.version, practicas: index }) + '\n');
  console.log(`${index.length} temas con prácticas de redacción publicados`);
}
