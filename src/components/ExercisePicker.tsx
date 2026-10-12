import { Fragment, useMemo, useState } from 'react';
import { useApp } from '../store';
import { MUSCLES, type Exercise, type Muscle } from '../types';
import { Icon, Sheet } from './ui';
import { ExerciseForm } from './ExerciseForm';
import { saveExercise } from '../lib/actions';
import { relatedScore } from '../lib/calc';

function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Lista pesquisável com seleção múltipla; devolve os ids escolhidos. */
export function ExercisePicker({ open, onClose, onPick, exclude = [], replaceId }: {
  open: boolean; onClose: () => void; onPick: (ids: string[]) => void; exclude?: string[];
  /** Modo trocar: escolhe um só exercício e mostra primeiro os parecidos com este. */
  replaceId?: string;
}) {
  const { t, exercises, exName, finished, exMap } = useApp();
  const base = replaceId ? exMap.get(replaceId) : undefined;
  const [q, setQ] = useState('');
  const [mus, setMus] = useState<Muscle | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // mais usados primeiro
  const usage = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of finished) for (const e of w.exercises) m.set(e.exerciseId, (m.get(e.exerciseId) ?? 0) + 1);
    return m;
  }, [finished]);

  const list = useMemo(() => {
    const nq = norm(q);
    return exercises
      .filter((e) => !exclude.includes(e.id) && e.id !== replaceId)
      .filter((e) => !mus || e.primary === mus || e.secondary.includes(mus))
      .filter((e) => !nq || norm(e.name).includes(nq) || norm(e.namePt ?? '').includes(nq))
      .sort((a, b) =>
        (base ? relatedScore(base, b) - relatedScore(base, a) : 0) ||
        (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0) || exName(a).localeCompare(exName(b)));
  }, [exercises, q, mus, exclude, usage, exName, base, replaceId]);
  const nRelated = base && !q && !mus ? list.filter((e) => relatedScore(base, e) >= 2).length : 0;

  const close = () => { setSel([]); setQ(''); setMus(null); setCreating(false); onClose(); };
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : replaceId ? [id] : [...s, id]));

  const onCreate = async (e: Exercise) => {
    await saveExercise(e);
    setCreating(false);
    setSel((s) => [...s, e.id]);
  };

  return (
    <Sheet open={open} onClose={close} title={creating ? t('ex.new') : replaceId ? t('wk.replace') : t('picker.title')} tall>
      {creating ? (
        <ExerciseForm onSave={onCreate} onCancel={() => setCreating(false)} />
      ) : (
        <>
          <input className="inp" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="chips scroll" style={{ margin: '10px 0' }}>
            <button className={`chip ${mus === null ? 'on' : ''}`} onClick={() => setMus(null)}>{t('all')}</button>
            {MUSCLES.map((m) => (
              <button key={m} className={`chip ${mus === m ? 'on' : ''}`} onClick={() => setMus(m)}>{t(`m.${m}`)}</button>
            ))}
          </div>
          <div className="picker-list">
            {list.map((e, i) => (
              <Fragment key={e.id}>
                {nRelated > 0 && i === 0 && <div className="pick-sec">{t('picker.similar', { name: exName(base!) })}</div>}
                {nRelated > 0 && i === nRelated && <div className="pick-sec">{t('picker.others')}</div>}
              <button className={`pick-row ${sel.includes(e.id) ? 'on' : ''}`} onClick={() => toggle(e.id)}>
                <span className="pick-name">{exName(e)}</span>
                <span className="muted small">{e.primary ? t(`m.${e.primary}`) : t(`kind.${e.kind}`)}</span>
                {sel.includes(e.id) && <Icon name="check" size={18} />}
              </button>
              </Fragment>
            ))}
            {list.length === 0 && <div className="muted center" style={{ padding: 20 }}>{t('none.found')}</div>}
          </div>
          <div className="picker-foot">
            <button className="btn ghost" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> {t('ex.new')}</button>
            <button className="btn accent grow" disabled={!sel.length} onClick={() => { onPick(sel); setSel([]); setQ(''); setMus(null); }}>
              {replaceId ? t('picker.swap') : t('add')} {!replaceId && sel.length ? `(${sel.length})` : ''}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
