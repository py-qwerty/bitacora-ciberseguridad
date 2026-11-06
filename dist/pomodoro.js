// Pomodoro flotante: vive fuera del router, así sigue corriendo al cambiar de página.
// El estado guarda marcas de tiempo absolutas, por lo que sobrevive a recargas y pestañas en segundo plano.
const KEY = 'bitacora-ciber:v1:pomodoro';
const MODES = {
  focus: { label: 'Concentración', short: 'Foco', color: 'var(--color-primary)' },
  short: { label: 'Descanso corto', short: 'Pausa', color: 'var(--color-secondary)' },
  long: { label: 'Descanso largo', short: 'Descanso', color: 'var(--color-success)' }
};
const DEFAULTS = { focus: 25, short: 5, long: 15, every: 4 };
const clamp = (v, lo, hi, d) => { v = Math.round(Number(v)); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
const today = () => new Date().toLocaleDateString('sv-SE');
const fmt = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

let st = load();
function load() {
  let raw = {};
  try { raw = JSON.parse(localStorage.getItem(KEY)) || {}; } catch {}
  const cfg = {
    focus: clamp(raw.cfg?.focus, 1, 120, DEFAULTS.focus), short: clamp(raw.cfg?.short, 1, 60, DEFAULTS.short),
    long: clamp(raw.cfg?.long, 1, 90, DEFAULTS.long), every: clamp(raw.cfg?.every, 2, 8, DEFAULTS.every),
    sound: raw.cfg?.sound !== false, autoNext: raw.cfg?.autoNext === true
  };
  const mode = MODES[raw.mode] ? raw.mode : 'focus';
  const total = cfg[mode] * 60000;
  return {
    cfg, mode, cycle: clamp(raw.cycle, 0, 99, 0),
    endsAt: Number.isFinite(raw.endsAt) ? raw.endsAt : null,
    left: Number.isFinite(raw.left) ? Math.min(total, Math.max(0, raw.left)) : total,
    day: raw.day === today() ? raw.day : today(), done: raw.day === today() ? clamp(raw.done, 0, 999, 0) : 0,
    minutes: raw.day === today() ? clamp(raw.minutes, 0, 99999, 0) : 0, open: false
  };
}
const save = () => { try { const { open, ...s } = st; localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };
const total = () => st.cfg[st.mode] * 60000;
const running = () => st.endsAt !== null;
const remaining = () => running() ? Math.max(0, st.endsAt - Date.now()) : st.left;

let audio;
function beep() {
  if (!st.cfg.sound) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    [0, .22, .44].forEach((t, i) => {
      const o = audio.createOscillator(), g = audio.createGain(), at = audio.currentTime + t;
      o.type = 'sine'; o.frequency.value = i === 2 ? 880 : 660;
      g.gain.setValueAtTime(.0001, at); g.gain.exponentialRampToValueAtTime(.22, at + .02); g.gain.exponentialRampToValueAtTime(.0001, at + .2);
      o.connect(g).connect(audio.destination); o.start(at); o.stop(at + .22);
    });
  } catch {}
}
function notify(title, body) {
  try { if ('Notification' in window && Notification.permission === 'granted' && document.hidden) new Notification(title, { body, icon: 'assets/notebook.svg' }); } catch {}
}

function setMode(mode) { st.mode = mode; st.endsAt = null; st.left = total(); save(); paint(); }
function start() {
  if (running()) return;
  try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume?.(); } catch {}
  try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch {}
  st.endsAt = Date.now() + (st.left > 0 ? st.left : total()); save(); paint();
}
function pause() { if (!running()) return; st.left = remaining(); st.endsAt = null; save(); paint(); }
function reset() { st.endsAt = null; st.left = total(); save(); paint(); }
function complete() {
  const wasFocus = st.mode === 'focus';
  if (st.day !== today()) { st.day = today(); st.done = 0; st.minutes = 0; }
  if (wasFocus) { st.done++; st.minutes += st.cfg.focus; st.cycle++; }
  st.mode = wasFocus ? (st.cycle % st.cfg.every === 0 ? 'long' : 'short') : 'focus';
  st.endsAt = null; st.left = total();
  beep();
  notify(wasFocus ? '¡Pomodoro completado!' : 'Descanso terminado', wasFocus ? `Toca ${MODES[st.mode].label.toLowerCase()} (${st.cfg[st.mode]} min).` : 'Vuelve a concentrarte.');
  if (st.cfg.autoNext) { st.endsAt = Date.now() + st.left; }
  save(); paint(); announce(wasFocus ? `Pomodoro completado. ${MODES[st.mode].label}.` : 'Descanso terminado. Hora de concentrarse.');
}
function skip() { st.endsAt = null; if (st.mode === 'focus') { st.mode = 'short'; } else st.mode = 'focus'; st.left = total(); save(); paint(); }

let root, live;
function announce(t) { if (live) { live.textContent = ''; setTimeout(() => live.textContent = t, 50); } }

const R = 52, C = 2 * Math.PI * R;
function build() {
  root = document.createElement('div');
  root.className = 'pomo';
  root.innerHTML = `
  <button type="button" class="pomo-fab" aria-expanded="false" aria-controls="pomo-panel" aria-label="Pomodoro">
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 1.5M9.5 2.5h5M12 2.5v3"/></svg>
    <span class="pomo-fab-time" hidden></span>
  </button>
  <section id="pomo-panel" class="pomo-panel" role="dialog" aria-label="Temporizador Pomodoro" hidden>
    <header class="pomo-head"><h2>Pomodoro</h2><span class="pomo-count" title="Pomodoros completados hoy"></span>
      <button type="button" class="pomo-icon" data-act="settings" aria-label="Ajustes" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg></button>
      <button type="button" class="pomo-icon" data-act="close" aria-label="Cerrar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    </header>
    <div class="pomo-tabs" role="tablist" aria-label="Modo">
      ${Object.entries(MODES).map(([k, m]) => `<button type="button" role="tab" data-mode="${k}">${m.short}</button>`).join('')}
    </div>
    <div class="pomo-dial">
      <svg viewBox="0 0 120 120" aria-hidden="true"><circle class="pomo-track" cx="60" cy="60" r="${R}"/><circle class="pomo-arc" cx="60" cy="60" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="0" transform="rotate(-90 60 60)"/></svg>
      <div class="pomo-readout"><output class="pomo-time" role="timer" aria-live="off"></output><span class="pomo-label"></span></div>
    </div>
    <div class="pomo-dots" aria-hidden="true"></div>
    <div class="pomo-actions">
      <button type="button" class="pomo-icon" data-act="reset" aria-label="Reiniciar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4"/></svg></button>
      <button type="button" class="pomo-main" data-act="toggle"></button>
      <button type="button" class="pomo-icon" data-act="skip" aria-label="Saltar a la siguiente fase"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5l9 7-9 7zM18 5v14"/></svg></button>
    </div>
    <p class="pomo-stats"></p>
    <form class="pomo-settings" hidden>
      <label>Foco (min)<input type="number" name="focus" min="1" max="120" inputmode="numeric"></label>
      <label>Pausa corta<input type="number" name="short" min="1" max="60" inputmode="numeric"></label>
      <label>Pausa larga<input type="number" name="long" min="1" max="90" inputmode="numeric"></label>
      <label>Larga cada<input type="number" name="every" min="2" max="8" inputmode="numeric"></label>
      <label class="pomo-check"><input type="checkbox" name="sound"> Sonido al terminar</label>
      <label class="pomo-check"><input type="checkbox" name="autoNext"> Iniciar la siguiente fase sola</label>
    </form>
    <span class="sr-only" role="status" aria-live="polite" id="pomo-live"></span>
  </section>`;
  document.body.append(root);
  live = root.querySelector('#pomo-live');
  const $ = s => root.querySelector(s);

  $('.pomo-fab').addEventListener('click', () => toggleOpen());
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-act],[data-mode]'); if (!b) return;
    if (b.dataset.mode) return setMode(b.dataset.mode);
    ({ toggle: () => running() ? pause() : start(), reset, skip, close: () => toggleOpen(false),
      settings: () => { const f = $('.pomo-settings'); f.hidden = !f.hidden; b.setAttribute('aria-pressed', String(!f.hidden)); } })[b.dataset.act]?.();
  });
  const form = $('.pomo-settings');
  form.addEventListener('change', () => {
    const d = new FormData(form), c = st.cfg;
    c.focus = clamp(d.get('focus'), 1, 120, c.focus); c.short = clamp(d.get('short'), 1, 60, c.short);
    c.long = clamp(d.get('long'), 1, 90, c.long); c.every = clamp(d.get('every'), 2, 8, c.every);
    c.sound = form.sound.checked; c.autoNext = form.autoNext.checked;
    if (!running()) st.left = total();
    fillForm(); save(); paint();
  });
  root.addEventListener('keydown', e => { if (e.key === 'Escape' && st.open) { toggleOpen(false); $('.pomo-fab').focus(); } });
  document.addEventListener('keydown', e => {
    if (e.target.closest('input,textarea,select,[contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key.toLowerCase() === 'p') toggleOpen();
  });
  document.addEventListener('click', e => { if (st.open && !root.contains(e.target) && window.innerWidth < 1024) toggleOpen(false); });
  addEventListener('storage', e => { if (e.key === KEY) { const o = st.open; st = load(); st.open = o; paint(); } });
  document.addEventListener('visibilitychange', tick);
  fillForm();
}
function fillForm() {
  const f = root.querySelector('.pomo-settings'), c = st.cfg;
  ['focus', 'short', 'long', 'every'].forEach(k => { if (document.activeElement !== f[k]) f[k].value = c[k]; });
  f.sound.checked = c.sound; f.autoNext.checked = c.autoNext;
}
function toggleOpen(v = !st.open) {
  st.open = v;
  root.querySelector('#pomo-panel').hidden = !v;
  root.querySelector('.pomo-fab').setAttribute('aria-expanded', String(v));
  root.classList.toggle('is-open', v);
}

const TITLE_PREFIX = /^\d{2,}:\d{2} · [^—]+— /;
function paint() {
  if (!root) return;
  const $ = s => root.querySelector(s), rem = remaining(), frac = total() ? rem / total() : 0, m = MODES[st.mode];
  root.dataset.mode = st.mode; root.dataset.running = running();
  $('.pomo-time').textContent = fmt(rem);
  $('.pomo-label').textContent = m.label;
  $('.pomo-arc').style.strokeDashoffset = String(C * (1 - frac));
  $('.pomo-main').textContent = running() ? 'Pausar' : (rem < total() ? 'Reanudar' : 'Empezar');
  root.querySelectorAll('[data-mode]').forEach(b => { const on = b.dataset.mode === st.mode; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
  const inCycle = st.cycle % st.cfg.every;
  $('.pomo-dots').innerHTML = Array.from({ length: st.cfg.every }, (_, i) => `<i class="${i < inCycle ? 'on' : ''}${i === inCycle && st.mode === 'focus' ? ' now' : ''}"></i>`).join('');
  $('.pomo-count').textContent = `${st.done} hoy`;
  $('.pomo-stats').textContent = st.done ? `Hoy: ${st.done} ${st.done === 1 ? 'pomodoro' : 'pomodoros'} · ${st.minutes >= 60 ? `${Math.floor(st.minutes / 60)} h ${st.minutes % 60} min` : `${st.minutes} min`} de foco` : 'Aún no has completado ningún pomodoro hoy.';
  const pill = $('.pomo-fab-time');
  pill.hidden = !running(); pill.textContent = fmt(rem);
  const base = document.title.replace(TITLE_PREFIX, '');
  document.title = running() ? `${fmt(rem)} · ${m.short} — ${base}` : base;
}
function tick() {
  if (running() && Date.now() >= st.endsAt) complete();
  else if (running() || root?.classList.contains('is-open')) paint();
}

export function initPomodoro() {
  if (root) return;
  build(); paint();
  if (running() && Date.now() >= st.endsAt) complete();
  setInterval(tick, 500);
}
