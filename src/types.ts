export type Muscle =
  | 'chest'
  | 'back'
  | 'sideDelts'
  | 'rearDelts'
  | 'biceps'
  | 'triceps'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'abs'
  | 'adductors';

export const MUSCLES: Muscle[] = [
  'chest',
  'back',
  'sideDelts',
  'rearDelts',
  'biceps',
  'triceps',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'abs',
  'adductors'
];

/**
 * weight      – carga × reps
 * bodyweight  – reps (+ carga extra opcional)
 * time        – duração (prancha)
 * cardio      – duração + distância
 */
export type ExerciseKind = 'weight' | 'bodyweight' | 'time' | 'cardio';

export interface Exercise {
  id: string;
  /** Nome em inglês (igual ao nome usado pelo Hevy, para a importação casar). */
  name: string;
  /** Nome em português europeu (opcional). */
  namePt?: string;
  kind: ExerciseKind;
  primary: Muscle | null;
  secondary: Muscle[];
  equipment: string;
  /** Incremento de carga em kg (dupla progressão). */
  increment: number;
  repMin: number;
  repMax: number;
  /** Descanso por defeito em segundos. */
  restSeconds: number;
  isCustom: boolean;
  /** true => foi criado automaticamente pela importação e ainda não foi revisto. */
  autoCreated?: boolean;
}

export interface SetEntry {
  weight?: number; // kg (carga extra no peso corporal)
  reps?: number;
  rir?: number;
  durationSec?: number;
  distanceKm?: number;
  done: boolean;
  warmup?: boolean;
}

export interface WorkoutExercise {
  exerciseId: string;
  sets: SetEntry[];
  supersetId?: string;
  note?: string;
  /** Meta da rotina para este exercício (para a dupla progressão). */
  repMin?: number;
  repMax?: number;
  rir?: string; // ex. "1-2"
  /** nº de séries previstas pela rotina */
  planned?: number;
  /** exercício original, se este foi trocado durante o treino */
  replacedFrom?: string;
}

export interface Workout {
  id?: number;
  name: string;
  routineId?: number;
  startedAt: number; // epoch ms
  endedAt?: number;
  notes?: string;
  exercises: WorkoutExercise[];
  /** chave para evitar duplicar importações do Hevy */
  importKey?: string;
}

export interface RoutineItem {
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  rirMin: number;
  rirMax: number;
  supersetId?: string;
}

export interface Routine {
  id?: number;
  name: string;
  order: number;
  /** dias da semana (0=domingo … 6=sábado) em que é sugerida */
  days: number[];
  items: RoutineItem[];
  seedKey?: string;
}

export interface SettingRow {
  key: string;
  value: unknown;
}

export interface Settings {
  lang: 'pt' | 'en';
  restCompound: number;
  restIsolation: number;
  sound: boolean;
  vibrate: boolean;
  keepAwake: boolean;
  lastBackupAt: number | null;
  activeWorkoutId: number | null;
  seeded: boolean;
  minSets: Partial<Record<Muscle, number>>;
}

export const DEFAULT_SETTINGS: Settings = {
  lang: 'pt',
  restCompound: 150,
  restIsolation: 90,
  sound: true,
  vibrate: true,
  keepAwake: true,
  lastBackupAt: null,
  activeWorkoutId: null,
  seeded: false,
  minSets: {
    chest: 10,
    back: 10,
    sideDelts: 10,
    rearDelts: 6,
    biceps: 8,
    triceps: 8,
    quads: 8,
    hamstrings: 8
  }
};
