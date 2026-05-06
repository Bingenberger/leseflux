/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#3674B5',
        success: '#578E7E',
        background: '#FBF8EF',
        warning: '#E97A0C',
      },
      fontFamily: {
        sans: ['"Atkinson Hyperlegible"', 'system-ui', 'sans-serif'],
        dyslexic: ['"OpenDyslexic"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        reader: ['1.5rem', { lineHeight: '2.2rem' }],
        'reader-lg': ['1.75rem', { lineHeight: '2.5rem' }],
        'reader-xl': ['2rem', { lineHeight: '2.8rem' }],
      },
    },
  },
  plugins: [],
}
