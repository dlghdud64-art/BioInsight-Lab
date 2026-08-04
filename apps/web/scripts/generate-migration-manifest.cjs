// apps/web/scripts/generate-migration-manifest.cjs
//
// §migration-order-drift-guard — repo prisma/migrations/ 폴더명 전수를
// src/generated/migration-manifest.json 으로 산출한다 (prebuild 체인).
//
// DB 무접촉 — 이 스크립트는 파일시스템만 읽는다. ADR-002 §11.13(빌드타임
// migrate 영구 금지)과 무저촉: migrate가 아니라 "repo 의도 스냅샷" 생성.
// serverless 번들에 prisma/migrations/ 폴더가 포함되지 않으므로, runtime
// drift probe가 repo 의도를 알려면 이 manifest가 필요하다.
//
// 계약: "migration.sql을 가진 디렉토리" 전수, 이름 오름차순.
// migration_lock.toml 등 파일·migration.sql 없는 디렉토리 제외.
// ⚠️ 14자리 타임스탬프 패턴으로 거르지 않는다 — 실제 repo에 `0_init`
// (비패턴, prod 적용 실재)이 존재. 패턴 필터는 0_init을 영구 unknown으로
// 만든다 (Phase 2 실측: 51 vs prod 52 불일치로 발견).
// generatedAt ISO 메타 포함 (stale 판별용).

"use strict";

const fs = require("node:fs");
const path = require("node:path");

/**
 * @param {string} migrationsDir prisma/migrations 절대 경로
 * @returns {{ migrations: string[], generatedAt: string }}
 */
function generateManifest(migrationsDir) {
  const entries = fs.readdirSync(migrationsDir, { withFileTypes: true });
  const migrations = entries
    .filter(
      (e) =>
        e.isDirectory() &&
        fs.existsSync(path.join(migrationsDir, e.name, "migration.sql")),
    )
    .map((e) => e.name)
    .sort();
  return {
    migrations,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { generateManifest };

if (require.main === module) {
  const webRoot = path.join(__dirname, "..");
  const migrationsDir = path.join(webRoot, "prisma", "migrations");
  const outDir = path.join(webRoot, "src", "generated");
  const outFile = path.join(outDir, "migration-manifest.json");

  const manifest = generateManifest(migrationsDir);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(manifest, null, 2) + "\n");
  console.log(
    `[prebuild] migration-manifest: ${manifest.migrations.length} migrations → ${path.relative(webRoot, outFile)}`,
  );
}
