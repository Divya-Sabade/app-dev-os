import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter Display', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        brand: {
          900: '#082A5E',
          800: '#0A367B',
          700: '#0D469E',
          600: '#0044AE',
          500: '#115ACB',
          400: '#89B7FF',
          300: '#6196EA',
          200: '#92B7F0',
          100: '#B6CFF5',
          50:  '#E7EFFC',
        },
        grey: {
          900: '#070A0E',
          800: '#151719',
          700: '#25272B',
          600: '#2C2F32',
          500: '#4A4C4F',
          400: '#5E6062',
          300: '#8F9193',
          200: '#C1C2C3',
          100: '#DADADB',
          50:  '#F0F0F1',
          25:  '#FAFAFA',
        },
        success: {
          500: '#13A10E',
          200: '#92D490',
          100: '#B6E2B4',
          50:  '#E7F6E7',
          700: '#0D720A',
        },
        error: {
          500: '#D13438',
          200: '#EAA2A3',
          100: '#F1C0C1',
          50:  '#FAEBEB',
          700: '#942528',
        },
        warning: {
          500: '#FFAA33',
          200: '#FFE3BD',
          100: '#FFF2E0',
          50:  '#FFF9F0',
          800: '#B36800',
        },
        accent: {
          500: '#7F00FF',
          50:  '#F7F0FF',
        },
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '6px',
        lg: '8px',
        xl: '12px',
      },
    },
  },
  plugins: [],
}

export default config
