/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#161112',
        paper: '#f6f0e8',
        sand: '#e7d8c8',
        clay: '#b86d3c',
        moss: '#5b6b4d',
        mint: '#d7efe5',
        'mint-soft': '#edf8f3',
      },
      boxShadow: {
        panel: '0 20px 60px rgba(22, 17, 18, 0.08)',
        soft: '0 14px 34px rgba(34, 55, 45, 0.08)',
        'soft-inset': '0 8px 24px rgba(67, 96, 80, 0.08)',
      },
      fontFamily: {
        sans: ['Segoe UI', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
