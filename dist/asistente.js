// Chat «Pregunta a Claude»: dudas de estudio desde cualquier página.
// - En escritorio vive en la parte de abajo del menú izquierdo (se puede ampliar).
// - En móvil es un botón más del menú inferior que abre una hoja a pantalla casi completa.
// - Al subrayar texto de la página aparece «Preguntar a Claude», que lo adjunta como cita.
// Usa la misma API key de Console que el corrector (guardada solo en este navegador) y
// habla directamente con la API de Anthropic, sin servidor intermedio.
import { hasKey, MODELS, currentModel, maskedKey, saveSettings, clearKey, verifyKey, client } from './corrector.js?v=3';

const CHAT = 'bitacora-ciber:v1:ai:chat';
const OPEN = 'bitacora-ciber:v1:ai:open';
const MAX_SAVED = 40;
const safeGet = k => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
const safeSet = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch { /* sin almacenamiento */ } };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const SYSTEM = `Eres el tutor de un alumno principiante de un máster universitario de ciberseguridad en España (UNIR). El alumno estudia desde una web propia con temas, tests y casos prácticos, y te pregunta dudas mientras estudia.
Cómo responder:
- En español claro y cercano, en segunda persona. Explica desde cero: el alumno no tiene base técnica previa, así que define cada término técnico la primera vez que lo uses.
- Ve al grano: primero la respuesta directa en 1 o 2 frases, después la explicación y, si ayuda, un ejemplo cotidiano o un mini ejemplo práctico.
- Si te pasa un fragmento subrayado, céntrate en explicar ese fragmento y relaciónalo con lo que pregunta.
- Si la duda es de examen (tipo test o pregunta de desarrollo), explica por qué la opción correcta lo es y por qué las demás no.
- Si algo depende de la versión (por ejemplo de Windows Server) o no estás seguro, dilo.
- Formato: párrafos cortos, listas cuando enumeres, **negrita** para las ideas clave y \`código\` para comandos o nombres exactos. Sin tablas ni encabezados grandes.`;

let msgs = load();
let quote = null;           // { text, origin }
let busy = null;            // stream en curso
let dock, log, form, input, quoteBox, setupBox, sendBtn, selBtn, useReading, readingLabel;

function load() {
  try { const v = JSON.parse(safeGet(CHAT) || '[]'); return Array.isArray(v) ? v.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string') : []; }
  catch { return []; }
}
const save = () => safeSet(CHAT, msgs.length ? JSON.stringify(msgs.slice(-MAX_SAVED)) : '');

// Markdown mínimo y seguro (se escapa todo antes de dar formato).
function md(src) {
  const parts = String(src).split(/```[a-zA-Z0-9-]*\n?/);
  return parts.map((chunk, i) => {
    if (i % 2) return `<pre><code>${esc(chunk.replace(/\n$/, ''))}</code></pre>`;
    const inline = t => esc(t).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>');
    const out = []; let list = null;
    const close = () => { if (list) { out.push(`<${list.tag}>${list.items.map(x => `<li>${x}</li>`).join('')}</${list.tag}>`); list = null; } };
    let para = [];
    const flush = () => { if (para.length) { out.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; } };
    for (const line of chunk.split('\n')) {
      const ul = line.match(/^\s*[-*•]\s+(.*)/), ol = line.match(/^\s*\d+[.)]\s+(.*)/), h = line.match(/^#{1,6}\s+(.*)/);
      if (ul || ol) { flush(); const tag = ul ? 'ul' : 'ol'; if (list?.tag !== tag) { close(); list = { tag, items: [] }; } list.items.push(inline((ul || ol)[1])); }
      else if (h) { flush(); close(); out.push(`<p><b>${inline(h[1])}</b></p>`); }
      else if (!line.trim()) { flush(); close(); }
      else { close(); para.push(line); }
    }
    flush(); close();
    return out.join('');
  }).join('');
}

function bubble(m) {
  if (m.role === 'user') {
    const q = m.quote ? `<blockquote><span>${esc(m.quote.origin || 'Texto subrayado')}</span>${esc(m.quote.text)}</blockquote>` : (m.ctx ? `<small class="ai-ctx-tag">Leyendo: ${esc(m.ctx.heading)}</small>` : '');
    return `<div class="ai-msg is-user">${q}${m.text ? `<p>${esc(m.text)}</p>` : ''}</div>`;
  }
  return `<div class="ai-msg is-bot${m.error ? ' is-error' : ''}">${md(m.text) || '<span class="ai-typing" aria-label="Claude está escribiendo"><i></i><i></i><i></i></span>'}</div>`;
}

function renderLog() {
  if (!msgs.length) {
    log.innerHTML = `<div class="ai-empty"><p><b>¿Tienes una duda?</b></p><p>Escríbela aquí o <b>subraya</b> un trozo de la página y pulsa «Preguntar a Claude».</p></div>`;
    return;
  }
  log.innerHTML = msgs.map(bubble).join('');
  log.scrollTop = log.scrollHeight;
}

function renderSetup(open) {
  const need = !hasKey();
  setupBox.hidden = !(need || open);
  form.hidden = need;
  if (setupBox.hidden) return;
  setupBox.innerHTML = `<form class="ai-setup-form"><p>${need ? 'Para chatear, pega tu <b>API key de Console</b>' : `Conectado con <code>${esc(maskedKey())}</code>. Puedes cambiar la key o el modelo`} (empieza por <code>sk-ant-</code>; se crea en platform.claude.com → API keys). Se guarda <b>solo en este navegador</b> y cada mensaje se cobra en tu cuenta de Console.</p>
<label>API key<input type="password" name="key" autocomplete="off" spellcheck="false" placeholder="${need ? 'sk-ant-api03-…' : 'Déjalo vacío para mantener la actual'}"></label>
<label>Modelo<select name="model">${MODELS.map(m => `<option value="${m.id}"${m.id === currentModel() ? ' selected' : ''}>${esc(m.label.split(' · ')[0])}</option>`).join('')}</select></label>
<p class="ai-setup-msg" role="status"></p>
<div class="ai-setup-actions"><button type="submit" class="btn">Guardar</button>${need ? '' : '<button type="button" class="btn secondary" data-ai="forget">Borrar key</button><button type="button" class="btn text" data-ai="close-setup">Cerrar</button>'}</div></form>`;
}

function renderQuote() {
  quoteBox.hidden = !quote;
  if (quote) quoteBox.innerHTML = `<div><span>${esc(quote.origin || 'Texto subrayado')}</span><p>${esc(quote.text)}</p></div><button type="button" data-ai="drop-quote" aria-label="Quitar el texto subrayado">×</button>`;
}

// Abierto: en escritorio ocupa la columna derecha (en lugar de las preguntas); en móvil, una hoja.
function setOpen(open) {
  // Mantener a la vista lo que se estaba leyendo: al quitar/poner la columna cambia el alto de la página.
  const main = document.querySelector('main');
  const mr = main?.getBoundingClientRect();
  const anchor = isDesktop() && mr ? document.elementFromPoint(mr.left + Math.min(mr.width / 2, 360), innerHeight * 0.35) : null;
  const before = anchor?.closest('main') ? anchor.getBoundingClientRect().top : null;
  dock.dataset.open = open ? 'true' : 'false';
  document.querySelectorAll('.ai-launch,.ai-edge').forEach(b => b.setAttribute('aria-expanded', String(open)));
  document.body.classList.toggle('ai-open', open);
  if (isDesktop()) safeSet(OPEN, open ? '1' : '');
  if (before !== null && anchor.isConnected) scrollBy(0, anchor.getBoundingClientRect().top - before);
  if (open) { log.scrollTop = log.scrollHeight; }
}
const isDesktop = () => matchMedia('(min-width:1024px)').matches;

function pageTitle() { return (document.querySelector('main h1')?.textContent || document.title).trim(); }

// Temario: el texto del tema abierto (sin las preguntas laterales). Si no es un tema, la página entera.
function temario() {
  const main = document.querySelector('main');
  if (!main) return '';
  const parts = [...main.querySelectorAll('.tema-section-content')].map(e => e.innerText.trim()).filter(Boolean);
  return (parts.length ? parts.join('\n\n') : main.innerText.trim()).replace(/\n{3,}/g, '\n\n').slice(0, 120000);
}

// Párrafo que se está leyendo: el bloque de texto que cruza la línea de lectura (35 % de la pantalla).
const READABLE = 'main p, main li, main blockquote, main dd, main td, main figcaption, main pre, main h2, main h3';
function reading() {
  const main = document.querySelector('main');
  if (!main) return null;
  const line = innerHeight * 0.35;
  let best = null, dist = Infinity;
  for (const el of main.querySelectorAll(READABLE)) {
    if (el.closest('.tema-section-questions,.ai-dock,nav,header.tema-section-head') || el.querySelector('p,li')) continue;
    const r = el.getBoundingClientRect();
    if (r.bottom < 60 || r.top > innerHeight || !r.height) continue;
    const d = r.top <= line && r.bottom >= line ? 0 : Math.min(Math.abs(r.top - line), Math.abs(r.bottom - line));
    if (d < dist) { dist = d; best = el; }
  }
  if (!best) return null;
  const sec = best.closest('section');
  const heading = (sec?.querySelector('h2') || document.querySelector('main h1'))?.textContent.trim() || '';
  // El párrafo y sus vecinos inmediatos, para que la idea no quede cortada.
  const pick = [best.previousElementSibling, best, best.nextElementSibling].filter(e => e && e.matches?.(READABLE.replaceAll('main ', '')) && e.innerText.trim());
  const text = pick.map(e => e.innerText.trim()).join('\n').slice(0, 3000);
  return text ? { heading, text } : null;
}

function apiMessages(skip) {
  return msgs.filter(m => m !== skip && (m.role === 'user' || (!m.error && m.text))).map(m => {
    if (m.role === 'assistant') return { role: 'assistant', content: m.text };
    const bits = [];
    if (m.page) bits.push(`<pagina>${m.page}</pagina>`);
    if (m.ctx) bits.push(`<parrafo_que_estoy_leyendo apartado="${esc(m.ctx.heading)}">\n${m.ctx.text}\n</parrafo_que_estoy_leyendo>`);
    if (m.quote) bits.push(`<texto_subrayado origen="${esc(m.quote.origin || '')}">\n${m.quote.text}\n</texto_subrayado>`);
    bits.push(m.text || 'Explícame el texto subrayado.');
    return { role: 'user', content: bits.join('\n\n') };
  });
}

function friendly(Anthropic, e) {
  if (e?.name === 'AbortError' || e instanceof Anthropic.APIUserAbortError) return null;
  if (e instanceof Anthropic.AuthenticationError) return 'La API key no es válida o se ha revocado. Cámbiala con el botón de ajustes (⚙).';
  if (e instanceof Anthropic.PermissionDeniedError) return 'Esa API key no tiene permiso para usar este modelo. Prueba con el otro en ajustes (⚙).';
  if (e instanceof Anthropic.RateLimitError) return 'Has hecho demasiadas peticiones seguidas o se ha alcanzado tu límite. Espera un minuto.';
  if (e instanceof Anthropic.BadRequestError) return /credit|balance/i.test(e.message) ? 'Tu cuenta de Console no tiene saldo. Añade crédito en platform.claude.com → Billing.' : 'Claude no ha aceptado la petición: ' + e.message;
  if (e instanceof Anthropic.APIConnectionError) return 'No se ha podido conectar con Claude. Revisa tu conexión.';
  if (e instanceof Anthropic.APIError) return `Error de la API de Claude (${e.status ?? 'sin código'}). Vuelve a intentarlo en un rato.`;
  return e?.message || 'Ha fallado algo inesperado.';
}

function systemBlocks() {
  const t = temario();
  const blocks = [{ type: 'text', text: SYSTEM }];
  // El temario va en su propio bloque con caché: mientras sigas en el mismo tema, las preguntas siguientes lo leen de caché (mucho más barato).
  if (t) blocks.push({ type: 'text', text: `Este es el contenido de la página que el alumno tiene abierta («${pageTitle()}»). Úsalo como fuente principal y cítalo por apartado cuando ayude; si la duda va más allá, complétalo con tu conocimiento y dilo.\n<temario>\n${t}\n</temario>`, cache_control: { type: 'ephemeral' } });
  return blocks;
}

async function send(text) {
  if (busy || (!text && !quote)) return;
  const ctx = useReading.checked ? reading() : null;
  msgs.push({ role: 'user', text, quote: quote || undefined, ctx: ctx || undefined, page: pageTitle() });
  quote = null; renderQuote();
  const reply = { role: 'assistant', text: '' };
  msgs.push(reply);
  renderLog();
  setBusy(true);
  let Anthropic;
  try {
    const c = await client(); Anthropic = c.Anthropic;
    const history = apiMessages(reply).slice(-30);
    while (history.length && history[0].role !== 'user') history.shift();
    busy = await c.api.messages.create({ model: currentModel(), max_tokens: 4000, system: systemBlocks(), messages: history, stream: true });
    let pending = false;
    for await (const ev of busy) {
      if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
        reply.text += ev.delta.text;
        if (!pending) { pending = true; requestAnimationFrame(() => { pending = false; const last = log.lastElementChild; if (last) { const near = log.scrollHeight - log.scrollTop - log.clientHeight < 80; last.innerHTML = md(reply.text); if (near) log.scrollTop = log.scrollHeight; } }); }
      }
      if (ev.type === 'message_delta' && ev.delta?.stop_reason === 'refusal') reply.text ||= 'Claude no ha querido responder a esto. Prueba a reformular la pregunta.';
    }
  } catch (e) {
    const msg = Anthropic ? friendly(Anthropic, e) : (e?.message || 'No se ha podido cargar Claude.');
    if (msg) { if (!reply.text) { reply.text = msg; reply.error = true; } else reply.text += `\n\n*(Respuesta cortada: ${msg})*`; }
    else if (!reply.text) reply.text = '*(Detenido)*';
    if (!hasKey()) renderSetup(true);
  } finally {
    busy = null; setBusy(false); save(); renderLog();
  }
}

function setBusy(on) {
  sendBtn.textContent = on ? 'Parar' : 'Enviar';
  sendBtn.classList.toggle('is-stop', on);
  sendBtn.setAttribute('aria-label', on ? 'Parar la respuesta' : 'Enviar la pregunta');
}

// ---------- Subrayar para preguntar ----------
function selectionInfo() {
  const sel = getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
  const text = sel.toString().replace(/\s+\n/g, '\n').trim();
  if (text.length < 2) return null;
  const node = sel.anchorNode?.nodeType === 1 ? sel.anchorNode : sel.anchorNode?.parentElement;
  if (!node || !node.closest('main') || node.closest('input,textarea,.ai-dock,.ai-panel')) return null;
  const scope = node.closest('.tema-section-questions .tq, .tema-section, section, article, details') || document.querySelector('main');
  const head = scope?.querySelector(':scope > summary, h2, h3, summary') || document.querySelector('main h1');
  const page = document.querySelector('main h1')?.textContent?.trim();
  const origin = [page, head && head.textContent.trim() !== page ? head.textContent.trim() : ''].filter(Boolean).join(' › ').slice(0, 160);
  return { text: text.slice(0, 4000), origin, rect: sel.getRangeAt(0).getBoundingClientRect() };
}
let selTimer;
function onSelection() {
  clearTimeout(selTimer);
  selTimer = setTimeout(() => {
    const info = selectionInfo();
    if (!info) { selBtn.hidden = true; return; }
    selBtn.hidden = false;
    const w = selBtn.offsetWidth, touch = matchMedia('(pointer:coarse)').matches;
    const x = Math.min(innerWidth - w - 8, Math.max(8, info.rect.left + info.rect.width / 2 - w / 2));
    let y = touch ? info.rect.bottom + 14 : info.rect.top - selBtn.offsetHeight - 8;
    if (y < 70) y = info.rect.bottom + 10;
    if (y > innerHeight - 60) y = Math.max(70, info.rect.top - selBtn.offsetHeight - 8);
    selBtn.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
  }, 160);
}
function askSelection() {
  const info = selectionInfo();
  selBtn.hidden = true;
  if (!info) return;
  quote = { text: info.text, origin: info.origin };
  getSelection()?.removeAllRanges();
  renderQuote();
  setOpen(true);
  renderSetup(false);
  input.focus();
}

// ---------- Montaje ----------
export function initAsistente() {
  const nav = document.querySelector('.bottom-nav');
  if (!nav || document.querySelector('.ai-dock')) return;
  dock = document.createElement('section');
  dock.className = 'ai-dock';
  dock.setAttribute('aria-label', 'Pregunta a Claude');
  dock.dataset.open = 'false';
  dock.innerHTML = `<button type="button" class="ai-launch" aria-expanded="false" aria-controls="ai-panel"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4zM8 9h8M8 12h5"/></svg><span>Claude</span></button>
<div class="ai-panel" id="ai-panel">
  <header class="ai-head"><h2><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>Pregunta a Claude</h2>
    <div class="ai-tools"><button type="button" data-ai="new" title="Nueva conversación" aria-label="Nueva conversación"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button><button type="button" data-ai="settings" title="API key y modelo" aria-label="API key y modelo"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9 7 7m10 10 2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/></svg></button><button type="button" data-ai="close" title="Replegar el chat" aria-label="Replegar el chat"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="ai-ico-desk" d="M9 6l6 6-6 6"/><path class="ai-ico-mob" d="M6 6l12 12M18 6 6 18"/></svg></button></div></header>
  <div class="ai-log" aria-live="polite"></div>
  <div class="ai-setup" hidden></div>
  <form class="ai-form"><div class="ai-quote" hidden></div><label class="sr-only" for="ai-input">Tu pregunta</label><label class="ai-reading"><input type="checkbox" checked><span>Incluir lo que estoy leyendo</span></label><div class="ai-input-row"><textarea id="ai-input" rows="2" placeholder="Escribe tu duda…"></textarea><button type="submit" class="ai-send">Enviar</button></div></form>
</div>`;
  nav.append(dock);
  // El panel vive en <body> (el menú inferior usa transform, que atraparía un panel fijo).
  const panel = dock.querySelector('.ai-panel');
  document.body.append(panel);
  const edge = document.createElement('button');
  edge.type = 'button'; edge.className = 'ai-edge'; edge.setAttribute('aria-controls', 'ai-panel'); edge.setAttribute('aria-expanded', 'false');
  edge.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4zM8 9h8M8 12h5"/></svg><span>Claude</span>';
  edge.title = 'Abrir el chat con Claude';
  document.body.append(edge);
  log = panel.querySelector('.ai-log'); form = panel.querySelector('.ai-form'); input = panel.querySelector('textarea');
  quoteBox = panel.querySelector('.ai-quote'); useReading = panel.querySelector('.ai-reading input'); readingLabel = panel.querySelector('.ai-reading span'); setupBox = panel.querySelector('.ai-setup'); sendBtn = panel.querySelector('.ai-send');

  selBtn = document.createElement('button');
  selBtn.type = 'button'; selBtn.className = 'ai-ask-sel'; selBtn.hidden = true;
  selBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>Preguntar a Claude';
  selBtn.addEventListener('mousedown', e => e.preventDefault());
  selBtn.addEventListener('click', askSelection);
  document.body.append(selBtn);
  document.addEventListener('selectionchange', onSelection);
  let rTimer;
  const updateReading = () => { clearTimeout(rTimer); rTimer = setTimeout(() => { const r = reading(); readingLabel.textContent = r ? `Incluir lo que estoy leyendo: ${r.heading || pageTitle()}` : 'Incluir lo que estoy leyendo'; readingLabel.title = r ? r.text.slice(0, 300) : ''; }, 250); };
  addEventListener('scroll', () => { if (!selBtn.hidden) onSelection(); updateReading(); }, { passive: true });
  new MutationObserver(updateReading).observe(document.querySelector('main') || document.body, { childList: true });
  addEventListener('hashchange', () => { selBtn.hidden = true; });

  const toggle = () => { setOpen(dock.dataset.open !== 'true'); if (dock.dataset.open === 'true') (hasKey() ? input : setupBox.querySelector('input'))?.focus(); };
  dock.querySelector('.ai-launch').addEventListener('click', toggle);
  edge.addEventListener('click', toggle);
  panel.addEventListener('click', e => {
    const a = e.target.closest('[data-ai]')?.dataset.ai;
    if (a === 'close') setOpen(false);
    else if (a === 'new') { if (busy) busy.controller.abort(); msgs = []; save(); renderLog(); input.focus(); }
    else if (a === 'settings') renderSetup(setupBox.hidden);
    else if (a === 'close-setup') renderSetup(false);
    else if (a === 'drop-quote') { quote = null; renderQuote(); input.focus(); }
    else if (a === 'forget') { clearKey(); renderSetup(true); }
  });
  panel.addEventListener('submit', async e => {
    e.preventDefault();
    if (e.target === form) {
      if (busy) { busy.controller.abort(); return; }
      const t = input.value.trim(); if (!t && !quote) return;
      input.value = ''; autosize(); send(t); return;
    }
    const f = e.target, say = (t, bad) => { const p = f.querySelector('.ai-setup-msg'); p.textContent = t; p.classList.toggle('is-bad', !!bad); };
    try { saveSettings(f.key.value, f.model.value); } catch (err) { say(err.message, true); return; }
    if (!hasKey()) { say('Pega la API key para continuar.', true); return; }
    say('Comprobando la key…');
    try { await verifyKey(); renderSetup(false); input.focus(); }
    catch (err) { say(err.message, true); form.hidden = !hasKey(); }
  });
  const autosize = () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 160) + 'px'; };
  input.addEventListener('input', autosize);
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && dock.dataset.open === 'true' && !isDesktop()) setOpen(false); });

  if (isDesktop() && safeGet(OPEN) === '1') setOpen(true);
  renderLog(); renderSetup(false); renderQuote();
}
