/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Dark navy palette
        navy: {
          950: '#050a1a',
          900: '#0a1229',
          850: '#0d1730',
          800: '#12203f',
          700: '#1b2c52',
          600: '#263c6b',
          500: '#38508a',
        },
        accent: {
          DEFAULT: '#38bdf8',
          soft: '#7dd3fc',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 10px 30px -12px rgba(2, 6, 23, 0.8)',
        glow: '0 0 0 1px rgba(56, 189, 248, 0.15), 0 8px 24px -12px rgba(56, 189, 248, 0.35)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.35s ease-out both',
        'pulse-dot': 'pulse-dot 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
