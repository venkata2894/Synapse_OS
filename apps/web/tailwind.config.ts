import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#121314",
        mist: "#eef2f7",
        signal: "#0f9d8a",
        ember: "#f28f3b",
        danger: "#d9534f"
      }
    }
  },
  plugins: []
};

export default config;

