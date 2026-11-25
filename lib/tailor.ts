/**
 * lib/tailor.ts — the engine.
 *
 * The contract, restated precisely:
 *   The engine may reorder, hide, and rewrite the SUMMARY from a template that
 *   uses only profile facts. It may never create a bullet, a skill, a date, a
 *   company, a title, or a degree. Every emitted bullet is character-identical
 *   to a bullet the user typed.
 *
 * assertEngineOutput() is the machine enforcement of that sentence.
 */

import {
  extractKeywords,
  extractKeywordsRanked,
  extractYearsMin,
  hasTerm,
  normalise,
  sanitizeText,
} from './keywords';
import type {
  Job,
  MatchResult,
  Profile,
  ResumeModel,
  SectionKey,
  ResumeExperience,
  ResumeProject,
} from './types';

/** Above this, coverage becomes noise rather than a signal. */
const MAX_REQUIRED = 24;

export function profileCorpus(profile: Profile): string {
  const parts: string[] = [
    profile.headline,
    profile.summary ?? '',
    ...profile.skills,
    ...profile.experience.flatMap((e) => [
      e.company,
      e.title,
      e.location ?? '',
      ...e.bullets.map((b) => b.text),
    ]),
    ...profile.projects.flatMap((p) => [p.name, p.description ?? '', ...p.bullets.map((b) => b.text)]),
    ...profile.education.flatMap((e) => [e.school, e.degree, e.field ?? '', e.details ?? '']),
  ];
  return parts.filter((p) => typeof p === 'string' && p.trim().length > 0).join('\n');
}

const corpusCache = new WeakMap<Profile, string>();
const termsCache = new WeakMap<Profile, Set<string>>();

/** Profile text is stable per object, so cache it: the list scores 300 postings. */
export function profileText(profile: Profile): string {
  const cached = corpusCache.get(profile);
  if (cached !== undefined) return cached;
  const corpus = profileCorpus(profile);
  corpusCache.set(profile, corpus);
  return corpus;
}

export function profileTerms(profile: Profile): Set<string> {
  const cached = termsCache.get(profile);
  if (cached) return cached;
  const set = new Set(extractKeywords(profileText(profile)));
  for (const s of profile.skills) set.add(normalise(s));
  termsCache.set(profile, set);
  return set;
}

/**
 * Keywords a posting actually asks for, title terms first.
 * Vocabulary-bounded: we only report terms the extractor can recognise.
 */
export function jobRequirements(job: Pick<Job, 'title' | 'description' | 'tags' | 'job_type'>): string[] {
  const titleKw = extractKeywords(job.title ?? '');
  const bodyText = [
    job.title ?? '',
    job.job_type ?? '',
    (job.tags ?? []).join(' '),
    job.description ?? '',
  ]
    .filter(Boolean)
    .join('\n');
  const ranked = extractKeywordsRanked(bodyText).map((r) => r.term);
  const ordered = [...new Set([...titleKw, ...ranked])];
  return ordered.slice(0, MAX_REQUIRED);
}

export function matchJob(profile: Profile, job: Job): MatchResult {
  const required = jobRequirements(job);
  const terms = profileTerms(profile);
  const corpus = profileText(profile);
  const titleKeywords = extractKeywords(job.title ?? '');

  const matched = required.filter((k) => terms.has(k) || hasTerm(corpus, k));
  const missing = required.filter((k) => !matched.includes(k));

  return {
    required,
    matched,
    missing,
    // A posting with zero recognisable terms is not a 0% match. It is unscored.
    coverage: required.length ? Math.round((100 * matched.length) / required.length) : null,
    titleKeywords,
    yearsRequired: job.years_min ?? extractYearsMin(job.description ?? ''),
  };
}

/* ------------------------------------------------------------------ */
/* Scoring and structural choices                                      */
/* ------------------------------------------------------------------ */

const ACTION_RE =
  /\b(led|built|shipped|designed|reduced|increased|improved|automated|launched|owned|migrated|created|ran|grew|scaled|negotiated|closed|delivered|mentored|founded)\b/i;

export function bulletScore(text: string, jobKws: string[], titleKws: string[]): number {
  let s = 0;
  for (const k of jobKws) if (hasTerm(text, k)) s += 1;
  for (const k of titleKws) if (hasTerm(text, k)) s += 2;
  if (/\d/.test(text)) s += 0.5;
  if (ACTION_RE.test(text)) s += 0.5;
  return s;
}

/**
 * Hides the least relevant bullets, never dropping a role below the floor.
 * `hidden` is a visibility flag: bullets are never deleted, and the editor
 * always shows them struck through with a restore toggle.
 */
function hideIrrelevantBullets(
  bullets: { sourceId: string; text: string }[],
  required: string[],
  titleKw: string[],
  floor: number,
) {
  const scored = bullets.map((b, index) => ({
    bullet: b,
    score: bulletScore(b.text, required, titleKw),
    index,
  }));
  // Descending by score; Array.prototype.sort is stable, so ties keep their order.
  const sorted = [...scored].sort((a, b) => b.score - a.score);

  const weak = sorted.filter((x) => x.score < 0.5).length;
  const hideCount = Math.max(0, Math.min(weak, bullets.length - floor));

  const hiddenIds = new Set(sorted.slice(sorted.length - hideCount).map((x) => x.bullet.sourceId));
  // Most relevant first; hidden bullets fall to the bottom but stay in the model.
  return sorted.map((x) => ({ ...x.bullet, hidden: hiddenIds.has(x.bullet.sourceId) }));
}

function pickSkillsForSummary(profile: Profile, matched: string[], limit = 5): string[] {
  const byCanonical = new Map<string, string>();
  for (const s of profile.skills) {
    const key = normalise(s);
    if (!byCanonical.has(key)) byCanonical.set(key, s.trim());
  }
  const fromProfile = matched
    .map((m) => byCanonical.get(normalise(m)))
    .filter((s): s is string => Boolean(s));
  const out = [...fromProfile];
  for (const s of profile.skills) {
    if (out.length >= limit) break;
    const clean = s.trim();
    if (clean && !out.some((o) => normalise(o) === normalise(clean))) out.push(clean);
  }
  return out.slice(0, limit).slice(0, 5);
}

function summaryIntroducesNewTerms(summary: string, profile: Profile): string | null {
  if (!summary) return null;
  const terms = profileTerms(profile);
  const corpus = profileText(profile);
  for (const term of extractKeywords(summary)) {
    if (!terms.has(normalise(term)) && !hasTerm(corpus, term)) return term;
  }
  return null;
}

/**
 * Template only, profile facts only. Every candidate is validated against the
 * same rule the invariant uses, and silently downgraded if it would invent a
 * term (a job title containing "React" must not assert "React" on your behalf).
 */
export function buildSummary(profile: Profile, job: Pick<Job, 'title' | 'company'>, matched: string[]): string {
  const who = sanitizeText(profile.headline, 120) || 'Professional';
  const title = sanitizeText(job.title, 90);
  const company = sanitizeText(job.company, 70);
  const skills = pickSkillsForSummary(profile, matched);
  const skillLine = skills.length ? ` Skills include ${skills.join(', ')}.` : '';

  const candidates = [
    `${who}. Targeting the ${title} role at ${company}.${skillLine}`,
    `${who}.${skillLine}`,
    profile.summary?.trim() ?? '',
    '',
  ];

  for (const candidate of candidates) {
    if (summaryIntroducesNewTerms(candidate, profile)) continue;
    return candidate.trim();
  }
  return '';
}

export interface TailorChange {
  kind: 'summary' | 'order' | 'hide' | 'section';
  label: string;
}

export interface TailorResult {
  model: ResumeModel;
  match: MatchResult;
  changes: TailorChange[];
  facts: { roles: number; bullets: number; degrees: number; projects: number };
}

export function defaultSections(isStudent: boolean): SectionKey[] {
  return isStudent
    ? ['summary', 'education', 'projects', 'experience', 'skills']
    : ['summary', 'experience', 'projects', 'skills', 'education'];
}

/**
 * The only entry point that produces a resume. Runs the invariant before
 * returning: a throw means nothing is persisted.
 */
export function tailorResume(profile: Profile, job: Job): TailorResult {
  const match = matchJob(profile, job);
  const floor = profile.isStudent ? 3 : 2;

  const experience: ResumeExperience[] = profile.experience.map((role) => ({
    company: role.company,
    title: role.title,
    location: role.location,
    start: role.start,
    end: role.end,
    bullets: hideIrrelevantBullets(
      role.bullets.map((b) => ({ sourceId: b.id, text: b.text })),
      match.required,
      match.titleKeywords,
      floor,
    ),
  }));

  const projects: ResumeProject[] = profile.projects.map((p) => ({
    name: p.name,
    link: p.link,
    bullets: p.bullets.map((b) => ({ sourceId: b.id, text: b.text })),
  }));

  const model: ResumeModel = {
    name: sanitizeText(profile.name, 80),
    headline: sanitizeText(profile.headline, 120),
    contact: {
      email: sanitizeText(profile.email, 100),
      phone: sanitizeText(profile.phone, 40),
      location: sanitizeText(profile.location, 80),
    },
    links: profile.links.map((l) => sanitizeText(l.url, 200)).filter(Boolean),
    summary: buildSummary(profile, job, match.matched),
    sections: defaultSections(profile.isStudent),
    experience,
    projects,
    education: profile.education.map((e) => ({
      school: e.school,
      degree: e.degree,
      field: e.field,
      start: e.start,
      end: e.end,
      details: e.details,
    })),
    skills: profile.skills.slice(0, 18),
  };

  const hiddenCount = experience.reduce(
    (n, r) => n + r.bullets.filter((b) => b.hidden).length,
    0,
  );

  const changes: TailorChange[] = [];
  if (model.summary) changes.push({ kind: 'summary', label: 'Summary written from your own profile facts' });
  changes.push({
    kind: 'order',
    label: profile.isStudent
      ? 'Education and projects moved above work experience (you are studying)'
      : 'Sections ordered summary → experience → projects → skills → education',
  });
  if (hiddenCount > 0) {
    changes.push({
      kind: 'hide',
      label: `${hiddenCount} bullet${hiddenCount === 1 ? '' : 's'} hidden as less relevant — still in your profile, one click to restore`,
    });
  }

  assertEngineOutput(model, profile);
  return {
    model,
    match,
    changes,
    facts: {
      roles: model.experience.length,
      bullets: model.experience.reduce((n, r) => n + r.bullets.length, 0) + model.projects.reduce((n, p) => n + p.bullets.length, 0),
      degrees: model.education.length,
      projects: model.projects.length,
    },
  };
}

/* ------------------------------------------------------------------ */
/* The invariant                                                       */
/* ------------------------------------------------------------------ */

export class FabricationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FabricationError';
  }
}

/**
 * Runs on engine output only. Editor saves are the user's own words and are
 * flagged, not blocked (see edited_by_user).
 */
export function assertEngineOutput(model: ResumeModel, profile: Profile): void {
  const sourceBullets = new Map<string, string>();
  for (const e of profile.experience) for (const b of e.bullets) sourceBullets.set(b.id, b.text);
  for (const p of profile.projects) for (const b of p.bullets) sourceBullets.set(b.id, b.text);

  const checkBullet = (sourceId: string, text: string, where: string) => {
    const source = sourceBullets.get(sourceId);
    if (source === undefined) throw new FabricationError(`fabricated bullet in ${where}: unknown source ${sourceId}`);
    if (source !== text) throw new FabricationError(`rewritten bullet in ${where}: text differs from source ${sourceId}`);
  };

  for (const role of model.experience) {
    for (const b of role.bullets) checkBullet(b.sourceId, b.text, role.company);
  }
  for (const project of model.projects) {
    for (const b of project.bullets) checkBullet(b.sourceId, b.text, project.name);
  }

  const skills = new Set(profile.skills.map(normalise));
  for (const s of model.skills) {
    if (!skills.has(normalise(s))) throw new FabricationError(`fabricated skill: ${s}`);
  }

  for (const role of model.experience) {
    const source = profile.experience.find((o) => o.company === role.company && o.title === role.title);
    if (!source) throw new FabricationError(`unknown role: ${role.company} — ${role.title}`);
    if (source.start !== role.start) throw new FabricationError(`start date changed: ${role.company}`);
    if (source.end !== role.end) throw new FabricationError(`end date changed: ${role.company}`);
  }

  const corpus = profileText(profile);
  const terms = profileTerms(profile);
  for (const term of extractKeywords(model.summary)) {
    if (!terms.has(normalise(term)) && !hasTerm(corpus, term) && !hasTerm(profile.headline, term)) {
      throw new FabricationError(`summary introduced a term you do not have: ${term}`);
    }
  }

  if (model.education.length !== profile.education.length) {
    throw new FabricationError('education entries added or removed');
  }
  for (const ed of model.education) {
    const source = profile.education.find((o) => o.school === ed.school && o.degree === ed.degree);
    if (!source) throw new FabricationError(`unknown education entry: ${ed.school}`);
    if (source.start !== ed.start || source.end !== ed.end) throw new FabricationError(`education dates changed: ${ed.school}`);
  }
}

/* ------------------------------------------------------------------ */
/* Read-only helpers for the UI                                        */
/* ------------------------------------------------------------------ */

export function visibleBullets<T extends { hidden?: boolean }>(role: { bullets: T[] }): T[] {
  return role.bullets.filter((b) => !b.hidden);
}

/** Rough page estimate at Calibri 11pt / 0.5" margins, single column. */
export function estimatePages(model: ResumeModel): number {
  const wrap = (text: string, width: number) => Math.max(1, Math.ceil(text.length / width));
  let lines = 3; // name, headline, contact
  if (model.summary) lines += wrap(model.summary, 92) + 1;
  for (const key of model.sections) {
    if (key === 'summary') continue;
    if (key === 'experience') {
      for (const role of model.experience) {
        lines += 2;
        for (const b of visibleBullets(role)) lines += wrap(b.text, 88);
      }
    }
    if (key === 'projects') {
      for (const p of model.projects) {
        lines += 1;
        for (const b of visibleBullets(p)) lines += wrap(b.text, 88);
      }
    }
    if (key === 'education') {
      for (const ed of model.education) lines += 2;
    }
    if (key === 'skills') lines += Math.max(1, Math.ceil(model.skills.join(', ').length / 92));
  }
  const perPage = 44;
  return Math.max(1, Math.round((lines / perPage) * 2) / 2);
}

/** Plain-text rendering. Also what the print stylesheet shows. */
export function resumeToText(model: ResumeModel): string {
  const out: string[] = [];
  out.push(model.name);
  if (model.headline) out.push(model.headline);
  const contact = [model.contact.email, model.contact.phone, model.contact.location, ...model.links]
    .filter(Boolean)
    .join(' · ');
  if (contact) out.push(contact);
  for (const section of model.sections) {
    if (section === 'summary' && model.summary) {
      out.push('', 'SUMMARY', model.summary);
    }
    if (section === 'experience' && model.experience.length) {
      out.push('', 'EXPERIENCE');
      for (const role of model.experience) {
        out.push(`${role.title} — ${role.company}${role.location ? ` · ${role.location}` : ''} (${role.start} – ${role.end})`);
        for (const b of visibleBullets(role)) out.push(`• ${b.text}`);
      }
    }
    if (section === 'projects' && model.projects.length) {
      out.push('', 'PROJECTS');
      for (const p of model.projects) {
        out.push(`${p.name}${p.link ? ` — ${p.link}` : ''}`);
        for (const b of visibleBullets(p)) out.push(`• ${b.text}`);
      }
    }
    if (section === 'education' && model.education.length) {
      out.push('', 'EDUCATION');
      for (const ed of model.education) {
        out.push(`${ed.degree}${ed.field ? `, ${ed.field}` : ''} — ${ed.school} (${ed.start} – ${ed.end})`);
        if (ed.details) out.push(ed.details);
      }
    }
    if (section === 'skills' && model.skills.length) {
      out.push('', 'SKILLS', model.skills.join(' · '));
    }
  }
  return out.join('\n');
}
