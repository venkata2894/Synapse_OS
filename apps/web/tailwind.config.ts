import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      colors: {
        canvas: {
          deep: "var(--bg-base)",
          base: "var(--bg-base)",
          surface: "var(--bg-surface)",
          raised: "var(--bg-raised)",
          inset: "var(--bg-inset)",
        },
        edge: {
          DEFAULT: "var(--edge)",
          bright: "var(--edge-bright)",
          muted: "var(--edge-muted)",
        },
        ink: {
          DEFAULT: "var(--ink)",
          secondary: "var(--ink-secondary)",
          tertiary: "var(--ink-tertiary)",
          ghost: "var(--ink-ghost)",
        },
        signal: {
          DEFAULT: "var(--signal)",
          dim: "var(--signal-dim)",
          glow: "var(--signal-glow)",
        },
        warn: { DEFAULT: "var(--warn)", dim: "var(--warn-dim)" },
        danger: { DEFAULT: "var(--danger)", dim: "var(--danger-dim)" },
        info: { DEFAULT: "var(--info)", dim: "var(--info-dim)" },
        accent: { DEFAULT: "var(--accent)", dim: "var(--accent-dim)" },
      },
      boxShadow: {
        glow: "0 0 16px var(--signal-glow)",
        "glow-warn": "0 0 16px rgba(251, 191, 36, 0.15)",
        "glow-danger": "0 0 16px rgba(248, 113, 113, 0.15)",
        depth: "0 4px 12px rgba(0, 0, 0, 0.20)",
        "depth-lg": "0 10px 25px rgba(0, 0, 0, 0.30)",
      },
      animation: {
        "fade-up": "fade-up 500ms ease-out both",
        "pulse-live": "pulse-live 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
