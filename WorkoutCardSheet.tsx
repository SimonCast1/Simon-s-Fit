import { useEffect, useState } from 'react';
import { useApp } from '../store';
import { Icon, Sheet, useToast } from './ui';
import { buildCardModel, renderCard } from '../lib/card';
import type { Workout } from '../types';

/** Folha com a imagem do cartão do treino e botão de partilha/guardar. */
export function WorkoutCardSheet({ workout, open, onClose }: { workout: Workout; open: boolean; onClose: () => void }) {
  const { t, lang, finished, exMap, exName } = useApp();
  const toast = useToast();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (!open) return;
    let u = '';
    let dead = false;
    const model = buildCardModel(workout, finished, exMap, lang, exName, {
      duration: t('duration'), sets: t('sets'), volume: t('volume'), setsLc: t('sets.lc'), prs: t('summary.prs')
    });
    renderCard(model, t('card.more'), t('card.pr'))
      .then((b) => {
        if (dead) return;
        u = URL.createObjectURL(b);
        setBlob(b);
        setUrl(u);
      })
      .catch(() => { if (!dead) { toast(t('card.failed')); onClose(); } });
    return () => {
      dead = true;
      if (u) URL.revokeObjectURL(u);
      setBlob(null);
      setUrl('');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, workout, lang]);

  const share = async () => {
    if (!blob) return;
    const name = `simons-fit-${new Date(workout.startedAt).toISOString().slice(0, 10)}.png`;
    const file = new File([blob], name, { type: 'image/png' });
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: workout.name });
      else {
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
      }
    } catch { /* cancelado */ }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('card.title')}>
      {url ? <img className="card-preview" src={url} alt={workout.name} /> : <div className="muted center" style={{ padding: 40 }}>…</div>}
      <button className="btn accent block" disabled={!blob} onClick={share}>
        <Icon name="share" size={16} /> {typeof navigator.canShare === 'function' ? t('card.share') : t('card.save')}
      </button>
    </Sheet>
  );
}
