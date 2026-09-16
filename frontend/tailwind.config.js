/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /* Core navy used throughout the interface. */
        navy: {
          900: '#0B1F4B',
          800: '#102A5C',
          700: '#16356F',
          600: '#1D4183',
          500: '#245098',
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
        /* The tricolour, used only as a rule or a seal accent — never as a fill
           behind text, where it would fail contrast in either theme. */
        saffron: '#FF9933',
        india: '#138808',

        /* Verdict semantics. Separate from the brand hue on purpose: an
           officer must never have to work out whether blue means anything. */
        clear:  { DEFAULT: '#12854F', bg: '#E8F6EE', border: '#9FD9BB', dark: '#0B6B3F' },
        reject: { DEFAULT: '#C62828', bg: '#FDEAEA', border: '#F2ACAC', dark: '#A31F1F' },
        refer:  { DEFAULT: '#A96A00', bg: '#FDF3E0', border: '#EFCF95', dark: '#8A5600' },

        ink: {
          DEFAULT: '#101623',
          soft: '#3D4756',
          muted: '#657286',
          faint: '#95A0B1',
        },
        line: { DEFAULT: '#E2E8F1', strong: '#CBD4E1' },
        canvas: '#F4F7FC',
      },
      fontFamily: {
        sans: ['Noto Sans', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        deva: ['Noto Sans Devanagari', 'Noto Sans', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 22, 35, 0.04), 0 1px 3px rgba(16, 22, 35, 0.06)',
        panel: '0 4px 16px rgba(16, 22, 35, 0.08)',
      },
      borderRadius: { card: '10px' },
    },
  },
  plugins: [],
}
