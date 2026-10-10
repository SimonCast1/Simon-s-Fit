import type { Routine, RoutineItem } from '../types';
import { slug } from './exercises';

// [nome do exercício, séries, repMin, repMax, rirMin, rirMax]
type Row = [string, number, number, number, number, number];

function items(rows: Row[]): RoutineItem[] {
  return rows.map(([name, sets, repMin, repMax, rirMin, rirMax]) => ({
    exerciseId: slug(name),
    sets,
    repMin,
    repMax,
    rirMin,
    rirMax
  }));
}

/** Rotinas do documento 1 (secção 4.2). days: 0=domingo … 6=sábado. */
export const SEED_ROUTINES: Omit<Routine, 'id'>[] = [
  {
    name: 'Superior A',
    seedKey: 'upper-a',
    order: 0,
    days: [1],
    items: items([
      ['Bench Press (Barbell)', 3, 5, 8, 1, 3],
      ['Iso-Lateral Row (Machine)', 3, 6, 10, 1, 2],
      ['Shoulder Press (Dumbbell)', 3, 6, 10, 1, 2],
      ['Lat Pulldown (Cable)', 3, 8, 12, 1, 2],
      ['Lateral Raise (Dumbbell)', 3, 12, 20, 0, 1],
      ['Overhead Triceps Extension (Cable)', 3, 10, 15, 0, 1],
      ['Seated Incline Curl (Dumbbell)', 2, 10, 15, 0, 1]
    ])
  },
  {
    name: 'Inferior',
    seedKey: 'lower',
    order: 1,
    days: [2],
    items: items([
      ['Squat (Smith Machine)', 3, 5, 8, 1, 3],
      ['Romanian Deadlift (Barbell)', 3, 6, 10, 2, 3],
      ['Leg Extension (Machine)', 3, 10, 15, 0, 1],
      ['Seated Leg Curl (Machine)', 3, 10, 15, 0, 1],
      ['Standing Calf Raise (Machine)', 3, 10, 15, 0, 1],
      ['Cable Crunch', 2, 10, 15, 1, 2]
    ])
  },
  {
    name: 'Superior B',
    seedKey: 'upper-b',
    order: 2,
    days: [3],
    items: items([
      ['Incline Bench Press (Dumbbell)', 3, 8, 12, 1, 2],
      ['Pull Up', 3, 6, 10, 1, 2],
      ['Seated Cable Row - V Grip (Cable)', 3, 10, 12, 1, 2],
      ['Chest Fly (Machine)', 3, 12, 15, 0, 1],
      ['Single Arm Lateral Raise (Cable)', 3, 12, 20, 0, 1],
      ['Rear Delt Reverse Fly (Machine)', 2, 15, 20, 0, 1],
      ['Hammer Curl (Cable)', 2, 10, 15, 0, 1],
      ['Triceps Pushdown', 3, 10, 15, 0, 1]
    ])
  },
  {
    name: 'Full body (ênfase superior)',
    seedKey: 'full',
    order: 3,
    days: [5],
    items: (() => {
      const base = items([
        ['Leg Press (Machine)', 3, 8, 12, 1, 2],
        ['Lying Leg Curl (Machine)', 2, 10, 15, 0, 1],
        ['Chest Press (Machine)', 3, 8, 12, 1, 2],
        ['Dumbbell Row', 3, 8, 12, 1, 2],
        ['Shoulder Press (Machine)', 2, 8, 12, 1, 2],
        ['Lateral Raise (Dumbbell)', 2, 15, 20, 0, 1],
        ['Hammer Curl (Dumbbell)', 2, 12, 15, 0, 1],
        ['Triceps Rope Pushdown', 2, 12, 15, 0, 1]
      ]);
      // bíceps + tríceps em supersérie (documento 1)
      base[6].supersetId = 'ss-arms';
      base[7].supersetId = 'ss-arms';
      return base;
    })()
  }
];
