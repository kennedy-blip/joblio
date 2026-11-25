import type { GeoTier, Level, Stage } from './types';

export function timeAgo(input?: string | null): string {
  if (!input) return 'unknown';
  const t = Date.parse(input);
  if (Number.isNaN(t)) return 'unknown';
  const diff = Date.now() - t;
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  return `${months}mo ago`;
}

export function clockTime(input?: string | null): string {
  if (!input) return '—';
  const t = Date.parse(input);
  if (Number.isNaN(t)) return '—';
  return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function shortDate(input?: string | null): string {
  if (!input) return '—';
  const t = Date.parse(input);
  if (Number.isNaN(t)) return '—';
  return new Date(t).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
}

export function coverageText(coverage: number | null): string {
  if (coverage === null || coverage === undefined) return 'Not scored';
  return `${coverage}% term overlap`;
}

export const LEVEL_LABEL: Record<Level, string> = {
  entry: 'Entry / intern',
  mid: 'Mid level',
  senior: 'Senior',
};

export const GEO_TONE: Record<GeoTier, string> = {
  worldwide: 'border-pine/35 text-pine bg-pineSoft',
  africa_eligible: 'border-pine/25 text-pine bg-pineSoft/70',
  region_restricted: 'border-sky/35 text-sky bg-skySoft',
  blocked: 'border-signal/35 text-signal bg-signalSoft',
  unknown: 'border-ochre/45 text-[#7a5a12] bg-ochreSoft',
};

export const STAGE_TONE: Record<Stage, string> = {
  saved: 'border-hairline bg-white text-muted',
  applied: 'border-sky/35 bg-skySoft text-sky',
  screening: 'border-ochre/45 bg-ochreSoft text-[#7a5a12]',
  interview: 'border-pine/35 bg-pineSoft text-pine',
  offer: 'border-pine bg-pine text-paper',
  rejected: 'border-signal/35 bg-signalSoft text-signal',
};

export const STAGE_LABEL: Record<Stage, string> = {
  saved: 'Saved',
  applied: 'Applied',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Closed',
};

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function pluralise(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function safeExternalUrl(url?: string | null): string | null {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : null;
}
