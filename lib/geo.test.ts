import { describe, expect, it } from 'vitest';
import { classifyGeography, explainGeography, isStale, isValidApplyUrl } from './geo';

describe('geography', () => {
  const cases: [string, string, string, string][] = [
    ['location "USA Only"', 'USA Only', 'Support Engineer', 'blocked'],
    ['blank location + "US ONLY!" title', '', 'US ONLY! Support', 'blocked'],
    ['worldwide headline, USA in first line', 'Anywhere in the World', 'Support Specialist', 'blocked'],
    ['Anywhere in the World, no restriction', 'Anywhere in the World', 'Product Designer', 'worldwide'],
    ['Africa Only', 'Africa Only', 'Sales Development Rep', 'africa_eligible'],
    ['EMEA', 'EMEA', 'Technical Support Engineer', 'africa_eligible'],
    ['Kenya', 'Nairobi, Kenya', 'Backend Engineer', 'africa_eligible'],
    ['Europe', 'Europe', 'Data Analyst', 'region_restricted'],
    ['Indiana is not India', 'Indiana', 'Virtual Assistant', 'unknown'],
    ['South Africa is not Africa', 'South Africa', 'Operations Associate', 'blocked'],
    ['South Africa in the title', 'Remote', 'Security Engineer (South Africa)', 'blocked'],
    ['blank everything', '', '', 'unknown'],
    ['vague "Remote"', 'Remote', 'Community Manager', 'unknown'],
  ];

  it.each(cases)('%s → %s', (_label, location, title, expected) => {
    const description =
      _label === 'worldwide headline, USA in first line'
        ? 'We are hiring.\nHeadquarters: Remote - USA\nYou will answer tickets.'
        : 'We build software for teams.';
    expect(classifyGeography(location, title, description)).toBe(expected);
  });

  it('ignores an unrelated country mention in body copy', () => {
    const desc = 'Our customers are in the USA and Europe. You can work from anywhere.';
    expect(classifyGeography('Worldwide', 'Frontend Developer', desc)).toBe('worldwide');
  });

  it('catches work-authorisation language', () => {
    const desc = 'Requirements: 3 years experience.\nThis role is open to candidates authorised to work in Canada.';
    expect(classifyGeography('Worldwide', 'Designer', desc)).toBe('blocked');
  });

  it('explains itself', () => {
    const result = explainGeography('EMEA', 'Support Engineer', '');
    expect(result.tier).toBe('africa_eligible');
    expect(result.reason.toLowerCase()).toContain('emea');
  });
});

describe('staleness and URL sanity', () => {
  it('flags jobs not seen in three days', () => {
    const fourDaysAgo = new Date(Date.now() - 4 * 864e5).toISOString();
    expect(isStale(fourDaysAgo)).toBe(true);
    expect(isStale(new Date().toISOString())).toBe(false);
    expect(isStale(null)).toBe(false);
  });

  it('accepts http(s) and rejects junk instead of probing the network', () => {
    expect(isValidApplyUrl('https://example.com/apply')).toBe(true);
    expect(isValidApplyUrl('javascript:alert(1)')).toBe(false);
    expect(isValidApplyUrl('')).toBe(false);
  });
});
