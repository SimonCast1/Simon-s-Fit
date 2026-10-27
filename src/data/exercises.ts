import type { Exercise, ExerciseKind, Muscle } from '../types';
import { EXTRA_SPECS } from './exercises-extra';

export function slug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type Spec = [
  name: string,
  namePt: string,
  kind: ExerciseKind,
  primary: Muscle | null,
  secondary: Muscle[],
  equipment: string,
  compound?: boolean
];

/**
 * Biblioteca base. Os nomes em inglês coincidem com os do Hevy, para o
 * importador reconhecer os exercícios sem criar duplicados.
 * Contagem fracionada (documento 1): primário = 1 série, secundário = 0,5.
 */
const SPECS: Spec[] = [
  // Peito
  ['Bench Press (Barbell)', 'Supino com Barra', 'weight', 'chest', ['triceps'], 'barbell', true],
  ['Bench Press (Dumbbell)', 'Supino com Halteres', 'weight', 'chest', ['triceps'], 'dumbbell', true],
  ['Incline Bench Press (Barbell)', 'Supino Inclinado com Barra', 'weight', 'chest', ['triceps'], 'barbell', true],
  ['Incline Bench Press (Dumbbell)', 'Supino Inclinado com Halteres', 'weight', 'chest', ['triceps'], 'dumbbell', true],
  ['Chest Press (Machine)', 'Press de Peito (Máquina)', 'weight', 'chest', ['triceps'], 'machine', true],
  ['Chest Dip', 'Paralelas (Peito)', 'bodyweight', 'chest', ['triceps'], 'bodyweight', true],
  ['Chest Fly (Machine)', 'Crucifixo / Peck Deck (Máquina)', 'weight', 'chest', [], 'machine'],
  ['Cable Fly Crossovers', 'Crucifixo no Cabo (Cruzamento)', 'weight', 'chest', [], 'cable'],
  ['Chest Fly (Dumbbell)', 'Crucifixo com Halteres', 'weight', 'chest', [], 'dumbbell'],
  ['Push Up', 'Flexões', 'bodyweight', 'chest', ['triceps'], 'bodyweight', true],

  // Costas
  ['Pull Up', 'Elevações (Barra Fixa)', 'bodyweight', 'back', ['biceps'], 'bodyweight', true],
  ['Pull Up (Band)', 'Elevações com Elástico', 'bodyweight', 'back', ['biceps'], 'bodyweight', true],
  ['Chin Up', 'Elevações Supinadas', 'bodyweight', 'back', ['biceps'], 'bodyweight', true],
  ['Lat Pulldown (Cable)', 'Puxada Vertical (Cabo)', 'weight', 'back', ['biceps'], 'cable', true],
  ['Lat Pulldown - Close Grip (Cable)', 'Puxada Vertical Pega Fechada', 'weight', 'back', ['biceps'], 'cable', true],
  ['Seated Cable Row - V Grip (Cable)', 'Remada Sentada no Cabo (Pega V)', 'weight', 'back', ['biceps', 'rearDelts'], 'cable', true],
  ['Seated Cable Row - Bar Grip', 'Remada Sentada no Cabo (Barra)', 'weight', 'back', ['biceps', 'rearDelts'], 'cable', true],
  ['Iso-Lateral Row (Machine)', 'Remada com Peito Apoiado (Máquina)', 'weight', 'back', ['biceps', 'rearDelts'], 'machine', true],
  ['Bent Over Row (Barbell)', 'Remada Curvada com Barra', 'weight', 'back', ['biceps', 'rearDelts'], 'barbell', true],
  ['Bent Over Row (Smith Machine)', 'Remada Curvada (Smith)', 'weight', 'back', ['biceps', 'rearDelts'], 'machine', true],
  ['Dumbbell Row', 'Remada Unilateral com Halter', 'weight', 'back', ['biceps', 'rearDelts'], 'dumbbell', true],
  ['Landmine Row', 'Remada Landmine', 'weight', 'back', ['biceps', 'rearDelts'], 'barbell', true],
  ['T Bar Row', 'Remada em T', 'weight', 'back', ['biceps', 'rearDelts'], 'barbell', true],
  ['Straight Arm Lat Pulldown (Cable)', 'Pullover no Cabo', 'weight', 'back', [], 'cable'],

  // Ombros
  ['Shoulder Press (Dumbbell)', 'Press de Ombros com Halteres', 'weight', 'sideDelts', ['triceps'], 'dumbbell', true],
  ['Shoulder Press (Machine)', 'Press de Ombros (Máquina)', 'weight', 'sideDelts', ['triceps'], 'machine', true],
  ['Overhead Press (Smith Machine)', 'Press Militar (Smith)', 'weight', 'sideDelts', ['triceps'], 'machine', true],
  ['Overhead Press (Barbell)', 'Press Militar com Barra', 'weight', 'sideDelts', ['triceps'], 'barbell', true],
  ['Lateral Raise (Dumbbell)', 'Elevações Laterais', 'weight', 'sideDelts', [], 'dumbbell'],
  ['Lateral Raise (Machine)', 'Elevações Laterais (Máquina)', 'weight', 'sideDelts', [], 'machine'],
  ['Single Arm Lateral Raise (Cable)', 'Elevação Lateral Unilateral (Cabo)', 'weight', 'sideDelts', [], 'cable'],
  ['Rear Delt Reverse Fly (Machine)', 'Deltoide Posterior (Máquina)', 'weight', 'rearDelts', [], 'machine'],
  ['Reverse Fly (Dumbbell)', 'Deltoide Posterior com Halteres', 'weight', 'rearDelts', [], 'dumbbell'],
  ['Face Pull', 'Face Pull', 'weight', 'rearDelts', [], 'cable'],

  // Bíceps
  ['Seated Incline Curl (Dumbbell)', 'Curl Inclinado com Halteres', 'weight', 'biceps', [], 'dumbbell'],
  ['Hammer Curl (Dumbbell)', 'Curl Martelo com Halteres', 'weight', 'biceps', [], 'dumbbell'],
  ['Hammer Curl (Cable)', 'Curl Martelo no Cabo', 'weight', 'biceps', [], 'cable'],
  ['Preacher Curl (Barbell)', 'Curl Scott com Barra', 'weight', 'biceps', [], 'barbell'],
  ['Behind the Back Curl (Cable)', 'Curl Atrás das Costas (Cabo)', 'weight', 'biceps', [], 'cable'],
  ['Bicep Curl (Dumbbell)', 'Curl de Bíceps com Halteres', 'weight', 'biceps', [], 'dumbbell'],
  ['Bicep Curl (Barbell)', 'Curl de Bíceps com Barra', 'weight', 'biceps', [], 'barbell'],
  ['Bicep Curl (Cable)', 'Curl de Bíceps no Cabo', 'weight', 'biceps', [], 'cable'],

  // Tríceps
  ['Triceps Pushdown', 'Extensão de Tríceps no Cabo (Pushdown)', 'weight', 'triceps', [], 'cable'],
  ['Triceps Rope Pushdown', 'Pushdown com Corda', 'weight', 'triceps', [], 'cable'],
  ['Single Arm Triceps Pushdown (Cable)', 'Pushdown Unilateral (Cabo)', 'weight', 'triceps', [], 'cable'],
  ['Overhead Triceps Extension (Cable)', 'Extensão de Tríceps Acima da Cabeça (Cabo)', 'weight', 'triceps', [], 'cable'],
  ['Skullcrusher (Barbell)', 'Tríceps Testa com Barra', 'weight', 'triceps', [], 'barbell'],
  ['Triceps Dip', 'Paralelas (Tríceps)', 'bodyweight', 'triceps', ['chest'], 'bodyweight', true],

  // Pernas
  ['Squat (Barbell)', 'Agachamento com Barra', 'weight', 'quads', ['glutes'], 'barbell', true],
  ['Squat (Smith Machine)', 'Agachamento no Smith', 'weight', 'quads', ['glutes'], 'machine', true],
  ['Hack Squat (Machine)', 'Hack Squat', 'weight', 'quads', ['glutes'], 'machine', true],
  ['Leg Press (Machine)', 'Leg Press', 'weight', 'quads', ['glutes'], 'machine', true],
  ['Bulgarian Split Squat', 'Agachamento Búlgaro', 'weight', 'quads', ['glutes'], 'dumbbell', true],
  ['Walking Lunge (Dumbbell)', 'Passada com Halteres', 'weight', 'quads', ['glutes'], 'dumbbell', true],
  ['Leg Extension (Machine)', 'Extensão de Pernas (Máquina)', 'weight', 'quads', [], 'machine'],
  ['Single Leg Extensions', 'Extensão de Pernas Unilateral', 'weight', 'quads', [], 'machine'],
  ['Romanian Deadlift (Barbell)', 'Peso Morto Romeno', 'weight', 'hamstrings', ['glutes'], 'barbell', true],
  ['Deadlift (Barbell)', 'Peso Morto', 'weight', 'hamstrings', ['glutes', 'back'], 'barbell', true],
  ['Lying Leg Curl (Machine)', 'Leg Curl Deitado', 'weight', 'hamstrings', [], 'machine'],
  ['Seated Leg Curl (Machine)', 'Leg Curl Sentado', 'weight', 'hamstrings', [], 'machine'],
  ['Hip Thrust (Barbell)', 'Hip Thrust', 'weight', 'glutes', ['hamstrings'], 'barbell', true],
  ['Hip Adduction (Machine)', 'Adução de Anca (Máquina)', 'weight', 'adductors', [], 'machine'],
  ['Hip Abduction (Machine)', 'Abdução de Anca (Máquina)', 'weight', 'glutes', [], 'machine'],
  ['Standing Calf Raise (Machine)', 'Gémeos em Pé (Máquina)', 'weight', 'calves', [], 'machine'],
  ['Seated Calf Raise (Machine)', 'Gémeos Sentado (Máquina)', 'weight', 'calves', [], 'machine'],

  // Abdominais
  ['Cable Crunch', 'Abdominal no Cabo', 'weight', 'abs', [], 'cable'],
  ['Hanging Knee Raise', 'Elevação de Joelhos Suspenso', 'bodyweight', 'abs', [], 'bodyweight'],
  ['Hanging Leg Raise', 'Elevação de Pernas Suspenso', 'bodyweight', 'abs', [], 'bodyweight'],
  ['Lying Leg Raise', 'Elevação de Pernas Deitado', 'bodyweight', 'abs', [], 'bodyweight'],
  ['Crunch', 'Abdominal Crunch', 'bodyweight', 'abs', [], 'bodyweight'],
  ['Russian Twist (Weighted)', 'Rotação Russa com Peso', 'weight', 'abs', [], 'dumbbell'],
  ['Side Bend (Dumbbell)', 'Flexão Lateral com Halter', 'weight', 'abs', [], 'dumbbell'],
  ['Plank', 'Prancha', 'time', 'abs', [], 'bodyweight'],

  // Cardio
  ['Treadmill', 'Passadeira', 'cardio', null, [], 'machine'],
  ['Running (Outdoor)', 'Corrida (Exterior)', 'cardio', null, [], 'none'],
  ['Cycling (Indoor)', 'Bicicleta (Interior)', 'cardio', null, [], 'machine']
];

export const BASE_EXERCISES: Exercise[] = [...SPECS, ...EXTRA_SPECS].map(
  ([name, namePt, kind, primary, secondary, equipment, compound]) => {
    const isCompound = !!compound;
    const stack = equipment === 'cable' || equipment === 'machine';
    return {
      id: slug(name),
      name,
      namePt,
      kind,
      primary,
      secondary,
      equipment,
      // Compostos 2,5 kg; isolamento 1 kg (cabos/máquinas: 2,5 kg por causa dos blocos de pesos).
      increment: kind === 'weight' || kind === 'bodyweight' ? (isCompound || stack ? 2.5 : 1) : 0,
      repMin: isCompound ? 5 : 10,
      repMax: isCompound ? 10 : 15,
      restSeconds: isCompound ? 150 : 90,
      isCustom: false
    } satisfies Exercise;
  }
);

/** Ajusta repMin/repMax de alguns exercícios para as faixas do documento 1. */
const RANGE_OVERRIDES: Record<string, [number, number]> = {
  'bench-press-barbell': [5, 8],
  'squat-smith-machine': [5, 8],
  'romanian-deadlift-barbell': [6, 10],
  'pull-up': [6, 10],
  'lateral-raise-dumbbell': [12, 20],
  'single-arm-lateral-raise-cable': [12, 20],
  'rear-delt-reverse-fly-machine': [15, 20]
};
for (const e of BASE_EXERCISES) {
  const r = RANGE_OVERRIDES[e.id];
  if (r) {
    e.repMin = r[0];
    e.repMax = r[1];
  }
}

/** Palpite razoável para exercícios desconhecidos vindos do Hevy. */
export function guessExercise(name: string): Exercise {
  const n = name.toLowerCase();
  const has = (...k: string[]) => k.some((x) => n.includes(x));
  let primary: Muscle | null = null;
  let secondary: Muscle[] = [];
  let kind: ExerciseKind = 'weight';
  let compound = false;

  if (has('treadmill', 'running', 'cycling', 'bike', 'rowing machine', 'elliptical', 'walk')) {
    kind = 'cardio';
  } else if (has('plank', 'hold')) {
    kind = 'time';
    primary = 'abs';
  } else if (has('bench', 'chest', 'fly', 'push up', 'push-up', 'pec')) {
    primary = 'chest';
    if (has('press', 'bench', 'push')) {
      secondary = ['triceps'];
      compound = true;
    }
  } else if (has('pull up', 'pull-up', 'chin up', 'pulldown', 'row', 'lat ', 'deadlift')) {
    primary = has('deadlift') ? 'hamstrings' : 'back';
    secondary = has('deadlift') ? ['glutes'] : ['biceps'];
    compound = true;
  } else if (has('rear delt', 'reverse fly', 'face pull')) {
    primary = 'rearDelts';
  } else if (has('lateral raise', 'front raise', 'shoulder', 'overhead press', 'military')) {
    primary = 'sideDelts';
    if (has('press')) {
      secondary = ['triceps'];
      compound = true;
    }
  } else if (has('curl') && !has('leg curl', 'hamstring')) {
    primary = 'biceps';
  } else if (has('tricep', 'pushdown', 'skull', 'kickback', 'dip')) {
    primary = 'triceps';
  } else if (has('leg curl', 'hamstring', 'romanian', 'good morning')) {
    primary = 'hamstrings';
  } else if (has('squat', 'leg press', 'lunge', 'leg extension', 'extensions', 'hack')) {
    primary = 'quads';
    if (!has('extension')) {
      secondary = ['glutes'];
      compound = true;
    }
  } else if (has('hip thrust', 'glute', 'abduction', 'kickback')) {
    primary = 'glutes';
  } else if (has('adduction')) {
    primary = 'adductors';
  } else if (has('calf')) {
    primary = 'calves';
  } else if (has('crunch', 'sit up', 'sit-up', 'leg raise', 'knee raise', 'twist', 'side bend', 'ab ')) {
    primary = 'abs';
  }

  const bodyweight = has('pull up', 'pull-up', 'chin up', 'push up', 'push-up', 'knee raise', 'leg raise') ||
    (n.includes('crunch') && !n.includes('cable'));
  if (kind === 'weight' && bodyweight) kind = 'bodyweight';

  const equipment = has('barbell') ? 'barbell'
    : has('dumbbell') ? 'dumbbell'
    : has('cable') ? 'cable'
    : has('machine', 'smith') ? 'machine'
    : bodyweight ? 'bodyweight' : 'other';

  return {
    id: slug(name),
    name,
    kind,
    primary,
    secondary,
    equipment,
    increment: kind === 'weight' || kind === 'bodyweight' ? (compound || equipment === 'cable' || equipment === 'machine' ? 2.5 : 1) : 0,
    repMin: compound ? 5 : 10,
    repMax: compound ? 10 : 15,
    restSeconds: compound ? 150 : 90,
    isCustom: true,
    autoCreated: true
  };
}
