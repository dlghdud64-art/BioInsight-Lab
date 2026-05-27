/**
 * §11.314-d — Pretendard TTF → public/fonts 복사 (PDF 한글 폰트).
 *
 * 호영님 §11.308/§11.314 점검 발견:
 *   pdfkit 기반 PDF generator (lib/orders/po-pdf-generator +
 *   lib/quotes/quote-request-pdf-generator) 가
 *   `public/fonts/PretendardVariable.ttf` 를 registerFont 한다.
 *   해당 파일이 없으면 Helvetica fallback → PDF 한글 전부 깨짐.
 *
 *   pretendard@1.3.9 (dependency) 가 TTF 를 제공하므로
 *   (dist/public/static/alternative/Pretendard-Regular.ttf), 빌드 prebuild
 *   단계에서 public/fonts/PretendardVariable.ttf 로 복사한다.
 *
 *   graceful — 복사 실패해도 exit 0 (빌드 차단 0, PDF 한글만 fallback).
 *   pnpm/npm 둘 다 호환 (require.resolve 로 패키지 경로 탐색).
 */

const fs = require("fs");
const path = require("path");

try {
  const pkgJson = require.resolve("pretendard/package.json");
  const ttfSrc = path.join(
    path.dirname(pkgJson),
    "dist",
    "public",
    "static",
    "alternative",
    "Pretendard-Regular.ttf",
  );
  const destDir = path.join(process.cwd(), "public", "fonts");
  const dest = path.join(destDir, "PretendardVariable.ttf");

  if (!fs.existsSync(ttfSrc)) {
    console.warn("[font] pretendard TTF source 없음 — Helvetica fallback:", ttfSrc);
    process.exit(0);
  }
  if (fs.existsSync(dest)) {
    console.log("[font] public/fonts/PretendardVariable.ttf 이미 존재 — skip");
    process.exit(0);
  }
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(ttfSrc, dest);
  console.log("[font] Pretendard TTF → public/fonts/PretendardVariable.ttf 복사 완료 (PDF 한글)");
} catch (err) {
  console.warn(
    "[font] Pretendard 복사 실패 (graceful, Helvetica fallback):",
    err && err.message ? err.message : err,
  );
  process.exit(0);
}
