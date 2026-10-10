import { useMemo, useState } from 'react';
import { useApp } from '../store';
import { back } from '../router';
import { ConfirmSheet, Header, Icon, SectionTitle, Sheet, useToast } from '../components/ui';
import { ExerciseForm } from '../components/ExerciseForm';
import { LineChart } from '../components/charts';
import { computeRecords, exerciseSessions, fmtNum, stagnationSessions } from '../lib/calc';
import { deleteExercise, exerciseUsage, saveExercise } from '../lib/actions';

export function ExerciseDetail({ id }: { id: string }) {
  const { t, lang, exMap, exName, finished } = useApp();
  const toast = useToast();
  const ex = exMap.get(id);
  const [edit, setEdit] = useState(false);
  const [del, setDel] = useState(false);
  const [usage, setUsage] = useState(0);
  const loc = lang === 'pt' ? 'pt-PT' : 'en-GB';

  const sessions = useMemo(() => exerciseSessions(finished, ex, id), [finished, ex, id]);
  const rec = useMemo(() => computeRecords(sessions), [sessions]);
  if (!ex) return <div className="screen"><Header title="?" onBack /></div>;

  const metric = ex.kind === 'weight' ? 'e1RM (kg)' : ex.kind === 'bodyweight' ? 'reps' : ex.kind === 'time' ? 's' : 'km / s';
  const points = sessions.map((s) => ({ x: s.date, y: s.score }));
  const stag = stagnationSessions(sessions);
  const dstr = (n: number) => new Date(n).toLocaleDateString(loc, { day: 'numeric', month: 'short', year: '2-digit' });

  const setTxt = (s: { weight?: number; reps?: number; durationSec?: number; distanceKm?: number }) =>
    ex.kind === 'time' ? `${s.durationSec ?? 0}s`
    : ex.kind === 'cardio' ? `${fmtNum((s.durationSec ?? 0) / 60, lang)}′`
    : s.weight ? `${fmtNum(s.weight, lang)}×${s.reps ?? 0}` : `${s.reps ?? 0}`;

  return (
    <div className="screen">
      <Header
        onBack
        title={exName(ex)}
        sub={`${ex.primary ? t(`m.${ex.primary}`) : t(`kind.${ex.kind}`)}${ex.secondary.length ? ' · +' + ex.secondary.map((m) => t(`m.${m}`)).join(', ') : ''}`}
        right={<button className="icon-btn" onClick={() => setEdit(true)} aria-label={t('edit')}><Icon name="edit" /></button>}
      />

      {stag > 0 && <div className="hint warn"><Icon name="warn" size={16} /><div>{t('stag', { n: stag })}</div></div>}

      <SectionTitle>{t('records')}</SectionTitle>
      <div className="stats-grid">
        {ex.kind === 'weight' && (
          <>
            <div className="stat"><div className="stat-v">{rec.bestWeight ? fmtNum(rec.bestWeight.value, lang) : '–'}<small> kg</small></div><div className="stat-l">{t('rec.weight')}</div></div>
            <div className="stat"><div className="stat-v">{rec.bestE1rm ? fmtNum(rec.bestE1rm.value, lang) : '–'}<small> kg</small></div><div className="stat-l">{t('rec.e1rm')}</div></div>
            <div className="stat"><div className="stat-v">{rec.bestSetVolume ? fmtNum(rec.bestSetVolume.value, lang, 0) : '–'}<small> kg</small></div><div className="stat-l">{t('rec.setvol')}</div></div>
          </>
        )}
        {ex.kind === 'bodyweight' && (
          <div className="stat"><div className="stat-v">{rec.bestReps ? rec.bestReps.value : '–'}</div><div className="stat-l">{t('rec.reps')}</div></div>
        )}
        <div className="stat"><div className="stat-v">{rec.sessions}</div><div className="stat-l">{t('rec.sessions')}</div></div>
      </div>

      <SectionTitle>{t('progress')} · {metric}</SectionTitle>
      <div className="card">
        <LineChart
          points={points}
          fmtY={(n) => fmtNum(n, lang, 0)}
          fmtX={(n) => new Date(n).toLocaleDateString(loc, { day: 'numeric', month: 'short' })}
          emptyText={t('no.data')}
        />
      </div>

      <SectionTitle>{t('history')}</SectionTitle>
      <div className="card flush">
        {[...sessions].reverse().slice(0, 30).map((s, i) => (
          <div key={i} className="list-row static">
            <div className="muted small" style={{ minWidth: 74 }}>{dstr(s.date)}</div>
            <div className="small grow">{s.sets.map(setTxt).join('  ·  ')}</div>
          </div>
        ))}
        {sessions.length === 0 && <div className="muted center" style={{ padding: 16 }}>{t('no.data')}</div>}
      </div>

      <Sheet open={edit} onClose={() => setEdit(false)} title={t('edit')} tall>
        <ExerciseForm
          initial={ex}
          onCancel={() => setEdit(false)}
          onSave={async (e) => { await saveExercise(e); setEdit(false); toast(t('saved')); }}
        />
        <button className="btn danger-ghost block" style={{ marginTop: 12 }} onClick={async () => { setUsage(await exerciseUsage(id)); setEdit(false); setDel(true); }}>
          {t('delete')}
        </button>
      </Sheet>

      <ConfirmSheet
        open={del}
        title={t('ex.delete.title')}
        text={usage > 0 ? t('ex.delete.used', { n: usage }) : t('ex.delete.text')}
        confirm={t('delete')}
        cancel={t('cancel')}
        danger
        onClose={() => setDel(false)}
        onConfirm={async () => { await deleteExercise(id); back('/exercises'); }}
      />
    </div>
  );
}
