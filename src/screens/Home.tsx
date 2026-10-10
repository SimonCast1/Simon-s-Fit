import { useMemo } from 'react';
import { useApp } from '../store';
import { go } from '../router';
import { startWorkout } from '../lib/actions';
import { Icon, SectionTitle, useToast } from '../components/ui';
import { DAY_MS, fmtDuration, fmtNum, weekStart, workoutDurationSec, workoutTotals } from '../lib/calc';
import type { Routine } from '../types';

export function Home() {
  const { t, lang, routines, finished, active, settings, exMap, exName } = useApp();
  const toast = useToast();
  const loc = lang === 'pt' ? 'pt-PT' : 'en-GB';

  const suggested: Routine | undefined = useMemo(() => {
    const dow = new Date().getDay();
    const byDay = routines.find((r) => r.days.includes(dow));
    if (byDay) return byDay;
    const lastRoutine = finished.find((w) => w.routineId !== undefined);
    if (lastRoutine) {
      const i = routines.findIndex((r) => r.id === lastRoutine.routineId);
      if (i >= 0) return routines[(i + 1) % routines.length];
    }
    return routines[0];
  }, [routines, finished]);

  const wk = weekStart(Date.now());
  const thisWeek = finished.filter((w) => w.startedAt >= wk);
  const dayHas = useMemo(() => {
    const s = new Set<number>();
    for (const w of thisWeek) s.add(Math.floor((new Date(w.startedAt).setHours(0, 0, 0, 0) - wk) / DAY_MS + 0.5));
    return s;
  }, [thisWeek, wk]);
  const todayIdx = (new Date().getDay() + 6) % 7;
  const dayLetters = lang === 'pt' ? ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const needBackup =
    finished.length > 0 && (!settings.lastBackupAt || Date.now() - settings.lastBackupAt > 7 * DAY_MS);

  const begin = async (r?: Routine) => {
    if (active) { toast(t('home.hasactive')); go('/active'); return; }
    await startWorkout(r ? { name: r.name, routine: r } : { name: t('wk.untitled') });
    go('/active');
  };

  const last = finished[0];
  const lastTot = last ? workoutTotals(last, exMap) : null;

  return (
    <div className="screen">
      <header className="home-hdr">
        <div>
          <div className="brand">Simon's Fit</div>
          <div className="muted small">{new Date().toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </div>
        <button className="icon-btn" onClick={() => go('/settings')} aria-label={t('settings')}><Icon name="gear" /></button>
      </header>

      {needBackup && (
        <button className="hint warn tap" onClick={() => go('/settings')}>
          <Icon name="download" size={16} />
          <div>
            <b>{t('backup.remind.title')}</b>
            <div className="muted small">{t('backup.remind.text')}</div>
          </div>
        </button>
      )}

      {active && (
        <button className="card gold-card tap" onClick={() => go('/active')}>
          <div className="row between">
            <div>
              <div className="eyebrow">{t('home.inprogress')}</div>
              <div className="card-title">{active.name}</div>
              <div className="muted small">{fmtDuration((Date.now() - active.startedAt) / 1000)} · {active.exercises.length} {t('exercises.lc')}</div>
            </div>
            <Icon name="play" size={26} />
          </div>
        </button>
      )}

      {!active && suggested && (
        <div className="card hero">
          <div className="eyebrow">{t('home.today')}</div>
          <div className="card-title big">{suggested.name}</div>
          <ul className="plain-list">
            {suggested.items.slice(0, 5).map((it, i) => (
              <li key={i}><span>{exName(exMap.get(it.exerciseId))}</span><span className="muted">{it.sets} × {it.repMin}–{it.repMax}</span></li>
            ))}
            {suggested.items.length > 5 && <li className="muted">+ {suggested.items.length - 5}…</li>}
          </ul>
          <button className="btn gold block" onClick={() => begin(suggested)}><Icon name="play" size={16} /> {t('home.start')}</button>
        </div>
      )}

      {!active && (
        <div className="row gap">
          <button className="btn ghost grow" onClick={() => begin()}><Icon name="plus" size={16} /> {t('home.empty')}</button>
          <button className="btn ghost grow" onClick={() => go('/routines')}>{t('home.otherroutine')}</button>
        </div>
      )}

      <SectionTitle right={<span className="muted small">{thisWeek.length} {t('workouts.lc')}</span>}>{t('home.week')}</SectionTitle>
      <div className="card week">
        {dayLetters.map((d, i) => (
          <div key={i} className={`day ${dayHas.has(i) ? 'on' : ''} ${i === todayIdx ? 'today' : ''}`}>
            <span className="dot">{dayHas.has(i) ? <Icon name="check" size={14} /> : ''}</span>
            <span>{d}</span>
          </div>
        ))}
      </div>

      {last && lastTot && (
        <>
          <SectionTitle>{t('home.last')}</SectionTitle>
          <button className="card tap" onClick={() => go(`/workout/${last.id}`)}>
            <div className="row between">
              <div>
                <div className="card-title">{last.name}</div>
                <div className="muted small">
                  {new Date(last.startedAt).toLocaleDateString(loc, { weekday: 'short', day: 'numeric', month: 'short' })} · {fmtDuration(workoutDurationSec(last))}
                </div>
              </div>
              <div className="right muted small">
                <div>{lastTot.sets} {t('sets.lc')}</div>
                <div>{fmtNum(lastTot.volume / 1000, lang, 1)} t</div>
              </div>
            </div>
          </button>
        </>
      )}

      {finished.length === 0 && !active && (
        <div className="hint">
          <Icon name="upload" size={16} />
          <div>
            <b>{t('home.import.title')}</b>
            <div className="muted small">{t('home.import.text')}</div>
          </div>
          <button className="btn ghost sm" onClick={() => go('/settings')}>{t('open')}</button>
        </div>
      )}
    </div>
  );
}
