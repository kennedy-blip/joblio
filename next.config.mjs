/** @type {import('next').NextConfig} */

// JobFlow talks to Supabase directly from the browser (anon key + RLS), so the
// CSP must allow the Supabase origins. No third-party scripts, no inline HTML
// injection, no eval in production.
const supabaseOrigin = 'https://*.supabase.co';
const supabaseWs = 'wss://*.supabase.co';

const csp = [
  "default-src 'self'",
  // Next.js injects inline bootstrap scripts; dev mode needs eval for HMR.
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseWs}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https:",
].join('; ');

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
