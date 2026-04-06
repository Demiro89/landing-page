/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        syne: ['Syne', 'sans-serif'],
        sans: ['DM Sans', 'sans-serif'],
      },
      colors: {
        bg: '#0a0a0f',
        card: '#12121a',
        border: '#1e1e2e',
        border2: '#2a2a3a',
        yt: '#ff3b3b',
        dis: '#7c3aed',
        green: '#00ffaa',
        muted: '#8888aa',
      },
      animation: {
        blink: 'blink 1.8s ease-in-out infinite',
        glow: 'glow 2.5s ease-in-out infinite',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.3', transform: 'scale(1.5)' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 25px rgba(124,58,237,0.5), 0 0 50px rgba(37,99,235,0.2)' },
          '50%': { boxShadow: '0 0 45px rgba(124,58,237,0.75), 0 0 80px rgba(37,99,235,0.4)' },
        },
      },
    },
  },
  plugins: [],
};
