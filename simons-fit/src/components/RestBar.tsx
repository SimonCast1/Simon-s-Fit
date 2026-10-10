import { useEffect, useState } from 'react';
import { useApp } from '../store';
import { fmtDuration } from '../lib/calc';

export function RestBar() {
  const { rest, addRest, skipRest, t } = useApp();
  const [, tick] = useState(0);
  useEffect(() => {
    if (!rest.endsAt) return;
    const id = window.setInterval(() => tick((n) => n + 1), 250);
    return () => window.clearInterval(id);
  }, [rest.endsAt]);
  if (!rest.endsAt) return null;
  const left = Math.max(0, Math.ceil((rest.endsAt - Date.now()) / 1000));
  const pct = rest.total ? Math.min(100, Math.max(0, (1 - left / rest.total) * 100)) : 0;
  return (
    <div className="restbar">
      <div className="rest-fill" style={{ width: `${pct}%` }} />
      <div className="rest-in">
        <span className="rest-lbl">{t('rest')}</span>
        <span className="rest-time">{fmtDuration(left)}</span>
        <div className="rest-btns">
          <button onClick={() => addRest(-15)}>−15</button>
          <button onClick={() => addRest(15)}>+15</button>
          <button className="skip" onClick={skipRest}>{t('skip')}</button>
        </div>
      </div>
    </div>
  );
}
