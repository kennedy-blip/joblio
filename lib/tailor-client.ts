import { tailorResume, type TailorResult } from '@/lib/tailor';
import type { Job, Profile } from '@/lib/types';

/** A refusal from the server-side invariant — never swallowed by the fallback. */
export class TailorRefusedError extends Error {}

/**
 * Ask `/api/tailor` for a tailored resume.
 *
 * The route is the canonical surface (it asserts the no-fabrication invariant
 * before anything is returned). When the route is simply unreachable — a static
 * export, a preview without a server, a flaky network — we run the identical
 * engine locally, which asserts the same thing before returning. What we must
 * never do is treat a *refusal* as an outage and quietly produce a resume anyway.
 */
export async function requestTailor(profile: Profile, job: Job): Promise<TailorResult> {
  let reachable = false;
  try {
    const response = await fetch('/api/tailor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, job }),
    });
    reachable = true;
    if (response.ok) return (await response.json()) as TailorResult;

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    if (response.status === 400 || response.status === 413 || response.status === 422) {
      throw new TailorRefusedError(payload?.error ?? 'Could not tailor this posting.');
    }
  } catch (error) {
    if (error instanceof TailorRefusedError) throw error;
    // Network/parse failure: fall through to the local engine.
  }

  if (reachable) {
    // The server answered but not usefully (a 5xx). Local engine is still honest.
  }
  return tailorResume(profile, job);
}
