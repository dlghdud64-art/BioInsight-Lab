/**
 * §invite-flow Phase 2-3 — organization-vendors 대상 조직 **짝 계약**
 *   (PLAN: docs/plans/PLAN_invite-flow.md Phase 2 이관 규칙 · billing 짝 계약과 같은 형태)
 *
 * 잠그는 것: 거래처 생성·수정·삭제가 "화면이 보여준 조직" 에 적용된다.
 *   서버 축 — mutation 은 mutation 전용 resolver + `hint_forbidden` 403,
 *            읽기(GET)는 관대한 resolver(활성 조직)
 *   화면 축 — suppliers 화면이 목록 GET 의 organizationId 를 mutation 5경로에 싣는다
 *
 * 🛑 **짝으로 잠근다.** 한쪽만 있으면 조용히 깨진다 — 라우트만 hint 를 받고 화면이 안 보내면
 *    서버가 그때의 활성 조직으로 다시 고르고, 화면만 보내면 파라미터가 무시된다.
 *    둘 다 에러 없이 틀리므로 런타임 QA 로 잡히지 않는다.
 *
 * 위험도 실측(2026-09-02): `[id]` 수정·삭제는 findVendorWithOwnership 이 소유 조직을 다시
 *   대조해 404 로 **안전하게** 실패한다. **POST(생성)만 조용하다** — 사용자가 A 를 보던 중
 *   B 에 거래처가 생기고 아무 신호가 없다. 그래서 생성이 이 계약의 핵심 대상이다.
 *   (그럼에도 [id] 계열까지 403 을 먼저 내는 이유: 명시한 조직이 틀렸다는 사실을
 *    "없는 거래처" 로 뭉개면 사용자가 자기 화면을 의심하게 된다.)
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(join(SRC, ...p), "utf8");

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (b) => b.replace(/[^\n]/g, ""))
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** 호출 창을 괄호 매칭으로 잘라낸다 (창은 호출부터 연다 — 원칙 ②). */
function callWindows(code: string, fn: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`${fn}\\s*\\(`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    let depth = 0;
    for (let j = code.indexOf("(", m.index); j < code.length; j++) {
      if (code[j] === "(") depth++;
      if (code[j] === ")") {
        depth--;
        if (depth === 0) {
          out.push(code.slice(m.index, j + 1));
          break;
        }
      }
    }
  }
  return out;
}

const VENDORS = ["app", "api", "organization-vendors", "route.ts"];
const VENDORS_ID = ["app", "api", "organization-vendors", "[id]", "route.ts"];
const VP = ["app", "api", "organization-vendor-products", "route.ts"];
const VP_ID = ["app", "api", "organization-vendor-products", "[id]", "route.ts"];

describe("§invite-flow P2-3 — vendors 서버 축 (mutation 은 명시값을 무시하지 않는다)", () => {
  /* [라벨, 경로, mutation resolver 호출 수, 403 응답 수(= 그 파일의 mutation 핸들러 수)]
   * 🔑 403 을 "hint_forbidden 근처" 로 세지 않는다 — [id] 계열은 공용 헬퍼가 사유를 판정하고
   *   각 핸들러가 403 을 내므로 두 토큰이 파일 양끝에 떨어진다(창 기반 단언이 그 형태를 놓친다).
   *   대신 이 계약 전용 문구의 **개수**를 센다: 핸들러 하나라도 가드가 빠지면 수가 줄어든다. */
  const FORBIDDEN_MESSAGE = /요청한 조직에 대한 권한이 없습니다\./g;
  const MUTATION_ROUTES: [string, string[], number, number][] = [
    ["vendors POST(생성)", VENDORS, 1, 1],
    ["vendors [id] PATCH·DELETE", VENDORS_ID, 1, 2], // 헬퍼 1개를 두 핸들러가 공유
    ["vendor-products POST(등록)", VP, 1, 1],
    ["vendor-products [id] DELETE", VP_ID, 1, 1],
  ];

  for (const [label, path, expectedCalls, expected403] of MUTATION_ROUTES) {
    it(`${label} — mutation resolver + hint + hint_forbidden 403`, () => {
      const code = stripComments(read(...path));
      const calls = callWindows(code, "resolveOrganizationIdForMutation");
      expect(calls.length).toBe(expectedCalls);
      for (const call of calls) expect(call).toMatch(/hint/);
      expect(code).toMatch(/hint_forbidden/);
      expect(code.match(FORBIDDEN_MESSAGE)?.length ?? 0).toBe(expected403);
      /* 403 이어야 한다 — 404·400 으로 뭉개면 "권한 없음" 이 "없는 자원" 으로 읽힌다. */
      expect(code).toMatch(/요청한 조직에 대한 권한이 없습니다\.[\s\S]{0,120}?status:\s*403/);
    });
  }

  it("🛑 로컬 getCurrentOrganizationId 복사본 4개가 전부 사라졌다 (첫 조직 자체 선택 금지)", () => {
    /* 같은 복사본이 파일마다 있었다 — 하나라도 남으면 그 파일만 옛 규칙으로 돈다. */
    for (const path of [VENDORS, VENDORS_ID, VP, VP_ID]) {
      const code = stripComments(read(...path));
      expect(code).not.toMatch(/async function getCurrentOrganizationId/);
    }
  });

  it("읽기(GET) 2곳은 관대한 resolver 를 유지한다 — 쓰기 규칙을 읽기로 옮기지 않는다", () => {
    for (const path of [VENDORS, VP]) {
      const code = stripComments(read(...path));
      expect(code).toMatch(/resolveActiveOrganizationId\s*\(/);
    }
  });

  it("목록 GET 이 organizationId 를 알려준다 (화면이 실어 보낼 값의 출처)", () => {
    const code = stripComments(read(...VENDORS));
    expect(code).toMatch(/NextResponse\.json\(\{[\s\S]{0,300}?organizationId,/);
  });
});

describe("§invite-flow P2-3 — vendors 화면 축 (보여준 조직을 싣는다)", () => {
  const PAGE = ["app", "dashboard", "settings", "suppliers", "page.tsx"];

  it("목록 GET 응답의 organizationId 를 붙잡는다", () => {
    const code = stripComments(read(...PAGE));
    expect(code).toMatch(/vendorOrganizationId\s*[:=]/);
    expect(code).toMatch(/data\?\.organizationId/);
  });

  it("mutation 5경로가 그 값을 싣는다 — 경로마다 각각 단언(OR 로 묶지 않는다)", () => {
    const code = stripComments(read(...PAGE));
    /* body 축 2건 — 거래처 생성 · 제품 매핑 등록 */
    expect(code).toMatch(/partnershipTier:[\s\S]{0,80}?organizationId:\s*vendorOrganizationId/);
    expect(code).toMatch(/productId:[\s\S]{0,120}?organizationId:\s*vendorOrganizationId/);
    /* 쿼리 축 3건 — 거래처 수정·삭제 · 제품 매핑 삭제 */
    expect(code).toMatch(/withOrg\(`\/api\/organization-vendors\/\$\{id\}`\)[\s\S]{0,80}?"PATCH"/);
    expect(code).toMatch(/withOrg\(`\/api\/organization-vendors\/\$\{id\}`\)[\s\S]{0,80}?"DELETE"/);
    expect(code).toMatch(/withOrg\(`\/api\/organization-vendor-products\/\$\{id\}`\)/);
  });

  it("withOrg 는 값이 없으면 붙이지 않는다 (하위 호환 — 서버가 활성 조직으로 처리)", () => {
    const code = stripComments(read(...PAGE));
    expect(code).toMatch(/vendorOrganizationId\s*\?[\s\S]{0,200}?:\s*url/);
  });
});
