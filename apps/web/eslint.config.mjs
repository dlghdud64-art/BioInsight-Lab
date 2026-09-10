/**
 * §lint-gate-restore (2026-09-10) — flat config 를 설치본에 맞춘다.
 *
 * 이전 판본은 `eslint/config` 의 defineConfig 와 `eslint-config-next/core-web-vitals`
 * 의 flat 배열 export 를 썼다. 둘 다 eslint 9 + eslint-config-next 15 의 API 인데
 * 설치본은 eslint 8.57.1 + eslint-config-next 14.2.15 라, config 로드 자체가
 * ERR_PACKAGE_PATH_NOT_EXPORTED 로 죽었다 → `npm run lint` 이 아무것도 잡지 못했다.
 *
 * eslint 9 승격은 eslint-config-next 15 를 끌고 오고 그건 next@14.2.35 와 충돌한다.
 * @eslint/eslintrc 는 eslint 8 의 직속 의존성이라 이미 설치돼 있어, FlatCompat 전환은
 * node_modules 무변경 · 이 파일 하나로 끝난다.
 */
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default [
  {
    ignores: [
      "**/node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "src/generated/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];
