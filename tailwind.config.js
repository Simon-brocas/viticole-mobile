export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Inter', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        forest: {
          50:  '#f0faf4',
          100: '#d9f2e4',
          200: '#b3e4ca',
          300: '#7dcfa9',
          400: '#44b483',
          500: '#2f855a',
          600: '#276749',
          700: '#1e5038',
          800: '#183d2c',
          900: '#102d20',
        }
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'card-hover': '0 4px 12px 0 rgb(0 0 0 / 0.10), 0 2px 4px -1px rgb(0 0 0 / 0.06)',
        'btn': '0 1px 3px 0 rgb(47 133 90 / 0.3)',
        'modal': '0 20px 60px -10px rgb(0 0 0 / 0.4)',
      }
    }
  },
  plugins: []
}
