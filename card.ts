import type { Exercise, SetEntry, Workout } from '../types';
import { fmtDuration, fmtNum, isWorking, setScore, workoutDurationSec, workoutPRs, workoutTotals } from './calc';

export interface CardRow {
  name: string;
  detail: string;
  pr: boolean;
}

export interface CardModel {
  title: string;
  date: string;
  stats: { value: string; label: string }[];
  rows: CardRow[];
  more: number;
}

export const CARD_MAX_ROWS = 7;

/** Texto da melhor série de um exercício (sem RIR). */
export function bestSetText(ex: Exercise | undefined, sets: SetEntry[], lang: 'pt' | 'en'): string {
  if (!ex) return '';
  const work = sets.filter(isWorking);
  if (!work.length) return '';
  const best = work.reduce((a, b) => (setScore(ex, b) > setScore(ex, a) ? b : a));
  if (ex.kind === 'time') return `${best.durationSec ?? 0} s`;
  if (ex.kind === 'cardio') {
    const min = fmtNum((best.durationSec ?? 0) / 60, lang);
    return `${min} min${best.distanceKm ? ` · ${fmtNum(best.distanceKm, lang, 2)} km` : ''}`;
  }
  if (ex.kind === 'bodyweight' && !best.weight) return `${best.reps ?? 0} reps`;
  return `${fmtNum(best.weight ?? 0, lang)} kg × ${best.reps ?? 0}`;
}

export function buildCardModel(
  w: Workout,
  all: Workout[],
  exMap: Map<string, Exercise>,
  lang: 'pt' | 'en',
  exName: (e: Exercise | undefined) => string,
  labels: { duration: string; sets: string; volume: string; setsLc: string; prs: string }
): CardModel {
  const tot = workoutTotals(w, exMap);
  const prs = workoutPRs(w, all, exMap);
  const prIds = new Set(prs.map((p) => p.exerciseId));
  const rows: CardRow[] = [];
  for (const we of w.exercises) {
    const ex = exMap.get(we.exerciseId);
    const n = we.sets.filter(isWorking).length;
    if (!n) continue;
    rows.push({ name: exName(ex), detail: `${n} ${labels.setsLc} · ${bestSetText(ex, we.sets, lang)}`, pr: prIds.has(we.exerciseId) });
  }
  const loc = lang === 'pt' ? 'pt-PT' : 'en-GB';
  const stats = [
    { value: fmtDuration(workoutDurationSec(w)), label: labels.duration },
    { value: String(tot.sets), label: labels.sets },
    { value: `${fmtNum(tot.volume / 1000, lang, 1)} t`, label: labels.volume }
  ];
  return {
    title: w.name,
    date: new Date(w.startedAt).toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    stats,
    rows: rows.slice(0, CARD_MAX_ROWS),
    more: Math.max(0, rows.length - CARD_MAX_ROWS)
  };
}

/* ---------- desenho ---------- */

const W = 1080;
const H = 1350;
const C = { bg: '#0a1020', surface: '#121b30', line: '#2c3d5f', text: '#e8edf7', muted: '#8794ae', accent: '#7aa2f7', onAccent: '#07101f' };
const SANS = '"Inter Variable", -apple-system, "Segoe UI", sans-serif';
const SERIF = '"Cormorant Garamond", Georgia, serif';

function fit(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxW) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}

export async function renderCard(m: CardModel, moreLabel: string, prLabel: string): Promise<Blob> {
  try {
    await Promise.all([
      document.fonts.load(`600 40px ${SANS}`),
      document.fonts.load(`600 80px ${SERIF}`)
    ]);
  } catch { /* usa as fontes de reserva */ }
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  const PAD = 80;

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.accent;
  ctx.fillRect(0, 0, W, 10);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.accent;
  ctx.font = `600 28px ${SANS}`;
  ctx.fillText("SIMON'S FIT", PAD, 110);

  ctx.fillStyle = C.text;
  ctx.font = `600 92px ${SERIF}`;
  ctx.fillText(fit(ctx, m.title, W - PAD * 2), PAD, 225);
  ctx.fillStyle = C.muted;
  ctx.font = `400 32px ${SANS}`;
  ctx.fillText(fit(ctx, m.date, W - PAD * 2), PAD, 282);

  // estatísticas
  const bw = (W - PAD * 2 - 40) / 3;
  m.stats.forEach((s, i) => {
    const x = PAD + i * (bw + 20);
    ctx.fillStyle = C.surface;
    ctx.fillRect(x, 340, bw, 170);
    ctx.fillStyle = C.accent;
    ctx.font = `600 62px ${SERIF}`;
    ctx.fillText(fit(ctx, s.value, bw - 40), x + 24, 430);
    ctx.fillStyle = C.muted;
    ctx.font = `500 26px ${SANS}`;
    ctx.fillText(s.label.toUpperCase(), x + 24, 480);
  });

  // exercícios: nome numa linha, detalhe por baixo
  let y = 590;
  const rowH = 100;
  m.rows.forEach((r) => {
    ctx.fillStyle = C.text;
    ctx.font = `600 38px ${SANS}`;
    let nameMax = W - PAD * 2;
    if (r.pr) {
      ctx.font = `700 22px ${SANS}`;
      const bwid = ctx.measureText(prLabel).width + 24;
      ctx.fillStyle = C.accent;
      ctx.fillRect(W - PAD - bwid, y - 30, bwid, 38);
      ctx.fillStyle = C.onAccent;
      ctx.textAlign = 'center';
      ctx.fillText(prLabel, W - PAD - bwid / 2, y - 4);
      ctx.textAlign = 'left';
      nameMax -= bwid + 20;
    }
    ctx.fillStyle = C.text;
    ctx.font = `600 38px ${SANS}`;
    ctx.fillText(fit(ctx, r.name, nameMax), PAD, y);
    ctx.fillStyle = C.muted;
    ctx.font = `400 29px ${SANS}`;
    ctx.fillText(fit(ctx, r.detail, W - PAD * 2), PAD, y + 40);
    ctx.fillStyle = C.line;
    ctx.fillRect(PAD, y + 58, W - PAD * 2, 2);
    y += rowH;
  });
  if (m.more > 0) {
    ctx.fillStyle = C.muted;
    ctx.font = `400 30px ${SANS}`;
    ctx.fillText(moreLabel.replace('{n}', String(m.more)), PAD, y);
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('blob'))), 'image/png');
  });
}
