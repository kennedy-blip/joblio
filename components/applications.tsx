'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Briefcase, Download, FileText, Trash2 } from 'lucide-react';
import { useSession } from '@/components/session-provider';
import { CoverageMeter, EmptyState, StageTag, Toast } from '@/components/ui';
import { ConfirmButton } from '@/components/ui-extra';
import { downloadDocx } from '@/lib/docx';
import { STAGE_LABEL, safeExternalUrl, shortDate } from '@/lib/format';
import type { ApplicationRow, ResumeRow, Stage } from '@/lib/types';
import { STAGES } from '@/lib/types';

const STAGE_MESSAGES: Partial<Record<Stage, string>> = {
  applied: 'Marked as applied. Good luck — update the stage when they reply.',
  interview: 'Interview stage. Come back and note what they asked.',
  offer: 'Offer. That is the whole point of this thing.',
};

export function Applications() {
  const { store, ready, mode } = useSession();
  const [applications, setApplications] = useState<ApplicationRow[] | null>(null);
  const [resumes, setResumes] = useState<ResumeRow[]>([]);
  const [toast, setToast] = useState<{ message: string; tone: 'neutral' | 'good' | 'warn' } | null>(null);

  useEffect(() => {
    if (!ready) return;
    void (async () => {
      const [apps, rs] = await Promise.all([store.listApplications(), store.listResumes()]);
      setApplications(apps);
      setResumes(rs);
    })();
  }, [ready, store]);

  const resumeById = useMemo(() => new Map(resumes.map((r) => [r.id, r])), [resumes]);

  const counts = useMemo(() => {
    const base = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<Stage, number>;
    for (const a of applications ?? []) base[a.stage] = (base[a.stage] ?? 0) + 1;
    return base;
  }, [applications]);

  async function setStage(app: ApplicationRow, stage: Stage) {
    const row = await store.saveApplication({
      id: app.id,
      stage,
      applied_at: stage === 'applied' ? (app.applied_at ?? new Date().toISOString()) : app.applied_at,
    });
    setApplications((prev) => (prev ?? []).map((a) => (a.id === row.id ? row : a)));
    if (STAGE_MESSAGES[stage]) setToast({ message: STAGE_MESSAGES[stage]!, tone: 'good' });
  }

  async function remove(id: string) {
    await store.deleteApplication(id);
    setApplications((prev) => (prev ?? []).filter((a) => a.id !== id));
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3 pt-2">
        <div>
          <p className="label mb-2 flex items-center gap-1.5">
            <Briefcase className="h-3 w-3" /> Tracker
          </p>
          <h1 className="text-[34px] leading-none">Applications</h1>
          <p className="mt-2 max-w-xl text-[12.5px] leading-relaxed text-muted">
            Every tailored resume is an application, so this is one table rather than two tabs. Stages are yours to
            keep honest.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {(['saved', 'applied', 'interview', 'offer'] as Stage[]).map((stage) => (
            <div key={stage} className="flex flex-col">
              <span className="font-serif text-2xl leading-none">{counts[stage]}</span>
              <span className="label">{STAGE_LABEL[stage]}</span>
            </div>
          ))}
        </div>
      </header>

      {applications === null ? (
        <div className="card px-5 py-12 text-center text-sm text-muted">Loading…</div>
      ) : applications.length === 0 ? (
        <EmptyState
          title="Nothing tracked yet"
          body="Save a posting from Discover, or tailor a resume — both land here so you can see what you sent where."
          icon={<Briefcase className="h-5 w-5" />}
          action={
            <Link href="/" className="btn btn-primary btn-xs">
              Find a role
            </Link>
          }
        />
      ) : (
        <section className="card overflow-hidden">
          <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_auto_auto_auto] gap-3 border-b border-hairline bg-white/40 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted sm:grid">
            <span>Role</span>
            <span>Resume</span>
            <span>Stage</span>
            <span>Updated</span>
            <span />
          </div>
          <ul>
            {applications.map((app) => {
              const resume = app.resume_id ? resumeById.get(app.resume_id) : undefined;
              const applyUrl = safeExternalUrl(app.apply_url);
              return (
                <li
                  key={app.id}
                  className="grid gap-2 border-b border-hairline/70 px-4 py-3.5 last:border-0 hover:bg-white/50 sm:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_auto_auto_auto] sm:items-center sm:gap-3 sm:px-5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {app.job_id ? (
                        <Link href={`/job/${app.job_id}`} className="truncate text-[15px] font-medium hover:underline">
                          {app.job_title ?? 'Untitled role'}
                        </Link>
                      ) : (
                        <span className="truncate text-[15px] font-medium">{app.job_title ?? 'Untitled role'}</span>
                      )}
                      {applyUrl ? (
                        <a
                          href={applyUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-muted hover:text-ink"
                          aria-label="Open original posting"
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </a>
                      ) : null}
                    </div>
                    <p className="truncate text-[12px] text-muted">{app.company ?? '—'}</p>
                  </div>

                  <div className="min-w-0">
                    {resume ? (
                      <div className="flex items-center gap-2">
                        <Link href={`/editor/${resume.id}`} className="inline-flex items-center gap-1 text-[12px] hover:underline">
                          <FileText className="h-3.5 w-3.5 text-muted" />
                          {resume.edited_by_user ? 'Edited' : 'Tailored'}
                        </Link>
                        <CoverageMeter coverage={resume.match_score} size="sm" />
                      </div>
                    ) : (
                      <span className="text-[12px] text-muted">No resume</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <StageTag stage={app.stage} />
                    <select
                      className="select py-1 text-[12px]"
                      value={app.stage}
                      onChange={(e) => void setStage(app, e.target.value as Stage)}
                      aria-label="Application stage"
                    >
                      {STAGES.map((stage) => (
                        <option key={stage} value={stage}>
                          {STAGE_LABEL[stage]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                    {shortDate(app.applied_at ?? app.updated_at)}
                  </span>

                  <div className="flex items-center gap-1 justify-self-end">
                    {resume ? (
                      <button
                        className="btn btn-quiet btn-xs"
                        title="Download .docx"
                        onClick={() => void downloadDocx(resume.model, resume.job_title)}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                    <ConfirmButton
                      label="Delete"
                      confirmLabel="Confirm"
                      onConfirm={() => void remove(app.id)}
                      className="btn btn-quiet btn-xs text-muted hover:text-signal"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </ConfirmButton>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <p className="text-[11px] leading-relaxed text-muted">
        {mode === 'local'
          ? 'Local mode: this tracker lives in this browser only.'
          : 'Stored in your workspace, readable only by your account.'}{' '}
        Applications are never submitted by JobFlow — you always apply on the original posting.
      </p>

      {toast ? <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} /> : null}
    </div>
  );
}
