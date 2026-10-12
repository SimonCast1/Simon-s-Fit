import { useApp } from '../store';
import { Icon, SectionTitle } from './ui';
import type { Note } from '../lib/summary';

/** Converte uma nota (chave i18n + variáveis) em texto. */
export function useNoteText() {
  const { t, exMap, exName } = useApp();
  return (n: Note): string =>
    t(n.key, {
      n: n.n ?? '',
      m: n.m ?? '',
      pct: n.pct ?? '',
      muscles: (n.muscles ?? []).map((m) => t(`m.${m}`)).join(', '),
      exercise: n.exerciseId ? exName(exMap.get(n.exerciseId)) : ''
    });
}

/** Duas listas: o que está bem e o que melhorar. */
export function GoodImprove({ good, improve }: { good: Note[]; improve: Note[] }) {
  const { t } = useApp();
  const text = useNoteText();
  return (
    <>
      <SectionTitle>{t('summary.good')}</SectionTitle>
      <div className="note-list">
        {good.length === 0 && <div className="muted small">–</div>}
        {good.map((n, i) => <div key={i} className="note good"><Icon name="check" size={16} /><div>{text(n)}</div></div>)}
      </div>
      <SectionTitle>{t('summary.improve')}</SectionTitle>
      <div className="note-list">
        {improve.length === 0 && <div className="muted small">–</div>}
        {improve.map((n, i) => <div key={i} className="note improve"><Icon name="warn" size={16} /><div>{text(n)}</div></div>)}
      </div>
    </>
  );
}
