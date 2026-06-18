import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Deep diplomatic blues
        navy: {
          50: "#eef2fb",
          100: "#d6e0f5",
          200: "#adc1ea",
          300: "#7d9bda",
          400: "#4f74c4",
          500: "#2f55a8",
          600: "#1d4e89",
          700: "#13315c",
          800: "#0d2149",
          900: "#0a1733",
          950: "#060f24",
        },
        // Gold / brass accents
        gold: {
          50: "#fbf6e7",
          100: "#f6ecc8",
          200: "#eede9d",
          300: "#eed98a",
          400: "#e3c463",
          500: "#d4af37",
          600: "#b8901f",
          700: "#8f6f17",
        },
        // Silver / neutral accents
        silver: {
          300: "#d7dbe0",
          400: "#b9bfc7",
          500: "#9aa2ad",
        },
        cream: "#faf8f3",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        serif: ["var(--font-playfair)", "Georgia", "serif"],
      },
      boxShadow: {
        diplomat: "0 10px 40px -12px rgba(10, 23, 51, 0.35)",
      },
      backgroundImage: {
        "navy-radial":
          "radial-gradient(120% 120% at 50% 0%, #13315c 0%, #0a1733 45%, #060f24 100%)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
