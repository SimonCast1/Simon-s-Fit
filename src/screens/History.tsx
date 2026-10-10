import { useMemo } from 'react';
import { useApp } from '../store';
import { go } from '../router';
import { Empty, Header } from '../components/ui';
import { fmtDuration, fmtNum, workoutDurationSec, workoutTotals } from '../lib/calc';

export function History() {
  const { t, lang, finished, exMap } = useApp();
  const loc = lang === 'pt' ? 'pt-PT' : 'en-GB';

  const groups = useMemo(() => {
    const m = new Map<string, typeof finished>();
    for (const w of finished) {
      const d = new Date(w.startedAt);
      const k = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
      m.set(k, [...(m.get(k) ?? []), w]);
    }
    return [...m.entries()];
  }, [finished]);

  return (
    <div className="screen">
      <Header title={t('history')} sub={`${finished.length} ${t('workouts.lc')}`} />
      {finished.length === 0 && <Empty title={t('history.empty')} text={t('history.empty.text')} />}
      {groups.map(([k, ws]) => {
        const d = new Date(ws[0].startedAt);
        return (
          <div key={k}>
            <div className="sec-title"><span>{d.toLocaleDateString(loc, { month: 'long', year: 'numeric' })}</span><span className="muted small">{ws.length}</span></div>
            <div className="card flush">
              {ws.map((w) => {
                const tot = workoutTotals(w, exMap);
                return (
                  <button key={w.id} className="list-row" onClick={() => go(`/workout/${w.id}`)}>
                    <div>
                      <div>{w.name}</div>
                      <div className="muted small">
                        {new Date(w.startedAt).toLocaleDateString(loc, { weekday: 'short', day: 'numeric', month: 'short' })} · {fmtDuration(workoutDurationSec(w))}
                      </div>
                    </div>
                    <div className="right muted small">
                      <div>{tot.sets} {t('sets.lc')}</div>
                      <div>{fmtNum(tot.volume / 1000, lang, 1)} t</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
