/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        stage: {
          DEFAULT: '#09090B',
          raised: '#16161A',
          overlay: '#1F1F24',
          light: '#F7F6F3',
          'light-raised': '#FFFFFF',
        },
        border: {
          DEFAULT: 'rgba(255,255,255,0.08)',
          strong: 'rgba(255,255,255,0.14)',
          light: 'rgba(15,17,25,0.08)',
        },
        paper: {
          DEFAULT: '#F5F5F2',
          muted: '#9A9AA2',
          light: '#141416',
          'light-muted': '#6B6B74',
        },
        ember: {
          DEFAULT: '#FF4D4D',
          hot: '#FF8A3D',
          dim: '#C93A3A',
        },
        pulse: {
          violet: '#7C3AED',
          pink: '#EC4899',
          orange: '#F97316',
        },
      },
      fontFamily: {
        display: ['"Clash Display"', '"Cabinet Grotesk"', 'Inter', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      backgroundImage: {
        'ember-gradient': 'linear-gradient(135deg, #FF4D4D 0%, #FF8A3D 100%)',
        'pulse-gradient': 'conic-gradient(from 180deg, #7C3AED, #EC4899, #F97316, #7C3AED)',
        'stage-fade': 'linear-gradient(180deg, rgba(9,9,11,0) 0%, #09090B 92%)',
      },
      boxShadow: {
        card: '0 12px 32px rgba(0, 0, 0, 0.45)',
        'card-hover': '0 20px 48px rgba(0, 0, 0, 0.6)',
        ember: '0 0 32px rgba(255, 77, 77, 0.35)',
      },
      keyframes: {
        spinSlow: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        riseIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'spin-slow': 'spinSlow 6s linear infinite',
        'rise-in': 'riseIn 0.5s ease both',
      },
      borderRadius: {
        xl2: '1.25rem',
        poster: '0.875rem',
      },
    },
  },
  plugins: [],
};