/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      keyframes: {
        emoteRise: {
          '0%':   { opacity: '1', transform: 'translateY(0) scale(1)' },
          '80%':  { opacity: '0.8', transform: 'translateY(-120px) scale(1.2)' },
          '100%': { opacity: '0', transform: 'translateY(-160px) scale(0.9)' },
        },
      },
      animation: {
        'emote-rise': 'emoteRise 2.5s ease-out forwards',
      },
    },
  },
  plugins: [],
}
