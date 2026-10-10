import { useRef, useState } from 'react';
import { useApp } from '../store';
import { setSetting } from '../db';
import { MUSCLES } from '../types';
import { ConfirmSheet, Header, Icon, NumInput, SectionTitle, Sheet, useToast } from '../components/ui';
import {
  commitHevy, markBackupDone, previewHevy, resetAll, restoreBackup, shareBackup, validateBackup,
  type BackupFile, type HevyPreview
} from '../lib/actions';
import { fmtNum, parseNum } from '../lib/calc';

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button className="list-row" onClick={() => onChange(!on)} role="switch" aria-checked={on}>
      <span>{label}</span>
      <span className={`switch ${on ? 'on' : ''}`}><i /></span>
    </button>
  );
}

export function Settings() {
  const { t, lang, settings } = useApp();
  const toast = useToast();
  const csvRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);
  const [hevy, setHevy] = useState<HevyPreview | null>(null);
  const [hevyText, setHevyText] = useState('');
  const [detectWarm, setDetectWarm] = useState(true);
  const [restore, setRestore] = useState<BackupFile | null>(null);
  const [reset, setReset] = useState(false);
  const loc = lang === 'pt' ? 'pt-PT' : 'en-GB';

  const exportBackup = async () => {
    if ((await shareBackup()) !== 'cancelled') toast(t('backup.done'));
  };

  const onCsv = async (f: File | undefined) => {
    if (!f) return;
    try {
      const text = await f.text();
      const p = await previewHevy(text, { detectWarmups: detectWarm });
      if (p.workouts === 0) { toast(t('hevy.invalid')); return; }
      setHevyText(text);
      setHevy(p);
    } catch { toast(t('hevy.invalid')); }
    if (csvRef.current) csvRef.current.value = '';
  };

  const onJson = async (f: File | undefined) => {
    if (!f) return;
    try {
      const x = JSON.parse(await f.text());
      if (!validateBackup(x)) { toast(t('backup.invalid')); return; }
      setRestore(x);
    } catch { toast(t('backup.invalid')); }
    if (jsonRef.current) jsonRef.current.value = '';
  };

  const setMin = (m: (typeof MUSCLES)[number], v: string) => {
    const n = parseNum(v);
    const next = { ...settings.minSets };
    if (n === undefined) delete next[m]; else next[m] = Math.max(0, n);
    void setSetting('minSets', next);
  };

  return (
    <div className="screen">
      <Header title={t('settings')} onBack backTo="/" />

      <SectionTitle>{t('set.language')}</SectionTitle>
      <div className="seg">
        <button className={lang === 'pt' ? 'on' : ''} onClick={() => setSetting('lang', 'pt')}>Português (PT)</button>
        <button className={lang === 'en' ? 'on' : ''} onClick={() => setSetting('lang', 'en')}>English</button>
      </div>

      <SectionTitle>{t('set.training')}</SectionTitle>
      <div className="card flush">
        <Toggle on={settings.sound} onChange={(v) => setSetting('sound', v)} label={t('set.sound')} />
        <Toggle on={settings.vibrate} onChange={(v) => setSetting('vibrate', v)} label={t('set.vibrate')} />
        <Toggle on={settings.keepAwake} onChange={(v) => setSetting('keepAwake', v)} label={t('set.awake')} />
      </div>
      <p className="muted small">{t('set.rest.note')}</p>

      <SectionTitle>{t('set.minsets')}</SectionTitle>
      <div className="card">
        <p className="muted small" style={{ marginTop: 0 }}>{t('set.minsets.text')}</p>
        <div className="grid3">
          {MUSCLES.map((m) => (
            <div key={m}>
              <label className="lbl sm">{t(`m.${m}`)}</label>
              <NumInput className="inp-num" value={settings.minSets[m] === undefined ? '' : fmtNum(settings.minSets[m], lang)} placeholder="–" onChange={(v) => setMin(m, v)} />
            </div>
          ))}
        </div>
      </div>

      <SectionTitle>{t('set.data')}</SectionTitle>
      <div className="card flush">
        <button className="list-row" onClick={exportBackup}>
          <span><Icon name="download" size={16} /> {t('backup.export')}</span>
          <span className="muted small">
            {settings.lastBackupAt ? new Date(settings.lastBackupAt).toLocaleDateString(loc, { day: 'numeric', month: 'short' }) : t('backup.never')}
          </span>
        </button>
        <button className="list-row" onClick={() => jsonRef.current?.click()}><span><Icon name="upload" size={16} /> {t('backup.import')}</span></button>
        <button className="list-row" onClick={() => csvRef.current?.click()}><span><Icon name="upload" size={16} /> {t('hevy.import')}</span></button>
      </div>
      <p className="muted small">{t('backup.note')}</p>
      <input ref={csvRef} type="file" accept=".csv,text/csv,text/plain" hidden onChange={(e) => onCsv(e.target.files?.[0])} />
      <input ref={jsonRef} type="file" accept=".json,application/json" hidden onChange={(e) => onJson(e.target.files?.[0])} />

      <SectionTitle>{t('set.danger')}</SectionTitle>
      <button className="btn danger-ghost block" onClick={() => setReset(true)}>{t('set.reset')}</button>
      <p className="muted small center" style={{ marginTop: 24 }}>Simon's Fit · v1.0</p>

      <Sheet open={!!hevy} onClose={() => setHevy(null)} title={t('hevy.title')}>
        {hevy && (
          <>
            <div className="stats-grid">
              <div className="stat"><div className="stat-v">{hevy.newWorkouts}</div><div className="stat-l">{t('hevy.new')}</div></div>
              <div className="stat"><div className="stat-v">{hevy.sets}</div><div className="stat-l">{t('sets')}</div></div>
              <div className="stat"><div className="stat-v">{hevy.newExercises.length}</div><div className="stat-l">{t('hevy.newex')}</div></div>
            </div>
            {hevy.from && hevy.to && (
              <p className="muted small">
                {new Date(hevy.from).toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' })} → {new Date(hevy.to).toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' })}
                {hevy.duplicates > 0 && <> · {t('hevy.dups', { n: hevy.duplicates })}</>}
              </p>
            )}
            <Toggle
              on={detectWarm}
              label={t('hevy.warmups', { n: hevy.warmups })}
              onChange={async (v) => { setDetectWarm(v); setHevy(await previewHevy(hevyText, { detectWarmups: v })); }}
            />
            <p className="muted small" style={{ marginTop: 4 }}>{t('hevy.warmups.text')}</p>
            {hevy.newExercises.length > 0 && <p className="muted small">{t('hevy.newex.list')}: {hevy.newExercises.map((e) => e.name).join(', ')}</p>}
            <div className="row gap">
              <button className="btn ghost grow" onClick={() => setHevy(null)}>{t('cancel')}</button>
              <button className="btn accent grow" disabled={hevy.newWorkouts === 0} onClick={async () => { const n = await commitHevy(hevy); setHevy(null); toast(t('hevy.done', { n })); }}>{t('hevy.confirm')}</button>
            </div>
          </>
        )}
      </Sheet>

      <ConfirmSheet
        open={!!restore}
        title={t('backup.restore.title')}
        text={restore ? t('backup.restore.text', { n: restore.workouts.length }) : ''}
        confirm={t('backup.restore')}
        cancel={t('cancel')}
        danger
        onClose={() => setRestore(null)}
        onConfirm={async () => { if (restore) { await restoreBackup(restore); toast(t('backup.restored')); } }}
      />
      <ConfirmSheet
        open={reset}
        title={t('set.reset.title')}
        text={t('set.reset.text')}
        confirm={t('set.reset')}
        cancel={t('cancel')}
        danger
        onClose={() => setReset(false)}
        onConfirm={async () => { await resetAll(); toast(t('set.reset.done')); }}
      />
    </div>
  );
}
