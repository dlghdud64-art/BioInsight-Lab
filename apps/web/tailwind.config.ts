import type { Config } from "tailwindcss";

// Tailwind 설정 - 중복 정의 제거
const config: Config = {
  darkMode: ["class"],
  safelist: [
    "bg-sh", "bg-pg", "bg-pn", "bg-el", "bg-st",
    "border-bd", "border-bs",
    "text-sh", "text-pg", "text-pn",
    "hover:bg-el", "hover:bg-st", "hover:bg-pn",
    "divide-bd",
    { pattern: /bg-(sh|pg|pn|el|st)\/\d+/ },
  ],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Pretendard", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Noto Sans KR", "Helvetica Neue", "sans-serif"],
      },
      colors: {
        // ── 전역 surface hierarchy (dark-only, 직접 hex) ──
        sh: "#242628",       // shell — neutral graphite (~15%)
        pg: "#2b2d30",       // page — work area (~17%)
        pn: "#333538",       // panel — card/section (~20%)
        el: "#3c3e42",       // elevated — input/search/empty (~24%)
        st: "#46484c",       // strong — hover/active surface (~28%)
        bd: "#46484c",       // border default
        bs: "#535559",       // border strong (~33%)
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "10%, 30%, 50%, 70%, 90%": { transform: "translateX(-4px)" },
          "20%, 40%, 60%, 80%": { transform: "translateX(4px)" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        shake: "shake 0.5s ease-in-out infinite",
        marquee: "marquee 60s linear infinite",
        fadeIn: "fadeIn 0.5s ease-in-out forwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
