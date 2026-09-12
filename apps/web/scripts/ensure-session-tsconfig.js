#!/usr/bin/env node
//
// §tsconfig-dist-glob P1 (2026-09-12) — 세션별 tsconfig 를 미리 만든다.
//
// 왜: tsconfig include 의 세션 dist 글롭 때문에 **다른 세션 dist 의 옛 라우트 타입**이
//   내 build·tsc 의 검사 대상에 들어온다. 라우트를 지우면 그 옛 타입이 지운 파일을 import 해
//   전 세션 build 가 깨진다(§placeholder-success-cleanup P1·P2·P3 에서 3회 실측).
//   또 Next 는 build 마다 자기 distDir 타입 경로 **문자열이 없으면** tsconfig 를 다시 쓴다
//   (next 14.2.35 writeConfigurationDefaults). 글롭이 덮어도 문자열 비교라 인정하지 않아
//   NEXT_DIST_DIR 을 쓰는 세션마다 추적 파일에 줄이 쌓인다.
//
// 처방: 세션은 자기 tsconfig 를 쓴다. 그 파일은 gitignore 산출물이라 Next 가 고쳐 써도
//   추적 파일이 흔들리지 않고, include 가 자기 dist 만 가리켜 남의 잔재를 안 본다.
//
// env 를 둘 다 안 주면 아무것도 하지 않는다 — 기존 동작 그대로다.
//
// 주석에 `*` 와 `/` 를 이어 쓰지 말 것 — 블록 주석이 닫혀 뒤가 코드로 해석된다(2026-09-12 실측).
const fs = require("node:fs");
const path = require("node:path");

const dist = process.env.NEXT_DIST_DIR;
const target = process.env.NEXT_TSCONFIG;

if (!dist || !target) {
  console.log("[session-tsconfig] NEXT_DIST_DIR / NEXT_TSCONFIG 미설정 · 생성 생략(기존 동작)");
  process.exit(0);
}
if (!/^tsconfig\.next-[\w.-]+\.json$/.test(target)) {
  console.error(`[session-tsconfig] NEXT_TSCONFIG 는 tsconfig.next-<트랙>.json 형태여야 한다: ${target}`);
  process.exit(1);
}

const file = path.join(__dirname, "..", target);
const body = {
  // 기준은 정본 tsconfig 하나다 · 여기서는 include 만 자기 dist 로 좁힌다.
  extends: "./tsconfig.json",
  include: ["src", `${dist}/types/**/*.ts`],
};
fs.writeFileSync(file, `${JSON.stringify(body, null, 2)}\n`, { encoding: "utf8" });
console.log(`[session-tsconfig] ${target} 준비 완료 · include: src, ${dist}/types 하위`);
