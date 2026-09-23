import type { Config } from 'tailwindcss';

/**
 * Paleta corporativa de Cofinet.
 *
 * Los tonos 700/800/900 de cada familia y el crema son los colores de marca
 * tal cual. Los tonos claros (50-200) son tintes derivados de esos mismos
 * colores: hacen falta para fondos de avisos, chips y filas, y no venian en la
 * paleta original.
 *
 * Todas las combinaciones de texto sobre fondo que usa la interfaz se
 * comprobaron a 4.5:1 o mas (AA), porque es una herramienta de uso diario.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Verdes: identidad principal, acciones y estados aprobados.
        marca: {
          50: '#F1F7F5',
          100: '#E3F0ED',
          200: '#CFE3DF',
          300: '#A8CCC6',
          400: '#4E9E93',
          500: '#258278', // marca
          600: '#136558',
          700: '#0F4B42', // marca
          800: '#1D3B37', // marca
          900: '#2D3733', // marca
        },
        // Vinos: rechazos y alertas de decision.
        vino: {
          50: '#FBF0F4',
          100: '#F4DDE6',
          200: '#EBBACC',
          300: '#D48FAA',
          400: '#B85C80',
          500: '#932553', // marca
          600: '#7C1D47',
          700: '#671741', // marca
          800: '#46122F', // marca
          900: '#38232D', // marca
        },
        // Tierra: pendientes, avisos y acentos calidos.
        tierra: {
          50: '#FBF5EF',
          100: '#F3E3D2',
          200: '#EFDDC9', // marca
          300: '#CFA684',
          400: '#B37956', // marca
          500: '#9C4F2E',
          600: '#8D321D', // marca
          700: '#73271C',
          800: '#601E18', // marca
          900: '#4A1712',
        },
        // Neutros frios de la paleta, para textos y bordes.
        pizarra: {
          50: '#F7F2EC',
          100: '#EDE4DB',
          200: '#DFD3C7',
          300: '#B9BEBB',
          400: '#7F8E8A',
          500: '#4E5D59', // marca
          600: '#475F4F', // marca
          700: '#385457', // marca
          800: '#2D3733', // marca
          900: '#263849', // marca
        },
        crema: '#F0E7DF', // marca
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
