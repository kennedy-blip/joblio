import { describe, expect, it } from 'vitest';
import {
  assertEngineOutput,
  bulletScore,
  estimatePages,
  matchJob,
  profileCorpus,
  tailorResume,
  visibleBullets,
  FabricationError,
} from './tailor';
import { extractKeywords, hasTerm } from './keywords';
import { SAMPLE_PROFILE } from './sample';
import { frontendJob, opaqueJob, supportJob, tinyProfile } from '@/tests/fixtures';
import type { ResumeModel } from './types';

const sourceTexts = (profile: typeof SAMPLE_PROFILE) => {
  const texts = new Set<string>();
  for (const e of profile.experience) for (const b of e.bullets) texts.add(b.text);
  for (const p of profile.projects) for (const b of p.bullets) texts.add(b.text);
  return texts;
};

describe('matching', () => {
  it('scores coverage from whole-word, alias-normalised terms', () => {
    const result = matchJob(SAMPLE_PROFILE, supportJob);
    expect(result.required.length).toBeGreaterThan(3);
    expect(result.matched).toContain('customer support');
    expect(result.coverage).toBeGreaterThan(0);
    expect(result.coverage).toBeLessThanOrEqual(100);
    expect(result.yearsRequired).toBe(2);
  });

  it('does not claim a skill the profile lacks', () => {
    const result = matchJob(SAMPLE_PROFILE, frontendJob);
    expect(result.missing).not.toContain('react');
    expect(result.matched).toContain('react');
  });

  it('returns null coverage — not 0% — when the posting yields no terms', () => {
    const result = matchJob(SAMPLE_PROFILE, opaqueJob);
    expect(result.required).toEqual([]);
    expect(result.coverage).toBeNull();
  });

  it('coverage is a term-overlap ratio, so identical sets are 100', () => {
    const profile = { ...tinyProfile, skills: ['zendesk'], experience: [], projects: [], education: [] };
    const job = { ...supportJob, description: 'zendesk', title: 'Zendesk', tags: [] };
    expect(matchJob(profile, job).coverage).toBe(100);
  });
});

describe('bullet scoring', () => {
  it('prefers title terms and measurable outcomes', () => {
    const weak = bulletScore('Ran the office book club.', ['customer support'], ['customer support']);
    const strong = bulletScore('Handled 50+ customer support tickets a day.', ['customer support'], ['customer support']);
    expect(strong).toBeGreaterThan(weak);
  });
});

describe('tailoring', () => {
  it('emits bullets character-identical to the profile', () => {
    const { model } = tailorResume(SAMPLE_PROFILE, supportJob);
    const allowed = sourceTexts(SAMPLE_PROFILE);
    for (const role of model.experience) {
      for (const b of role.bullets) expect(allowed.has(b.text)).toBe(true);
    }
    for (const project of model.projects) {
      for (const b of project.bullets) expect(allowed.has(b.text)).toBe(true);
    }
  });

  it('never changes company, title or dates', () => {
    const { model } = tailorResume(SAMPLE_PROFILE, supportJob);
    expect(model.experience.map((r) => [r.company, r.title, r.start, r.end])).toEqual(
      SAMPLE_PROFILE.experience.map((r) => [r.company, r.title, r.start, r.end]),
    );
    expect(model.education.map((e) => [e.school, e.start, e.end])).toEqual(
      SAMPLE_PROFILE.education.map((e) => [e.school, e.start, e.end]),
    );
  });

  it('produces a different summary and bullet order for different jobs', () => {
    const support = tailorResume(SAMPLE_PROFILE, supportJob);
    const frontend = tailorResume(SAMPLE_PROFILE, frontendJob);
    expect(support.model.summary).not.toBe(frontend.model.summary);
    const supportOrder = support.model.experience[0].bullets.map((b) => b.sourceId);
    const frontendOrder = frontend.model.experience[0].bullets.map((b) => b.sourceId);
    expect(supportOrder).not.toEqual(frontendOrder);
  });

  it('keeps the sales bullets on an SDR posting', () => {
    const { model } = tailorResume(SAMPLE_PROFILE, {
      ...supportJob,
      title: 'Sales Development Representative',
      description:
        'Cold outreach over email, HubSpot pipeline hygiene, lead generation, book demos. 1+ years in sales.',
    });
    const visible = visibleBullets(model.experience[0]).map((b) => b.text);
    expect(visible.join(' ')).toContain('HubSpot');
  });

  it('never hides a role below the floor', () => {
    const experienced = { ...SAMPLE_PROFILE, isStudent: false };
    const { model } = tailorResume(experienced, opaqueJob);
    for (const role of model.experience) {
      expect(visibleBullets(role).length).toBeGreaterThanOrEqual(Math.min(2, role.bullets.length));
    }
    // A student keeps three bullets per role.
    const student = tailorResume(SAMPLE_PROFILE, opaqueJob);
    for (const role of student.model.experience) {
      expect(visibleBullets(role).length).toBeGreaterThanOrEqual(Math.min(3, role.bullets.length));
    }
  });

  it('orders a student resume education-first and keeps summary on top', () => {
    const { model } = tailorResume(SAMPLE_PROFILE, supportJob);
    expect(model.sections[0]).toBe('summary');
    expect(model.sections.indexOf('education')).toBeLessThan(model.sections.indexOf('experience'));
    const experienced = tailorResume({ ...SAMPLE_PROFILE, isStudent: false }, supportJob);
    expect(experienced.model.sections.indexOf('experience')).toBeLessThan(
      experienced.model.sections.indexOf('education'),
    );
  });

  it('reports the facts it did not change', () => {
    const { facts, model } = tailorResume(SAMPLE_PROFILE, supportJob);
    expect(facts.roles).toBe(SAMPLE_PROFILE.experience.length);
    expect(facts.degrees).toBe(SAMPLE_PROFILE.education.length);
    expect(facts.bullets).toBe(
      model.experience.reduce((n, r) => n + r.bullets.length, 0) +
        model.projects.reduce((n, p) => n + p.bullets.length, 0),
    );
  });
});

describe('the invariant', () => {
  const base = () => tailorResume(SAMPLE_PROFILE, supportJob).model;

  it('accepts honest engine output', () => {
    expect(() => assertEngineOutput(base(), SAMPLE_PROFILE)).not.toThrow();
  });

  it('rejects a project bullet with a bogus sourceId', () => {
    const model: ResumeModel = structuredClone(base());
    model.projects[0].bullets[0].sourceId = 'made-up-id';
    expect(() => assertEngineOutput(model, SAMPLE_PROFILE)).toThrow(FabricationError);
  });

  it('rejects a bullet whose text was reworded behind a valid id', () => {
    const model: ResumeModel = structuredClone(base());
    model.experience[0].bullets[0].text = `${model.experience[0].bullets[0].text} (improved)`;
    expect(() => assertEngineOutput(model, SAMPLE_PROFILE)).toThrow(/rewritten bullet/);
  });

  it('rejects a summary that introduces a term you do not have', () => {
    const model: ResumeModel = structuredClone(base());
    model.summary = 'Kubernetes platform engineer with deep Terraform experience.';
    expect(() => assertEngineOutput(model, SAMPLE_PROFILE)).toThrow(/summary introduced/);
  });

  it('rejects a fabricated skill', () => {
    const model: ResumeModel = structuredClone(base());
    model.skills = [...model.skills, 'Rust'];
    expect(() => assertEngineOutput(model, SAMPLE_PROFILE)).toThrow(/fabricated skill/);
  });

  it('rejects changed dates, unknown roles and altered education', () => {
    const dates: ResumeModel = structuredClone(base());
    dates.experience[0].end = 'Dec 2026';
    expect(() => assertEngineOutput(dates, SAMPLE_PROFILE)).toThrow(/end date/);

    const role: ResumeModel = structuredClone(base());
    role.experience[0].title = 'Head of Revenue';
    expect(() => assertEngineOutput(role, SAMPLE_PROFILE)).toThrow(/unknown role/);

    const edu: ResumeModel = structuredClone(base());
    edu.education.push({ school: 'Oxford', degree: 'MSc', start: '2020', end: '2021' });
    expect(() => assertEngineOutput(edu, SAMPLE_PROFILE)).toThrow(/education/);
  });
});

describe('summary generation is conservative', () => {
  it('never asserts a job-title term the profile does not contain', () => {
    const job = { ...frontendJob, title: 'Kubernetes Platform Engineer' };
    const { model } = tailorResume(SAMPLE_PROFILE, job);
    for (const term of extractKeywords(model.summary)) {
      expect(hasTerm(profileCorpus(SAMPLE_PROFILE), term) || SAMPLE_PROFILE.skills.some((s) => s.toLowerCase().includes(term))).toBe(true);
    }
  });

  it('writes a summary mentioning the target role when it is safe to', () => {
    const { model } = tailorResume(SAMPLE_PROFILE, supportJob);
    expect(model.summary).toContain('Customer Support Specialist');
    expect(model.summary).toContain('Northwind Labs');
  });

  it('estimates a page count between one and three for the sample', () => {
    const { model } = tailorResume(SAMPLE_PROFILE, supportJob);
    const pages = estimatePages(model);
    expect(pages).toBeGreaterThanOrEqual(1);
    expect(pages).toBeLessThanOrEqual(3);
  });
});
