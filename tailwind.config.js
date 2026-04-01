/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#C84B31',
          50: '#FCF0ED',
          100: '#F5CBBF',
          200: '#ECA593',
          300: '#E07F66',
          400: '#D5643C',
          500: '#C84B31',
          600: '#A33B26',
          700: '#7D2D1C',
          800: '#581F13',
          900: '#32110A',
        },
        earth: {
          DEFAULT: '#8B5E3C',
          light: '#D4A574',
          dark: '#5C3E28',
        },
        savanna: {
          DEFAULT: '#F5E6D0',
          dark: '#E8C99A',
        },
        accent: {
          gold: '#D4AF37',
          green: '#2D6A4F',
        },
        surface: {
          DEFAULT: '#FAFAF8',
          card: '#FFFFFF',
        },
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
};
