import type { Exercise, SetEntry, Workout, WorkoutExercise } from '../types';
import { guessExercise, slug } from '../data/exercises';

/* ---------- CSV ---------- */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQ = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQ) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') {
      row.push(cur);
      cur = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cur);
      cur = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else cur += c;
  }
  if (cur !== '' || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

/* ---------- datas ---------- */

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, fev: 1, mar: 2, apr: 3, abr: 3, may: 4, mai: 4, jun: 5, jul: 6,
  aug: 7, ago: 7, sep: 8, set: 8, oct: 9, out: 9, nov: 10, dec: 11, dez: 11
};

export function parseHevyDate(s: string): number | null {
  const t = s.trim();
  let m = t.match(/^(\d{1,2})\s+([A-Za-zçÇ]{3,4})\.?,?\s+(\d{4}),?\s+(\d{1,2}):(\d{2})/);
  if (m) {
    const mon = MONTHS[m[2].toLowerCase().slice(0, 3)];
    if (mon !== undefined) return new Date(+m[3], mon, +m[1], +m[4], +m[5]).getTime();
  }
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime();
  return null;
}

/* ---------- parser ---------- */

export interface ParsedSet {
  weight?: number;
  reps?: number;
  durationSec?: number;
  distanceKm?: number;
  rpe?: number;
  type: string;
}
export interface ParsedExercise {
  name: string;
  sets: ParsedSet[];
  supersetId?: string;
  note?: string;
}
export interface ParsedWorkout {
  title: string;
  startedAt: number;
  endedAt: number;
  description?: string;
  exercises: ParsedExercise[];
}
export interface ParseResult {
  workouts: ParsedWorkout[];
  warnings: string[];
  rows: number;
}

const LB = 0.45359237;
const MI = 1.609344;

function num(v: string | undefined): number | undefined {
  if (v === undefined) return undefined;
  const t = v.trim().replace(',', '.');
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

export function parseHevyCsv(text: string): ParseResult {
  const table = parseCsv(text);
  const warnings: string[] = [];
  if (table.length < 2) return { workouts: [], warnings: ['empty'], rows: 0 };
  const header = table[0].map((h) => h.trim().toLowerCase());
  const col = (n: string) => header.indexOf(n);
  const need = ['title', 'start_time', 'exercise_title'];
  for (const n of need) {
    if (col(n) < 0) return { workouts: [], warnings: [`missing:${n}`], rows: 0 };
  }
  const cTitle = col('title'), cStart = col('start_time'), cEnd = col('end_time');
  const cDesc = col('description'), cEx = col('exercise_title'), cSs = col('superset_id');
  const cNote = col('exercise_notes'), cType = col('set_type');
  const cKg = col('weight_kg'), cLb = col('weight_lbs');
  const cReps = col('reps'), cKm = col('distance_km'), cMi = col('distance_miles');
  const cDur = col('duration_seconds'), cRpe = col('rpe');

  const byKey = new Map<string, ParsedWorkout>();
  const lastBlock = new Map<string, { name: string; ex: ParsedExercise }>();
  let skipped = 0;

  for (let r = 1; r < table.length; r++) {
    const row = table[r];
    const get = (c: number) => (c >= 0 ? row[c] : undefined);
    const start = parseHevyDate(get(cStart) ?? '');
    const name = (get(cEx) ?? '').trim();
    if (start === null || !name) {
      skipped++;
      continue;
    }
    const end = (cEnd >= 0 ? parseHevyDate(row[cEnd] ?? '') : null) ?? start;
    const title = (get(cTitle) ?? '').trim() || 'Workout';
    const key = `${start}|${end}|${title}`;
    let w = byKey.get(key);
    if (!w) {
      w = { title, startedAt: start, endedAt: end, description: (get(cDesc) ?? '').trim() || undefined, exercises: [] };
      byKey.set(key, w);
    }
    let block = lastBlock.get(key);
    if (!block || block.name !== name) {
      const ex: ParsedExercise = {
        name,
        sets: [],
        supersetId: (get(cSs) ?? '').trim() || undefined,
        note: (get(cNote) ?? '').trim() || undefined
      };
      w.exercises.push(ex);
      block = { name, ex };
      lastBlock.set(key, block);
    }
    let weight = num(get(cKg));
    if (weight === undefined && cLb >= 0) {
      const lb = num(get(cLb));
      if (lb !== undefined) weight = Number((lb * LB).toFixed(2));
    }
    let dist = num(get(cKm));
    if (dist === undefined && cMi >= 0) {
      const mi = num(get(cMi));
      if (mi !== undefined) dist = Number((mi * MI).toFixed(3));
    }
    block.ex.sets.push({
      weight,
      reps: num(get(cReps)),
      durationSec: num(get(cDur)),
      distanceKm: dist,
      rpe: num(get(cRpe)),
      type: ((get(cType) ?? 'normal').trim() || 'normal').toLowerCase()
    });
  }
  if (skipped) warnings.push(`skipped:${skipped}`);
  const workouts = [...byKey.values()].sort((a, b) => a.startedAt - b.startedAt);
  return { workouts, warnings, rows: table.length - 1 };
}

/* ---------- conversão para o modelo da app ---------- */

export interface BuiltImport {
  workouts: Workout[];
  newExercises: Exercise[];
  matched: number;
  totalSets: number;
  /** séries iniciais leves reclassificadas como aquecimento */
  warmupsMarked: number;
}

export interface ImportOptions {
  /** Marca como aquecimento as séries iniciais com ≤65 % da carga máxima do exercício nessa sessão. */
  detectWarmups?: boolean;
}

export const WARMUP_RATIO = 0.65;

function refineKind(ex: Exercise, sets: ParsedSet[]) {
  const anyReps = sets.some((s) => (s.reps ?? 0) > 0);
  const anyDur = sets.some((s) => (s.durationSec ?? 0) > 0);
  const anyDist = sets.some((s) => (s.distanceKm ?? 0) > 0);
  const anyWeight = sets.some((s) => (s.weight ?? 0) > 0);
  if (!anyReps && anyDist) ex.kind = 'cardio';
  else if (!anyReps && anyDur) ex.kind = ex.kind === 'cardio' ? 'cardio' : 'time';
  else if (ex.kind === 'weight' && anyReps && !anyWeight) ex.kind = 'bodyweight';
  if (ex.kind === 'cardio' || ex.kind === 'time') ex.increment = 0;
}

export function buildImport(parsed: ParsedWorkout[], existing: Exercise[], opts: ImportOptions = {}): BuiltImport {
  const known = new Map(existing.map((e) => [e.id, e]));
  const newEx = new Map<string, Exercise>();
  let matched = 0;
  let totalSets = 0;
  let warmupsMarked = 0;

  const resolve = (name: string, sets: ParsedSet[]): Exercise => {
    const id = slug(name);
    const hit = known.get(id) ?? newEx.get(id);
    if (hit) {
      if (known.has(id)) matched++;
      return hit;
    }
    const g = guessExercise(name);
    refineKind(g, sets);
    newEx.set(id, g);
    return g;
  };

  const workouts: Workout[] = parsed.map((pw) => {
    const exercises: WorkoutExercise[] = pw.exercises.map((pe) => {
      const ex = resolve(pe.name, pe.sets);
      const sets: SetEntry[] = pe.sets.map((s) => {
        totalSets++;
        const set: SetEntry = { done: true };
        if (s.weight !== undefined) set.weight = s.weight;
        if (s.reps !== undefined) set.reps = s.reps;
        if (s.durationSec !== undefined) set.durationSec = s.durationSec;
        if (s.distanceKm !== undefined) set.distanceKm = s.distanceKm;
        if (s.rpe !== undefined) set.rir = Math.max(0, Math.round(10 - s.rpe));
        if (s.type === 'warmup') set.warmup = true;
        return set;
      });
      if (opts.detectWarmups && ex.kind === 'weight' && sets.length >= 2) {
        const max = Math.max(...sets.map((x) => x.weight ?? 0));
        // só séries iniciais consecutivas (no máximo 2) e deixa sempre ≥1 série de trabalho
        for (let i = 0; i < Math.min(2, sets.length - 1); i++) {
          const wgt = sets[i].weight ?? 0;
          if (max > 0 && wgt > 0 && wgt <= max * WARMUP_RATIO && !sets[i].warmup) {
            sets[i].warmup = true;
            warmupsMarked++;
          } else break;
        }
      }
      const we: WorkoutExercise = { exerciseId: ex.id, sets };
      if (pe.supersetId) we.supersetId = `hevy-${pe.supersetId}`;
      if (pe.note) we.note = pe.note;
      return we;
    });
    return {
      name: pw.title,
      startedAt: pw.startedAt,
      endedAt: Math.max(pw.endedAt, pw.startedAt),
      notes: pw.description,
      exercises,
      importKey: `hevy|${pw.startedAt}|${pw.title}`
    };
  });

  return { workouts, newExercises: [...newEx.values()], matched, totalSets, warmupsMarked };
}
