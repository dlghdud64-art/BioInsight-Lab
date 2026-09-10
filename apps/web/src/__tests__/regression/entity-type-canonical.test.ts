/**
 * §entity-type-canonical (호영님 2026-09-10) —
 * **`ActivityLog` · `AuditLog` 의 `entityType` 은 정본 집합(대문자)에만 속한다.**
 *
 * ── 결함 (prod 실측) ──
 * ```
 * ActivityLog  quote=30 · QUOTE=5 · order=2 · ORDER=2 · INVENTORY=5
 * AuditLog     ORDER=3 · QUOTE=1 · OrganizationMember=1
 * ```
 * 읽는 쪽은 **정확 일치**로 거른다(`api/activity-logs` GET: `where.entityType = q`).
 * → `entityType === "QUOTE"` 조회가 35건 중 **5건만** 잡았다. 조용히 6/7 유실.
 * 잠복이 아니라 지금 동작하는 결함이다.
 *
 * ── 정본 표기 근거 (취향 아님) ──
 * 세 감사 테이블 중 `DataAuditLog` 만 `AuditEntityType` **enum 으로 강제**되고 있고
 * 그 도메인이 전부 대문자다. 그래서 그 테이블만 데이터가 깨끗하다.
 * 나머지 둘이 `String` 이라 갈렸다. **이미 있는 정본을 따른다.**
 *
 * ── 이 파일이 **안 보는 것** (CLAUDE.md 조항 11: 한계는 다음 검사의 시작점) ──
 *   1. **기존 행의 표기** — 데이터 소급 보정은 별건 DML(호영님 승인 사안).
 *      이 sentinel 이 GREEN 이어도 prod 에는 아직 소문자 행이 남아 있다.
 *      "코드가 정본을 쓴다" 이지 "데이터가 정본이다" 가 아니다.
 *   2. **동적 값** — `entityType: someVar` 는 리터럴이 아니라 여기서 안 잡힌다.
 *      그 축은 **타입**이 잡는다(`createActivityLog` 의 `ActivityEntityType`).
 *      실제로 tsc 가 이 스캔이 못 본 2곳을 잡아냈다(`state-transition-logger.ts`) —
 *      정적 스캔과 타입은 **다른 축**이고 둘 다 필요하다.
 *   3. **다른 도메인의 `entityType`** — `AiActionItem.relatedEntityType` ·
 *      `enforceAction` 의 `targetEntityType`('po'·'quote' 소문자가 그쪽 관례) ·
 *      `MutationAuditEvent.entityType` 은 **대상이 아니다.** 전량 대문자화하면 남의 도메인을 부순다.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";
import {
  ACTIVITY_ENTITY_TYPES,
  isActivityEntityType,
  canonicalizeEntityType,
} from "@/lib/activity/entity-type";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const SEP = String.fromCharCode(92);

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

/** 호출 블록을 **중괄호 짝**으로 연다 — 고정 폭 슬라이스 금지(4원칙 ⑤). */
function callBlocks(code: string, needle: string): string[] {
  const out: string[] = [];
  let i = 0;
  while ((i = code.indexOf(needle, i)) !== -1) {
    const open = code.indexOf("{", i);
    if (open === -1) break;
    let d = 0;
    let e = open;
    for (; e < code.length; e++) {
      if (code[e] === "{") d++;
      else if (code[e] === "}") {
        d--;
        if (d === 0) break;
      }
    }
    out.push(code.slice(open, e + 1));
    i = e + 1;
  }
  return out;
}

/**
 * 두 테이블에 쓰는 지점의 `entityType` 리터럴 전량.
 * 🔑 축을 **쓰는 심볼**로 좁힌다(절차 A). 테이블 이름이나 필드 이름으로 훑으면
 *   위 한계 3(다른 도메인)을 전부 오탐으로 끌고 온다.
 * 🛑 `createAuditLog` 은 **동명이인이 둘**이다(→AuditLog / →DataAuditLog).
 *   import 경로로 가른다. 이름만 보면 33곳이 뭉개진다(2026-09-07 오보의 뿌리).
 */
function writtenLiterals(): { value: string; file: string }[] {
  const out: { value: string; file: string }[] = [];
  for (const f of sourceFiles()) {
    const code = stripComments(readFileSync(f, "utf8"));
    const needles = ["createActivityLog(", "db.activityLog.create(", "db.auditLog.create("];
    if (
      /import\s*\{[^}]*\bcreateAuditLog\b[^}]*\}\s*from\s*["']@\/lib\/audit\/audit-logger["']/.test(
        code,
      )
    ) {
      needles.push("createAuditLog(");
    }
    for (const n of needles) {
      for (const b of callBlocks(code, n)) {
        for (const m of b.matchAll(/entityType\s*:\s*["'`]([^"'`$]+)["'`]/g)) {
          out.push({ value: m[1], file: f.slice(f.indexOf("src")).split(SEP).join("/") });
        }
      }
    }
  }
  return out;
}

describe("§entity-type-canonical — 코드가 쓰는 entityType 은 정본 집합에만 속한다", () => {
  it("축이 비어 있지 않다 (검사가 조용히 사라지지 않게)", () => {
    /* 🛑 needle 이나 경로 조건이 틀리면 스캔이 0이 되고 그 순간 영구 GREEN 이다.
     *   실측 2026-09-10: 리터럴 18종 / 소스 2052개. */
    expect(sourceFiles().length).toBeGreaterThan(1500);
    expect(writtenLiterals().length).toBeGreaterThan(30);
  });

  it("🛑 정본 집합에 없는 리터럴이 0이다", () => {
    const bad = writtenLiterals().filter((h) => !isActivityEntityType(h.value));
    expect(
      bad.map((b) => `${b.value} @ ${b.file}`),
      `정본 집합 밖 entityType: ${bad.map((b) => b.value).join(" · ")}`,
    ).toHaveLength(0);
  });

  it("🔑 정본 집합은 **대문자 SCREAMING_SNAKE** 다 (표기 규칙이 계약이다)", () => {
    /* 값 집합을 리터럴로 고정하지 않고 **형태**를 단언한다 — 집합은 늘어나도 되지만
     *   표기가 흔들리면 이 결함이 그대로 재발한다.
     *   (§상수를 참조하는 단언과 다른 축: 여기서 지킬 것은 멤버 목록이 아니라 규칙이다.) */
    for (const t of ACTIVITY_ENTITY_TYPES) {
      expect(t, `${t} 가 SCREAMING_SNAKE 가 아니다`).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
    // 중복 0 — 같은 값을 두 번 적으면 집합이 아니다.
    expect(new Set(ACTIVITY_ENTITY_TYPES).size).toBe(ACTIVITY_ENTITY_TYPES.length);
  });

  it("🛑 저장 경로는 body 값을 **거절**한다 — 정규화로 받지 않는다", () => {
    /* 정규화가 검증을 대신하면 아무 문자열이나 대문자로 바뀌어 들어가고
     *   집합 강제가 사라진다. 라우트가 거절 분기를 갖는지, 그리고 그 분기가
     *   **create 보다 앞**에 있는지 본다(뒤면 이미 저장된 뒤다). */
    const code = stripComments(
      readFileSync(join(WEB_ROOT, "src/app/api/activity-logs/route.ts"), "utf8"),
    );
    const guardIdx = code.search(/if\s*\(!isActivityEntityType\(entityType\)\)/);
    const createIdx = code.indexOf("db.activityLog.create(");
    expect(guardIdx, "정본 검증 분기가 없다").toBeGreaterThan(-1);
    expect(createIdx).toBeGreaterThan(-1);
    expect(guardIdx, "검증이 create 보다 뒤에 있다 — 이미 저장된 뒤다").toBeLessThan(createIdx);
    expect(code).toMatch(/status:\s*400/);
    // 🔑 쓰기 경로에 정규화 함수를 두지 않는다(읽기 보조 전용).
    expect(code).not.toMatch(/canonicalizeEntityType/);
  });

  it("🔑 `createActivityLog` 의 계약이 **타입**으로 강제된다 (동적 값 축)", () => {
    /* 리터럴 스캔은 `entityType: someVar` 를 못 본다. 그 축은 타입이 잡는다 —
     *   실제로 tsc 가 `state-transition-logger.ts` 2곳을 잡아냈고, 이 파일의 스캔은 못 봤다. */
    const lib = stripComments(readFileSync(join(WEB_ROOT, "src/lib/activity-log.ts"), "utf8"));
    expect(lib).toMatch(/entityType:\s*ActivityEntityType/);
    expect(lib).not.toMatch(/entityType:\s*string/);
  });

  it("🔑 정규화 헬퍼는 표기만 다른 값을 옮기고, 모르는 값은 null 이다", () => {
    expect(canonicalizeEntityType("quote")).toBe("QUOTE");
    expect(canonicalizeEntityType("OrganizationMember")).toBe("ORGANIZATION_MEMBER");
    expect(canonicalizeEntityType("analytics_event")).toBe("ANALYTICS_EVENT");
    // 🛑 모르는 값을 조용히 만들어내지 않는다 — 그러면 검증을 대신하게 된다.
    expect(canonicalizeEntityType("banana")).toBeNull();
    expect(canonicalizeEntityType("")).toBeNull();
  });
});
