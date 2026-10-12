import { useApp } from '../store';
import { MUSCLES } from '../types';
import { fmtNum, planVolume } from '../lib/calc';
import type { Routine } from '../types';

/** Séries por semana que as rotinas dão a cada músculo, contra os mínimos definidos. */
export function PlanVolume({ routines }: { routines: Pick<Routine, 'items'>[] }) {
  const { t, lang, settings, exMap } = useApp();
  const vol = planVolume(routines, exMap);
  const max = Math.max(20, ...MUSCLES.map((m) => vol[m]), ...MUSCLES.map((m) => settings.minSets[m] ?? 0));
  const rows = MUSCLES.filter((m) => vol[m] > 0 || settings.minSets[m] !== undefined);
  if (!rows.length) return null;
  return (
    <div className="card">
      <div className="card-title" style={{ marginBottom: 4 }}>{t('plan.volume')}</div>
      <div className="muted small" style={{ marginBottom: 6 }}>{t('plan.volume.hint')}</div>
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
            <div className={`vnum ${low ? 'low' : ''}`}>{fmtNum(v, lang)}</div>
          </div>
        );
      })}
    </div>
  );
}
