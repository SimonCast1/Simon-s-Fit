import { useMemo, useState } from 'react';
import { useApp } from '../store';
import { back, go } from '../router';
import { ConfirmSheet, Header, Icon, Menu, useToast } from '../components/ui';
import { computeRecords, detectPR, exerciseSessions, fmtDuration, fmtNum, isWorking, setScore, workoutDurationSec, workoutTotals } from '../lib/calc';
import { discardWorkout, startFromPast } from '../lib/actions';
import type { Exercise, SetEntry } from '../types';

export function WorkoutDetail({ id }: { id: number }) {
  const { t, lang, finished, exMap, exName, active } = useApp();
  const toast = useToast();
  const [del, setDel] = useState(false);
  const w = finished.find((x) => x.id === id);
  const loc = lang === 'pt' ? 'pt-PT' : 'en-GB';

  // PRs obtidos neste treino (comparados com tudo o que veio antes)
  const prs = useMemo(() => {
    const out = new Map<string, number>();
    if (!w) return out;
    const prior = finished.filter((f) => f.startedAt < w.startedAt);
    for (const we of w.exercises) {
      const ex = exMap.get(we.exerciseId);
      if (!ex) continue;
      const rec = computeRecords(exerciseSessions(prior, ex, ex.id));
      let best = -1, idx = -1;
      we.sets.forEach((s, i) => {
        if (isWorking(s) && detectPR(ex, rec, s).length && setScore(ex, s) > best) { best = setScore(ex, s); idx = i; }
      });
      if (idx >= 0) out.set(`${we.exerciseId}:${idx}`, 1);
    }
    return out;
  }, [w, finished, exMap]);

  if (!w) return <div className="screen"><Header title="?" onBack backTo="/history" /></div>;
  const tot = workoutTotals(w, exMap);

  const setTxt = (ex: Exercise | undefined, s: SetEntry) => {
    if (!ex) return '';
    if (ex.kind === 'time') return `${s.durationSec ?? 0}s`;
    if (ex.kind === 'cardio') return `${fmtNum((s.durationSec ?? 0) / 60, lang)}′${s.distanceKm ? ` · ${fmtNum(s.distanceKm, lang, 2)} km` : ''}`;
    const base = ex.kind === 'bodyweight' && !s.weight ? `${s.reps ?? 0} reps` : `${fmtNum(s.weight ?? 0, lang)} kg × ${s.reps ?? 0}`;
    return `${base}${s.rir !== undefined ? ` · RIR ${s.rir}` : ''}`;
  };

  const shareText = () => {
    const lines = [`${w.name} — ${new Date(w.startedAt).toLocaleDateString(loc)} (${fmtDuration(workoutDurationSec(w))})`];
    for (const we of w.exercises) {
      const ex = exMap.get(we.exerciseId);
      lines.push(`\n${exName(ex)}`);
      we.sets.forEach((s, i) => lines.push(`  ${i + 1}. ${setTxt(ex, s)}`));
    }
    return lines.join('\n');
  };

  const share = async () => {
    const text = shareText();
    try {
      if (navigator.share) await navigator.share({ title: w.name, text });
      else { await navigator.clipboard.writeText(text); toast(t('copied')); }
    } catch { /* cancelado */ }
  };

  const repeat = async () => {
    if (active) { toast(t('home.hasactive')); go('/active'); return; }
    await startFromPast(w);
    go('/active');
  };

  return (
    <div className="screen">
      <Header
        onBack
        backTo="/history"
        title={w.name}
        sub={new Date(w.startedAt).toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        right={
          <Menu items={[
            { label: t('detail.repeat'), icon: 'repeat', onClick: repeat },
            { label: t('detail.edit'), icon: 'edit', onClick: () => go(`/edit/${id}`) },
            { label: t('detail.share'), icon: 'share', onClick: share },
            { label: t('delete'), icon: 'trash', danger: true, onClick: () => setDel(true) }
          ]} />
        }
      />
      <div className="stats-grid">
        <div className="stat"><div className="stat-v">{fmtDuration(workoutDurationSec(w))}</div><div className="stat-l">{t('duration')}</div></div>
        <div className="stat"><div className="stat-v">{tot.sets}</div><div className="stat-l">{t('sets')}</div></div>
        <div className="stat"><div className="stat-v">{fmtNum(tot.volume / 1000, lang, 1)}<small> t</small></div><div className="stat-l">{t('volume')}</div></div>
      </div>
      {w.notes && <div className="card muted">{w.notes}</div>}
      {w.exercises.map((we, i) => {
        const ex = exMap.get(we.exerciseId);
        return (
          <section key={i} className="card">
            <button className="ex-name" onClick={() => go(`/exercise/${we.exerciseId}`)}>{exName(ex)}</button>
            {we.note && <div className="ex-note">{we.note}</div>}
            <div className="detail-sets">
              {we.sets.map((s, si) => (
                <div key={si} className="detail-set">
                  <span className="muted">{s.warmup ? 'A' : si + 1}</span>
                  <span>{setTxt(ex, s)}</span>
                  {prs.has(`${we.exerciseId}:${si}`) && <span className="pr static"><Icon name="trophy" size={13} /> PR</span>}
                </div>
              ))}
            </div>
          </section>
        );
      })}
      <ConfirmSheet
        open={del}
        title={t('detail.delete.title')}
        text={t('detail.delete.text')}
        confirm={t('delete')}
        cancel={t('cancel')}
        danger
        onClose={() => setDel(false)}
        onConfirm={async () => { await discardWorkout(id); back('/history'); }}
      />
    </div>
  );
}
