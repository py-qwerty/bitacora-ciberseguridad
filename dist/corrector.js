// Corrección con Claude desde el navegador.
// La API key la pega la persona en la web y se guarda SOLO en su navegador (localStorage).
// Las peticiones van directamente del navegador a la API de Anthropic con el SDK oficial,
// que se carga bajo demanda desde dist/vendor (no hay servidor intermedio).
const KEY = 'bitacora-ciber:v1:ai:key';
const MODEL = 'bitacora-ciber:v1:ai:model';
export const MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 · el más preciso (unos 3 céntimos por corrección)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 · más barato (unos 1,5 céntimos por corrección)' }
];
const safeGet = k => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
const safeSet = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); return true; } catch { return false; } };
export const hasKey = () => /^sk-ant-/.test(safeGet(KEY));
export const currentModel = () => MODELS.some(m => m.id === safeGet(MODEL)) ? safeGet(MODEL) : MODELS[0].id;
export const maskedKey = () => { const k = safeGet(KEY); return k ? `${k.slice(0, 10)}…${k.slice(-4)}` : ''; };
export function saveSettings(key, model) {
  key = String(key || '').trim();
  if (key && !/^sk-ant-api/.test(key)) throw Error(key.startsWith('sk-ant-oat') ? 'Ese es un token de suscripción. Aquí hace falta una API key de Console (empieza por sk-ant-api).' : 'La API key debe empezar por sk-ant-api.');
  if (key && !safeSet(KEY, key)) throw Error('Este navegador no permite guardar datos (¿modo privado?).');
  if (model) safeSet(MODEL, model);
}
export const clearKey = () => safeSet(KEY, '');

let sdk = null;
async function client() {
  if (!hasKey()) throw Error('Falta la API key.');
  sdk ||= import('./vendor/anthropic-sdk-1.8.0.js');
  const { Anthropic } = await sdk;
  return { Anthropic, api: new Anthropic({ apiKey: safeGet(KEY), dangerouslyAllowBrowser: true, maxRetries: 2 }) };
}

const SYSTEM = `Eres profesor de un máster universitario de ciberseguridad en España y corriges respuestas de examen escritas por un alumno principiante.
Corrige con el criterio de un examen real: exigente pero justo. Da por buena cualquier formulación equivalente aunque no use las mismas palabras que la respuesta modelo; la respuesta modelo es solo una referencia. Penaliza los errores de concepto y lo que falte, no el estilo.
Para cada parte, decide punto clave por punto clave si la respuesta del alumno lo cubre de verdad (no basta con nombrarlo de pasada si el punto pide explicarlo).
Escribe en español claro y cercano, en segunda persona, sin jerga sin explicar. No uses Markdown salvo **negrita** para resaltar alguna idea clave.`;

const schema = parts => ({
  type: 'object',
  additionalProperties: false,
  required: ['score', 'summary', 'parts'],
  properties: {
    score: { type: 'number', description: 'Nota total del alumno, de 0 a la puntuación máxima indicada, en múltiplos de 0,25.' },
    summary: { type: 'string', description: 'Valoración global en 1 a 3 frases.' },
    parts: {
      type: 'array', description: `Exactamente ${parts} elemento(s), uno por cada pregunta y en el mismo orden.`,
      items: {
        type: 'object', additionalProperties: false,
        required: ['covered', 'good', 'missing', 'errors', 'improved'],
        properties: {
          covered: { type: 'array', items: { type: 'boolean' }, description: 'Un valor por punto clave, en el mismo orden: true si la respuesta lo cubre.' },
          good: { type: 'string', description: 'Qué está bien, en 1 o 2 frases. Cadena vacía si nada.' },
          missing: { type: 'array', items: { type: 'string' }, description: 'Lo que falta para la máxima nota, una idea por elemento.' },
          errors: { type: 'array', items: { type: 'string' }, description: 'Errores o imprecisiones concretos, una idea por elemento. Vacío si no hay.' },
          improved: { type: 'string', description: 'La respuesta del alumno reescrita para sacar la máxima nota, con su estilo y extensión de examen (párrafos separados por saltos de línea).' }
        }
      }
    }
  }
});

function userPrompt({ item, texts, course }) {
  const qs = item.questions || [item];
  const head = `Asignatura: ${course}\nTipo: ${item.questions ? 'caso práctico' : 'pregunta de desarrollo'} · Puntuación máxima: ${item.points} puntos · Tiempo orientativo: ${item.minutes} minutos.`;
  const scen = item.scenario ? `\n\n<enunciado_del_caso>\n${item.scenario.join('\n')}\n</enunciado_del_caso>` : '';
  const body = qs.map((q, i) => `\n\n<pregunta numero="${i + 1}">\n${q.prompt}\n<puntos_clave>\n${q.keyPoints.map((k, j) => `${j + 1}. ${k}`).join('\n')}\n</puntos_clave>\n<respuesta_modelo>\n${q.model.join('\n').replace(/\*\*/g, '')}\n</respuesta_modelo>\n<respuesta_del_alumno>\n${(texts[i] || '').trim() || '(en blanco)'}\n</respuesta_del_alumno>\n</pregunta>`).join('');
  return `${head}${scen}${body}\n\nCorrige la respuesta del alumno. Si una respuesta está en blanco, todos sus puntos clave son false.`;
}

// Devuelve { score, summary, parts:[{covered, good, missing, errors, improved}], model }.
export async function gradeWithClaude({ item, texts, course }) {
  const { Anthropic, api } = await client();
  const qs = item.questions || [item];
  let res;
  try {
    res = await api.beta.messages.create({
      model: currentModel(),
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: schema(qs.length) } },
      system: SYSTEM,
      messages: [{ role: 'user', content: userPrompt({ item, texts, course }) }]
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw Error('La API key no es válida o se ha revocado. Cámbiala en «Ajustes de Claude».');
    if (e instanceof Anthropic.PermissionDeniedError) throw Error('Esa API key no tiene permiso para usar este modelo.');
    if (e instanceof Anthropic.RateLimitError) throw Error('Has hecho demasiadas peticiones seguidas o se ha alcanzado tu límite. Espera un minuto y vuelve a probar.');
    if (e instanceof Anthropic.BadRequestError) throw Error(/credit|balance/i.test(e.message) ? 'Tu cuenta de Console no tiene saldo. Añade crédito en platform.claude.com → Billing.' : 'Claude no ha aceptado la petición: ' + e.message);
    if (e instanceof Anthropic.APIConnectionError) throw Error('No se ha podido conectar con Claude. Revisa tu conexión.');
    if (e instanceof Anthropic.APIError) throw Error(`Error de la API de Claude (${e.status ?? 'sin código'}). Vuelve a intentarlo en un rato.`);
    throw e;
  }
  if (res.stop_reason === 'refusal') throw Error('Claude no ha querido corregir esta respuesta. Prueba a reformularla.');
  if (res.stop_reason === 'max_tokens') throw Error('La corrección se ha cortado. Vuelve a intentarlo.');
  const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('');
  let out;
  try { out = JSON.parse(text); } catch { throw Error('La respuesta de Claude no tenía el formato esperado. Vuelve a intentarlo.'); }
  const parts = qs.map((q, i) => {
    const p = out.parts?.[i] || {};
    return {
      covered: q.keyPoints.map((_, j) => p.covered?.[j] === true),
      good: String(p.good || ''),
      missing: Array.isArray(p.missing) ? p.missing.map(String) : [],
      errors: Array.isArray(p.errors) ? p.errors.map(String) : [],
      improved: String(p.improved || '')
    };
  });
  const score = Math.max(0, Math.min(item.points, Math.round(Number(out.score || 0) * 4) / 4));
  return { score, summary: String(out.summary || ''), parts, model: res.model, at: Date.now() };
}
