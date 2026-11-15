// Valida uno o varios temas digitales sin publicar nada (seguro de usar en paralelo).
// Uso: node scripts/check-tema.mjs content/temas/redes/tema-01.json …
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateTema } from '../dist/core.js';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const bank = JSON.parse(await readFile(path.join(root, 'dist/bank.json'), 'utf8'));
let failed = 0;
for (const f of process.argv.slice(2)) {
  try {
    const tema = JSON.parse(await readFile(f, 'utf8'));
    validateTema(tema, bank);
    const n = tema.sections.reduce((a, s) => a + s.blocks.filter(b => b.type === 'diagram').length, 0);
    console.log(`OK ${f} · ${n} esquemas`);
  } catch (e) { failed++; console.log(`ERROR ${f}: ${e.message}`); }
}
process.exit(failed ? 1 : 0);
