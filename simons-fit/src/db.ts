import Dexie, { type Table } from 'dexie';
import {
  DEFAULT_SETTINGS,
  type Exercise,
  type Routine,
  type SettingRow,
  type Settings,
  type Workout
} from './types';
import { BASE_EXERCISES } from './data/exercises';
import { SEED_ROUTINES } from './data/routines';

class FitDB extends Dexie {
  exercises!: Table<Exercise, string>;
  routines!: Table<Routine, number>;
  workouts!: Table<Workout, number>;
  settings!: Table<SettingRow, string>;

  constructor() {
    super('simons-fit');
    this.version(1).stores({
      exercises: 'id, name, primary',
      routines: '++id, order, seedKey',
      workouts: '++id, startedAt, endedAt, importKey',
      settings: 'key'
    });
  }
}

export const db = new FitDB();

export async function loadSettings(): Promise<Settings> {
  const rows = await db.settings.toArray();
  const out: Settings = { ...DEFAULT_SETTINGS, minSets: { ...DEFAULT_SETTINGS.minSets } };
  for (const r of rows) (out as unknown as Record<string, unknown>)[r.key] = r.value;
  return out;
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  await db.settings.put({ key, value });
}

/** Cria a biblioteca e as rotinas na primeira execução; nas seguintes só acrescenta exercícios novos. */
export async function initDatabase() {
  const have = new Set((await db.exercises.toCollection().primaryKeys()) as string[]);
  const missing = BASE_EXERCISES.filter((e) => !have.has(e.id));
  if (missing.length) await db.exercises.bulkAdd(missing);

  const seeded = (await db.settings.get('seeded'))?.value === true;
  if (!seeded) {
    if ((await db.routines.count()) === 0) await db.routines.bulkAdd(SEED_ROUTINES as Routine[]);
    await setSetting('seeded', true);
  }
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* ignore */
  }
}

export async function ensureExercises(list: Exercise[]) {
  const existing = new Set((await db.exercises.toCollection().primaryKeys()) as string[]);
  const toAdd = list.filter((e) => !existing.has(e.id));
  if (toAdd.length) await db.exercises.bulkAdd(toAdd);
  return toAdd.length;
}
