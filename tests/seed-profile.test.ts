import { describe, expect, it } from 'vitest';
import { SEED_PROFILE } from '@/lib/seed-profile';
import { DEMO_JOBS } from '@/lib/demo-data';
import { assertEngineOutput, matchJob, tailorResume } from '@/lib/tailor';
import type { Job } from '@/lib/types';

const support: Job = {
  ...(DEMO_JOBS.find((j) => j.id === 'demo-03') as Job),
  id: 'seed-support',
  title: 'Technical Support Specialist (Remote)',
  company: 'Example',
  description:
    'We need someone patient who can troubleshoot Windows and Android issues, write clear documentation, work with JSON and CSV files, and communicate with customers over email and chat. Python or JavaScript a plus. Git experience helpful.',
  tags: ['technical support', 'troubleshooting', 'documentation'],
};

describe('seeded profile', () => {
  it('carries only facts a CV can back', () => {
    expect(SEED_PROFILE.experience).toHaveLength(0);
    expect(SEED_PROFILE.isStudent).toBe(true);
    for (const project of SEED_PROFILE.projects) {
      expect(project.bullets.length).toBeGreaterThanOrEqual(2);
    }
    expect(SEED_PROFILE.education[0].school).toMatch(/Meru University/);
  });

  it('produces a resume with no empty sections', () => {
    const { model } = tailorResume(SEED_PROFILE, support);
    expect(model.sections).not.toContain('experience');
    expect(model.sections).toEqual(['summary', 'education', 'projects', 'skills']);
    expect(model.experience).toHaveLength(0);
    expect(model.projects.length).toBe(4);
  });

  it('keeps every project bullet character-identical to the profile', () => {
    const { model } = tailorResume(SEED_PROFILE, support);
    const source = new Map(
      SEED_PROFILE.projects.flatMap((p) => p.bullets.map((b) => [b.id, b.text] as const)),
    );
    for (const project of model.projects) {
      for (const bullet of project.bullets) {
        expect(source.get(bullet.sourceId)).toBe(bullet.text);
      }
    }
    expect(() => assertEngineOutput(model, SEED_PROFILE)).not.toThrow();
  });

  it('scores against a real support posting instead of crashing on an empty role list', () => {
    const match = matchJob(SEED_PROFILE, support);
    expect(match.required.length).toBeGreaterThan(0);
    expect(match.matched).toContain('documentation');
    expect(match.coverage).toBeGreaterThan(0);
  });

  it('writes a summary from profile facts only', () => {
    const { model } = tailorResume(SEED_PROFILE, support);
    expect(model.summary.length).toBeGreaterThan(20);
    expect(() => assertEngineOutput(model, SEED_PROFILE)).not.toThrow();
  });
});
