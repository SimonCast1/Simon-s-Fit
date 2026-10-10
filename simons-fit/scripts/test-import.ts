import { readFileSync } from 'node:fs';
import { parseHevyCsv, buildImport } from '../src/lib/hevy';
import { BASE_EXERCISES } from '../src/data/exercises';

const file = process.argv[2] ?? 'tests/fixture-hevy.csv';
const text = readFileSync(file, 'utf-8');
const res = parseHevyCsv(text);
const built = buildImport(res.workouts, BASE_EXERCISES);

let ok = true;
const check = (label: string, cond: boolean, extra = '') => {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${label} ${extra}`);
  if (!cond) ok = false;
};

check('linhas lidas = 951', res.rows === 951, String(res.rows));
check('treinos = 53', built.workouts.length === 53, String(built.workouts.length));
check('séries = 951', built.totalSets === 951, String(built.totalSets));
check('sem avisos', res.warnings.length === 0, res.warnings.join(','));
check('0 exercícios novos (os 44 já estão na biblioteca)', built.newExercises.length === 0,
  built.newExercises.map((e) => e.name).join(' | '));

const first = new Date(built.workouts[0].startedAt);
const last = new Date(built.workouts.at(-1)!.startedAt);
console.log('primeiro:', first.toString(), built.workouts[0].name);
console.log('último  :', last.toString(), built.workouts.at(-1)!.name);
check('último treino = 8 Out 2026 12:37', last.getFullYear() === 2026 && last.getMonth() === 9 && last.getDate() === 8 && last.getHours() === 12 && last.getMinutes() === 37);
check('primeiro treino = 31 Mar 2026 20:14', first.getMonth() === 2 && first.getDate() === 31 && first.getHours() === 20 && first.getMinutes() === 14);

const plank = built.workouts.flatMap((w) => w.exercises).filter((e) => e.exerciseId === 'plank');
check('prancha com duração', plank.length > 0 && plank.every((e) => e.sets.every((s) => s.durationSec && !s.reps)));
const tm = built.workouts.flatMap((w) => w.exercises).filter((e) => e.exerciseId === 'treadmill');
check('passadeira 600 s', tm.length === 1 && tm[0].sets[0].durationSec === 600);
const w8 = built.workouts.at(-1)!;
const inc = w8.exercises.find((e) => e.exerciseId === 'incline-bench-press-dumbbell')!;
check('Upper B: supino inclinado 3×22,5 (12/8/7)', inc.sets.map((s) => `${s.weight}x${s.reps}`).join() === '22.5x12,22.5x8,22.5x7', inc.sets.map((s) => `${s.weight}x${s.reps}`).join());
check('ordem dos exercícios preservada', w8.exercises[0].exerciseId === 'incline-bench-press-dumbbell' && w8.exercises[1].exerciseId === 'pull-up');

// contagem por exercício vs. análise independente (python): supino inclinado = 88 séries
const counts = new Map<string, number>();
for (const w of built.workouts) for (const e of w.exercises) counts.set(e.exerciseId, (counts.get(e.exerciseId) ?? 0) + e.sets.length);
check('88 séries de supino inclinado', counts.get('incline-bench-press-dumbbell') === 88, String(counts.get('incline-bench-press-dumbbell')));
check('78 séries de chest fly', counts.get('chest-fly-machine') === 78);
check('44 exercícios distintos', counts.size === 44, String(counts.size));
check('sets sem reps tratados (5 linhas sem reps)', built.workouts.flatMap(w=>w.exercises).flatMap(e=>e.sets).filter(s=>s.reps===undefined).length === 5);

process.exit(ok ? 0 : 1);
