import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/inter';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import './globals.css';
import { SessionProvider } from '@/components/session-provider';
import { AppShell } from '@/components/app-shell';

export const metadata: Metadata = {
  title: 'JobFlow — remote work, honestly scored',
  description:
    'Find remote roles open to Kenya, see exactly which terms you can back up, and tailor a resume that adds no facts you did not write.',
  applicationName: 'JobFlow',
};

export const viewport: Viewport = {
  themeColor: '#F6F2E8',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <SessionProvider>
          <AppShell>{children}</AppShell>
        </SessionProvider>
      </body>
    </html>
  );
}
