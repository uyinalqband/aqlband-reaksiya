import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // AqlBand brand system — dark purple / gold, shared across the AqlBand product family.
        ink: {
          950: '#0B0817', // deepest background
          900: '#120C24', // app background
          800: '#1A1430', // surface / cards
          700: '#241C42', // elevated surface
          600: '#332856', // borders / dividers
        },
        violet: {
          200: '#DDD6FE',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#6D28D9', // primary brand
          700: '#5B21B6',
        },
        gold: {
          300: '#F9D77E',
          400: '#F5C24C',
          500: '#F5B429', // accent brand
          600: '#D89A1B',
          700: '#9B6810',
        },
        signal: {
          idle: '#332856',
          armed: '#F5B429',
          go: '#34D8A3',
          early: '#FB5B5B',
        },
        mist: {
          100: '#F5F3FF',
          200: '#E4DFF2',
          300: '#C9C1E0',
          400: '#B4AACD',
          500: '#9C93B5',
          600: '#837A9B',
          700: '#6A6285',
          800: '#46405D',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        xl: '1.25rem',
        '2xl': '1.75rem',
        '3xl': '2.25rem',
      },
      boxShadow: {
        glow: '0 0 60px -12px rgba(139, 92, 246, 0.55)',
        goldGlow: '0 0 40px -8px rgba(245, 180, 41, 0.6)',
        card: '0 8px 30px -12px rgba(0, 0, 0, 0.5)',
      },
      keyframes: {
        pulseRing: {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '70%': { transform: 'scale(1.4)', opacity: '0' },
          '100%': { transform: 'scale(1.4)', opacity: '0' },
        },
        floatSlow: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        pulseRing: 'pulseRing 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        floatSlow: 'floatSlow 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
