// Prácticas de redacción: preguntas de desarrollo, casos prácticos, ejercicios de ordenar y emparejar,
// y el simulacro con la estructura real del examen (10 de test + redacción).
// app.js llama a setupPracticas(ctx) y delega en practicasRoute / practicasClick / practicasInput.
import { shuffle, formatTime } from './core.js?v=12';
import { hasKey, MODELS, currentModel, maskedKey, saveSettings, clearKey, gradeWithClaude, verifyKey } from './corrector.js?v=3';

let ctx, index = new Map(), cache = new Map(), temaData = new Map(), ticker = null;
const VERSION = () => encodeURIComponent(ctx.bank.version);

// Estructura del examen por asignatura (lo que dijeron los profesores en clase).
export const EXAM_RULES = {
  redes: { known: true, text: '10 preguntas tipo test (4 puntos, los fallos no restan) y 6 puntos de preguntas abiertas: 3 cortas de 2 puntos o 2 más largas de 3 puntos. Entran los temas y lo explicado en clase.' },
  gobierno: { known: true, penalty: true, text: 'Hora y media. 10 preguntas tipo test (5 de gobierno y 5 de análisis de riesgos, 4 puntos) en las que los fallos restan, y 2 preguntas de desarrollo de 3 puntos: una de gobierno (temas 1 a 4) y otra de análisis de riesgos (temas 6 a 10). El tema 5 solo cae en el test. En el desarrollo quiere profundidad: no basta una definición.' },
  ciberdelitos: { known: true, text: '10 preguntas tipo test de los 10 temas (4 puntos, los fallos no restan) y 2 casos prácticos pequeños, uno de regulación (temas 1 a 5) y otro de ciberdelitos (temas 6 a 10). Hay que razonar y fundamentar; nunca piden números de artículo.' },
  forense: { known: false, text: 'Test y un ejercicio teórico-práctico de desarrollo sin una única respuesta correcta. El esquema general del proceso forense hay que saber escribirlo. Aquí se simula con 10 de test, un caso y una pregunta de desarrollo.' },
  sistemas: { known: false, text: 'El profesor explicará la estructura al final del curso. Ya ha dicho que entra solo «Ideas clave» (no «A fondo») y que habrá test y problemas con vulnerabilidades en código y su solución. Se simula con 10 de test y 2 preguntas de desarrollo de 3 puntos.' }
};
const EXAM_MINUTES = 90;
const TEST_POINTS = 0.4;

export function setupPracticas(c) {
  ctx = c;
  if (typeof document === 'undefined') return;
  document.addEventListener('input', practicasInput);
  document.addEventListener('change', practicasChange);
  document.addEventListener('click', e => { const b = e.target.closest?.('[data-action]'); if (b && !b.disabled) practicasClick(e, b); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && location.hash.startsWith('#/examen-real/en-curso')) examTimeUp(); });
}
export async function loadPracticasIndex() {
  try {
    const idx = await fetch(`practicas/index.json?v=${VERSION()}`, { signal: AbortSignal.timeout(15000) }).then(r => r.ok ? r.json() : null);
    if (Array.isArray(idx?.practicas)) index = new Map(idx.practicas.filter(p => Number.isInteger(p.topic)).map(p => [p.topic, p]));
  } catch { index = new Map(); }
}
export const hasPracticas = n => index.has(n);

function load(map, url, n) {
  const hit = map.get(n); if (hit) return hit;
  const entry = { status: 'loading', data: null, promise: null }; map.set(n, entry);
  entry.promise = fetch(url, { signal: AbortSignal.timeout(15000) })
    .then(r => { if (!r.ok) throw Error('HTTP ' + r.status); return r.json(); })
    .then(d => { entry.status = 'ready'; entry.data = d; })
    .catch(() => { entry.status = 'error'; });
  return entry;
}
const loadPrac = n => load(cache, `practicas/${n}.json?v=${VERSION()}`, n);
const loadTemaData = n => load(temaData, `temas/${n}.json?v=${VERSION()}`, n);
function whenReady(entry) { entry.promise?.finally(() => { if (location.hash.startsWith('#/redaccion') || location.hash.startsWith('#/examen-real')) ctx.render(false); }); }
function ready(n) { const e = loadPrac(n); if (e.status === 'loading') whenReady(e); return e; }

const esc = v => ctx.esc(v);
const rich = v => ctx.rich(v).replace(/`([^`\n]+)`/g, '<code>$1</code>');
// Enunciado: la primera línea es la pregunta; las siguientes (reglas, código, opciones) van en un bloque aparte.
function promptHtml(text, tag, cls = '') {
  const [first, ...rest] = String(text).split('\n'); const long = first.length > 150 ? ' is-long' : '';
  return `<${tag} class="${cls}${long}">${rich(first)}</${tag}>${rest.length ? `<div class="rd-lines">${rest.filter(l => l.trim()).map(l => `<span>${rich(l)}</span>`).join('')}</div>` : ''}`;
}
const paras = list => list.map(p => `<p>${rich(p)}</p>`).join('');
const state = id => { const s = ctx.read('red:' + id, null); return s && typeof s === 'object' && Array.isArray(s.texts) ? s : { texts: [], checks: [], revealed: false }; };
const saveState = (id, s) => ctx.write('red:' + id, { ...s, at: Date.now() });
const pts = n => n.toLocaleString('es-ES', { maximumFractionDigits: 2 });
const roundQuarter = x => Math.round(x * 4) / 4;
const words = t => (String(t || '').trim().match(/\S+/g) || []).length;
const loading = msg => `<div class="loading"><span class="spinner" aria-hidden="true"></span><p>${msg}</p></div>`;
const kindLabel = q => q.kind === 'corta' ? 'Pregunta corta' : 'Pregunta de desarrollo';
const allKeyPoints = item => item.questions ? item.questions.map(q => q.keyPoints) : [item.keyPoints];

// Nota autoevaluada: puntos × (puntos clave marcados / puntos clave totales), redondeada a 0,25.
export function selfScore(item, checks) {
  const groups = allKeyPoints(item); const total = groups.reduce((n, g) => n + g.length, 0);
  const done = groups.reduce((n, g, i) => n + g.filter((_, j) => checks?.[i]?.[j]).length, 0);
  return total ? roundQuarter(item.points * done / total) : 0;
}

function sectionLinks(topic, ids, tema) {
  if (!ids?.length) return '';
  const title = id => tema?.sections?.find(s => s.id === id)?.title || id;
  return `<p class="rd-sections">Repasar en el tema: ${ids.map(id => `<a href="${ctx.sectionHref(topic, id)}">${esc(title(id))}</a>`).join(' · ')}</p>`;
}

function aiPrompt(item, course, texts) {
  const qs = item.questions || [item];
  const head = `Actúa como profesor de la asignatura «${ctx.courseTitle(course)}» de un máster de ciberseguridad. Corrige mi respuesta a esta ${item.questions ? 'pregunta de caso práctico' : 'pregunta de examen'} (vale ${item.points} puntos). Sé exigente pero claro: soy principiante.`;
  const scen = item.scenario ? `\n\nENUNCIADO DEL CASO:\n${item.scenario.join('\n')}` : '';
  const body = qs.map((q, i) => `\n\n${qs.length > 1 ? `PREGUNTA ${i + 1}` : 'PREGUNTA'}: ${q.prompt}\nPUNTOS QUE BUSCA EL CORRECTOR:\n${q.keyPoints.map(k => '- ' + k).join('\n')}\nRESPUESTA MODELO (referencia):\n${q.model.join('\n').replace(/\*\*/g, '')}\nMI RESPUESTA:\n${(texts[i] || '').trim() || '(en blanco)'}`).join('');
  return `${head}${scen}${body}\n\nDame: 1) una nota sobre ${item.points} con una frase de justificación; 2) qué puntos clave he cubierto y cuáles faltan; 3) errores o imprecisiones; 4) cómo reescribiría mi respuesta para sacar la máxima nota, en el mismo tiempo de examen.`;
}

// ---------- Tarjeta en la página del tema ----------
export function practicasCard(topic) {
  const info = index.get(topic.id); if (!info) return '';
  const items = [...info.open.map(q => q.id), ...info.cases];
  const done = items.filter(id => state(id).revealed).length;
  return `<section class="rd-card" aria-labelledby="rd-card-title"><h2 id="rd-card-title">Practica la redacción</h2><p>En el examen la redacción vale 6 de 10 puntos. Escribe tus respuestas y corrígelas con la rúbrica y la respuesta modelo.</p><p class="material-meta">${info.open.length} preguntas de desarrollo · ${info.cases.length} ${info.cases.length === 1 ? 'caso práctico' : 'casos prácticos'}${info.order ? ' · ordenar' : ''} · emparejar conceptos${done ? ` · ${done}/${items.length} hechas` : ''}</p><a class="btn" href="#/redaccion/${topic.id}">Practicar redacción →</a></section>`;
}
export function courseExamLink(course) {
  if (![...index.values()].some(p => p.course === course)) return '';
  return `<a class="btn full course-sim rd-exam-link" href="#/examen-real?asignatura=${esc(course)}">Examen real: test + redacción →</a>`;
}
export function simulacroExamLink() {
  if (!index.size) return '';
  return `<a class="resume-link rd-exam-banner" href="#/examen-real"><span><b>Nuevo · Examen con la estructura real</b><small>10 de test (4 puntos) + preguntas de desarrollo o casos (6 puntos), como en el examen de cada asignatura</small></span><span aria-hidden="true">→</span></a>`;
}

// ---------- Rutas ----------
export function practicasRoute(path, params) {
  stopTicker();
  if (path === '/examen-real/en-curso' && examTimeUp()) return loading('Tiempo agotado. Entregando el examen…');
  queueMicrotask(afterPracticasRender);
  let m;
  if ((m = path.match(/^\/redaccion\/(\d+)$/))) return hubPage(Number(m[1]));
  if ((m = path.match(/^\/redaccion\/(\d+)\/ordenar\/([a-z0-9-]+)$/))) return orderPage(Number(m[1]), m[2]);
  if ((m = path.match(/^\/redaccion\/(\d+)\/emparejar$/))) return matchPage(Number(m[1]));
  if ((m = path.match(/^\/redaccion\/(\d+)\/([a-z0-9-]+)$/))) return itemPage(Number(m[1]), m[2]);
  if (path === '/examen-real') return examSetup(params.get('asignatura') || ctx.read('realExamCourse', '') || '');
  if (path === '/examen-real/en-curso') return examRun();
  if ((m = path.match(/^\/examen-real\/resultado\/([a-z0-9-]+)$/))) return examResult(m[1]);
  return null;
}
export const isPracticasPath = path => path.startsWith('/redaccion/') || path.startsWith('/examen-real');

function topicHead(n, back, sub) {
  const t = ctx.topicInfo(n);
  return `<a class="back-link" href="${back.href}">← ${esc(back.label)}</a><p class="eyebrow">${esc(ctx.courseTitle(t.course).toUpperCase())} · TEMA ${t.number}${sub ? ' · ' + esc(sub.toUpperCase()) : ''}</p>`;
}

function hubPage(n) {
  const topic = ctx.topicInfo(n); if (!topic || !index.has(n)) return ctx.notFound();
  const e = ready(n); if (e.status === 'loading') return loading('Cargando las prácticas del tema…');
  if (e.status === 'error') return errorBox(n);
  const p = e.data; const tema = loadTemaData(n); if (tema.status === 'loading') whenReady(tema);
  const rule = EXAM_RULES[topic.course];
  const row = (item, label, meta) => {
    const s = state(item.id); const sc = s.revealed ? selfScore(item, s.checks) : null;
    return `<a class="test-row" href="#/redaccion/${n}/${item.id}"><span class="test-number">${label}</span><div><h2>${rich(String(item.title || item.prompt).split('\n')[0])}</h2><p>${meta}${item.fromClass ? ' · <b>Remarcada en clase</b>' : ''}</p></div><span class="test-state">${sc !== null ? `${pts(sc)}/${item.points}` : s.texts.some(t => t?.trim()) ? 'Continuar' : '›'}</span></a>`;
  };
  const glossary = tema.data?.glossary?.length >= 4;
  return `${topicHead(n, { href: `#/tema/${n}`, label: ctx.topicTitle(n) }, 'Redacción')}${ctx.heading('Practica la redacción', esc(ctx.topicTitle(n)))}
<aside class="rd-rule"><b>Así es el examen de ${esc(ctx.courseTitle(topic.course))}${rule.known ? '' : ' (estructura supuesta)'}</b><p>${esc(rule.text)}</p></aside>
<div class="rd-hub">
<section aria-labelledby="rd-open"><h2 id="rd-open" class="rd-h2">Preguntas de desarrollo</h2><div class="test-list">${p.open.map((q, i) => row(q, q.kind === 'corta' ? '2p' : '3p', `${kindLabel(q)} · ${q.points} puntos · unos ${q.minutes} min`)).join('')}</div></section>
${p.cases.length ? `<section aria-labelledby="rd-cases"><h2 id="rd-cases" class="rd-h2">Casos prácticos</h2><div class="test-list">${p.cases.map((c, i) => row(c, 'C' + (i + 1), `${c.questions.length} ${c.questions.length === 1 ? 'pregunta' : 'preguntas'} · ${c.points} puntos · unos ${c.minutes} min`)).join('')}</div></section>` : ''}
<section aria-labelledby="rd-quick"><h2 id="rd-quick" class="rd-h2">Ejercicios rápidos</h2><div class="test-list">${(p.order || []).map(o => `<a class="test-row" href="#/redaccion/${n}/ordenar/${o.id}"><span class="test-number">↕</span><div><h2>${esc(o.title)}</h2><p>Ordena ${o.items.length} pasos${ctx.read('ord:' + o.id, null)?.ok ? ' · <b>Superado</b>' : ''}</p></div><span class="test-state">›</span></a>`).join('')}${glossary ? `<a class="test-row" href="#/redaccion/${n}/emparejar"><span class="test-number">⇄</span><div><h2>Empareja cada concepto con su definición</h2><p>6 conceptos al azar del glosario del tema</p></div><span class="test-state">›</span></a>` : ''}</div></section>
</div>
<p class="local-note">La nota de cada respuesta es una autoevaluación: marcas los puntos clave que has incluido y se calcula la parte proporcional. Para una corrección más fina, usa «Copiar para corregir con IA» y pégalo en Claude. Tus respuestas se guardan solo en este navegador.</p>`;
}
function errorBox(n) { return `<div class="empty-state"><h1>No se han podido cargar las prácticas.</h1><p>Comprueba tu conexión y vuelve a intentarlo.</p><button class="btn" data-action="rd-retry" data-topic="${n}">Volver a cargar</button></div>`; }

function findItem(p, id) { return p.open.find(q => q.id === id) || p.cases.find(c => c.id === id) || null; }

function itemPage(n, id) {
  const topic = ctx.topicInfo(n); if (!topic || !index.has(n)) return ctx.notFound();
  const e = ready(n); if (e.status === 'loading') return loading('Cargando la práctica…');
  if (e.status === 'error') return errorBox(n);
  const item = findItem(e.data, id); if (!item) return ctx.notFound();
  const tema = loadTemaData(n); if (tema.status === 'loading') whenReady(tema);
  const s = state(id); const isCase = !!item.questions; const qs = item.questions || [item];
  const all = isCase ? [...e.data.cases] : [...e.data.open]; const pos = all.indexOf(item);
  const next = all[pos + 1];
  const sc = s.revealed ? selfScore(item, s.checks) : 0;
  const answerBox = (q, i) => `<div class="rd-answer"><label class="rd-label" for="rd-text-${i}">${isCase ? `<span class="rd-qn">${i + 1}</span>` : ''}${isCase ? rich(q.prompt) : 'Tu respuesta'}</label><textarea id="rd-text-${i}" class="rd-textarea" data-rd-item="${esc(id)}" data-rd-index="${i}" rows="${isCase ? 7 : 12}" placeholder="Escribe como en el examen: idea principal primero, luego los detalles y un ejemplo." ${s.revealed ? 'readonly' : ''}>${esc(s.texts[i] || '')}</textarea><p class="rd-count" data-rd-count="${i}">${words(s.texts[i])} palabras</p>${s.revealed ? correction(q, i, s) : ''}</div>`;
  return `${topicHead(n, { href: `#/redaccion/${n}`, label: 'Prácticas de redacción del tema' }, isCase ? 'Caso práctico' : kindLabel(item))}
<div class="rd-item ${isCase ? 'is-case' : ''}">
<div class="rd-prompt">
${promptHtml(isCase ? item.title : item.prompt, 'h1', 'rd-title')}
<p class="rd-meta"><span>${item.points} puntos</span><span>Unos ${item.minutes} minutos</span>${item.fromClass ? '<span class="rd-class">Remarcada en clase</span>' : ''}</p>
${isCase ? `<div class="rd-scenario">${paras(item.scenario)}</div>` : ''}
${!s.revealed ? `<div class="rd-clock" aria-live="off"><span>Tiempo de escritura</span><strong id="rd-clock" data-start="${s.startedAt || ''}" data-limit="${item.minutes}">${s.startedAt ? '' : formatTime(item.minutes * 60000)}</strong>${s.startedAt ? '' : '<button class="btn text" data-action="rd-start">Empezar el reloj</button>'}</div>
<details class="rd-hint"><summary>¿Atascado? Pista</summary><p>El corrector busca ${allKeyPoints(item).reduce((a, g) => a + g.length, 0)} ideas. Piensa en: qué es, para qué sirve, cómo funciona, un ejemplo y la diferencia con lo que se le parece.</p>${sectionLinks(n, item.sections, tema.data)}</details>` : `<div class="rd-score"><span class="practice-score">${pts(sc)}<small>/${item.points}</small></span><p>Nota según los puntos clave marcados${s.ai ? ` · Claude: <b>${pts(s.ai.score)}/${item.points}</b>` : ''}.</p></div>`}${s.revealed ? aiBlock(s.ai, { item: id, topic: n, points: item.points }) : ''}
</div>
<div class="rd-work">
${qs.map(answerBox).join('')}
${s.revealed
    ? `${item.tip ? `<aside class="rd-tip"><b>Consejo</b><p>${rich(item.tip)}</p></aside>` : ''}${sectionLinks(n, item.sections, tema.data)}<div class="actions"><button class="btn secondary" data-action="rd-copy" data-item="${esc(id)}" data-topic="${n}">Copiar para corregir con IA</button><button class="btn secondary" data-action="rd-reset" data-item="${esc(id)}">Volver a intentarlo</button>${next ? `<a class="btn" href="#/redaccion/${n}/${next.id}">Siguiente ${isCase ? 'caso' : 'pregunta'} →</a>` : `<a class="btn" href="#/redaccion/${n}">Volver a las prácticas del tema</a>`}</div><p class="rd-copied small" role="status" hidden></p>`
    : `<button class="btn full rd-reveal" data-action="rd-reveal" data-item="${esc(id)}">Terminar y corregir</button><p class="small">Al corregir verás la rúbrica y la respuesta modelo. Marca con sinceridad lo que sí has puesto.</p>`}
</div></div>`;
}
// ---------- Corrección con Claude ----------
let aiSetupOpen = false, aiBusy = false;
function aiSetup() {
  return `<div class="rd-ai-setup"><h3>Conectar Claude</h3><p>Pega tu <b>API key de Console</b> (empieza por <code>sk-ant-</code>; se crea en platform.claude.com → API keys). Se guarda <b>solo en este navegador</b>: no se sube a ningún sitio y las correcciones van directamente de aquí a Anthropic. Cada corrección se cobra en tu cuenta de Console.</p>
<label class="field-label" for="rd-ai-key">API key</label><input id="rd-ai-key" class="rd-input" type="password" autocomplete="off" spellcheck="false" placeholder="${hasKey() ? esc(maskedKey()) + ' (guardada; pega otra para cambiarla)' : 'sk-ant-…'}">
<label class="field-label" for="rd-ai-model">Modelo</label><select id="rd-ai-model" class="rd-input">${MODELS.map(m => `<option value="${m.id}" ${m.id === currentModel() ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}</select>
<div class="actions"><button class="btn" data-action="rd-ai-save">Guardar</button>${hasKey() ? '<button class="btn secondary" data-action="rd-ai-clear">Borrar la API key de este navegador</button>' : ''}</div><p class="rd-ai-status small" role="status"></p></div>`;
}
function aiBlock(ai, data) {
  const attrs = Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ');
  if (!hasKey() || aiSetupOpen) return `<section class="rd-ai">${aiSetup()}</section>`;
  return `<section class="rd-ai"><div class="rd-ai-head"><button class="btn rd-ai-btn" data-action="${data.exam ? 'rd-ai-grade-exam' : 'rd-ai-grade'}" ${attrs} ${aiBusy ? 'disabled' : ''}>${aiBusy ? 'Corrigiendo…' : ai ? 'Volver a corregir con Claude' : '✦ Corregir con Claude'}</button><button class="btn text" data-action="rd-ai-toggle">Ajustes de Claude</button></div><p class="rd-ai-status small" role="status"></p>${ai ? `<div class="rd-ai-summary"><span class="rd-ai-score">${pts(ai.score)}<small>/${data.points}</small></span><div><b>Nota de Claude</b><p>${rich(ai.summary)}</p><p class="small">Ha marcado en la rúbrica los puntos que ve cubiertos; puedes cambiarlos. Corregido por ${esc(ai.model || '')}.</p></div></div>` : ''}</section>`;
}
function aiPart(p) {
  if (!p) return '';
  const list = (t, xs, cls) => xs.length ? `<div class="${cls}"><b>${t}</b><ul>${xs.map(x => `<li>${rich(x)}</li>`).join('')}</ul></div>` : '';
  return `<div class="rd-ai-part">${p.good ? `<div class="rd-ai-good"><b>Bien</b><p>${rich(p.good)}</p></div>` : ''}${list('Te falta', p.missing, 'rd-ai-missing')}${list('Errores', p.errors, 'rd-ai-errors')}${p.improved ? `<details class="rd-model"><summary>Tu respuesta mejorada por Claude</summary><div>${paras(p.improved.split(/\n+/).filter(Boolean))}</div></details>` : ''}</div>`;
}
function correction(q, i, s) {
  const checks = s.checks?.[i] || [];
  return `<div class="rd-correction"><h3>Puntos clave que busca el corrector</h3><p class="small">Marca los que aparecen en tu respuesta.</p><ul class="rd-rubric">${q.keyPoints.map((k, j) => `<li><label><input type="checkbox" data-action="rd-check" data-i="${i}" data-j="${j}" ${checks[j] ? 'checked' : ''}><span>${rich(k)}</span></label></li>`).join('')}</ul><details class="rd-model" ${s.ai ? '' : 'open'}><summary>Respuesta modelo</summary><div>${paras(q.model)}</div></details>${aiPart(s.ai?.parts?.[i])}</div>`;
}

// ---------- Ordenar ----------
let orderState = new Map();
function orderPage(n, oid) {
  if (!ctx.topicInfo(n) || !index.has(n)) return ctx.notFound();
  const e = ready(n); if (e.status === 'loading') return loading('Cargando el ejercicio…');
  if (e.status === 'error') return errorBox(n);
  const o = (e.data.order || []).find(x => x.id === oid); if (!o) return ctx.notFound();
  let st = orderState.get(oid);
  if (!st) { let order; do { order = shuffle(o.items.map((_, i) => i)); } while (o.items.length > 2 && order.every((x, i) => x === i)); st = { order, checked: false }; orderState.set(oid, st); }
  const ok = st.checked && st.order.every((x, i) => x === i);
  return `${topicHead(n, { href: `#/redaccion/${n}`, label: 'Prácticas de redacción del tema' }, 'Ordenar')}${ctx.heading(esc(o.title), 'Usa las flechas para mover cada paso a su sitio y pulsa «Comprobar».')}
<ol class="rd-order">${st.order.map((x, i) => `<li class="${st.checked ? (x === i ? 'is-right' : 'is-wrong') : ''}"><span class="rd-order-n">${i + 1}</span><span class="rd-order-text">${rich(o.items[x])}</span>${st.checked ? `<span class="rd-order-mark" aria-label="${x === i ? 'En su sitio' : 'Fuera de sitio'}">${x === i ? '✓' : '✕'}</span>` : `<span class="rd-order-btns"><button class="btn secondary" data-action="rd-move" data-oid="${oid}" data-i="${i}" data-d="-1" aria-label="Subir «${esc(o.items[x])}»" ${i === 0 ? 'disabled' : ''}>↑</button><button class="btn secondary" data-action="rd-move" data-oid="${oid}" data-i="${i}" data-d="1" aria-label="Bajar «${esc(o.items[x])}»" ${i === st.order.length - 1 ? 'disabled' : ''}>↓</button></span>`}</li>`).join('')}</ol>
${st.checked ? `<p class="practice-feedback ${ok ? 'right' : 'wrong'}" role="status">${ok ? '✓ ¡Orden correcto!' : `${st.order.filter((x, i) => x === i).length} de ${o.items.length} en su sitio.`}</p><aside class="answer-explanation"><h3>Orden correcto</h3><ol>${o.items.map(t => `<li>${rich(t)}</li>`).join('')}</ol><p>${rich(o.why)}</p></aside>${sectionLinks(n, o.sections, loadTemaData(n).data)}<div class="actions"><button class="btn" data-action="rd-order-again" data-oid="${oid}">Otra vez</button><a class="btn secondary" href="#/redaccion/${n}">Volver a las prácticas</a></div>`
    : `<button class="btn full rd-reveal" data-action="rd-order-check" data-oid="${oid}">Comprobar</button>`}`;
}

// ---------- Emparejar (glosario del tema) ----------
let matchState = new Map();
function matchPage(n) {
  if (!ctx.topicInfo(n)) return ctx.notFound();
  const t = loadTemaData(n); if (t.status === 'loading') { whenReady(t); return loading('Cargando el glosario…'); }
  const g = t.data?.glossary || []; if (g.length < 4) return ctx.notFound();
  let st = matchState.get(n);
  if (!st) { const pick = shuffle(g.map((_, i) => i)).slice(0, Math.min(6, g.length)); st = { pick, defs: shuffle([...pick]), answers: {}, checked: false }; matchState.set(n, st); }
  const right = st.pick.filter(i => Number(st.answers[i]) === i).length;
  const defLetter = i => String.fromCharCode(65 + st.defs.indexOf(i));
  return `${topicHead(n, { href: `#/redaccion/${n}`, label: 'Prácticas de redacción del tema' }, 'Emparejar')}${ctx.heading('Empareja cada concepto', 'Elige, para cada concepto, la letra de su definición.')}
<div class="rd-match"><ol class="rd-defs" type="A">${st.defs.map(i => `<li>${rich(g[i].text)}</li>`).join('')}</ol>
<ul class="rd-terms">${st.pick.map(i => { const a = st.answers[i]; const good = st.checked && Number(a) === i; return `<li class="${st.checked ? (good ? 'is-right' : 'is-wrong') : ''}"><label for="rd-m-${i}">${rich(g[i].term)}</label><select id="rd-m-${i}" data-rd-match="${i}" data-topic="${n}" ${st.checked ? 'disabled' : ''}><option value="">—</option>${st.defs.map((d, k) => `<option value="${d}" ${String(a) === String(d) ? 'selected' : ''}>${String.fromCharCode(65 + k)}</option>`).join('')}</select>${st.checked && !good ? `<span class="rd-match-fix">Es la ${defLetter(i)}</span>` : ''}</li>`; }).join('')}</ul></div>
${st.checked ? `<p class="practice-feedback ${right === st.pick.length ? 'right' : 'wrong'}" role="status">${right} de ${st.pick.length} correctas.</p><div class="actions"><button class="btn" data-action="rd-match-again" data-topic="${n}">Otros conceptos</button><a class="btn secondary" href="#/redaccion/${n}">Volver a las prácticas</a></div>` : `<button class="btn full rd-reveal" data-action="rd-match-check" data-topic="${n}">Comprobar</button>`}`;
}

// ---------- Examen con la estructura real ----------
const topicsOf = course => ctx.bank.topics.filter(t => t.course === course);
const examKey = 'realExam:active';
function activeExam() { const s = ctx.read(examKey, null); return s && s.id && !s.finishedAt ? s : null; }
function examSetup(course) {
  const courses = ctx.bank.courses.filter(c => topicsOf(c.id).some(t => index.has(t.id)));
  if (!courses.length) return ctx.notFound();
  if (!courses.some(c => c.id === course)) course = courses[0].id;
  const active = activeExam(); const past = (ctx.read('realExam:list', []) || []).filter(x => x && x.id).slice(-8).reverse();
  const rule = EXAM_RULES[course];
  return `<a class="back-link" href="#/simulacro">← Simulacro</a>${ctx.heading('Examen con la estructura real', 'Test y redacción, como el examen final de cada asignatura.')}
${active ? `<aside class="resume-panel"><strong>Examen en curso: ${esc(ctx.courseTitle(active.course))}</strong><p>El reloj sigue corriendo.</p><a class="btn" href="#/examen-real/en-curso">Continuar →</a></aside>` : ''}
<section class="exam-brief"><label class="field-label" for="real-exam-course">Asignatura</label><select id="real-exam-course" class="rd-select">${courses.map(c => `<option value="${esc(c.id)}" ${c.id === course ? 'selected' : ''}>${esc(c.shortTitle || c.title)}</option>`).join('')}</select>
<div class="exam-numbers"><div><b>10</b><span>preguntas de test · 4 puntos</span></div><div><b>6</b><span>puntos de redacción</span></div><div><b>${EXAM_MINUTES}</b><span>minutos (orientativo)</span></div></div>
<aside class="rd-rule"><b>${rule.known ? 'Lo que dijo el profesorado' : 'Estructura supuesta'}</b><p>${esc(rule.text)}</p></aside>
<p class="small">Una pregunta de test de cada tema, 0,4 puntos cada una. ${rule.penalty ? 'En esta asignatura los fallos restan; el profesor no dijo cuánto, así que se resta un tercio de pregunta por fallo (0,13 puntos). Deja en blanco lo que no sepas.' : 'Los fallos no restan: responde todas.'} La redacción la corriges tú al entregar, con la rúbrica y la respuesta modelo. El intento se guarda en este navegador aunque recargues.</p>
<button class="btn full start-exam" data-action="rd-exam-start" data-course="${esc(course)}">${active ? 'Abandonar el actual y empezar otro' : 'Empezar examen'} →</button></section>
${past.length ? `<h2 class="rd-h2">Tus exámenes</h2><div class="history-list">${past.map(x => `<a class="history-row" href="#/examen-real/resultado/${esc(x.id)}"><div><h2>${esc(ctx.courseTitle(x.course))}</h2><p>${new Date(x.startedAt).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}</p></div><strong>${x.score !== undefined ? pts(x.score) : '—'}<small>/10</small></strong></a>`).join('')}</div>` : ''}`;
}

export function pickWriting(course, data, random = Math.random) {
  const open = data.flatMap(d => d.open.map(q => ({ ...q, topic: d.topic, number: d.number })));
  const cases = data.flatMap(d => d.cases.map(c => ({ ...c, topic: d.topic, number: d.number })));
  const pick = (list, filter, used) => shuffle(list.filter(x => filter(x) && !used.has(x.topic)), random)[0];
  const used = new Set(); const out = [];
  const add = x => { if (x) { used.add(x.topic); out.push({ id: x.id, topic: x.topic }); } };
  const larga = x => x.kind === 'larga';
  if (course === 'redes') {
    if (random() < .5) for (let i = 0; i < 3; i++) add(pick(open, x => x.kind === 'corta', used));
    else for (let i = 0; i < 2; i++) add(pick(open, larga, used));
  } else if (course === 'gobierno') {
    add(pick(open, x => larga(x) && x.number <= 4, used)); add(pick(open, x => larga(x) && x.number >= 6, used));
  } else if (course === 'ciberdelitos') {
    add(pick(cases, x => x.number <= 5, used)); add(pick(cases, x => x.number >= 6, used));
  } else if (course === 'forense') {
    add(pick(cases, () => true, used)); add(pick(open, larga, used));
  } else { add(pick(open, larga, used)); add(pick(open, larga, used)); }
  // Si faltara material, se completa hasta 6 puntos con lo que haya.
  const pointsOf = x => (findIn(data, x.id)?.points || 0);
  while (out.reduce((s, x) => s + pointsOf(x), 0) < 6) {
    const rest = [...cases, ...open].filter(x => !out.some(o => o.id === x.id));
    const x = shuffle(rest.filter(r => !used.has(r.topic)), random)[0] || shuffle(rest, random)[0];
    if (!x) break; add(x);
  }
  return out;
}
function findIn(data, id) { for (const d of data) { const x = findItem(d, id); if (x) return x; } return null; }

async function startExam(course) {
  const topics = topicsOf(course).filter(t => index.has(t.id));
  const entries = topics.map(t => loadPrac(t.id)); await Promise.all(entries.map(e => e.promise));
  const data = entries.filter(e => e.status === 'ready').map(e => e.data);
  if (!data.length) { alert('No se han podido cargar las preguntas de redacción. Revisa la conexión.'); return; }
  const testIds = topicsOf(course).map(t => shuffle(ctx.bank.questions.filter(q => q.topic === t.id && !q.fromCampus))[0]?.id).filter(Boolean);
  const exam = { id: Date.now().toString(36), course, startedAt: Date.now(), deadline: Date.now() + EXAM_MINUTES * 60000, testIds: shuffle(testIds).slice(0, 10), answers: {}, writing: pickWriting(course, data), texts: {}, checks: {}, finishedAt: null };
  ctx.write(examKey, exam); ctx.write('realExamCourse', course);
  location.hash = '/examen-real/en-curso';
}
function examItems(exam) {
  const out = []; for (const w of exam.writing) { const e = loadPrac(w.topic); if (e.status === 'loading') { whenReady(e); return null; } const x = e.data && findItem(e.data, w.id); if (x) out.push({ ...x, topic: w.topic }); }
  return out;
}
function examRun() {
  const exam = activeExam();
  if (!exam) return `${ctx.heading('No hay un examen en marcha.', 'Puedes empezar uno nuevo o revisar los que ya entregaste.')}<a class="btn" href="#/examen-real">Preparar examen →</a>`;
  const items = examItems(exam); if (!items) return loading('Preparando el examen…');
  const qs = exam.testIds.map(id => ctx.questionMap.get(id)).filter(Boolean);
  const answered = qs.filter(q => exam.answers[q.id]).length;
  let k = 0;
  const writing = items.map((item, wi) => { const parts = item.questions || [item]; return `<article class="rd-exam-w"><p class="eyebrow">PREGUNTA ${11 + wi} · ${item.questions ? 'CASO PRÁCTICO' : kindLabel(item).toUpperCase()} · ${item.points} PUNTOS · TEMA ${ctx.topicInfo(item.topic).number}</p>${promptHtml(item.questions ? item.title : item.prompt, 'h3')}${item.scenario ? `<div class="rd-scenario">${paras(item.scenario)}</div>` : ''}${parts.map((q, i) => { const key = `${item.id}:${i}`; k++; return `${item.questions ? `<label class="rd-label" for="rx-${k}"><span class="rd-qn">${i + 1}</span>${rich(q.prompt)}</label>` : `<label class="sr-only" for="rx-${k}">Tu respuesta</label>`}<textarea id="rx-${k}" class="rd-textarea" data-rx-key="${esc(key)}" rows="${item.questions ? 6 : 10}">${esc(exam.texts[key] || '')}</textarea>`; }).join('')}</article>`; }).join('');
  startTicker(exam.deadline, true);
  return `<div class="exam-top"><div><p class="eyebrow">EXAMEN CON ESTRUCTURA REAL · ${esc(ctx.courseTitle(exam.course).toUpperCase())}</p><p class="exam-position"><b>${answered}</b>/10 de test respondidas</p></div><div class="clock-box"><span>Tiempo restante</span><strong id="rd-exam-clock" role="timer">${formatTime(Math.max(0, exam.deadline - Date.now()))}</strong></div><button class="btn secondary" data-action="rd-exam-submit">Entregar</button></div>
<section class="rd-exam-part"><h2 class="rd-h2">Parte 1 · Test (4 puntos)</h2><p class="small">10 preguntas, 0,4 puntos cada una. ${EXAM_RULES[exam.course]?.penalty ? 'Los fallos restan: deja en blanco lo que no sepas.' : 'Los fallos no restan: responde todas.'}</p>${qs.map((q, i) => `<fieldset class="rd-exam-q"><legend><span class="rd-qn">${i + 1}</span>${esc(q.text)}</legend>${q.options.map(o => `<label class="answer-option ${exam.answers[q.id] === o.key ? 'selected' : ''}"><input type="radio" name="rx-${esc(q.id)}" data-rx-q="${esc(q.id)}" value="${o.key}" ${exam.answers[q.id] === o.key ? 'checked' : ''}><span class="option-letter">${o.key.toUpperCase()}</span><span>${esc(o.text)}</span></label>`).join('')}</fieldset>`).join('')}</section>
<section class="rd-exam-part"><h2 class="rd-h2">Parte 2 · Redacción (6 puntos)</h2><p class="small">Responde con frases completas y fundamenta. Se guarda mientras escribes.</p>${writing}</section>
<button class="btn full rd-reveal" data-action="rd-exam-submit">Entregar examen</button>`;
}
function finishExam(expired = false) {
  const exam = ctx.read(examKey, null); if (!exam || exam.finishedAt) return;
  exam.finishedAt = Date.now(); exam.expired = expired;
  ctx.write('realExam:' + exam.id, exam); ctx.write(examKey, null);
  const list = (ctx.read('realExam:list', []) || []).filter(x => x && x.id !== exam.id); list.push({ id: exam.id, course: exam.course, startedAt: exam.startedAt });
  ctx.write('realExam:list', list.slice(-30));
  location.hash = '/examen-real/resultado/' + exam.id;
}
function examScore(exam, items) {
  const qs = exam.testIds.map(id => ctx.questionMap.get(id)).filter(Boolean);
  const right = qs.filter(q => exam.answers[q.id] === q.correct).length;
  const wrong = qs.filter(q => exam.answers[q.id] && exam.answers[q.id] !== q.correct).length;
  const penalty = EXAM_RULES[exam.course]?.penalty ? wrong * TEST_POINTS / 3 : 0;
  const testPts = Math.max(0, right * TEST_POINTS - penalty);
  const writing = items.map(item => { const parts = item.questions || [item]; return selfScore(item, parts.map((_, i) => exam.checks?.[`${item.id}:${i}`] || [])); });
  return { qs, right, wrong, penalty, test: Math.round(testPts * 100) / 100, writing, total: Math.round((testPts + writing.reduce((a, b) => a + b, 0)) * 100) / 100 };
}
function examResult(id) {
  const exam = ctx.read('realExam:' + id, null); if (!exam) return ctx.notFound();
  const items = examItems(exam); if (!items) return loading('Cargando la corrección…');
  const r = examScore(exam, items);
  const list = ctx.read('realExam:list', []) || []; const row = list.find(x => x.id === id); if (row && row.score !== r.total) { row.score = r.total; ctx.write('realExam:list', list); }
  return `<a class="back-link" href="#/examen-real">← Examen con la estructura real</a>${ctx.heading('Tu corrección', `${esc(ctx.courseTitle(exam.course))}${exam.expired ? ' · Tiempo agotado' : ''}`)}
<section class="practice-result"><span class="practice-score" id="rd-total">${pts(r.total)}<small>/10</small></span><p>Test: ${r.right}/10 aciertos${r.penalty ? `, ${r.wrong} fallos (restan)` : ''} = ${pts(r.test)} puntos · Redacción: <span id="rd-wtotal">${pts(r.writing.reduce((a, b) => a + b, 0))}</span>/6 (autoevaluada)</p></section>
<p class="small">Corrige la redacción: en cada pregunta marca los puntos clave que aparecen en lo que escribiste, o pulsa «Corregir con Claude» para que los marque Claude. La nota se actualiza al momento.</p>
${items.map((item, wi) => { const parts = item.questions || [item]; return `<article class="rd-exam-w rd-exam-fix"><p class="eyebrow">PREGUNTA ${11 + wi} · ${item.points} PUNTOS · <span data-rd-wscore="${wi}">${pts(r.writing[wi])}</span>/${item.points}</p>${promptHtml(item.questions ? item.title : item.prompt, 'h3')}${item.scenario ? `<details class="rd-scenario-d"><summary>Ver el enunciado del caso</summary>${paras(item.scenario)}</details>` : ''}${parts.map((q, i) => { const key = `${item.id}:${i}`; const checks = exam.checks?.[key] || []; return `${item.questions ? `<h4 class="rd-label"><span class="rd-qn">${i + 1}</span>${rich(q.prompt)}</h4>` : ''}<div class="rd-mine"><b>Tu respuesta</b>${(exam.texts[key] || '').trim() ? (exam.texts[key] || '').trim().split(/\n+/).map(t => `<p>${esc(t)}</p>`).join('') : '<p><i>En blanco</i></p>'}</div><ul class="rd-rubric">${q.keyPoints.map((kp, j) => `<li><label><input type="checkbox" data-action="rx-check" data-exam="${esc(id)}" data-key="${esc(key)}" data-j="${j}" ${checks[j] ? 'checked' : ''}><span>${rich(kp)}</span></label></li>`).join('')}</ul><details class="rd-model"><summary>Respuesta modelo</summary><div>${paras(q.model)}</div></details>${aiPart(exam.ai?.[item.id]?.parts?.[i])}`; }).join('')}${aiBlock(exam.ai?.[item.id], { exam: id, w: wi, points: item.points })}<button class="btn text" data-action="rd-copy-exam" data-exam="${esc(id)}" data-w="${wi}">Copiar para corregir con IA</button><p class="rd-copied small" role="status" hidden></p></article>`; }).join('')}
<details class="result-breakdown"><summary>Revisar el test (${r.right}/10)</summary>${r.qs.map((q, i) => `<article class="study-question"><h2>${i + 1}. ${esc(q.text)}</h2><ul class="read-options">${q.options.map(o => `<li class="${o.key === q.correct ? 'correct' : exam.answers[q.id] === o.key ? 'incorrect' : ''}"><span class="option-letter">${o.key.toUpperCase()}</span><span>${esc(o.text)}${o.key === q.correct ? '<strong class="answer-label">✓ Correcta</strong>' : exam.answers[q.id] === o.key ? '<strong class="answer-label">✕ Tu respuesta</strong>' : ''}</span></li>`).join('')}</ul><p class="small">${esc(q.explanation)}</p></article>`).join('')}</details>
<div class="actions"><a class="btn" href="#/examen-real?asignatura=${esc(exam.course)}">Otro examen →</a></div>`;
}

// ---------- Reloj ----------
function stopTicker() { clearInterval(ticker); ticker = null; }
function startTicker(deadline, exam) {
  stopTicker();
  ticker = setInterval(() => {
    const el = document.getElementById(exam ? 'rd-exam-clock' : 'rd-clock'); if (!el) { stopTicker(); return; }
    if (exam) { const left = deadline - Date.now(); el.textContent = formatTime(Math.max(0, left)); el.classList.toggle('time-low', left < 5 * 60000); if (left <= 0) { stopTicker(); finishExam(true); } }
    else tickWriting(el);
  }, 1000);
}
function tickWriting(el) {
  const start = Number(el.dataset.start), limit = Number(el.dataset.limit) * 60000; if (!start) return;
  const left = limit - (Date.now() - start);
  el.textContent = left >= 0 ? formatTime(left) : '+' + formatTime(-left);
  el.classList.toggle('time-low', left < 60000);
}
export function afterPracticasRender() {
  const el = document.getElementById('rd-clock');
  if (el && el.dataset.start) { tickWriting(el); startTicker(0, false); }
}

// ---------- Eventos ----------
let saveTimer = null;
export function practicasInput(e) {
  const t = e.target;
  if (t.matches?.('textarea[data-rd-item]')) {
    const id = t.dataset.rdItem, i = Number(t.dataset.rdIndex); const s = state(id);
    s.texts[i] = t.value; if (!s.startedAt && t.value.trim()) { s.startedAt = Date.now(); const c = document.getElementById('rd-clock'); if (c) { c.dataset.start = s.startedAt; c.parentElement.querySelector('button')?.remove(); afterPracticasRender(); } }
    clearTimeout(saveTimer); saveTimer = setTimeout(() => saveState(id, s), 250);
    const count = document.querySelector(`[data-rd-count="${i}"]`); if (count) count.textContent = `${words(t.value)} palabras`;
    return true;
  }
  if (t.matches?.('textarea[data-rx-key]')) {
    const exam = activeExam(); if (!exam) return true;
    exam.texts[t.dataset.rxKey] = t.value; clearTimeout(saveTimer); saveTimer = setTimeout(() => { const cur = activeExam(); if (cur && cur.id === exam.id) { cur.texts[t.dataset.rxKey] = t.value; ctx.write(examKey, cur); } }, 250);
    return true;
  }
  return false;
}
export function practicasChange(e) {
  const t = e.target;
  if (t.id === 'real-exam-course') { ctx.write('realExamCourse', t.value); location.hash = '/examen-real?asignatura=' + encodeURIComponent(t.value); return true; }
  if (t.matches?.('input[data-rx-q]')) { const exam = activeExam(); if (!exam) return true; exam.answers[t.dataset.rxQ] = t.value; ctx.write(examKey, exam); t.closest('fieldset')?.querySelectorAll('.answer-option').forEach(l => l.classList.toggle('selected', l.contains(t))); const pos = document.querySelector('.exam-position b'); if (pos) pos.textContent = Object.keys(exam.answers).length; return true; }
  if (t.matches?.('select[data-rd-match]')) { const st = matchState.get(Number(t.dataset.topic)); if (st) st.answers[t.dataset.rdMatch] = t.value; return true; }
  return false;
}
async function copy(text, button) {
  const note = button.parentElement.parentElement.querySelector('.rd-copied') || button.parentElement.querySelector('.rd-copied');
  try { await navigator.clipboard.writeText(text); if (note) { note.hidden = false; note.textContent = 'Copiado. Pégalo en un chat con Claude para que te corrija.'; } }
  catch { if (note) { note.hidden = false; note.textContent = 'No se pudo copiar automáticamente en este navegador.'; } }
}
export function practicasClick(e, button) {
  const a = button.dataset.action; if (!a?.startsWith('rd-') && !a?.startsWith('rx-')) return false;
  const n = Number(currentTopic());
  if (a === 'rd-retry') { cache.delete(Number(button.dataset.topic)); ctx.render(); }
  if (a === 'rd-start') { const id = currentItemId(); const s = state(id); s.startedAt = Date.now(); saveState(id, s); ctx.render(false); }
  if (a === 'rd-reveal') { const id = button.dataset.item; const s = state(id); clearTimeout(saveTimer); document.querySelectorAll('textarea[data-rd-item]').forEach(t => { s.texts[Number(t.dataset.rdIndex)] = t.value; }); s.revealed = true; s.checks = s.checks || []; saveState(id, s); ctx.render(false); document.querySelector('.rd-correction')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
  if (a === 'rd-check') { const id = currentItemId(); const s = state(id); const i = Number(button.dataset.i), j = Number(button.dataset.j); s.checks = s.checks || []; s.checks[i] = s.checks[i] || []; s.checks[i][j] = button.checked; saveState(id, s); const e2 = loadPrac(n); const item = e2.data && findItem(e2.data, id); if (item) { const sc = selfScore(item, s.checks); const box = document.querySelector('.rd-score .practice-score'); if (box) box.innerHTML = `${pts(sc)}<small>/${item.points}</small>`; } return true; }
  if (a === 'rd-reset') ctx.ask('¿Volver a intentarlo?', 'Se borrará lo que escribiste y lo que marcaste en esta práctica.', 'Borrar y empezar', () => { ctx.write('red:' + button.dataset.item, null); ctx.render(); }, 'Cancelar');
  if (a === 'rd-ai-toggle') { aiSetupOpen = !aiSetupOpen; ctx.render(false); }
  if (a === 'rd-ai-save') { saveAi(button); }
  if (a === 'rd-ai-clear') { clearKey(); aiSetupOpen = false; ctx.render(false); }
  if (a === 'rd-ai-grade' && !aiBusy) { const id = button.dataset.item; const item = findItem(loadPrac(n).data, id); if (item) runAi(button, () => gradeWithClaude({ item, texts: state(id).texts, course: ctx.courseTitle(ctx.topicInfo(n).course) }), ai => { const s = state(id); s.ai = ai; s.checks = ai.parts.map(p => p.covered); saveState(id, s); }); }
  if (a === 'rd-ai-grade-exam' && !aiBusy) { const exam = ctx.read('realExam:' + button.dataset.exam, null); const items = exam && examItems(exam); const item = items?.[Number(button.dataset.w)]; if (item) { const parts = item.questions || [item]; runAi(button, () => gradeWithClaude({ item, texts: parts.map((_, i) => exam.texts[`${item.id}:${i}`] || ''), course: ctx.courseTitle(exam.course) }), ai => { const cur = ctx.read('realExam:' + exam.id, null); cur.ai = { ...(cur.ai || {}), [item.id]: ai }; cur.checks = cur.checks || {}; ai.parts.forEach((p, i) => { cur.checks[`${item.id}:${i}`] = p.covered; }); ctx.write('realExam:' + exam.id, cur); }); } }
  if (a === 'rd-copy') { const item = findItem(loadPrac(n).data, button.dataset.item); const s = state(button.dataset.item); copy(aiPrompt(item, ctx.topicInfo(n).course, s.texts), button); }
  if (a === 'rd-move') { const st = orderState.get(button.dataset.oid); const i = Number(button.dataset.i), j = i + Number(button.dataset.d); if (st && j >= 0 && j < st.order.length) { [st.order[i], st.order[j]] = [st.order[j], st.order[i]]; ctx.render(false); document.querySelector(`[data-action="rd-move"][data-i="${j}"][data-d="${button.dataset.d}"]:not(:disabled)`)?.focus() || document.querySelector(`[data-action="rd-move"][data-i="${j}"]`)?.focus(); } }
  if (a === 'rd-order-check') { const st = orderState.get(button.dataset.oid); if (st) { st.checked = true; if (st.order.every((x, i) => x === i)) ctx.write('ord:' + button.dataset.oid, { ok: true, at: Date.now() }); ctx.render(false); } }
  if (a === 'rd-order-again') { orderState.delete(button.dataset.oid); ctx.render(); }
  if (a === 'rd-match-check') { const st = matchState.get(Number(button.dataset.topic)); if (st) { st.checked = true; ctx.render(false); } }
  if (a === 'rd-match-again') { matchState.delete(Number(button.dataset.topic)); ctx.render(); }
  if (a === 'rd-exam-start') { const go = () => { ctx.write(examKey, null); startExam(button.dataset.course); }; if (activeExam()) ctx.ask('¿Empezar otro examen?', 'Se descartará el examen en curso.', 'Descartar y empezar', go, 'Cancelar'); else go(); }
  if (a === 'rd-exam-submit') { const exam = activeExam(); if (!exam) return true; document.querySelectorAll('textarea[data-rx-key]').forEach(t => { exam.texts[t.dataset.rxKey] = t.value; }); ctx.write(examKey, exam); const blank = 10 - Object.keys(exam.answers).length; ctx.ask('¿Entregar el examen?', `${blank ? `Tienes ${blank} preguntas de test en blanco. ` : ''}Después corregirás la redacción con la rúbrica.`, 'Entregar', () => finishExam(false), 'Seguir con el examen'); }
  if (a === 'rx-check') { const id = button.dataset.exam; const exam = ctx.read('realExam:' + id, null); if (!exam) return true; exam.checks = exam.checks || {}; const arr = exam.checks[button.dataset.key] || []; arr[Number(button.dataset.j)] = button.checked; exam.checks[button.dataset.key] = arr; ctx.write('realExam:' + id, exam); const items = examItems(exam); if (items) { const r = examScore(exam, items); document.getElementById('rd-total').innerHTML = `${pts(r.total)}<small>/10</small>`; document.getElementById('rd-wtotal').textContent = pts(r.writing.reduce((x, y) => x + y, 0)); r.writing.forEach((w, i) => { const el = document.querySelector(`[data-rd-wscore="${i}"]`); if (el) el.textContent = pts(w); }); const list = ctx.read('realExam:list', []) || []; const row = list.find(x => x.id === id); if (row) { row.score = r.total; ctx.write('realExam:list', list); } } return true; }
  if (a === 'rd-copy-exam') { const exam = ctx.read('realExam:' + button.dataset.exam, null); const items = exam && examItems(exam); const item = items?.[Number(button.dataset.w)]; if (item) { const parts = item.questions || [item]; copy(aiPrompt(item, exam.course, parts.map((_, i) => exam.texts[`${item.id}:${i}`] || '')), button); } }
  return true;
}
async function saveAi(button) {
  const st = button.closest('.rd-ai').querySelector('.rd-ai-status');
  const say = (msg, error) => { st.textContent = msg; st.classList.toggle('is-error', !!error); };
  const input = document.getElementById('rd-ai-key'); const typed = input.value.trim();
  try { saveSettings(typed, document.getElementById('rd-ai-model').value); } catch (err) { say(err.message, true); return; }
  if (!hasKey()) { say('Pega tu API key para empezar.', true); return; }
  button.disabled = true; say('Comprobando la key con Anthropic…');
  try { await verifyKey(); aiSetupOpen = false; ctx.render(false); document.querySelector('.rd-ai-status')?.replaceChildren('✓ Conectado. Ya puedes corregir con Claude.'); }
  catch (err) { if (typed && /no reconoce/.test(err.message)) clearKey(); button.disabled = false; say(err.message, true); }
}
async function runAi(button, call, save) {
  const hash = location.hash; aiBusy = true; button.disabled = true; button.textContent = 'Corrigiendo… (unos segundos)';
  const status = button.closest('.rd-ai')?.querySelector('.rd-ai-status');
  try { const ai = await call(); save(ai); aiBusy = false; if (location.hash === hash) { const y = scrollY; ctx.render(false); scrollTo(0, y); } }
  catch (err) { aiBusy = false; button.disabled = false; button.textContent = '✦ Corregir con Claude'; if (status && location.hash === hash) { status.textContent = err.message; status.classList.add('is-error'); } }
}
function currentTopic() { return location.hash.match(/^#\/redaccion\/(\d+)/)?.[1]; }
function currentItemId() { return location.hash.match(/^#\/redaccion\/\d+\/([a-z0-9-]+)/)?.[1]; }
export function examTimeUp() { const exam = activeExam(); if (exam && exam.deadline <= Date.now()) { finishExam(true); return true; } return false; }
