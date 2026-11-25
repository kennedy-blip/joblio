import raw from '@/data/demo-jobs.json';
import { classifyLevel, extractYearsMin, htmlToText } from './keywords';
import { classifyGeography } from './geo';
import type { Job } from './types';

interface RawDemoJob {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  source: string;
  source_url: string;
  apply_url: string;
  postedHoursAgo: number;
  salary: string;
  job_type: string;
  tags: string[];
}

/**
 * Bundled snapshot used only when Supabase is unreachable or anonymous sign-in
 * is disabled. Every row is labelled as sample data in the UI — it is never
 * presented as a live posting.
 *
 * Classification runs through the same lib/geo and lib/keywords code as the
 * real ingest, so the demo exercises the engine rather than faking its output.
 */
export const DEMO_JOBS: Job[] = (raw as RawDemoJob[]).map((j) => {
  const description = htmlToText(j.description);
  const now = Date.now();
  return {
    id: j.id,
    external_id: j.id,
    title: j.title,
    company: j.company,
    location: j.location,
    geo_tier: classifyGeography(j.location, j.title, description),
    level: classifyLevel(j.title, description),
    job_type: j.job_type,
    salary: j.salary,
    source: j.source,
    source_url: j.source_url,
    apply_url: j.apply_url,
    description,
    posted_at: new Date(now - j.postedHoursAgo * 3600_000).toISOString(),
    last_seen_at: new Date(now).toISOString(),
    years_min: extractYearsMin(description),
    tags: j.tags,
  };
});

export const DEMO_SNAPSHOT_LABEL = 'Bundled sample snapshot';
