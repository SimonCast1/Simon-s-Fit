import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../store';
import { back, go } from '../router';
import { ConfirmSheet, Header, Icon, Menu, Sheet, useToast } from '../components/ui';
import { buildCardModel, renderCard } from '../lib/card';
import { computeRecords, detectPR, exerciseSessions, fmtDuration, fmtNum, isWorking, setScore, workoutDurationSec, workoutTotals } from '../lib/calc';
import { discardWorkout, startFromPast } from '../lib/actions';
import type { Exercise, SetEntry } from '../types';

export function WorkoutDetail({ id }: { id: number }) {
  const { t, lang, finished, exMap, exName, active } = useApp();
  const toast = useToast();
  const [del, setDel] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [cardBlob, setCardBlob] = useState<Blob | null>(null);
  const [cardUrl, setCardUrl] = useState('');
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

  useEffect(() => {
    if (!cardOpen || !w) return;
    let url = '';
    let dead = false;
    const model = buildCardModel(w, finished, exMap, lang, exName, {
      duration: t('duration'), sets: t('sets'), volume: t('volume'), setsLc: t('sets.lc'), prs: t('summary.prs')
    });
    renderCard(model, t('card.more'), t('card.pr'))
      .then((b) => {
        if (dead) return;
        url = URL.createObjectURL(b);
        setCardBlob(b);
        setCardUrl(url);
      })
      .catch(() => { if (!dead) { toast(t('card.failed')); setCardOpen(false); } });
    return () => {
      dead = true;
      if (url) URL.revokeObjectURL(url);
      setCardBlob(null);
      setCardUrl('');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardOpen, w, lang]);

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

  const shareCard = async () => {
    if (!cardBlob) return;
    const name = `simons-fit-${new Date(w.startedAt).toISOString().slice(0, 10)}.png`;
    const file = new File([cardBlob], name, { type: 'image/png' });
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: w.name });
      else {
        const a = document.createElement('a');
        a.href = cardUrl;
        a.download = name;
        a.click();
      }
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
            { label: t('card.menu'), icon: 'image', onClick: () => setCardOpen(true) },
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
      <Sheet open={cardOpen} onClose={() => setCardOpen(false)} title={t('card.title')}>
        {cardUrl ? <img className="card-preview" src={cardUrl} alt={w.name} /> : <div className="muted center" style={{ padding: 40 }}>…</div>}
        <button className="btn accent block" disabled={!cardBlob} onClick={shareCard}>
          <Icon name="share" size={16} /> {typeof navigator.canShare === 'function' ? t('card.share') : t('card.save')}
        </button>
      </Sheet>
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
