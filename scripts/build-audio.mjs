// Narración de los temas digitales con ElevenLabs.
//
//   El texto que se narra es el guion de content/audio/<curso>/tema-NN.json (ver content/audio/README.md).
//   node scripts/build-audio.mjs --plan                 qué se generaría y cuánto cuesta (no llama a la API)
//   node scripts/build-audio.mjs --voices               voces disponibles en la cuenta
//   node scripts/build-audio.mjs sistemas/1 --voice ID  genera un tema
//   node scripts/build-audio.mjs --top 3 --voice ID     genera los 3 temas más largos que falten
//   --voice admite varias separadas por comas (se turnan por apartado). opciones: --model eleven_multilingual_v2 | eleven_flash_v2_5 ...   --only <apartado>   --force
//
// La clave se lee de la variable de entorno ELEVENLABS (o ELEVENLABS_API_KEY). Nunca va al repositorio.
// Salida: dist/audio/<tema>/<apartado>.mp3 y dist/audio/<tema>.json (índice con los tiempos de cada bloque).
// Un apartado cuyo texto no ha cambiado no se vuelve a generar (se compara un hash), así no se gastan créditos dos veces.
// Cambiar las voces tampoco regenera lo ya hecho: para rehacerlo con las voces nuevas, añadir --force.
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const API = 'https://api.elevenlabs.io/v1';
const MAX_CHARS = 4500; // por petición; los apartados más largos se parten por bloques
const FORMAT = 'mp3_22050_32'; // voz en mono: unos 14 MB por hora

const args = process.argv.slice(2);
const flag = name => args.includes(`--${name}`);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const valued = new Set(['voice', 'model', 'only', 'top']);
const targets = args.filter((a, i) => !a.startsWith('--') && !valued.has((args[i - 1] || '').slice(2)));
const key = process.env.ELEVENLABS || process.env.ELEVENLABS_API_KEY || '';
const model = opt('model', process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2');
// Varias voces separadas por comas: se van turnando, una por apartado, para que la escucha no sea monótona.
// Por defecto: Sarah, George, Charlotte y Brian (voces estándar de ElevenLabs, dos de mujer y dos de hombre).
const DEFAULT_VOICES = 'EXAVITQu4vr4xnSDxMaL,JBFqnCBsd6RMkjVDRZzb,XB0fDUnXU5powFXDhCwa,nPczCjzI2devNBz1zQrb';
const voices = opt('voice', process.env.ELEVENLABS_VOICE || DEFAULT_VOICES).split(',').map(v => v.trim()).filter(Boolean);
const voice = voices[0] || '';
const voiceFor = (t, s) => voices[t.tema.sections.indexOf(s) % voices.length];
const LITERAL = flag('literal');

// ---------- Texto hablado ----------
const plain = s => String(s || '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
const sentence = s => { const t = plain(s); return !t ? '' : /[.!?…:]$/.test(t) ? t : t + '.'; };
const LABEL = { analogy: 'Imagínalo así.', example: 'Ejemplo.', exam: 'Así cae en el test.', key: 'Idea clave.' };
// Devuelve el texto que se lee de un bloque, o '' si no se narra (tablas, código y esquemas sin «speech»).
export function spoken(b) {
  if (b.speech) return sentence(b.speech);
  const title = b.title ? sentence(b.title) + ' ' : '';
  switch (b.type) {
    case 'p': return sentence(b.text);
    case 'analogy': case 'example': case 'exam': case 'key': return `${LABEL[b.type]} ${title}${sentence(b.text)}`;
    case 'term': return `${sentence(b.term)} ${sentence(b.text)}`;
    case 'list': return title + b.items.map(sentence).join(' ');
    case 'steps': return title + b.items.map((it, i) => `Paso ${i + 1}. ${sentence(it)}`).join(' ');
    default: return '';
  }
}
// Guion hablado de un apartado (content/audio/<curso>/tema-NN.json): un resumen explicado, no la lectura literal.
// Cada segmento apunta con «b» al bloque del tema que explica (para resaltarlo mientras suena). b = -1 es el título.
// Con --literal se lee el tema tal cual (sin tablas, código ni esquemas).
export function segments(section, guion) {
  const list = [{ b: -1, text: sentence(section.title) }];
  if (guion) guion.forEach(g => list.push({ b: g.b, text: sentence(g.text) }));
  else if (LITERAL) section.blocks.forEach((b, i) => { const text = spoken(b); if (text) list.push({ b: i, text }); });
  else return [];
  return list;
}
export function checkGuion(tema, guion, name) {
  const errors = []; const ids = new Set(tema.sections.map(s => s.id));
  for (const id of Object.keys(guion.sections || {})) if (!ids.has(id)) errors.push(`${name}: el apartado «${id}» no existe en el tema`);
  for (const s of tema.sections) {
    const g = guion.sections?.[s.id]; if (!g) { errors.push(`${name}: falta el guion de «${s.id}»`); continue; }
    if (!Array.isArray(g) || !g.length) { errors.push(`${name}/${s.id}: debe ser una lista de segmentos`); continue; }
    let last = -1; let chars = 0;
    g.forEach((x, i) => {
      if (!Number.isInteger(x.b) || x.b < 0 || x.b >= s.blocks.length) errors.push(`${name}/${s.id}[${i}]: b=${x.b} fuera de rango (0-${s.blocks.length - 1})`);
      else if (x.b < last) errors.push(`${name}/${s.id}[${i}]: los b deben ir en orden creciente`); else last = x.b;
      if (typeof x.text !== 'string' || x.text.trim().length < 40) errors.push(`${name}/${s.id}[${i}]: texto vacío o demasiado corto`);
      else { chars += x.text.length; if (/[*_#`|<>\[\]]|\n/.test(x.text)) errors.push(`${name}/${s.id}[${i}]: el texto lleva símbolos de formato`); }
    });
    if (chars < 350 || chars > 1500) errors.push(`${name}/${s.id}: ${chars} caracteres (debe estar entre 350 y 1500)`);
  }
  return errors;
}


const segsOf = (t, s) => segments(s, t.guion?.sections?.[s.id]);

// ---------- Temas ----------
const bank = JSON.parse(await readFile(path.join(root, 'dist/bank.json'), 'utf8'));
const temas = [];
for (const course of bank.courses) {
  const dir = path.join(root, 'content/temas', course.id);
  for (const file of (await readdir(dir).catch(() => [])).filter(f => /^tema-\d{2}\.json$/.test(f)).sort()) {
    const tema = JSON.parse(await readFile(path.join(dir, file), 'utf8'));
    const topic = bank.topics.find(t => t.course === course.id && t.number === tema.number);
    if (!topic) throw Error(`${course.id}/${file}: no está en bank.json`);
    const guion = JSON.parse(await readFile(path.join(root, 'content/audio', course.id, file), 'utf8').catch(() => 'null'));
    const name = `content/audio/${course.id}/${file}`;
    // Un guion con errores no se narra, pero no impide generar los demás temas.
    const errors = guion ? checkGuion(tema, guion, name) : [];
    if (errors.length) console.error(errors.join('\n'));
    const t = { id: topic.id, course: course.id, number: tema.number, title: tema.title, tema, guion: errors.length ? null : guion };
    t.chars = tema.sections.reduce((n, s) => n + sectionChars(t, s), 0);
    t.source = tema.sections.reduce((n, s) => n + JSON.stringify(s.blocks).length, 0); // tamaño del tema: para ordenar por «más largo»
    temas.push(t);
  }
}
temas.sort((a, b) => b.source - a.source); // los más largos primero

const outDir = path.join(root, 'dist/audio');
const manifestOf = async id => JSON.parse(await readFile(path.join(outDir, `${id}.json`), 'utf8').catch(() => 'null'));
const hashOf = (text, v = voice) => createHash('sha256').update(`${model}|${v}|${text}`).digest('hex').slice(0, 16);
const sectionText = (t, s) => segsOf(t, s).map(x => x.text).join('\n');
function sectionChars(t, s) { return segsOf(t, s).reduce((n, x) => n + x.text.length + 1, 0); }
async function pending(t) { // apartados que faltan o cuyo texto ha cambiado
  const m = await manifestOf(t.id);
  return t.tema.sections.filter(s => segsOf(t, s).length && (flag('force') || m?.sections?.[s.id]?.hash !== hashOf(sectionText(t, s), m?.sections?.[s.id]?.voice || m?.voice || voice)));
}

if (flag('plan') || (!targets.length && !flag('top') && !flag('voices'))) {
  const rate = /flash|turbo/.test(model) ? 0.05 : 0.10;
  let total = 0, left = 0;
  console.log(`Modelo ${model} · ${rate.toFixed(2)} $ por 1.000 caracteres (tarifa orientativa)\n`);
  for (const t of temas) {
    if (!t.chars) { console.log(`     — sin guion — · ${t.course}/${t.number} ${t.title}`); continue; }
    const todo = (await pending(t)).reduce((n, s) => n + sectionChars(t, s), 0);
    total += t.chars; left += todo;
    console.log(`${String(t.chars).padStart(6)} car. · ${Math.round(t.chars / 900)} min · ${(t.chars / 1000 * rate).toFixed(2).padStart(5)} $ · ${todo ? (todo === t.chars ? 'falta  ' : 'parcial') : 'hecho  '} · ${t.course}/${t.number} ${t.title}`);
  }
  console.log(`\nTotal ${total} caracteres (${(total / 1000 * rate).toFixed(0)} $). Falta por generar: ${left} (${(left / 1000 * rate).toFixed(0)} $).`);
  process.exit(0);
}

if (!key) { console.error('Falta la clave: define la variable de entorno ELEVENLABS.'); process.exit(1); }
const headers = { 'xi-api-key': key, 'content-type': 'application/json' };
async function api(url, init) {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(API + url, { ...init, headers });
    if (r.ok) return r.json();
    const body = (await r.text()).slice(0, 300);
    if ((r.status === 429 || r.status >= 500) && attempt < 4) { await new Promise(ok => setTimeout(ok, 2000 * 2 ** attempt)); continue; }
    throw Error(`ElevenLabs ${r.status}: ${body}`);
  }
}

if (flag('voices')) {
  const sub = await api('/user/subscription').catch(e => ({ error: e.message }));
  if (sub.error) console.log('No se ha podido leer la suscripción:', sub.error);
  else console.log(`Plan ${sub.tier}: usados ${sub.character_count} de ${sub.character_limit} créditos.\n`);
  const { voices } = await api('/voices');
  for (const v of voices) console.log(`${v.voice_id} · ${v.name} · ${[v.category, v.labels?.language, v.labels?.accent, v.labels?.gender, v.labels?.description].filter(Boolean).join(', ')}`);
  process.exit(0);
}

if (!voice) { console.error('Falta la voz: --voice <id> (mira las disponibles con --voices).'); process.exit(1); }

let chosen;
if (flag('top')) {
  chosen = [];
  for (const t of temas) { if (chosen.length >= Number(opt('top', 1))) break; if ((await pending(t)).length) chosen.push(t); }
} else {
  chosen = targets.map(x => { const [c, n] = x.split('/'); const t = temas.find(t => t.course === c && t.number === Number(n)); if (!t) throw Error(`Tema desconocido: ${x} (formato asignatura/número)`); return t; });
}

// Parte los segmentos en peticiones de menos de MAX_CHARS, siempre por bloques enteros.
function chunks(segs) {
  const out = [[]]; let size = 0;
  for (const s of segs) {
    if (size && size + s.text.length > MAX_CHARS) { out.push([]); size = 0; }
    out.at(-1).push(s); size += s.text.length + 1;
  }
  return out;
}

async function narrate(t, s) {
  const v = voiceFor(t, s); const segs = segsOf(t, s); const parts = []; const cues = []; let offset = 0; let prev = '';
  for (const chunk of chunks(segs)) {
    const text = chunk.map(x => x.text).join('\n');
    const r = await api(`/text-to-speech/${v}/with-timestamps?output_format=${FORMAT}`, { method: 'POST', body: JSON.stringify({ text, model_id: model, language_code: /flash|turbo|v3/.test(model) ? 'es' : undefined, previous_text: prev.slice(-300) || undefined }) });
    const al = r.alignment; let pos = 0;
    for (const x of chunk) { cues.push({ b: x.b, t: +(offset + (al.character_start_times_seconds[pos] ?? 0)).toFixed(2) }); pos += x.text.length + 1; }
    offset += al.character_end_times_seconds.at(-1) ?? 0;
    parts.push(Buffer.from(r.audio_base64, 'base64')); prev = text;
  }
  const dir = path.join(outDir, String(t.id)); await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${s.id}.mp3`), Buffer.concat(parts)); // MP3 de bitrate constante: se pueden unir tal cual
  return { hash: hashOf(sectionText(t, s), v), voice: v, duration: +offset.toFixed(2), cues };
}

for (const t of chosen) {
  const manifest = (await manifestOf(t.id)) || { topic: t.id, sections: {} };
  manifest.model = model; manifest.voice ||= voice;
  let todo = await pending(t); if (opt('only')) todo = todo.filter(s => s.id === opt('only'));
  console.log(`${t.course}/${t.number} ${t.title}: ${todo.length} apartados por generar`);
  for (const s of todo) {
    manifest.sections[s.id] = await narrate(t, s);
    // Se guarda tras cada apartado: si algo falla a mitad, lo ya pagado no se pierde.
    const order = Object.fromEntries(t.tema.sections.filter(x => manifest.sections[x.id]).map(x => [x.id, manifest.sections[x.id]]));
    await mkdir(outDir, { recursive: true });
    await writeFile(path.join(outDir, `${t.id}.json`), JSON.stringify({ ...manifest, sections: order }) + '\n');
    console.log(`  ✓ ${s.id} · ${Math.round(manifest.sections[s.id].duration)} s`);
  }
}
