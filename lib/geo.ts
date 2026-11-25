/**
 * lib/geo.ts — four honest states plus unknown.
 *
 * The whole point: EMEA is not worldwide, and "Remote - USA" behind an
 * "Anywhere in the World" headline is not worldwide either. WeWorkRemotely does
 * exactly that, so detection runs in layers: location field, then title, then
 * the first lines of the description — never the company name.
 */

import { hasTerm } from './keywords';
import type { GeoTier } from './types';

export interface GeoResult {
  tier: GeoTier;
  /** Human-readable proof for the badge — never a bare colour. */
  reason: string;
}

/** Countries / territories whose "only" roles exclude a Kenya-based applicant. */
const BLOCKED_COUNTRIES = [
  'united states', 'usa', 'u.s.', 'u.s.a', 'us only', 'us-only', 'us based', 'us-based',
  'canada', 'united kingdom', 'uk', 'england', 'scotland', 'wales', 'northern ireland',
  'ireland', 'germany', 'france', 'netherlands', 'belgium', 'luxembourg', 'spain', 'portugal',
  'italy', 'switzerland', 'austria', 'poland', 'czech', 'czechia', 'slovakia', 'hungary',
  'romania', 'bulgaria', 'greece', 'croatia', 'serbia', 'sweden', 'norway', 'denmark',
  'finland', 'iceland', 'estonia', 'latvia', 'lithuania', 'ukraine', 'belarus', 'russia',
  'israel', 'turkey', 'türkiye', 'uae', 'united arab emirates', 'saudi arabia', 'qatar',
  'kuwait', 'bahrain', 'oman', 'jordan', 'lebanon', 'egypt', 'morocco', 'tunisia', 'algeria',
  'south africa', 'nigeria', 'ghana', 'uganda', 'tanzania', 'rwanda', 'ethiopia', 'zambia',
  'zimbabwe', 'botswana', 'namibia', 'mozambique', 'cameroon', 'senegal', 'ivory coast',
  'india', 'pakistan', 'bangladesh', 'sri lanka', 'nepal', 'philippines', 'indonesia',
  'malaysia', 'singapore', 'thailand', 'vietnam', 'japan', 'china', 'hong kong', 'taiwan',
  'south korea', 'korea', 'australia', 'new zealand', 'brazil', 'mexico', 'argentina',
  'colombia', 'chile', 'peru', 'uruguay', 'costa rica', 'panama',
];

/** Cities/states only signal when they appear in the structured location field. */
const BLOCKED_PLACES = [
  'california', 'new york', 'texas', 'florida', 'illinois', 'washington', 'massachusetts',
  'colorado', 'oregon', 'georgia', 'virginia', 'seattle', 'san francisco', 'san diego',
  'los angeles', 'austin', 'boston', 'chicago', 'denver', 'atlanta', 'miami', 'toronto',
  'vancouver', 'montreal', 'london', 'manchester', 'berlin', 'munich', 'hamburg', 'paris',
  'amsterdam', 'rotterdam', 'dublin', 'madrid', 'barcelona', 'lisbon', 'porto', 'warsaw',
  'krakow', 'zurich', 'geneva', 'stockholm', 'copenhagen', 'oslo', 'helsinki', 'prague',
  'budapest', 'bucharest', 'athens', 'istanbul', 'dubai', 'abu dhabi', 'tel aviv',
  'bangalore', 'bengaluru', 'hyderabad', 'mumbai', 'pune', 'delhi', 'new delhi', 'chennai',
  'singapore', 'kuala lumpur', 'jakarta', 'manila', 'sydney', 'melbourne', 'auckland',
  'são paulo', 'sao paulo', 'buenos aires', 'mexico city', 'bogotá', 'bogota', 'lima',
  'cape town', 'johannesburg', 'lagos', 'accra', 'cairo',
];

const AFRICA_TERMS = [
  'africa', 'kenya', 'nairobi', 'mombasa', 'kisumu', 'east africa', 'west africa',
  'sub-saharan', 'subsaharan', 'african continent', 'emea', 'middle east', 'africa only',
];

const WORLDWIDE_TERMS = [
  'anywhere', 'anywhere in the world', 'worldwide', 'world wide', 'world-wide', 'global',
  'globally', 'work from anywhere', 'any location', 'international', 'fully distributed',
  'distributed team', 'remote worldwide', 'remote global', 'pan-africa', 'global remote',
];

const REGION_TERMS = [
  'europe', 'european union', 'eu only', 'eea', 'apac', 'asia', 'asia-pacific',
  'asia pacific', 'latam', 'latin america', 'south america', 'north america', 'americas',
  'mena', 'oceania', 'nordics', 'benelux', 'dach', 'eurasia',
];

/** Phrases that turn a nearby country name into a real restriction. */
const RESTRICTION_MARKER =
  /(must\s+(?:be\s+)?(?:located|reside|live|based|residency|work)|only\s+(?:consider|considering|open\s+to|accepting|available)|open\s+to\s+(?:candidates|applicants|residents|those)|eligible\s+to\s+work|eligible\s+to\s+apply|authoriz(?:ed|s)ed\s+to\s+work|right\s+to\s+work|work\s+(?:authorization|authorisation|permit)|citizenship|security\s+clearance|clearance\s+required|residents?\s+of|remote\s*[-–—]\s*\w|location\s*:|region\s*:|headquarters\s*:|hq\s*:|based\s+in\s+(?:the\s+)?\w|country\s*:|time\s?zone[s]?\s+(?:required|only))/i;

const HARD_COUNTRY_TITLE_RE = new RegExp(
  `\\(\\s*(?:${[...BLOCKED_COUNTRIES, ...BLOCKED_PLACES]
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')})\\s*\\)|\\b(?:us|usa|uk|eu)\\s*only\\b` +
    `|\\b(?:remote|based)\\s*[-–—]\\s*(?:${BLOCKED_COUNTRIES.filter((t) => t.length > 3)
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|')})\\b`,
  'i',
);

function anyTerm(text: string, terms: string[]): string | null {
  if (!text) return null;
  for (const term of terms) {
    // hasTerm is word-boundary safe: "Indiana" is not "India".
    if (hasTerm(text, term)) return term;
  }
  return null;
}

function clean(s: string | null | undefined): string {
  return (s ?? '').replace(/\s+/g, ' ').trim();
}

function firstLines(text: string, count = 14): string[] {
  return text
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, count);
}

/**
 * Classifies a posting. Pass the location field, title and description only —
 * never the company name ("Global Ltd" once turned US-only roles worldwide).
 */
export function classifyGeography(
  location?: string | null,
  title?: string | null,
  description?: string | null,
): GeoTier {
  return explainGeography(location, title, description).tier;
}

export function explainGeography(
  location?: string | null,
  title?: string | null,
  description?: string | null,
): GeoResult {
  const loc = clean(location);
  const ttl = clean(title);
  const desc = (description ?? '').replace(/\r/g, '');

  if (!loc && !ttl && !desc) {
    return { tier: 'unknown', reason: 'No location information in the posting.' };
  }

  // ── Layer 0: South Africa before Africa. They are not the same thing. ──
  const southAfrica = ['south africa', 'cape town', 'johannesburg', 'pretoria', 'durban'].find(
    (t) => hasTerm(loc, t) || hasTerm(ttl, t),
  );
  if (southAfrica) {
    return {
      tier: 'blocked',
      reason: `"${southAfrica}" in the posting — this is a South Africa restriction, not Africa-wide.`,
    };
  }

  // ── Layer 1: title, hard country check ──
  if (ttl && HARD_COUNTRY_TITLE_RE.test(ttl)) {
    return { tier: 'blocked', reason: 'The job title names a restricted country or region.' };
  }
  const titleCountry = anyTerm(ttl, [...BLOCKED_COUNTRIES, ...BLOCKED_PLACES]);
  if (titleCountry) {
    return { tier: 'blocked', reason: `"${titleCountry}" appears in the job title.` };
  }

  // ── Layer 2: structured location ──
  if (loc) {
    const country = anyTerm(loc, BLOCKED_COUNTRIES);
    if (country) return { tier: 'blocked', reason: `Location is restricted to "${country}".` };
    const place = anyTerm(loc, BLOCKED_PLACES);
    if (place) return { tier: 'blocked', reason: `The location field names "${place}".` };
  }

  // ── Layer 3: restriction lines in the description ──
  // Checked before "worldwide", because "Anywhere in the World" is routinely
  // followed by "Location: Remote - USA". Only marked lines count, so body copy
  // like "our customers are in the USA" cannot condemn an open role.
  for (const line of firstLines(desc)) {
    if (!RESTRICTION_MARKER.test(line)) continue;
    const country = anyTerm(line, BLOCKED_COUNTRIES);
    if (country) {
      return {
        tier: 'blocked',
        reason: `The posting restricts to ${country}: "${line.slice(0, 90)}".`,
      };
    }
    const region = anyTerm(line, REGION_TERMS);
    if (region) {
      return {
        tier: 'region_restricted',
        reason: `The posting restricts to ${region}: "${line.slice(0, 90)}".`,
      };
    }
  }

  // ── Layer 4: location, eligibility first, then reach, then restrictions ──
  if (loc) {
    const africa = anyTerm(loc, AFRICA_TERMS);
    if (africa) {
      return africa === 'emea' || africa === 'middle east'
        ? {
            tier: 'africa_eligible',
            reason: `Location says "${africa}" — Kenya is in scope, though some ${africa} roles still ask for EU work authorisation.`,
          }
        : { tier: 'africa_eligible', reason: `Location says "${africa}" — Kenya is in scope.` };
    }
    const region = anyTerm(loc, REGION_TERMS);
    if (region) return { tier: 'region_restricted', reason: `Location is limited to ${region}.` };
    const worldwide = anyTerm(loc, WORLDWIDE_TERMS);
    if (worldwide) {
      return { tier: 'worldwide', reason: `Location says "${worldwide}" and no restriction follows it.` };
    }
  }

  // ── Layer 5: description signals ──
  const head = firstLines(desc, 8).join(' ');
  const descAfrica = anyTerm(head, AFRICA_TERMS);
  if (descAfrica) return { tier: 'africa_eligible', reason: `The posting mentions "${descAfrica}".` };
  const descRegion = anyTerm(head, REGION_TERMS);
  const descWorld = anyTerm(head, WORLDWIDE_TERMS);
  if (descWorld && !descRegion) {
    return { tier: 'worldwide', reason: `The posting says "${descWorld}".` };
  }
  if (descRegion) return { tier: 'region_restricted', reason: `The posting mentions ${descRegion}.` };

  if (!loc && !ttl) return { tier: 'unknown', reason: 'The posting does not state a location.' };
  return {
    tier: 'unknown',
    reason: loc
      ? `Location "${loc}" is not specific enough to judge — check the posting before applying.`
      : 'No usable location information — check the posting before applying.',
  };
}

export const GEO_LABEL: Record<GeoTier, string> = {
  worldwide: 'Worldwide',
  africa_eligible: 'Africa & EMEA',
  region_restricted: 'Region-locked',
  blocked: 'Not eligible',
  unknown: 'Unknown',
};

export const GEO_GLYPH: Record<GeoTier, string> = {
  worldwide: '🌍',
  africa_eligible: '🌍',
  region_restricted: '🌐',
  blocked: '⛔',
  unknown: '❓',
};

/**
 * Short, honest fallbacks used when the stored tier and a fresh explanation
 * disagree (the ingest classifies with the full description, a detail page may
 * only have what the API returned). The stored tier is authoritative.
 */
export const GEO_FALLBACK: Record<GeoTier, string> = {
  worldwide: 'The posting reads as open worldwide — confirm on the original listing.',
  africa_eligible: 'The posting names Africa, Kenya or EMEA as in scope.',
  region_restricted: 'The posting is limited to a region that excludes Kenya.',
  blocked: 'The posting restricts applicants to a country or region that excludes Kenya.',
  unknown: 'The posting does not say where it is open. Check before applying.',
};

/** Default Discover filter: worldwide + Africa/EMEA only. */
export const GEO_DEFAULT: GeoTier[] = ['worldwide', 'africa_eligible'];

export function isLikelyEligible(tier: GeoTier): boolean {
  return tier === 'worldwide' || tier === 'africa_eligible';
}

/** Staleness signal that replaces the flaky "apply_url returns 200" check. */
export function isStale(lastSeen: string | null | undefined, now = Date.now()): boolean {
  if (!lastSeen) return false;
  const t = Date.parse(lastSeen);
  if (Number.isNaN(t)) return false;
  return now - t > 3 * 24 * 60 * 60 * 1000;
}

export function isValidApplyUrl(url: string | null | undefined): boolean {
  return typeof url === 'string' && /^https?:\/\/[^\s]+$/i.test(url);
}
