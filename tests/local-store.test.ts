import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createLocalStore } from '@/lib/store';
import { SEED_PROFILE } from '@/lib/seed-profile';
import { tailorResume } from '@/lib/tailor';
import { DEMO_JOBS } from '@/lib/demo-data';
import type { Job } from '@/lib/types';

/** A minimal localStorage so the browser-only store can be exercised in Node. */
const memory = new Map<string, string>();

beforeAll(() => {
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => void memory.set(key, value),
      removeItem: (key: string) => void memory.delete(key),
    },
  };
});

beforeEach(() => memory.clear());

describe('local store', () => {
  it('starts empty, then keeps whatever is written', async () => {
    const first = createLocalStore();
    await expect(first.getProfile()).resolves.toBeNull();

    await first.saveProfile(SEED_PROFILE);

    const second = createLocalStore(); // fresh instance, same "browser"
    const loaded = await second.getProfile();
    expect(loaded?.name).toBe('Kennedy Mokaya');
    expect(loaded?.projects).toHaveLength(4);
  });

  it('survives a tailored resume + application, which is the real daily loop', async () => {
    const store = createLocalStore();
    await store.saveProfile(SEED_PROFILE);

    const job = DEMO_JOBS.find((j) => j.level === 'entry') as Job;
    const result = tailorResume(SEED_PROFILE, job);
    const resume = await store.createResume({
      job,
      model: result.model,
      coverage: result.match.coverage,
      matched: result.match.matched,
      missing: result.match.missing,
      profile: SEED_PROFILE,
    });
    await store.saveApplication({
      job_id: job.id,
      resume_id: resume.id,
      job_title: job.title,
      company: job.company,
      apply_url: job.apply_url,
      stage: 'applied',
    });

    const reopened = createLocalStore();
    const resumes = await reopened.listResumes();
    const applications = await reopened.listApplications();
    expect(resumes).toHaveLength(1);
    expect(resumes[0].model.summary).toBe(result.model.summary);
    expect(resumes[0].edited_by_user).toBe(false);
    expect(applications).toHaveLength(1);
    expect(applications[0].stage).toBe('applied');
    expect(applications[0].resume_id).toBe(resume.id);
  });

  it('marks an edited resume as the user\'s own', async () => {
    const store = createLocalStore();
    await store.saveProfile(SEED_PROFILE);
    const job = DEMO_JOBS[0] as Job;
    const result = tailorResume(SEED_PROFILE, job);
    const resume = await store.createResume({
      job,
      model: result.model,
      coverage: result.match.coverage,
      matched: result.match.matched,
      missing: result.match.missing,
      profile: SEED_PROFILE,
    });

    await store.updateResumeModel(resume.id, { ...result.model, summary: 'My own words.' });

    const reopened = createLocalStore();
    const saved = await reopened.getResume(resume.id);
    expect(saved?.edited_by_user).toBe(true);
    expect(saved?.model.summary).toBe('My own words.');
  });

  it('wipes everything on request', async () => {
    const store = createLocalStore();
    await store.saveProfile(SEED_PROFILE);
    await store.deleteEverything();
    await expect(createLocalStore().getProfile()).resolves.toBeNull();
  });
});
