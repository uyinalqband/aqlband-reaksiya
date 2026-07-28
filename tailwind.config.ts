import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#060B12',
          900: '#0A111C',
          800: '#101B2A',
          700: '#17263A',
          600: '#263A52',
        },
        violet: {
          200: '#D8E5FF',
          300: '#AFC8FF',
          400: '#7EA7FF',
          500: '#527CFF',
          600: '#365BE5',
          700: '#2946B8',
        },
        gold: {
          300: '#FFE29A',
          400: '#F9C85B',
          500: '#F2AC32',
          600: '#D4861D',
          700: '#945713',
        },
        emerald: {
          300: '#83F5C5',
          400: '#43DDA4',
          500: '#18B77D',
          600: '#0E8E60',
        },
        signal: {
          idle: '#263A52',
          armed: '#F2AC32',
          go: '#43DDA4',
          early: '#FF6B78',
        },
        mist: {
          100: '#F8FBFF',
          200: '#E6EEF9',
          300: '#CBD7E6',
          400: '#AEBED1',
          500: '#8EA1B7',
          600: '#71859D',
          700: '#536980',
          800: '#34485E',
        },
      },
      fontFamily: {
        display: ['"Sora"', '"Space Grotesk"', 'system-ui', 'sans-serif'],
        body: ['"Manrope"', '"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        xl: '1.1rem',
        '2xl': '1.55rem',
        '3xl': '2rem',
      },
      boxShadow: {
        glow: '0 18px 60px -22px rgba(82, 124, 255, 0.65)',
        goldGlow: '0 18px 60px -24px rgba(242, 172, 50, 0.65)',
        card: '0 22px 55px -32px rgba(0, 0, 0, 0.92)',
        lift: '0 14px 32px -24px rgba(67, 221, 164, 0.45)',
      },
      keyframes: {
        pulseRing: {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '70%': { transform: 'scale(1.35)', opacity: '0' },
          '100%': { transform: 'scale(1.35)', opacity: '0' },
        },
        floatSlow: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-7px)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-120%)' },
          '100%': { transform: 'translateX(120%)' },
        },
      },
      animation: {
        pulseRing: 'pulseRing 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        floatSlow: 'floatSlow 4.6s ease-in-out infinite',
        shimmer: 'shimmer 2.2s linear infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
