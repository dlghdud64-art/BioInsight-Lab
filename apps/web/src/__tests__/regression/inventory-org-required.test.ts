/**
 * §inventory-org-required (호영님 2026-09-11) —
 * **재고는 조직의 것이다. 어느 경로로도 조직 없는 재고를 만들지 않고, 막다른 길로 끝내지 않는다.**
 *
 * ── 제품 판정 ──
 * LabAxis 는 랩 운영 OS 이고 개인 재고는 제품 개념이 아니다. `ProductInventory.organizationId`
 * nullable 은 허용이지 의도가 아니다.
 *
 * ── 왜 경로별 핀이 아니라 생성 지점 전수인가 (호영님 2026-09-11) ──
 *   두 경로를 각각 핀하면 세 번째 경로가 생겼을 때 안 잡힌다. 실제로 첫 판본(48e068e3)은
 *   POST /api/inventory · import/commit 2곳만 막았는데, 전수를 돌자 **개인 재고를 만드는 경로가
 *   2곳 더** 나왔다(delivery-sync · receiving-drafts approve 의 userId 분기). 오늘 P1 이 서버 축만
 *   핀해서 놓친 것과 같은 형태다. 그래서 "재고를 만드는 호출" 전량을 수집해 레지스트리와 대조한다 ·
 *   새 생성 지점은 조직 증명을 적기 전까지 RED 다.
 *
 * ── 이 파일이 안 보는 것 (조항 11) ──
 *   1. 정적 검사다. 가드가 생성 호출보다 **파일에서 앞에** 있는지를 보지, 제어 흐름을 따라가지 않는다.
 *      최종 잠금은 DB 제약(NOT NULL DDL · BCP DML 뒤 별건)이다.
 *   2. 이미 있는 재고의 organizationId 를 **update 로 null 로 바꾸는** 경로는 안 본다(생성만 본다).
 *   3. bulk 는 body 의 organizationId 를 zod 필수 + 멤버십 검증 뒤 쓴다 · 출처 권위는
 *      org-session-authority 소관이다. 여기서는 "비어 있을 수 없다" 만 본다.
 *   4. smart-receiving 의 NO_ORGANIZATION 응답에는 아직 action(갈 길)이 없다. 그 문구가
 *      scan-org-identity 에 핀돼 있어 이번에 건드리지 않았다 · 별건.
 *   5. delivery-sync 의 no_organization 을 admin 상태 전이는 트랜잭션째 500 으로 낸다
 *      (missing_product_id 와 같은 기존 경로). 조직 없는 발주 prod 0건 · 잠복.
 *   6. GET /api/inventory 는 여전히 { userId } 분기로 옛 개인 재고를 보여 준다(과거 행 호환).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  noOrganizationBody,
  NO_ORGANIZATION_CODE,
  ORGANIZATION_ENTRY_HREF,
} from "@/lib/organizations/no-organization";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const SEP = String.fromCharCode(92);
const read = (rel: string) => stripComments(readFileSync(join(WEB_ROOT, rel), "utf8"));

/** POST 핸들러 본문 — `export async function POST` 부터 다음 export 직전까지(블록 경계). */
function postHandler(code: string): string {
  const start = code.search(/export\s+async\s+function\s+POST\b/);
  expect(start, "POST 핸들러가 없다").toBeGreaterThan(-1);
  const rest = code.slice(start + 1);
  const next = rest.search(/\nexport\s+(async\s+)?function\s/);
  return next < 0 ? rest : rest.slice(0, next);
}

/** 여는 괄호에서 짝 맞는 닫는 괄호까지(4원칙 ⑤ · 고정 폭 슬라이스 금지). */
function argBlock(code: string, openParen: number): string {
  let depth = 0;
  for (let i = openParen; i < code.length; i++) {
    if (code[i] === "(") depth++;
    else if (code[i] === ")" && --depth === 0) return code.slice(openParen, i + 1);
  }
  return code.slice(openParen);
}

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
const relOf = (f: string) => f.slice(f.indexOf("src")).split(SEP).join("/");

const CREATE_CALL = /\.productInventory\s*\.\s*(create|createMany|upsert)\s*\(/g;

/** 재고를 **만드는** 호출 전량 — create · createMany · upsert(create 분기). 헬퍼(lib) 포함 · 테스트 제외. */
function creationSites(): { rel: string; at: number; block: string; code: string }[] {
  const out: { rel: string; at: number; block: string; code: string }[] = [];
  for (const f of sourceFiles()) {
    const code = stripComments(readFileSync(f, "utf8"));
    for (const m of code.matchAll(CREATE_CALL)) {
      const at = m.index ?? 0;
      out.push({ rel: relOf(f), at, block: argBlock(code, at + m[0].length - 1), code });
    }
  }
  return out;
}

const REJECT_NO_ORG = /if\s*\(\s*!orgResolution\.ok\s*\)\s*\{\s*return\s+noOrganizationResponse\(/;

/**
 * 생성 지점 레지스트리 — 파일마다 **조직이 비어 있을 수 없다는 증명**(생성 호출보다 앞의 가드).
 * 🛑 새 생성 지점이 생기면 여기에 증명을 적기 전까지 RED 다. 예외 목록이 아니라 **증명 목록**이다.
 */
/** payload 가 중간 객체를 거칠 때의 증명 한 쌍 · 블록이 그 객체를 싣고(block), 그 객체가 조직을 싣는다(file).
 *  🔑 한쪽만 보면 안 된다 · 스프레드를 지우거나 정의에서 조직을 빼면 둘 중 하나가 RED 여야 한다. */
type PayloadProof = { block: RegExp; file: RegExp };

const REGISTRY: Record<string, { sites: number; guard: RegExp; why: string; payload?: PayloadProof }> = {
  "src/app/api/inventory/route.ts": {
    sites: 2, guard: REJECT_NO_ORG, why: "세션 resolver · 조직 없으면 422",
    // create({ data: { productId, ...inventoryData } }) · 조직은 inventoryData 에 실린다(4번째 형태: 중간 객체 스프레드)
    payload: {
      block: /\.\.\.inventoryData\b/,
      file: /const\s+inventoryData\s*=\s*\{[\s\S]{0,800}?organizationId:\s*activeOrganizationId\b/,
    },
  },
  "src/app/api/inventory/import/commit/route.ts": {
    sites: 1, guard: REJECT_NO_ORG, why: "세션 resolver · 조직 없으면 422",
  },
  "src/app/api/inventory/smart-receiving/route.ts": {
    sites: 2,
    guard: /if\s*\(\s*!orgResolution\.ok\s*\)[\s\S]{0,600}?code:\s*"NO_ORGANIZATION"/,
    why: "세션 resolver(hint) · 조직 없으면 422 NO_ORGANIZATION",
  },
  "src/app/api/inventory/bulk/route.ts": {
    sites: 1,
    guard: /organizationId:\s*z[\s\S]{0,120}?\.min\(\s*1/,
    why: "zod 필수(min 1) + 멤버십 ADMIN/OWNER 검증",
    // createMany({ data: resolvedItems }) · 행 타입이 organizationId: string 을 필수로 갖는다
    payload: { block: /data:\s*resolvedItems\b/, file: /organizationId:\s*string;/ },
  },
  "src/app/api/receiving-drafts/[id]/approve/route.ts": {
    sites: 1,
    guard: /if\s*\(\s*!organizationId\s*\)\s*\{\s*return\s+noOrganizationResponse\(/,
    why: "입고안 조직 없으면 422 + 갈 길",
  },
  "src/lib/inventory/delivery-sync.ts": {
    sites: 1,
    guard: /if\s*\(\s*!organizationId\s*\)\s*\{\s*throw\s+new\s+DeliverySyncError\(\s*"no_organization"/,
    why: "발주 조직 없으면 no_organization 으로 던짐",
  },
};

describe("§inventory-org-required · 어느 경로로도 조직 없는 재고를 만들지 않는다 (생성 지점 전수)", () => {
  const sites = creationSites();

  it("축이 비어 있지 않다 (수집이 죽으면 아래 단언이 조용히 통과한다)", () => {
    expect(sites.length).toBeGreaterThanOrEqual(8);
  });

  it("🛑 재고를 만드는 호출 전량이 레지스트리와 같다 (새 생성 지점은 조직 증명을 적기 전까지 RED)", () => {
    const found: Record<string, number> = {};
    for (const s of sites) found[s.rel] = (found[s.rel] ?? 0) + 1;
    const expected = Object.fromEntries(Object.entries(REGISTRY).map(([k, v]) => [k, v.sites]));
    expect(found, "새 재고 생성 지점 · REGISTRY 에 조직 증명을 추가하라").toEqual(expected);
  });

  it("🛑 생성 지점마다 조직 가드가 **생성 호출보다 앞에** 있다", () => {
    for (const s of sites) {
      const reg = REGISTRY[s.rel];
      if (!reg) continue; // 위 레지스트리 단언이 잡는다
      const g = s.code.search(reg.guard);
      expect(g, `${s.rel} · 조직 가드가 없다 (${reg.why})`).toBeGreaterThan(-1);
      expect(g, `${s.rel} · 조직 가드가 생성 호출 뒤에 있다`).toBeLessThan(s.at);
    }
  });

  it("🛑 생성 payload 에 조직이 실린다", () => {
    for (const s of sites) {
      const reg = REGISTRY[s.rel];
      if (!reg) continue;
      const ok =
        /\borganizationId\b/.test(s.block) ||
        (reg.payload ? reg.payload.block.test(s.block) && reg.payload.file.test(s.code) : false);
      expect(ok, `${s.rel} · 생성 payload 에 organizationId 가 없다`).toBe(true);
    }
  });

  it("🛑 개인 재고 유니크 키(userId_productId)를 쓰는 코드 0", () => {
    const hits = sourceFiles()
      .filter((f) => /\buserId_productId\b/.test(stripComments(readFileSync(f, "utf8"))))
      .map(relOf);
    expect(hits).toEqual([]);
  });

  it("🛑 ProductInventory 에 raw INSERT 0 (ORM 을 우회한 생성 경로)", () => {
    const hits = sourceFiles()
      .filter((f) => /INSERT\s+INTO\s+"?ProductInventory"?/i.test(readFileSync(f, "utf8")))
      .map(relOf);
    expect(hits).toEqual([]);
  });
});

describe("§inventory-org-required · 요청 경로 거절 순서", () => {
  for (const rel of ["src/app/api/inventory/route.ts", "src/app/api/inventory/import/commit/route.ts"]) {
    it(`🛑 ${rel} · 조직이 없으면 422 로 거절하고, 그 거절은 enforceAction 보다 앞이다`, () => {
      const body = postHandler(read(rel));
      const resolveAt = body.search(/resolveOrganizationIdForMutation\s*\(/);
      const rejectAt = body.search(REJECT_NO_ORG);
      const enforceAt = body.indexOf("enforceAction({");
      expect(resolveAt, "세션 resolver 가 없다").toBeGreaterThan(-1);
      expect(rejectAt, "조직 없음 거절 분기가 없다").toBeGreaterThan(resolveAt);
      expect(enforceAt, "enforceAction 이 없다").toBeGreaterThan(-1);
      expect(rejectAt, "거절이 enforceAction 뒤에 있다").toBeLessThan(enforceAt);
    });
  }

  it("🛑 POST /api/inventory 에 개인 재고 fallback 이 남아 있지 않다", () => {
    const body = postHandler(read("src/app/api/inventory/route.ts"));
    expect(body).not.toMatch(/userId:\s*activeOrganizationId\s*\?\s*null/);
    expect(body).not.toMatch(/orgResolution\.ok\s*\?\s*orgResolution\.organizationId\s*:\s*null/);
  });

  it("🛑 import/commit 은 기존 재고를 조직 축으로 찾는다", () => {
    const body = postHandler(read("src/app/api/inventory/import/commit/route.ts"));
    const lookup = body.slice(body.indexOf("db.productInventory.findFirst({"));
    const where = lookup.slice(0, lookup.indexOf("});"));
    expect(where).toMatch(/\borganizationId\b/);
    expect(where).not.toMatch(/userId:\s*session\.user\.id/);
  });
});

describe("§inventory-org-required · 막다른 길로 끝내지 않는다 (갈 길 두 갈래)", () => {
  it("🔑 422 본문 · 제목 · 본문 · 버튼 하나(조직 만들기) · 초대는 문장 · 코드", () => {
    const b = noOrganizationBody("재고를 등록할");
    expect(b.error).toBe("조직에 속해야 재고를 등록할 수 있습니다");
    expect(b.detail).toBe("LabAxis 재고는 조직(랩) 단위로 관리됩니다.");
    expect(b.hint).toBe("이미 소속될 조직이 있다면 그 조직 관리자에게 초대를 요청하세요.");
    expect(b.action).toEqual({ label: "조직 만들기", href: ORGANIZATION_ENTRY_HREF });
    expect(b.code).toBe(NO_ORGANIZATION_CODE);
    expect(b.code).toBe("NO_ORGANIZATION"); // 리터럴 병기 · smart-receiving 과 같은 코드
  });

  it("🛑 버튼은 없는 기능(참여)을 약속하지 않는다 · 조직 화면에 참여 입구가 없다(2026-09-11 화면 실측)", () => {
    expect(noOrganizationBody("재고를 등록할").action.label).not.toMatch(/참여/);
  });

  it("🛑 갈 길 href 는 실재하는 화면이다 (링크가 또 막다른 길이면 안 된다)", () => {
    const page = join(WEB_ROOT, "src/app" + ORGANIZATION_ENTRY_HREF, "page.tsx");
    expect(existsSync(page), `${ORGANIZATION_ENTRY_HREF} 화면이 없다`).toBe(true);
    // 그 화면에서 조직을 실제로 만들 수 있어야 한다(POST /api/organizations)
    expect(read("src/app" + ORGANIZATION_ENTRY_HREF + "/page.tsx")).toMatch(
      /csrfFetch\(\s*["']\/api\/organizations["'][\s\S]{0,120}?method:\s*["']POST["']/,
    );
  });

  it("🛑 재고 모달 · 토스트가 서버 제목 · 본문 + 초대 문장 · 조직 만들기 버튼을 띄운다", () => {
    const code = read("src/app/dashboard/inventory/inventory-content.tsx");
    expect(code).toMatch(/action:\s*e\.action,\s*detail:\s*e\.detail,\s*hint:\s*e\.hint/);
    expect(code).toMatch(/\[org\.detail,\s*org\.hint\]/);
    expect(code).toMatch(/<ToastAction[\s\S]{0,160}?router\.push\(\s*next\.href\s*\)/);
  });

  it("🛑 가져오기 마법사 · 토스트가 아니라 단계 화면 안 인라인 안내(초대 문장이 사라지지 않는다)", () => {
    const code = read("src/components/inventory/import-wizard.tsx");
    expect(code).toMatch(/action:\s*error\.action,\s*detail:\s*error\.detail,\s*hint:\s*error\.hint/);
    expect(code).toMatch(/setOrgBlock\(\{[\s\S]{0,120}?action:\s*next\s*\}\);\s*return;/);
    expect(code).toMatch(/\{orgBlock\.hint\s*&&/);
    expect(code).toMatch(/router\.push\(\s*orgBlock\.action\.href\s*\)/);
    expect(code).not.toMatch(/<ToastAction/);
  });
});
