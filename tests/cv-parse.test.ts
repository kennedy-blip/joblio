import { describe, expect, it } from 'vitest';
import { parseCv, parseDateRange, parsedCvToProfile } from '@/lib/cv-parse';
import { SAMPLE_CV_TEXT } from '@/lib/sample';

describe('paste-a-CV parser', () => {
  const parsed = parseCv(SAMPLE_CV_TEXT);

  it('finds the contact details', () => {
    expect(parsed.name).toContain('KENNEDY WANJIRU');
    expect(parsed.email).toBe('kennedy.wanjiru@example.com');
    expect(parsed.phone).toContain('254');
    expect(parsed.links.some((l) => l.url.includes('github.com/kennedy-wanjiru'))).toBe(true);
  });

  it('finds every role with its dates', () => {
    expect(parsed.experience.length).toBe(3);
    expect(parsed.experience[0].company).toContain('Sahili Cloud');
    expect(parsed.experience[0].title).toContain('Sales Development Representative');
    expect(parsed.experience[0].start).toBe('Mar 2025');
    expect(parsed.experience[0].end).toBe('Present');
    expect(parsed.experience[2].end).toBe('May 2024');
  });

  it('keeps bullets with their role', () => {
    expect(parsed.experience[0].bullets.length).toBe(3);
    expect(parsed.experience[0].bullets[0]).toContain('41 qualified demos');
  });

  it('reads education and skills', () => {
    expect(parsed.education.length).toBe(1);
    expect(parsed.education[0].school).toContain('University of Nairobi');
    expect(parsed.education[0].start).toBe('Sep 2023');
    expect(parsed.skills).toContain('PostgreSQL');
    expect(parsed.skills.length).toBeGreaterThan(8);
    expect(parsed.likelyStudent).toBe(true);
  });

  it('captures projects separately from experience', () => {
    expect(parsed.projects.length).toBeGreaterThanOrEqual(1);
    expect(parsed.projects[0].name).toContain('Shamba');
  });

  it('parses date ranges in the shapes people actually write', () => {
    expect(parseDateRange('Mar 2025 - Present')?.end).toBe('Present');
    expect(parseDateRange('2019 – 2021')?.start).toBe('2019');
    expect(parseDateRange('Jan. 2020 to Current')?.end).toBe('Present');
    expect(parseDateRange('No dates here')).toBeNull();
  });

  it('produces a profile with stable, unique bullet ids', () => {
    const profile = parsedCvToProfile(parsed, { isStudent: false });
    const ids = profile.experience.flatMap((e) => e.bullets.map((b) => b.id));
    expect(ids.length).toBeGreaterThan(6);
    expect(new Set(ids).size).toBe(ids.length);
    expect(profile.isStudent).toBe(true); // inferred from a 2026 graduation
  });

  it('survives junk input without throwing', () => {
    expect(() => parseCv('')).not.toThrow();
    expect(() => parseCv('hello')).not.toThrow();
    const junk = parseCv('Random line\nAnother line\nwith no structure at all');
    expect(junk.experience).toEqual([]);
  });
});
