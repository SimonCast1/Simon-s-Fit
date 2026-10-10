import { useMemo } from 'react';
import { db } from '../db';
import { useApp } from '../store';
import { go } from '../router';
import { decodeRoutine } from '../lib/share';
import { ensureExercises } from '../db';
import { saveRoutine } from '../lib/actions';
import { Header, Empty, useToast } from '../components/ui';

export function ImportShared({ data }: { data: string }) {
  const { t, exMap, exName } = useApp();
  const toast = useToast();
  const decoded = useMemo(() => {
    try { return decodeRoutine(data, exMap); } catch { return null; }
  }, [data, exMap]);

  if (!decoded) {
    return <div className="screen"><Header title={t('share.import')} onBack backTo="/routines" /><Empty title={t('share.invalid')} /></div>;
  }
  const { routine, newExercises } = decoded;
  const names = (id: string) => exName(exMap.get(id) ?? newExercises.find((e) => e.id === id));

  const save = async () => {
    await ensureExercises(newExercises);
    const count = await db.routines.count();
    await saveRoutine({ ...routine, order: count });
    toast(t('saved'));
    go('/routines', true);
  };

  return (
    <div className="screen">
      <Header title={t('share.import')} onBack backTo="/routines" />
      <div className="card">
        <div className="card-title">{routine.name}</div>
        <ul className="plain-list">
          {routine.items.map((it, i) => (
            <li key={i}><span>{names(it.exerciseId)}</span><span className="muted">{it.sets} × {it.repMin}–{it.repMax}</span></li>
          ))}
        </ul>
        {newExercises.length > 0 && <p className="muted small">{t('share.newex', { n: newExercises.length })}</p>}
        <button className="btn gold block" onClick={save}>{t('share.save')}</button>
      </div>
    </div>
  );
}
