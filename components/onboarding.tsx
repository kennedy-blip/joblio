'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, ClipboardPaste, Sparkles, Wand2 } from 'lucide-react';
import { useSession } from '@/components/session-provider';
import { ProfileForm, emptyProfile } from '@/components/profile-form';
import { Toast } from '@/components/ui';
import { parseCv, parsedCvToProfile } from '@/lib/cv-parse';
import { SAMPLE_PROFILE, SAMPLE_CV_TEXT } from '@/lib/sample';
import type { Profile } from '@/lib/types';

const STEPS = ['Basics', 'Experience', 'Skills & review'] as const;

export function Onboarding() {
  const { store, ready } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile>(emptyProfile());
  const [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [cvText, setCvText] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'neutral' | 'good' | 'warn' } | null>(null);

  useEffect(() => {
    if (!ready) return;
    void (async () => {
      const existing = await store.getProfile();
      if (existing) setProfile(existing);
      setLoaded(true);
    })();
  }, [ready, store]);

  function readCv() {
    const parsed = parseCv(cvText);
    const mapped = parsedCvToProfile(parsed, { isStudent: profile.isStudent });
    setProfile((prev) => ({
      ...prev,
      ...mapped,
      name: mapped.name || prev.name,
      headline: prev.headline || '',
      isStudent: mapped.isStudent,
    }));
    setPasting(false);
    setToast({
      message: `Read ${parsed.counts.roles} roles, ${parsed.counts.bullets} bullets and ${parsed.counts.skills} skills. Check everything below — this is a guess, not a fact.`,
      tone: 'good',
    });
    setStep(1);
  }

  async function finish() {
    setSaving(true);
    try {
      await store.saveProfile({ ...profile, name: profile.name.trim() || 'Your name' });
      router.push('/');
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : 'Could not save', tone: 'warn' });
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <div className="py-20 text-center text-sm text-muted">Loading…</div>;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <header className="pt-2">
        <p className="label mb-2">Onboarding · step {step + 1} of 3</p>
        <h1 className="text-balance text-[32px] leading-[1.06] sm:text-[38px]">
          {step === 0 ? 'Start with the shortest path in.' : step === 1 ? 'What you actually did.' : 'Finish the facts.'}
        </h1>
        <div className="mt-4 flex items-center gap-2">
          {STEPS.map((label, index) => (
            <div key={label} className="flex flex-1 items-center gap-2">
              <div
                className={`h-1 flex-1 rounded-full ${index <= step ? 'bg-pine' : 'bg-hairline'}`}
                aria-hidden
              />
              <span className={`font-mono text-[10px] uppercase tracking-[0.12em] ${index <= step ? 'text-ink' : 'text-muted'}`}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </header>

      {step === 0 ? (
        <div className="flex flex-col gap-4">
          <section className="card px-5 py-5">
            <h2 className="text-xl">Three ways in</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <button
                className="rounded-xl border border-hairline bg-white/60 p-4 text-left transition-colors hover:border-pine/40 hover:bg-white"
                onClick={() => setPasting(true)}
              >
                <ClipboardPaste className="mb-2 h-4 w-4 text-pine" />
                <p className="text-[14px] font-medium">Paste your CV</p>
                <p className="mt-1 text-[12px] leading-relaxed text-muted">
                  Copy the text out of your PDF or Word file. We read roles, dates, bullets and skills into the form.
                </p>
              </button>
              <button
                className="rounded-xl border border-hairline bg-white/60 p-4 text-left transition-colors hover:border-pine/40 hover:bg-white"
                onClick={() => {
                  setProfile({ ...SAMPLE_PROFILE });
                  setToast({ message: 'Sample profile loaded. Edit anything — it is only a demo.', tone: 'good' });
                }}
              >
                <Sparkles className="mb-2 h-4 w-4 text-pine" />
                <p className="text-[14px] font-medium">Load a sample profile</p>
                <p className="mt-1 text-[12px] leading-relaxed text-muted">
                  A realistic Nairobi CS student with three roles and two projects. The whole loop works in seconds.
                </p>
              </button>
            </div>
            {pasting ? (
              <div className="mt-4">
                <textarea
                  className="textarea min-h-[180px] font-mono text-[12px]"
                  value={cvText}
                  onChange={(e) => setCvText(e.target.value)}
                  placeholder="Paste the whole CV here — headings, dates, bullets and all."
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button className="btn btn-xs btn-primary" onClick={readCv} disabled={cvText.trim().length < 20}>
                    <Wand2 className="h-3.5 w-3.5" /> Read it
                  </button>
                  <button className="btn btn-xs" onClick={() => setCvText(SAMPLE_CV_TEXT)}>
                    Use a sample CV
                  </button>
                  <button className="btn btn-xs btn-quiet" onClick={() => setPasting(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          <ProfileForm value={profile} onChange={setProfile} sections={['identity']} />
        </div>
      ) : null}

      {step === 1 ? (
        <ProfileForm value={profile} onChange={setProfile} sections={['studies', 'experience', 'projects']} />
      ) : null}

      {step === 2 ? (
        <div className="flex flex-col gap-4">
          <ProfileForm value={profile} onChange={setProfile} sections={['education', 'skills']} />
          <section className="card px-5 py-4">
            <h2 className="label mb-2">Before you finish</h2>
            <ul className="space-y-1.5 text-[12.5px] text-muted">
              <li className="flex items-start gap-1.5">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pine" />
                {profile.experience.length} roles, {profile.experience.reduce((n, r) => n + r.bullets.length, 0)} bullets,{' '}
                {profile.projects.length} projects, {profile.education.length} education entries, {profile.skills.length} skills.
              </li>
              <li className="flex items-start gap-1.5">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pine" />
                Numbers in bullets do the heavy lifting. Add one where you can.
              </li>
              <li className="flex items-start gap-1.5">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pine" />
                Everything here is the only raw material the tailor can use. Nothing is invented later.
              </li>
            </ul>
          </section>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 pb-6">
        <button className="btn btn-xs" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <div className="flex gap-2">
          <button className="btn btn-xs btn-quiet" onClick={() => void finish()} disabled={saving}>
            Save and exit
          </button>
          {step < 2 ? (
            <button className="btn btn-primary btn-xs" onClick={() => setStep((s) => s + 1)} disabled={!profile.name.trim()}>
              Continue <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button className="btn btn-primary btn-xs" onClick={() => void finish()} disabled={saving}>
              {saving ? 'Saving…' : 'Finish'} <Check className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {toast ? <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} /> : null}
    </div>
  );
}
