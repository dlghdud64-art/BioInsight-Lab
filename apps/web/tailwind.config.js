/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* ══ 1. Public Role Tokens ══════════════════════════════════ */
        "public-brand-field-strong": "var(--public-brand-field-strong)",
        "public-brand-field-soft": "var(--public-brand-field-soft)",
        "public-support-plane-1": "var(--public-support-plane-1)",
        "public-support-plane-2": "var(--public-support-plane-2)",
        "public-surface-card-1": "var(--public-surface-card-1)",
        "public-surface-card-2": "var(--public-surface-card-2)",
        "public-close-layer": "var(--public-close-layer)",
        "public-primary-action": "var(--public-primary-action)",
        "public-primary-action-hover": "var(--public-primary-action-hover)",
        "public-text-strong": "var(--public-text-strong)",
        "public-text-body": "var(--public-text-body)",
        "public-text-muted": "var(--public-text-muted)",
        "public-border-soft": "var(--public-border-soft)",
        "public-border-strong": "var(--public-border-strong)",
        "public-network-line": "var(--public-network-line)",
        "public-hero-haze": "var(--public-hero-haze)",

        /* ══ 2. App Surface Tokens ═════════════════════════════════ */
        "app-bg": "var(--app-bg)",
        "app-panel-1": "var(--app-panel-1)",
        "app-panel-2": "var(--app-panel-2)",
        "app-panel-3": "var(--app-panel-3)",
        "app-rail-bg": "var(--app-rail-bg)",
        "app-dock-bg": "var(--app-dock-bg)",
        "app-workbench-bg": "var(--app-workbench-bg)",
        "app-table-row": "var(--app-table-row)",
        "app-table-row-hover": "var(--app-table-row-hover)",
        "app-table-row-active": "var(--app-table-row-active)",
        "app-focus-ring": "var(--app-focus-ring)",
        "app-divider": "var(--app-divider)",

        /* ══ 3. Semantic Tokens ════════════════════════════════════ */
        "status-success": "var(--status-success)",
        "status-warning": "var(--status-warning)",
        "status-danger": "var(--status-danger)",
        "status-info": "var(--status-info)",

        /* ══ shadcn/ui Library Compat ═════════════════════════════
           ⚠ 아래 토큰은 shadcn/ui 컴포넌트 내부 전용.
             직접 bg-primary / text-secondary로 호출 금지.
             Public → public-*, App → app-*, 상태 → status-* 만 사용.
           ═══════════════════════════════════════════════════════ */
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
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};
