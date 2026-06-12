/** @type {import('tailwindcss').Config} */
const config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        base: '#071428',
        sidebar: '#0a1628',
        panel: '#0f1f38',
        elevated: '#132a4a',
        border: '#1e3a5f',
        accent: '#103A8E',
        'accent-hover': '#1a4fb5',
        brand: '#103A8E',
        'brand-hover': '#0c2d6e',
        'brand-light': '#1a4fb5',
        'brand-muted': '#8fa8c8',
        muted: '#94a3b8',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Cascadia Code', 'monospace'],
      },
    },
  },
  plugins: [],
};

module.exports = config;
