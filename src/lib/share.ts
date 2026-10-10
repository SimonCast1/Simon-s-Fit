import QRCode from 'qrcode';
import type { Exercise, Routine, RoutineItem } from '../types';
import { BASE_EXERCISES, guessExercise } from '../data/exercises';

interface SharedRoutine {
  v: 1;
  n: string;
  d: number[];
  i: [string, number, number, number, number, number, string?][];
  x: Pick<Exercise, 'id' | 'name' | 'namePt' | 'kind' | 'primary' | 'secondary' | 'equipment' | 'increment' | 'repMin' | 'repMax' | 'restSeconds'>[];
}

function toB64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64Url(s: string): string {
  const b = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

const BASE_IDS = new Set(BASE_EXERCISES.map((e) => e.id));

export function encodeRoutine(r: Routine, exMap: Map<string, Exercise>): string {
  const x: SharedRoutine['x'] = [];
  const seen = new Set<string>();
  for (const it of r.items) {
    const ex = exMap.get(it.exerciseId);
    if (ex && !BASE_IDS.has(ex.id) && !seen.has(ex.id)) {
      seen.add(ex.id);
      x.push({
        id: ex.id, name: ex.name, namePt: ex.namePt, kind: ex.kind, primary: ex.primary,
        secondary: ex.secondary, equipment: ex.equipment, increment: ex.increment,
        repMin: ex.repMin, repMax: ex.repMax, restSeconds: ex.restSeconds
      });
    }
  }
  const payload: SharedRoutine = {
    v: 1,
    n: r.name,
    d: r.days,
    i: r.items.map((it) => [it.exerciseId, it.sets, it.repMin, it.repMax, it.rirMin, it.rirMax, it.supersetId]),
    x
  };
  return toB64Url(JSON.stringify(payload));
}

export function shareLink(data: string): string {
  const base = location.href.split('#')[0];
  return `${base}#/import?d=${data}`;
}

export interface DecodedRoutine {
  routine: Omit<Routine, 'id' | 'order'>;
  newExercises: Exercise[];
}

export function decodeRoutine(data: string, known: Map<string, Exercise>): DecodedRoutine {
  const p = JSON.parse(fromB64Url(data)) as SharedRoutine;
  if (p.v !== 1 || !Array.isArray(p.i)) throw new Error('invalid');
  const newExercises: Exercise[] = [];
  for (const x of p.x ?? []) {
    if (!known.has(x.id)) newExercises.push({ ...x, isCustom: true });
  }
  const items: RoutineItem[] = p.i.map(([exerciseId, sets, repMin, repMax, rirMin, rirMax, supersetId]) => {
    if (!known.has(exerciseId) && !newExercises.some((e) => e.id === exerciseId)) {
      const g = guessExercise(exerciseId.replace(/-/g, ' '));
      g.id = exerciseId;
      newExercises.push(g);
    }
    return { exerciseId, sets, repMin, repMax, rirMin, rirMax, supersetId };
  });
  return { routine: { name: p.n, days: p.d ?? [], items }, newExercises };
}

export async function qrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    margin: 2,
    width: 480,
    errorCorrectionLevel: 'L',
    color: { dark: '#0e0d0b', light: '#efe6d0' }
  });
}
