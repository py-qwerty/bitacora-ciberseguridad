// Narración de los temas digitales: un resumen explicado de cada apartado (guiones en content/audio). El audio y sus tiempos los genera scripts/build-audio.mjs:
//   audio/<tema>.json            índice: { sections: { <apartado>: { duration, cues: [{ b, t }] } } }
//   audio/<tema>/<apartado>.mp3
// b = índice del bloque dentro del apartado (-1 = título). Si un tema no tiene índice, no se muestra nada.
const BASE = 'audio/'; // cambiar por una URL absoluta si el audio se aloja fuera del sitio
const RATES = [1, 1.25, 1.5, 1.75, 2, 0.85];
const KEY = 'bitacora-ciber:audio';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const save = patch => { try { localStorage.setItem(KEY, JSON.stringify({ ...load(), ...patch })); } catch { /* sin almacenamiento: se sigue sin recordar */ } };
const fmt = s => { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const ICON = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>',
  prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 5v14l-9-7zM6 5h2v14H6z" fill="currentColor"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5v14l9-7zM16 5h2v14h-2z" fill="currentColor"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  wave: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4M8 6v12M12 9v6M16 4v16M20 10v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
};

const manifests = new Map(); // tema -> Promise<índice | null>
const manifest = topic => {
  if (!manifests.has(topic)) manifests.set(topic, fetch(`${BASE}${topic}.json`, { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).catch(() => null));
  return manifests.get(topic);
};
const routeTopic = () => { const m = location.hash.match(/^#\/tema\/(\d+)\/estudio/); return m ? Number(m[1]) : null; };

let audio, bar, now = null; // now = { topic, id, data, title }
let follow = true;
let blobUrl = '';

const sectionEl = id => document.getElementById(`apartado-${id}`);
// Bloques del apartado tal y como los pinta app.js: cabecera, un elemento por bloque y la fila «He estudiado».
function blockEl(id, b) {
  const content = sectionEl(id)?.querySelector('.tema-section-content'); if (!content) return null;
  return b < 0 ? content.querySelector('.tema-section-head') : content.children[b + 1] || null;
}
function cueAt(t) { const cues = now.data.cues; let i = 0; while (i + 1 < cues.length && cues[i + 1].t <= t + 0.05) i++; return i; }

function highlight() {
  document.querySelectorAll('.audio-now').forEach(e => e.classList.remove('audio-now'));
  document.querySelectorAll('.audio-listen[aria-pressed="true"]').forEach(b => { b.setAttribute('aria-pressed', 'false'); b.querySelector('span').textContent = 'Escuchar resumen'; });
  if (!now || routeTopic() !== now.topic) return;
  const btn = sectionEl(now.id)?.querySelector('.audio-listen');
  if (btn) { btn.setAttribute('aria-pressed', 'true'); btn.querySelector('span').textContent = audio.paused ? 'En pausa' : 'Sonando'; }
  const el = blockEl(now.id, now.data.cues[cueAt(audio.currentTime)].b); if (!el) return;
  el.classList.add('audio-now');
  if (follow && !audio.paused) {
    const r = el.getBoundingClientRect();
    if (r.top < 90 || r.top > innerHeight * 0.6) scrollTo({ top: scrollY + r.top - innerHeight * 0.25, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
}

function paint() {
  if (!now) { bar.hidden = true; document.body.classList.remove('audio-on'); return; }
  bar.hidden = false; document.body.classList.add('audio-on');
  bar.querySelector('.audio-title').textContent = now.title;
  bar.querySelector('.audio-toggle').innerHTML = audio.paused ? ICON.play : ICON.pause;
  bar.querySelector('.audio-toggle').setAttribute('aria-label', audio.paused ? 'Reproducir' : 'Pausar');
  const d = audio.duration || now.data.duration || 0;
  bar.querySelector('.audio-time').textContent = `${fmt(audio.currentTime)} / ${fmt(d)}`;
  const seek = bar.querySelector('.audio-seek'); seek.max = d; if (!seek.matches(':active')) seek.value = audio.currentTime;
  seek.style.setProperty('--p', d ? `${audio.currentTime / d * 100}%` : '0%');
  bar.querySelector('.audio-rate').textContent = `${String(audio.playbackRate).replace('.', ',')}×`;
}

async function play(topic, id, at = 0) {
  const m = await manifest(topic); const data = m?.sections?.[id]; if (!data) return;
  const title = sectionEl(id)?.querySelector('h2')?.textContent.replace(/^Apartado (\d+)\. /, '$1. ') || id;
  now = { topic, id, data, title, order: Object.keys(m.sections) };
  // Se descarga entero (cada apartado pesa poco) y se reproduce desde memoria: así se puede saltar a cualquier
  // punto aunque el servidor no admita descargas parciales.
  const url = `${BASE}${topic}/${encodeURIComponent(id)}.mp3`; const mine = now;
  audio.pause(); paint(); highlight();
  const blob = await fetch(url).then(r => r.ok ? r.blob() : null).catch(() => null);
  if (now !== mine) return; // se ha pedido otro apartado mientras cargaba
  if (blobUrl) URL.revokeObjectURL(blobUrl);
  blobUrl = blob ? URL.createObjectURL(blob) : '';
  audio.src = blobUrl || url;
  audio.playbackRate = load().rate || 1;
  if (at > 0) audio.addEventListener('loadedmetadata', () => { audio.currentTime = at; }, { once: true });
  follow = true;
  audio.play().catch(() => {}); // si el navegador bloquea el inicio, queda en pausa con el botón a la vista
  if ('mediaSession' in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title, artist: 'Bitácora Ciber', album: document.querySelector('.tema-hero h1')?.textContent || '' });
  paint(); highlight();
}
function stop() { audio.pause(); audio.removeAttribute('src'); now = null; paint(); highlight(); }
function step(dir) { // bloque anterior o siguiente; al final, apartado siguiente
  if (!now) return; const cues = now.data.cues; const i = cueAt(audio.currentTime);
  if (dir < 0) { audio.currentTime = audio.currentTime - cues[i].t > 2 || i === 0 ? cues[i].t : cues[i - 1].t; }
  else if (i + 1 < cues.length) audio.currentTime = cues[i + 1].t;
  else nextSection();
  follow = true;
}
function nextSection() {
  const i = now.order.indexOf(now.id); const id = now.order[i + 1];
  if (id) play(now.topic, id); else { audio.pause(); paint(); highlight(); }
}

// Botón «Escuchar» en la cabecera de cada apartado con audio. Se vuelve a poner cada vez que app.js repinta.
async function decorate() {
  const topic = routeTopic(); if (!topic) { highlight(); return; }
  const m = await manifest(topic); if (!m || routeTopic() !== topic) return;
  const saved = load().last;
  for (const [id, data] of Object.entries(m.sections)) {
    const meta = sectionEl(id)?.querySelector('.tema-section-meta'); if (!meta || meta.querySelector('.audio-listen')) continue;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'audio-listen'; b.dataset.audio = id; b.setAttribute('aria-pressed', 'false');
    b.innerHTML = `${ICON.wave}<span>Escuchar resumen</span><small>${Math.max(1, Math.round(data.duration / 60))} min</small>`;
    meta.append(b);
  }
  const hero = document.querySelector('.tema-progress');
  if (hero && !hero.querySelector('.audio-start')) {
    const total = Object.values(m.sections).reduce((n, s) => n + s.duration, 0);
    const resume = saved?.topic === topic && m.sections[saved.id] ? saved : null;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn secondary audio-start'; b.dataset.audio = resume ? resume.id : Object.keys(m.sections)[0]; if (resume) b.dataset.at = resume.t;
    b.innerHTML = `${ICON.wave}<span>${resume ? 'Seguir escuchando' : 'Escuchar el tema resumido'} · ${Math.round(total / 60)} min</span>`;
    hero.append(b);
  }
  highlight();
}

export function initAudio() {
  audio = new Audio(); audio.preload = 'metadata';
  bar = document.createElement('div'); bar.className = 'audio-bar'; bar.hidden = true; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Reproductor del tema');
  bar.innerHTML = `<input class="audio-seek" type="range" min="0" max="1" step="0.1" value="0" aria-label="Posición en el apartado">
<div class="audio-row"><button type="button" class="audio-btn" data-do="prev" aria-label="Bloque anterior">${ICON.prev}</button><button type="button" class="audio-btn audio-toggle" data-do="toggle" aria-label="Reproducir">${ICON.play}</button><button type="button" class="audio-btn" data-do="next" aria-label="Bloque siguiente">${ICON.next}</button>
<button type="button" class="audio-info" data-do="locate" title="Ir a lo que está sonando"><b class="audio-title"></b><span class="audio-time">0:00</span></button>
<button type="button" class="audio-rate" data-do="rate" aria-label="Velocidad">1×</button><button type="button" class="audio-btn audio-close" data-do="close" aria-label="Cerrar el reproductor">${ICON.close}</button></div>`;
  document.body.append(bar);

  bar.addEventListener('click', e => {
    const act = e.target.closest('[data-do]')?.dataset.do; if (!act || !now) return;
    if (act === 'toggle') audio.paused ? audio.play() : audio.pause();
    else if (act === 'prev') step(-1);
    else if (act === 'next') step(1);
    else if (act === 'close') stop();
    else if (act === 'rate') { const r = RATES[(RATES.indexOf(audio.playbackRate) + 1) % RATES.length]; audio.playbackRate = r; save({ rate: r }); paint(); }
    else if (act === 'locate') { if (routeTopic() !== now.topic) location.hash = `#/tema/${now.topic}/estudio/${now.id}`; follow = true; setTimeout(() => { sectionEl(now?.id) && highlight(); }, 60); }
  });
  bar.querySelector('.audio-seek').addEventListener('input', e => { audio.currentTime = Number(e.target.value); follow = true; });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-audio]'); if (!b) return;
    const topic = routeTopic(); const id = b.dataset.audio;
    if (now && now.topic === topic && now.id === id && !b.dataset.at) audio.paused ? audio.play() : audio.pause();
    else play(topic, id, Number(b.dataset.at) || 0);
  });
  let tick = 0;
  audio.addEventListener('timeupdate', () => { paint(); highlight(); if (now && ++tick % 8 === 0) save({ last: { topic: now.topic, id: now.id, t: Math.floor(audio.currentTime) } }); });
  for (const ev of ['play', 'pause', 'loadedmetadata', 'ratechange']) audio.addEventListener(ev, () => { paint(); highlight(); });
  audio.addEventListener('ended', nextSection);
  audio.addEventListener('error', () => { if (now) { bar.querySelector('.audio-title').textContent = 'No se ha podido cargar el audio'; } });
  // Si la persona se desplaza a mano mientras suena, no se le arrastra de vuelta hasta que pulse algo del reproductor.
  for (const ev of ['wheel', 'touchmove']) addEventListener(ev, () => { follow = false; }, { passive: true });
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('previoustrack', () => step(-1));
    navigator.mediaSession.setActionHandler('nexttrack', () => step(1));
  }
  new MutationObserver(decorate).observe(document.querySelector('main') || document.body, { childList: true });
  addEventListener('hashchange', decorate);
  decorate();
}
