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
const materials = await load('content/materials.json');
const topics = [], questions = [];
const norm = s => String(s).normalize('NFKC').replace(/\s+/g, ' ').trim();
const signature = q => JSON.stringify([norm(q.question).toLocaleLowerCase('es'), q.options.map(norm)]);
const escapeRE = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
for (const [courseIndex, course] of courses.entries()) {
  const base = await load(`content/base/${course.id}.json`);
  const additions = await load(`content/additions/${course.id}.json`);
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
    rows.forEach((q, index) => {
      if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct > 3 || q.options.length !== 4 || q.options.some(o => !norm(o))) throw Error(`Opciones inválidas ${course.id}/${number}/${index}`);
      if (new Set(q.options.map(norm)).size !== 4) throw Error(`Opciones repetidas ${course.id}/${number}/${index}`);
      if (unique.has(signature(q))) throw Error(`Pregunta duplicada ${course.id}/${number}/${index}`);
      unique.add(signature(q));
      const id = `${course.id}-t${String(number).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`;
      const fullText = [q.question, ...q.options, q.explanation].join(' ');
      const terms = Object.fromEntries(Object.entries({ ...glossary, ...(q.glossary || {}) }).filter(([term]) => new RegExp(`(?<![A-Za-z0-9])${escapeRE(term)}(?![A-Za-z0-9])`).test(fullText)));
      if (terms.DROP && /\bSQL\b|bases? de datos/i.test(fullText)) terms.DROP = 'En SQL, instrucción para eliminar un objeto de la base de datos, por ejemplo una tabla; es diferente del veredicto DROP de un cortafuegos.';
      // Some source explanations already carry a hand-written «Siglas:» note; merge it with the glossary note instead of repeating it.
      const [body, manual = ''] = norm(q.explanation).split(/\s*Siglas:\s*/);
      const expansion = [manual, ...Object.entries(terms).filter(([key]) => !manual.includes(`${key}:`)).map(([key, value]) => `${key}: ${value}`)].filter(Boolean).join(' ');
      const source = { kind: q.kind || 'practice', title: `Temario UNIR · Tema ${number}. ${topic.title}`, page: q.source_page };
      // Course-level links contain no student attempt/history identifiers.
      if (q.reference) {
        const url = new URL(q.reference);
        if (url.hostname === 'campusonline.unir.net') source.reference = 'https://campusonline.unir.net/mod/quiz/view.php?id=524449';
        else if (url.protocol === 'https:') source.reference = url.href;
      }
      if (q.source_question !== undefined) source.originalQuestion = q.source_question;
      if (q.original_issue) source.adaptation = q.original_issue;
      questions.push({ id, course: course.id, topic: topic.id, test: `Tema ${number}`, order: index + 1, text: norm(q.question), options: q.options.map((text, i) => ({ key: 'abcd'[i], text: norm(text) })), correct: 'abcd'[q.correct], explanation: body + (expansion ? ` Siglas y términos: ${expansion}` : ''), difficulty: q.difficulty || 'media', source, ...(Object.keys(terms).length ? { glossary: terms } : {}) });
    });
  }
}
const bank = { version: '2026-11-02.2', title: 'Bitácora Ciber', context: 'Práctica personal a partir del material docente. Solo la categoría campus-confirmed incorpora corrección observada en el campus; las demás claves están razonadas para estudiar. Los simulacros no reproducen reglas oficiales. Las referencias de versiones y normativa pertenecen al material citado.', courses, topics, questions };
validateBank(bank);
if (questions.length !== 1500) throw Error('Cobertura incompleta');
if (questions.filter(q => q.source.kind === 'campus-confirmed').some(q => q.course !== 'sistemas' || q.topic !== 1)) throw Error('Confirmación campus fuera de su alcance');
const json = JSON.stringify(bank, null, 2) + '\n';
if (json.includes(homedir() + '/') || /"source_pdf"|mod\/quiz\/review\.php\?attempt=/i.test(json)) throw Error('Datos locales o personales inesperados en el banco');
await mkdir(path.join(root, 'dist'), { recursive: true });
await writeFile(path.join(root, 'dist/bank.json'), json);
const counts = questions.reduce((acc, q) => (acc[q.source.kind] = (acc[q.source.kind] || 0) + 1, acc), {});
const coverage = { version: bank.version, courseCount: courses.length, topicCount: topics.length, questionCount: questions.length, provenance: counts, courses: courses.map(c => ({ id: c.id, title: c.title, topics: topics.filter(t => t.course === c.id).map(t => ({ number: t.number, title: t.title, questions: questions.filter(q => q.topic === t.id).length })) })) };
await writeFile(path.join(root, 'content/coverage.json'), JSON.stringify(coverage, null, 2) + '\n');
console.log(`${courses.length} asignaturas · ${topics.length} temas · ${questions.length} preguntas`, counts);
