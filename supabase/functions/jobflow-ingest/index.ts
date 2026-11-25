// supabase/functions/jobflow-ingest/index.ts
//
// Runs inside Supabase (Deno). This is the ONLY component that touches the job
// boards: Vercel Hobby cron is daily at best, and the dev sandbox has no egress.
// Called by pg_cron (with x-cron-secret) or by the app's Refresh button (JWT,
// throttled by a 10-minute cooldown, because the free APIs ask for restraint).
//
// Terms of service respected: every row keeps the board's own URL and name; we
// never re-serve a listing as our own; requests are spaced; five sources, a few
// times a day. Remotive is deliberately absent — its terms forbid this use.

const SB_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
const COOLDOWN_MIN = 10;
const STALE_HOURS = 18;
const MAX_PER_SOURCE = 250;
const UA = 'JobFlow/2.0 (remote job discovery; https://github.com/kennedy-blip/joblio)';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const JSON_HEADERS = { ...CORS, 'Content-Type': 'application/json' };

type Raw = {
  external_id: string; title: string; company: string; location: string; description: string;
  source: string; source_url: string; apply_url: string; posted_at: string | null;
  salary: string | null; job_type: string | null; tags: string[];
};
type Result = { source: string; fetched: number; inserted: number; updated: number; skipped: number; ok: boolean; error?: string };

/* --------------------------------- utils -------------------------------- */

const text = (html: unknown, max = 7000): string =>
  typeof html !== 'string' ? '' : html
    .replace(/<\s*br\s*\/?\s*>/gi, '\n').replace(/<\s*\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '• ').replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&[a-z]+;/gi, ' ')
    .replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);

// Third-party titles are untrusted: strip tags before storage, never render HTML.
const plain = (v: unknown, max = 200): string =>
  typeof v === 'string' ? v.replace(/<[^>]*>/g, '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max) : '';

const iso = (v: unknown): string | null => {
  if (!v) return null;
  const d = new Date(typeof v === 'number' ? (v < 1e12 ? v * 1000 : v) : String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function httpJsonReal(url: string, init: RequestInit = {}, timeout = 25000): Promise<unknown> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctl.signal,
      headers: { 'User-Agent': UA, Accept: 'application/json, text/xml, */*', ...(init.headers ?? {}) },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const body = await res.text();
    try { return JSON.parse(body); } catch { return body; }
  } finally { clearTimeout(timer); }
}

const rest = (path: string, init: RequestInit = {}) =>
  httpJsonReal(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json', ...(init.headers ?? {}),
    },
  });

/* ---------------------------- classification ---------------------------- */
// A cache of the same rules in lib/geo.ts + lib/keywords.ts. The app recomputes
// both from shared code on read, so what a user sees can never drift from the
// engine; these columns are for filtering and audits.

const BLOCKED = ['united states','usa','u.s.','canada','united kingdom','uk','england','scotland','ireland','germany','france','netherlands','belgium','spain','portugal','italy','switzerland','austria','poland','czech','hungary','romania','bulgaria','greece','sweden','norway','denmark','finland','iceland','estonia','latvia','lithuania','ukraine','russia','israel','turkey','türkiye','uae','united arab emirates','saudi arabia','qatar','kuwait','bahrain','oman','jordan','lebanon','egypt','morocco','tunisia','algeria','south africa','nigeria','ghana','uganda','tanzania','rwanda','ethiopia','zambia','zimbabwe','botswana','namibia','mozambique','cameroon','senegal','india','pakistan','bangladesh','sri lanka','nepal','philippines','indonesia','malaysia','singapore','thailand','vietnam','japan','china','hong kong','taiwan','south korea','korea','australia','new zealand','brazil','mexico','argentina','colombia','chile','peru','uruguay'];
const AFRICA = ['africa','kenya','nairobi','east africa','west africa','sub-saharan','subsaharan','emea','middle east'];
const WORLD = ['anywhere','anywhere in the world','worldwide','world wide','world-wide','global','globally','work from anywhere','international','distributed'];
const REGIONS = ['europe','european union','eu only','eea','apac','asia','asia-pacific','latam','latin america','south america','north america','americas','mena','oceania'];
const RESTRICTION = /(must\s+(?:be\s+)?(?:located|reside|live|based|residency|work)|only\s+(?:consider|considering|open\s+to|accepting|available)|open\s+to\s+(?:candidates|applicants|residents|those)|authoriz(?:ed|s)ed\s+to\s+work|right\s+to\s+work|work\s+(?:authorization|authorisation|permit)|citizenship|clearance|location\s*:|region\s*:|headquarters\s*:|hq\s*:|remote\s*[-–—]\s*\w)/i;

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const has = (hay: string, term: string) => new RegExp(`(?<![\\w+#.])${esc(term)}(?![\\w+#])`, 'i').test(hay);
const first = (hay: string, list: string[]) => list.find((t) => has(hay, t)) ?? null;

function classifyGeo(location: string, title: string, description: string): string {
  if (!location && !title) return 'unknown';
  if (['south africa', 'cape town', 'johannesburg'].some((t) => has(location, t) || has(title, t))) return 'blocked';
  if (first(title, BLOCKED)) return 'blocked';
  if (location && first(location, BLOCKED)) return 'blocked';
  // "Anywhere in the World" followed by "Headquarters: Remote - USA" is the trap.
  for (const line of description.split(/\n+/).slice(0, 14)) {
    if (!RESTRICTION.test(line)) continue;
    if (first(line, BLOCKED)) return 'blocked';
    if (first(line, REGIONS)) return 'region_restricted';
  }
  if (location) {
    if (first(location, AFRICA)) return 'africa_eligible';
    if (first(location, REGIONS)) return 'region_restricted';
    if (first(location, WORLD)) return 'worldwide';
  }
  const head = description.split(/\n+/).slice(0, 8).join(' ');
  const region = first(head, REGIONS);
  const world = first(head, WORLD);
  if (first(head, AFRICA)) return 'africa_eligible';
  if (world && !region) return 'worldwide';
  if (region) return 'region_restricted';
  return 'unknown';
}

const SENIOR_RE = /\b(senior|sr\.?|lead|principal|staff|director|head of|vp|vice president|chief|architect|expert|distinguished)\b|\b(engineering|product|project|programme|program|general|department|sales|marketing|operations)\s+manager\b/i;
const ENTRY_RE = /\b(intern|internship|entry[- ]level|junior|jr\.?|graduate|trainee|apprentice|fresher|associate\s+(?:software|engineer|developer|analyst|consultant|sdr))\b/i;

function classifyLevel(title: string, description: string): string {
  if (SENIOR_RE.test(title)) return 'senior';
  if (ENTRY_RE.test(title)) return 'entry';
  if (/\b(no experience required|students welcome|recent graduate|final year|internship)\b/i.test(description)) return 'entry';
  return 'mid';
}

function yearsMin(t: string): number | null {
  const n = [...t.matchAll(/\b(\d{1,2})\s*(?:\+|plus)?\s*(?:years?|yrs?)\b/gi)]
    .map((m) => Number(m[1])).filter((v) => v >= 1 && v <= 20);
  return n.length ? Math.min(...n) : null;
}

function dedupeKey(title: string, company: string, location: string): string {
  const norm = (s: string) => (s ?? '').toLowerCase()
    .replace(/\b(senior|sr|junior|jr|lead|staff|principal|ii|iii)\b/g, '').replace(/[^a-z0-9]/g, '');
  return `${norm(company)}|${norm(title)}|${norm(location)}`;
}

/* -------------------------------- sources ------------------------------- */

async function remoteOk(): Promise<Raw[]> {
  const data = await httpJsonReal('https://remoteok.com/api');
  if (!Array.isArray(data)) throw new Error('RemoteOK: unexpected payload');
  const out: Raw[] = [];
  for (const j of data as Record<string, unknown>[]) {
    const position = plain(j.position);
    if (!position) continue; // index 0 is a legal notice
    const url = String(j.url ?? '');
    out.push({
      external_id: `remoteok:${String(j.id ?? j.slug ?? position)}`,
      title: position, company: plain(j.company) || 'Unknown',
      location: plain(j.location) || 'Remote', description: text(j.description),
      source: 'RemoteOK', source_url: url, apply_url: String(j.apply_url ?? url ?? ''),
      posted_at: iso(j.date),
      salary: j.salary_min || j.salary_max ? `USD ${Number(j.salary_min ?? 0).toLocaleString()} – ${Number(j.salary_max ?? 0).toLocaleString()}` : null,
      job_type: null,
      tags: Array.isArray(j.tags) ? (j.tags as string[]).map((t) => plain(t, 40)).filter(Boolean) : [],
    });
    if (out.length >= MAX_PER_SOURCE) break;
  }
  return out;
}

async function jobicy(): Promise<Raw[]> {
  const data = (await httpJsonReal('https://jobicy.com/api/v2/remote-jobs?count=100')) as { jobs?: Record<string, unknown>[] };
  const jobs = data?.jobs;
  if (!Array.isArray(jobs)) throw new Error('Jobicy: no jobs array');
  return jobs.slice(0, MAX_PER_SOURCE).map((j) => ({
    external_id: `jobicy:${String(j.id ?? j.url)}`,
    title: plain(j.jobTitle), company: plain(j.companyName) || 'Unknown',
    location: plain(j.jobGeo) || 'Remote', description: text(j.jobDescription ?? j.jobExcerpt),
    source: 'Jobicy', source_url: String(j.url ?? ''), apply_url: String(j.url ?? ''),
    posted_at: iso(j.pubDate),
    salary: j.annualSalaryMin || j.annualSalaryMax
      ? `${j.salaryCurrency ?? ''} ${j.annualSalaryMin ?? ''}–${j.annualSalaryMax ?? ''}`.trim() : null,
    job_type: Array.isArray(j.jobType) ? (j.jobType as string[]).join(', ') : plain(j.jobType) || null,
    tags: Array.isArray(j.jobIndustry) ? (j.jobIndustry as string[]).map((t) => plain(t, 40)) : [],
  })).filter((j) => j.title);
}

async function himalayas(): Promise<Raw[]> {
  const data = (await httpJsonReal('https://himalayas.app/jobs/api?limit=100&offset=0')) as { jobs?: Record<string, unknown>[] };
  const jobs = data?.jobs;
  if (!Array.isArray(jobs)) throw new Error('Himalayas: no jobs array');
  return jobs.slice(0, MAX_PER_SOURCE).map((j) => ({
    external_id: `himalayas:${String(j.guid ?? j.applicationLink ?? j.title)}`,
    title: plain(j.title), company: plain(j.companyName) || 'Unknown',
    location: Array.isArray(j.locationRestrictions) && j.locationRestrictions.length
      ? plain((j.locationRestrictions as string[]).join(', '), 120) : 'Remote',
    description: text(j.description),
    source: 'Himalayas', source_url: String(j.applicationLink ?? ''), apply_url: String(j.applicationLink ?? ''),
    posted_at: iso(j.pubDate),
    salary: j.minSalary || j.maxSalary ? `${j.salaryCurrency ?? ''} ${j.minSalary ?? ''}–${j.maxSalary ?? ''}`.trim() : null,
    job_type: plain(j.employmentType) || null,
    tags: Array.isArray(j.categories) ? (j.categories as string[]).map((t) => plain(t, 40)) : [],
  })).filter((j) => j.title);
}

async function arbeitnow(): Promise<Raw[]> {
  const out: Raw[] = [];
  for (let page = 1; page <= 2; page++) {
    const data = (await httpJsonReal(`https://www.arbeitnow.com/api/job-board-api?page=${page}`)) as { data?: Record<string, unknown>[] };
    const rows = data?.data;
    if (!Array.isArray(rows) || !rows.length) break;
    for (const j of rows) {
      if (j.remote === false) continue; // on-site German roles are out of scope
      out.push({
        external_id: `arbeitnow:${String(j.slug ?? j.url)}`,
        title: plain(j.title), company: plain(j.company_name) || 'Unknown',
        location: plain(j.location) || 'Remote', description: text(j.description),
        source: 'Arbeitnow', source_url: String(j.url ?? ''), apply_url: String(j.url ?? ''),
        posted_at: iso(j.created_at), salary: null,
        job_type: Array.isArray(j.job_types) ? (j.job_types as string[]).join(', ') : null,
        tags: Array.isArray(j.tags) ? (j.tags as string[]).map((t) => plain(t, 40)) : [],
      });
      if (out.length >= MAX_PER_SOURCE) break;
    }
    if (out.length >= MAX_PER_SOURCE) break;
    await sleep(300);
  }
  return out.filter((j) => j.title);
}

const decodeXml = (v: string) => v
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').trim();

async function weWorkRemotely(): Promise<Raw[]> {
  const xml = await httpJsonReal('https://weworkremotely.com/remote-jobs.rss');
  if (typeof xml !== 'string') throw new Error('WWR: unexpected payload');
  const out: Raw[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const item = m[1];
    const pick = (tag: string) => {
      const found = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
      return found ? decodeXml(found[1]) : '';
    };
    const rawTitle = pick('title');
    if (!rawTitle) continue;
    const [maybeCompany, ...rest] = rawTitle.split(':');
    const link = pick('link');
    out.push({
      external_id: `wwr:${link || rawTitle}`,
      title: plain(rest.length ? rest.join(':') : rawTitle),
      company: rest.length ? plain(maybeCompany) : 'Unknown',
      location: pick('region') || 'Remote', description: text(pick('description')),
      source: 'WeWorkRemotely', source_url: link, apply_url: link,
      posted_at: iso(pick('pubDate')), salary: null, job_type: pick('type') || null,
      tags: (pick('category') || '').split(',').map((t) => plain(t, 40)).filter(Boolean),
    });
    if (out.length >= MAX_PER_SOURCE) break;
  }
  return out;
}

const SOURCES: { source: string; run: () => Promise<Raw[]> }[] = [
  { source: 'RemoteOK', run: remoteOk },
  { source: 'WeWorkRemotely', run: weWorkRemotely },
  { source: 'Jobicy', run: jobicy },
  { source: 'Himalayas', run: himalayas },
  { source: 'Arbeitnow', run: arbeitnow },
];

/* -------------------------------- ingest -------------------------------- */

async function ingest(source: string, raw: Raw[], runStart: string): Promise<Result> {
  const res: Result = { source, fetched: raw.length, inserted: 0, updated: 0, skipped: 0, ok: true };
  const existing = (await rest(
    `jobflow_jobs?select=id,external_id,dedupe_key&source=eq.${encodeURIComponent(source)}`,
  )) as { id: string; external_id: string; dedupe_key: string | null }[];
  const byExternal = new Map((existing ?? []).map((r) => [r.external_id, r]));
  const taken = new Set((existing ?? []).map((r) => r.dedupe_key).filter(Boolean) as string[]);

  const fresh: Record<string, unknown>[] = [];
  const seenIds: string[] = [];

  for (const job of raw) {
    if (!job.title || !job.apply_url) { res.skipped++; continue; }
    const dkey = dedupeKey(job.title, job.company, job.location);
    const known = byExternal.get(job.external_id);
    if (known) { seenIds.push(known.id); continue; }
    if (taken.has(dkey)) { res.skipped++; continue; } // same role on another board
    taken.add(dkey);
    fresh.push({
      external_id: job.external_id, title: job.title, company: job.company,
      location: job.location, description: job.description, source: job.source,
      source_url: job.source_url || job.apply_url, apply_url: job.apply_url,
      posted_at: job.posted_at, salary: job.salary, job_type: job.job_type,
      tags: job.tags.slice(0, 12),
      geo_tier: classifyGeo(job.location, job.title, job.description),
      level: classifyLevel(job.title, job.description),
      years_min: yearsMin(job.description),
      dedupe_key: dkey, last_seen_at: new Date().toISOString(), is_active: true,
    });
  }

  if (seenIds.length) {
    await rest(`jobflow_jobs?id=in.(${seenIds.join(',')})`, {
      method: 'PATCH',
      body: JSON.stringify({ last_seen_at: new Date().toISOString(), is_active: true }),
      headers: { Prefer: 'return=minimal' },
    });
    res.updated = seenIds.length;
  }

  for (let i = 0; i < fresh.length; i += 50) {
    const batch = fresh.slice(i, i + 50);
    try {
      await rest('jobflow_jobs', { method: 'POST', body: JSON.stringify(batch), headers: { Prefer: 'return=minimal' } });
      res.inserted += batch.length;
    } catch (error) {
      // One colliding row must not lose the whole batch.
      for (const row of batch) {
        try {
          await rest('jobflow_jobs', { method: 'POST', body: JSON.stringify(row), headers: { Prefer: 'return=minimal' } });
          res.inserted++;
        } catch { res.skipped++; }
      }
      console.warn(`batch fallback ${source}: ${String(error)}`);
    }
  }

  // Ghost jobs: only after a complete fetch, only for rows already comfortably
  // older than three syncs. A partial fetch can never deactivate anything.
  const cutoff = new Date(Date.now() - STALE_HOURS * 3600_000).toISOString();
  await rest(
    `jobflow_jobs?source=eq.${encodeURIComponent(source)}&last_seen_at=lt.${encodeURIComponent(runStart)}` +
      `&created_at=lt.${encodeURIComponent(cutoff)}&is_active=is.true`,
    { method: 'PATCH', body: JSON.stringify({ is_active: false }), headers: { Prefer: 'return=minimal' } },
  ).catch((e) => console.warn(`deactivate ${source}: ${String(e)}`));

  return res;
}

async function logRun(result: Result, startedAt: string) {
  await rest('jobflow_ingest_runs', {
    method: 'POST',
    body: JSON.stringify({
      source: result.source, started_at: startedAt, finished_at: new Date().toISOString(),
      fetched: result.fetched, inserted: result.inserted, updated: result.updated,
      ok: result.ok, error: result.error ?? null,
    }),
    headers: { Prefer: 'return=minimal' },
  }).catch((e) => console.error('run log failed', String(e)));
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers: JSON_HEADERS });

  const runStart = new Date().toISOString();
  let body: { force?: boolean } = {};
  try { body = await request.json(); } catch { body = {}; }

  const secretOk = Boolean(CRON_SECRET) && request.headers.get('x-cron-secret') === CRON_SECRET;
  const force = Boolean(body?.force) && secretOk; // only a trusted caller skips the cooldown

  try {
    const runs = (await rest(
      'jobflow_ingest_runs?select=finished_at&finished_at=not.is.null&order=finished_at.desc&limit=1',
    )) as { finished_at: string }[];
    const last = runs?.[0]?.finished_at;
    if (last && !force) {
      const age = Date.now() - Date.parse(last);
      if (age < COOLDOWN_MIN * 60_000) {
        return new Response(JSON.stringify({
          status: 'cooldown', lastRun: last, cooldownRemainingMs: COOLDOWN_MIN * 60_000 - age,
          message: `Synced ${Math.round(age / 60000)} min ago. The free job APIs ask for restraint — try again shortly.`,
        }), { headers: JSON_HEADERS });
      }
    }
  } catch (e) { console.warn('cooldown check failed', String(e)); }

  const settled = await Promise.allSettled(SOURCES.map(async ({ source, run }) => {
    const startedAt = new Date().toISOString();
    try {
      const result = await ingest(source, await run(), runStart);
      await logRun(result, startedAt);
      return result;
    } catch (error) {
      const failure: Result = {
        source, fetched: 0, inserted: 0, updated: 0, skipped: 0, ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
      await logRun(failure, startedAt);
      return failure;
    }
  }));

  const perSource = settled.map((s) => s.status === 'fulfilled' ? s.value : {
    source: 'unknown', fetched: 0, inserted: 0, updated: 0, skipped: 0, ok: false, error: String(s.reason),
  });
  const inserted = perSource.reduce((n, s) => n + s.inserted, 0);
  const updated = perSource.reduce((n, s) => n + s.updated, 0);
  const failures = perSource.filter((s) => !s.ok);

  return new Response(JSON.stringify({
    status: failures.length === perSource.length ? 'error' : 'synced',
    inserted, updated, perSource, lastRun: new Date().toISOString(),
    message: failures.length === perSource.length
      ? 'Every source failed — nothing changed. Check the run log.'
      : `${inserted} new posting${inserted === 1 ? '' : 's'}, ${updated} refreshed.`,
  }), { headers: JSON_HEADERS });
});
