/**
 * Shared domain types. The resume model is deliberately plain text: no HTML,
 * no rich-text marks. Structure lives in the model, not in markup.
 */

export type GeoTier = 'worldwide' | 'africa_eligible' | 'region_restricted' | 'blocked' | 'unknown';

export type Level = 'entry' | 'mid' | 'senior';

export interface Job {
  id: string;
  external_id?: string | null;
  title: string;
  company: string;
  location?: string | null;
  geo_tier: GeoTier;
  level: Level;
  job_type?: string | null;
  salary?: string | null;
  source: string;
  source_url?: string | null;
  apply_url: string;
  description?: string | null;
  posted_at?: string | null;
  last_seen_at?: string | null;
  years_min?: number | null;
  tags?: string[] | null;
}

export interface Bullet {
  id: string;
  text: string;
}

export interface ExperienceEntry {
  id: string;
  company: string;
  title: string;
  location?: string;
  start: string;
  end: string;
  bullets: Bullet[];
}

export interface ProjectEntry {
  id: string;
  name: string;
  description?: string;
  link?: string;
  bullets: Bullet[];
}

export interface EducationEntry {
  id: string;
  school: string;
  degree: string;
  field?: string;
  start: string;
  end: string;
  details?: string;
}

export interface ProfileLink {
  label: string;
  url: string;
}

export interface Profile {
  name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  links: ProfileLink[];
  summary?: string;
  skills: string[];
  experience: ExperienceEntry[];
  projects: ProjectEntry[];
  education: EducationEntry[];
  isStudent: boolean;
  updatedAt?: string;
}

export type SectionKey = 'summary' | 'experience' | 'projects' | 'education' | 'skills';

export interface ResumeBullet {
  sourceId: string;
  text: string;
  hidden?: boolean;
}

export interface ResumeExperience {
  company: string;
  title: string;
  location?: string;
  start: string;
  end: string;
  bullets: ResumeBullet[];
}

export interface ResumeProject {
  name: string;
  link?: string;
  bullets: ResumeBullet[];
}

export interface ResumeEducation {
  school: string;
  degree: string;
  field?: string;
  start: string;
  end: string;
  details?: string;
}

export interface ResumeModel {
  name: string;
  headline: string;
  contact: { email: string; phone: string; location: string };
  /** Full URLs, spelled out — ATS parsers and humans both want the literal string. */
  links: string[];
  summary: string;
  sections: SectionKey[];
  experience: ResumeExperience[];
  projects: ResumeProject[];
  education: ResumeEducation[];
  skills: string[];
}

export interface MatchResult {
  /** Every distinguishable term the engine found in the posting. */
  required: string[];
  matched: string[];
  missing: string[];
  /** null when the posting yields zero recognisable terms — never a misleading 0%. */
  coverage: number | null;
  titleKeywords: string[];
  yearsRequired: number | null;
}

export interface ResumeRow {
  id: string;
  job_id: string | null;
  job_title: string | null;
  company: string | null;
  apply_url: string | null;
  model: ResumeModel;
  match_score: number | null;
  matched_keywords: string[];
  missing_keywords: string[];
  profile_snapshot: Profile | null;
  /** Set by a DB trigger on the first edit: the untouched tailored model. */
  original_model?: ResumeModel | null;
  edited_by_user: boolean;
  created_at: string;
  updated_at: string;
}

export type Stage = 'saved' | 'applied' | 'screening' | 'interview' | 'offer' | 'rejected';

export interface ApplicationRow {
  id: string;
  job_id: string | null;
  resume_id: string | null;
  job_title: string | null;
  company: string | null;
  apply_url: string | null;
  stage: Stage;
  notes: string | null;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
}

export const STAGES: Stage[] = ['saved', 'applied', 'screening', 'interview', 'offer', 'rejected'];
