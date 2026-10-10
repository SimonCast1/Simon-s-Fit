import { describe, expect, it } from 'vitest';
import { weekStreak, workoutsByDay, workoutPRs, DAY_MS, weekStart } from '../src/lib/calc';
import { plannedPerWeek, weekSummary } from '../src/lib/summary';
import { buildCardModel, bestSetText } from '../src/lib/card';
import type { Exercise, Workout } from '../src/types';

const bench: Exercise = {
  id: 'bench', name: 'Bench Press', kind: 'weight', primary: 'chest', secondary: ['triceps'],
  equipment: 'barbell', increment: 2.5, repMin: 6, repMax: 10, restSeconds: 150, isCustom: false
};
const exMap = new Map([[bench.id, bench]]);
const label = { duration: 'Duração', sets: 'Séries', volume: 'Volume', setsLc: 'séries', prs: 'Recordes' };

// quarta-feira 7 de outubro de 2026, 12:00 (semana de 5 a 11 de outubro, segunda = 5)
const NOW = new Date(2026, 9, 7, 12, 0).getTime();
const MON = weekStart(NOW);

let id = 1;
function wk(ts: number, weight: number, reps: number, sets = 3, name = 'Superior A'): Workout {
  return {
    id: id++, name, startedAt: ts, endedAt: ts + 3600_000,
    exercises: [{ exerciseId: 'bench', sets: Array.from({ length: sets }, () => ({ weight, reps, done: true })) }]
  };
}

describe('calendário e consistência', () => {
  it('agrupa treinos por dia do mês', () => {
    const ws = [wk(new Date(2026, 9, 5, 10).getTime(), 60, 8), wk(new Date(2026, 9, 5, 18).getTime(), 60, 8), wk(new Date(2026, 8, 30, 10).getTime(), 60, 8)];
    const m = workoutsByDay(ws, 2026, 9);
    expect(m.get(5)).toHaveLength(2);
    expect(m.has(30)).toBe(false);
  });

  it('sequência de semanas: a semana atual incompleta não quebra a sequência', () => {
    const ws: Workout[] = [];
    for (const back of [1, 2, 3]) for (let d = 0; d < 3; d++) ws.push(wk(MON - back * 7 * DAY_MS + d * DAY_MS + 3600_000, 60, 8));
    expect(weekStreak(ws, 3, NOW)).toBe(3);
    // a semana atual cumpre a meta → soma
    for (let d = 0; d < 3; d++) ws.push(wk(MON + d * DAY_MS - 0 + 3600_000, 60, 8));
    expect(weekStreak(ws, 3, MON + 2 * DAY_MS + 20 * 3600_000)).toBe(4);
  });

  it('uma semana em falta quebra a sequência', () => {
    const ws: Workout[] = [];
    for (let d = 0; d < 3; d++) ws.push(wk(MON - 7 * DAY_MS + d * DAY_MS + 3600_000, 60, 8));
    for (let d = 0; d < 3; d++) ws.push(wk(MON - 21 * DAY_MS + d * DAY_MS + 3600_000, 60, 8));
    expect(weekStreak(ws, 3, NOW)).toBe(1);
  });
});

describe('resumo semanal', () => {
  const routines = [{ days: [1] }, { days: [2] }, { days: [3] }, { days: [5] }];
  const settings = { minSets: { chest: 10, triceps: 8 }, lastBackupAt: NOW };

  it('treinos previstos = dias distintos das rotinas', () => {
    expect(plannedPerWeek(routines)).toBe(4);
    expect(plannedPerWeek([])).toBe(3);
  });

  it('semana sem treinos', () => {
    const s = weekSummary([], exMap, routines, settings, MON, NOW);
    expect(s.workouts).toBe(0);
    expect(s.improve[0].key).toBe('sum.imp.none');
  });

  it('semana fechada: bom (consistência, PR, volume) e a melhorar (músculo abaixo do mínimo)', () => {
    const prevMon = MON - 7 * DAY_MS;
    const before = wk(prevMon - 7 * DAY_MS + DAY_MS, 60, 8, 3);
    const week = [
      wk(prevMon + 1 * DAY_MS + 3600_000, 65, 8, 4),
      wk(prevMon + 2 * DAY_MS + 3600_000, 65, 8, 4),
      wk(prevMon + 3 * DAY_MS + 3600_000, 65, 8, 4),
      wk(prevMon + 4 * DAY_MS + 3600_000, 65, 8, 4)
    ];
    const s = weekSummary([before, ...week], exMap, routines, settings, prevMon, NOW);
    expect(s.inProgress).toBe(false);
    expect(s.workouts).toBe(4);
    expect(s.good.map((n) => n.key)).toContain('sum.good.consistency');
    expect(s.good.map((n) => n.key)).toContain('sum.good.prs');
    expect(s.good.map((n) => n.key)).toContain('sum.good.volumeup');
    // peito: 16 séries ≥ 10 ✓ ; tríceps: 16 × 0,5 = 8 ≥ 8 ✓
    expect(s.good.find((n) => n.key === 'sum.good.volume')?.muscles).toEqual(['chest', 'triceps']);
    expect(s.improve).toHaveLength(0);
  });

  it('semana fechada com poucos treinos e pouco volume', () => {
    const prevMon = MON - 7 * DAY_MS;
    const s = weekSummary([wk(prevMon + DAY_MS + 3600_000, 60, 8, 3)], exMap, routines, settings, prevMon, NOW);
    const keys = s.improve.map((n) => n.key);
    expect(keys).toContain('sum.imp.consistency');
    expect(keys).toContain('sum.imp.muscle');
    expect(s.improve.find((n) => n.key === 'sum.imp.muscle')?.n).toBe(7); // 10 − 3
  });

  it('semana em curso usa as frases "faltam" e avisa do backup antigo', () => {
    const old = { ...settings, lastBackupAt: NOW - 10 * DAY_MS };
    const s = weekSummary([wk(MON + 3600_000, 60, 8, 3)], exMap, routines, old, MON, NOW);
    expect(s.inProgress).toBe(true);
    const keys = s.improve.map((n) => n.key);
    expect(keys).toContain('sum.imp.consistency.now');
    expect(keys).toContain('sum.imp.muscle.now');
    expect(keys).toContain('sum.imp.backup');
  });
});

describe('cartão de treino', () => {
  it('modelo com estatísticas, melhor série, PR e limite de linhas', () => {
    const t0 = new Date(2026, 9, 1, 10).getTime();
    const first = wk(t0, 60, 8);
    const second = wk(t0 + 7 * DAY_MS, 65, 8, 3, 'Superior A');
    expect(workoutPRs(second, [first, second], exMap)).toHaveLength(1);
    const m = buildCardModel(second, [first, second], exMap, 'pt', (e) => e?.name ?? '?', label);
    expect(m.title).toBe('Superior A');
    expect(m.stats.map((s) => s.label)).toEqual(['Duração', 'Séries', 'Volume']);
    expect(m.stats[1].value).toBe('3');
    expect(m.rows).toEqual([{ name: 'Bench Press', detail: '3 séries · 65 kg × 8', pr: true }]);
    expect(m.more).toBe(0);

    const many: Workout = { ...second, exercises: Array.from({ length: 11 }, () => second.exercises[0]) };
    const mm = buildCardModel(many, [many], exMap, 'pt', (e) => e?.name ?? '?', label);
    expect(mm.rows).toHaveLength(7);
    expect(mm.more).toBe(4);
  });

  it('melhor série por tipo de exercício', () => {
    const run: Exercise = { ...bench, id: 'run', kind: 'cardio', primary: null, secondary: [] };
    expect(bestSetText(run, [{ durationSec: 1800, distanceKm: 5, done: true }], 'pt')).toBe('30 min · 5 km');
    expect(bestSetText(bench, [{ weight: 60, reps: 8, done: true }, { weight: 62.5, reps: 6, done: true }], 'pt')).toBe('60 kg × 8');
  });
});
