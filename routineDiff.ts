import type { Routine, Workout } from '../types';

export type RoutineChange =
  | { kind: 'replace'; fromId: string; toId: string }
  | { kind: 'add'; exerciseId: string; sets: number }
  | { kind: 'remove'; exerciseId: string }
  | { kind: 'sets'; exerciseId: string; from: number; to: number };

/**
 * Compara o treino (como ficará depois de terminar: só exercícios com séries feitas)
 * com a rotina de origem e lista as diferenças.
 */
export function diffWorkoutRoutine(w: Workout, routine: Routine): RoutineChange[] {
  const out: RoutineChange[] = [];
  const used = new Set<number>(); // índices de itens da rotina já ligados a um exercício do treino
  const find = (id: string) => routine.items.findIndex((it, i) => it.exerciseId === id && !used.has(i));

  const done = w.exercises
    .map((we) => ({ we, n: we.sets.filter((s) => s.done && !s.warmup).length, any: we.sets.some((s) => s.done) }))
    .filter((x) => x.any);

  for (const { we, n } of done) {
    const n1 = Math.max(1, n);
    if (we.replacedFrom) {
      const i = find(we.replacedFrom);
      if (i >= 0) {
        used.add(i);
        out.push({ kind: 'replace', fromId: we.replacedFrom, toId: we.exerciseId });
        if (n1 !== routine.items[i].sets) out.push({ kind: 'sets', exerciseId: we.exerciseId, from: routine.items[i].sets, to: n1 });
        continue;
      }
    }
    const i = find(we.exerciseId);
    if (i >= 0) {
      used.add(i);
      if (n1 !== routine.items[i].sets) out.push({ kind: 'sets', exerciseId: we.exerciseId, from: routine.items[i].sets, to: n1 });
    } else {
      out.push({ kind: 'add', exerciseId: we.exerciseId, sets: n1 });
    }
  }
  routine.items.forEach((it, i) => {
    if (!used.has(i)) out.push({ kind: 'remove', exerciseId: it.exerciseId });
  });
  return out;
}
