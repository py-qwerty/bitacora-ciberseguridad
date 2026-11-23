// Camino de estudio entre asignaturas: página #/camino y bloque «Antes de este tema» en cada tema digital.
// Datos: dist/camino.json y el campo `camino` de cada tema (los genera scripts/build-temas.mjs desde content/camino.json).
let ctx = null, camino = null, dependents = new Map();
const SHORT = { sistemas: 'Sistemas', redes: 'Redes', forense: 'Forense', gobierno: 'Gobierno', ciberdelitos: 'Ciberdelitos' };
export function setupCamino(c) { ctx = c; }
export async function loadCamino(version) {
  try {
    const data = await fetch(`camino.json?v=${encodeURIComponent(version)}`, { signal: AbortSignal.timeout(15000) }).then(r => r.ok ? r.json() : null);
    if (!Array.isArray(data?.etapas)) return;
    camino = data; dependents = new Map();
    for (const e of data.etapas) for (const t of e.temas) for (const n of t.antes || []) dependents.set(n, (dependents.get(n) || 0) + 1);
  } catch { camino = null; }
}
const tag = course => `<span class="cm-tag cm-${ctx.esc(course)}">${ctx.esc(SHORT[course] || course)}</span>`;
const ref = l => `${SHORT[l.course] || l.course} T${l.number}`;
const studied = (n, total) => ctx.studiedTotal(n, total);
const isDone = t => t.sections > 0 && studied(t.topic, t.sections) >= t.sections;
const allTemas = () => camino.etapas.flatMap(e => e.temas);
const byTopic = n => allTemas().find(t => t.topic === n);

function temaCard(t) {
  const { esc } = ctx; const done = studied(t.topic, t.sections); const full = done >= t.sections; const base = dependents.get(t.topic) || 0;
  const antes = (t.antes || []).map(byTopic).filter(Boolean);
  const state = full ? 'Estudiado' : done ? `${done}/${t.sections} apartados` : `${t.sections} apartados${t.minutes ? ` · ${t.minutes} min` : ''}`;
  return `<li class="cm-card${full ? ' is-done' : ''}"><a href="#/tema/${t.topic}/estudio"><span class="cm-pos" aria-hidden="true">${full ? '✓' : t.pos}</span><span class="cm-card-body"><span class="cm-card-top">${tag(t.course)}<span class="cm-num">Tema ${t.number}</span>${base >= 3 ? `<span class="cm-base" title="Hay ${base} temas que te piden verlo antes">Base de ${base} temas</span>` : ''}</span><b class="cm-title">${esc(t.title)}</b><span class="cm-meta">${state}</span>${t.sections ? `<progress max="${t.sections}" value="${done}" aria-label="Apartados estudiados"></progress>` : ''}${antes.length ? `<span class="cm-needs"><span>Antes:</span> ${antes.map(a => `<i class="cm-${esc(a.course)}">${esc(ref(a))}</i>`).join(' ')}</span>` : ''}</span></a></li>`;
}

export function caminoPage() {
  const { esc, heading } = ctx;
  if (!camino) return `${heading('Camino de estudio', 'No se ha podido cargar el camino. Comprueba tu conexión y recarga la página.')}`;
  const list = allTemas(); const doneN = list.filter(isDone).length; const next = list.find(t => !isDone(t));
  const keys = [...dependents].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n, c]) => ({ t: byTopic(n), c })).filter(x => x.t);
  const nextBlock = next ? `<a class="cm-next" href="#/tema/${next.topic}/estudio"><span class="cm-next-label">Siguiente en el camino · paso ${next.pos} de ${camino.total}</span><span class="cm-next-title">${tag(next.course)} <b>${esc(next.title)}</b></span><span class="cm-next-go" aria-hidden="true">→</span></a>` : `<p class="cm-next is-finished">Has estudiado todos los temas del camino.</p>`;
  return `<div class="cm-page">${heading('Camino de estudio', 'Un orden para recorrer las cinco asignaturas en el que cada tema se apoya en lo que ya has visto. Tu calendario manda; usa esto para saber qué repasar antes de cada tema.')}
<div class="cm-summary"><div class="cm-progress"><p><b>${doneN}</b> de ${camino.total} temas estudiados</p><progress max="${camino.total}" value="${doneN}" aria-label="Temas estudiados del camino"></progress></div>${nextBlock}</div>
<section class="cm-keys" aria-labelledby="cm-keys-title"><h2 id="cm-keys-title">Los temas que sostienen a otros</h2><p class="small">Cuántos temas de todo el máster te piden haber visto antes cada uno de estos. Si vas a priorizar, empieza por aquí.</p><ol>${keys.map(({ t, c }) => `<li><a href="#/tema/${t.topic}/estudio">${tag(t.course)}<span><b>${esc(t.title)}</b><small>Tema ${t.number} · lo necesitan ${c} temas</small></span></a></li>`).join('')}</ol></section>
<ol class="cm-etapas">${camino.etapas.map((e, i) => { const d = e.temas.filter(isDone).length; return `<li class="cm-etapa" id="etapa-${esc(e.id)}"><header class="cm-etapa-head"><span class="cm-etapa-n" aria-hidden="true">${i + 1}</span><div><h2><span class="sr-only">Etapa ${i + 1}. </span>${esc(e.titulo)}</h2><p>${esc(e.idea)}</p></div><span class="cm-etapa-count">${d}/${e.temas.length}</span></header><ol class="cm-grid">${e.temas.map(temaCard).join('')}</ol></li>`; }).join('')}</ol>
<p class="local-note">Orden propuesto a partir del contenido de los temas: cada tema solo pide temas que van antes en el camino. El progreso es el de «He estudiado este apartado» de cada tema digital, guardado en este navegador.</p></div>`;
}

function linkItem(l, withStudy) {
  const { esc, sectionHref } = ctx; const p = ctx.temaProgress(l.topic);
  const seen = l.apartados.filter(a => p.studied[a.id]).length;
  return `<li class="cm-link"><div class="cm-link-head">${tag(l.course)}<a href="#/tema/${l.topic}/estudio"><b>Tema ${l.number}</b> · ${esc(l.title)}</a>${withStudy && seen === l.apartados.length ? '<span class="cm-ok">Ya lo has visto</span>' : ''}</div><p>${ctx.rich(l.por, 'inline')}</p><ul class="cm-apartados">${l.apartados.map(a => `<li><a href="${sectionHref(l.topic, a.id)}"${p.studied[a.id] ? ' class="is-studied"' : ''}><span aria-hidden="true">${p.studied[a.id] ? '✓' : '→'}</span>${esc(a.title)}${p.studied[a.id] ? '<span class="sr-only"> (estudiado)</span>' : ''}</a></li>`).join('')}</ul></li>`;
}
export function caminoBlock(t) {
  const c = t.camino; if (!c) return '';
  const { esc } = ctx; const antes = c.antes || [], conecta = c.conecta || [];
  const where = `<p class="cm-where">Paso <b>${c.pos}</b> de ${camino?.total || 50} del camino · Etapa ${c.etapa}: ${esc(c.etapaTitulo)} · <a href="#/camino">Ver el camino →</a></p>`;
  const main = antes.length
    ? `<h2 id="cm-antes-title">Antes de este tema</h2><p class="small cm-intro">Este tema da por sabido lo que se explica en estos apartados de otros temas. Si no los has visto, échales un vistazo primero.</p><ul class="cm-links">${antes.map(l => linkItem(l, true)).join('')}</ul>`
    : `<h2 id="cm-antes-title">Antes de este tema</h2><p class="small cm-intro">No necesitas nada previo: ${c.etapa === 1 ? 'es uno de los temas de cimientos del máster' : 'puedes empezar directamente'}.</p>`;
  const rel = conecta.length ? `<details class="cm-conecta"><summary>Relacionado en otros temas (${conecta.length})</summary><ul class="cm-links">${conecta.map(l => linkItem(l, false)).join('')}</ul></details>` : '';
  return `<section class="cm-antes" aria-labelledby="cm-antes-title">${where}${main}${rel}</section>`;
}
