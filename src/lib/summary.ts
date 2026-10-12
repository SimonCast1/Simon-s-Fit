import type { Exercise, Muscle, Settings, Workout } from '../types';
import { MUSCLES } from '../types';
import {
  DAY_MS, addWeeks, bestScore, deloadSignal, exerciseSessions, isWorking, stagnationSessions, weekStart, weekStreak,
  weeklyVolume, workoutDurationSec, workoutPRs, workoutTotals, type VolumeMap, type WorkoutPR
} from './calc';

/** Uma nota do resumo; `key` é uma chave i18n e os restantes campos são variáveis. */
export interface Note {
  key: string;
  n?: number;
  m?: number;
  pct?: number;
  muscles?: Muscle[];
  exerciseId?: string;
}

export interface WeekSummary {
  from: number;
  inProgress: boolean;
  workouts: number;
  sets: number;
  volume: number;
  durationSec: number;
  prev: { workouts: number; sets: number; volume: number };
  muscles: VolumeMap;
  prs: { exerciseId: string; workoutId?: number }[];
  planned: number;
  streak: number;
  good: Note[];
  improve: Note[];
}

/** Treinos por semana planeados: dias distintos nas rotinas (mínimo 2, por defeito 3). */
export function plannedPerWeek(routines: { days: number[] }[]): number {
  const days = new Set<number>();
  routines.forEach((r) => r.days.forEach((d) => days.add(d)));
  return days.size >= 2 ? days.size : 3;
}

function sum(ws: Workout[], exMap: Map<string, Exercise>) {
  let sets = 0;
  let volume = 0;
  let durationSec = 0;
  for (const w of ws) {
    const t = workoutTotals(w, exMap);
    sets += t.sets;
    volume += t.volume;
    durationSec += workoutDurationSec(w);
  }
  return { workouts: ws.length, sets, volume, durationSec };
}

export function weekSummary(
  finished: Workout[],
  exMap: Map<string, Exercise>,
  routines: { days: number[] }[],
  settings: Pick<Settings, 'minSets' | 'lastBackupAt'>,
  from: number,
  now = Date.now()
): WeekSummary {
  const to = addWeeks(from, 1);
  const inProgress = now < to;
  const inWeek = finished.filter((w) => w.startedAt >= from && w.startedAt < to);
  const prevWeek = finished.filter((w) => w.startedAt >= addWeeks(from, -1) && w.startedAt < from);
  const cur = sum(inWeek, exMap);
  const prev = sum(prevWeek, exMap);
  const muscles = weeklyVolume(finished, exMap, from);
  const planned = plannedPerWeek(routines);
  const streak = weekStreak(finished.filter((w) => w.startedAt < to), planned, Math.min(now, to - 1));

  const prs: WeekSummary['prs'] = [];
  for (const w of inWeek) for (const p of workoutPRs(w, finished, exMap)) prs.push({ exerciseId: p.exerciseId, workoutId: w.id });

  const good: Note[] = [];
  const improve: Note[] = [];

  if (cur.workouts === 0) {
    return { from, inProgress, ...cur, prev, muscles, prs, planned, streak, good, improve: [{ key: 'sum.imp.none' }] };
  }

  // consistência
  if (cur.workouts >= planned) good.push({ key: 'sum.good.consistency', n: cur.workouts, m: planned });
  else if (!inProgress) improve.push({ key: 'sum.imp.consistency', n: cur.workouts, m: planned });
  else if (planned - cur.workouts > 0) improve.push({ key: 'sum.imp.consistency.now', n: planned - cur.workouts });
  if (streak >= 2) good.push({ key: 'sum.good.streak', n: streak });

  // recordes
  if (prs.length) good.push({ key: 'sum.good.prs', n: prs.length, exerciseId: prs[0].exerciseId });

  // volume por músculo contra os mínimos
  const reached: Muscle[] = [];
  const short: { m: Muscle; gap: number }[] = [];
  for (const m of MUSCLES) {
    const min = settings.minSets[m];
    if (!min) continue;
    if (muscles[m] >= min) reached.push(m);
    else short.push({ m, gap: min - muscles[m] });
  }
  if (reached.length) good.push({ key: 'sum.good.volume', n: reached.length, muscles: reached.slice(0, 4) });
  short.sort((a, b) => b.gap - a.gap);
  for (const s of short.slice(0, 2)) {
    improve.push({ key: inProgress ? 'sum.imp.muscle.now' : 'sum.imp.muscle', muscles: [s.m], n: Math.ceil(s.gap) });
  }

  // volume contra a semana anterior (só semanas fechadas, para não comparar semana a meio)
  if (!inProgress && prev.sets > 0) {
    const pct = Math.round(((cur.sets - prev.sets) / prev.sets) * 100);
    if (pct >= 5) good.push({ key: 'sum.good.volumeup', pct });
    else if (pct <= -20) improve.push({ key: 'sum.imp.volumedown', pct: Math.abs(pct) });
  }

  // estagnação nos exercícios feitos nesta semana
  const done = new Set<string>();
  inWeek.forEach((w) => w.exercises.forEach((e) => done.add(e.exerciseId)));
  const upTo = finished.filter((w) => w.startedAt < to);
  for (const id of done) {
    const ex = exMap.get(id);
    if (!ex || ex.kind !== 'weight') continue;
    if (stagnationSessions(exerciseSessions(upTo, ex, id)) > 0) {
      improve.push({ key: 'sum.imp.stagnant', exerciseId: id });
      break;
    }
  }

  // deload
  if (inProgress && deloadSignal(finished, exMap, now)) improve.push({ key: 'sum.imp.deload' });

  // backup
  if (inProgress && (!settings.lastBackupAt || now - settings.lastBackupAt > 7 * DAY_MS)) improve.push({ key: 'sum.imp.backup' });

  if (!good.length) good.push({ key: 'sum.good.started' });
  return { from, inProgress, ...cur, prev, muscles, prs, planned, streak, good, improve };
}

/* ---------- análise de um treino ---------- */


export interface ExerciseResult {
  exerciseId: string;
  status: 'up' | 'same' | 'down' | 'new' | 'na';
  pct?: number;
  pr: boolean;
}

export interface WorkoutAnalysis {
  durationSec: number;
  sets: number;
  volume: number;
  prev?: { name: string; sets: number; volume: number; durationSec: number; date: number };
  volumePct: number | null;
  setsPct: number | null;
  results: ExerciseResult[];
  prs: WorkoutPR[];
  planned: number;
  done: number;
  weekMuscles: VolumeMap;
  good: Note[];
  improve: Note[];
}

/**
 * Análise de um treino terminado. `finished` deve incluir o próprio treino.
 * Compara com o treino anterior da mesma rotina (ou do mesmo nome).
 */
export function workoutAnalysis(
  w: Workout,
  finished: Workout[],
  exMap: Map<string, Exercise>,
  settings: Pick<Settings, 'minSets'>
): WorkoutAnalysis {
  const prior = finished.filter((f) => f.id !== w.id && f.startedAt < w.startedAt);
  const tot = workoutTotals(w, exMap);
  const durationSec = workoutDurationSec(w);
  const prevW = prior.find((f) => (w.routineId !== undefined ? f.routineId === w.routineId : f.name === w.name));
  const prevTot = prevW ? workoutTotals(prevW, exMap) : undefined;
  const pct = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 100) : null);
  const volumePct = prevTot ? pct(tot.volume, prevTot.volume) : null;
  const setsPct = prevTot ? pct(tot.sets, prevTot.sets) : null;

  const prs = workoutPRs(w, finished, exMap);
  const prSet = new Set(prs.map((p) => p.exerciseId));

  const results: ExerciseResult[] = [];
  let planned = 0;
  let done = 0;
  for (const we of w.exercises) {
    const ex = exMap.get(we.exerciseId);
    if (!ex) continue;
    const working = we.sets.filter(isWorking);
    if (we.planned !== undefined) {
      planned += we.planned;
      done += Math.min(working.length, we.planned);
    }
    if (ex.kind !== 'weight' && ex.kind !== 'bodyweight') {
      results.push({ exerciseId: ex.id, status: 'na', pr: false });
      continue;
    }
    const sessions = exerciseSessions(prior, ex, ex.id);
    const last = sessions.at(-1);
    const now = bestScore(ex, we.sets);
    if (!last || last.score <= 0) {
      results.push({ exerciseId: ex.id, status: 'new', pr: prSet.has(ex.id) });
      continue;
    }
    const d = ((now - last.score) / last.score) * 100;
    results.push({
      exerciseId: ex.id,
      status: d > 0.5 ? 'up' : d < -1 ? 'down' : 'same',
      pct: Math.round(d * 10) / 10,
      pr: prSet.has(ex.id)
    });
  }

  const weekMuscles = weeklyVolume(finished, exMap, weekStart(w.startedAt));
  const short: Muscle[] = [];
  for (const m of MUSCLES) {
    const min = settings.minSets[m];
    if (min && weekMuscles[m] < min) short.push(m);
  }

  const good: Note[] = [];
  const improve: Note[] = [];
  const ups = results.filter((r) => r.status === 'up');
  const downs = results.filter((r) => r.status === 'down');

  if (prs.length) good.push({ key: 'wsum.good.prs', n: prs.length, exerciseId: prs[0].exerciseId });
  if (ups.length) good.push({ key: 'wsum.good.up', n: ups.length });
  if (volumePct !== null && volumePct >= 5) good.push({ key: 'wsum.good.volumeup', pct: volumePct });
  if (planned > 0 && done >= planned) good.push({ key: 'wsum.good.complete' });
  if (!prevW) good.push({ key: 'wsum.good.first' });

  if (downs.length === 1) improve.push({ key: 'wsum.imp.down1', exerciseId: downs[0].exerciseId });
  else if (downs.length > 1) improve.push({ key: 'wsum.imp.downn', n: downs.length, exerciseId: downs[0].exerciseId });
  if (planned > done) improve.push({ key: 'wsum.imp.skipped', n: planned - done });
  if (volumePct !== null && volumePct <= -15) improve.push({ key: 'wsum.imp.volumedown', pct: Math.abs(volumePct) });
  for (const we of w.exercises) {
    const ex = exMap.get(we.exerciseId);
    if (!ex || ex.kind !== 'weight') continue;
    if (stagnationSessions(exerciseSessions(finished, ex, ex.id)) > 0) {
      improve.push({ key: 'wsum.imp.stagnant', exerciseId: ex.id });
      break;
    }
  }
  if (short.length) improve.push({ key: 'wsum.imp.muscle', muscles: short.slice(0, 3) });
  if (!improve.length) improve.push({ key: 'wsum.imp.none' });

  return {
    durationSec,
    sets: tot.sets,
    volume: tot.volume,
    prev: prevW && prevTot ? { name: prevW.name, sets: prevTot.sets, volume: prevTot.volume, durationSec: workoutDurationSec(prevW), date: prevW.startedAt } : undefined,
    volumePct,
    setsPct,
    results,
    prs,
    planned,
    done,
    weekMuscles,
    good,
    improve
  };
}
