import { useMemo, useState } from 'react';
import { useApp } from '../store';
import { go } from '../router';
import { MUSCLES, type Muscle } from '../types';
import { Empty, Header, Icon } from '../components/ui';
import { ExerciseForm } from '../components/ExerciseForm';
import { Sheet } from '../components/ui';
import { saveExercise } from '../lib/actions';

function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function Exercises() {
  const { t, exercises, exName, finished } = useApp();
  const [q, setQ] = useState('');
  const [mus, setMus] = useState<Muscle | null>(null);
  const [creating, setCreating] = useState(false);

  const usage = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of finished) for (const e of w.exercises) m.set(e.exerciseId, (m.get(e.exerciseId) ?? 0) + 1);
    return m;
  }, [finished]);

  const list = useMemo(() => {
    const nq = norm(q);
    return exercises
      .filter((e) => !mus || e.primary === mus)
      .filter((e) => !nq || norm(e.name).includes(nq) || norm(e.namePt ?? '').includes(nq))
      .sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0) || exName(a).localeCompare(exName(b)));
  }, [exercises, q, mus, usage, exName]);

  return (
    <div className="screen">
      <Header title={t('exercises')} right={<button className="icon-btn" onClick={() => setCreating(true)} aria-label={t('ex.new')}><Icon name="plus" /></button>} />
      <input className="inp" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips scroll" style={{ margin: '10px 0' }}>
        <button className={`chip ${mus === null ? 'on' : ''}`} onClick={() => setMus(null)}>{t('all')}</button>
        {MUSCLES.map((m) => <button key={m} className={`chip ${mus === m ? 'on' : ''}`} onClick={() => setMus(m)}>{t(`m.${m}`)}</button>)}
      </div>
      {list.length === 0 && <Empty title={t('none.found')} />}
      <div className="card flush">
        {list.map((e) => (
          <button key={e.id} className="list-row" onClick={() => go(`/exercise/${e.id}`)}>
            <div>
              <div>{exName(e)}</div>
              <div className="muted small">
                {e.primary ? t(`m.${e.primary}`) : t(`kind.${e.kind}`)} · {t(`eq.${e.equipment}`)}
                {e.autoCreated && <span className="tag" style={{ marginLeft: 6 }}>{t('ex.review')}</span>}
              </div>
            </div>
            <span className="muted small">{usage.get(e.id) ? `${usage.get(e.id)}×` : ''}</span>
          </button>
        ))}
      </div>
      <Sheet open={creating} onClose={() => setCreating(false)} title={t('ex.new')} tall>
        <ExerciseForm onCancel={() => setCreating(false)} onSave={async (e) => { await saveExercise(e); setCreating(false); go(`/exercise/${e.id}`); }} />
      </Sheet>
    </div>
  );
}
