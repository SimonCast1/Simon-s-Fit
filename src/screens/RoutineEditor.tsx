import { useEffect, useState } from 'react';
import { db } from '../db';
import { useApp } from '../store';
import { back, go } from '../router';
import { saveRoutine } from '../lib/actions';
import { Header, Icon, NumInput, useToast } from '../components/ui';
import { ExercisePicker } from '../components/ExercisePicker';
import { PlanVolume } from '../components/PlanVolume';
import { newId, parseNum } from '../lib/calc';
import type { Routine, RoutineItem } from '../types';

const DOWS = [1, 2, 3, 4, 5, 6, 0];

export function RoutineEditor({ id }: { id: number | 'new' }) {
  const { t, exMap, exName, routines } = useApp();
  const toast = useToast();
  const [r, setR] = useState<Routine | null>(null);
  const [picker, setPicker] = useState(false);
  const [swapIdx, setSwapIdx] = useState<number | null>(null);

  useEffect(() => {
    if (id === 'new') setR({ name: '', order: 0, days: [], items: [] });
    else void db.routines.get(id).then((x) => setR(x ?? null));
  }, [id]);

  if (!r) return <div className="screen"><Header title="…" onBack /></div>;

  const upd = (fn: (x: Routine) => void) => setR((cur) => { const c = structuredClone(cur!); fn(c); return c; });
  const setItem = (i: number, p: Partial<RoutineItem>) => upd((x) => { Object.assign(x.items[i], p); });
  const num = (s: string, d: number) => Math.max(0, Math.round(parseNum(s) ?? d));

  const save = async () => {
    if (!r.name.trim()) { toast(t('routine.err.name')); return; }
    if (r.items.length === 0) { toast(t('routine.err.empty')); return; }
    await saveRoutine({ ...r, name: r.name.trim() });
    toast(t('saved'));
    back('/routines');
  };

  const add = (ids: string[]) => {
    upd((x) => {
      for (const eid of ids) {
        const ex = exMap.get(eid);
        if (!ex) continue;
        x.items.push({ exerciseId: eid, sets: 3, repMin: ex.repMin, repMax: ex.repMax, rirMin: 1, rirMax: 2 });
      }
    });
    setPicker(false);
  };

  const swap = (ids: string[]) => {
    const i = swapIdx;
    setSwapIdx(null);
    if (i === null || !ids[0]) return;
    const ex = exMap.get(ids[0]);
    // mantém o lugar, séries e supersérie; só atualiza o exercício e a gama de repetições
    upd((x) => { x.items[i].exerciseId = ids[0]; if (ex) { x.items[i].repMin = ex.repMin; x.items[i].repMax = ex.repMax; } });
  };

  const toggleSS = (i: number) =>
    upd((x) => {
      const a = x.items[i], b = x.items[i + 1];
      if (a.supersetId) {
        const sid = a.supersetId;
        x.items.forEach((it) => { if (it.supersetId === sid) delete it.supersetId; });
      } else if (b) {
        const sid = b.supersetId ?? newId();
        a.supersetId = sid; b.supersetId = sid;
      }
    });

  return (
    <div className="screen">
      <Header
        onBack
        backTo="/routines"
        title={id === 'new' ? t('routine.new') : t('routine.edit')}
        right={<button className="btn accent sm" onClick={save}>{t('save')}</button>}
      />
      <label className="lbl">{t('routine.name')}</label>
      <input className="inp" value={r.name} onChange={(e) => upd((x) => { x.name = e.target.value; })} placeholder={t('routine.name.ph')} />

      <label className="lbl">{t('routine.days')} <span className="muted small">({t('routine.days.hint')})</span></label>
      <div className="chips">
        {DOWS.map((d) => (
          <button key={d} className={`chip ${r.days.includes(d) ? 'on' : ''}`} onClick={() => upd((x) => { x.days = x.days.includes(d) ? x.days.filter((y) => y !== d) : [...x.days, d]; })}>
            {t(`dow.${d}`)}
          </button>
        ))}
      </div>

      <label className="lbl">{t('exercises')}</label>
      {r.items.map((it, i) => {
        const ex = exMap.get(it.exerciseId);
        const next = r.items[i + 1];
        const linked = !!it.supersetId;
        const nextLinked = linked && next?.supersetId === it.supersetId;
        return (
          <div key={i} className={`card edit-item ${nextLinked ? 'ss-next' : ''} ${linked && i > 0 && r.items[i - 1].supersetId === it.supersetId ? 'ss-prev' : ''}`}>
            <div className="row between">
              <button className="ex-name" onClick={() => go(`/exercise/${it.exerciseId}`)}>{exName(ex)}</button>
              <div className="row">
                {i > 0 && <button className="icon-btn sm" onClick={() => upd((x) => { [x.items[i - 1], x.items[i]] = [x.items[i], x.items[i - 1]]; })} aria-label="up"><Icon name="up" size={16} /></button>}
                {i < r.items.length - 1 && <button className="icon-btn sm" onClick={() => upd((x) => { [x.items[i + 1], x.items[i]] = [x.items[i], x.items[i + 1]]; })} aria-label="down"><Icon name="down" size={16} /></button>}
                {(next || linked) && <button className={`icon-btn sm ${linked ? 'accent-i' : ''}`} onClick={() => toggleSS(i)} aria-label="superset"><Icon name="link" size={16} /></button>}
                <button className="icon-btn sm" onClick={() => setSwapIdx(i)} aria-label={t('wk.replace')}><Icon name="repeat" size={16} /></button>
                <button className="icon-btn sm" onClick={() => upd((x) => { x.items.splice(i, 1); })} aria-label="remove"><Icon name="trash" size={16} /></button>
              </div>
            </div>
            <div className="grid3">
              <div><label className="lbl sm">{t('sets')}</label><NumInput className="inp-num" inputMode="numeric" value={String(it.sets)} onChange={(v) => setItem(i, { sets: num(v, 1) || 1 })} /></div>
              <div><label className="lbl sm">{t('ex.repmin')}</label><NumInput className="inp-num" inputMode="numeric" value={String(it.repMin)} onChange={(v) => setItem(i, { repMin: num(v, 1) })} /></div>
              <div><label className="lbl sm">{t('ex.repmax')}</label><NumInput className="inp-num" inputMode="numeric" value={String(it.repMax)} onChange={(v) => setItem(i, { repMax: Math.max(it.repMin, num(v, 1)) })} /></div>
            </div>
          </div>
        );
      })}
      <button className="btn ghost block" onClick={() => setPicker(true)}><Icon name="plus" size={16} /> {t('wk.addex')}</button>
      <ExercisePicker open={picker} onClose={() => setPicker(false)} onPick={add} />
      <ExercisePicker open={swapIdx !== null} onClose={() => setSwapIdx(null)} onPick={swap} replaceId={swapIdx !== null ? r.items[swapIdx]?.exerciseId : undefined} />
      <PlanVolume routines={[...routines.filter((x) => x.id !== r.id), r]} />
    </div>
  );
}
