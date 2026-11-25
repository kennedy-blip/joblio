'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createCloudStore, createLocalStore, type Store } from '@/lib/store';
import { getSupabase, hasCloudConfig } from '@/lib/supabase-client';

type Mode = 'cloud' | 'local';

interface SessionValue {
  ready: boolean;
  mode: Mode;
  store: Store;
  workspaceId: string;
  notice: string | null;
  cloudError: string | null;
  retryCloud: () => Promise<void>;
  signOutLocal: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

const ANON_OFF_NOTICE =
  'Anonymous sign-in is switched off for this Supabase project, so your profile, resumes and applications stay in this browser. Job postings are still live from the five boards. Turn on Authentication → Providers → Anonymous to sync across devices.';

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>('local');
  const [store, setStore] = useState<Store>(() => createLocalStore());
  const [notice, setNotice] = useState<string | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);

  const boot = useCallback(async () => {
    setReady(false);
    setCloudError(null);

    if (!hasCloudConfig) {
      setStore(createLocalStore());
      setMode('local');
      setNotice(
        'No Supabase keys are configured, so JobFlow is running in local mode. Data stays in this browser and jobs are a bundled sample.',
      );
      setReady(true);
      return;
    }

    const sb = getSupabase();
    if (!sb) return;

    try {
      const { data, error } = await sb.auth.getSession();
      if (error) throw error;

      let session = data.session;
      if (!session) {
        const { data: signed, error: signInError } = await sb.auth.signInAnonymously();
        if (signInError) throw signInError;
        session = signed.session;
      }

      if (!session?.user) throw new Error('No session was created');

      setStore(createCloudStore(session.user.id));
      setMode('cloud');
      setNotice(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setCloudError(message);
      setStore(createLocalStore());
      setMode('local');
      setNotice(
        /anonymous/i.test(message) || /disabled/i.test(message) ? ANON_OFF_NOTICE : `Cloud unavailable: ${message}`,
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

  const signOutLocal = useCallback(async () => {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    setStore(createLocalStore());
    setMode('local');
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      ready,
      mode,
      store,
      workspaceId: store.workspaceId,
      notice,
      cloudError,
      retryCloud,
      signOutLocal,
    }),
    [ready, mode, store, notice, cloudError, retryCloud, signOutLocal],
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
