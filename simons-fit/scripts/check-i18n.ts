import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_KEYS } from '../src/i18n';

function walk(d: string): string[] {
  return readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.tsx') ? [p] : [];
  });
}
const used = new Set<string>();
for (const f of walk('src')) {
  const src = readFileSync(f, 'utf-8');
  for (const m of src.matchAll(/\bt\('([^']+)'/g)) used.add(m[1]);
}
// chaves dinâmicas
const dyn = [
  ...[0, 1, 2, 3, 4, 5, 6].map((d) => `dow.${d}`),
  ...['chest','back','sideDelts','rearDelts','biceps','triceps','quads','hamstrings','glutes','calves','abs','adductors'].map((m) => `m.${m}`),
  ...['weight','bodyweight','time','cardio'].map((k) => `kind.${k}`),
  ...['barbell','dumbbell','machine','cable','bodyweight','other'].map((q) => `eq.${q}`),
  ...['volume','strength','activity'].map((k) => `stats.${k}`)
];
dyn.forEach((k) => used.add(k));
const pt = new Set(ALL_KEYS.pt), en = new Set(ALL_KEYS.en);
const missPt = [...used].filter((k) => !pt.has(k));
const missEn = [...used].filter((k) => !en.has(k));
const onlyPt = [...pt].filter((k) => !en.has(k)), onlyEn = [...en].filter((k) => !pt.has(k));
console.log('chaves usadas:', used.size);
console.log('em falta PT:', missPt, '\nem falta EN:', missEn, '\nsó PT:', onlyPt, '\nsó EN:', onlyEn);
process.exit(missPt.length || missEn.length || onlyPt.length || onlyEn.length ? 1 : 0);
