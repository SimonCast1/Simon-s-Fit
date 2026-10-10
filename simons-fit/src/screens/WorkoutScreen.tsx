import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useApp } from '../store';
import type { Exercise, SetEntry, Workout, WorkoutExercise } from '../types';
import {
  addWorkoutVolume, computeRecords, detectPR, emptyVolume, exerciseSessions, fmtDuration, fmtNum,
  lastSession, parseNum, setScore, stagnationSessions, suggestProgression, weekStart, weeklyVolume,
  type Records, type Session, type Suggestion, newId, DAY_MS
} from '../lib/calc';
import { discardWorkout, finishWorkout, patchWorkout } from '../lib/actions';
import { go } from '../router';
import { ConfirmSheet, Header, Icon, Menu, NumInput, Sheet, useToast } from '../components/ui';
import { ExercisePicker } from '../components/ExercisePicker';
import { unlockAudio } from '../lib/sound';

/* ---------- utilitários ---------- */

function Elapsed({ start, end }: { start: number; end?: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (end) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [end]);
  return <>{fmtDuration(((end ?? now) - start) / 1000)}</>;
}

function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const req = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
        if (cancelled) void lock.release();
      } catch { /* ignore */ }
    };
    void req();
    const vis = () => { if (document.visibilityState === 'visible') void req(); };
    document.addEventListener('visibilitychange', vis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', vis);
      void lock?.release();
    };
  }, [on]);
}

function prevLabel(ex: Exercise, s: SetEntry | undefined, lang: 'pt' | 'en'): string {
  if (!s) return '–';
  switch (ex.kind) {
    case 'weight':
      return `${fmtNum(s.weight ?? 0, lang)} × ${s.reps ?? 0}`;
    case 'bodyweight':
      return s.weight ? `+${fmtNum(s.weight, lang)} × ${s.reps ?? 0}` : `${s.reps ?? 0}`;
    case 'time':
      return `${s.durationSec ?? 0}s`;
    case 'cardio':
      return `${fmtNum((s.durationSec ?? 0) / 60, lang)}′${s.distanceKm ? ` · ${fmtNum(s.distanceKm, lang, 2)}km` : ''}`;
  }
}

interface ExInfo {
  ex: Exercise;
  last?: Session;
  records: Records;
  stagnant: number;
  sugg: Suggestion | null;
}

/* ---------- linha de série ---------- */

function SetRow({ ex, set, idx, prev, lang, sugg, pr, readOnly, onPatch, onDone, onMenu, onCopy }: {
  ex: Exercise; set: SetEntry; idx: number; prev?: SetEntry; lang: 'pt' | 'en'; sugg: Suggestion | null;
  pr: boolean; readOnly?: boolean;
  onPatch: (p: Partial<SetEntry>) => void;
  onDone: (p: Partial<SetEntry>) => void;
  onMenu: () => void;
  onCopy: () => void;
}) {
  const f = (n: number | undefined) => (n === undefined ? '' : fmtNum(n, lang, 2));
  const [w, setW] = useState(f(set.weight));
  const [r, setR] = useState(f(set.reps));
  const [rir, setRir] = useState(f(set.rir));
  const [dur, setDur] = useState(ex.kind === 'cardio' ? f(set.durationSec ? set.durationSec / 60 : undefined) : f(set.durationSec));
  const [dist, setDist] = useState(f(set.distanceKm));

  useEffect(() => {
    setW(f(set.weight)); setR(f(set.reps)); setRir(f(set.rir));
    setDur(ex.kind === 'cardio' ? f(set.durationSec ? set.durationSec / 60 : undefined) : f(set.durationSec));
    setDist(f(set.distanceKm));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set.weight, set.reps, set.rir, set.durationSec, set.distanceKm, lang]);

  // marcadores de posição: meta (se sobe de carga) ou o que fizeste da última vez
  const useTarget = sugg?.kind === 'increase';
  const phW = useTarget ? sugg!.weight : prev?.weight;
  const phR = useTarget ? sugg!.reps : prev?.reps;
  const phDur = prev?.durationSec;
  const phDist = prev?.distanceKm;

  const read = (): Partial<SetEntry> => {
    const p: Partial<SetEntry> = {};
    if (ex.kind === 'weight' || ex.kind === 'bodyweight') {
      const wv = parseNum(w);
      p.weight = wv;
      p.reps = parseNum(r) !== undefined ? Math.round(parseNum(r)!) : undefined;
      const rv = parseNum(rir);
      p.rir = rv !== undefined ? Math.max(0, Math.round(rv)) : undefined;
    } else if (ex.kind === 'time') {
      p.durationSec = parseNum(dur);
    } else {
      const m = parseNum(dur);
      p.durationSec = m !== undefined ? Math.round(m * 60) : undefined;
      p.distanceKm = parseNum(dist);
    }
    return p;
  };

  const commit = () => {
    const p = read();
    const changed = (Object.keys(p) as (keyof SetEntry)[]).some((k) => p[k] !== set[k]);
    if (changed) onPatch(p);
  };

  const done = () => {
    unlockAudio();
    const p = read();
    if (ex.kind === 'weight' || ex.kind === 'bodyweight') {
      if (p.reps === undefined && phR !== undefined) p.reps = phR;
      if (p.weight === undefined && phW !== undefined && ex.kind === 'weight') p.weight = phW;
      if (p.weight === undefined && ex.kind === 'weight') p.weight = 0;
    } else if (ex.kind === 'time') {
      if (p.durationSec === undefined && phDur !== undefined) p.durationSec = phDur;
    } else {
      if (p.durationSec === undefined && phDur !== undefined) p.durationSec = phDur;
      if (p.distanceKm === undefined && phDist !== undefined) p.distanceKm = phDist;
    }
    onDone(p);
  };

  const hasPrev = prev !== undefined;
  const cls = `srow ${set.done ? 'done' : ''} ${set.warmup ? 'warm' : ''} k-${ex.kind}`;
  return (
    <div className={cls}>
      <button className="s-idx" onClick={onMenu} aria-label="set">
        {pr ? <Icon name="trophy" size={14} /> : set.warmup ? 'A' : idx}
      </button>
      <button className="s-prev" onClick={onCopy} disabled={!hasPrev || set.done || readOnly} title="↩">
        {hasPrev ? prevLabel(ex, prev, lang) : '–'}
      </button>
      {(ex.kind === 'weight' || ex.kind === 'bodyweight') && (
        <>
          <NumInput value={w} onChange={setW} onBlur={commit} placeholder={phW !== undefined ? fmtNum(phW, lang, 2) : ex.kind === 'bodyweight' ? '+' : ''} ariaLabel="kg" />
          <NumInput value={r} onChange={setR} onBlur={commit} inputMode="numeric" placeholder={phR !== undefined ? String(phR) : ''} ariaLabel="reps" />
          <NumInput value={rir} onChange={setRir} onBlur={commit} inputMode="numeric" className="rir" placeholder="·" ariaLabel="RIR" />
        </>
      )}
      {ex.kind === 'time' && (
        <NumInput value={dur} onChange={setDur} onBlur={commit} inputMode="numeric" placeholder={phDur !== undefined ? String(phDur) : 's'} className="wide" ariaLabel="s" />
      )}
      {ex.kind === 'cardio' && (
        <>
          <NumInput value={dur} onChange={setDur} onBlur={commit} placeholder={phDur ? fmtNum(phDur / 60, lang) : 'min'} ariaLabel="min" />
          <NumInput value={dist} onChange={setDist} onBlur={commit} placeholder={phDist ? fmtNum(phDist, lang, 2) : 'km'} ariaLabel="km" />
        </>
      )}
      <button className={`s-check ${set.done ? 'on' : ''}`} onClick={set.done ? () => onPatch({ done: false }) : done} aria-label="done">
        <Icon name="check" size={18} />
      </button>
    </div>
  );
}

/* ---------- ecrã principal ---------- */

export function WorkoutScreen({ id, editing }: { id: number; editing?: boolean }) {
  const { t, lang, settings, exMap, exName, finished, startRest, skipRest, deload } = useApp();
  const toast = useToast();
  const w = useLiveQuery(() => db.workouts.get(id), [id]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [replaceIdx, setReplaceIdx] = useState<number | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [setMenu, setSetMenu] = useState<{ ei: number; si: number } | null>(null);
  const [noteFor, setNoteFor] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [hideDeload, setHideDeload] = useState(() => sessionStorage.getItem('hideDeload') === '1');

  useWakeLock(!editing && settings.keepAwake);

  const prior = useMemo(
    () => (w ? finished.filter((f) => f.id !== w.id && f.startedAt < w.startedAt) : []),
    [finished, w?.id, w?.startedAt]
  );

  const exIdsKey = w?.exercises.map((e) => e.exerciseId).join('|') ?? '';
  const infoMap = useMemo(() => {
    const m = new Map<string, ExInfo>();
    if (!w) return m;
    for (const we of w.exercises) {
      if (m.has(we.exerciseId)) continue;
      const ex = exMap.get(we.exerciseId);
      if (!ex) continue;
      const sessions = exerciseSessions(prior, ex, ex.id);
      const last = sessions.at(-1);
      const rirMin = we.rir ? parseInt(we.rir, 10) : undefined;
      m.set(ex.id, {
        ex,
        last,
        records: computeRecords(sessions),
        stagnant: stagnationSessions(sessions),
        sugg: suggestProgression(ex, last, {
          repMin: we.repMin ?? ex.repMin,
          repMax: we.repMax ?? ex.repMax,
          plannedSets: we.planned,
          rirMin: Number.isFinite(rirMin) ? rirMin : undefined
        })
      });
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prior, exIdsKey, exMap]);

  // volume semanal da semana deste treino (inclui as séries já feitas agora)
  const weekVol = useMemo(() => {
    if (!w) return emptyVolume();
    const from = weekStart(w.startedAt);
    const v = weeklyVolume(prior, exMap, from);
    addWorkoutVolume(v, w.exercises, exMap);
    return v;
  }, [prior, exMap, w]);

  if (!w) return <div className="screen"><Header title="…" onBack /></div>;

  const patch = (fn: (w: Workout) => void) => patchWorkout(id, fn);
  const setPatch = (ei: number, si: number, p: Partial<SetEntry>) =>
    patch((x) => { Object.assign(x.exercises[ei].sets[si], p); });

  const restFor = (we: WorkoutExercise, set: SetEntry) => {
    const ex = exMap.get(we.exerciseId);
    if (set.warmup) return 60;
    return ex?.restSeconds ?? (settings.restIsolation);
  };

  const onDone = (ei: number, si: number, p: Partial<SetEntry>) => {
    const we = w.exercises[ei];
    const ex = exMap.get(we.exerciseId);
    if (!ex) return;
    if ((ex.kind === 'weight' || ex.kind === 'bodyweight') && !p.reps) {
      toast(t('wk.needreps'));
      return;
    }
    void setPatch(ei, si, { ...p, done: true });
    if (editing) return;
    // supersérie: sem descanso enquanto houver o outro exercício por fazer
    if (we.supersetId) {
      const group = w.exercises.map((e, i) => ({ e, i })).filter((g) => g.e.supersetId === we.supersetId);
      const pos = group.findIndex((g) => g.i === ei);
      const next = group[pos + 1];
      if (next && next.e.sets.some((s) => !s.done)) { skipRest(); return; }
    }
    startRest(restFor(we, { ...we.sets[si], ...p }));
  };

  const addSet = (ei: number) =>
    patch((x) => {
      const sets = x.exercises[ei].sets;
      const last = sets.at(-1);
      sets.push({ done: false, ...(last && !last.done ? {} : {}) });
    });

  const addExercises = (ids: string[]) => {
    void patch((x) => {
      for (const eid of ids) {
        const ex = exMap.get(eid);
        if (!ex) continue;
        const n = ex.kind === 'cardio' ? 1 : 3;
        x.exercises.push({ exerciseId: eid, sets: Array.from({ length: n }, () => ({ done: false })), planned: n, repMin: ex.repMin, repMax: ex.repMax });
      }
    });
    setPickerOpen(false);
  };

  const replaceExercise = (ids: string[]) => {
    const ei = replaceIdx;
    setReplaceIdx(null);
    if (ei === null || !ids[0]) return;
    const ex = exMap.get(ids[0]);
    void patch((x) => {
      x.exercises[ei].exerciseId = ids[0];
      x.exercises[ei].repMin = ex?.repMin;
      x.exercises[ei].repMax = ex?.repMax;
      x.exercises[ei].sets = x.exercises[ei].sets.map((s) => (s.done ? s : { done: false }));
    });
  };

  const move = (ei: number, dir: -1 | 1) =>
    patch((x) => {
      const j = ei + dir;
      if (j < 0 || j >= x.exercises.length) return;
      [x.exercises[ei], x.exercises[j]] = [x.exercises[j], x.exercises[ei]];
    });

  const toggleSuperset = (ei: number) =>
    patch((x) => {
      const a = x.exercises[ei];
      const b = x.exercises[ei + 1];
      if (a.supersetId) {
        const sid = a.supersetId;
        for (const e of x.exercises) if (e.supersetId === sid) delete e.supersetId;
        return;
      }
      if (!b) return;
      const sid = b.supersetId ?? newId();
      a.supersetId = sid;
      b.supersetId = sid;
    });

  const doneSets = w.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
  const undoneSets = w.exercises.reduce((n, e) => n + e.sets.filter((s) => !s.done).length, 0);

  const finish = async () => {
    setFinishOpen(false);
    if (doneSets === 0) { setDiscardOpen(true); return; }
    skipRest();
    await finishWorkout(id, { keepEnd: !!editing });
    toast(editing ? t('wk.saved') : t('wk.finished'));
    go(`/workout/${id}`, true);
  };

  const doDiscard = async () => {
    skipRest();
    await discardWorkout(id);
    go('/', true);
  };

  const dismissDeload = () => { sessionStorage.setItem('hideDeload', '1'); setHideDeload(true); };

  return (
    <div className="screen workout">
      <Header
        onBack
        backTo={editing ? `/workout/${id}` : '/'}
        title={
          <button className="title-btn" onClick={() => { setNameDraft(w.name); setRenameOpen(true); }}>
            {w.name || t('wk.untitled')} <Icon name="edit" size={14} />
          </button>
        }
        sub={editing ? new Date(w.startedAt).toLocaleDateString(lang === 'pt' ? 'pt-PT' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : <><Elapsed start={w.startedAt} /> · {doneSets} {t('sets.lc')}</>}
        right={<button className="btn accent sm" onClick={() => setFinishOpen(true)}>{editing ? t('save') : t('finish')}</button>}
      />

      {!editing && deload && !hideDeload && (
        <div className="hint warn">
          <Icon name="warn" size={16} />
          <div>
            <b>{t('deload.title')}</b>
            <div className="muted small">{t('deload.text', { n: deload.declining.length })}</div>
          </div>
          <button className="icon-btn sm" onClick={dismissDeload} aria-label="close"><Icon name="x" size={16} /></button>
        </div>
      )}

      {w.exercises.length === 0 && (
        <div className="empty"><div className="empty-t">{t('wk.empty')}</div></div>
      )}

      {w.exercises.map((we, ei) => {
        const info = infoMap.get(we.exerciseId);
        const ex = info?.ex ?? exMap.get(we.exerciseId);
        if (!ex) return null;
        const last = info?.last;
        const sugg = info?.sugg ?? null;
        const inSuper = !!we.supersetId;
        const prevInGroup = ei > 0 && inSuper && w.exercises[ei - 1].supersetId === we.supersetId;
        const nextInGroup = ei < w.exercises.length - 1 && inSuper && w.exercises[ei + 1].supersetId === we.supersetId;

        // PR: só a melhor série da sessão que bate um recorde anterior
        let prIdx = -1;
        if (info) {
          let best = -1;
          we.sets.forEach((s, si) => {
            if (s.done && !s.warmup && detectPR(ex, info.records, s).length) {
              const sc = setScore(ex, s);
              if (sc > best) { best = sc; prIdx = si; }
            }
          });
        }

        const minSets = ex.primary ? settings.minSets[ex.primary] : undefined;
        const volNow = ex.primary ? weekVol[ex.primary] : 0;
        const rirTxt = we.rir ? ` · RIR ${we.rir}` : '';
        const targetTxt = (ex.kind === 'weight' || ex.kind === 'bodyweight')
          ? `${we.planned ?? we.sets.length} × ${we.repMin ?? ex.repMin}–${we.repMax ?? ex.repMax}${rirTxt}`
          : '';
        const pending = we.sets.some((s) => !s.done && !s.warmup);

        return (
          <section key={ei} className={`ex-card ${prevInGroup ? 'ss-prev' : ''} ${nextInGroup ? 'ss-next' : ''} ${inSuper ? 'ss' : ''}`}>
            <div className="ex-head">
              <div className="ex-title">
                <button className="ex-name" onClick={() => go(`/exercise/${ex.id}`)}>{exName(ex)}</button>
                <div className="ex-meta">
                  {inSuper && <span className="tag">{t('superset')}</span>}
                  {targetTxt && <span>{targetTxt}</span>}
                  {minSets !== undefined && ex.primary && (
                    <span className={`vol ${volNow < minSets ? 'low' : 'ok'}`}>
                      {t(`m.${ex.primary}`)} {fmtNum(volNow, lang)}/{minSets}
                    </span>
                  )}
                </div>
              </div>
              <Menu
                items={[
                  { label: t('wk.replace'), icon: 'repeat', onClick: () => setReplaceIdx(ei) },
                  { label: we.supersetId ? t('wk.unlink') : t('wk.link'), icon: 'link', onClick: () => toggleSuperset(ei) },
                  { label: t('wk.note'), icon: 'edit', onClick: () => { setNoteDraft(we.note ?? ''); setNoteFor(ei); } },
                  ...(ei > 0 ? [{ label: t('wk.moveup'), icon: 'up', onClick: () => move(ei, -1) }] : []),
                  ...(ei < w.exercises.length - 1 ? [{ label: t('wk.movedown'), icon: 'down', onClick: () => move(ei, 1) }] : []),
                  { label: t('wk.remove'), icon: 'trash', danger: true, onClick: () => patch((x) => { x.exercises.splice(ei, 1); }) }
                ]}
              />
            </div>

            {/* alertas discretos */}
            {!editing && (sugg || (info && info.stagnant > 0)) && (
              <div className="ex-hints">
                {sugg?.kind === 'increase' && (
                  <button
                    className="hint-chip accent"
                    onClick={() => patch((x) => {
                      for (const s of x.exercises[ei].sets) if (!s.done && !s.warmup) { s.weight = sugg.weight; s.reps = sugg.reps; }
                    })}
                  >
                    <Icon name="arrowUp" size={13} />
                    {sugg.extra ? t('prog.extra', { w: fmtNum(sugg.weight, lang) }) : t('prog.up', { w: fmtNum(sugg.weight, lang), r: sugg.reps })}
                  </button>
                )}
                {sugg?.kind === 'hold' && pending && (
                  <button
                    className="hint-chip"
                    onClick={() => patch((x) => {
                      for (const s of x.exercises[ei].sets) if (!s.done && !s.warmup) { s.weight = sugg.weight; s.reps = sugg.reps; }
                    })}
                  >
                    {t('prog.hold', { w: fmtNum(sugg.weight, lang), r: sugg.reps })}
                  </button>
                )}
                {info && info.stagnant > 0 && (
                  <span className="hint-chip warn">{t('stag', { n: info.stagnant })}</span>
                )}
              </div>
            )}

            {we.note && <div className="ex-note">{we.note}</div>}

            <div className={`sets-head k-${ex.kind}`}>
              <span>{t('set')}</span>
              <span>{t('previous')}</span>
              {(ex.kind === 'weight' || ex.kind === 'bodyweight') && <><span>{ex.kind === 'bodyweight' ? '+kg' : 'kg'}</span><span>reps</span><span>RIR</span></>}
              {ex.kind === 'time' && <span>{t('seconds')}</span>}
              {ex.kind === 'cardio' && <><span>min</span><span>km</span></>}
              <span />
            </div>

            {(() => {
              let n = 0;
              return we.sets.map((s, si) => {
                if (!s.warmup) n++;
                const pi = si < (last?.sets.length ?? 0) ? si : (last?.sets.length ?? 1) - 1;
                const prev = last?.sets[pi];
                return (
                  <SetRow
                    key={si}
                    ex={ex}
                    set={s}
                    idx={n}
                    prev={prev}
                    lang={lang}
                    sugg={sugg}
                    pr={si === prIdx}
                    readOnly={false}
                    onPatch={(p) => setPatch(ei, si, p)}
                    onDone={(p) => onDone(ei, si, p)}
                    onMenu={() => setSetMenu({ ei, si })}
                    onCopy={() => prev && setPatch(ei, si, {
                      weight: prev.weight, reps: prev.reps, durationSec: prev.durationSec, distanceKm: prev.distanceKm
                    })}
                  />
                );
              });
            })()}

            <button className="add-set" onClick={() => addSet(ei)}><Icon name="plus" size={15} /> {t('wk.addset')}</button>
          </section>
        );
      })}

      <button className="btn ghost block" onClick={() => setPickerOpen(true)}><Icon name="plus" size={16} /> {t('wk.addex')}</button>
      {!editing && (
        <button className="btn danger-ghost block" onClick={() => setDiscardOpen(true)}>{t('wk.discard')}</button>
      )}

      <ExercisePicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={addExercises} />
      <ExercisePicker open={replaceIdx !== null} onClose={() => setReplaceIdx(null)} onPick={replaceExercise} />

      <Sheet open={finishOpen} onClose={() => setFinishOpen(false)} title={editing ? t('wk.save.title') : t('wk.finish.title')}>
        <p className="muted" style={{ marginTop: 0 }}>
          {t('wk.finish.sum', { n: doneSets })}
          {undoneSets > 0 && <> {t('wk.finish.drop', { n: undoneSets })}</>}
        </p>
        <div className="row gap">
          <button className="btn ghost grow" onClick={() => setFinishOpen(false)}>{t('wk.continue')}</button>
          <button className="btn accent grow" onClick={finish}>{editing ? t('save') : t('finish')}</button>
        </div>
      </Sheet>

      <ConfirmSheet
        open={discardOpen}
        title={t('wk.discard.title')}
        text={t('wk.discard.text')}
        confirm={t('wk.discard')}
        cancel={t('cancel')}
        danger
        onClose={() => setDiscardOpen(false)}
        onConfirm={doDiscard}
      />

      <Sheet open={renameOpen} onClose={() => setRenameOpen(false)} title={t('wk.rename')}>
        <input className="inp" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} autoFocus />
        <button className="btn accent block" style={{ marginTop: 12 }} onClick={() => { void patch((x) => { x.name = nameDraft.trim() || x.name; }); setRenameOpen(false); }}>{t('save')}</button>
      </Sheet>

      <Sheet open={noteFor !== null} onClose={() => setNoteFor(null)} title={t('wk.note')}>
        <textarea className="inp" rows={3} value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} />
        <button
          className="btn accent block"
          style={{ marginTop: 12 }}
          onClick={() => { const i = noteFor!; void patch((x) => { x.exercises[i].note = noteDraft.trim() || undefined; }); setNoteFor(null); }}
        >{t('save')}</button>
      </Sheet>

      <Sheet open={setMenu !== null} onClose={() => setSetMenu(null)}>
        {setMenu && (
          <div className="menu">
            <button className="menu-item" onClick={() => { void setPatch(setMenu.ei, setMenu.si, { warmup: !w.exercises[setMenu.ei].sets[setMenu.si].warmup }); setSetMenu(null); }}>
              {w.exercises[setMenu.ei].sets[setMenu.si]?.warmup ? t('set.working') : t('set.warmup')}
            </button>
            <button className="menu-item danger" onClick={() => { const { ei, si } = setMenu; void patch((x) => { x.exercises[ei].sets.splice(si, 1); }); setSetMenu(null); }}>
              <Icon name="trash" /> {t('set.remove')}
            </button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

export { DAY_MS };
