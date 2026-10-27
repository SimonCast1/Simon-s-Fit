import { useMemo, useState } from 'react';
import { useApp } from '../store';
import { go } from '../router';
import { Empty, Header, Icon } from '../components/ui';
import { fmtDuration, fmtNum, weekStreak, workoutDurationSec, workoutsByDay, workoutTotals } from '../lib/calc';
import { plannedPerWeek } from '../lib/summary';
import type { Workout } from '../types';

export function History() {
  const { t, lang, finished, exMap } = useApp();
  const [view, setView] = useState<'list' | 'calendar'>('list');
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
    <div className="screen stagger">
      <Header title={t('history')} sub={`${finished.length} ${t('workouts.lc')}`} />
      {finished.length > 0 && (
        <div className="seg">
          <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>{t('history.list')}</button>
          <button className={view === 'calendar' ? 'on' : ''} onClick={() => setView('calendar')}>{t('history.calendar')}</button>
        </div>
      )}
      {finished.length === 0 && <Empty title={t('history.empty')} text={t('history.empty.text')} />}
      {view === 'calendar' && finished.length > 0 && <CalendarView />}
      {view === 'list' && groups.map(([k, ws]) => {
        const d = new Date(ws[0].startedAt);
        return (
          <div key={k}>
            <div className="sec-title"><span>{d.toLocaleDateString(loc, { month: 'long', year: 'numeric' })}</span><span className="muted small">{ws.length}</span></div>
            <div className="card flush">
              {ws.map((w) => {
                const tot = workoutTotals(w, exMap);
                return (
                  <button key={w.id} className="list-row" onClick={() => go(`/workout/${w.id}`)}>
                    <div className="date-badge" aria-hidden="true">
                      <b>{new Date(w.startedAt).getDate()}</b>
                      <span>{new Date(w.startedAt).toLocaleDateString(loc, { weekday: 'short' }).replace('.', '')}</span>
                    </div>
                    <div className="grow">
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

function CalendarView() {
  const { t, lang, finished, routines, exMap } = useApp();
  const loc = lang === 'pt' ? 'pt-PT' : 'en-GB';
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [sel, setSel] = useState<number | null>(now.getDate());

  const byDay = useMemo(() => workoutsByDay(finished, ym.y, ym.m), [finished, ym]);
  const monthTotal = [...byDay.values()].reduce((n, ws) => n + ws.length, 0);
  const streak = useMemo(() => weekStreak(finished, plannedPerWeek(routines)), [finished, routines]);

  const first = new Date(ym.y, ym.m, 1);
  const lead = (first.getDay() + 6) % 7; // segunda = 0
  const days = new Date(ym.y, ym.m + 1, 0).getDate();
  const letters = lang === 'pt' ? ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const rawTitle = first.toLocaleDateString(loc, { month: 'long', year: 'numeric' });
  const monthTitle = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
  const isNow = ym.y === now.getFullYear() && ym.m === now.getMonth();
  const shift = (d: number) => {
    const n = new Date(ym.y, ym.m + d, 1);
    setYm({ y: n.getFullYear(), m: n.getMonth() });
    setSel(null);
  };
  const picked: Workout[] = sel ? byDay.get(sel) ?? [] : [];

  return (
    <>
      <div className="card">
        <div className="row between cal-head">
          <button className="icon-btn sm" onClick={() => shift(-1)} aria-label="prev"><Icon name="back" size={18} /></button>
          <div className="center">
            <div className="card-title">{monthTitle}</div>
            <div className="muted small">{t('cal.month.total', { n: monthTotal })}</div>
          </div>
          <button className="icon-btn sm" onClick={() => shift(1)} disabled={isNow} aria-label="next"><Icon name="next" size={18} /></button>
        </div>
        <div className="cal-grid">
          {letters.map((l, i) => <div key={i} className="cal-dow">{l}</div>)}
          {Array.from({ length: lead }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: days }).map((_, i) => {
            const d = i + 1;
            const has = byDay.has(d);
            const today = isNow && d === now.getDate();
            return (
              <button key={d} className={`cal-day ${has ? 'on' : ''} ${today ? 'today' : ''} ${sel === d ? 'sel' : ''}`} onClick={() => setSel(d)}>
                {d}
              </button>
            );
          })}
        </div>
      </div>
      {streak >= 2 && <div className="hint"><Icon name="trophy" size={16} /><div>{t('cal.streak', { n: streak })}</div></div>}
      {sel !== null && (
        picked.length === 0 ? (
          <div className="muted small center">{t('cal.empty.day')}</div>
        ) : (
          <div className="card flush">
            {picked.map((w) => {
              const tot = workoutTotals(w, exMap);
              return (
                <button key={w.id} className="list-row" onClick={() => go(`/workout/${w.id}`)}>
                  <div>
                    <div>{w.name}</div>
                    <div className="muted small">{fmtDuration(workoutDurationSec(w))}</div>
                  </div>
                  <div className="right muted small">
                    <div>{tot.sets} {t('sets.lc')}</div>
                    <div>{fmtNum(tot.volume / 1000, lang, 1)} t</div>
                  </div>
                </button>
              );
            })}
          </div>
        )
      )}
    </>
  );
}
