/** @type {import('tailwindcss').Config} */
const config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ocean: {
          50: '#ecfbff',
          100: '#cff4ff',
          200: '#a4e9ff',
          300: '#6dd8ff',
          400: '#34c4f5',
          500: '#12a8df',
          600: '#0885c0',
          700: '#0a6a9c',
          800: '#0d577e',
          900: '#114867',
          950: '#052e44',
        },
        reef: {
          50: '#e6fffe',
          100: '#c2fdfb',
          200: '#88f8f5',
          300: '#4debe8',
          400: '#1cd6d3',
          500: '#08b8b6',
          600: '#069997',
          700: '#087a79',
          800: '#0a6161',
          900: '#0c5050',
          950: '#04302f',
        },
        sand: {
          50: '#fbf7ef',
          100: '#f4ebd6',
          200: '#e9d4ad',
          300: '#dcb87e',
          400: '#d09d57',
          500: '#c7883f',
          600: '#a96c33',
          700: '#88512b',
          800: '#6f4228',
          900: '#5c3926',
          950: '#341d12',
        },
        clay: {
          50: '#fdf5f1',
          100: '#fbe9df',
          200: '#f6cfbb',
          300: '#eeac8c',
          400: '#e2825e',
          500: '#d5633f',
          600: '#bf4d2f',
          700: '#9f3c27',
          800: '#843327',
          900: '#6e2d25',
          950: '#3b1510',
        },
      },
      fontFamily: {
        display: ['"Sora"', 'system-ui', 'sans-serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        tightest: '-0.04em',
      },
      animation: {
        'fade-in': 'fadeIn 0.8s ease-out forwards',
        'fade-up': 'fadeUp 0.8s ease-out forwards',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 2.5s linear infinite',
        'aurora': 'aurora 18s ease-in-out infinite',
        'aurora-slow': 'aurora 25s ease-in-out infinite',
        'pulse-slow': 'pulseSlow 4s ease-in-out infinite',
        'gradient-pan': 'gradientPan 8s ease infinite',
        'marquee': 'marquee 30s linear infinite',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
        'spin-slow': 'spin 20s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        aurora: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '25%': { transform: 'translate(40px, -30px) scale(1.1)' },
          '50%': { transform: 'translate(-20px, 20px) scale(0.95)' },
          '75%': { transform: 'translate(30px, 15px) scale(1.05)' },
        },
        pulseSlow: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.7' },
        },
        gradientPan: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 20px 0 rgba(18, 168, 223, 0.3)' },
          '50%': { boxShadow: '0 0 40px 4px rgba(18, 168, 223, 0.5)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
