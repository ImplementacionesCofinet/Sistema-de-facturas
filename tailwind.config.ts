import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cofinet: {
          50: '#f3f7f4',
          100: '#e0ebe3',
          200: '#c2d7c9',
          300: '#98bba6',
          400: '#6b9a7f',
          500: '#4b7d61',
          600: '#39644c',
          700: '#2e503e',
          800: '#274133',
          900: '#21362b',
        },
      },
    },
  },
  plugins: [],
};

export default config;
