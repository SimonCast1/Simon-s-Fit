import { existsSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { db, initDatabase, loadSettings } from '../src/db';
import { commitHevy, previewHevy, buildBackup, restoreBackup, validateBackup, resetAll } from '../src/lib/actions';
import {
  computeRecords, deloadSignal, detectPR, e1rm, exerciseSessions, stagnationSessions, suggestProgression,
  weeklyVolume, weekStart, addWorkoutVolume, emptyVolume, DAY_MS, setTarget, startingWeight, type Session,
  relatedScore,
} from '../src/lib/calc';
import { decodeRoutine, encodeRoutine, shareLink } from '../src/lib/share';
import type { Exercise, Workout } from '../src/types';

// O CSV do Hevy é pessoal e não vai para o repositório: sem ele, os testes que dependem dele são ignorados.
const FIXTURE = 'tests/fixture-hevy.csv';
const has = existsSync(FIXTURE);
const csv = has ? readFileSync(FIXTURE, 'utf-8') : '';

async function exMap() {
  return new Map((await db.exercises.toArray()).map((e) => [e.id, e]));
}

describe.skipIf(!has)('base de dados', () => {
  beforeAll(async () => { await initDatabase(); });

  it('semeia biblioteca e as 4 rotinas do documento 1', async () => {
    expect(await db.exercises.count()).toBeGreaterThanOrEqual(76);
    const rs = await db.routines.orderBy('order').toArray();
    expect(rs.map((r) => r.name)).toEqual(['Superior A', 'Inferior', 'Superior B', 'Full body (ênfase superior)']);
    expect(rs[0].items.reduce((n, i) => n + i.sets, 0)).toBe(20);   // doc: ~20
    expect(rs[1].items.reduce((n, i) => n + i.sets, 0)).toBe(17);   // doc: ~16
    expect(rs[2].items.reduce((n, i) => n + i.sets, 0)).toBe(22);   // doc: ~22
    expect(rs[3].items.reduce((n, i) => n + i.sets, 0)).toBe(19);   // doc: ~20
    // dias: seg, ter, qua, sex
    expect(rs.map((r) => r.days)).toEqual([[1], [2], [3], [5]]);
  });

  it('todos os exercícios das rotinas existem na biblioteca', async () => {
    const m = await exMap();
    for (const r of await db.routines.toArray()) for (const it of r.items) expect(m.has(it.exerciseId), it.exerciseId).toBe(true);
  });

  it('importa o CSV real do Hevy e não duplica à segunda', async () => {
    const p = await previewHevy(csv);
    expect(p.workouts).toBe(53);
    expect(p.newWorkouts).toBe(53);
    expect(p.sets).toBe(951);
    expect(p.newExercises).toHaveLength(0);
    expect(p.warmups).toBeGreaterThan(50); // séries leves iniciais detetadas como aquecimento
    expect((await previewHevy(csv, { detectWarmups: false })).warmups).toBe(0);
    expect(await commitHevy(p)).toBe(53);
    expect(await db.workouts.count()).toBe(53);
    const again = await previewHevy(csv);
    expect(again.newWorkouts).toBe(0);
    expect(again.duplicates).toBe(53);
    expect(await commitHevy(again)).toBe(0);
    expect(await db.workouts.count()).toBe(53);
  });

  it('o histórico importado dá a "última vez" correta', async () => {
    const m = await exMap();
    const all = await db.workouts.toArray();
    const ex = m.get('incline-bench-press-dumbbell')!;
    const s = exerciseSessions(all, ex, ex.id);
    expect(s.length).toBeGreaterThan(10);
    const last = s.at(-1)!;
    expect(last.sets.map((x) => `${x.weight}x${x.reps}`)).toEqual(['22.5x12', '22.5x8', '22.5x7']);
    const sug = suggestProgression(ex, last, { repMin: 8, repMax: 12, plannedSets: 3 })!;
    expect(sug.kind).toBe('hold');
    expect(sug.weight).toBe(22.5);
    expect(sug.reps).toBe(8); // tenta bater a série mais fraca (7 → 8)
  });

  it('volume semanal fracionado (supino conta 0,5 para tríceps)', async () => {
    const m = await exMap();
    const w: Workout = {
      name: 't', startedAt: Date.now(), endedAt: Date.now(),
      exercises: [{ exerciseId: 'bench-press-barbell', sets: [{ done: true }, { done: true }, { done: true }, { done: false }] }]
    };
    const v = emptyVolume();
    addWorkoutVolume(v, w.exercises, m);
    expect(v.chest).toBe(3);
    expect(v.triceps).toBe(1.5);
    expect(v.back).toBe(0);
  });

  it('volume por semana com os dados reais é coerente', async () => {
    const m = await exMap();
    const all = await db.workouts.toArray();
    const wk = weekStart(new Date(2026, 9, 8).getTime()); // semana de 8 Out 2026
    const v = weeklyVolume(all, m, wk);
    const total = Object.values(v).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(10);
    expect(v.chest).toBeGreaterThanOrEqual(6); // Upper B tem 3 séries de supino inclinado + 3 de fly
  });

  it('backup exporta e restaura tudo', async () => {
    const b = await buildBackup();
    expect(validateBackup(JSON.parse(JSON.stringify(b)))).toBe(true);
    expect(b.workouts).toHaveLength(53);
    await resetAll();
    expect(await db.workouts.count()).toBe(0);
    await restoreBackup(JSON.parse(JSON.stringify(b)));
    expect(await db.workouts.count()).toBe(53);
    expect((await loadSettings()).activeWorkoutId).toBeNull();
    expect(await db.routines.count()).toBe(4);
  });

  it('partilha de rotina: codifica → descodifica sem perdas', async () => {
    const m = await exMap();
    const r = (await db.routines.toArray())[3]; // full body com supersérie
    const link = shareLink(encodeRoutine(r, m));
    expect(link).toContain('#/import?d=');
    const data = link.split('d=')[1];
    const dec = decodeRoutine(data, m);
    expect(dec.routine.name).toBe(r.name);
    expect(dec.routine.items.map((i) => [i.exerciseId, i.sets, i.repMin, i.repMax])).toEqual(r.items.map((i) => [i.exerciseId, i.sets, i.repMin, i.repMax]));
    expect(dec.routine.items.filter((i) => i.supersetId)).toHaveLength(2);
    expect(dec.newExercises).toHaveLength(0);
    // exercício personalizado viaja dentro do link
    const custom: Exercise = { id: 'meu-ex', name: 'Meu Exercício', kind: 'weight', primary: 'chest', secondary: ['triceps'], equipment: 'cable', increment: 2.5, repMin: 8, repMax: 12, restSeconds: 90, isCustom: true };
    const m2 = new Map(m); m2.set(custom.id, custom);
    const r2 = { ...r, items: [{ exerciseId: 'meu-ex', sets: 3, repMin: 8, repMax: 12, rirMin: 1, rirMax: 2 }] };
    const dec2 = decodeRoutine(encodeRoutine(r2, m2), m);
    expect(dec2.newExercises.map((e) => e.name)).toEqual(['Meu Exercício']);
  });
});

describe('dupla progressão e alertas', () => {
  const ex: Exercise = { id: 'x', name: 'x', kind: 'weight', primary: 'chest', secondary: [], equipment: 'cable', increment: 2.5, repMin: 8, repMax: 12, restSeconds: 90, isCustom: false };
  const sess = (sets: [number, number, number?][], date = 0): Session => ({
    workout: { name: '', startedAt: date, exercises: [] }, date,
    sets: sets.map(([weight, reps, rir]) => ({ weight, reps, rir, done: true })),
    score: Math.max(...sets.map(([w, r]) => e1rm(w, r)))
  });

  it('sobe a carga quando todas as séries chegam ao topo', () => {
    const s = suggestProgression(ex, sess([[20, 12], [20, 12], [20, 12]]), { repMin: 8, repMax: 12, plannedSets: 3 })!;
    expect(s).toMatchObject({ kind: 'increase', weight: 22.5, reps: 8 });
  });
  it('mantém se falta uma série ao topo', () => {
    const s = suggestProgression(ex, sess([[20, 12], [20, 12], [20, 10]]), { repMin: 8, repMax: 12, plannedSets: 3 })!;
    expect(s).toMatchObject({ kind: 'hold', weight: 20, reps: 11 });
  });
  it('não sobe se fez menos séries do que as previstas', () => {
    const s = suggestProgression(ex, sess([[20, 12], [20, 12]]), { repMin: 8, repMax: 12, plannedSets: 3 })!;
    expect(s.kind).toBe('hold');
  });
  it('sobe 2 incrementos se todas as séries passaram o topo em 2 reps ou mais', () => {
    const s = suggestProgression(ex, sess([[20, 14], [20, 14], [20, 15]]), { repMin: 8, repMax: 12, plannedSets: 3 })!;
    expect(s).toMatchObject({ kind: 'increase', weight: 25, reps: 8, reason: 'top2' });
    expect(suggestProgression(ex, sess([[20, 12], [20, 13], [20, 12]]), { repMin: 8, repMax: 12, plannedSets: 3 })).toMatchObject({ weight: 22.5, reason: 'top' });
  });
  it('sugere descer se ficou abaixo do mínimo de reps em 2 sessões seguidas com a mesma carga', () => {
    const last = sess([[30, 7], [30, 6], [30, 6]], 2);
    const prev = sess([[30, 7], [30, 7], [30, 6]], 1);
    const s = suggestProgression(ex, last, { repMin: 8, repMax: 12, plannedSets: 3, prev })!;
    expect(s).toMatchObject({ kind: 'decrease', weight: 27.5, reps: 10, reason: 'low' });
    // só numa sessão: mantém
    expect(suggestProgression(ex, last, { repMin: 8, repMax: 12, plannedSets: 3 })!.kind).toBe('hold');
    // cargas diferentes nas 2 sessões: mantém
    expect(suggestProgression(ex, last, { repMin: 8, repMax: 12, plannedSets: 3, prev: sess([[27.5, 7], [27.5, 6]], 1) })!.kind).toBe('hold');
  });
  it('meta série a série: manter = repete a série anterior e +1 rep se estava abaixo do topo', () => {
    const last = sess([[20, 12], [20, 9], [20, 8]]);
    const sg = suggestProgression(ex, last, { repMin: 8, repMax: 12, plannedSets: 3 })!;
    expect(setTarget(sg, last, 0, 12)).toEqual({ weight: 20, reps: 12 });
    expect(setTarget(sg, last, 1, 12)).toEqual({ weight: 20, reps: 10 });
    expect(setTarget(sg, last, 2, 12)).toEqual({ weight: 20, reps: 9 });
    expect(setTarget(sg, last, 5, 12)).toEqual({ weight: 20, reps: 9 }); // séries extra usam a última
    const up = suggestProgression(ex, sess([[20, 12], [20, 12], [20, 12]]), { repMin: 8, repMax: 12, plannedSets: 3 })!;
    expect(setTarget(up, last, 1, 12)).toEqual({ weight: 22.5, reps: 8 });
    expect(setTarget(null, last, 0, 12)).toBeUndefined();
  });
  it('carga inicial estimada a partir de um exercício parecido (mesmo músculo e equipamento)', () => {
    const ref: Exercise = { ...ex, id: 'ref', primary: 'chest', equipment: 'cable' };
    const novo: Exercise = { ...ex, id: 'novo', primary: 'chest', equipment: 'cable', repMin: 8, repMax: 12, increment: 2.5 };
    const outro: Exercise = { ...ex, id: 'outro', primary: 'chest', equipment: 'barbell' };
    const m = new Map([ref, novo, outro].map((e) => [e.id, e]));
    const w: Workout = { id: 1, name: 'x', startedAt: 1, endedAt: 2, exercises: [{ exerciseId: 'ref', sets: [{ weight: 40, reps: 10, done: true }] }] };
    const st = startingWeight(novo, [w], m, 8, 12)!;
    expect(st.from).toBe('ref');
    // 1RM ≈ 53,3 kg; 12 reps (meio 10 + 2 de reserva) → ≈ 38 kg → arredonda a 2,5
    expect(st.weight).toBe(37.5);
    expect(startingWeight(outro, [w], m, 8, 12)).toBeUndefined(); // sem equipamento igual com histórico
  });
  it('e1RM (Epley)', () => {
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(100, 10)).toBeCloseTo(133.33, 1);
  });
  it('deteta PR de e1RM e de carga', () => {
    const rec = computeRecords([sess([[20, 10], [20, 8]])]);
    expect(detectPR(ex, rec, { weight: 22.5, reps: 8, done: true })).toEqual(expect.arrayContaining(['weight', 'e1rm']));
    expect(detectPR(ex, rec, { weight: 20, reps: 8, done: true })).toEqual([]);
    expect(detectPR(ex, computeRecords([]), { weight: 100, reps: 5, done: true })).toEqual([]); // 1.ª vez não é PR
  });
  it('estagnação: 4 sessões sem bater o melhor anterior, ao longo de ≥3 semanas', () => {
    const d = (n: number) => n * 7 * DAY_MS;
    const prog = [sess([[20, 10]], d(0)), sess([[20, 12]], d(1)), sess([[22.5, 8]], d(2)), sess([[22.5, 8]], d(3)), sess([[22.5, 7]], d(4)), sess([[22.5, 8]], d(5)), sess([[22.5, 8]], d(6))];
    expect(stagnationSessions(prog)).toBe(4);
    const improving = [...prog.slice(0, 3), sess([[25, 8]], d(3)), sess([[25, 9]], d(4)), sess([[25, 10]], d(5)), sess([[27.5, 8]], d(6))];
    expect(stagnationSessions(improving)).toBe(0);
    expect(stagnationSessions(prog.slice(0, 3))).toBe(0);
  });
  it('sinal de deload: força a descer em ≥3 exercícios durante 2 semanas seguidas', () => {
    const now = Date.now();
    const m = new Map<string, Exercise>();
    const mk = (id: string): Exercise => ({ ...ex, id, name: id });
    const ids = ['a', 'b', 'c', 'd']; ids.forEach((i) => m.set(i, mk(i)));
    const wk = (weeksAgo: number, w: number): Workout => ({
      name: 'w', startedAt: now - (weeksAgo + 0.5) * 7 * DAY_MS, endedAt: now,
      exercises: ids.map((id) => ({ exerciseId: id, sets: [{ weight: w, reps: 10, done: true }] }))
    });
    const declining = [wk(2, 100), wk(1, 95), wk(0, 90)];
    expect(deloadSignal(declining, m, now)?.declining).toHaveLength(4);
    const stable = [wk(2, 100), wk(1, 100), wk(0, 102.5)];
    expect(deloadSignal(stable, m, now)).toBeNull();
    expect(deloadSignal([wk(1, 100), wk(0, 90)], m, now)).toBeNull(); // só uma descida
  });
});

describe('substitutos parecidos', () => {
  const mk = (id: string, primary: Exercise['primary'], equipment: string, secondary: Exercise['secondary'] = []): Exercise =>
    ({ id, name: id, kind: 'weight', primary, secondary, equipment, increment: 2.5, repMin: 6, repMax: 10, restSeconds: 90, isCustom: false }) as Exercise;
  it('ordena por músculo e equipamento', () => {
    const base = mk('a', 'chest', 'barbell', ['triceps']);
    expect(relatedScore(base, mk('b', 'chest', 'barbell'))).toBe(3);
    expect(relatedScore(base, mk('c', 'chest', 'dumbbell'))).toBe(2);
    expect(relatedScore(base, mk('d', 'shoulders', 'cable', ['chest']))).toBe(1);
    expect(relatedScore(base, mk('e', 'quads', 'barbell'))).toBe(0);
    expect(relatedScore(base, base)).toBe(0);
  });
});
