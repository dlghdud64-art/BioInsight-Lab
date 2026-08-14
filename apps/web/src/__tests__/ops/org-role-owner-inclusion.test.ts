/**
 * §team-org-role-model Phase 1 — 조직 role 판정에서 `OWNER` 가 빠지지 않는다
 *
 * 배경 (실측 2026-08-12):
 *   `role: "OWNER"` 를 DB 에 쓰는 코드가 repo 전수 0 이라 OWNER 는 유령이었다.
 *   그 상태에서 **OWNER 를 빠뜨린 판정이 16곳** 자라났다(서버 13 · 클라이언트 3).
 *
 *   🛑 순서 역전 위험 — OWNER 부여를 먼저 하면, 그 순간부터 조직 생성자가
 *      안전지출·SDS·보안설정 표면에서 **403** 을 받는다. 지금은 ADMIN 이라 통과하므로
 *      **OWNER 도입이 곧 권한 상실**이 된다. 그래서 Phase 1(판정 확대)이 먼저다.
 *
 * 계약:
 *   O1. `in: [OrganizationRole...]` 배열에 ADMIN 이 있으면 OWNER 도 있다
 *   O2. `role: OrganizationRole.ADMIN` **단독 where** 가 없다 (최고 권한자를 막는 형태)
 *   O3. Phase 1 에서 고친 16곳이 되돌아가지 않는다 (파일별 OWNER 존재)
 *   O4. 수집이 실제로 동작한다 (공허 GREEN 방지)
 *
 * ⚠️ 이 sentinel 의 본체는 **재발 차단**이다. 다음에 누가 조직 role 판정을 추가할 때
 *   또 빠뜨린다 — 그때 여기서 걸린다.
 *
 * ⚠️ 범위: `OrganizationRole` 만 본다. `WorkspaceMember`(별도 모델·별도 enum)와
 *   `TeamRole` 은 대상이 아니다 — PLAN §1-I "대상 아님" 표 참조.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const SRC = join(WEB_ROOT, "src");

const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      walk(full, acc);
    } else if (/\.tsx?$/.test(entry)) acc.push(full);
  }
  return acc;
}

const rel = (f: string) => f.slice(WEB_ROOT.length + 1).split("\\").join("/");

const FILES = walk(SRC)
  .map((f) => ({ path: rel(f), code: stripComments(readFileSync(f, "utf8")) }))
  .filter((f) => f.code.includes("OrganizationRole"));

/**
 * 알려진 예외 — **dead file 이라 고치지 않았다.**
 *   `components/upgrade/upgrade-modal.tsx` 는 importer 0 이다(실측). 라이브 판본은
 *   `components/billing/upgrade-modal.tsx` 이며 그쪽에는 이 판정 자체가 없다.
 *   dead file 을 고치면 §render-reachability 위반(2026-08-06 재발 사고와 동형)이므로
 *   **손대지 않고 여기에 기록**한다. 파일이 되살아나면 예외에서 빼고 고쳐야 한다.
 */
const DEAD_FILE_EXCEPTIONS = ["src/components/upgrade/upgrade-modal.tsx"];

describe("§org-role-owner O4 — 수집이 실제로 동작한다", () => {
  it("OrganizationRole 을 쓰는 파일이 충분히 모인다", () => {
    expect(FILES.length).toBeGreaterThan(15);
  });
  it("예외 목록의 dead file 이 실재한다 (사라지면 예외를 지워야 한다)", () => {
    for (const p of DEAD_FILE_EXCEPTIONS) {
      expect(FILES.some((f) => f.path === p)).toBe(true);
    }
  });
});

describe("§org-role-owner O1 — in:[] 배열에 ADMIN 이 있으면 OWNER 도 있다", () => {
  it("OWNER 누락 배열 0", () => {
    const offenders: string[] = [];
    for (const f of FILES) {
      if (DEAD_FILE_EXCEPTIONS.includes(f.path)) continue;
      const arrays = f.code.match(/in:\s*\[[^\]]*OrganizationRole[^\]]*\]/g) ?? [];
      for (const arr of arrays) {
        if (arr.includes("OrganizationRole.ADMIN") && !arr.includes("OrganizationRole.OWNER")) {
          offenders.push(`${f.path} :: ${arr.replace(/\s+/g, " ")}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("§org-role-owner O2 — ADMIN 단독 where 가 없다", () => {
  it("role: OrganizationRole.ADMIN 단독 지정 0", () => {
    const offenders: string[] = [];
    for (const f of FILES) {
      if (DEAD_FILE_EXCEPTIONS.includes(f.path)) continue;
      // `role: OrganizationRole.ADMIN,` — 배열도 비교도 아닌 단일 값 지정
      if (/role:\s*OrganizationRole\.ADMIN\s*,/.test(f.code)) offenders.push(f.path);
    }
    expect(offenders).toEqual([]);
  });
});

describe("§org-role-owner O3 — Phase 1 교정 16곳 회귀 0", () => {
  /** 서버 13 + 클라이언트 3. 각 파일에서 OWNER 판정이 사라지면 RED. */
  const FIXED = [
    "src/app/api/safety-spend/route.ts",
    "src/app/api/safety-spend/unmapped/route.ts",
    "src/app/api/safety/spend/export/route.ts",
    "src/app/api/safety/spend/map/route.ts",
    "src/app/api/safety/spend/summary/route.ts",
    "src/app/api/safety/spend/unmapped/route.ts",
    "src/app/api/products/[id]/safety/route.ts",
    "src/app/api/products/[id]/sds/route.ts",
    "src/app/api/safety/products/route.ts",
    "src/app/api/safety/sds/route.ts",
    "src/app/api/sds/[id]/apply/route.ts",
    "src/app/api/sds/[id]/extract/route.ts",
    "src/app/api/organizations/[id]/security/route.ts",
    "src/app/admin/safety/page.tsx",
    "src/app/settings/audit/page.tsx",
    "src/app/settings/security/page.tsx",
    // Phase 1 누락분 (2026-08-12 발견) — 경로에 "workspace" 가 들어 제외 필터에 함께 걸렸다.
    "src/components/workspace/workspace-switcher.tsx",
  ];

  it("17곳 전부가 OrganizationRole.OWNER 를 판정에 포함한다", () => {
    const missing = FIXED.filter((p) => {
      const f = FILES.find((x) => x.path === p);
      return !f || !f.code.includes("OrganizationRole.OWNER");
    });
    expect(missing).toEqual([]);
  });

  it("목록이 17곳이다 (축소되면 은폐 — 늘리는 것은 허용)", () => {
    expect(FIXED.length).toBe(17);
  });

  /**
   * ⚠️ 도달성 주석 (Phase 2 실측 2026-08-12) — 16곳 중 **`app/admin/safety/page.tsx` 1곳은
   *   조직 OWNER 가 도달할 수 없다.** `middleware.ts` 의 admin deny-by-default 구간
   *   (`/admin/*` → `User.role === 'ADMIN'` 필요)에 걸린다. 즉 그 파일의 OWNER 추가는
   *   **동작 무관**이며, 되돌리지 않고 두는 이유는 표면이 admin 구간 밖으로 나가면
   *   이미 옳기 때문이다. **"형태가 맞다" 와 "동작한다" 는 다르다** — 이 세션 4번째 사례.
   *   나머지 15곳(`/api/safety*` · `/api/products/*` · `/api/sds/*` ·
   *   `/api/organizations/*` · `/settings/*`)은 admin 구간 밖이라 도달 가능하다.
   */
  it("admin 구간 안에 있는 교정 지점은 admin/safety 하나뿐이다", () => {
    const inAdminZone = FIXED.filter(
      (p) => p.startsWith("src/app/admin/") || p.startsWith("src/app/api/admin/"),
    );
    expect(inAdminZone).toEqual(["src/app/admin/safety/page.tsx"]);
  });
});

/**
 * §fabricated-data-surface — 조직 생성 직후 행의 role 은 **DB 응답에서 도출**한다
 *
 * 배경: `dashboard/organizations/page.tsx` 가 생성 직후 낙관적 행에
 *   `role: "OWNER"` 를 **하드코딩**했다. 그런데 DB 는 `ADMIN` 이었다
 *   (§team-org-role-model Phase 2 전). **화면과 DB 가 어긋난 상태**였고,
 *   사용자는 자기가 OWNER 라는 근거를 화면에서만 얻었다.
 *
 * 계약: 지어내지 않는다. 도출 불가면 행을 넣지 않는다(빈 값도 지어내기다).
 */
describe("§fabricated-data-surface — 조직 role 하드코딩 0", () => {
  /**
   * ⚠️ `FILES` 는 `OrganizationRole` 을 포함한 파일만 모은다. 이 페이지는 role 을
   *   **문자열로** 다루므로 그 목록에 없다 — 직접 읽는다.
   *   (첫 작성 때 `FILES.find` 로 두어 `undefined` 가 됐고, "대상 파일이 수집된다"
   *    단언이 잡았다. §3-4 무음 실패 금지가 실제로 작동한 사례.)
   */
  const ORG_PAGE = "src/app/dashboard/organizations/page.tsx";
  const page = {
    path: ORG_PAGE,
    code: stripComments(readFileSync(join(WEB_ROOT, ORG_PAGE), "utf8")),
  };

  it("대상 파일이 수집된다", () => {
    expect(page.code.length).toBeGreaterThan(1000);
  });

  it('role 을 리터럴로 지정하지 않는다 (role: "OWNER" / "ADMIN" 하드코딩 0)', () => {
    expect(page.code).not.toMatch(/role:\s*["'](OWNER|ADMIN)["']/);
  });

  it("내 멤버십에서 도출한다 + 도출 실패 시 행 미삽입", () => {
    expect(page.code).toMatch(/m\?\.userId === session\?\.user\?\.id/);
    expect(page.code).toMatch(/derivedRole/);
    expect(page.code).toMatch(/if \(derivedRole\)/);
  });

  it("adminCount 도 응답에서 센다 (이전 하드코딩 1 폐기)", () => {
    expect(page.code).not.toMatch(/adminCount:\s*1\b/);
    expect(page.code).toMatch(/adminCount:\s*members\.filter/);
  });
});
