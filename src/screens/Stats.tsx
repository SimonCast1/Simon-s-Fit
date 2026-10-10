import { useMemo, useState } from 'react';
import { useApp } from '../store';
import { go } from '../router';
import { MUSCLES } from '../types';
import { Empty, Header, Icon, SectionTitle } from '../components/ui';
import { BarChart, LineChart } from '../components/charts';
import { addWeeks, computeRecords, exerciseSessions, fmtDuration, fmtNum, weekStart, weeklyVolume, workoutDurationSec, workoutTotals } from '../lib/calc';

type Tab = 'volume' | 'strength' | 'activity';

export function Stats() {
  const { t, lang, settings, finished, exMap, exName } = useApp();
  const [tab, setTab] = useState<Tab>('volume');
  return (
    <div className="screen">
      <Header title={t('stats')} right={<button className="icon-btn" onClick={() => go('/summary')} aria-label={t('summary.open')}><Icon name="calendar" /></button>} />
      <div className="seg">
        {(['volume', 'strength', 'activity'] as Tab[]).map((k) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{t(`stats.${k}`)}</button>
        ))}
      </div>
      {finished.length === 0 ? (
        <Empty title={t('no.data')} text={t('stats.empty')} />
      ) : tab === 'volume' ? <VolumeTab /> : tab === 'strength' ? <StrengthTab /> : <ActivityTab />}
      <span style={{ display: 'none' }}>{settings.lang}{exMap.size}{exName.length}{lang}</span>
    </div>
  );
}

function VolumeTab() {
  const { t, lang, settings, finished, exMap } = useApp();
  const [off, setOff] = useState(0);
  const cur = weekStart(Date.now());
  const from = addWeeks(cur, -off);
  const loc = lang === 'pt' ? 'pt-PT' : 'en-GB';
  const vol = useMemo(() => weeklyVolume(finished, exMap, from), [finished, exMap, from]);
  const avg4 = useMemo(() => {
    const acc: Record<string, number> = {};
    for (let i = 1; i <= 4; i++) {
      const v = weeklyVolume(finished, exMap, addWeeks(cur, -i));
      for (const m of MUSCLES) acc[m] = (acc[m] ?? 0) + v[m] / 4;
    }
    return acc;
  }, [finished, exMap, cur]);
  const max = Math.max(20, ...MUSCLES.map((m) => vol[m]), ...MUSCLES.map((m) => settings.minSets[m] ?? 0));
  const rows = MUSCLES.filter((m) => vol[m] > 0 || settings.minSets[m] !== undefined || avg4[m] > 0);
  const end = addWeeks(from, 1) - 1;

  return (
    <>
      <div className="week-nav">
        <button className="icon-btn" onClick={() => setOff(off + 1)} aria-label="prev"><Icon name="back" /></button>
        <div className="center">
          <div>{new Date(from).toLocaleDateString(loc, { day: 'numeric', month: 'short' })} – {new Date(end).toLocaleDateString(loc, { day: 'numeric', month: 'short' })}</div>
          <div className="muted small">{off === 0 ? t('stats.thisweek') : ''}</div>
        </div>
        <button className="icon-btn" disabled={off === 0} onClick={() => setOff(Math.max(0, off - 1))} aria-label="next" style={{ transform: 'scaleX(-1)' }}><Icon name="back" /></button>
      </div>
      <div className="card">
        {rows.map((m) => {
          const v = vol[m];
          const min = settings.minSets[m];
          const low = min !== undefined && v < min;
          return (
            <div key={m} className="vrow">
              <div className="vlabel">{t(`m.${m}`)}</div>
              <div className="vbar">
                <div className={`vfill ${low ? 'low' : ''}`} style={{ width: `${(v / max) * 100}%` }} />
                {min !== undefined && <div className="vmin" style={{ left: `${(min / max) * 100}%` }} />}
              </div>
              <div className={`vnum ${low && off === 0 ? 'low' : ''}`}>{fmtNum(v, lang)}</div>
            </div>
          );
        })}
        <div className="muted small" style={{ marginTop: 10 }}>{t('stats.vol.legend')}</div>
      </div>
      <SectionTitle>{t('stats.avg4')}</SectionTitle>
      <div className="card flush">
        {rows.map((m) => (
          <div key={m} className="list-row static"><span>{t(`m.${m}`)}</span><span className="muted">{fmtNum(avg4[m], lang)}</span></div>
        ))}
      </div>
    </>
  );
}

function StrengthTab() {
  const { t, lang, finished, exMap, exName } = useApp();
  const options = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of finished) for (const e of w.exercises) m.set(e.exerciseId, (m.get(e.exerciseId) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id).filter((id) => exMap.has(id));
  }, [finished, exMap]);
  const [sel, setSel] = useState(options[0] ?? '');
  const ex = exMap.get(sel);
  const sessions = useMemo(() => exerciseSessions(finished, ex, sel), [finished, ex, sel]);
  const rec = useMemo(() => computeRecords(sessions), [sessions]);
  const loc = lang === 'pt' ? 'pt-PT' : 'en-GB';
  const pts = sessions.map((s) => ({ x: s.date, y: s.score }));
  const delta = sessions.length > 1 && sessions[0].score > 0 ? ((sessions.at(-1)!.score / sessions[0].score) - 1) * 100 : null;

  return (
    <>
      <select className="inp" value={sel} onChange={(e) => setSel(e.target.value)}>
        {options.map((id) => <option key={id} value={id}>{exName(exMap.get(id))}</option>)}
      </select>
      <div className="card" style={{ marginTop: 12 }}>
        <LineChart points={pts} fmtY={(n) => fmtNum(n, lang, 0)} fmtX={(n) => new Date(n).toLocaleDateString(loc, { day: 'numeric', month: 'short' })} emptyText={t('no.data')} />
      </div>
      <div className="stats-grid">
        {ex?.kind === 'weight' && <div className="stat"><div className="stat-v">{rec.bestE1rm ? fmtNum(rec.bestE1rm.value, lang) : '–'}<small> kg</small></div><div className="stat-l">{t('rec.e1rm')}</div></div>}
        {ex?.kind === 'weight' && <div className="stat"><div className="stat-v">{rec.bestWeight ? fmtNum(rec.bestWeight.value, lang) : '–'}<small> kg</small></div><div className="stat-l">{t('rec.weight')}</div></div>}
        {ex?.kind === 'bodyweight' && <div className="stat"><div className="stat-v">{rec.bestReps?.value ?? '–'}</div><div className="stat-l">{t('rec.reps')}</div></div>}
        <div className="stat"><div className="stat-v">{delta === null ? '–' : `${delta >= 0 ? '+' : ''}${fmtNum(delta, lang, 0)}%`}</div><div className="stat-l">{t('stats.change')}</div></div>
      </div>
    </>
  );
}

function ActivityTab() {
  const { t, lang, finished, exMap } = useApp();
  const cur = weekStart(Date.now());
  const loc = lang === 'pt' ? 'pt-PT' : 'en-GB';
  const weeks = useMemo(() => {
    const out: { x: string; y: number; hi?: boolean }[] = [];
    for (let i = 11; i >= 0; i--) {
      const from = addWeeks(cur, -i), to = addWeeks(from, 1);
      out.push({
        x: new Date(from).toLocaleDateString(loc, { day: 'numeric', month: 'numeric' }),
        y: finished.filter((w) => w.startedAt >= from && w.startedAt < to).length,
        hi: i === 0
      });
    }
    return out;
  }, [finished, cur, loc]);
  const tot = useMemo(() => {
    let sets = 0, vol = 0, dur = 0;
    for (const w of finished) { const x = workoutTotals(w, exMap); sets += x.sets; vol += x.volume; dur += workoutDurationSec(w); }
    return { sets, vol, avg: finished.length ? dur / finished.length : 0 };
  }, [finished, exMap]);

  return (
    <>
      <SectionTitle>{t('stats.perweek')}</SectionTitle>
      <div className="card"><BarChart data={weeks} /></div>
      <div className="stats-grid">
        <div className="stat"><div className="stat-v">{finished.length}</div><div className="stat-l">{t('workouts')}</div></div>
        <div className="stat"><div className="stat-v">{tot.sets}</div><div className="stat-l">{t('sets')}</div></div>
        <div className="stat"><div className="stat-v">{fmtNum(tot.vol / 1000, lang, 0)}<small> t</small></div><div className="stat-l">{t('volume')}</div></div>
        <div className="stat"><div className="stat-v">{fmtDuration(tot.avg)}</div><div className="stat-l">{t('stats.avgdur')}</div></div>
      </div>
    </>
  );
}
