import { NextResponse, type NextRequest } from 'next/server';
import { FabricationError, assertEngineOutput, tailorResume } from '@/lib/tailor';
import type { Job, Profile } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The one place a tailored resume is produced.
 *
 * The engine is deterministic and stateless, so it could run in the browser — and
 * it does, as a fallback when this route is unreachable. But the *invariant* that
 * forbids invented facts is only as strong as the surface that enforces it, so the
 * canonical call goes through here: tailor → assert → return. A model that fails
 * the assertion never reaches a user, and a save later never re-runs it (a user
 * editing their own resume sets `edited_by_user` and takes ownership of the text).
 */

const MAX_BODY_BYTES = 256 * 1024;

/** Best-effort in-process throttle. Not a security boundary; a courtesy brake. */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 40;
const hits = new Map<string, { count: number; resetAt: number }>();

function throttled(key: string): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  if (hits.size > 5000) hits.clear();
  return entry.count > MAX_PER_WINDOW;
}

function looksLikeProfile(value: unknown): value is Profile {
  if (!value || typeof value !== 'object') return false;
  const p = value as Partial<Profile>;
  return (
    typeof p.name === 'string' &&
    typeof p.email === 'string' &&
    Array.isArray(p.experience) &&
    Array.isArray(p.projects) &&
    Array.isArray(p.skills)
  );
}

function looksLikeJob(value: unknown): value is Job {
  if (!value || typeof value !== 'object') return false;
  const j = value as Partial<Job>;
  return typeof j.id === 'string' && typeof j.title === 'string' && typeof j.company === 'string';
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'local';
  if (throttled(ip)) {
    return NextResponse.json({ error: 'Too many resumes at once — take a breath.' }, { status: 429 });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Profile is too large to tailor.' }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Expected JSON.' }, { status: 400 });
  }

  const { profile, job } = (body ?? {}) as { profile?: unknown; job?: unknown };
  if (!looksLikeProfile(profile) || !looksLikeJob(job)) {
    return NextResponse.json({ error: 'A profile and a posting are required.' }, { status: 400 });
  }

  try {
    const result = tailorResume(profile, job);
    // tailorResume already asserts; asserting again here is cheap and makes the
    // guarantee local to the route rather than inherited from the engine.
    assertEngineOutput(result.model, profile);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof FabricationError) {
      // A bug, not a user error: the engine tried to write something the profile
      // cannot support. Better a clear failure than a plausible lie.
      console.error('[tailor] invariant failed', error.message);
      return NextResponse.json(
        { error: 'This posting could not be tailored safely. Your profile is unchanged.' },
        { status: 422 },
      );
    }
    console.error('[tailor] failed', error);
    return NextResponse.json({ error: 'Tailoring failed. Try again.' }, { status: 500 });
  }
}
