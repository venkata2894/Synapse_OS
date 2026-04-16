import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"]
      },
      colors: {
        canvas: {
          deep: "#f8fafc",
          base: "#ffffff",
          surface: "#fcfcfc",
          elevated: "#ffffff",
          overlay: "#f1f5f9"
        },
        edge: {
          DEFAULT: "#e2e8f0",
          bright: "#cbd5e1",
          muted: "#f1f5f9"
        },
        ink: {
          DEFAULT: "#0f172a",
          secondary: "#475569",
          tertiary: "#94a3b8",
          ghost: "#cbd5e1"
        },
        signal: {
          DEFAULT: "#00b58e",
          dim: "rgba(0, 181, 142, 0.08)",
          glow: "rgba(0, 181, 142, 0.12)"
        },
        warn: {
          DEFAULT: "#e67e22",
          dim: "rgba(230, 126, 34, 0.08)"
        },
        danger: {
          DEFAULT: "#ef4444",
          dim: "rgba(239, 68, 68, 0.08)"
        },
        info: {
          DEFAULT: "#3b82f6",
          dim: "rgba(59, 130, 246, 0.08)"
        },
        ok: {
          DEFAULT: "#10b981",
          dim: "rgba(16, 185, 129, 0.08)"
        }
      },
      boxShadow: {
        glow: "0 0 15px rgba(0, 181, 142, 0.08)",
        "glow-warn": "0 0 15px rgba(230, 126, 34, 0.08)",
        "glow-danger": "0 0 15px rgba(239, 68, 68, 0.08)",
        depth: "0 4px 12px rgba(0, 0, 0, 0.05)",
        "depth-lg": "0 10px 25px rgba(0, 0, 0, 0.08)"
      },
      animation: {
        "fade-up": "fade-up 500ms ease-out both",
        "pulse-live": "pulse-live 2s ease-in-out infinite"
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "pulse-live": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" }
        }
      }
    }
  },
  plugins: []
};

export default config;
