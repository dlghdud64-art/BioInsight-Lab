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
        // ── LabAxis Color System v1 ──
        // Brand Depth
        "brand-900": "var(--brand-900)",
        "brand-800": "var(--brand-800)",
        "brand-700": "var(--brand-700)",
        // Product Surface
        "product-900": "var(--product-900)",
        "product-800": "var(--product-800)",
        "product-700": "var(--product-700)",
        "product-600": "var(--product-600)",
        "product-500": "var(--product-500)",
        // Light Bridge
        "bridge-300": "var(--bridge-300)",
        "bridge-200": "var(--bridge-200)",
        "bridge-100": "var(--bridge-100)",
        // Action Blue
        "action-500": "var(--action-500)",
        "action-400": "var(--action-400)",
        "action-300": "var(--action-300)",

        // ── 전역 surface hierarchy (product dark, CSS vars 참조) ──
        sh: "var(--surface-shell)",       // shell — blue-charcoal base
        pg: "var(--surface-page)",        // page — work area
        pn: "var(--surface-panel)",       // panel — card/section
        el: "var(--surface-elevated)",    // elevated — input/search
        st: "var(--surface-strong)",      // strong — hover/active
        bd: "var(--border-default)",      // border default
        bs: "var(--border-strong)",       // border strong
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
        // ── Operational Motion Grammar ──
        "motion-fade-switch": {
          "0%": { opacity: "0.4", transform: "translateY(2px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "motion-soft-refresh": {
          "0%": { opacity: "0.6" },
          "50%": { opacity: "0.85" },
          "100%": { opacity: "1" },
        },
        "motion-optimistic": {
          "0%": { opacity: "0.5", transform: "scale(0.98)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "motion-rollback": {
          "0%": { opacity: "1", transform: "scale(1)" },
          "40%": { opacity: "0.3", transform: "scale(0.97)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "motion-toast-in": {
          "0%": { opacity: "0", transform: "translateY(8px) scale(0.96)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
      animation: {
        shake: "shake 0.5s ease-in-out infinite",
        marquee: "marquee 60s linear infinite",
        fadeIn: "fadeIn 0.5s ease-in-out forwards",
        "motion-fade-switch": "motion-fade-switch 120ms ease-out",
        "motion-soft-refresh": "motion-soft-refresh 180ms ease-out",
        "motion-optimistic": "motion-optimistic 120ms ease-out",
        "motion-rollback": "motion-rollback 300ms ease-out",
        "motion-toast-in": "motion-toast-in 200ms ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
