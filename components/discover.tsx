'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, useDeferredValue } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  ChevronDown,
  Filter,
  RefreshCw,
  Search,
  Sparkles,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useSession } from '@/components/session-provider';
import { CoverageMeter, GeoStamp, LevelTag, Toast } from '@/components/ui';
import { GEO_DEFAULT, GEO_GLYPH, GEO_LABEL } from '@/lib/geo';
import { LEVEL_LABEL, clockTime, safeExternalUrl, timeAgo } from '@/lib/format';
import { matchJob } from '@/lib/tailor';
import { SAMPLE_PROFILE } from '@/lib/sample';
import type { GeoTier, Job, Level, MatchResult, Profile } from '@/lib/types';

type SortKey = 'newest' | 'coverage';
const GEO_TIERS: GeoTier[] = ['worldwide', 'africa_eligible', 'region_restricted', 'unknown', 'blocked'];
const LEVELS: Level[] = ['entry', 'mid', 'senior'];
const COOLDOWN_MS = 10 * 60 * 1000;

export function Discover() {
  const { store, mode, ready, notice } = useSession();
  const router = useRouter();

  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [geo, setGeo] = useState<GeoTier[]>(GEO_DEFAULT);
  const [levels, setLevels] = useState<Level[]>([]);
  const [source, setSource] = useState<string>('all');
  const [sort, setSort] = useState<SortKey>('newest');
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [tick, setTick] = useState(0);
  const [buffered, setBuffered] = useState<Job[]>([]);
  const [toast, setToast] = useState<{ message: string; tone: 'neutral' | 'good' | 'warn' } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const [rows, prof, synced] = await Promise.all([
        store.listJobs(),
        store.getProfile(),
        store.lastSynced(),
      ]);
      setJobs(rows);
      setProfile(prof);
      setLastSynced(synced);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load postings');
      setJobs([]);
    }
  }, [store]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  useEffect(() => {
    const stored = Number(window.localStorage.getItem('jobflow.cooldown') ?? 0);
    if (stored > Date.now()) setCooldownUntil(stored);
  }, []);

  useEffect(() => {
    const unsub = store.onNewJobs((job) => {
      setBuffered((prev) => (prev.some((j) => j.id === job.id) ? prev : [job, ...prev]));
    });
    return unsub;
  }, [store]);

  useEffect(() => {
    if (buffered.length) {
      setToast({
        message: `${buffered.length} new ${buffered.length === 1 ? 'posting' : 'postings'} synced`,
        tone: 'good',
      });
    }
  }, [buffered.length]);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const matches = useMemo(() => {
    const map = new Map<string, MatchResult>();
    if (!jobs || !profile) return map;
    for (const job of jobs) map.set(job.id, matchJob(profile, job));
    return map;
  }, [jobs, profile]);

  const counts = useMemo(() => {
    const base = { worldwide: 0, africa_eligible: 0, region_restricted: 0, blocked: 0, unknown: 0 } as Record<
      GeoTier,
      number
    >;
    for (const j of jobs ?? []) base[j.geo_tier] = (base[j.geo_tier] ?? 0) + 1;
    return base;
  }, [jobs]);

  const sources = useMemo(() => {
    const set = new Set((jobs ?? []).map((j) => j.source).filter(Boolean));
    return [...set].sort();
  }, [jobs]);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    let rows = (jobs ?? []).filter((job) => {
      if (geo.length && !geo.includes(job.geo_tier)) return false;
      if (levels.length && !levels.includes(job.level)) return false;
      if (source !== 'all' && job.source !== source) return false;
      if (q) {
        const haystack = `${job.title} ${job.company} ${job.location ?? ''} ${(job.tags ?? []).join(' ')}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
    if (sort === 'coverage' && profile) {
      rows = [...rows].sort((a, b) => {
        const ca = matches.get(a.id)?.coverage ?? -1;
        const cb = matches.get(b.id)?.coverage ?? -1;
        return cb - ca;
      });
    } else {
      rows = [...rows].sort((a, b) => {
        const ta = a.posted_at ? Date.parse(a.posted_at) : 0;
        const tb = b.posted_at ? Date.parse(b.posted_at) : 0;
        return tb - ta;
      });
    }
    return rows;
  }, [jobs, geo, levels, source, deferredQuery, sort, profile, matches]);

  useEffect(() => {
    setActiveIndex(0);
  }, [deferredQuery, geo, levels, source, sort]);

  const openJob = useCallback(
    (id: string) => {
      router.push(`/job/${id}`);
    },
    [router],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
      if (event.key === '/' && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (typing) return;
      if (event.key === 'j' || event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
      }
      if (event.key === 'k' || event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      }
      if (event.key === 'Enter' && filtered[activeIndex]) {
        event.preventDefault();
        openJob(filtered[activeIndex].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [filtered, activeIndex, openJob]);

  async function refresh() {
    if (syncing) return;
    setSyncing(true);
    setToast(null);
    try {
      const result = await store.refreshJobs();
      if (result.status === 'cooldown') {
        const until = Date.now() + COOLDOWN_MS;
        setCooldownUntil(until);
        window.localStorage.setItem('jobflow.cooldown', String(until));
        setToast({ message: result.message, tone: 'warn' });
      } else if (!result.ok) {
        setToast({ message: result.message, tone: 'warn' });
      } else {
        setToast({ message: result.message, tone: 'good' });
        await load();
      }
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : 'Sync failed', tone: 'warn' });
    } finally {
      setSyncing(false);
    }
  }

  async function loadSample() {
    await store.saveProfile({ ...SAMPLE_PROFILE });
    await load();
    setToast({ message: 'Sample profile loaded — coverage now means something.', tone: 'good' });
  }

  const cooldownLeft = Math.max(0, cooldownUntil - Date.now());
  const cooldownLabel =
    cooldownLeft > 0 ? `${Math.floor(cooldownLeft / 60000)}:${String(Math.floor((cooldownLeft % 60000) / 1000)).padStart(2, '0')}` : null;

  const jobsLive = Boolean(lastSynced);

  const syncDot =
    lastSynced && Date.now() - Date.parse(lastSynced) < 3 * 3600_000
      ? 'bg-pine'
      : lastSynced && Date.now() - Date.parse(lastSynced) < 24 * 3600_000
        ? 'bg-ochre'
        : 'bg-muted/50';

  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-4 pt-2">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label mb-2">
              Remote roles open to Kenya · {jobsLive ? 'live from 5 public boards' : 'bundled sample snapshot'}
            </p>
            <h1 className="max-w-2xl text-balance text-[34px] leading-[1.05] sm:text-[42px]">
              Work you can actually get, scored on what you can prove.
            </h1>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <div className="flex items-center gap-2 text-[12px] text-muted">
              <span className={`h-1.5 w-1.5 rounded-full ${syncDot} ${syncing ? 'animate-pulseDot' : ''}`} />
              {lastSynced ? `Last synced ${clockTime(lastSynced)}` : 'Not synced yet'}
            </div>
            <button className="btn btn-xs" onClick={refresh} disabled={syncing || cooldownLeft > 0}>
              {syncing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {cooldownLabel ? `Refresh in ${cooldownLabel}` : syncing ? 'Syncing…' : 'Refresh'}
            </button>
          </div>
        </div>

        {notice ? (
          <div className="flex flex-wrap items-start gap-2 rounded-xl2 border border-ochre/40 bg-ochreSoft/70 px-4 py-3 text-[12.5px] leading-relaxed text-[#6a4d0f]">
            {mode === 'local' ? <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : null}
            <span className="max-w-3xl">{notice}</span>
            {mode === 'local' ? (
              <button onClick={() => void loadSample()} className="btn btn-xs ml-auto">
                Load sample profile
              </button>
            ) : null}
          </div>
        ) : null}

        {!profile && ready ? (
          <div className="card flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-pineSoft text-pine">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[14px] font-medium">Your profile is empty, so nothing is scored yet.</p>
                <p className="text-[12.5px] text-muted">
                  Load a realistic sample to see the whole loop, or paste your own CV in onboarding.
                </p>
              </div>
            </div>
            <div className="flex gap-2 sm:ml-auto">
              <button className="btn btn-xs" onClick={() => void loadSample()}>
                Use sample profile
              </button>
              <Link className="btn btn-xs btn-primary" href="/onboarding">
                Paste my CV
              </Link>
            </div>
          </div>
        ) : null}
      </section>

      <section className="sticky top-14 z-30 -mx-4 border-y border-hairline bg-paper/95 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-xl2 sm:border">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/70" aria-hidden />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, company, skill…"
              className="input py-2 pl-9 pr-9"
              aria-label="Search postings"
            />
            {query ? (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:bg-black/5"
                onClick={() => setQuery('')}
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 sm:block">
                <span className="kbd">/</span>
              </span>
            )}
          </div>

          <button className="btn btn-xs sm:hidden" onClick={() => setShowFilters((v) => !v)}>
            <Filter className="h-3.5 w-3.5" /> Filters
          </button>

          <div className={`${showFilters ? 'flex' : 'hidden'} w-full flex-wrap items-center gap-2 sm:flex sm:w-auto`}>
            {GEO_TIERS.map((tier) => {
              const active = geo.includes(tier);
              return (
                <button
                  key={tier}
                  data-active={active}
                  className="chip py-1"
                  onClick={() => setGeo((list) => toggle(list, tier))}
                  title={`${counts[tier]} postings`}
                >
                  <span aria-hidden>{GEO_GLYPH[tier]}</span>
                  {GEO_LABEL[tier]}
                  <span className="font-mono text-[10px] opacity-60">{counts[tier]}</span>
                </button>
              );
            })}
            <div className="divider hidden h-5 w-px sm:block" />
            {LEVELS.map((level) => (
              <button
                key={level}
                data-active={levels.includes(level)}
                className="chip py-1"
                onClick={() => setLevels((list) => toggle(list, level))}
              >
                {LEVEL_LABEL[level]}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="select hidden sm:block"
              aria-label="Filter by source"
            >
              <option value="all">All sources</option>
              {sources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="select"
              aria-label="Sort postings"
            >
              <option value="newest">Newest</option>
              <option value="coverage">Best term overlap</option>
            </select>
          </div>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline bg-white/40 px-4 py-2.5 sm:px-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            {jobs === null ? 'Loading…' : `${filtered.length} of ${jobs.length} postings`}
            {profile ? ' · scored on title + tags, open a posting for the full body' : ' · add a profile to score'}
          </p>
          <p className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted sm:flex">
            <span className="kbd">j</span>
            <span className="kbd">k</span>
            move
            <span className="kbd">↵</span>
            open
          </p>
        </div>

        {error ? (
          <div className="px-5 py-10 text-sm text-signal">{error}</div>
        ) : jobs === null ? (
          <SkeletonRows />
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-lg">No postings match those filters.</p>
            <p className="mt-1 text-[13px] text-muted">
              Try clearing the level filter, or widening eligibility to include region-locked roles.
            </p>
            <button
              className="btn btn-xs mt-4"
              onClick={() => {
                setGeo([...GEO_TIERS]);
                setLevels([]);
                setSource('all');
                setQuery('');
              }}
            >
              Reset filters
            </button>
          </div>
        ) : (
          <ul>
            {filtered.map((job, index) => (
              <li key={job.id}>
                <JobRow
                  job={job}
                  match={matches.get(job.id)}
                  hasProfile={Boolean(profile)}
                  index={index}
                  active={index === activeIndex}
                  onHover={() => setActiveIndex(index)}
                  onOpen={() => openJob(job.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="pb-2 text-[11px] leading-relaxed text-muted">
        Postings are aggregated from RemoteOK, WeWorkRemotely, Jobicy, Himalayas and Arbeitnow. Each row keeps its
        original source link and attribution — JobFlow never proxies an application, and it never claims a posting
        is open. Check the source before you invest time.
      </p>

      {toast && buffered.length > 0 ? (
        <Toast
          message={toast.message}
          tone={toast.tone}
          action={{
            label: 'Show',
            onClick: () => {
              setJobs((prev) => [...buffered, ...(prev ?? [])].filter((j, i, arr) => arr.findIndex((x) => x.id === j.id) === i));
              setBuffered([]);
              setToast(null);
            },
          }}
          onDismiss={() => setToast(null)}
        />
      ) : toast ? (
        <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />
      ) : null}
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="divide-y divide-hairline/70">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-5">
          <div className="h-9 w-9 animate-pulse rounded-full bg-black/[0.05]" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/2 animate-pulse rounded bg-black/[0.06]" />
            <div className="h-2.5 w-1/3 animate-pulse rounded bg-black/[0.05]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function JobRow({
  job,
  match,
  hasProfile,
  index,
  active,
  onHover,
  onOpen,
}: {
  job: Job;
  match?: MatchResult;
  hasProfile: boolean;
  index: number;
  active: boolean;
  onHover: () => void;
  onOpen: () => void;
}) {
  const applyUrl = safeExternalUrl(job.apply_url);
  const stale = job.last_seen_at ? Date.now() - Date.parse(job.last_seen_at) > 3 * 864e5 : false;

  return (
    <div
      className="ledger-row cursor-pointer grid-cols-[auto_1fr_auto] items-center sm:grid-cols-[auto_1fr_auto_auto]"
      data-active={active}
      onMouseEnter={onHover}
      onClick={onOpen}
      role="button"
      tabIndex={-1}
      aria-label={`Open ${job.title} at ${job.company}`}
    >
      <span className="hidden font-mono text-[10px] tabular-nums text-muted/60 sm:block">
        {String(index + 1).padStart(2, '0')}
      </span>

      <div className="min-w-0">
        <div className="flex items-start gap-2">
          <h3 className="truncate text-[19px] leading-tight tracking-[-0.01em]">{job.title}</h3>
          {stale ? <span className="stamp mt-0.5 border-signal/30 bg-signalSoft text-signal">May be closed</span> : null}
        </div>
        <p className="mt-0.5 truncate text-[12.5px] text-muted">
          <span className="text-ink/80">{job.company}</span>
          {job.location ? <span> · {job.location}</span> : null}
          {job.salary ? <span> · {job.salary}</span> : null}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <GeoStamp tier={job.geo_tier} />
          <LevelTag level={job.level} />
          {job.job_type ? <span className="chip-tiny">{job.job_type}</span> : null}
          {job.source ? <span className="chip-tiny">{job.source}</span> : null}
          {job.years_min ? <span className="chip-tiny">{job.years_min}+ yrs</span> : null}
        </div>
      </div>

      <div className="hidden flex-col items-end gap-1 sm:flex">
        {hasProfile ? (
          <CoverageMeter coverage={match?.coverage ?? null} matched={match?.matched.length} required={match?.required.length} />
        ) : (
          <span className="text-[11px] text-muted">no profile</span>
        )}
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted/70">
          {timeAgo(job.posted_at)}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <div className="flex flex-col items-end gap-1 sm:hidden">
          {hasProfile ? (
            <CoverageMeter coverage={match?.coverage ?? null} size="sm" />
          ) : null}
          <span className="font-mono text-[10px] text-muted/70">{timeAgo(job.posted_at)}</span>
        </div>
        {applyUrl ? (
          <a
            href={applyUrl}
            target="_blank"
            rel="noreferrer noopener"
            onClick={(e) => e.stopPropagation()}
            className="btn btn-xs hidden sm:inline-flex"
            title="Apply on the original posting"
          >
            Apply <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        ) : null}
        <ChevronDown className="h-4 w-4 -rotate-90 text-muted/50" aria-hidden />
      </div>
    </div>
  );
}
