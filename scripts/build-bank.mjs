import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { homedir } from 'node:os';
import { validateBank } from '../dist/core.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const load = async p => JSON.parse(await readFile(path.join(root, p), 'utf8'));
const courses = [
  { id: 'sistemas', shortTitle: 'Sistemas', title: 'Seguridad en sistemas, aplicaciones y el big data' },
  { id: 'redes', shortTitle: 'Redes y amenazas', title: 'Seguridad en redes y Análisis Inteligente de Amenazas' },
  { id: 'forense', shortTitle: 'Informática forense', title: 'Informática forense y Respuesta ante incidentes' },
  { id: 'gobierno', shortTitle: 'Gobierno y riesgos', title: 'Gobierno de la ciberseguridad y Análisis de riesgos' },
  { id: 'ciberdelitos', shortTitle: 'Ciberdelitos y regulación', title: 'Ciberdelitos y Regulación de la Ciberseguridad' }
];
const glossary = await load('content/glossary.json');
// Significados propios de una asignatura (null = en esa asignatura no es una sigla).
const siglasCurso = await load('content/siglas-curso.json').catch(() => ({}));
const glossaryFor = id => Object.fromEntries(Object.entries({ ...glossary, ...(siglasCurso[id] || {}) }).filter(([, v]) => typeof v === 'string'));
const materials = await load('content/materials.json');
const topics = [], questions = [], campusTests = {};
const norm = s => String(s).normalize('NFKC').replace(/\s+/g, ' ').trim();
const signature = q => JSON.stringify([norm(q.question).toLocaleLowerCase('es'), q.options.map(norm)]);
const escapeRE = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
for (const [courseIndex, course] of courses.entries()) {
  const base = await load(`content/base/${course.id}.json`);
  const additions = await load(`content/additions/${course.id}.json`);
  // Preguntas de clase: lo que los profesores remarcaron en las clases grabadas (opcional, hasta 10 por tema).
  const clases = await load(`content/clases/${course.id}.json`).catch(() => ({ topics: [] }));
  // Test del campus: las preguntas del test de cada tema en el orden del campus. Las que ya están en el banco se
  // referencian por id; las nuevas se añaden con clave razonada a partir del temario (no confirmada por el campus).
  const campus = await load(`content/campus/${course.id}.json`).catch(() => ({ topics: [] }));
  // Ampliación: hasta 50 preguntas más por tema, redactadas a partir del temario (tests «Ampliación 1–5»).
  const extra = await load(`content/extra/${course.id}.json`).catch(() => ({ topics: [] }));
  for (let number = 1; number <= 10; number++) {
    const before = base.topics.find(t => t.number === number);
    const added = additions.topics.find(t => t.number === number);
    if (!added) throw Error(`${course.id}: falta tema ${number}`);
    const topic = { id: courseIndex * 10 + number, course: course.id, number, title: norm(before?.title || added.title) };
    const material = materials.find(m => m.course === course.id && m.number === number);
    if (!material || !/^materials\/[a-z-]+\/tema-\d{2}(?:-[a-z0-9]+)*\.pdf$/.test(material.url)) throw Error(`Falta el PDF de ${course.id}/${number}`);
    topic.title = norm(material.title);
    topic.material = { url: material.url, format: 'pdf', pages: material.pages, bytes: material.bytes, title: `Tema ${number}. ${topic.title}` };
    topics.push(topic);
    const rows = [...added.questions, ...(before?.questions || [])];
    if (rows.length !== 30) throw Error(`${course.id}/${number}: ${rows.length} preguntas, se esperan 30`);
    const unique = new Set();
    const extras = clases.topics.find(t => t.number === number)?.questions || [];
    if (extras.length > 10) throw Error(`${course.id}/${number}: ${extras.length} preguntas de clase, máximo 10`);
    const campusItems = campus.topics.find(t => t.number === number)?.items || [];
    if (campusItems.length > 10) throw Error(`${course.id}/${number}: ${campusItems.length} ítems del campus, máximo 10`);
    const campusNew = campusItems.map((item, pos) => ({ item, pos })).filter(({ item }) => !item.ref && !item.skip);
    [...rows, ...extras, ...campusNew.map(c => c.item)].forEach((q, index) => {
      const fromCampus = index >= 30 + extras.length;
      const fromClass = !fromCampus && index >= 30;
      if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct > 3 || q.options.length !== 4 || q.options.some(o => !norm(o))) throw Error(`Opciones inválidas ${course.id}/${number}/${index}`);
      if (new Set(q.options.map(norm)).size !== 4) throw Error(`Opciones repetidas ${course.id}/${number}/${index}`);
      if (unique.has(signature(q))) throw Error(`Pregunta duplicada ${course.id}/${number}/${index}`);
      unique.add(signature(q));
      const campusPos = fromCampus ? campusNew[index - 30 - extras.length].pos + 1 : 0;
      const id = fromCampus ? `${course.id}-t${String(number).padStart(2, '0')}-c${String(campusPos).padStart(2, '0')}` : `${course.id}-t${String(number).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`;
      if (fromCampus && !(Number.isInteger(q.source_page) && q.source_page > 0)) throw Error(`${id}: falta source_page`);
      const fullText = [q.question, ...q.options, q.explanation].join(' ');
      const terms = Object.fromEntries(Object.entries({ ...glossaryFor(course.id), ...(q.glossary || {}) }).filter(([term]) => new RegExp(`(?<![A-Za-z0-9])${escapeRE(term)}(?![A-Za-z0-9])`).test(fullText)));
      if (terms.DROP && /\bSQL\b|bases? de datos/i.test(fullText)) terms.DROP = 'En SQL, instrucción para eliminar un objeto de la base de datos, por ejemplo una tabla; es diferente del veredicto DROP de un cortafuegos.';
      // Some source explanations already carry a hand-written «Siglas:» note; merge it with the glossary note instead of repeating it.
      // La explicación corta se muestra como texto plano: se quita el marcado de negrita.
      const [body, manual = ''] = norm(q.explanation).replace(/\*\*/g, '').split(/\s*Siglas:\s*/);
      const expansion = [manual, ...Object.entries(terms).filter(([key]) => !manual.includes(`${key}:`)).map(([key, value]) => `${key}: ${value}`)].filter(Boolean).join(' ');
      const source = fromCampus
        ? { kind: 'campus-reasoned', title: `Temario UNIR · Tema ${number}. ${topic.title}`, page: q.source_page }
        : { kind: q.kind || 'practice', title: fromClass ? `${q.clase || 'Clase del profesor'} · Tema ${number}. ${topic.title}` : `Temario UNIR · Tema ${number}. ${topic.title}`, page: q.source_page };
      // Course-level links contain no student attempt/history identifiers.
      if (q.reference) {
        const url = new URL(q.reference);
        if (url.hostname === 'campusonline.unir.net') source.reference = 'https://campusonline.unir.net/mod/quiz/view.php?id=524449';
        else if (url.protocol === 'https:') source.reference = url.href;
      }
      if (q.source_question !== undefined) source.originalQuestion = q.source_question;
      if (q.original_issue) source.adaptation = q.original_issue;
      questions.push({ id, course: course.id, topic: topic.id, test: fromCampus ? `Tema ${number} · Campus` : fromClass ? `Tema ${number} · Clase` : `Tema ${number}`, order: fromCampus ? 100 + campusPos : index + 1, ...(fromClass ? { fromClass: true } : {}), ...(fromCampus ? { fromCampus: true } : {}), text: norm(q.question), options: q.options.map((text, i) => ({ key: 'abcd'[i], text: norm(text) })), correct: 'abcd'[q.correct], explanation: body + (expansion ? ` Siglas y términos: ${expansion}` : ''), difficulty: q.difficulty || 'media', source, ...(Object.keys(terms).length ? { glossary: terms } : {}) });
    });
    const ampl = extra.topics.find(t => t.number === number)?.questions || [];
    if (ampl.length > 50) throw Error(`${course.id}/${number}: ${ampl.length} preguntas de ampliación, máximo 50`);
    ampl.forEach((q, i) => {
      const id = `${course.id}-t${String(number).padStart(2, '0')}-e${String(i + 1).padStart(2, '0')}`;
      if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct > 3 || q.options.length !== 4 || q.options.some(o => !norm(o))) throw Error(`Opciones inválidas ${id}`);
      if (new Set(q.options.map(norm)).size !== 4) throw Error(`Opciones repetidas ${id}`);
      if (unique.has(signature(q))) throw Error(`Pregunta duplicada ${id}`);
      unique.add(signature(q));
      const fullText = [q.question, ...q.options, q.explanation].join(' ');
      const terms = Object.fromEntries(Object.entries(glossaryFor(course.id)).filter(([term]) => new RegExp(`(?<![A-Za-z0-9])${escapeRE(term)}(?![A-Za-z0-9])`).test(fullText)));
      const body = norm(q.explanation).replace(/\*\*/g, '');
      const expansion = Object.entries(terms).map(([key, value]) => `${key}: ${value}`).join(' ');
      questions.push({ id, course: course.id, topic: topic.id, test: `Tema ${number} · Ampliación`, order: 200 + i, fromExtra: true, text: norm(q.question), options: q.options.map((text, k) => ({ key: 'abcd'[k], text: norm(text) })), correct: 'abcd'[q.correct], explanation: body + (expansion ? ` Siglas y términos: ${expansion}` : ''), difficulty: q.difficulty || 'media', source: { kind: 'practice', title: `Temario UNIR · Tema ${number}. ${topic.title}`, ...(Number.isInteger(q.source_page) && q.source_page > 0 ? { page: q.source_page } : {}) }, ...(Object.keys(terms).length ? { glossary: terms } : {}) });
    });
    if (campusItems.length) {
      const own = new Set(questions.filter(q => q.course === course.id).map(q => q.id));
      campusTests[topic.id] = campusItems.filter(item => !item.skip).map(item => {
        const pos = campusItems.indexOf(item) + 1;
        const id = item.ref || `${course.id}-t${String(number).padStart(2, '0')}-c${String(pos).padStart(2, '0')}`;
        if (!own.has(id)) throw Error(`${course.id}/${number}: el ítem ${pos} del campus apunta a ${id}, que no existe en la asignatura`);
        return id;
      });
    }
  }
}
const bank = { version: '2026-11-25.2', title: 'Bitácora Ciber', context: 'Práctica personal a partir del material docente. Solo la categoría campus-confirmed incorpora corrección observada en el campus; las demás claves están razonadas para estudiar. Las preguntas del test del campus sin corrección observada (campus-reasoned) llevan una clave razonada con el temario. Los simulacros no reproducen reglas oficiales. Las referencias de versiones y normativa pertenecen al material citado.', courses, topics, campus: campusTests, questions };
validateBank(bank);
if (questions.filter(q => !q.fromClass && !q.fromCampus && !q.fromExtra).length !== 1500) throw Error('Cobertura incompleta');
if (questions.filter(q => q.source.kind === 'campus-confirmed').some(q => q.course !== 'sistemas' || q.topic !== 1)) throw Error('Confirmación campus fuera de su alcance');
const json = JSON.stringify(bank, null, 2) + '\n';
if (json.includes(homedir() + '/') || /"source_pdf"|mod\/quiz\/review\.php\?attempt=/i.test(json)) throw Error('Datos locales o personales inesperados en el banco');
await mkdir(path.join(root, 'dist'), { recursive: true });
await writeFile(path.join(root, 'dist/bank.json'), json);
const counts = questions.reduce((acc, q) => (acc[q.source.kind] = (acc[q.source.kind] || 0) + 1, acc), {});
const coverage = { version: bank.version, courseCount: courses.length, topicCount: topics.length, questionCount: questions.length, provenance: counts, courses: courses.map(c => ({ id: c.id, title: c.title, topics: topics.filter(t => t.course === c.id).map(t => ({ number: t.number, title: t.title, questions: questions.filter(q => q.topic === t.id).length })) })) };
await writeFile(path.join(root, 'content/coverage.json'), JSON.stringify(coverage, null, 2) + '\n');
console.log(`${courses.length} asignaturas · ${topics.length} temas · ${questions.length} preguntas`, counts);
