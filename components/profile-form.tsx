'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2, X } from 'lucide-react';
import type { EducationEntry, ExperienceEntry, Profile, ProjectEntry } from '@/lib/types';
import { FieldLabel } from '@/components/ui';

export type FormSection = 'identity' | 'studies' | 'experience' | 'projects' | 'education' | 'skills';

const uid = (prefix: string) =>
  `${prefix}-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)}`;

export function emptyProfile(): Profile {
  return {
    name: '',
    headline: '',
    email: '',
    phone: '',
    location: '',
    links: [],
    summary: '',
    skills: [],
    experience: [],
    projects: [],
    education: [],
    isStudent: false,
  };
}

export function ProfileForm({
  value,
  onChange,
  sections = ['identity', 'studies', 'experience', 'projects', 'education', 'skills'],
}: {
  value: Profile;
  onChange: (next: Profile) => void;
  sections?: FormSection[];
}) {
  const patch = (partial: Partial<Profile>) => onChange({ ...value, ...partial });
  const show = (s: FormSection) => sections.includes(s);

  return (
    <div className="flex flex-col gap-5">
      {show('identity') ? (
        <section className="card px-5 py-5">
          <h2 className="mb-4 text-xl">Basics</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FieldLabel hint="as it should appear on the resume">Full name</FieldLabel>
              <input
                className="input"
                value={value.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="Kennedy Wanjiru"
              />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel hint="one line, plain words">Headline</FieldLabel>
              <input
                className="input"
                value={value.headline}
                onChange={(e) => patch({ headline: e.target.value })}
                placeholder="Final-year Computer Science student · sales development and support"
              />
            </div>
            <div>
              <FieldLabel>Email</FieldLabel>
              <input
                className="input"
                type="email"
                value={value.email}
                onChange={(e) => patch({ email: e.target.value })}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <FieldLabel>Phone</FieldLabel>
              <input
                className="input"
                value={value.phone}
                onChange={(e) => patch({ phone: e.target.value })}
                placeholder="+254 …"
              />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel hint="city and timezone help recruiters">Location</FieldLabel>
              <input
                className="input"
                value={value.location}
                onChange={(e) => patch({ location: e.target.value })}
                placeholder="Nairobi, Kenya (EAT, UTC+3)"
              />
            </div>
          </div>

          <div className="mt-4">
            <FieldLabel hint="full URLs, no link labels">Links</FieldLabel>
            <div className="flex flex-col gap-2">
              {value.links.map((link, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    className="input max-w-[130px]"
                    value={link.label}
                    onChange={(e) => {
                      const links = [...value.links];
                      links[index] = { ...links[index], label: e.target.value };
                      patch({ links });
                    }}
                    placeholder="GitHub"
                  />
                  <input
                    className="input"
                    value={link.url}
                    onChange={(e) => {
                      const links = [...value.links];
                      links[index] = { ...links[index], url: e.target.value };
                      patch({ links });
                    }}
                    placeholder="github.com/you"
                  />
                  <button
                    className="btn btn-quiet btn-xs"
                    onClick={() => patch({ links: value.links.filter((_, i) => i !== index) })}
                    aria-label="Remove link"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                className="btn btn-xs self-start"
                onClick={() => patch({ links: [...value.links, { label: '', url: '' }] })}
              >
                <Plus className="h-3.5 w-3.5" /> Add link
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {show('studies') ? (
        <section className="card px-5 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl">Are you still studying?</h2>
              <p className="mt-1 max-w-lg text-[12.5px] leading-relaxed text-muted">
                This puts education above work experience and keeps at least three bullets per role — the honest shape
                for a student resume.
              </p>
            </div>
            <button
              role="switch"
              aria-checked={value.isStudent}
              onClick={() => patch({ isStudent: !value.isStudent })}
              className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${
                value.isStudent ? 'border-pine bg-pine' : 'border-hairline bg-white'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  value.isStudent ? 'left-[26px]' : 'left-0.5'
                }`}
              />
            </button>
          </div>
        </section>
      ) : null}

      {show('experience') ? (
        <section className="card px-5 py-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl">Experience</h2>
            <span className="label">{value.experience.length} roles</span>
          </div>
          <div className="flex flex-col gap-4">
            {value.experience.map((role, index) => (
              <RoleEditor
                key={role.id}
                role={role}
                onChange={(next) => {
                  const experience = [...value.experience];
                  experience[index] = next;
                  patch({ experience });
                }}
                onRemove={() => patch({ experience: value.experience.filter((_, i) => i !== index) })}
                onMove={(dir) => {
                  const experience = [...value.experience];
                  const target = index + dir;
                  if (target < 0 || target >= experience.length) return;
                  [experience[index], experience[target]] = [experience[target], experience[index]];
                  patch({ experience });
                }}
              />
            ))}
            <button
              className="btn btn-xs self-start"
              onClick={() =>
                patch({
                  experience: [
                    ...value.experience,
                    {
                      id: uid('exp'),
                      company: '',
                      title: '',
                      location: '',
                      start: '',
                      end: 'Present',
                      bullets: [{ id: uid('b'), text: '' }],
                    },
                  ],
                })
              }
            >
              <Plus className="h-3.5 w-3.5" /> Add role
            </button>
          </div>
        </section>
      ) : null}

      {show('projects') ? (
        <section className="card px-5 py-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl">Projects</h2>
            <span className="label">{value.projects.length} projects</span>
          </div>
          <p className="mb-3 text-[12px] leading-relaxed text-muted">
            Students: this is where a resume earns its space. Two projects with numbers beat four without.
          </p>
          <div className="flex flex-col gap-4">
            {value.projects.map((project, index) => (
              <ProjectEditor
                key={project.id}
                project={project}
                onChange={(next) => {
                  const projects = [...value.projects];
                  projects[index] = next;
                  patch({ projects });
                }}
                onRemove={() => patch({ projects: value.projects.filter((_, i) => i !== index) })}
              />
            ))}
            <button
              className="btn btn-xs self-start"
              onClick={() =>
                patch({
                  projects: [
                    ...value.projects,
                    {
                      id: uid('prj'),
                      name: '',
                      link: '',
                      bullets: [{ id: uid('pb'), text: '' }],
                    },
                  ],
                })
              }
            >
              <Plus className="h-3.5 w-3.5" /> Add project
            </button>
          </div>
        </section>
      ) : null}

      {show('education') ? (
        <section className="card px-5 py-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl">Education</h2>
            <span className="label">{value.education.length} entries</span>
          </div>
          <div className="flex flex-col gap-4">
            {value.education.map((ed, index) => (
              <div key={ed.id} className="rounded-xl border border-hairline/80 bg-white/50 p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <FieldLabel>School</FieldLabel>
                    <input
                      className="input"
                      value={ed.school}
                      onChange={(e) => {
                        const education = [...value.education];
                        education[index] = { ...ed, school: e.target.value };
                        patch({ education });
                      }}
                      placeholder="University of Nairobi"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <FieldLabel>Degree</FieldLabel>
                      <input
                        className="input"
                        value={ed.degree}
                        onChange={(e) => {
                          const education = [...value.education];
                          education[index] = { ...ed, degree: e.target.value };
                          patch({ education });
                        }}
                        placeholder="BSc"
                      />
                    </div>
                    <div>
                      <FieldLabel>Field</FieldLabel>
                      <input
                        className="input"
                        value={ed.field ?? ''}
                        onChange={(e) => {
                          const education = [...value.education];
                          education[index] = { ...ed, field: e.target.value };
                          patch({ education });
                        }}
                        placeholder="Computer Science"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <FieldLabel>Start</FieldLabel>
                      <input
                        className="input"
                        value={ed.start}
                        onChange={(e) => {
                          const education = [...value.education];
                          education[index] = { ...ed, start: e.target.value };
                          patch({ education });
                        }}
                        placeholder="Sep 2023"
                      />
                    </div>
                    <div>
                      <FieldLabel>End</FieldLabel>
                      <input
                        className="input"
                        value={ed.end}
                        onChange={(e) => {
                          const education = [...value.education];
                          education[index] = { ...ed, end: e.target.value };
                          patch({ education });
                        }}
                        placeholder="Nov 2026"
                      />
                    </div>
                  </div>
                  <div>
                    <FieldLabel hint="optional">Details</FieldLabel>
                    <input
                      className="input"
                      value={ed.details ?? ''}
                      onChange={(e) => {
                        const education = [...value.education];
                        education[index] = { ...ed, details: e.target.value };
                        patch({ education });
                      }}
                      placeholder="Relevant coursework, honours"
                    />
                  </div>
                </div>
                <button
                  className="btn btn-quiet btn-xs mt-2"
                  onClick={() => patch({ education: value.education.filter((_, i) => i !== index) })}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              </div>
            ))}
            <button
              className="btn btn-xs self-start"
              onClick={() =>
                patch({
                  education: [
                    ...value.education,
                    { id: uid('edu'), school: '', degree: '', field: '', start: '', end: '', details: '' },
                  ],
                })
              }
            >
              <Plus className="h-3.5 w-3.5" /> Add education
            </button>
          </div>
        </section>
      ) : null}

      {show('skills') ? <SkillsEditor value={value} onChange={onChange} /> : null}
    </div>
  );
}

function RoleEditor({
  role,
  onChange,
  onRemove,
  onMove,
}: {
  role: ExperienceEntry;
  onChange: (next: ExperienceEntry) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-xl border border-hairline/80 bg-white/50">
      <div className="flex items-center gap-2 px-3 py-2">
        <button className="flex flex-1 items-center gap-2 text-left" onClick={() => setOpen((v) => !v)}>
          {open ? <ChevronUp className="h-3.5 w-3.5 text-muted" /> : <ChevronDown className="h-3.5 w-3.5 text-muted" />}
          <span className="text-[13px] font-medium">
            {role.title || 'Untitled role'}
            {role.company ? <span className="text-muted"> · {role.company}</span> : null}
          </span>
          <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
            {role.bullets.length} bullets
          </span>
        </button>
        <button className="rounded p-1 text-muted hover:bg-black/5" onClick={() => onMove(-1)} aria-label="Move up">
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button className="rounded p-1 text-muted hover:bg-black/5" onClick={() => onMove(1)} aria-label="Move down">
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <button
          className="rounded p-1 text-muted hover:bg-signal/10 hover:text-signal"
          onClick={onRemove}
          aria-label="Remove role"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {open ? (
        <div className="border-t border-hairline/70 px-3 py-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>Title</FieldLabel>
              <input
                className="input"
                value={role.title}
                onChange={(e) => onChange({ ...role, title: e.target.value })}
                placeholder="Sales Development Representative"
              />
            </div>
            <div>
              <FieldLabel>Company</FieldLabel>
              <input
                className="input"
                value={role.company}
                onChange={(e) => onChange({ ...role, company: e.target.value })}
                placeholder="Sahili Cloud"
              />
            </div>
            <div>
              <FieldLabel>Location</FieldLabel>
              <input
                className="input"
                value={role.location ?? ''}
                onChange={(e) => onChange({ ...role, location: e.target.value })}
                placeholder="Nairobi (remote)"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Start</FieldLabel>
                <input
                  className="input"
                  value={role.start}
                  onChange={(e) => onChange({ ...role, start: e.target.value })}
                  placeholder="Mar 2025"
                />
              </div>
              <div>
                <FieldLabel>End</FieldLabel>
                <input
                  className="input"
                  value={role.end}
                  onChange={(e) => onChange({ ...role, end: e.target.value })}
                  placeholder="Present"
                />
              </div>
            </div>
          </div>

          <div className="mt-3">
            <FieldLabel hint="one achievement each, with a number where you can">Bullets</FieldLabel>
            <div className="flex flex-col gap-2">
              {role.bullets.map((bullet, index) => (
                <div key={bullet.id} className="flex items-start gap-2">
                  <textarea
                    className="textarea min-h-[40px] py-1.5"
                    rows={1}
                    value={bullet.text}
                    onChange={(e) => {
                      const bullets = [...role.bullets];
                      bullets[index] = { ...bullet, text: e.target.value };
                      onChange({ ...role, bullets });
                    }}
                    placeholder="Booked 41 qualified demos in six months by running cold outreach…"
                  />
                  <button
                    className="btn btn-quiet btn-xs mt-1"
                    onClick={() => onChange({ ...role, bullets: role.bullets.filter((_, i) => i !== index) })}
                    aria-label="Remove bullet"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                className="btn btn-xs self-start"
                onClick={() => onChange({ ...role, bullets: [...role.bullets, { id: uid('b'), text: '' }] })}
              >
                <Plus className="h-3.5 w-3.5" /> Add bullet
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProjectEditor({
  project,
  onChange,
  onRemove,
}: {
  project: ProjectEntry;
  onChange: (next: ProjectEntry) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-hairline/80 bg-white/50 p-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <div>
          <FieldLabel>Name</FieldLabel>
          <input
            className="input"
            value={project.name}
            onChange={(e) => onChange({ ...project, name: e.target.value })}
            placeholder="Shamba Prices"
          />
        </div>
        <div>
          <FieldLabel hint="optional">Link</FieldLabel>
          <input
            className="input"
            value={project.link ?? ''}
            onChange={(e) => onChange({ ...project, link: e.target.value })}
            placeholder="github.com/you/project"
          />
        </div>
        <button className="btn btn-quiet btn-xs self-end" onClick={onRemove} aria-label="Remove project">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {project.bullets.map((bullet, index) => (
          <div key={bullet.id} className="flex items-start gap-2">
            <textarea
              className="textarea min-h-[40px] py-1.5"
              rows={1}
              value={bullet.text}
              onChange={(e) => {
                const bullets = [...project.bullets];
                bullets[index] = { ...bullet, text: e.target.value };
                onChange({ ...project, bullets });
              }}
              placeholder="Built a Next.js app used by 220 farmers in the first month."
            />
            <button
              className="btn btn-quiet btn-xs mt-1"
              onClick={() => onChange({ ...project, bullets: project.bullets.filter((_, i) => i !== index) })}
              aria-label="Remove bullet"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <button
          className="btn btn-xs self-start"
          onClick={() => onChange({ ...project, bullets: [...project.bullets, { id: uid('pb'), text: '' }] })}
        >
          <Plus className="h-3.5 w-3.5" /> Add bullet
        </button>
      </div>
    </div>
  );
}

function SkillsEditor({ value, onChange }: { value: Profile; onChange: (next: Profile) => void }) {
  const [draft, setDraft] = useState('');

  const add = (raw: string) => {
    const terms = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!terms.length) return;
    const existing = new Set(value.skills.map((s) => s.toLowerCase()));
    onChange({ ...value, skills: [...value.skills, ...terms.filter((t) => !existing.has(t.toLowerCase()))] });
    setDraft('');
  };

  return (
    <section className="card px-5 py-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl">Skills</h2>
        <span className="label">{value.skills.length} listed</span>
      </div>
      <p className="mb-3 text-[12px] leading-relaxed text-muted">
        Only skills you actually have. The tailoring engine will never add one you did not type, and a skill here is a
        claim you should be able to defend in an interview.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {value.skills.map((skill) => (
          <span
            key={skill}
            className="inline-flex items-center gap-1 rounded-md border border-hairline bg-white/70 px-2 py-1 text-[12px]"
          >
            {skill}
            <button
              onClick={() => onChange({ ...value, skills: value.skills.filter((s) => s !== skill) })}
              className="text-muted hover:text-signal"
              aria-label={`Remove ${skill}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          className="input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add(draft);
            }
          }}
          placeholder="Type a skill and press Enter (comma separates several)"
        />
        <button className="btn btn-xs" onClick={() => add(draft)} disabled={!draft.trim()}>
          Add
        </button>
      </div>
    </section>
  );
}

export type { EducationEntry };
