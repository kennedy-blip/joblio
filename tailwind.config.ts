import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F6F2E8',
        card: '#FFFDF7',
        ink: '#151A1A',
        muted: '#6C6A60',
        hairline: '#E2DBCC',
        pine: '#14493B',
        pineSoft: '#E4EDE6',
        signal: '#B5432A',
        signalSoft: '#F6E3DC',
        sky: '#2C4A73',
        skySoft: '#E3E9F2',
        ochre: '#B98A2E',
        ochreSoft: '#F5EBD6',
      },
      fontFamily: {
        sans: ['InterVariable', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        serif: ['Instrument Serif', 'Iowan Old Style', 'Georgia', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: {
        xl2: '18px',
      },
      boxShadow: {
        lift: '0 1px 2px rgba(21,26,26,0.04), 0 12px 28px -18px rgba(21,26,26,0.35)',
        sheet: '0 1px 0 rgba(21,26,26,0.04), 0 24px 60px -32px rgba(21,26,26,0.45)',
      },
      keyframes: {
        rise: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fade: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
      },
      animation: {
        rise: 'rise 0.32s cubic-bezier(0.22, 1, 0.36, 1) both',
        fade: 'fade 0.4s ease both',
        pulseDot: 'pulseDot 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
