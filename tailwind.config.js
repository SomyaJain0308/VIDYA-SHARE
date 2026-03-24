/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Manrope"', 'sans-serif'],
        display: ['"Space Grotesk"', 'sans-serif'],
      },
      boxShadow: {
        glass: '0 22px 70px -24px rgba(8, 19, 41, 0.45)',
        float: '0 26px 60px -28px rgba(7, 18, 40, 0.6)',
      },
      animation: {
        'slide-up': 'slide-up 0.3s ease-out',
        glow: 'glow 3s ease-in-out infinite alternate',
        floaty: 'floaty 6s ease-in-out infinite',
      },
      keyframes: {
        'slide-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 0 rgba(77, 199, 255, 0)' },
          '100%': { boxShadow: '0 0 30px rgba(77, 199, 255, 0.38)' },
        },
        floaty: {
          '0%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
          '100%': { transform: 'translateY(0px)' },
        },
      }
    },
  },
  plugins: [],
}
