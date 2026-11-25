'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { createCloudStore, createLocalStore, type Store } from '@/lib/store';
import { getSupabase, hasCloudConfig } from '@/lib/supabase-client';
import { SEED_FLAG, SEED_PROFILE } from '@/lib/seed-profile';

type Mode = 'cloud' | 'local';

interface SessionValue {
  ready: boolean;
  mode: Mode;
  store: Store;
  workspaceId: string;
  notice: string | null;
  cloudError: string | null;
  /** True when the project has anonymous sign-in switched off. */
  anonymousOff: boolean;
  busy: boolean;
  retryCloud: () => Promise<void>;
  signInWithGitHub: () => Promise<void>;
  signOutLocal: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

const ANON_OFF_NOTICE =
  'Anonymous sign-in is switched off for this Supabase project, so your profile, resumes and applications stay in this browser. Job postings are still live from the five boards. Sign in with GitHub to keep them, or turn on Authentication → Providers → Anonymous.';

/** Supabase reports OAuth failures in the URL it redirects back to. */
function readAuthErrorFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  const description = hash.get('error_description') ?? url.searchParams.get('error_description');
  const code = hash.get('error') ?? url.searchParams.get('error');
  if (!description && !code) return null;
  const text = (description ?? code ?? '').replace(/\+/g, ' ');
  // The URL is a receipt, not state: don't let a stale error survive a reload.
  url.hash = '';
  url.searchParams.delete('error');
  url.searchParams.delete('error_code');
  url.searchParams.delete('error_description');
  window.history.replaceState({}, '', url.toString());
  return text;
}

const NO_CONFIG_NOTICE =
  'No Supabase keys are configured, so JobFlow is running in local mode. Data stays in this browser and postings come from the bundled snapshot.';

/**
 * Give a brand-new workspace a real starting point.
 *
 * One read, then at most one write: if a profile exists the flag is set and nothing
 * happens; if the flag is set (someone deliberately emptied the workspace) nothing
 * happens either. Seeding is a courtesy, so a failure here never blocks boot.
 */
async function seedIfEmpty(active: Store) {
  if (typeof window === 'undefined') return;
  const key = `${SEED_FLAG}:${active.workspaceId}`;
  try {
    const existing = await active.getProfile();
    if (existing) {
      window.localStorage.setItem(key, '1');
      return;
    }
    if (window.localStorage.getItem(key)) return;
    await active.saveProfile(SEED_PROFILE);
    window.localStorage.setItem(key, '1');
  } catch {
    // Offline, RLS refused, quota — none of it is worth blocking the app for.
  }
}

/**
 * Find a session, including one that is still being established by a GitHub
 * redirect (`?code=…`). The exchange happens inside supabase-js; we give it a
 * short window rather than reading a stale null and bouncing the user to local mode.
 */
async function resolveSession(sb: NonNullable<ReturnType<typeof getSupabase>>): Promise<Session | null> {
  const { data } = await sb.auth.getSession();
  if (data.session) return data.session;

  const returning =
    typeof window !== 'undefined' && /[?&#](code|access_token|refresh_token|error)=/.test(window.location.href);
  if (!returning) return null;

  return new Promise<Session | null>((resolve) => {
    let settled = false;
    let unsubscribe: (() => void) | null = null;
    const finish = (session: Session | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe?.();
      resolve(session);
    };
    const timer = setTimeout(() => finish(null), 4000);
    const { data: listener } = sb.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED')) {
        finish(session);
      }
    });
    unsubscribe = () => listener.subscription.unsubscribe();
    if (settled) unsubscribe();
  });
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>('local');
  const [store, setStore] = useState<Store>(() => createLocalStore());
  const [notice, setNotice] = useState<string | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [anonymousOff, setAnonymousOff] = useState(false);
  const [busy, setBusy] = useState(false);

  const boot = useCallback(async () => {
    setReady(false);
    setCloudError(null);
    setAnonymousOff(false);

    if (!hasCloudConfig) {
      const local = createLocalStore();
      await seedIfEmpty(local);
      setStore(local);
      setMode('local');
      setNotice(NO_CONFIG_NOTICE);
      setReady(true);
      return;
    }

    const sb = getSupabase();
    if (!sb) return;

    const authError = readAuthErrorFromUrl();

    try {
      let session = await resolveSession(sb);
      if (!session) {
        const { data: signed, error } = await sb.auth.signInAnonymously();
        if (error) throw error;
        session = signed.session;
      }

      if (!session?.user) throw new Error('No session was created');

      const cloud = createCloudStore(session.user.id);
      await seedIfEmpty(cloud);
      setStore(cloud);
      setMode('cloud');
      setNotice(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const anonDisabled = /anonymous/i.test(message) || /disabled/i.test(message);
      const local = createLocalStore();
      await seedIfEmpty(local);
      setCloudError(message);
      setAnonymousOff(anonDisabled);
      setStore(local);
      setMode('local');
      setNotice(
        authError
          ? `Sign-in did not complete: ${authError}. If this says the email is already registered, enable "Link accounts that use the same email" in Supabase Auth settings, or delete the older account.`
          : anonDisabled
            ? ANON_OFF_NOTICE
            : `Cloud unavailable: ${message}`,
      );
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void boot();
  }, [boot]);

  const retryCloud = useCallback(async () => {
    await boot();
  }, [boot]);

  const signInWithGitHub = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return;
    setBusy(true);
    try {
      const redirectTo =
        typeof window === 'undefined' ? undefined : `${window.location.origin}${window.location.pathname}`;
      const { error } = await sb.auth.signInWithOAuth({
        provider: 'github',
        options: redirectTo ? { redirectTo } : undefined,
      });
      if (error) setNotice(`GitHub sign-in did not start: ${error.message}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'GitHub sign-in failed');
    } finally {
      setBusy(false);
    }
  }, []);

  const signOutLocal = useCallback(async () => {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    const local = createLocalStore();
    setStore(local);
    setMode('local');
    setNotice(ANON_OFF_NOTICE);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      ready,
      mode,
      store,
      workspaceId: store.workspaceId,
      notice,
      cloudError,
      anonymousOff,
      busy,
      retryCloud,
      signInWithGitHub,
      signOutLocal,
    }),
    [ready, mode, store, notice, cloudError, anonymousOff, busy, retryCloud, signInWithGitHub, signOutLocal],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}

export function useStore(): Store {
  return useSession().store;
}
