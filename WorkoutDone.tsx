import { useMemo, useState } from 'react';
import { useApp } from '../store';
import { go } from '../router';
import { Header, Icon, SectionTitle } from '../components/ui';
import { GoodImprove } from '../components/notes';
import { WorkoutCardSheet } from '../components/WorkoutCardSheet';
import { bestSetText } from '../lib/card';
import { fmtDuration, fmtNum } from '../lib/calc';
import { workoutAnalysis } from '../lib/summary';

/** Resumo e análise mostrados logo depois de terminar um treino. */
export function WorkoutDone({ id }: { id: number }) {
  const { t, lang, settings, finished, exMap, exName } = useApp();
  const [cardOpen, setCardOpen] = useState(false);
  const w = finished.find((x) => x.id === id);
  const loc = lang === 'pt' ? 'pt-PT' : 'en-GB';
  const a = useMemo(() => (w ? workoutAnalysis(w, finished, exMap, settings) : null), [w, finished, exMap, settings]);

  if (!w || !a) return <div className="screen"><Header title="…" /></div>;

  const delta = (pct: number | null) =>
    pct === null || pct === 0 ? null : <div className={`delta ${pct > 0 ? 'up' : 'down'}`}>{pct > 0 ? '+' : ''}{pct} %</div>;
  const status = (r: (typeof a.results)[number]) => {
    if (r.status === 'up') return <span className="chip-s up"><Icon name="up" size={12} /> {r.pct !== undefined ? `+${fmtNum(r.pct, lang)} %` : ''}</span>;
    if (r.status === 'down') return <span className="chip-s down"><Icon name="down" size={12} /> {r.pct !== undefined ? `${fmtNum(r.pct, lang)} %` : ''}</span>;
    if (r.status === 'new') return <span className="chip-s">{t('done.new')}</span>;
    if (r.status === 'same') return <span className="chip-s">=</span>;
    return null;
  };

  return (
    <div className="screen">
      <Header title={t('done.title')} sub={w.name} onBack backTo="/" />
      <div className="stats-grid">
        <div className="stat"><div className="stat-v">{fmtDuration(a.durationSec)}</div><div className="stat-l">{t('duration')}</div></div>
        <div className="stat"><div className="stat-v">{a.sets}</div><div className="stat-l">{t('sets')}</div>{delta(a.setsPct)}</div>
        <div className="stat"><div className="stat-v">{fmtNum(a.volume / 1000, lang, 1)}<small> t</small></div><div className="stat-l">{t('volume')}</div>{delta(a.volumePct)}</div>
      </div>
      {a.prev && (
        <div className="muted small">
          {t('done.vs', { name: a.prev.name, date: new Date(a.prev.date).toLocaleDateString(loc, { day: 'numeric', month: 'short' }) })}
        </div>
      )}

      <SectionTitle>{t('done.exercises')}</SectionTitle>
      <div className="card flush">
        {w.exercises.map((we, i) => {
          const ex = exMap.get(we.exerciseId);
          const r = a.results.find((x) => x.exerciseId === we.exerciseId);
          return (
            <div key={i} className="list-row static">
              <div>
                <div>{exName(ex)}</div>
                <div className="muted small">{we.sets.filter((s) => s.done && !s.warmup).length} {t('sets.lc')} · {bestSetText(ex, we.sets, lang)}</div>
              </div>
              <div className="row gap">
                {r?.pr && <span className="pr static"><Icon name="trophy" size={13} /> PR</span>}
                {r && status(r)}
              </div>
            </div>
          );
        })}
      </div>

      <GoodImprove good={a.good} improve={a.improve} />

      <div className="row gap" style={{ marginTop: 6 }}>
        <button className="btn ghost grow" onClick={() => setCardOpen(true)}><Icon name="image" size={16} /> {t('card.menu')}</button>
        <button className="btn ghost grow" onClick={() => go(`/workout/${id}`)}>{t('done.view')}</button>
      </div>
      <button className="btn accent block" onClick={() => go('/', true)}>{t('done.close')}</button>
      <WorkoutCardSheet workout={w} open={cardOpen} onClose={() => setCardOpen(false)} />
    </div>
  );
}
