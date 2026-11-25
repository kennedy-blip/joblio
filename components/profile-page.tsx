'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Copy, Database, Download, Github, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import { useSession } from '@/components/session-provider';
import { ProfileForm, emptyProfile } from '@/components/profile-form';
import { ConfirmButton, Toast } from '@/components/ui-extra';
import { SAMPLE_PROFILE } from '@/lib/sample';
import type { Profile } from '@/lib/types';

export function ProfilePage() {
  const { store, ready, mode, workspaceId, notice, anonymousOff, signInWithGitHub, busy } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'neutral' | 'good' | 'warn' } | null>(null);

  useEffect(() => {
    if (!ready) return;
    void (async () => {
      const existing = await store.getProfile();
      setProfile(existing ?? emptyProfile());
    })();
  }, [ready, store]);

  async function save() {
    if (!profile) return;
    setSaving(true);
    try {
      await store.saveProfile(profile);
      setDirty(false);
      setSavedAt(Date.now());
      setToast({ message: 'Profile saved. Coverage scores now use these facts.', tone: 'good' });
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : 'Save failed', tone: 'warn' });
    } finally {
      setSaving(false);
    }
  }

  async function exportAll() {
    const data = await store.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jobflow-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setToast({ message: 'Export downloaded.', tone: 'good' });
  }

  async function deleteEverything() {
    await store.deleteEverything();
    setProfile(emptyProfile());
    setDirty(false);
    setToast({ message: 'Everything deleted: profile, resumes and applications.', tone: 'good' });
    router.push('/');
  }

  if (!profile) return <div className="py-20 text-center text-sm text-muted">Loading profile…</div>;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3 pt-2">
        <div>
          <p className="label mb-2 flex items-center gap-1.5">
            <UserRound className="h-3 w-3" /> Your raw material
          </p>
          <h1 className="text-[34px] leading-none">Profile</h1>
          <p className="mt-2 max-w-xl text-[12.5px] leading-relaxed text-muted">
            Every claim JobFlow can make about you comes from this page. Nothing here is inferred, and nothing is added
            when a resume is tailored.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedAt && !dirty ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Saved</span>
          ) : null}
          <button className="btn btn-xs" onClick={() => { setProfile({ ...SAMPLE_PROFILE }); setDirty(true); }}>
            Load sample
          </button>
          <button className="btn btn-primary btn-xs" onClick={() => void save()} disabled={saving || !dirty}>
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </header>

      {notice ? (
        <div className="rounded-xl2 border border-ochre/40 bg-ochreSoft/60 px-4 py-3 text-[12px] leading-relaxed text-[#6a4d0f]">
          {notice}
        </div>
      ) : null}

      <ProfileForm
        value={profile}
        onChange={(next) => {
          setProfile(next);
          setDirty(true);
        }}
      />

      <section className="card px-5 py-5">
        <h2 className="mb-1 flex items-center gap-2 text-xl">
          <ShieldCheck className="h-4 w-4 text-pine" /> Data &amp; privacy
        </h2>
        <p className="mb-4 max-w-2xl text-[12.5px] leading-relaxed text-muted">
          {mode === 'cloud'
            ? 'You are signed in — either anonymously (Supabase issues a real account with no email) or with GitHub. Row-level security makes these rows readable only by that account. Anonymous accounts are removed after 30 days of inactivity by this project\'s daily reaper; a GitHub sign-in is not.'
            : 'You are in local mode: profile, resumes and applications live in this browser only. Nothing has been sent to a server, and clearing site data deletes it. Sign in with GitHub to keep them on any device.'}
        </p>

        <dl className="mb-4 grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="label">Mode</dt>
            <dd className="mt-0.5 flex items-center gap-1.5 text-[13px]">
              <Database className="h-3.5 w-3.5 text-muted" />
              {mode === 'cloud' ? 'Synced workspace' : 'This browser only'}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="label">Workspace id</dt>
            <dd className="mt-0.5 flex items-center gap-2">
              <code className="truncate rounded border border-hairline bg-white/70 px-1.5 py-0.5 font-mono text-[11px]">
                {workspaceId}
              </code>
              <button
                className="btn btn-quiet btn-xs"
                onClick={() => {
                  void navigator.clipboard?.writeText(workspaceId);
                  setToast({ message: 'Workspace id copied.', tone: 'good' });
                }}
              >
                <Copy className="h-3 w-3" /> Copy
              </button>
            </dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2">
          {mode === 'local' && anonymousOff ? (
            <button className="btn btn-xs btn-primary" onClick={() => void signInWithGitHub()} disabled={busy}>
              <Github className="h-3.5 w-3.5" /> Continue with GitHub
            </button>
          ) : null}
          <button className="btn btn-xs" onClick={() => void exportAll()}>
            <Download className="h-3.5 w-3.5" /> Export everything (JSON)
          </button>
          <ConfirmButton
            label="Delete everything"
            confirmLabel="Yes, delete it all"
            onConfirm={() => void deleteEverything()}
            className="btn btn-xs border-signal/40 text-signal hover:border-signal hover:bg-signalSoft"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete everything
          </ConfirmButton>
        </div>
      </section>

      <section className="card-flat px-5 py-4 text-[12px] leading-relaxed text-muted">
        <p className="flex items-start gap-2">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pine" />
          <span>
            JobFlow does not store your CV as a file, does not upload it anywhere, and does not send it to a third-party
            parser. Paste-to-parse happens in your browser and the result is a plain JSON profile you can read and
            correct. See{' '}
            <Link href="/onboarding" className="link-underline text-ink">
              onboarding
            </Link>{' '}
            for the paste flow.
          </span>
        </p>
      </section>

      {toast ? <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} /> : null}
    </div>
  );
}
