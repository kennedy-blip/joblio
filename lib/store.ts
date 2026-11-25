'use client';

import { getSupabase } from './supabase-client';
import { DEMO_JOBS } from './demo-data';
import type { ApplicationRow, Job, Profile, ResumeModel, ResumeRow, Stage } from './types';

export type StoreMode = 'cloud' | 'local';

export interface RefreshResult {
  ok: boolean;
  status: 'synced' | 'cached' | 'cooldown' | 'unavailable' | 'error';
  message: string;
  lastRun?: string | null;
  inserted?: number;
}

export interface CreateResumeInput {
  job: Pick<Job, 'id' | 'title' | 'company' | 'apply_url'>;
  model: ResumeModel;
  coverage: number | null;
  matched: string[];
  missing: string[];
  profile: Profile;
}

export interface Store {
  mode: StoreMode;
  workspaceId: string;
  listJobs(): Promise<Job[]>;
  getJob(id: string): Promise<Job | null>;
  getProfile(): Promise<Profile | null>;
  saveProfile(profile: Profile): Promise<void>;
  listResumes(): Promise<ResumeRow[]>;
  getResume(id: string): Promise<ResumeRow | null>;
  createResume(input: CreateResumeInput): Promise<ResumeRow>;
  updateResumeModel(id: string, model: ResumeModel): Promise<void>;
  listApplications(): Promise<ApplicationRow[]>;
  saveApplication(
    patch: Partial<ApplicationRow> & { job_title?: string | null; company?: string | null },
  ): Promise<ApplicationRow>;
  deleteApplication(id: string): Promise<void>;
  exportAll(): Promise<Record<string, unknown>>;
  deleteEverything(): Promise<void>;
  refreshJobs(force?: boolean): Promise<RefreshResult>;
  onNewJobs(handler: (job: Job) => void): () => void;
  lastSynced(): Promise<string | null>;
}

const nowIso = () => new Date().toISOString();
const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}`;

/* ------------------------------------------------------------------ */
/* Supabase-backed store                                               */
/* ------------------------------------------------------------------ */

function mapResume(row: Record<string, unknown>): ResumeRow {
  return {
    id: row.id as string,
    job_id: (row.job_id as string) ?? null,
    job_title: (row.job_title as string) ?? null,
    company: (row.company as string) ?? null,
    apply_url: (row.apply_url as string) ?? null,
    model: row.model as ResumeModel,
    match_score: (row.match_score as number) ?? null,
    matched_keywords: (row.matched_keywords as string[]) ?? [],
    missing_keywords: (row.missing_keywords as string[]) ?? [],
    profile_snapshot: (row.profile_snapshot as Profile) ?? null,
    original_model: (row.original_model as ResumeModel) ?? null,
    edited_by_user: Boolean(row.edited_by_user),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function mapApplication(row: Record<string, unknown>): ApplicationRow {
  return {
    id: row.id as string,
    job_id: (row.job_id as string) ?? null,
    resume_id: (row.resume_id as string) ?? null,
    job_title: (row.job_title as string) ?? null,
    company: (row.company as string) ?? null,
    apply_url: (row.apply_url as string) ?? null,
    stage: ((row.stage as Stage) ?? 'saved') as Stage,
    notes: (row.notes as string) ?? null,
    applied_at: (row.applied_at as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export function createCloudStore(workspaceId: string): Store {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase is not configured');

  return {
    mode: 'cloud',
    workspaceId,

    async listJobs() {
      const { data, error } = await sb
        .from('jobflow_jobs')
        .select(
          'id, title, company, location, geo_tier, level, job_type, salary, source, source_url, apply_url, posted_at, last_seen_at, years_min, tags',
        )
        .eq('is_active', true)
        .order('posted_at', { ascending: false, nullsFirst: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as Job[];
    },

    async getJob(id) {
      const { data, error } = await sb.from('jobflow_jobs').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return (data as Job) ?? null;
    },

    async getProfile() {
      const { data, error } = await sb
        .from('jobflow_profiles')
        .select('data')
        .eq('workspace_id', workspaceId)
        .maybeSingle();
      if (error) throw error;
      return (data?.data as Profile) ?? null;
    },

    async saveProfile(profile) {
      const { error } = await sb
        .from('jobflow_profiles')
        .upsert(
          { workspace_id: workspaceId, data: { ...profile, updatedAt: nowIso() }, updated_at: nowIso() },
          { onConflict: 'workspace_id' },
        );
      if (error) throw error;
    },

    async listResumes() {
      const { data, error } = await sb
        .from('jobflow_resumes')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapResume);
    },

    async getResume(id) {
      const { data, error } = await sb
        .from('jobflow_resumes')
        .select('*')
        .eq('id', id)
        .eq('workspace_id', workspaceId)
        .maybeSingle();
      if (error) throw error;
      return data ? mapResume(data) : null;
    },

    async createResume(input) {
      const { data, error } = await sb
        .from('jobflow_resumes')
        .insert({
          workspace_id: workspaceId,
          job_id: input.job.id,
          job_title: input.job.title,
          company: input.job.company,
          apply_url: input.job.apply_url,
          model: input.model,
          match_score: input.coverage,
          matched_keywords: input.matched,
          missing_keywords: input.missing,
          profile_snapshot: input.profile,
        })
        .select('*')
        .single();
      if (error) throw error;
      return mapResume(data);
    },

    async updateResumeModel(id, model) {
      const { error } = await sb
        .from('jobflow_resumes')
        .update({ model, edited_by_user: true, updated_at: nowIso() })
        .eq('id', id)
        .eq('workspace_id', workspaceId);
      if (error) throw error;
    },

    async listApplications() {
      const { data, error } = await sb
        .from('jobflow_applications')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapApplication);
    },

    async saveApplication(patch) {
      if (patch.id) {
        const { data, error } = await sb
          .from('jobflow_applications')
          .update({ ...patch, updated_at: nowIso() })
          .eq('id', patch.id)
          .eq('workspace_id', workspaceId)
          .select('*')
          .single();
        if (error) throw error;
        return mapApplication(data);
      }
      const { data, error } = await sb
        .from('jobflow_applications')
        .insert({ ...patch, workspace_id: workspaceId })
        .select('*')
        .single();
      if (error) throw error;
      return mapApplication(data);
    },

    async deleteApplication(id) {
      const { error } = await sb
        .from('jobflow_applications')
        .delete()
        .eq('id', id)
        .eq('workspace_id', workspaceId);
      if (error) throw error;
    },

    async exportAll() {
      const [profile, resumes, applications] = await Promise.all([
        sb.from('jobflow_profiles').select('*').eq('workspace_id', workspaceId),
        sb.from('jobflow_resumes').select('*').eq('workspace_id', workspaceId),
        sb.from('jobflow_applications').select('*').eq('workspace_id', workspaceId),
      ]);
      return {
        exported_at: nowIso(),
        workspace_id: workspaceId,
        profile: profile.data ?? [],
        resumes: resumes.data ?? [],
        applications: applications.data ?? [],
      };
    },

    async deleteEverything() {
      await sb.from('jobflow_applications').delete().eq('workspace_id', workspaceId);
      await sb.from('jobflow_resumes').delete().eq('workspace_id', workspaceId);
      await sb.from('jobflow_profiles').delete().eq('workspace_id', workspaceId);
    },

    async refreshJobs(force = false) {
      const { data, error } = await sb.functions.invoke('jobflow-ingest', { body: { force } });
      if (error) {
        return { ok: false, status: 'error', message: error.message ?? 'Ingest function failed' };
      }
      const payload = (data ?? {}) as {
        status?: string;
        inserted?: number;
        lastRun?: string;
        cooldownRemainingMs?: number;
        message?: string;
      };
      if (payload.status === 'cooldown') {
        return {
          ok: false,
          status: 'cooldown',
          message: payload.message ?? 'Just synced — try again in a few minutes.',
          lastRun: payload.lastRun ?? null,
        };
      }
      return {
        ok: true,
        status: payload.status === 'cached' ? 'cached' : 'synced',
        message: payload.message ?? `Synced ${payload.inserted ?? 0} new postings.`,
        lastRun: payload.lastRun ?? nowIso(),
        inserted: payload.inserted ?? 0,
      };
    },

    onNewJobs(handler) {
      const channel = sb
        .channel('jobflow-jobs-stream')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'jobflow_jobs' },
          (payload) => handler(payload.new as Job),
        )
        .subscribe();
      return () => {
        void sb.removeChannel(channel);
      };
    },

    async lastSynced() {
      const { data } = await sb
        .from('jobflow_ingest_runs')
        .select('finished_at')
        .not('finished_at', 'is', null)
        .order('finished_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data?.finished_at as string) ?? null;
    },
  };
}

/* ------------------------------------------------------------------ */
/* Local store — used only when the cloud is unavailable               */
/* ------------------------------------------------------------------ */

interface LocalState {
  profile: Profile | null;
  resumes: ResumeRow[];
  applications: ApplicationRow[];
}

const LOCAL_KEY = 'jobflow.local.v1';

function readLocal(): LocalState {
  if (typeof window === 'undefined') return { profile: null, resumes: [], applications: [] };
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return { profile: null, resumes: [], applications: [] };
    const parsed = JSON.parse(raw) as LocalState;
    return {
      profile: parsed.profile ?? null,
      resumes: parsed.resumes ?? [],
      applications: parsed.applications ?? [],
    };
  } catch {
    return { profile: null, resumes: [], applications: [] };
  }
}

function writeLocal(state: LocalState) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
}

/**
 * Private, browser-only mode. Same engine, same UI — the honest difference is
 * stated in the UI: nothing leaves this device and no live sync happens.
 */
export function createLocalStore(): Store {
  const state = readLocal();
  const persist = () => writeLocal(state);

  return {
    mode: 'local',
    workspaceId: 'local',

    // Postings are public data (RLS: anon may SELECT). Personal data is not.
    // So even without a session we can show live jobs and keep the profile local.
    async listJobs() {
      const rows = await fetchPublicJobs();
      return rows.length ? rows : DEMO_JOBS;
    },
    async getJob(id) {
      const sb = getSupabase();
      if (sb) {
        const { data } = await sb.from('jobflow_jobs').select('*').eq('id', id).maybeSingle();
        if (data) return data as Job;
      }
      return DEMO_JOBS.find((j) => j.id === id) ?? null;
    },
    async getProfile() {
      return state.profile;
    },
    async saveProfile(profile) {
      state.profile = { ...profile, updatedAt: nowIso() };
      persist();
    },
    async listResumes() {
      return [...state.resumes].sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    async getResume(id) {
      return state.resumes.find((r) => r.id === id) ?? null;
    },
    async createResume(input) {
      const row: ResumeRow = {
        id: uid(),
        job_id: input.job.id,
        job_title: input.job.title,
        company: input.job.company,
        apply_url: input.job.apply_url,
        model: input.model,
        match_score: input.coverage,
        matched_keywords: input.matched,
        missing_keywords: input.missing,
        profile_snapshot: input.profile,
        original_model: null,
        edited_by_user: false,
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      state.resumes.unshift(row);
      persist();
      return row;
    },
    async updateResumeModel(id, model) {
      const row = state.resumes.find((r) => r.id === id);
      if (row) {
        row.model = model;
        row.edited_by_user = true;
        row.updated_at = nowIso();
        persist();
      }
    },
    async listApplications() {
      return [...state.applications].sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    async saveApplication(patch) {
      if (patch.id) {
        const row = state.applications.find((a) => a.id === patch.id);
        if (row) {
          Object.assign(row, patch, { updated_at: nowIso() });
          persist();
          return row;
        }
      }
      const row: ApplicationRow = {
        id: uid(),
        job_id: patch.job_id ?? null,
        resume_id: patch.resume_id ?? null,
        job_title: patch.job_title ?? null,
        company: patch.company ?? null,
        apply_url: patch.apply_url ?? null,
        stage: (patch.stage as Stage) ?? 'saved',
        notes: patch.notes ?? null,
        applied_at: patch.applied_at ?? null,
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      state.applications.unshift(row);
      persist();
      return row;
    },
    async deleteApplication(id) {
      state.applications = state.applications.filter((a) => a.id !== id);
      persist();
    },
    async exportAll() {
      return { exported_at: nowIso(), workspace_id: 'local', ...state };
    },
    async deleteEverything() {
      state.profile = null;
      state.resumes = [];
      state.applications = [];
      persist();
    },
    async refreshJobs(force = false) {
      const sb = getSupabase();
      if (!sb) {
        return {
          ok: false,
          status: 'unavailable',
          message: 'No Supabase connection is configured, so these are bundled sample postings.',
        };
      }
      const { data, error } = await sb.functions.invoke('jobflow-ingest', { body: { force } });
      if (error) return { ok: false, status: 'error', message: error.message ?? 'Sync failed' };
      const payload = (data ?? {}) as { status?: string; inserted?: number; lastRun?: string; message?: string };
      if (payload.status === 'cooldown')  {
        return { ok: false, status: 'cooldown', message: payload.message ?? 'Just synced.', lastRun: payload.lastRun ?? null };
      }
      return {
        ok: true,
        status: payload.status === 'cached' ? 'cached' : 'synced',
        message: payload.message ?? `Synced ${payload.inserted ?? 0} new postings.`,
        lastRun: payload.lastRun ?? nowIso(),
        inserted: payload.inserted ?? 0,
      };
    },
    onNewJobs() {
      return () => {};
    },
    async lastSynced() {
      const sb = getSupabase();
      if (!sb) return null;
      const { data } = await sb
        .from('jobflow_ingest_runs')
        .select('finished_at')
        .not('finished_at', 'is', null)
        .order('finished_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data?.finished_at as string) ?? null;
    },
  };
}

/** Public postings: readable without a session, by design. */
async function fetchPublicJobs(): Promise<Job[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from('jobflow_jobs')
    .select(
      'id, title, company, location, geo_tier, level, job_type, salary, source, source_url, apply_url, posted_at, last_seen_at, years_min, tags',
    )
    .eq('is_active', true)
    .order('posted_at', { ascending: false, nullsFirst: false })
    .limit(300);
  if (error) return [];
  return (data ?? []) as Job[];
}
