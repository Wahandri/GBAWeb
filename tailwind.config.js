/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./lib/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          500: "#6b8afe",
          600: "#4c6cf3",
        },
      },
      boxShadow: {
        glow: "0 0 50px -20px rgba(79, 126, 255, 0.6)",
      },
    },
  },
  plugins: [],
};
