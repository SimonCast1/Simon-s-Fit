import { useMemo, useState } from 'react';
import { useApp } from '../store';
import { MUSCLES } from '../types';
import { Header, Icon, SectionTitle } from '../components/ui';
import { addWeeks, fmtDuration, fmtNum, weekStart } from '../lib/calc';
import { weekSummary, type Note } from '../lib/summary';

function pctDelta(cur: number, prev: number): number | null {
  if (prev <= 0) return null;
  return Math.round(((cur - prev) / prev) * 100);
}

export function Summary() {
  const { t, lang, settings, finished, routines, exMap, exName } = useApp();
  const [off, setOff] = useState(0);
  const loc = lang === 'pt' ? 'pt-PT' : 'en-GB';
  const from = addWeeks(weekStart(Date.now()), -off);
  const s = useMemo(() => weekSummary(finished, exMap, routines, settings, from), [finished, exMap, routines, settings, from]);
  const end = addWeeks(from, 1) - 1;

  const text = (n: Note): string =>
    t(n.key, {
      n: n.n ?? '',
      m: n.m ?? '',
      pct: n.pct ?? '',
      muscles: (n.muscles ?? []).map((m) => t(`m.${m}`)).join(', '),
      exercise: n.exerciseId ? exName(exMap.get(n.exerciseId)) : ''
    });

  const delta = (cur: number, prev: number) => {
    const d = s.inProgress ? null : pctDelta(cur, prev);
    if (d === null || d === 0) return null;
    return <div className={`delta ${d > 0 ? 'up' : 'down'}`}>{d > 0 ? '+' : ''}{d} %</div>;
  };

  const max = Math.max(20, ...MUSCLES.map((m) => s.muscles[m]), ...MUSCLES.map((m) => settings.minSets[m] ?? 0));
  const rows = MUSCLES.filter((m) => s.muscles[m] > 0 || settings.minSets[m] !== undefined);

  return (
    <div className="screen">
      <Header title={t('summary.title')} onBack backTo="/stats" />
      <div className="week-nav">
        <button className="icon-btn" onClick={() => setOff(off + 1)} aria-label="prev"><Icon name="back" /></button>
        <div className="center">
          <div>{new Date(from).toLocaleDateString(loc, { day: 'numeric', month: 'short' })} – {new Date(end).toLocaleDateString(loc, { day: 'numeric', month: 'short' })}</div>
          <div className="muted small">{s.inProgress ? t('summary.inprogress') : ''}</div>
        </div>
        <button className="icon-btn" disabled={off === 0} onClick={() => setOff(Math.max(0, off - 1))} aria-label="next"><Icon name="next" /></button>
      </div>

      <div className="stats-grid">
        <div className="stat">
          <div className="stat-v">{s.workouts}<small> / {s.planned}</small></div>
          <div className="stat-l">{t('workouts')}</div>
          {delta(s.workouts, s.prev.workouts)}
        </div>
        <div className="stat">
          <div className="stat-v">{s.sets}</div>
          <div className="stat-l">{t('sets')}</div>
          {delta(s.sets, s.prev.sets)}
        </div>
        <div className="stat">
          <div className="stat-v">{fmtNum(s.volume / 1000, lang, 1)}<small> t</small></div>
          <div className="stat-l">{t('volume')}</div>
          {delta(s.volume, s.prev.volume)}
        </div>
      </div>
      {s.workouts > 0 && <div className="muted small">{t('duration')}: {fmtDuration(s.durationSec)}{s.prs.length > 0 ? ` · ${t('summary.prs')}: ${s.prs.length}` : ''}</div>}

      <SectionTitle>{t('summary.good')}</SectionTitle>
      <div className="note-list">
        {s.good.length === 0 && <div className="muted small">–</div>}
        {s.good.map((n, i) => <div key={i} className="note good"><Icon name="check" size={16} /><div>{text(n)}</div></div>)}
      </div>

      <SectionTitle>{t('summary.improve')}</SectionTitle>
      <div className="note-list">
        {s.improve.length === 0 && <div className="muted small">–</div>}
        {s.improve.map((n, i) => <div key={i} className="note improve"><Icon name="warn" size={16} /><div>{text(n)}</div></div>)}
      </div>

      {s.workouts > 0 && (
        <>
          <SectionTitle>{t('summary.muscles')}</SectionTitle>
          <div className="card">
            {rows.map((m) => {
              const v = s.muscles[m];
              const min = settings.minSets[m];
              const low = min !== undefined && v < min;
              return (
                <div key={m} className="vrow">
                  <div className="vlabel">{t(`m.${m}`)}</div>
                  <div className="vbar">
                    <div className={`vfill ${low ? 'low' : ''}`} style={{ width: `${(v / max) * 100}%` }} />
                    {min !== undefined && <div className="vmin" style={{ left: `${(min / max) * 100}%` }} />}
                  </div>
                  <div className={`vnum ${low ? 'low' : ''}`}>{fmtNum(v, lang)}</div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
