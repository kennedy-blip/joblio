'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  EyeOff,
  Plus,
  Printer,
  Redo2,
  ShieldCheck,
  Trash2,
  Undo2,
} from 'lucide-react';
import { useSession } from '@/components/session-provider';
import { CoverageMeter, Toast } from '@/components/ui';
import { downloadDocx, docxFilename } from '@/lib/docx';
import { estimatePages, resumeToText, visibleBullets } from '@/lib/tailor';
import { safeExternalUrl } from '@/lib/format';
import type { ResumeModel, ResumeRow, SectionKey } from '@/lib/types';

const SECTION_LABEL: Record<SectionKey, string> = {
  summary: 'Summary',
  experience: 'Experience',
  projects: 'Projects',
  education: 'Education',
  skills: 'Skills',
};

export function ResumeEditor({ id }: { id: string }) {
  const { store, ready } = useSession();
  const [resume, setResume] = useState<ResumeRow | null | undefined>(undefined);
  const [draft, setDraft] = useState<ResumeModel | null>(null);
  const [past, setPast] = useState<ResumeModel[]>([]);
  const [future, setFuture] = useState<ResumeModel[]>([]);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'neutral' | 'good' | 'warn' } | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    if (!ready) return;
    void (async () => {
      const row = await store.getResume(id);
      setResume(row);
      if (row) setDraft(row.model);
    })();
  }, [ready, store, id]);

  const update = useCallback(
    (mutate: (model: ResumeModel) => ResumeModel) => {
      setDraft((current) => {
        if (!current) return current;
        const next = mutate(structuredClone(current));
        setPast((p) => [...p.slice(-59), current]);
        setFuture([]);
        dirty.current = true;
        return next;
      });
    },
    [],
  );

  const save = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await store.updateResumeModel(id, draft);
      setSavedAt(Date.now());
      dirty.current = false;
      setResume((prev) => (prev ? { ...prev, edited_by_user: true, model: draft } : prev));
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : 'Save failed', tone: 'warn' });
    } finally {
      setSaving(false);
    }
  }, [draft, id, store]);

  // Debounced autosave.
  useEffect(() => {
    if (!draft || !dirty.current) return;
    const t = setTimeout(() => void save(), 1100);
    return () => clearTimeout(t);
  }, [draft, save]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void save();
      }
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function undo() {
    setPast((p) => {
      if (!p.length || !draft) return p;
      const prev = p[p.length - 1];
      setFuture((f) => [draft, ...f].slice(0, 60));
      setDraft(prev);
      dirty.current = true;
      return p.slice(0, -1);
    });
  }

  function redo() {
    setFuture((f) => {
      if (!f.length || !draft) return f;
      const next = f[0];
      setPast((p) => [...p, draft]);
      setDraft(next);
      dirty.current = true;
      return f.slice(1);
    });
  }

  const pageCount = useMemo(() => (draft ? estimatePages(draft) : 1), [draft]);
  const original = resume?.original_model ?? null;

  if (resume === undefined || !draft) {
    return <div className="py-20 text-center text-sm text-muted">Loading resume…</div>;
  }

  if (resume === null) {
    return (
      <div className="card mt-8 px-6 py-12 text-center">
        <h2 className="text-2xl">No resume with that id.</h2>
        <Link href="/applications" className="btn btn-primary mt-5">
          Back to Applications
        </Link>
      </div>
    );
  }

  const shown: ResumeModel = showOriginal && original ? original : draft;
  const applyUrl = safeExternalUrl(resume.apply_url);
  const savedLabel = savedAt
    ? `Saved ${Math.max(0, Math.round((Date.now() - savedAt) / 1000))}s ago`
    : resume.edited_by_user
      ? 'Saved'
      : 'Auto-saved';

  return (
    <div className="flex flex-col gap-4">
      <div className="no-print sticky top-14 z-30 -mx-4 flex flex-wrap items-center gap-2 border-b border-hairline bg-paper/95 px-4 py-2.5 backdrop-blur-md sm:mx-0 sm:rounded-xl2 sm:border sm:px-3">
        <Link href={resume.job_id ? `/job/${resume.job_id}` : '/applications'} className="btn btn-quiet btn-xs -ml-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium">
            {resume.job_title ?? 'Untitled role'}
            {resume.company ? <span className="text-muted"> · {resume.company}</span> : null}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
            {saving ? 'Saving…' : savedLabel} · {docxFilename(draft, resume.job_title)}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button className="btn btn-quiet btn-xs" onClick={undo} disabled={!past.length} title="Undo (⌘Z)">
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button className="btn btn-quiet btn-xs" onClick={redo} disabled={!future.length} title="Redo (⇧⌘Z)">
            <Redo2 className="h-3.5 w-3.5" />
          </button>
          <span className="mx-1 hidden h-5 w-px bg-hairline sm:block" />
          <button className="btn btn-xs hidden sm:inline-flex" onClick={() => window.print()} title="Print or save as PDF">
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
          <button className="btn btn-xs" onClick={() => void save()} disabled={saving}>
            <Check className="h-3.5 w-3.5" /> Save
          </button>
          <button
            className="btn btn-primary btn-xs"
            onClick={() => {
              void downloadDocx(draft, resume.job_title).catch((e) =>
                setToast({ message: e instanceof Error ? e.message : 'Export failed', tone: 'warn' }),
              );
            }}
          >
            <Download className="h-3.5 w-3.5" /> .docx
          </button>
        </div>
      </div>

      {resume.edited_by_user ? (
        <div className="no-print flex flex-wrap items-center gap-2 rounded-xl2 border border-ochre/40 bg-ochreSoft/60 px-4 py-2.5 text-[12px] text-[#6a4d0f]">
          <span>Edited by you. The no-facts-added guarantee applies to the original tailored version.</span>
          {original ? (
            <button className="btn btn-xs ml-auto" onClick={() => setShowOriginal((v) => !v)}>
              {showOriginal ? 'Back to my version' : 'View original'}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="overflow-x-auto">
          <div className={`sheet ${showOriginal ? 'opacity-90' : ''}`}>
            <div contentEditable={false}>
              <input
                value={shown.name}
                onChange={(e) => update((m) => ({ ...m, name: e.target.value }))}
                readOnly={showOriginal}
                className="sheet-input font-bold"
                style={{ fontSize: '20pt' }}
                aria-label="Name"
              />
              <input
                value={shown.headline}
                onChange={(e) => update((m) => ({ ...m, headline: e.target.value }))}
                readOnly={showOriginal}
                className="sheet-input text-[11pt] text-[#55554C]"
                aria-label="Headline"
              />
              <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[10pt] text-[#55554C]">
                <input
                  value={shown.contact.email}
                  onChange={(e) => update((m) => ({ ...m, contact: { ...m.contact, email: e.target.value } }))}
                  readOnly={showOriginal}
                  className="sheet-input max-w-[210px]"
                  aria-label="Email"
                />
                <span>·</span>
                <input
                  value={shown.contact.phone}
                  onChange={(e) => update((m) => ({ ...m, contact: { ...m.contact, phone: e.target.value } }))}
                  readOnly={showOriginal}
                  className="sheet-input max-w-[150px]"
                  aria-label="Phone"
                />
                <span>·</span>
                <input
                  value={shown.contact.location}
                  onChange={(e) => update((m) => ({ ...m, contact: { ...m.contact, location: e.target.value } }))}
                  readOnly={showOriginal}
                  className="sheet-input max-w-[220px]"
                  aria-label="Location"
                />
              </div>
              <input
                value={shown.links.join('  ·  ')}
                onChange={(e) =>
                  update((m) => ({ ...m, links: e.target.value.split('·').map((s) => s.trim()).filter(Boolean) }))
                }
                readOnly={showOriginal}
                className="sheet-input text-[10pt] text-[#55554C]"
                aria-label="Links, full URLs"
              />
            </div>

            {shown.sections.map((section, index) => (
              <section key={section} className="group relative">
                <div className="mt-4 mb-1 flex items-center gap-2">
                  <h2 className="sheet-heading mb-0 flex-1">{SECTION_LABEL[section]}</h2>
                  {!showOriginal ? (
                    <span className="no-print flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <button
                        className="rounded p-0.5 text-muted hover:bg-black/5"
                        onClick={() =>
                          update((m) => {
                            if (index === 0) return m;
                            const sections = [...m.sections];
                            [sections[index - 1], sections[index]] = [sections[index], sections[index - 1]];
                            return { ...m, sections };
                          })
                        }
                        title="Move section up"
                      >
                        <ChevronUp className="h-3 w-3" />
                      </button>
                      <button
                        className="rounded p-0.5 text-muted hover:bg-black/5"
                        onClick={() =>
                          update((m) => {
                            if (index === m.sections.length - 1) return m;
                            const sections = [...m.sections];
                            [sections[index + 1], sections[index]] = [sections[index], sections[index + 1]];
                            return { ...m, sections };
                          })
                        }
                        title="Move section down"
                      >
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </span>
                  ) : null}
                </div>

                {section === 'summary' ? (
                  <textarea
                    value={shown.summary}
                    onChange={(e) => update((m) => ({ ...m, summary: e.target.value }))}
                    readOnly={showOriginal}
                    rows={3}
                    className="sheet-input resize-none text-[11pt] leading-[1.5]"
                    aria-label="Summary"
                  />
                ) : null}

                {section === 'experience'
                  ? shown.experience.map((role, roleIndex) => (
                      <div key={`${role.company}-${roleIndex}`} className="mb-3">
                        <div className="flex items-baseline gap-2">
                          <input
                            value={role.title}
                            onChange={(e) =>
                              update((m) => {
                                m.experience[roleIndex].title = e.target.value;
                                return m;
                              })
                            }
                            readOnly={showOriginal}
                            className="sheet-input font-bold"
                            style={{ fontSize: '11pt' }}
                            aria-label="Role title"
                          />
                          <input
                            value={`${role.start} – ${role.end}`}
                            onChange={(e) =>
                              update((m) => {
                                const [start, end] = e.target.value.split(/[–-]/).map((s) => s.trim());
                                m.experience[roleIndex].start = start ?? '';
                                m.experience[roleIndex].end = end ?? '';
                                return m;
                              })
                            }
                            readOnly={showOriginal}
                            className="sheet-input max-w-[170px] text-right text-[10pt] text-[#55554C]"
                            aria-label="Dates"
                          />
                        </div>
                        <input
                          value={[role.company, role.location].filter(Boolean).join(' · ')}
                          onChange={(e) =>
                            update((m) => {
                              const [company, ...rest] = e.target.value.split('·').map((s) => s.trim());
                              m.experience[roleIndex].company = company ?? '';
                              m.experience[roleIndex].location = rest.join(' · ');
                              return m;
                            })
                          }
                          readOnly={showOriginal}
                          className="sheet-input italic text-[10pt] text-[#55554C]"
                          aria-label="Company and location"
                        />
                        <BulletList
                          bullets={role.bullets}
                          readOnly={showOriginal}
                          onChange={(next) =>
                            update((m) => {
                              m.experience[roleIndex].bullets = next;
                              return m;
                            })
                          }
                        />
                      </div>
                    ))
                  : null}

                {section === 'projects'
                  ? shown.projects.map((project, projectIndex) => (
                      <div key={`${project.name}-${projectIndex}`} className="mb-3">
                        <div className="flex items-baseline gap-2">
                          <input
                            value={project.name}
                            onChange={(e) =>
                              update((m) => {
                                m.projects[projectIndex].name = e.target.value;
                                return m;
                              })
                            }
                            readOnly={showOriginal}
                            className="sheet-input font-bold"
                            style={{ fontSize: '11pt' }}
                            aria-label="Project name"
                          />
                          <input
                            value={project.link ?? ''}
                            onChange={(e) =>
                              update((m) => {
                                m.projects[projectIndex].link = e.target.value;
                                return m;
                              })
                            }
                            readOnly={showOriginal}
                            className="sheet-input max-w-[220px] text-right text-[10pt] text-[#55554C]"
                            aria-label="Project link"
                          />
                        </div>
                        <BulletList
                          bullets={project.bullets}
                          readOnly={showOriginal}
                          onChange={(next) =>
                            update((m) => {
                              m.projects[projectIndex].bullets = next;
                              return m;
                            })
                          }
                        />
                      </div>
                    ))
                  : null}

                {section === 'education'
                  ? shown.education.map((ed, edIndex) => (
                      <div key={`${ed.school}-${edIndex}`} className="mb-2">
                        <div className="flex items-baseline gap-2">
                          <input
                            value={[ed.degree, ed.field].filter(Boolean).join(', ')}
                            onChange={(e) =>
                              update((m) => {
                                const [degree, ...rest] = e.target.value.split(',').map((s) => s.trim());
                                m.education[edIndex].degree = degree ?? '';
                                m.education[edIndex].field = rest.join(', ');
                                return m;
                              })
                            }
                            readOnly={showOriginal}
                            className="sheet-input font-bold"
                            style={{ fontSize: '11pt' }}
                            aria-label="Degree"
                          />
                          <input
                            value={`${ed.start} – ${ed.end}`}
                            onChange={(e) =>
                              update((m) => {
                                const [start, end] = e.target.value.split(/[–-]/).map((s) => s.trim());
                                m.education[edIndex].start = start ?? '';
                                m.education[edIndex].end = end ?? '';
                                return m;
                              })
                            }
                            readOnly={showOriginal}
                            className="sheet-input max-w-[170px] text-right text-[10pt] text-[#55554C]"
                            aria-label="Education dates"
                          />
                        </div>
                        <input
                          value={ed.school}
                          onChange={(e) =>
                            update((m) => {
                              m.education[edIndex].school = e.target.value;
                              return m;
                            })
                          }
                          readOnly={showOriginal}
                          className="sheet-input italic text-[10pt] text-[#55554C]"
                          aria-label="School"
                        />
                        {ed.details ? (
                          <textarea
                            value={ed.details}
                            onChange={(e) =>
                              update((m) => {
                                m.education[edIndex].details = e.target.value;
                                return m;
                              })
                            }
                            readOnly={showOriginal}
                            rows={2}
                            className="sheet-input resize-none text-[10pt] leading-[1.45] text-[#55554C]"
                            aria-label="Education details"
                          />
                        ) : null}
                      </div>
                    ))
                  : null}

                {section === 'skills' ? (
                  <textarea
                    value={shown.skills.join(' · ')}
                    onChange={(e) =>
                      update((m) => ({
                        ...m,
                        skills: e.target.value
                          .split('·')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      }))
                    }
                    readOnly={showOriginal}
                    rows={2}
                    className="sheet-input resize-none text-[11pt] leading-[1.5]"
                    aria-label="Skills"
                  />
                ) : null}
              </section>
            ))}
          </div>
        </div>

        <aside className="no-print flex flex-col gap-4 lg:sticky lg:top-[7.5rem] lg:self-start">
          <section className="card px-4 py-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="label">Keyword coverage</h2>
              <CoverageMeter
                coverage={resume.match_score}
                matched={resume.matched_keywords.length}
                required={resume.matched_keywords.length + resume.missing_keywords.length}
              />
            </div>
            <p className="text-[11px] leading-relaxed text-muted">
              Measured when this resume was tailored, against {resume.job_title ?? 'the posting'}.
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {resume.matched_keywords.slice(0, 14).map((k) => (
                <span key={k} className="chip-tiny border-pine/25 bg-pineSoft/60 text-pine">
                  {k}
                </span>
              ))}
            </div>
            {resume.missing_keywords.length ? (
              <>
                <p className="label mt-3 mb-1">Not found in your profile</p>
                <div className="flex flex-wrap gap-1">
                  {resume.missing_keywords.slice(0, 14).map((k) => (
                    <span key={k} className="chip-tiny">
                      {k}
                    </span>
                  ))}
                </div>
              </>
            ) : null}
          </section>

          <section className="card px-4 py-4">
            <h2 className="label mb-2">What did NOT change</h2>
            <ul className="space-y-1.5 text-[12.5px]">
              <li className="flex items-start gap-1.5">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pine" />
                <span>
                  No facts added. {draft.experience.length === 1 ? '1 role' : `${draft.experience.length} roles`},{' '}
                  {draft.experience.reduce((n, r) => n + r.bullets.length, 0) + draft.projects.reduce((n, p) => n + p.bullets.length, 0)}{' '}
                  bullets and {draft.education.length === 1 ? '1 degree' : `${draft.education.length} degrees`} carried
                  over untouched.
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pine" />
                <span>Companies, titles and both dates are byte-identical to your profile.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pine" />
                <span>Skills are a subset of the skills you entered.</span>
              </li>
            </ul>

            <h2 className="label mt-4 mb-1.5">What changed</h2>
            <ul className="space-y-1 text-[12px] text-muted">
              <li>· Summary written from your profile facts</li>
              <li>· Bullets ordered by relevance to this posting</li>
              <li>
                · {draft.experience.reduce((n, r) => n + r.bullets.filter((b) => b.hidden).length, 0)} hidden as less
                relevant (still restorable)
              </li>
              <li>· Sections ordered {draft.sections.map((s) => SECTION_LABEL[s].toLowerCase()).join(' → ')}</li>
            </ul>
          </section>

          <section className="card px-4 py-4">
            <div className="flex items-baseline justify-between">
              <h2 className="label">Length</h2>
              <span className="font-serif text-2xl leading-none">≈ {pageCount}</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              Estimated pages at Calibri 11pt with 0.5" margins. Recruiters read one to two pages closely; three is
              already a skim.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {applyUrl ? (
                <a href={applyUrl} target="_blank" rel="noreferrer noopener" className="btn btn-xs">
                  Apply <ArrowUpRight className="h-3 w-3" />
                </a>
              ) : null}
              <Link href="/applications" className="btn btn-xs btn-quiet">
                Track it
              </Link>
            </div>
          </section>

          <section className="card-flat px-4 py-3 text-[11px] leading-relaxed text-muted">
            The on-screen sheet is a close representation of the downloaded .docx: same font, size, margins and single
            column. Word can reflow a line; the content is identical.
          </section>
        </aside>
      </div>

      <div className="print-only sheet print-area">
        <ReadView model={draft} />
      </div>

      {toast ? <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} /> : null}
    </div>
  );
}

function BulletList({
  bullets,
  onChange,
  readOnly,
}: {
  bullets: ResumeModel['experience'][number]['bullets'];
  onChange: (next: ResumeModel['experience'][number]['bullets']) => void;
  readOnly?: boolean;
}) {
  return (
    <ul className="mt-1 space-y-0.5">
      {bullets.map((bullet, index) => (
        <li key={bullet.sourceId} className="sheet-bullet group/bullet items-start">
          <span className="mt-[3px] text-[11pt] leading-none text-[#55554C]">•</span>
          <textarea
            value={bullet.text}
            onChange={(e) => {
              const next = [...bullets];
              next[index] = { ...next[index], text: e.target.value };
              onChange(next);
            }}
            readOnly={readOnly}
            rows={1}
            className={`sheet-input resize-none text-[11pt] leading-[1.4] ${
              bullet.hidden ? 'text-muted/60 line-through decoration-signal/50' : ''
            }`}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = `${el.scrollHeight}px`;
            }}
            aria-label={bullet.hidden ? 'Hidden bullet' : 'Bullet'}
          />
          {!readOnly ? (
            <span className="no-print flex shrink-0 items-center gap-0.5 pt-0.5 opacity-0 transition-opacity group-hover/bullet:opacity-100 focus-within:opacity-100">
              <button
                className="rounded p-0.5 text-muted hover:bg-black/5"
                title={bullet.hidden ? 'Restore to the resume' : 'Hide from this resume (stays in your profile)'}
                onClick={() => {
                  const next = [...bullets];
                  next[index] = { ...next[index], hidden: !next[index].hidden };
                  onChange(next);
                }}
              >
                {bullet.hidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              </button>
              <button
                className="rounded p-0.5 text-muted hover:bg-signal/10 hover:text-signal"
                title="Remove from this resume (it stays in your profile)"
                onClick={() => onChange(bullets.filter((_, i) => i !== index))}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          ) : null}
        </li>
      ))}
      {!readOnly ? (
        <li className="no-print">
          <button
            className="mt-0.5 inline-flex items-center gap-1 rounded px-1 py-0.5 text-[11px] text-muted transition-colors hover:bg-black/5 hover:text-ink"
            onClick={() =>
              onChange([
                ...bullets,
                { sourceId: `custom-${Math.random().toString(36).slice(2, 10)}`, text: '' },
              ])
            }
          >
            <Plus className="h-3 w-3" /> bullet
          </button>
        </li>
      ) : null}
    </ul>
  );
}

function ReadView({ model }: { model: ResumeModel }) {
  return (
    <div className="text-[11pt] leading-[1.4]">
      <h1 className="text-[20pt] font-bold">{model.name}</h1>
      {model.headline ? <p className="text-[11pt] text-[#55554C]">{model.headline}</p> : null}
      <p className="text-[10pt] text-[#55554C]">
        {[model.contact.email, model.contact.phone, model.contact.location].filter(Boolean).join('  ·  ')}
      </p>
      {model.links.length ? <p className="text-[10pt] text-[#55554C]">{model.links.join('  ·  ')}</p> : null}

      {model.sections.map((section) => (
        <section key={section}>
          {section === 'summary' && model.summary ? (
            <>
              <h2 className="sheet-heading">SUMMARY</h2>
              <p>{model.summary}</p>
            </>
          ) : null}
          {section === 'experience' && model.experience.length ? (
            <>
              <h2 className="sheet-heading">EXPERIENCE</h2>
              {model.experience.map((role, i) => (
                <div key={i} className="mb-2">
                  <div className="flex justify-between">
                    <strong>{role.title}</strong>
                    <span className="text-[10pt] text-[#55554C]">
                      {role.start} – {role.end}
                    </span>
                  </div>
                  <p className="text-[10pt] italic text-[#55554C]">
                    {[role.company, role.location].filter(Boolean).join(' · ')}
                  </p>
                  <ul className="mt-0.5">
                    {visibleBullets(role).map((b) => (
                      <li key={b.sourceId} className="flex gap-1.5">
                        <span>•</span>
                        <span>{b.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </>
          ) : null}
          {section === 'projects' && model.projects.length ? (
            <>
              <h2 className="sheet-heading">PROJECTS</h2>
              {model.projects.map((project, i) => (
                <div key={i} className="mb-2">
                  <div className="flex justify-between">
                    <strong>{project.name}</strong>
                    <span className="text-[10pt] text-[#55554C]">{project.link}</span>
                  </div>
                  <ul className="mt-0.5">
                    {visibleBullets(project).map((b) => (
                      <li key={b.sourceId} className="flex gap-1.5">
                        <span>•</span>
                        <span>{b.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </>
          ) : null}
          {section === 'education' && model.education.length ? (
            <>
              <h2 className="sheet-heading">EDUCATION</h2>
              {model.education.map((ed, i) => (
                <div key={i} className="mb-1">
                  <div className="flex justify-between">
                    <strong>{[ed.degree, ed.field].filter(Boolean).join(', ')}</strong>
                    <span className="text-[10pt] text-[#55554C]">
                      {ed.start} – {ed.end}
                    </span>
                  </div>
                  <p className="text-[10pt] italic text-[#55554C]">{ed.school}</p>
                  {ed.details ? <p className="text-[10pt] text-[#55554C]">{ed.details}</p> : null}
                </div>
              ))}
            </>
          ) : null}
          {section === 'skills' && model.skills.length ? (
            <>
              <h2 className="sheet-heading">SKILLS</h2>
              <p>{model.skills.join('  ·  ')}</p>
            </>
          ) : null}
        </section>
      ))}
    </div>
  );
}

export function resumePlainText(model: ResumeModel) {
  return resumeToText(model);
}
