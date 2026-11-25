import { describe, expect, it } from 'vitest';
import {
  classifyLevel,
  dedupeKey,
  extractKeywords,
  extractYearsMin,
  hasTerm,
  htmlToText,
  normalise,
  sanitizeText,
  termRe,
} from './keywords';

describe('whole-word matching (the fabrication fix)', () => {
  const noMatch: [string, string][] = [
    ['Worked at Google', 'go'],
    ['Built with JavaScript', 'java'],
    ['Digital marketing', 'git'],
    ['Interested in sales', 'rest'],
    ['MySQL databases', 'sql'],
    ['', 'api'],
    ['A capital idea', 'api'],
    ['Going to market', 'go'],
    ['Internal tools', 'intern'],
    ['International Sales Rep', 'intern'],
    ['Staffing coordinator', 'staff'],
  ];
  it.each(noMatch)('does not match %j against %j', (haystack, term) => {
    expect(hasTerm(haystack, term)).toBe(false);
  });

  const yesMatch: [string, string][] = [
    ['Used Go daily', 'go'],
    ['Go', 'go'],
    ['C++ and C#', 'c++'],
    ['C++ and C#', 'c#'],
    ['Node.js services', 'node'],
    ['We use CI/CD', 'ci/cd'],
    ['.NET backend', '.net'],
    ['PostgreSQL', 'postgresql'],
  ];
  it.each(yesMatch)('matches %j against %j', (haystack, term) => {
    expect(hasTerm(haystack, term)).toBe(true);
  });

  it('escapes regex characters instead of throwing', () => {
    expect(() => termRe('c++')).not.toThrow();
    expect(termRe('c++').test('c++')).toBe(true);
  });
});

describe('alias normalisation', () => {
  it('maps aliases to one canonical term', () => {
    expect(normalise('JS')).toBe('javascript');
    expect(normalise('postgres')).toBe('postgresql');
    expect(normalise('K8s')).toBe('kubernetes');
    expect(normalise('ReactJS')).toBe('react');
    expect(normalise('Node.js')).toBe('node');
  });

  it('extracts canonical terms from messy spellings', () => {
    expect(extractKeywords('PostgreSQL database')).toContain('postgresql');
    expect(extractKeywords('ReactJS and Node.js')).toEqual(
      expect.arrayContaining(['react', 'node']),
    );
    expect(extractKeywords('K8s in production')).toContain('kubernetes');
    expect(extractKeywords('We run k8s and postgres')).toEqual(
      expect.arrayContaining(['kubernetes', 'postgresql']),
    );
  });

  it('keeps two-character skills that a length filter would have deleted', () => {
    expect(extractKeywords('Go and UI work')).toEqual(expect.arrayContaining(['go', 'ui']));
    expect(extractKeywords('QA engineer')).toContain('qa');
    expect(extractKeywords('UX design')).toContain('ux');
  });

  it('does not treat lowercase prose "go" as the language', () => {
    expect(extractKeywords('go to market strategy')).not.toContain('go');
    expect(extractKeywords('Used Go daily')).toContain('go');
  });

  it('never invents terms outside the vocabulary', () => {
    expect(extractKeywords('We are a friendly bunch who like snacks')).toEqual([]);
  });
});

describe('level classification', () => {
  const cases: [string, string][] = [
    ['International Sales Rep', 'mid'],
    ['Internal Tools Engineer', 'mid'],
    ['Associate Director, Sales', 'senior'],
    ['Staff Software Engineer', 'senior'],
    ['Staffing Coordinator', 'mid'],
    ['Student Success Manager', 'mid'],
    ['Graduate Software Engineer', 'entry'],
    ['Marketing Intern', 'entry'],
    ['Senior Product Manager', 'senior'],
    ['Engineering Manager', 'senior'],
    ['Community Manager', 'mid'],
    ['Junior Developer', 'entry'],
  ];
  it.each(cases)('classifies %j as %s', (title, expected) => {
    expect(classifyLevel(title)).toBe(expected);
  });

  it('falls back to the description only when the title says nothing', () => {
    expect(classifyLevel('Software Engineer', 'No experience required, students welcome')).toBe('entry');
    expect(classifyLevel('Software Engineer', 'You have 8+ years of experience')).toBe('senior');
  });
});

describe('years extraction', () => {
  it('takes the smallest stated requirement', () => {
    expect(extractYearsMin('3+ years of experience, 5 years preferred')).toBe(3);
    expect(extractYearsMin('Minimum 2 yrs in support')).toBe(2);
    expect(extractYearsMin('We value curiosity')).toBeNull();
    expect(extractYearsMin('Founded in 2015 with 40 people')).toBeNull();
  });
});

describe('dedupe across boards', () => {
  it('fingerprints the same role from two sources', () => {
    const a = dedupeKey({ title: 'Senior React Developer', company: 'Tidepool', location: 'Worldwide' });
    const b = dedupeKey({ title: 'React Developer', company: 'Tidepool Inc.', location: 'Worldwide' });
    expect(a).not.toBe(b); // different companies stay different
    expect(dedupeKey({ title: 'Senior React Developer', company: 'Tidepool', location: 'Worldwide' })).toBe(
      dedupeKey({ title: 'React Developer', company: 'Tidepool', location: 'Worldwide' }),
    );
  });
});

describe('untrusted text', () => {
  it('strips tags from job HTML without executing anything', () => {
    expect(htmlToText('<p>Hello <b>world</b></p><script>alert(1)</script>')).toContain('Hello world');
    expect(htmlToText('<p>a &amp; b</p>')).toBe('a & b');
  });

  it('sanitises hostile titles', () => {
    // Tags are removed outright, so the hostile attribute never survives.
    expect(sanitizeText('<img src=x onerror=alert(1)>Developer')).toBe('Developer');
    expect(sanitizeText('a < b > c')).not.toContain('<');
  });
});
