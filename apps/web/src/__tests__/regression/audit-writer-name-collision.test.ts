/**
 * §audit-writer-name-collision (호영님 2026-09-10) —
 * **감사 테이블에 쓰는 헬퍼는 이름으로 구분된다. 동명이인을 두지 않는다.**
 *
 * ── 결함 (Q1 §activity-source-of-truth 실측) ──
 * ```
 * createAuditLog@lib/audit/audit-logger  →  AuditLog        호출처 18
 * createAuditLog@lib/audit               →  DataAuditLog    호출처 15
 * ```
 * 이름이 같고 **쓰는 테이블이 다르다.** import 경로로만 갈린다.
 * 2026-09-07 "초대 수락 감사 0" 오보의 뿌리가 정확히 여기였다 —
 * `db.dataAuditLog.create` 로만 찾아 헬퍼 경유를 놓쳤고, 헬퍼 이름으로 다시 찾아도
 * 33곳이 뭉개져 어느 테이블에 쓰는지 알 수 없었다.
 *
 * 처방은 조항이 아니라 **개명**이다(호영님: "조항으로 막는 것보다 이름을 가르는 쪽이 싸다").
 *   `@/lib/audit`         → `createDataAuditLog` / `DataAuditLogParams`  (DataAuditLog)
 *   `@/lib/audit/audit-logger` → `createAuditLog` / `AuditLogParams`     (AuditLog)
 * 이름이 테이블과 맞는다.
 *
 * ── 이 파일이 **안 보는 것** (조항 11) ──
 *   1. 다른 종류의 동명이인 — 감사 쓰기 헬퍼 축만 본다.
 *   2. 런타임 — 정적 export/import 문만 본다. 동적 import 는 안 잡힌다(현재 0건).
 *   3. "감사가 실제로 남는가" — 그건 배선 축이고 `regression/audit-durability.test.ts` 소관이다.
 *      이 파일의 GREEN 은 "이름이 안 겹친다" 이지 "기록된다" 가 아니다.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const SEP = String.fromCharCode(92);
const read = (rel: string) => stripComments(readFileSync(join(WEB_ROOT, rel), "utf8"));

/** 감사 테이블에 쓰는 모듈과 그 모듈이 소유해야 할 이름. */
const WRITERS = [
  {
    module: "src/lib/audit.ts",
    table: "dataAuditLog",
    exports: ["createDataAuditLog", "DataAuditLogParams"],
    forbidden: ["createAuditLog", "AuditLogParams"],
  },
  {
    module: "src/lib/audit/audit-logger.ts",
    table: "auditLog",
    exports: ["createAuditLog", "AuditLogParams"],
    forbidden: ["createDataAuditLog", "DataAuditLogParams"],
  },
];

function sourceFiles(): string[] {
  const out: string[] = [];
  (function walk(dir: string) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === "__tests__") continue;
        walk(p);
      } else if (/\.tsx?$/.test(e.name)) out.push(p);
    }
  })(join(WEB_ROOT, "src"));
  return out;
}

describe("§audit-writer-name-collision — 감사 쓰기 헬퍼는 이름이 테이블과 맞는다", () => {
  it("각 모듈이 자기 이름을 export 하고, 남의 이름은 export 하지 않는다", () => {
    for (const w of WRITERS) {
      const code = read(w.module);
      for (const name of w.exports) {
        expect(
          new RegExp(`export\\s+(?:async\\s+function|function|interface|const|type)\\s+${name}\\b`).test(code),
          `${w.module} 이 ${name} 을 export 하지 않는다`,
        ).toBe(true);
      }
      for (const name of w.forbidden) {
        expect(
          new RegExp(`export\\s+(?:async\\s+function|function|interface|const|type)\\s+${name}\\b`).test(code),
          `${w.module} 이 남의 이름 ${name} 을 export 한다 — 동명이인 재발`,
        ).toBe(false);
      }
    }
  });

  it("🔑 각 모듈이 **자기 테이블에만** 쓴다 (이름과 대상이 어긋나지 않게)", () => {
    for (const w of WRITERS) {
      const code = read(w.module);
      const other = WRITERS.find((x) => x !== w)!.table;
      expect(
        new RegExp(`\\.${w.table}\\.create\\s*\\(`).test(code),
        `${w.module} 이 ${w.table} 에 쓰지 않는다`,
      ).toBe(true);
      expect(
        new RegExp(`\\.${other}\\.create\\s*\\(`).test(code),
        `${w.module} 이 ${other} 에도 쓴다 — 이름이 대상을 못 말한다`,
      ).toBe(false);
    }
  });

  it("🛑 한 파일이 두 모듈을 동시에 import 하지 않는다 (섞이면 다시 구분 불가)", () => {
    const hits: string[] = [];
    for (const f of sourceFiles()) {
      const code = stripComments(readFileSync(f, "utf8"));
      const a = /from\s*["']@\/lib\/audit["']/.test(code);
      const b = /from\s*["']@\/lib\/audit\/audit-logger["']/.test(code);
      if (a && b) hits.push(f.slice(f.indexOf("src")).split(SEP).join("/"));
    }
    expect(hits, `두 감사 모듈을 동시 import: ${hits.join(" · ")}`).toHaveLength(0);
  });

  it("🔑 옛 이름이 `@/lib/audit` 경로로 다시 import 되지 않는다 (회귀 0)", () => {
    /* 개명 후 누군가 옛 이름을 되살리면 그 순간 동명이인이 복귀한다.
     *   축을 저장소 전량으로 연다 — 한 파일만 보면 형제 슬롯이 남는다(4원칙 ⑤). */
    const hits: string[] = [];
    for (const f of sourceFiles()) {
      const code = stripComments(readFileSync(f, "utf8"));
      if (
        /import\s+(?:type\s+)?\{[^}]*\b(createAuditLog|AuditLogParams)\b[^}]*\}\s*from\s*["']@\/lib\/audit["']/.test(
          code,
        )
      ) {
        hits.push(f.slice(f.indexOf("src")).split(SEP).join("/"));
      }
    }
    expect(hits, `옛 이름을 @/lib/audit 에서 import: ${hits.join(" · ")}`).toHaveLength(0);
  });
});
