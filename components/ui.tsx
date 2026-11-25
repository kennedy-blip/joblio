'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import type { GeoTier, Level, Stage } from '@/lib/types';
import { GEO_GLYPH, GEO_LABEL } from '@/lib/geo';
import { GEO_TONE, LEVEL_LABEL, STAGE_LABEL, STAGE_TONE } from '@/lib/format';

export function GeoStamp({ tier, title }: { tier: GeoTier; title?: string }) {
  return (
    <span className={`stamp ${GEO_TONE[tier]}`} title={title}>
      <span aria-hidden>{GEO_GLYPH[tier]}</span>
      {GEO_LABEL[tier]}
    </span>
  );
}

export function LevelTag({ level }: { level: Level }) {
  return (
    <span
      className={`stamp ${
        level === 'entry'
          ? 'border-pine/30 bg-pineSoft/60 text-pine'
          : level === 'senior'
            ? 'border-ink/25 bg-black/[0.04] text-ink'
            : 'border-hairline bg-white/60 text-muted'
      }`}
    >
      {LEVEL_LABEL[level]}
    </span>
  );
}

export function StageTag({ stage }: { stage: Stage }) {
  return <span className={`stamp ${STAGE_TONE[stage]}`}>{STAGE_LABEL[stage]}</span>;
}

/**
 * Coverage is a term-overlap meter, not a "fit score". Twelve ticks so it reads
 * as a measurement instead of a grade.
 */
export function CoverageMeter({
  coverage,
  matched,
  required,
  size = 'md',
}: {
  coverage: number | null;
  matched?: number;
  required?: number;
  size?: 'sm' | 'md';
}) {
  const filled = coverage === null ? 0 : Math.round((coverage / 100) * 12);
  return (
    <div
      className="flex items-center gap-2"
      title={
        coverage === null
          ? 'No recognisable terms in this posting — not scored, rather than scored zero'
          : `${matched ?? '—'} of ${required ?? '—'} recognised terms appear in your profile`
      }
    >
      <div className="ticks" aria-hidden>
        {Array.from({ length: 12 }).map((_, i) => (
          <span key={i} className={`tick ${size === 'sm' ? 'h-2.5' : 'h-3'}`} data-on={i < filled} />
        ))}
      </div>
      <span className="font-mono text-[11px] tabular-nums text-muted">
        {coverage === null ? 'not scored' : `${coverage}%`}
      </span>
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`h-4 w-4 animate-spin ${className}`} aria-hidden />;
}

export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-start gap-3 px-6 py-10">
      {icon ? <div className="text-muted">{icon}</div> : null}
      <h3 className="text-2xl">{title}</h3>
      <p className="max-w-prose text-sm leading-relaxed text-muted">{body}</p>
      {action}
    </div>
  );
}

export function Stat({ value, label, hint }: { value: string; label: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-serif text-2xl leading-none">{value}</span>
      <span className="label">{label}</span>
      {hint ? <span className="text-[11px] text-muted/80">{hint}</span> : null}
    </div>
  );
}

export function Toast({
  message,
  tone = 'neutral',
  action,
  onDismiss,
  duration = 6000,
}: {
  message: string;
  tone?: 'neutral' | 'good' | 'warn';
  action?: { label: string; onClick: () => void };
  onDismiss?: () => void;
  duration?: number;
}) {
  useEffect(() => {
    if (!duration) return;
    const t = setTimeout(() => onDismiss?.(), duration);
    return () => clearTimeout(t);
  }, [duration, onDismiss]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 sm:bottom-8">
      <div
        className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-full border px-4 py-2.5 text-[13px] shadow-lift animate-rise ${
          tone === 'good'
            ? 'border-pine/30 bg-pine text-paper'
            : tone === 'warn'
              ? 'border-signal/30 bg-signalSoft text-signal'
              : 'border-hairline bg-card text-ink'
        }`}
        role="status"
      >
        {tone === 'good' ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : null}
        <span className="leading-snug">{message}</span>
        {action ? (
          <button
            type="button"
            onClick={action.onClick}
            className="shrink-0 rounded-full border border-current/30 px-2.5 py-1 text-[12px] font-medium underline-offset-2 hover:underline"
          >
            {action.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1 flex items-baseline justify-between gap-3">
      <span className="label">{children}</span>
      {hint ? <span className="text-[11px] text-muted/80">{hint}</span> : null}
    </div>
  );
}

export function SplitStat({ items }: { items: { label: string; value: string }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
      {items.map((i) => (
        <div key={i.label}>
          <dt className="label">{i.label}</dt>
          <dd className="mt-0.5 text-[13px] leading-snug">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function useSavedFlash() {
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!savedAt) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [savedAt]);
  const label = savedAt ? `Saved ${Math.max(0, Math.round((Date.now() - savedAt) / 1000))}s ago` : null;
  return { label, markSaved: () => setSavedAt(Date.now()), tick };
}
