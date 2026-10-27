import { useState } from 'react';
import { useApp } from '../store';
import { go } from '../router';
import { deleteRoutine, duplicateRoutine, moveRoutine, saveRoutine, startWorkout } from '../lib/actions';
import { ConfirmSheet, Empty, Header, Icon, Menu, Sheet, useToast } from '../components/ui';
import { PlanVolume } from '../components/PlanVolume';
import { encodeRoutine, qrDataUrl, shareLink } from '../lib/share';
import type { Routine } from '../types';

export function Routines() {
  const { t, routines, exMap, exName, active } = useApp();
  const toast = useToast();
  const [del, setDel] = useState<Routine | null>(null);
  const [share, setShare] = useState<{ routine: Routine; link: string; qr: string } | null>(null);

  const begin = async (r: Routine) => {
    if (active) { toast(t('home.hasactive')); go('/active'); return; }
    await startWorkout({ name: r.name, routine: r });
    go('/active');
  };

  const openShare = async (r: Routine) => {
    const link = shareLink(encodeRoutine(r, exMap));
    const qr = await qrDataUrl(link);
    setShare({ routine: r, link, qr });
  };

  const copyLink = async () => {
    if (!share) return;
    try {
      if (navigator.share) await navigator.share({ title: share.routine.name, url: share.link });
      else { await navigator.clipboard.writeText(share.link); toast(t('copied')); }
    } catch { /* cancelado */ }
  };

  return (
    <div className="screen stagger">
      <Header title={t('routines')} right={<button className="icon-btn" onClick={() => go('/routine/new')} aria-label={t('routine.new')}><Icon name="plus" /></button>} />
      {routines.length === 0 && (
        <Empty title={t('routines.empty')} text={t('routines.empty.text')} action={<button className="btn accent" onClick={() => go('/routine/new')}>{t('routine.new')}</button>} />
      )}
      {routines.map((r, i) => (
        <div key={r.id} className="card">
          <div className="row between">
            <button className="card-title linklike" onClick={() => go(`/routine/${r.id}`)}>{r.name}</button>
            <Menu
              items={[
                { label: t('edit'), icon: 'edit', onClick: () => go(`/routine/${r.id}`) },
                { label: t('routine.share'), icon: 'share', onClick: () => openShare(r) },
                { label: t('routine.duplicate'), icon: 'repeat', onClick: () => duplicateRoutine(r) },
                ...(i > 0 ? [{ label: t('wk.moveup'), icon: 'up', onClick: () => moveRoutine(r.id!, -1) }] : []),
                ...(i < routines.length - 1 ? [{ label: t('wk.movedown'), icon: 'down', onClick: () => moveRoutine(r.id!, 1) }] : []),
                { label: t('delete'), icon: 'trash', danger: true, onClick: () => setDel(r) }
              ]}
            />
          </div>
          {r.days.length > 0 && (
            <div className="day-pills">{r.days.map((d) => <span key={d} className="day-pill">{t(`dow.${d}`)}</span>)}</div>
          )}
          <div className="muted small">
            {r.items.length} {t('exercises.lc')} · {r.items.reduce((n, x) => n + x.sets, 0)} {t('sets.lc')}
          </div>
          <div className="small ex-list-line">
            {r.items.map((it) => exName(exMap.get(it.exerciseId))).join(' · ')}
          </div>
          <button className="btn accent block" style={{ marginTop: 12 }} onClick={() => begin(r)}><Icon name="play" size={16} /> {t('home.start')}</button>
        </div>
      ))}

      {routines.length > 0 && <PlanVolume routines={routines} />}
      <ConfirmSheet
        open={!!del}
        title={t('routine.delete.title')}
        text={del?.name}
        confirm={t('delete')}
        cancel={t('cancel')}
        danger
        onClose={() => setDel(null)}
        onConfirm={() => del && deleteRoutine(del.id!)}
      />

      <Sheet open={!!share} onClose={() => setShare(null)} title={share ? `${t('routine.share')} · ${share.routine.name}` : ''}>
        {share && (
          <div className="center">
            <img src={share.qr} alt="QR" className="qr" />
            <p className="muted small">{t('share.hint')}</p>
            <button className="btn accent block" onClick={copyLink}><Icon name="share" size={16} /> {t('share.link')}</button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

export { saveRoutine };
