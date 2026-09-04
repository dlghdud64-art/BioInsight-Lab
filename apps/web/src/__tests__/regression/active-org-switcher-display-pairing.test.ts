/**
 * §invite-flow Phase 2-9 후속 — 조직을 "표시하는" 화면의 짝 계약
 *
 * Phase 2-9 는 본문 데이터 기준을 `organizations[0]` → 활성 조직(`effectiveOrgId`) 으로 옮겼다.
 * 그런데 `<WorkspaceSwitcher>` 에 넘기는 `currentOrganizationId` 를 같이 옮기지 않으면
 * **라벨은 첫 조직 · 데이터는 활성 조직** 이 된다 — 스위처는 빈 값을 받으면
 * 자기가 `organizations[0]` 을 골라 세우기 때문이다(workspace-switcher.tsx 의 기본값 효과).
 *
 * 즉 그 상태는 이 트랙이 막겠다고 선언한 "화면이 보여준 조직 != 적용된 조직" 그 자체다.
 * 오늘은 활성값을 쓰는 경로가 없어 미발화지만, Phase 4(switcher PATCH 배선)가
 * 정확히 그 조건을 켠다. 그래서 Phase 4 **앞에** 잠근다.
 *
 * 잠그는 것은 "특정 심볼" 이 아니라 **짝** 이다 —
 * 스위처가 받는 값이 본문이 쓰는 값과 같은 심볼이어야 한다.
 * `effectiveOrgId` · `currentOrg.id` 둘 다 정당하다(둘 다 활성 조직에서 파생).
 * 금지되는 것은 **`selectedOrgId` 단독** 이다(미선택 시 "" → 스위처 자체 승격 발화).
 */
import { readFileSync, readdirSync } from "node:fs";
import { stripComments } from "../_helpers/em-dash-scan";
import { join, relative } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

/** 그룹 A — 조직을 표시하는(WorkspaceSwitcher 를 렌더하는) 화면 전량 */
const GROUP_A = [
  "src/app/admin/safety/page.tsx",
  "src/app/dashboard/safety-spend/page.tsx",
  "src/app/settings/audit/page.tsx",
  "src/app/settings/billing/page.tsx",
  "src/app/settings/security/page.tsx",
  "src/app/settings/workspace/page.tsx",
] as const;

/**
 * 창은 **여는 태그부터** 연다(4원칙 ②).
 * 속성부터 열면 여는 태그가 창 밖으로 나가 어느 요소의 속성인지 잃는다.
 * `>` 단순 스캔은 안 된다 — `onOrganizationChange={(id: string) => {...}}` 의 화살표가
 * 걸린다. 중괄호 깊이를 세어 depth 0 에서만 태그를 닫는다.
 */
function elementAt(src: string, open: number): string {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (depth === 0 && c === ">") return src.slice(open, i + 1);
  }
  return "";
}

/**
 * 🛑 하드닝 (Cowork QA 2026-09-03) — `indexOf` 는 **첫 스위처만** 본다.
 *    한 화면이 모바일·데스크톱 변형으로 두 번 렌더하면 두 번째가 미검증으로 남는다
 *    (`.match()` → `.matchAll()` 과 같은 형태의 결함). 전 occurrence 를 돌려준다.
 */
function switcherElements(src: string): string[] {
  const out: string[] = [];
  const re = /<WorkspaceSwitcher/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const el = elementAt(src, m.index);
    if (el) out.push(el);
  }
  return out;
}

function orgPropOf(el: string): string | null {
  const m = el.match(/currentOrganizationId=\{([^}]*)\}/);
  return m ? m[1].trim() : null;
}

describe("§invite-flow Phase 2-9 후속 — 표시 값과 데이터 값의 짝", () => {
  it.each(GROUP_A)("%s — 스위처가 받는 조직이 활성 조직에서 파생된다", (rel) => {
    const src = read(rel);

    // 전제: 본문이 활성 조직 훅을 쓴다 (Phase 2-9 이관분 회귀 0)
    expect(src).toMatch(/useActiveOrganization\(\)/);
    expect(src).toMatch(
      /const effectiveOrgId = selectedOrgId \|\| activeOrganizationId \|\| ""/,
    );

    // 창이 실제로 열렸는지 먼저 단언한다 — 못 찾은 것을 통과로 읽으면 공허하다
    const els = switcherElements(src);
    expect(els.length).toBeGreaterThan(0);
    // 파일 안의 `<WorkspaceSwitcher` 출현 수와 파싱 성공 수가 같아야 한다
    expect(els.length).toBe((src.match(/<WorkspaceSwitcher/g) ?? []).length);

    for (const el of els) {
      expect(el).toMatch(/^<WorkspaceSwitcher/);
      const prop = orgPropOf(el);
      expect(prop).not.toBeNull();

      // 🛑 `selectedOrgId` 단독 금지 — 미선택 시 "" 이고, 스위처가 그 빈 값을 받으면
      //    `organizations[0]` 을 자기가 세운다(라벨 != 데이터).
      expect(prop).not.toBe("selectedOrgId");

      // 허용: 활성 조직에서 파생된 두 형태만
      expect(["effectiveOrgId", "currentOrg.id"]).toContain(prop);
    }
  });

  it("currentOrg 는 effectiveOrgId 로 해석된다 (currentOrg.id 를 넘기는 쪽의 파생 근거)", () => {
    for (const rel of GROUP_A) {
      const src = read(rel);
      expect(src).toMatch(
        /organizations\.find\(\(org: any\) => org\.id === effectiveOrgId\)/,
      );
    }
  });

  it("회귀 0 — 각 화면의 로딩 가드가 활성 조직 확정을 기다린다", () => {
    for (const rel of GROUP_A) {
      expect(read(rel)).toMatch(/activeOrgLoading/);
    }
  });

  /**
   * 🛑 하드닝 (Cowork QA 2026-09-03) — `GROUP_A` 는 하드코딩 목록이다.
   *    7번째 화면이 스위처를 렌더하면 이 센티널이 **조용히 비켜간다.**
   *    목록을 믿지 말고 소스에서 도출해 포함관계를 단언한다.
   */
  it("목록 표류 0 — 스위처를 렌더하는 화면은 전부 GROUP_A 안에 있다", () => {
    const APP = join(REPO_ROOT, "src", "app");
    const found: string[] = [];
    (function walk(dir: string) {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (/\.(tsx|ts)$/.test(e.name)) {
          if (readFileSync(full, "utf8").includes("<WorkspaceSwitcher")) {
            found.push(
              relative(join(REPO_ROOT, "src"), full).replace(/\\/g, "/"),
            );
          }
        }
      }
    })(APP);

    // 도출이 실제로 돌았는지 먼저 — 0 을 "위반 없음" 으로 읽으면 공허하다
    expect(found.length).toBeGreaterThan(0);
    const declared = new Set(GROUP_A.map((r) => r.replace(/^src\//, "")));
    expect(found.filter((f) => !declared.has(f))).toEqual([]);
  });
});

/**
 * §invite-flow Phase 2-10 — B 분류(스위처를 렌더하지 않는 화면) 이관분.
 *
 * B 의 판정 기준은 "표시 여부" 가 아니라 **그 값이 어디로 흘러가는가** 다
 * (Cowork QA 2026-09-03). 표시하지 않아도 화면 데이터의 기준이거나
 * mutation body 로 나가면 이관 대상이다.
 */
describe("§invite-flow Phase 2-10 — B 분류 이관분", () => {
  it("settings/enterprise — 기준값이 활성 조직 (표시하지 않아도 데이터 기준)", () => {
    const src = read("src/app/dashboard/settings/enterprise/page.tsx");
    expect(src).toMatch(/useActiveOrganization\(\)/);
    expect(src).toMatch(
      /const effectiveOrgId = selectedOrgId \|\| activeOrganizationId \|\| ""/,
    );
    expect(src).toMatch(
      /organizations\.find\(\(org: any\) => org\.id === effectiveOrgId\)/,
    );
    // 🛑 §sso-phantom-wiring 비활성 배선을 되살리지 않았다 (범위 밖)
    expect(src).toMatch(/§sso-phantom-wiring/);
  });

  it("BulkImportModal — mutation body 의 조직이 활성 조직에서 파생된다", () => {
    const src = read("src/components/inventory/BulkImportModal.tsx");
    expect(src).toMatch(/useActiveOrganization\(\)/);

    // 우선순위: 활성(권한 있으면) → 권한 있는 조직 → 활성 그대로(서버가 사유를 말함)
    expect(src).toMatch(
      /canImport\(activeOrg\?\.role\) \? activeOrg\?\.id : undefined[\s\S]{0,120}?importableOrg\?\.id[\s\S]{0,80}?activeOrganizationId/,
    );
    // OWNER 누락 회귀 0 — 구 `adminOrg` 는 role === "ADMIN" 만 봤다
    expect(src).toMatch(/role === "ADMIN" \|\| role === "OWNER"/);

    // 그 값이 실제로 body 로 나가는 경로 (표시가 아니라 쓰기라는 근거)
    expect(src).toMatch(/"\/api\/inventory\/bulk"/);
    expect(src).toMatch(/JSON\.stringify\(\{ organizationId, items \}\)/);
  });

  it("BulkImportModal — 쓰기 대상 조직이 화면에 표시된다", () => {
    const src = read("src/components/inventory/BulkImportModal.tsx");
    /* 표시 대상은 **body 로 나가는 그 값**이어야 한다 — 다른 심볼을 표시하면
     * 표시와 쓰기가 갈린다(이 트랙이 스위처에서 잡은 것과 같은 형태). */
    expect(src).toMatch(
      /const targetOrg =[\s\S]{0,120}?organizations\.find\(\(org\) => org\.id === organizationId\)/,
    );
    expect(src).toMatch(/\{targetOrg\.name\}/);
    expect(src).toMatch(/조직으로 등록됩니다/);
    /* 대상이 활성 조직과 다를 때 그 사실을 말한다 — ②(권한 있는 조직으로 옮김)가
     * ③(서버가 이유를 말함)과 원칙이 충돌하지 않도록. */
    expect(src).toMatch(
      /targetOrg\.id !== activeOrganizationId/,
    );
    expect(src).toMatch(/targetIsNotActive &&[\s\S]{0,200}?등록 권한이 없어/);
  });

  it("settings/plans — 표시(Select value)와 결제 대상(구독 경로)이 같은 심볼", () => {
    const src = read("src/app/dashboard/settings/plans/page.tsx");
    expect(src).toMatch(/useActiveOrganization\(\)/);

    // 우선순위: 사용자 선택 → 딥링크(소속 검증) → 활성 조직. orgs[0] 없음.
    expect(src).toMatch(
      /const effectiveOrgId =\s*\n?\s*selectedOrgId \|\| intentOrgId \|\| activeOrganizationId \|\| ""/,
    );
    expect(src).toMatch(
      /organizations\.some\(\(org: any\) => org\.id === intentWorkspaceId\)/,
    );

    // 🔑 조건 2 — 같은 심볼이어야 한다. 갈리면 보이는 조직과 결제되는 조직이 다르다.
    expect(src).toMatch(/value=\{effectiveOrgId\}/);
    expect(src).toMatch(
      /`\/api\/organizations\/\$\{effectiveOrgId\}\/subscription`/,
    );
    // 🛑 결제 경로가 다른 심볼로 되돌아가는 것을 직접 막는다
    expect(src).not.toMatch(
      /`\/api\/organizations\/\$\{selectedOrgId\}\/subscription`/,
    );
    expect(src).not.toMatch(/value=\{selectedOrgId\}/);

    // 활성 조직 확정까지 기다린다 (빈 기준값이 한 프레임 뜨지 않게)
    expect(src).toMatch(/if \(orgsLoading \|\| activeOrgLoading\)/);

    /* 🛑 실제 **과금 지점** (Cowork QA 2026-09-04 — 조건 2 범위 확대).
     * 구독 GET 은 조회일 뿐이고 돈이 나가는 곳은 `CheckoutDialog` 다.
     * 위 부정 단언은 `value={...}` 패턴만 봐서 여기를 `selectedOrgId` 로
     * 되돌려도 GREEN 이었다 — 잠금이 표시·조회에서 멈춰 있었다. */
    expect(src).toMatch(
      /<CheckoutDialog[\s\S]{0,400}?organizationId=\{selectedOrg\.id\}/,
    );
    /* 🔑 그리고 `selectedOrg.id` 가 `effectiveOrgId` 파생이라는 **연결**을 함께 잠근다.
     * 위 한 줄만 두면 `selectedOrg` 정의가 바뀌는 순간 공허해진다 —
     * 과금 대상이 다른 값으로 옮겨가도 통과한다. */
    expect(src).toMatch(
      /const selectedOrg =\s*\n?\s*organizations\.find\(\(org: any\) => org\.id === effectiveOrgId\)/,
    );
  });

  /**
   * §invite-flow Phase 4 — 스위처 PATCH 배선.
   * Cowork QA 가 착수 전에 짚은 3지점을 그대로 축으로 삼는다.
   */
  describe("Phase 4 — 스위처가 활성 조직을 서버에 영속시킨다", () => {
    const SW = read("src/components/workspace/workspace-switcher.tsx");

    it("① 자기 승격 2건이 **동시에** 사라졌다 (반쪽 생존 0)", () => {
      const code = stripComments(SW);
      // 승격 effect(:81) · value fallback(:109) 둘 다. 하나만 남으면 경로가 반쪽으로 산다.
      expect(code).not.toMatch(/organizations\[0\]/);
      expect(code).not.toMatch(/setSelectedOrgId/);
      // 표시값은 부모가 준 값 아니면 서버의 활성 조직, 둘 뿐이다
      expect(SW).toMatch(
        /const displayedOrgId = currentOrganizationId \|\| activeOrganizationId \|\| ""/,
      );
      expect(SW).toMatch(/value=\{displayedOrgId\}/);
    });

    it("② 전환 실패는 화면을 바꾸지 않는다 (placeholder success 0)", () => {
      /* 🛑 서버가 먼저, 화면은 그 뒤. `await` 뒤에서만 부모 state 가 움직인다 —
       * 순서가 뒤집히면 403/500 일 때 화면은 org-B · 서버는 org-A 가 된다. */
      expect(SW).toMatch(
        /await setActiveOrganization\(orgId\)[\s\S]{0,400}?onOrganizationChange\(orgId\)/,
      );
      // 실패 경로가 사유를 말한다 (조용한 실패 0)
      expect(SW).toMatch(
        /catch \(error\)[\s\S]{0,300}?워크스페이스 전환 실패[\s\S]{0,300}?variant: "destructive"/,
      );
      // 전환 중 재입력 잠금
      expect(SW).toMatch(/disabled=\{isSwitching\}/);
      /* 낙관적 갱신 0 — `await` **앞** 창에서 부모 state·라우터를 건드리지 않는다.
       * 🛑 이 단언은 처음에 `not.toMatch(/onOrganizationChange\(/)` 였고,
       *    프로브(`onOrganizationChange?.(orgId)` 주입)를 **통과시켰다** —
       *    optional-call `?.(` 이 그 패턴에 안 걸린다(4원칙 ① 접두사·변형 계열).
       *    호출 형태를 세지 말고 **창 안 등장 자체**를 금지한다. 창이 좁아서 안전하다. */
      const beforeAwait = SW.slice(
        SW.indexOf("const handleOrganizationChange"),
        SW.indexOf("await setActiveOrganization"),
      );
      expect(beforeAwait.length).toBeGreaterThan(0);
      expect(beforeAwait).not.toMatch(/onOrganizationChange/);
      expect(beforeAwait).not.toMatch(/router\.refresh/);
    });

    it("③ 로컬 선택 state 0 — 2-9 의 짝이 전환 후에도 성립한다", () => {
      /* 소비 화면은 `effectiveOrgId = selectedOrgId || 활성조직` 이다.
       * 스위처가 로컬 선택 state 를 들고 있으면 옛 값이 이겨 PATCH 가 무력화되고
       * 표시 = 데이터 짝이 깨진다. 그래서 스위처에는 선택 state 자체를 두지 않는다. */
      expect(stripComments(SW)).not.toMatch(/useState/);
      expect(SW).toMatch(/useActiveOrganization\(\)/);
      // 자체 조직 쿼리도 제거 — 공유 키 선언이 8 → 7 로 줄었다
      expect(stripComments(SW)).not.toMatch(/queryKey: \["user-organizations"\]/);
    });
  });

  it("공유 캐시 회귀 0 — 훅의 조직 목록이 페이지들과 같은 모양이다", () => {
    /* `["user-organizations"]` 는 선언 8곳 + 이 훅이 같이 쓰는 키다. 훅만 배열을 반환하면
     * 먼저 fetch 한 쪽에 따라 한쪽이 깨진다 — 페이지 쪽은 조직 0 으로,
     * 훅 쪽은 `organizations.find is not a function` 으로. 모양을 맞춰 잠근다. */
    const hook = read("src/hooks/use-active-organization.ts");
    expect(hook).toMatch(
      /queryFn: async \(\): Promise<\{ organizations: ActiveOrganization\[\] \}>/,
    );
    expect(hook).toMatch(/Array\.isArray\(rawOrgs\)/);
  });
});
