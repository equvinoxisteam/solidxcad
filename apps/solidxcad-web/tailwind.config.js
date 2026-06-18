/** @type {import('tailwindcss').Config} */
const config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        base: '#f8fafc',
        sidebar: '#ffffff',
        panel: '#ffffff',
        elevated: '#f1f5f9',
        border: '#e2e8f0',
        accent: '#103A8E',
        'accent-hover': '#0c2d6e',
        brand: '#103A8E',
        'brand-hover': '#0c2d6e',
        'brand-light': '#103A8E',
        'brand-muted': '#103A8E',
        muted: '#64748b',
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
