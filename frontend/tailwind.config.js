/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        /* Core navy used throughout the interface */
        navy: {
          950: '#071533',
          900: '#0B1F4B',
          850: '#0D2454',
          800: '#102A5C',
          700: '#16356F',
          600: '#1D4183',
          500: '#245098',
          400: '#3466B8',
        },
        brand: {
          50: '#EFF5FF',
          100: '#DBE8FE',
          200: '#BFD6FE',
          300: '#93BBFD',
          400: '#6096FA',
          500: '#3B73F6',
          600: '#1D57EB',
          700: '#1544D8',
          800: '#1839AF',
          900: '#1A358A',
        },
        /* The tricolour accents */
        saffron: {
          DEFAULT: '#FF9933',
          light: '#FFEDD5',
          dark: '#D97706',
        },
        india: {
          DEFAULT: '#138808',
          light: '#DCFCE7',
          dark: '#0D6005',
        },

        /* Verdict semantics */
        clear:  { DEFAULT: '#12854F', bg: '#E8F6EE', border: '#9FD9BB', dark: '#0B6B3F', ring: 'rgba(18, 133, 79, 0.2)' },
        reject: { DEFAULT: '#C62828', bg: '#FDEAEA', border: '#F2ACAC', dark: '#A31F1F', ring: 'rgba(198, 40, 40, 0.2)' },
        refer:  { DEFAULT: '#A96A00', bg: '#FDF3E0', border: '#EFCF95', dark: '#8A5600', ring: 'rgba(169, 106, 0, 0.2)' },

        ink: {
          DEFAULT: '#0F172A',
          soft: '#334155',
          muted: '#64748B',
          faint: '#94A3B8',
        },
        line: {
          DEFAULT: '#E2E8F0',
          strong: '#CBD5E1',
          subtle: '#F1F5F9',
        },
        canvas: {
          DEFAULT: '#F8FAFC',
          subtle: '#F1F5F9',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        deva: ['Noto Sans Devanagari', 'Noto Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'IBM Plex Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        'card-hover': '0 4px 12px 0 rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04)',
        panel: '0 10px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.05)',
        glow: '0 0 20px -3px rgba(29, 87, 235, 0.25)',
        'glow-clear': '0 0 20px -3px rgba(18, 133, 79, 0.25)',
        'glow-reject': '0 0 20px -3px rgba(198, 40, 40, 0.25)',
      },
      borderRadius: {
        card: '12px',
      },
    },
  },
  plugins: [],
}
