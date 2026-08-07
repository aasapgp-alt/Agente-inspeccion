/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/campo/**/*.{js,ts,jsx,tsx,mdx}',
    './components/campo/**/*.{js,ts,jsx,tsx,mdx}',
    './hooks/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  corePlugins: {
    preflight: false
  },
  theme: {
    extend: {}
  },
  plugins: []
};
