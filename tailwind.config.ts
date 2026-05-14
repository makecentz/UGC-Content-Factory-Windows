import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pilot: {
          purple: "#6D00FF",
          ink: "#171321",
          muted: "#6B6475",
          line: "#E8E2F0",
          soft: "#F7F4FB"
        }
      },
      boxShadow: {
        soft: "0 14px 38px rgba(32, 18, 55, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
