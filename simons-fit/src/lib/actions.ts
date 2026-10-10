import { db, setSetting, loadSettings, initDatabase } from '../db';
import type { Exercise, Routine, SetEntry, Workout, WorkoutExercise } from '../types';
import { buildImport, parseHevyCsv, type ImportOptions } from './hevy';

/* ---------- treinos ---------- */

function blankSet(): SetEntry {
  return { done: false };
}

export async function startWorkout(opts: {
  name: string;
  routine?: Routine;
  exercises?: WorkoutExercise[];
}): Promise<number> {
  const exs = new Map((await db.exercises.toArray()).map((e) => [e.id, e]));
  let exercises: WorkoutExercise[] = opts.exercises ?? [];
  if (opts.routine) {
    exercises = opts.routine.items.map((it) => ({
      exerciseId: it.exerciseId,
      sets: Array.from({ length: it.sets }, blankSet),
      planned: it.sets,
      repMin: it.repMin,
      repMax: it.repMax,
      rir: it.rirMin === it.rirMax ? String(it.rirMin) : `${it.rirMin}–${it.rirMax}`,
      supersetId: it.supersetId
    }));
  }
  // Exercícios que já não existam na biblioteca são ignorados.
  exercises = exercises.filter((e) => exs.has(e.exerciseId));
  const id = (await db.workouts.add({
    name: opts.name,
    routineId: opts.routine?.id,
    startedAt: Date.now(),
    exercises
  })) as number;
  await setSetting('activeWorkoutId', id);
  return id;
}

export async function startFromPast(w: Workout): Promise<number> {
  const exercises: WorkoutExercise[] = w.exercises.map((e) => ({
    exerciseId: e.exerciseId,
    sets: e.sets.filter((s) => !s.warmup).map(blankSet),
    planned: e.sets.filter((s) => !s.warmup).length,
    supersetId: e.supersetId,
    repMin: e.repMin,
    repMax: e.repMax,
    rir: e.rir
  }));
  return startWorkout({ name: w.name, routine: undefined, exercises });
}

export async function patchWorkout(id: number, fn: (w: Workout) => void) {
  await db.transaction('rw', db.workouts, async () => {
    const w = await db.workouts.get(id);
    if (!w) return;
    fn(w);
    await db.workouts.put(w);
  });
}

/** Descarta séries por concluir; termina o treino. Devolve nº de séries descartadas. */
export async function finishWorkout(id: number, { keepEnd = false } = {}): Promise<number> {
  let dropped = 0;
  await patchWorkout(id, (w) => {
    for (const e of w.exercises) {
      const before = e.sets.length;
      e.sets = e.sets.filter((s) => s.done);
      dropped += before - e.sets.length;
    }
    w.exercises = w.exercises.filter((e) => e.sets.length > 0);
    if (!keepEnd || !w.endedAt) w.endedAt = Date.now();
  });
  const s = await loadSettings();
  if (s.activeWorkoutId === id) await setSetting('activeWorkoutId', null);
  return dropped;
}

export async function discardWorkout(id: number) {
  await db.workouts.delete(id);
  const s = await loadSettings();
  if (s.activeWorkoutId === id) await setSetting('activeWorkoutId', null);
}

/* ---------- rotinas ---------- */

export async function saveRoutine(r: Routine): Promise<number> {
  if (r.id === undefined) {
    const count = await db.routines.count();
    return (await db.routines.add({ ...r, order: count })) as number;
  }
  await db.routines.put(r);
  return r.id;
}

export async function deleteRoutine(id: number) {
  await db.routines.delete(id);
}

export async function duplicateRoutine(r: Routine) {
  const count = await db.routines.count();
  const copy: Routine = { ...r, id: undefined, name: `${r.name} (2)`, order: count, seedKey: undefined };
  delete copy.id;
  return (await db.routines.add(copy)) as number;
}

export async function moveRoutine(id: number, dir: -1 | 1) {
  const all = await db.routines.orderBy('order').toArray();
  const i = all.findIndex((r) => r.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= all.length) return;
  [all[i], all[j]] = [all[j], all[i]];
  await db.transaction('rw', db.routines, async () => {
    for (let k = 0; k < all.length; k++) await db.routines.update(all[k].id!, { order: k });
  });
}

/* ---------- exercícios ---------- */

export async function saveExercise(e: Exercise) {
  await db.exercises.put(e);
}

export async function exerciseUsage(id: string): Promise<number> {
  let n = 0;
  await db.workouts.each((w) => {
    if (w.exercises.some((x) => x.exerciseId === id)) n++;
  });
  const rs = await db.routines.toArray();
  n += rs.filter((r) => r.items.some((i) => i.exerciseId === id)).length;
  return n;
}

export async function deleteExercise(id: string) {
  await db.exercises.delete(id);
}

/* ---------- importação do Hevy ---------- */

export interface HevyPreview {
  workouts: number;
  newWorkouts: number;
  duplicates: number;
  sets: number;
  warmups: number;
  newExercises: Exercise[];
  from?: number;
  to?: number;
  warnings: string[];
  _built: ReturnType<typeof buildImport>;
}

export async function previewHevy(text: string, opts: ImportOptions = { detectWarmups: true }): Promise<HevyPreview> {
  const parsed = parseHevyCsv(text);
  const existing = await db.exercises.toArray();
  const built = buildImport(parsed.workouts, existing, opts);
  const keys = new Set((await db.workouts.toArray()).map((w) => w.importKey).filter(Boolean));
  const fresh = built.workouts.filter((w) => !keys.has(w.importKey));
  return {
    workouts: built.workouts.length,
    newWorkouts: fresh.length,
    duplicates: built.workouts.length - fresh.length,
    sets: built.totalSets,
    warmups: built.warmupsMarked,
    newExercises: built.newExercises,
    from: built.workouts[0]?.startedAt,
    to: built.workouts.at(-1)?.startedAt,
    warnings: parsed.warnings,
    _built: built
  };
}

export async function commitHevy(p: HevyPreview): Promise<number> {
  const keys = new Set((await db.workouts.toArray()).map((w) => w.importKey).filter(Boolean));
  const fresh = p._built.workouts.filter((w) => !keys.has(w.importKey));
  await db.transaction('rw', db.workouts, db.exercises, async () => {
    const have = new Set((await db.exercises.toCollection().primaryKeys()) as string[]);
    const addEx = p._built.newExercises.filter((e) => !have.has(e.id));
    if (addEx.length) await db.exercises.bulkAdd(addEx);
    if (fresh.length) await db.workouts.bulkAdd(fresh);
  });
  return fresh.length;
}

/* ---------- backup ---------- */

export interface BackupFile {
  app: 'simons-fit';
  version: 1;
  exportedAt: number;
  exercises: Exercise[];
  routines: Routine[];
  workouts: Workout[];
  settings: Record<string, unknown>;
}

export async function buildBackup(): Promise<BackupFile> {
  const settings = await loadSettings();
  const { activeWorkoutId: _a, lastBackupAt: _l, ...rest } = settings;
  void _a; void _l;
  return {
    app: 'simons-fit',
    version: 1,
    exportedAt: Date.now(),
    exercises: await db.exercises.toArray(),
    routines: await db.routines.toArray(),
    workouts: await db.workouts.toArray(),
    settings: rest as unknown as Record<string, unknown>
  };
}

export async function markBackupDone() {
  await setSetting('lastBackupAt', Date.now());
}

/** Backup num toque: abre a folha de partilha do sistema (Guardar em Ficheiros/iCloud) ou descarrega o ficheiro. */
export async function shareBackup(): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const b = await buildBackup();
  const name = `simons-fit-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([JSON.stringify(b)], name, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      await markBackupDone();
      return 'shared';
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    await markBackupDone();
    return 'downloaded';
  } catch {
    return 'cancelled'; // o utilizador fechou a folha de partilha
  }
}

export function validateBackup(x: unknown): x is BackupFile {
  const b = x as BackupFile;
  return !!b && b.app === 'simons-fit' && Array.isArray(b.workouts) && Array.isArray(b.exercises) && Array.isArray(b.routines);
}

export async function restoreBackup(b: BackupFile) {
  await db.transaction('rw', db.exercises, db.routines, db.workouts, db.settings, async () => {
    await db.exercises.clear();
    await db.routines.clear();
    await db.workouts.clear();
    await db.settings.clear();
    await db.exercises.bulkAdd(b.exercises);
    await db.routines.bulkAdd(b.routines);
    await db.workouts.bulkAdd(b.workouts);
    for (const [k, v] of Object.entries(b.settings ?? {})) await db.settings.put({ key: k, value: v });
    await db.settings.put({ key: 'seeded', value: true });
    await db.settings.put({ key: 'activeWorkoutId', value: null });
    await db.settings.put({ key: 'lastBackupAt', value: Date.now() });
  });
}

export async function resetAll() {
  await db.transaction('rw', db.exercises, db.routines, db.workouts, db.settings, async () => {
    await db.exercises.clear();
    await db.routines.clear();
    await db.workouts.clear();
    await db.settings.clear();
  });
  await initDatabase();
}
