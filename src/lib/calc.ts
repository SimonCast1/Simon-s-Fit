import type { Exercise, Muscle, SetEntry, Workout, WorkoutExercise } from '../types';
import { MUSCLES } from '../types';

export const DAY_MS = 86_400_000;

/* ---------- formatação ---------- */

export function fmtNum(n: number | undefined | null, lang: 'pt' | 'en' = 'pt', digits = 1): string {
  if (n === undefined || n === null || Number.isNaN(n)) return '–';
  const s = Number(n.toFixed(digits)).toString();
  return lang === 'pt' ? s.replace('.', ',') : s;
}

export function fmtDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  return `${m}:${String(r).padStart(2, '0')}`;
}

/** Parse tolerante a vírgula decimal. */
export function parseNum(v: string): number | undefined {
  const t = v.trim().replace(',', '.');
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/* ---------- séries ---------- */

export function isWorking(s: SetEntry): boolean {
  return s.done && !s.warmup;
}

export function e1rm(weight: number | undefined, reps: number | undefined): number {
  if (!weight || !reps || weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30); // Epley
}

/** Métrica de força de uma série, comparável ao longo do tempo. */
export function setScore(ex: Exercise | undefined, s: SetEntry): number {
  if (!ex) return e1rm(s.weight, s.reps);
  switch (ex.kind) {
    case 'weight':
      return e1rm(s.weight, s.reps);
    case 'bodyweight':
      return (s.reps ?? 0) + (s.weight ?? 0) * 0.4;
    case 'time':
      return s.durationSec ?? 0;
    case 'cardio':
      return s.distanceKm ?? s.durationSec ?? 0;
  }
}

export function bestScore(ex: Exercise | undefined, sets: SetEntry[]): number {
  let b = 0;
  for (const s of sets) if (isWorking(s)) b = Math.max(b, setScore(ex, s));
  return b;
}

/* ---------- semanas ---------- */

export function weekStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // segunda = 0
  d.setDate(d.getDate() - dow);
  return d.getTime();
}

export function addWeeks(ts: number, n: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + n * 7);
  return d.getTime();
}

/* ---------- volume semanal (contagem fracionada) ---------- */

export type VolumeMap = Record<Muscle, number>;

export function emptyVolume(): VolumeMap {
  const v = {} as VolumeMap;
  for (const m of MUSCLES) v[m] = 0;
  return v;
}

export function addWorkoutVolume(
  vol: VolumeMap,
  we: WorkoutExercise[],
  exMap: Map<string, Exercise>,
  includeUndone = false
) {
  for (const item of we) {
    const ex = exMap.get(item.exerciseId);
    if (!ex) continue;
    const n = item.sets.filter((s) => !s.warmup && (includeUndone || s.done)).length;
    if (!n) continue;
    if (ex.primary) vol[ex.primary] += n;
    for (const m of ex.secondary) vol[m] += n * 0.5;
  }
}

export function weeklyVolume(
  workouts: Workout[],
  exMap: Map<string, Exercise>,
  from: number,
  to = addWeeks(from, 1)
): VolumeMap {
  const vol = emptyVolume();
  for (const w of workouts) {
    if (w.startedAt >= from && w.startedAt < to) addWorkoutVolume(vol, w.exercises, exMap);
  }
  return vol;
}

/* ---------- histórico por exercício ---------- */

export interface Session {
  workout: Workout;
  date: number;
  sets: SetEntry[]; // séries feitas, sem aquecimento
  score: number;
}

/** Sessões de um exercício, da mais antiga para a mais recente. */
export function exerciseSessions(
  workouts: Workout[],
  ex: Exercise | undefined,
  exerciseId: string
): Session[] {
  const out: Session[] = [];
  for (const w of workouts) {
    if (!w.endedAt) continue;
    const sets: SetEntry[] = [];
    for (const item of w.exercises) {
      if (item.exerciseId === exerciseId) sets.push(...item.sets.filter(isWorking));
    }
    if (sets.length) out.push({ workout: w, date: w.startedAt, sets, score: bestScore(ex, sets) });
  }
  return out.sort((a, b) => a.date - b.date);
}

/** Última sessão (a mais recente) anterior a `before`. */
export function lastSession(
  workouts: Workout[],
  ex: Exercise | undefined,
  exerciseId: string,
  excludeWorkoutId?: number
): Session | undefined {
  let best: Session | undefined;
  for (const w of workouts) {
    if (!w.endedAt || w.id === excludeWorkoutId) continue;
    if (best && w.startedAt <= best.date) continue;
    const sets: SetEntry[] = [];
    for (const item of w.exercises) {
      if (item.exerciseId === exerciseId) sets.push(...item.sets.filter(isWorking));
    }
    if (sets.length) best = { workout: w, date: w.startedAt, sets, score: bestScore(ex, sets) };
  }
  return best;
}

/* ---------- recordes ---------- */

export interface Records {
  bestWeight: { value: number; reps: number; date: number } | null;
  bestE1rm: { value: number; date: number } | null;
  bestReps: { value: number; weight: number; date: number } | null;
  bestSetVolume: { value: number; weight: number; reps: number; date: number } | null;
  sessions: number;
}

export function computeRecords(sessions: Session[]): Records {
  const r: Records = { bestWeight: null, bestE1rm: null, bestReps: null, bestSetVolume: null, sessions: sessions.length };
  for (const s of sessions) {
    for (const set of s.sets) {
      const w = set.weight ?? 0;
      const reps = set.reps ?? 0;
      if (w > 0 && reps > 0) {
        if (!r.bestWeight || w > r.bestWeight.value) r.bestWeight = { value: w, reps, date: s.date };
        const e = e1rm(w, reps);
        if (!r.bestE1rm || e > r.bestE1rm.value) r.bestE1rm = { value: e, date: s.date };
        const v = w * reps;
        if (!r.bestSetVolume || v > r.bestSetVolume.value) r.bestSetVolume = { value: v, weight: w, reps, date: s.date };
      }
      if (reps > 0 && (!r.bestReps || reps > r.bestReps.value)) r.bestReps = { value: reps, weight: w, date: s.date };
    }
  }
  return r;
}

export type PRKind = 'weight' | 'e1rm' | 'reps';

/** Verifica se uma série acabada de concluir bate algum recorde anterior. */
export function detectPR(ex: Exercise | undefined, prior: Records, set: SetEntry): PRKind[] {
  if (!ex || !set.reps) return [];
  const out: PRKind[] = [];
  const w = set.weight ?? 0;
  const hasHistory = prior.sessions > 0;
  if (!hasHistory) return [];
  if (ex.kind === 'weight' && w > 0) {
    if (prior.bestWeight && w > prior.bestWeight.value) out.push('weight');
    if (prior.bestE1rm && e1rm(w, set.reps) > prior.bestE1rm.value + 0.01) out.push('e1rm');
  } else if (ex.kind === 'bodyweight') {
    if (prior.bestReps && set.reps > prior.bestReps.value && w >= prior.bestReps.weight) out.push('reps');
  }
  return out;
}

/* ---------- dupla progressão ---------- */

export type SuggestionReason = 'top' | 'top2' | 'reps' | 'low';

export interface Suggestion {
  kind: 'increase' | 'hold' | 'decrease';
  /** carga alvo da série mais pesada */
  weight: number;
  /** reps alvo dessa série */
  reps: number;
  /** na dupla progressão com peso corporal, indica carga extra a adicionar */
  extra?: boolean;
  /** porquê: bateu o topo (top), bateu o topo com reps de sobra (top2), falta chegar ao topo (reps), abaixo do mínimo em 2 sessões (low) */
  reason: SuggestionReason;
  /** carga da última sessão (para explicar a meta) */
  from: number;
  /** reps mínimas do intervalo (para a razão "low") */
  min: number;
}

function topStats(sets: SetEntry[]) {
  const top = Math.max(...sets.map((s) => s.weight ?? 0));
  const atTop = sets.filter((s) => (s.weight ?? 0) === top);
  return { top, minReps: Math.min(...atTop.map((s) => s.reps ?? 0)) };
}

/**
 * Dupla progressão sem RIR:
 *  - subir: todas as séries no topo das reps (e pelo menos as séries previstas). Se todas passaram
 *    o topo em 2 reps ou mais, sobe 2 incrementos;
 *  - descer: nas 2 últimas sessões, com a mesma carga, a série mais fraca ficou abaixo do mínimo;
 *  - manter: carga igual e +1 rep na série mais fraca.
 */
export function suggestProgression(
  ex: Exercise,
  last: Session | undefined,
  opts: { repMin: number; repMax: number; plannedSets?: number; prev?: Session }
): Suggestion | null {
  if (!last || (ex.kind !== 'weight' && ex.kind !== 'bodyweight')) return null;
  const sets = last.sets.filter((s) => (s.reps ?? 0) > 0);
  if (!sets.length) return null;
  const { top: topWeight, minReps } = topStats(sets);
  const planned = opts.plannedSets ?? sets.length;
  const allAtTop = sets.every((s) => (s.reps ?? 0) >= opts.repMax);
  const inc = ex.increment || 2.5;
  const base = { from: topWeight, min: opts.repMin };

  if (allAtTop && sets.length >= planned) {
    const surplus = ex.kind === 'weight' && sets.every((s) => (s.reps ?? 0) >= opts.repMax + 2);
    const steps = surplus ? 2 : 1;
    return {
      kind: 'increase',
      weight: Number((topWeight + inc * steps).toFixed(2)),
      reps: opts.repMin,
      extra: ex.kind === 'bodyweight',
      reason: surplus ? 'top2' : 'top',
      ...base
    };
  }

  if (ex.kind === 'weight' && topWeight > 0 && opts.prev) {
    const prevSets = opts.prev.sets.filter((s) => (s.reps ?? 0) > 0);
    if (prevSets.length) {
      const p = topStats(prevSets);
      if (p.top === topWeight && minReps < opts.repMin && p.minReps < opts.repMin && topWeight - inc > 0) {
        return {
          kind: 'decrease',
          weight: Number((topWeight - inc).toFixed(2)),
          reps: Math.round((opts.repMin + opts.repMax) / 2),
          reason: 'low',
          ...base
        };
      }
    }
  }

  return { kind: 'hold', weight: topWeight, reps: Math.min(opts.repMax, minReps + 1), reason: 'reps', ...base };
}

export interface SetTarget {
  weight: number;
  reps: number;
}

/**
 * Meta de cada série de trabalho (índice 0 = primeira série sem aquecimento).
 * Subir/descer: todas as séries com a nova carga. Manter: cada série repete a da última vez
 * (+1 rep se estava abaixo do topo e com a carga mais alta).
 */
export function setTarget(
  sugg: Suggestion | null,
  last: Session | undefined,
  workingIndex: number,
  repMax: number
): SetTarget | undefined {
  if (!sugg || !last) return undefined;
  if (sugg.kind !== 'hold') return { weight: sugg.weight, reps: sugg.reps };
  const sets = last.sets.filter((s) => (s.reps ?? 0) > 0);
  if (!sets.length) return undefined;
  const ls = sets[Math.min(workingIndex, sets.length - 1)];
  const w = ls.weight ?? 0;
  const r = ls.reps ?? 0;
  const isTop = w === sugg.from;
  return { weight: w, reps: isTop && r < repMax ? r + 1 : r };
}

/**
 * Carga inicial estimada para um exercício sem histórico, a partir do 1RM estimado de exercícios
 * parecidos (mesmo músculo principal e mesmo equipamento) que já foram feitos. Devolve undefined
 * se não houver referência.
 */
export function startingWeight(
  ex: Exercise,
  workouts: Workout[],
  exMap: Map<string, Exercise>,
  repMin: number,
  repMax: number
): { weight: number; from: string } | undefined {
  if (ex.kind !== 'weight' || !ex.primary) return undefined;
  let best: { e: number; id: string } | undefined;
  for (const o of exMap.values()) {
    if (o.id === ex.id || o.kind !== 'weight' || o.primary !== ex.primary || o.equipment !== ex.equipment) continue;
    const sessions = exerciseSessions(workouts, o, o.id);
    const rec = computeRecords(sessions);
    if (rec.bestE1rm && (!best || rec.bestE1rm.value > best.e)) best = { e: rec.bestE1rm.value, id: o.id };
  }
  if (!best) return undefined;
  // deixa ~2 reps de reserva no meio do intervalo
  const reps = (repMin + repMax) / 2 + 2;
  const raw = best.e / (1 + reps / 30);
  const inc = ex.increment || 2.5;
  const w = Math.max(inc, Math.round(raw / inc) * inc);
  return { weight: Number(w.toFixed(2)), from: best.id };
}

/* ---------- estagnação e deload ---------- */

/** Devolve o nº de sessões sem bater o melhor anterior, ou 0 se não estagnou. */
export function stagnationSessions(sessions: Session[], minSessions = 4, minDays = 21): number {
  if (sessions.length < minSessions) return 0;
  const recent = sessions.slice(-minSessions);
  const earlier = sessions.slice(0, -minSessions);
  const span = recent[recent.length - 1].date - recent[0].date;
  if (span < minDays * DAY_MS) return 0;
  const baseline = earlier.length ? Math.max(...earlier.map((s) => s.score)) : recent[0].score;
  const bestRecent = Math.max(...recent.slice(earlier.length ? 0 : 1).map((s) => s.score));
  if (baseline <= 0) return 0;
  return bestRecent <= baseline * 1.005 ? minSessions : 0;
}

export interface DeloadSignal {
  declining: string[]; // ids
  eligible: number;
}

/** Força a descer em vários exercícios durante duas semanas seguidas (janelas móveis de 7 dias). */
export function deloadSignal(
  workouts: Workout[],
  exMap: Map<string, Exercise>,
  now = Date.now()
): DeloadSignal | null {
  const windows = [0, 1, 2].map((i) => ({ from: now - (i + 1) * 7 * DAY_MS, to: now - i * 7 * DAY_MS }));
  const best: Map<string, number[]> = new Map();
  for (const w of workouts) {
    if (!w.endedAt) continue;
    const wi = windows.findIndex((x) => w.startedAt >= x.from && w.startedAt < x.to);
    if (wi < 0) continue;
    for (const item of w.exercises) {
      const ex = exMap.get(item.exerciseId);
      if (!ex || (ex.kind !== 'weight' && ex.kind !== 'bodyweight')) continue;
      const sc = bestScore(ex, item.sets);
      if (sc <= 0) continue;
      const arr = best.get(item.exerciseId) ?? [0, 0, 0];
      arr[wi] = Math.max(arr[wi], sc);
      best.set(item.exerciseId, arr);
    }
  }
  let eligible = 0;
  const declining: string[] = [];
  for (const [id, [w0, w1, w2]] of best) {
    if (w0 > 0 && w1 > 0 && w2 > 0) {
      eligible++;
      if (w2 > w1 * 1.01 && w1 > w0 * 1.01) declining.push(id);
    }
  }
  if (eligible >= 3 && declining.length >= 3 && declining.length / eligible >= 0.4) {
    return { declining, eligible };
  }
  return null;
}

/* ---------- utilitários de treino ---------- */

export function workoutDurationSec(w: Workout): number {
  return Math.max(0, Math.round(((w.endedAt ?? Date.now()) - w.startedAt) / 1000));
}

export function workoutTotals(w: Workout, exMap: Map<string, Exercise>) {
  let sets = 0;
  let volume = 0;
  for (const item of w.exercises) {
    const ex = exMap.get(item.exerciseId);
    for (const s of item.sets) {
      if (!s.done || s.warmup) continue;
      sets++;
      if (ex?.kind === 'weight' && s.weight && s.reps) volume += s.weight * s.reps;
    }
  }
  return { sets, volume };
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/* ---------- PRs de um treino ---------- */

export interface WorkoutPR {
  exerciseId: string;
  setIndex: number;
  kinds: PRKind[];
}

/** Melhor série com recorde de cada exercício, comparada com tudo o que veio antes do treino. */
export function workoutPRs(w: Workout, all: Workout[], exMap: Map<string, Exercise>): WorkoutPR[] {
  const prior = all.filter((f) => f.startedAt < w.startedAt);
  const out: WorkoutPR[] = [];
  for (const we of w.exercises) {
    const ex = exMap.get(we.exerciseId);
    if (!ex) continue;
    const rec = computeRecords(exerciseSessions(prior, ex, ex.id));
    let best = -1;
    let idx = -1;
    let kinds: PRKind[] = [];
    we.sets.forEach((s, i) => {
      if (!isWorking(s)) return;
      const k = detectPR(ex, rec, s);
      if (k.length && setScore(ex, s) > best) {
        best = setScore(ex, s);
        idx = i;
        kinds = k;
      }
    });
    if (idx >= 0) out.push({ exerciseId: we.exerciseId, setIndex: idx, kinds });
  }
  return out;
}

/* ---------- calendário e consistência ---------- */

export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Treinos agrupados por dia do mês (1–31) num dado mês (month 0–11). */
export function workoutsByDay(workouts: Workout[], year: number, month: number): Map<number, Workout[]> {
  const m = new Map<number, Workout[]>();
  for (const w of workouts) {
    const d = new Date(w.startedAt);
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;
    m.set(d.getDate(), [...(m.get(d.getDate()) ?? []), w]);
  }
  return m;
}

/**
 * Semanas seguidas com pelo menos `minPerWeek` treinos. A semana atual só conta
 * se já cumpriu a meta; se ainda não cumpriu, não quebra a sequência.
 */
export function weekStreak(workouts: Workout[], minPerWeek: number, now = Date.now()): number {
  if (minPerWeek < 1) return 0;
  const counts = new Map<number, number>();
  for (const w of workouts) {
    const k = weekStart(w.startedAt);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let wk = weekStart(now);
  let streak = 0;
  if ((counts.get(wk) ?? 0) >= minPerWeek) streak++;
  for (;;) {
    wk = weekStart(wk - 1);
    if ((counts.get(wk) ?? 0) >= minPerWeek) streak++;
    else break;
  }
  return streak;
}

/* ---------- volume semanal do plano (rotinas) ---------- */

/** Séries por semana e por músculo que as rotinas dão (indiretas ×0,5). */
export function planVolume(routines: { items: { exerciseId: string; sets: number }[] }[], exMap: Map<string, Exercise>): VolumeMap {
  const vol = emptyVolume();
  for (const r of routines) {
    for (const it of r.items) {
      const ex = exMap.get(it.exerciseId);
      if (!ex) continue;
      if (ex.primary) vol[ex.primary] += it.sets;
      for (const m of ex.secondary) vol[m] += it.sets * 0.5;
    }
  }
  return vol;
}


/** Quão parecido é `b` de `a` (para sugerir substitutos): 3 = mesmo músculo e equipamento, 2 = mesmo músculo, 1 = músculo em comum, 0 = nada. */
export function relatedScore(a: Exercise, b: Exercise): number {
  if (a.id === b.id || !a.primary) return 0;
  if (b.primary === a.primary) return b.equipment === a.equipment ? 3 : 2;
  if (b.secondary.includes(a.primary) || (b.primary && a.secondary.includes(b.primary))) return 1;
  return 0;
}
