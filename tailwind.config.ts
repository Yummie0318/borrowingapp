import type { Config } from "tailwindcss";

// Colors come from CSS variables (see globals.css) so light/dark mode and the accent color can switch live.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: v("ink"),
        paper: v("paper"),
        surface: v("surface"),
        line: v("line"),
        mint: v("mint"),
        forest: { DEFAULT: v("accent"), dark: v("accent-dark") },
        "accent-ink": v("accent-ink"),
        stamp: { DEFAULT: v("stamp"), bg: v("stamp-bg") },
        alert: { DEFAULT: v("alert"), bg: v("alert-bg") },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
