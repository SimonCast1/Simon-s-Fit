import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, loadSettings } from './db';
import type { Exercise, Routine, Settings, Workout } from './types';
import { makeT, type TFn } from './i18n';
import { deloadSignal, type DeloadSignal } from './lib/calc';
import { beep, unlockAudio } from './lib/sound';

interface Rest {
  endsAt: number | null;
  total: number;
}

interface Ctx {
  settings: Settings;
  lang: 'pt' | 'en';
  t: TFn;
  exercises: Exercise[];
  exMap: Map<string, Exercise>;
  routines: Routine[];
  /** treinos concluídos, do mais recente para o mais antigo */
  finished: Workout[];
  active: Workout | undefined;
  deload: DeloadSignal | null;
  rest: Rest;
  startRest: (sec: number) => void;
  addRest: (delta: number) => void;
  skipRest: () => void;
  exName: (e: Exercise | undefined) => string;
}

const AppCtx = createContext<Ctx>(null as unknown as Ctx);
export const useApp = () => useContext(AppCtx);

export function AppProvider({ children }: { children: ReactNode }) {
  const settings = useLiveQuery(loadSettings, []);
  const exercises = useLiveQuery(() => db.exercises.toArray(), []);
  const routines = useLiveQuery(() => db.routines.orderBy('order').toArray(), []);
  const workouts = useLiveQuery(() => db.workouts.orderBy('startedAt').reverse().toArray(), []);
  const [rest, setRest] = useState<Rest>({ endsAt: null, total: 0 });

  const lang = settings?.lang ?? 'pt';
  const t = useMemo(() => makeT(lang), [lang]);
  const exMap = useMemo(() => new Map((exercises ?? []).map((e) => [e.id, e])), [exercises]);
  const finished = useMemo(() => (workouts ?? []).filter((w) => w.endedAt), [workouts]);
  const active = useMemo(
    () => (workouts ?? []).find((w) => w.id === settings?.activeWorkoutId && !w.endedAt),
    [workouts, settings?.activeWorkoutId]
  );
  const deload = useMemo(() => deloadSignal(finished, exMap), [finished, exMap]);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const startRest = useCallback((sec: number) => {
    unlockAudio();
    setRest({ endsAt: Date.now() + sec * 1000, total: sec });
  }, []);
  const addRest = useCallback((delta: number) => {
    setRest((r) => (r.endsAt ? { endsAt: Math.max(Date.now() + 1000, r.endsAt + delta * 1000), total: Math.max(5, r.total + delta) } : r));
  }, []);
  const skipRest = useCallback(() => setRest({ endsAt: null, total: 0 }), []);

  // fim do descanso: som + vibração (apenas com a app aberta)
  useEffect(() => {
    if (!rest.endsAt) return;
    const ms = rest.endsAt - Date.now();
    const id = window.setTimeout(() => {
      const s = settingsRef.current;
      if (s?.sound) beep(3);
      if (s?.vibrate) navigator.vibrate?.([200, 100, 200]);
      setRest({ endsAt: null, total: 0 });
    }, Math.max(0, ms));
    return () => window.clearTimeout(id);
  }, [rest.endsAt]);

  useEffect(() => {
    document.documentElement.lang = lang === 'pt' ? 'pt-PT' : 'en';
  }, [lang]);

  const exName = useCallback(
    (e: Exercise | undefined) => (e ? (lang === 'pt' && e.namePt ? e.namePt : e.name) : '?'),
    [lang]
  );

  if (!settings || !exercises || !routines || !workouts) return null;

  const value: Ctx = {
    settings, lang, t, exercises, exMap, routines, finished, active, deload,
    rest, startRest, addRest, skipRest, exName
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
