/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        void: {
          DEFAULT: '#0B0E14',
          light: '#F7F7FB',
        },
        surface: {
          DEFAULT: '#131722',
          raised: '#1A1F2E',
          light: '#FFFFFF',
        },
        border: {
          DEFAULT: 'rgba(255,255,255,0.08)',
          light: 'rgba(15,17,25,0.08)',
        },
        ink: {
          DEFAULT: '#F5F6FA',
          muted: '#8B93A7',
          light: '#14161F',
          'light-muted': '#5B6072',
        },
        sync: {
          violet: '#6C5CE7',
          'violet-dim': '#4A3FB3',
          teal: '#00D9C0',
          'teal-dim': '#00A896',
          coral: '#FF6B6B',
        },
      },
      fontFamily: {
        display: ['"Cabinet Grotesk"', 'Inter', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      backdropBlur: {
        glass: '20px',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0, 0, 0, 0.28)',
        glow: '0 0 40px rgba(108, 92, 231, 0.35)',
      },
      keyframes: {
        pulseSync: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.15)', opacity: '0.7' },
        },
      },
      animation: {
        'pulse-sync': 'pulseSync 1.8s ease-in-out infinite',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
};