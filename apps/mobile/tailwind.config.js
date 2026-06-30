/** @type {import('tailwindcss').Config} */
// §labaxis-mobile-design-tokens (호영님 2026-06-30 핸드오프) — 모바일 목업 4종 공통 디자인 토큰.
//   출처: design_handoff README. RN/NativeWind theme.extend 로 매핑.
//   amber: `--amber #b45821`(muted brownish) — 호영님 2026-06-30 확정. §11.302 갱신됨
//      ("쨍한 yellow 금지, 주의색=muted #b45821"). 배포 게이트 해제. 의미=주의·만료임박.
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // 하위호환(기존 화면 사용) — accent 와 동일 계열.
        primary: {
          DEFAULT: "#2563eb",
          50: "#eff6ff",
          100: "#dbeafe",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
        },
        navy: { 900: "#0f172a", 800: "#1e293b" },
        accent: {
          DEFAULT: "#2563eb",
          strong: "#1d4ed8",
          weak: "#eff6ff",
          line: "#bfdbfe",
        },
        emerald: {
          DEFAULT: "#059669",
          weak: "#ecfdf5",
          line: "#a7f3d0",
          deep: "#047857",
        },
        // 주의·만료임박 톤(§11.302 확정). 위험=rose, 정상=emerald 와 구분.
        amber: {
          DEFAULT: "#b45821",
          weak: "#fdf3ec",
          line: "#f3d4bf",
        },
        rose: {
          DEFAULT: "#e11d48",
          weak: "#fff1f2",
          line: "#fecdd3",
          deep: "#be123c",
        },
        violet: {
          DEFAULT: "#7c3aed",
          weak: "#f5f3ff",
          line: "#ddd6fe",
        },
        ink: {
          DEFAULT: "#0f172a",
          2: "#475569",
          3: "#64748b",
          4: "#94a3b8",
        },
        surface: {
          bg: "#eef1f5",
          paper: "#ffffff",
          line: "#e2e8f0",
          "line-soft": "#f1f5f9",
          hover: "#f8fafc",
        },
      },
      borderRadius: {
        card: "18px",
        field: "13px",
        control: "9px",
      },
      fontFamily: {
        // Pretendard Variable 번들 후 expo-font 로드 필요(프로덕션). fallback 시스템 고딕.
        sans: ["Pretendard", "System"],
        mono: ["JetBrainsMono", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
