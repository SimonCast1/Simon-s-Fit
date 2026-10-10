import { useState } from 'react';
import type { Exercise, ExerciseKind, Muscle } from '../types';
import { MUSCLES } from '../types';
import { useApp } from '../store';
import { slug } from '../data/exercises';
import { fmtNum, parseNum } from '../lib/calc';
import { NumInput } from './ui';

const KINDS: ExerciseKind[] = ['weight', 'bodyweight', 'time', 'cardio'];
const EQUIP = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'other'];

export function ExerciseForm({ initial, onSave, onCancel }: {
  initial?: Exercise; onSave: (e: Exercise) => void; onCancel: () => void;
}) {
  const { t, lang, exMap } = useApp();
  const [name, setName] = useState(initial?.namePt && lang === 'pt' ? initial.namePt : initial?.name ?? '');
  const [kind, setKind] = useState<ExerciseKind>(initial?.kind ?? 'weight');
  const [primary, setPrimary] = useState<Muscle | ''>(initial?.primary ?? '');
  const [secondary, setSecondary] = useState<Muscle[]>(initial?.secondary ?? []);
  const [equipment, setEquipment] = useState(initial?.equipment ?? 'machine');
  const [inc, setInc] = useState(fmtNum(initial?.increment ?? 2.5, lang));
  const [rMin, setRMin] = useState(String(initial?.repMin ?? 8));
  const [rMax, setRMax] = useState(String(initial?.repMax ?? 12));
  const [rest, setRest] = useState(String(initial?.restSeconds ?? 90));
  const [err, setErr] = useState('');
  const loadBased = kind === 'weight' || kind === 'bodyweight';

  const save = () => {
    const nm = name.trim();
    if (!nm) return setErr(t('ex.err.name'));
    const id = initial?.id ?? slug(nm);
    if (!initial && exMap.has(id)) return setErr(t('ex.err.dup'));
    const min = Math.max(1, Math.round(parseNum(rMin) ?? 8));
    const max = Math.max(min, Math.round(parseNum(rMax) ?? 12));
    // Se o utilizador editou o nome de um exercício da biblioteca, guarda na língua ativa.
    const base: Exercise = initial ?? { id, name: nm, kind, primary: null, secondary: [], equipment, increment: 2.5, repMin: 8, repMax: 12, restSeconds: 90, isCustom: true };
    const nameFields = initial && !initial.isCustom
      ? (lang === 'pt' ? { name: initial.name, namePt: nm } : { name: nm, namePt: initial.namePt })
      : { name: nm, namePt: undefined };
    onSave({
      ...base,
      ...nameFields,
      kind,
      primary: primary || null,
      secondary: secondary.filter((m) => m !== primary),
      equipment,
      increment: loadBased ? Math.max(0, parseNum(inc) ?? 2.5) : 0,
      repMin: min,
      repMax: max,
      restSeconds: Math.max(10, Math.round(parseNum(rest) ?? 90)),
      autoCreated: false
    });
  };

  return (
    <div className="form">
      <label className="lbl">{t('ex.name')}</label>
      <input className="inp" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('ex.name.ph')} />

      <label className="lbl">{t('ex.kind')}</label>
      <div className="chips">
        {KINDS.map((k) => (
          <button key={k} className={`chip ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>{t(`kind.${k}`)}</button>
        ))}
      </div>

      <label className="lbl">{t('ex.primary')}</label>
      <div className="chips">
        <button className={`chip ${primary === '' ? 'on' : ''}`} onClick={() => setPrimary('')}>{t('ex.none')}</button>
        {MUSCLES.map((m) => (
          <button key={m} className={`chip ${primary === m ? 'on' : ''}`} onClick={() => setPrimary(m)}>{t(`m.${m}`)}</button>
        ))}
      </div>

      <label className="lbl">{t('ex.secondary')} <span className="muted">(×0,5)</span></label>
      <div className="chips">
        {MUSCLES.filter((m) => m !== primary).map((m) => (
          <button
            key={m}
            className={`chip ${secondary.includes(m) ? 'on' : ''}`}
            onClick={() => setSecondary((s) => (s.includes(m) ? s.filter((x) => x !== m) : [...s, m]))}
          >
            {t(`m.${m}`)}
          </button>
        ))}
      </div>

      <label className="lbl">{t('ex.equipment')}</label>
      <div className="chips">
        {EQUIP.map((q) => (
          <button key={q} className={`chip ${equipment === q ? 'on' : ''}`} onClick={() => setEquipment(q)}>{t(`eq.${q}`)}</button>
        ))}
      </div>

      <div className="grid3">
        {loadBased && (
          <div>
            <label className="lbl">{t('ex.increment')}</label>
            <NumInput className="inp-num" value={inc} onChange={setInc} />
          </div>
        )}
        <div>
          <label className="lbl">{t('ex.repmin')}</label>
          <NumInput className="inp-num" inputMode="numeric" value={rMin} onChange={setRMin} />
        </div>
        <div>
          <label className="lbl">{t('ex.repmax')}</label>
          <NumInput className="inp-num" inputMode="numeric" value={rMax} onChange={setRMax} />
        </div>
        <div>
          <label className="lbl">{t('ex.rest')}</label>
          <NumInput className="inp-num" inputMode="numeric" value={rest} onChange={setRest} />
        </div>
      </div>
      {err && <div className="err">{err}</div>}
      <div className="row gap" style={{ marginTop: 16 }}>
        <button className="btn ghost grow" onClick={onCancel}>{t('cancel')}</button>
        <button className="btn gold grow" onClick={save}>{t('save')}</button>
      </div>
    </div>
  );
}
