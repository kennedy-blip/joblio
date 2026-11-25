/**
 * lib/cv-parse.ts — paste-a-CV heuristics.
 *
 * Deliberately not a PDF parser. The #1 adoption wall is a 15-bullet typing
 * marathon, and pasting text you already own removes it. Everything parsed is
 * shown back to the user for correction — the parser guesses, the human decides.
 */

import type { ProfileLink } from './types';

export interface ParsedBulletSet {
  bullets: string[];
}

export interface ParsedRole {
  title: string;
  company: string;
  location: string;
  start: string;
  end: string;
  bullets: string[];
}

export interface ParsedEducation {
  degree: string;
  field: string;
  school: string;
  start: string;
  end: string;
}

export interface ParsedProject {
  name: string;
  link: string;
  bullets: string[];
}

export interface ParsedCv {
  name: string;
  email: string;
  phone: string;
  location: string;
  links: ProfileLink[];
  summary: string;
  skills: string[];
  experience: ParsedRole[];
  projects: ParsedProject[];
  education: ParsedEducation[];
  likelyStudent: boolean;
  counts: { roles: number; bullets: number; skills: number };
}

const ROLE_WORDS =
  /\b(engineer|developer|programmer|intern|internship|manager|analyst|representative|designer|consultant|lead|associate|coordinator|specialist|support|sales|marketing|scientist|administrator|assistant|director|officer|founder|freelance|architect|researcher|writer|editor|accountant|recruiter|success|sdr|bdr)\b/i;

const DEGREE_WORDS = /\b(bsc|ba|b\.?a\b|bcom|b\.?com|bcs|beng|b\.?eng|msc|m\.?sc|ma|mba|phd|bachelor|master|diploma|certificate|degree)\b/i;

const MONTHS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
];

const MONTH_RE = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?';
const DATE_TOKEN = `(?:(?:${MONTH_RE})\\s*)?(?:19|20)\\d{2}`;
const DATE_RANGE_RE = new RegExp(`(${DATE_TOKEN})\\s*(?:-|–|—|to|until|through)\\s*(${DATE_TOKEN}|present|current|now|today)`, 'i');
const SINGLE_DATE_RE = new RegExp(`(?<![\\d])(${DATE_TOKEN})(?![\\d])`, 'i');

const BULLET_RE = /^\s*(?:[-–—*•·▪◦o]|\(?\d{1,2}[.)])\s+(.*)$/;

const SECTION_PATTERNS: { key: string; re: RegExp }[] = [
  { key: 'summary', re: /^(summary|profile|objective|about( me)?|personal statement)\b/i },
  { key: 'experience', re: /^(work\s+)?(experience|employment|professional experience|career|work history)\b/i },
  { key: 'education', re: /^(education|academics|academic background|qualifications)\b/i },
  { key: 'projects', re: /^(projects|selected projects|side projects|portfolio)\b/i },
  { key: 'skills', re: /^(skills|technical skills|core skills|competencies|tools|technologies)\b/i },
  { key: 'other', re: /^(certifications?|awards?|activities|volunteering|interests|references|languages)\b/i },
];

function normaliseMonth(token: string): string {
  const t = token.trim().toLowerCase().replace(/\./g, '');
  const idx = MONTHS.findIndex((m) => t.startsWith(m));
  if (idx === -1) return token.trim();
  const label = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][idx];
  const yearMatch = token.match(/(?:19|20)\d{2}/);
  return yearMatch ? `${label} ${yearMatch[0]}` : label;
}

export function parseDateRange(line: string): { start: string; end: string; raw: string } | null {
  const m = line.match(DATE_RANGE_RE);
  if (!m) return null;
  const endRaw = m[2].toLowerCase();
  const end = /present|current|now|today/.test(endRaw) ? 'Present' : normaliseMonth(endRaw);
  return { start: normaliseMonth(m[1]), end, raw: m[0] };
}

function splitParts(line: string): string[] {
  return line
    .split(/\s*(?:\||—|–|·|•|@|\bat\b)\s*/i)
    .map((p) => p.replace(/\s{2,}/g, ' ').trim())
    .filter(Boolean);
}

function stripTrailingDates(line: string): string {
  return line
    .replace(DATE_RANGE_RE, '')
    .replace(SINGLE_DATE_RE, '')
    .replace(/[|,;·—–-]+\s*$/, '')
    .replace(/^\s*[|,;·—–-]+/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function pickTitleCompany(parts: string[]): { title: string; company: string; location: string } {
  const cleaned = parts.map((p) => p.trim()).filter(Boolean);
  if (cleaned.length === 0) return { title: '', company: '', location: '' };
  if (cleaned.length === 1) {
    const nested = splitParts(cleaned[0]);
    if (nested.length > 1) return pickTitleCompany(nested);
    const single = cleaned[0];
    const byComma = single.split(/\s*,\s*/);
    if (byComma.length >= 2 && ROLE_WORDS.test(byComma[0]) && !ROLE_WORDS.test(byComma[1])) {
      return { title: byComma[0], company: byComma[1], location: byComma.slice(2).join(', ') };
    }
    return { title: single, company: '', location: '' };
  }
  const titleIdx = cleaned.findIndex((p) => ROLE_WORDS.test(p));
  if (titleIdx === 0) return { title: cleaned[0], company: cleaned[1], location: cleaned[2] ?? '' };
  if (titleIdx > 0) return { title: cleaned[titleIdx], company: cleaned[0], location: cleaned[2] ?? '' };
  return { title: cleaned[0], company: cleaned[1], location: cleaned[2] ?? '' };
}

export function parseCv(text: string): ParsedCv {
  const lines = text
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/\s+$/g, ''))
    .filter((l) => l.trim().length > 0);

  const raw = text;
  const email = raw.match(/[\w.+-]+@[\w-]+\.[\w.]{2,}/)?.[0] ?? '';
  const phone = raw.match(/(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?){2,4}\d{2,4}/)?.[0]?.trim() ?? '';
  const urlMatches = [...raw.matchAll(/((?:https?:\/\/)?(?:www\.)?(?:github|linkedin|gitlab|behance|dribbble|medium)\.com\/[\w./-]+|(?:https?:\/\/)?[\w-]+\.(?:dev|io|me|app|com)\/[\w./-]*)/gi)]
    .map((m) => m[0].replace(/^https?:\/\//, '').replace(/[.,;]$/, ''))
    .filter((u, i, arr) => arr.indexOf(u) === i);

  const links: ProfileLink[] = urlMatches.slice(0, 4).map((url) => {
    const label = /github/i.test(url)
      ? 'GitHub'
      : /linkedin/i.test(url)
        ? 'LinkedIn'
        : /gitlab/i.test(url)
          ? 'GitLab'
          : url.split('/')[0];
    return { label, url };
  });

  const headerLines = lines.slice(0, 8);
  const name =
    headerLines.find(
      (l) =>
        !l.includes('@') &&
        !/\d{3}/.test(l) &&
        l.length <= 60 &&
        !/^(curriculum vitae|resume|cv)$/i.test(l.trim()),
    )?.trim() ?? '';

  const location =
    headerLines.find((l) => /,/.test(l) && /(kenya|nairobi|uganda|tanzania|rwanda|remote|nigeria|ghana|south africa)/i.test(l))
      ?.split(/[·|]/)[0]
      .trim() ?? '';

  // ── sectioning ──
  type Section = 'header' | 'summary' | 'experience' | 'education' | 'projects' | 'skills' | 'other';
  const sections: { key: Section; lines: string[] }[] = [{ key: 'header', lines: [] }];
  let current = sections[0];
  for (const line of lines) {
    const bare = line.replace(/[:•·-]+$/, '').trim();
    const match = SECTION_PATTERNS.find((s) => s.re.test(bare) && bare.length <= 42);
    if (match) {
      current = { key: match.key as Section, lines: [] };
      sections.push(current);
      continue;
    }
    current.lines.push(line);
  }

  const sectionLines = (key: Section) =>
    sections.filter((s) => s.key === key).flatMap((s) => s.lines);

  // ── summary ──
  const summary = sectionLines('summary').join(' ').replace(/\s{2,}/g, ' ').trim().slice(0, 600);

  // ── experience ──
  const experience: ParsedRole[] = [];
  {
    let pending: string[] = [];
    let role: ParsedRole | null = null;
    for (const line of sectionLines('experience')) {
      const bullet = line.match(BULLET_RE);
      if (bullet) {
        if (!role) {
          const guess = pickTitleCompany(pending);
          role = { ...guess, start: '', end: '', bullets: [] };
          experience.push(role);
          pending = [];
        }
        role.bullets.push(bullet[1].trim());
        continue;
      }
      const range = parseDateRange(line);
      if (range) {
        const rest = stripTrailingDates(line);
        const parts = rest ? splitParts(rest) : [];
        const source = parts.length ? parts : pending;
        const guess = pickTitleCompany(source);
        const hasBullets = role && role.bullets.length > 0;
        if (!role || hasBullets) {
          role = { ...guess, start: range.start, end: range.end, bullets: [] };
          experience.push(role);
        } else {
          role.title = guess.title || role.title;
          role.company = guess.company || role.company;
          role.location = guess.location || role.location;
          role.start = range.start;
          role.end = range.end;
        }
        pending = [];
        continue;
      }
      pending.push(line);
      // A pending header after an entry with bullets means a new entry starts.
      if (role && role.bullets.length > 0 && pending.length === 1) {
        const guess = pickTitleCompany([line]);
        role = { ...guess, start: '', end: '', bullets: [] };
        experience.push(role);
        pending = [];
      }
    }
    // Fold a trailing header-only entry into the previous one if it looks like a company line.
    const cleaned = experience.filter((r) => r.title || r.company || r.bullets.length);
    experience.length = 0;
    experience.push(
      ...cleaned.map((r) => ({
        ...r,
        title: r.title.trim(),
        company: r.company.trim().replace(/,\s*(nairobi|kenya|remote).*$/i, ''),
      })),
    );
  }

  // ── education ──
  const education: ParsedEducation[] = [];
  for (const line of sectionLines('education')) {
    if (BULLET_RE.test(line)) {
      const last = education[education.length - 1];
      if (last) last.field = `${last.field}${last.field ? ' ' : ''}${line.replace(BULLET_RE, '$1')}`.trim();
      continue;
    }
    const range = parseDateRange(line);
    const rest = stripTrailingDates(line);
    const parts = splitParts(rest);
    if (!range && parts.length === 0) continue;
    const degreePart = parts.find((p) => DEGREE_WORDS.test(p)) ?? '';
    const schoolPart = parts.find((p) => p !== degreePart) ?? '';
    const degreeBits = degreePart.split(/\s+/);
    const degree = degreeBits[0] ?? '';
    const field = degreePart.replace(degree, '').replace(/^[,\s-]+/, '').trim();
    if (!degree && !schoolPart && !range) continue;
    const previous = education[education.length - 1];
    if (range && !degree && !schoolPart && previous && !previous.start) {
      previous.start = range.start;
      previous.end = range.end;
      continue;
    }
    education.push({
      degree,
      field,
      school: schoolPart.trim(),
      start: range?.start ?? '',
      end: range?.end ?? '',
    });
  }

  // ── projects ──
  const projects: ParsedProject[] = [];
  {
    let project: ParsedProject | null = null;
    for (const line of sectionLines('projects')) {
      const bullet = line.match(BULLET_RE);
      if (bullet) {
        if (!project) {
          project = { name: 'Project', link: '', bullets: [] };
          projects.push(project);
        }
        project.bullets.push(bullet[1].trim());
        continue;
      }
      const range = parseDateRange(line);
      const rest = stripTrailingDates(line) || line;
      const urlMatch = rest.match(/((?:https?:\/\/)?[\w-]+\.[a-z]{2,}\/[\w./-]+)/i);
      const name = rest.replace(urlMatch?.[0] ?? '', '').replace(/[—–|·]+\s*$/, '').trim();
      if (project && project.bullets.length === 0 && !range) {
        project.link = urlMatch?.[0] ?? project.link;
        project.name = project.name === 'Project' ? name : project.name;
        continue;
      }
      project = { name: name || 'Project', link: urlMatch?.[0] ?? '', bullets: [] };
      projects.push(project);
    }
  }

  // ── skills ──
  const skillBlob = sectionLines('skills').join(', ');
  const skills = skillBlob
    .split(/[,;|•·/]|\s{3,}/)
    .map((s) => s.replace(/^[-–—*]\s*/, '').trim())
    .filter((s) => s.length > 0 && s.length <= 32)
    .filter((s, i, arr) => arr.findIndex((o) => o.toLowerCase() === s.toLowerCase()) === i)
    .slice(0, 24);

  const years = education.map((e) => Number(e.end.match(/(19|20)\d{2}/)?.[0] ?? 0)).filter(Boolean);
  const likelyStudent = years.some((y) => y >= new Date().getFullYear());

  return {
    name,
    email,
    phone,
    location,
    links,
    summary,
    skills,
    experience,
    projects,
    education,
    likelyStudent,
    counts: {
      roles: experience.length,
      bullets: experience.reduce((n, r) => n + r.bullets.length, 0) + projects.reduce((n, p) => n + p.bullets.length, 0),
      skills: skills.length,
    },
  };
}

/** Maps parsed CV text onto a Profile, generating stable bullet ids. */
export function parsedCvToProfile(parsed: ParsedCv, base: { isStudent: boolean }) {
  const stamp = Date.now().toString(36);
  return {
    name: parsed.name,
    headline: '',
    email: parsed.email,
    phone: parsed.phone,
    location: parsed.location,
    links: parsed.links,
    summary: parsed.summary,
    skills: parsed.skills,
    isStudent: base.isStudent || parsed.likelyStudent,
    experience: parsed.experience.map((r, i) => ({
      id: `exp-${stamp}-${i}`,
      company: r.company || 'Company',
      title: r.title || 'Role',
      location: r.location,
      start: r.start,
      end: r.end,
      bullets: r.bullets.map((text, j) => ({ id: `b-${stamp}-${i}-${j}`, text })),
    })),
    projects: parsed.projects.map((p, i) => ({
      id: `prj-${stamp}-${i}`,
      name: p.name,
      link: p.link,
      bullets: p.bullets.map((text, j) => ({ id: `pb-${stamp}-${i}-${j}`, text })),
    })),
    education: parsed.education.map((e, i) => ({
      id: `edu-${stamp}-${i}`,
      school: e.school,
      degree: e.degree,
      field: e.field,
      start: e.start,
      end: e.end,
      details: '',
    })),
  };
}
