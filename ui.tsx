import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { back } from '../router';
import { useApp } from '../store';

/* ---------- ícones (traço fino, estilo uniforme) ---------- */
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const paths: Record<string, ReactNode> = {
  home: <><path d="M4 11.5 12 5l8 6.5" /><path d="M6 10.5V19h12v-8.5" /><path d="M10 19v-5h4v5" /></>,
  dumbbell: <><path d="M6.5 8v8M17.5 8v8M3.5 10v4M20.5 10v4M6.5 12h11" /></>,
  list: <><path d="M8 7h12M8 12h12M8 17h12" /><circle cx="4.5" cy="7" r=".8" /><circle cx="4.5" cy="12" r=".8" /><circle cx="4.5" cy="17" r=".8" /></>,
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 7.5V12l3 2" /></>,
  chart: <><path d="M5 19V9M10 19V5M15 19v-7M20 19v-4" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  back: <path d="m14.5 6-6 6 6 6" />,
  next: <path d="m9.5 6 6 6-6 6" />,
  image: <><rect x="4" y="5" width="16" height="14" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="m5 17 5-4.5 3.5 3L16 13l3 3" /></>,
  calendar: <><rect x="4" y="6" width="16" height="14" rx="2" /><path d="M4 10.5h16M9 4v4M15 4v4" /></>,
  more: <><circle cx="5.5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="18.5" cy="12" r="1" /></>,
  up: <path d="m6 14 6-6 6 6" />,
  down: <path d="m6 10 6 6 6-6" />,
  trash: <><path d="M5 7h14M10 7V5h4v2M7 7l.8 12h8.4L17 7" /></>,
  share: <><path d="M12 15V4M8 8l4-4 4 4" /><path d="M5 12v7h14v-7" /></>,
  trophy: <><path d="M8 5h8v5a4 4 0 0 1-8 0V5Z" /><path d="M8 7H5v1.5A3 3 0 0 0 8 11.5M16 7h3v1.5a3 3 0 0 1-3 3.5M12 14v3.5M9 19h6" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0L5.5 12.8a4 4 0 0 0 5.7 5.7l1-1" /></>,
  edit: <><path d="M5 19h3.5L18 9.5 14.5 6 5 15.5V19Z" /><path d="m13 7.5 3.5 3.5" /></>,
  repeat: <><path d="M17 4l3 3-3 3" /><path d="M20 7H8a4 4 0 0 0-4 4M7 20l-3-3 3-3" /><path d="M4 17h12a4 4 0 0 0 4-4" /></>,
  play: <path d="M8 5.5v13l10.5-6.5L8 5.5Z" />,
  arrowUp: <path d="M12 19V6M7 11l5-5 5 5" />,
  warn: <><path d="M12 4 3.5 19h17L12 4Z" /><path d="M12 10v4M12 16.8v.2" /></>,
  download: <><path d="M12 4v11M8 11l4 4 4-4" /><path d="M5 19h14" /></>,
  upload: <><path d="M12 16V5M8 9l4-4 4 4" /><path d="M5 19h14" /></>
};

export function Icon({ name, size = 20 }: { name: keyof typeof paths | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...P}>
      {paths[name]}
    </svg>
  );
}

/* ---------- cabeçalho ---------- */
export function Header({ title, sub, onBack, right, backTo }: {
  title: ReactNode; sub?: ReactNode; onBack?: boolean; right?: ReactNode; backTo?: string;
}) {
  return (
    <header className="hdr">
      <div className="hdr-l">
        {onBack && (
          <button className="icon-btn" onClick={() => back(backTo)} aria-label="back">
            <Icon name="back" />
          </button>
        )}
        <div className="hdr-t">
          <h1>{title}</h1>
          {sub && <div className="hdr-sub">{sub}</div>}
        </div>
      </div>
      <div className="hdr-r">{right}</div>
    </header>
  );
}

/* ---------- folha inferior ---------- */
export function Sheet({ open, onClose, title, children, tall }: {
  open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; tall?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="sheet-wrap" onClick={onClose}>
      <div className={`sheet ${tall ? 'tall' : ''}`} onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="sheet-grab" />
        {title && <div className="sheet-title">{title}</div>}
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmSheet({ open, title, text, confirm, danger, onConfirm, onClose, cancel }: {
  open: boolean; title: string; text?: ReactNode; confirm: string; cancel: string; danger?: boolean;
  onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {text && <p className="muted" style={{ marginTop: 0 }}>{text}</p>}
      <div className="row gap">
        <button className="btn ghost grow" onClick={onClose}>{cancel}</button>
        <button className={`btn grow ${danger ? 'danger' : 'accent'}`} onClick={() => { onConfirm(); onClose(); }}>{confirm}</button>
      </div>
    </Sheet>
  );
}

export function Menu({ items, label }: { items: { label: string; icon?: string; danger?: boolean; onClick: () => void }[]; label?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="icon-btn" onClick={() => setOpen(true)} aria-label="menu">
        {label ?? <Icon name="more" />}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)}>
        <div className="menu">
          {items.map((it, i) => (
            <button
              key={i}
              className={`menu-item ${it.danger ? 'danger' : ''}`}
              onClick={() => { setOpen(false); it.onClick(); }}
            >
              {it.icon && <Icon name={it.icon} />} {it.label}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}

/* ---------- toast ---------- */
const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 2600);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && <div className="toast">{msg}</div>}
    </ToastCtx.Provider>
  );
}

/* ---------- pequenos blocos ---------- */
export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-mark">◦</div>
      <div className="empty-t">{title}</div>
      {text && <div className="muted">{text}</div>}
      {action}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="sec-title">
      <span>{children}</span>
      {right}
    </div>
  );
}

export function MuscleLabel({ m }: { m: string }) {
  const { t } = useApp();
  return <>{t(`m.${m}`)}</>;
}

/** Campo numérico (aceita vírgula). */
export function NumInput({ value, onChange, onBlur, placeholder, className, inputMode = 'decimal', ariaLabel }: {
  value: string; onChange: (v: string) => void; onBlur?: () => void; placeholder?: string; className?: string;
  inputMode?: 'decimal' | 'numeric'; ariaLabel?: string;
}) {
  return (
    <input
      className={`num ${className ?? ''}`}
      inputMode={inputMode}
      enterKeyHint="next"
      autoComplete="off"
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      onFocus={(e) => e.target.select()}
    />
  );
}
