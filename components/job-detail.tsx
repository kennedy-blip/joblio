'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  BookmarkCheck,
  Check,
  CircleSlash,
  FileText,
  Info,
  Plus,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useSession } from '@/components/session-provider';
import { CoverageMeter, GeoStamp, LevelTag, Toast } from '@/components/ui';
import { GEO_FALLBACK, explainGeography } from '@/lib/geo';
import { clockTime, safeExternalUrl, shortDate, timeAgo } from '@/lib/format';
import { matchJob } from '@/lib/tailor';
import { TailorRefusedError, requestTailor } from '@/lib/tailor-client';
import { htmlToText } from '@/lib/keywords';
import type { ApplicationRow, Job, Profile } from '@/lib/types';

export function JobDetail({ id }: { id: string }) {
  const { store, ready, mode } = useSession();
  const router = useRouter();

  const [job, setJob] = useState<Job | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [application, setApplication] = useState<ApplicationRow | null>(null);
  const [tailoring, setTailoring] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'neutral' | 'good' | 'warn' } | null>(null);
  const [addedTerms, setAddedTerms] = useState<string[]>([]);

  const load = useCallback(async () => {
    const [row, prof, apps] = await Promise.all([store.getJob(id), store.getProfile(), store.listApplications()]);
    setJob(row);
    setProfile(prof);
    setApplication(apps.find((a) => a.job_id === id) ?? null);
  }, [store, id]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  const match = useMemo(() => (job && profile ? matchJob(profile, job) : null), [job, profile]);
  // The stored tier comes from the full posting; a fresh explanation may only
  // have the fields this page received. Never show a badge and a reason that
  // contradict each other.
  const geoReason = useMemo(() => {
    if (!job) return '';
    const explained = explainGeography(job.location, job.title, job.description);
    return explained.tier === job.geo_tier ? explained.reason : GEO_FALLBACK[job.geo_tier];
  }, [job]);

  async function addSkill(term: string) {
    if (!profile) return;
    const display = term.replace(/\b\w/g, (c) => c.toUpperCase());
    const next: Profile = { ...profile, skills: [...profile.skills, display] };
    await store.saveProfile(next);
    setProfile(next);
    setAddedTerms((prev) => [...prev, term]);
    setToast({ message: `Added "${display}" to your skills — coverage updated.`, tone: 'good' });
  }

  async function save() {
    if (!job) return;
    const row = await store.saveApplication({
      id: application?.id,
      job_id: job.id,
      job_title: job.title,
      company: job.company,
      apply_url: job.apply_url,
      stage: application?.stage ?? 'saved',
    });
    setApplication(row);
    setToast({ message: 'Saved to Applications.', tone: 'good' });
  }

  async function tailor() {
    if (!job || !profile || !match) return;
    setTailoring(true);
    try {
      const result = await requestTailor(profile, job);
      const resume = await store.createResume({
        job,
        model: result.model,
        coverage: result.match.coverage,
        matched: result.match.matched,
        missing: result.match.missing,
        profile,
      });
      await store.saveApplication({
        id: application?.id,
        job_id: job.id,
        resume_id: resume.id,
        job_title: job.title,
        company: job.company,
        apply_url: job.apply_url,
        stage: application?.stage ?? 'saved',
      });
      router.push(`/editor/${resume.id}`);
    } catch (e) {
      const message =
        e instanceof TailorRefusedError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Tailoring failed';
      setToast({ message, tone: 'warn' });
    } finally {
      setTailoring(false);
    }
  }

  if (job === undefined) {
    return <div className="py-20 text-center text-sm text-muted">Loading posting…</div>;
  }

  if (job === null) {
    return (
      <div className="card mt-8 px-6 py-12 text-center">
        <h2 className="text-2xl">That posting is not here.</h2>
        <p className="mx-auto mt-2 max-w-md text-[13px] text-muted">
          It may have been marked inactive after disappearing from its source for several syncs.
        </p>
        <Link href="/" className="btn btn-primary mt-5">
          Back to Discover
        </Link>
      </div>
    );
  }

  const applyUrl = safeExternalUrl(job.apply_url);
  const sourceUrl = safeExternalUrl(job.source_url);
  const description = htmlToText(job.description ?? '');
  const paragraphs = description.split(/\n{1,}/).filter((p) => p.trim().length > 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3 pt-1">
        <button onClick={() => router.back()} className="btn btn-quiet btn-xs -ml-2">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
          {job.source} · seen {timeAgo(job.last_seen_at)}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-5">
          <header className="card px-5 py-5 sm:px-6">
            <div className="flex flex-wrap items-center gap-1.5">
              <GeoStamp tier={job.geo_tier} title={geoReason} />
              <LevelTag level={job.level} />
              {job.job_type ? <span className="chip-tiny">{job.job_type}</span> : null}
              {job.salary ? <span className="chip-tiny">{job.salary}</span> : null}
              {job.years_min ? <span className="chip-tiny">{job.years_min}+ years</span> : null}
            </div>
            <h1 className="mt-3 text-balance text-[30px] leading-[1.08] sm:text-[36px]">{job.title}</h1>
            <p className="mt-1.5 text-[14px] text-muted">
              <span className="text-ink">{job.company}</span>
              {job.location ? ` · ${job.location}` : ''}
              {job.posted_at ? ` · posted ${timeAgo(job.posted_at)}` : ''}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {applyUrl ? (
                <a href={applyUrl} target="_blank" rel="noreferrer noopener" className="btn btn-primary">
                  Apply on {job.source} <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              ) : (
                <span className="btn cursor-not-allowed opacity-60">No usable apply link</span>
              )}
              <button className="btn" onClick={() => void save()} disabled={Boolean(application)}>
                {application ? <BookmarkCheck className="h-4 w-4 text-pine" /> : <Bookmark className="h-4 w-4" />}
                {application ? 'Saved' : 'Save'}
              </button>
              {sourceUrl ? (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="btn btn-quiet btn-xs"
                  title={`Original listing on ${job.source}`}
                >
                  Original listing ↗
                </a>
              ) : null}
            </div>
          </header>

          <section className="card px-5 py-5 sm:px-6">
            <header className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-xl">The posting</h2>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                plain text · untrusted source
              </span>
            </header>
            <div className="space-y-3 text-[14px] leading-relaxed text-ink/90">
              {paragraphs.length ? (
                paragraphs.map((p, i) => <p key={i}>{p}</p>)
              ) : (
                <p className="text-muted">This posting has no description body.</p>
              )}
            </div>
            <p className="mt-5 border-t border-hairline pt-3 text-[11px] leading-relaxed text-muted">
              Text as published by {job.source}. JobFlow strips formatting and never renders remote HTML. Attribution
              and the original link are kept as the source terms require.
            </p>
          </section>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
          <section className="card px-4 py-4">
            <h2 className="label mb-2">Eligibility</h2>
            <div className="flex items-center gap-2">
              <GeoStamp tier={job.geo_tier} />
              <span className="text-[12px] text-muted">{job.location || 'no location field'}</span>
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{geoReason}</p>
            {job.geo_tier === 'region_restricted' || job.geo_tier === 'blocked' ? (
              <p className="mt-2 flex gap-1.5 rounded-lg bg-signalSoft/60 px-2.5 py-2 text-[11.5px] leading-relaxed text-signal">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Applying here usually means a work-authorisation problem. Read the posting before spending time.
              </p>
            ) : null}
          </section>

          <section className="card px-4 py-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="label">Keyword coverage</h2>
              {match ? (
                <CoverageMeter coverage={match.coverage} matched={match.matched.length} required={match.required.length} />
              ) : null}
            </div>

            {!profile ? (
              <div className="text-[12.5px] text-muted">
                Add a profile to see which terms you can back up.{' '}
                <Link href="/onboarding" className="link-underline text-ink">
                  Start here
                </Link>
                .
              </div>
            ) : !match || match.required.length === 0 ? (
              <p className="text-[12.5px] leading-relaxed text-muted">
                Not enough shared terms to score. This happens with postings whose language is outside the skills
                vocabulary — it is <em>not</em> a 0% match.
              </p>
            ) : (
              <>
                <p className="mb-2 text-[12px] text-muted">
                  {match.matched.length} of {match.required.length} recognised terms appear in your profile.
                  {typeof match.coverage === 'number' ? null : ' Unscored.'}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {match.matched.map((term) => (
                    <span
                      key={term}
                      className="inline-flex items-center gap-1 rounded-md border border-pine/25 bg-pineSoft/70 px-1.5 py-0.5 text-[11.5px] text-pine"
                    >
                      <Check className="h-3 w-3" /> {term}
                    </span>
                  ))}
                </div>

                {match.missing.length ? (
                  <>
                    <h3 className="label mt-3 mb-1.5">Not found in your profile</h3>
                    <p className="mb-2 text-[11px] leading-relaxed text-muted">
                      A term missing here does not mean you lack the skill — only that you have not written it down.
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {match.missing.map((term) => {
                        const added = addedTerms.includes(term);
                        return (
                          <button
                            key={term}
                            onClick={() => void addSkill(term)}
                            disabled={added}
                            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11.5px] transition-colors ${
                              added
                                ? 'border-pine/30 bg-pineSoft text-pine'
                                : 'border-hairline bg-white/70 text-muted hover:border-ink/25 hover:text-ink'
                            }`}
                            title={added ? 'Already in your skills' : 'I genuinely have this — add it to my skills'}
                          >
                            {added ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                            {term}
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-[11.5px] text-pine">Every recognised term is already in your profile.</p>
                )}
              </>
            )}

            {match?.yearsRequired ? (
              <p className="mt-3 flex items-center gap-1.5 border-t border-hairline pt-2 text-[12px] text-muted">
                <CircleSlash className="h-3.5 w-3.5" /> Posting asks for {match.yearsRequired}+ years of experience.
              </p>
            ) : null}
          </section>

          <section className="card px-4 py-4">
            <h2 className="label mb-2">Tailor a resume</h2>
            <p className="text-[12.5px] leading-relaxed text-muted">
              The engine reorders and hides your bullets, and writes a summary from your own facts. It cannot invent a
              bullet, a skill, a date or a degree.
            </p>
            <button
              className="btn btn-primary mt-3 w-full"
              onClick={() => void tailor()}
              disabled={!profile || tailoring}
            >
              {tailoring ? <Sparkles className="h-4 w-4 animate-pulse" /> : <FileText className="h-4 w-4" />}
              {tailoring ? 'Tailoring…' : 'Tailor my resume'}
            </button>
            {!profile ? (
              <p className="mt-2 text-[11px] text-signal">Needs a profile first.</p>
            ) : (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
                <ShieldCheck className="h-3.5 w-3.5 text-pine" />
                Invariant checked before anything is saved.
              </p>
            )}
          </section>

          <section className="card-flat px-4 py-3 text-[11px] leading-relaxed text-muted">
            <p>
              Source: <span className="text-ink">{job.source}</span>
              {job.posted_at ? ` · posted ${shortDate(job.posted_at)}` : ''}
              {job.last_seen_at ? ` · last seen ${clockTime(job.last_seen_at)}` : ''}
            </p>
            {mode === 'local' ? <p className="mt-1">Sample posting bundled for local mode.</p> : null}
          </section>
        </aside>
      </div>

      {toast ? <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} /> : null}
    </div>
  );
}
