/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        crt: {
          bg: '#080404',
          surface: '#0e0808',
          'surface-2': '#140c0c',
          border: '#2a1212',
          'border-bright': '#dc2626',
          text: '#f0e0e0',
          dim: '#cc6666',
          accent: '#ef4444',
          'accent-bright': '#ff3333',
          'accent-glow': '#ff4444',
          'accent-dark': '#dc2626',
          link: '#ff4444',
          'link-hover': '#ff6666',
          green: '#34d399',
          orange: '#fbbf24',
        },
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
        brand: ['"Press Start 2P"', 'monospace'],
        mono: ['"SF Mono"', '"Fira Code"', 'Consolas', 'monospace'],
      },
      animation: {
        'blink-cursor': 'blink-cursor 1s step-end infinite',
        'card-in': 'card-in 0.15s forwards',
        shimmer: 'shimmer 1.5s ease-in-out infinite',
        appear: 'appear 0.08s forwards',
      },
      keyframes: {
        'blink-cursor': {
          '50%': { opacity: '0' },
        },
        'card-in': {
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
        appear: {
          to: { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
