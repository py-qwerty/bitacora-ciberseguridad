// Siglas de los temas digitales.
// La primera vez que una sigla aparece en un tema se explica en línea, entre paréntesis.
// Todas las apariciones (también la primera) se pueden expandir: pasando el ratón, con el teclado o tocándolas.
// El mapa de siglas de cada tema lo prepara scripts/build-temas.mjs (content/glossary.json + content/siglas-curso.json).

let map = null, re = null, seen = new Set();
const escAttr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const short = text => String(text).trim().replace(/\.$/, '');

// Empieza a marcar siglas con el mapa de un tema. `fresh` reinicia «ya explicada» (al pintar el tema entero).
export function sgStart(siglas, fresh = true) {
  const keys = siglas && typeof siglas === 'object' ? Object.keys(siglas).filter(k => k && typeof siglas[k] === 'string') : [];
  map = keys.length ? siglas : null;
  re = map ? new RegExp(`(?<![\\p{L}\\p{N}])(${keys.sort((a, b) => b.length - a.length).map(escRe).join('|')})(s?)(?![\\p{L}\\p{N}])`, 'gu') : null;
  if (fresh) seen = new Set();
}
export function sgEnd() { map = null; re = null; }

// Recibe HTML ya escapado (solo con etiquetas simples como <strong>) y marca las siglas del texto.
// mode 'inline': la primera aparición del tema se explica entre paréntesis. 'define': el texto es la definición
// (título de un bloque «term»), cuenta como explicada. Cualquier otro valor: solo expandible.
export function sgApply(html, mode) {
  if (!re) return html;
  const inline = mode === 'inline';
  const parts = html.split(/(<[^>]+>)/);
  // Texto visible alrededor de un trozo, saltando etiquetas: «<strong>DSI</strong> (Departamento…)» también cuenta como desarrollada.
  const textBefore = i => parts.slice(0, i).filter(p => p[0] !== '<').join('').slice(-2);
  const textAfter = i => parts.slice(i + 1).filter(p => p[0] !== '<').join('').slice(0, 4);
  return parts.map((part, i) => {
    if (!part || part[0] === '<') return part;
    return part.replace(re, (m, key, plural, offset, whole) => {
      const text = map[key];
      const before = (textBefore(i) + whole.slice(0, offset)).slice(-2);
      const after = (whole.slice(offset + m.length) + textAfter(i)).slice(0, 4);
      // Si el propio texto ya la desarrolla — «AEPD (Agencia…)» o «Agencia… (AEPD)» —, cuenta como explicada.
      // Un paréntesis que empieza por cifra («TLS (1.3)») no es su desarrollo.
      const explainedHere = /\($/.test(before) || /^ ?\((?!\s*\d)/.test(after);
      const first = !seen.has(key);
      if (first && (inline || explainedHere || mode === 'define')) seen.add(key);
      const tag = `<abbr class="sg" tabindex="0" data-sg="${escAttr(key)}" data-tip="${escAttr(text)}">${key}</abbr>${plural}`;
      return first && inline && !explainedHere ? `${tag}<span class="sg-exp"> (${escAttr(short(text))})</span>` : tag;
    });
  }).join('');
}

// Lista ordenada de las siglas del tema, para la sección «Siglas de este tema».
export const sgList = siglas => Object.entries(siglas || {}).sort(([a], [b]) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

// Globo flotante: uno solo para toda la página.
let tip = null, owner = null;
function show(el) {
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'sg-tip'; tip.id = 'sg-tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true;
    document.body.append(tip);
  }
  owner?.removeAttribute('aria-describedby');
  owner = el;
  tip.innerHTML = `<b>${escAttr(el.dataset.sg)}</b><span>${escAttr(el.dataset.tip)}</span>`;
  tip.hidden = false;
  el.setAttribute('aria-describedby', 'sg-tip');
  const r = el.getBoundingClientRect(), w = Math.min(340, window.innerWidth - 24);
  tip.style.maxWidth = w + 'px';
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  const left = Math.max(12, Math.min(r.left + r.width / 2 - tw / 2, window.innerWidth - tw - 12));
  const top = r.top - th - 8 > 8 ? r.top - th - 8 : r.bottom + 8;
  tip.style.left = left + 'px'; tip.style.top = top + 'px';
}
function hide() { if (tip) tip.hidden = true; owner?.removeAttribute('aria-describedby'); owner = null; }

export function setupSiglas() {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !window.matchMedia) return;
  const hoverable = window.matchMedia('(hover: hover)');
  document.addEventListener('mouseover', e => { if (!hoverable.matches) return; const el = e.target.closest?.('.sg'); if (el) show(el); });
  document.addEventListener('mouseout', e => { if (!hoverable.matches) return; const el = e.target.closest?.('.sg'); if (el && el === owner && !el.contains(e.relatedTarget)) hide(); });
  document.addEventListener('focusin', e => { const el = e.target.closest?.('.sg'); if (el) { if (el.matches(':focus-visible')) show(el); } else if (owner) hide(); });
  document.addEventListener('focusout', e => { if (e.target === owner) hide(); });
  document.addEventListener('click', e => {
    const el = e.target.closest?.('.sg');
    if (el) { e.preventDefault(); if (owner === el && !tip.hidden && !hoverable.matches) hide(); else show(el); return; }
    if (owner && !e.target.closest?.('.sg-tip')) hide();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && owner) hide(); });
  window.addEventListener('scroll', hide, { passive: true });
  window.addEventListener('resize', hide);
}
