/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./dashboard/index.html', './dashboard/src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        page: '#F2F2F2',
        panel: '#FFFFFF',
        primary: '#22C55E',
        danger: '#EF4444',
        warning: '#F97316',
        textPrimary: '#111111',
        textSecondary: '#6B7280',
        borderColor: '#E5E7EB',
        sidebarActive: '#F3F4F6',
      },
      boxShadow: {
        card: '0 10px 30px rgba(17, 17, 17, 0.06)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
