import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        base: '#1e1e1e',
        sidebar: '#252526',
        panel: '#2d2d2d',
        elevated: '#333333',
        border: '#3c3c3c',
        accent: '#103A8E',
        'accent-hover': '#1a4fb5',
        brand: '#103A8E',
        'brand-hover': '#0c2d6e',
        'brand-light': '#1a4fb5',
        'brand-muted': '#dbeafe',
        muted: '#858585',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Cascadia Code', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
