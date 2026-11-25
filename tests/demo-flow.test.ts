import { describe, expect, it } from 'vitest';
import { DEMO_JOBS } from '@/lib/demo-data';
import { SAMPLE_PROFILE } from '@/lib/sample';
import { assertEngineOutput, matchJob, tailorResume } from '@/lib/tailor';
import { classifyGeography } from '@/lib/geo';
import { classifyLevel } from '@/lib/keywords';
import type { Job } from '@/lib/types';

const byId = (id: string) => DEMO_JOBS.find((j) => j.id === id) as Job;

describe('bundled snapshot', () => {
  it('covers every geography state the UI can render', () => {
    const tiers = new Set(DEMO_JOBS.map((j) => j.geo_tier));
    expect(tiers).toEqual(new Set(['blocked', 'africa_eligible', 'worldwide', 'region_restricted', 'unknown']));
  });

  it('classifies the tricky rows the way the spec requires', () => {
    expect(byId('demo-01').geo_tier).toBe('blocked'); // Worldwide headline, "Remote - USA" in line 2
    expect(byId('demo-02').geo_tier).toBe('africa_eligible'); // Africa Only
    expect(byId('demo-04').geo_tier).toBe('africa_eligible'); // EMEA
    expect(byId('demo-05').geo_tier).toBe('region_restricted'); // Europe
    expect(byId('demo-12').geo_tier).toBe('unknown'); // Indiana is not India
    expect(byId('demo-18').geo_tier).toBe('blocked'); // South Africa is not Africa
  });

  it('classifies level from the title, senior first', () => {
    expect(byId('demo-09').level).toBe('senior'); // Associate Director, Sales
    expect(byId('demo-08').level).toBe('senior'); // Senior Staff Engineer
    expect(byId('demo-07').level).toBe('entry'); // Marketing Intern
    expect(byId('demo-10').level).toBe('mid'); // Student Success Manager
  });

  it('keeps every posting attributable to its source', () => {
    for (const job of DEMO_JOBS) {
      expect(job.source.length).toBeGreaterThan(0);
      expect(job.apply_url).toMatch(/^https?:\/\//);
      expect(job.source_url).toMatch(/^https?:\/\//);
    }
  });
});

describe('whole loop over the snapshot', () => {
  it('tailors every posting without inventing a fact', () => {
    for (const job of DEMO_JOBS) {
      const { model, match, facts } = tailorResume(SAMPLE_PROFILE, job);
      expect(() => assertEngineOutput(model, SAMPLE_PROFILE)).not.toThrow();
      if (match.required.length === 0) expect(match.coverage).toBeNull();
      else expect(match.coverage).toBeGreaterThanOrEqual(0);
      expect(facts.bullets).toBeGreaterThan(0);
    }
  });

  it('gives different postings different summaries', () => {
    const a = tailorResume(SAMPLE_PROFILE, byId('demo-02')).model.summary;
    const b = tailorResume(SAMPLE_PROFILE, byId('demo-03')).model.summary;
    expect(a).not.toBe(b);
  });

  it('hides nothing on a posting that matches everything, and never empties a role', () => {
    for (const job of DEMO_JOBS) {
      const { model } = tailorResume(SAMPLE_PROFILE, job);
      for (const role of model.experience) {
        expect(role.bullets.filter((b) => !b.hidden).length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('scores a 300-row list fast enough to feel instant', () => {
    const rows: Job[] = Array.from({ length: 300 }).map((_, i) => ({
      ...byId('demo-03'),
      id: `perf-${i}`,
      description: undefined,
      title: i % 3 === 0 ? 'Customer Support Specialist' : i % 3 === 1 ? 'React Developer' : 'Data Analyst',
    }));
    const started = performance.now();
    for (const row of rows) matchJob(SAMPLE_PROFILE, row);
    const elapsed = performance.now() - started;
    expect(elapsed).toBeLessThan(1500);
  });
});

describe('regression guards from the review', () => {
  it('never reports a 0% coverage just because the vocabulary missed', () => {
    const opaque: Job = {
      ...byId('demo-01'),
      id: 'opaque',
      title: 'Night Shift Helper',
      description: 'Join a friendly crew. We will show you what to do.',
      tags: [],
    };
    expect(matchJob(SAMPLE_PROFILE, opaque).coverage).toBeNull();
  });

  it('lets a restriction beat body copy that says "global"', () => {
    // A company called "Global Inc" must not be able to turn a US-only role into
    // a worldwide one: the structured field and restriction lines win.
    expect(classifyGeography('USA Only', 'Support Specialist', 'We are a global company.')).toBe('blocked');
    expect(classifyGeography('USA Only', 'Support Specialist', 'Region: Global')).toBe('blocked');
    expect(classifyGeography('', 'Support Specialist', 'Global Inc is hiring.')).toBe('worldwide');
  });

  it('does not mistake a student role for an internship', () => {
    expect(classifyLevel('Student Success Manager')).toBe('mid');
    expect(classifyLevel('International Sales Rep')).toBe('mid');
  });
});
