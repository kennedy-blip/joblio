'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Briefcase, Compass, UserRound, Database, CloudOff } from 'lucide-react';
import { useSession } from '@/components/session-provider';

const NAV = [
  { href: '/', label: 'Discover', icon: Compass },
  { href: '/applications', label: 'Applications', icon: Briefcase },
  { href: '/profile', label: 'Profile', icon: UserRound },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { mode, ready } = useSession();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' || pathname.startsWith('/job') : pathname.startsWith(href);

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <header className="no-print sticky top-0 z-40 border-b border-hairline bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" className="group flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-ink/15 bg-ink text-[13px] font-semibold text-paper">
              J
            </span>
            <span className="font-serif text-[22px] leading-none tracking-tight">JobFlow</span>
          </Link>

          <nav className="hidden items-center gap-1 sm:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                data-active={isActive(item.href)}
                className="rounded-full px-3 py-1.5 text-[13px] text-muted transition-colors hover:bg-black/[0.04] hover:text-ink data-[active=true]:bg-ink data-[active=true]:text-paper data-[active=true]:hover:bg-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {ready ? (
              mode === 'cloud' ? (
                <span className="hidden items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted sm:inline-flex">
                  <Database className="h-3 w-3" aria-hidden />
                  Synced workspace
                </span>
              ) : (
                <span className="hidden items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[#7a5a12] sm:inline-flex">
                  <CloudOff className="h-3 w-3" aria-hidden />
                  Local profile
                </span>
              )
            ) : null}
            <Link href="/onboarding" className="btn btn-xs sm:hidden">
              Start
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-6 sm:pb-16">{children}</main>

      <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-paper/95 backdrop-blur-md sm:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-between px-2 py-1.5">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-[10px] font-medium uppercase tracking-[0.1em] transition-colors ${
                  active ? 'text-ink' : 'text-muted'
                }`}
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <footer className="no-print border-t border-hairline/70 px-4 py-6 sm:px-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 text-[11px] text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            JobFlow never invents a bullet, a skill, a date or a degree. Every claim on a tailored resume
            comes from something you typed.
          </p>
          <p className="font-mono uppercase tracking-[0.12em]">
            Sources credited in-app · apply on the original posting
          </p>
        </div>
      </footer>
    </div>
  );
}
