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
import { readFileSync } from "node:fs";
import { join } from "node:path";

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
function switcherElement(src: string): string {
  const open = src.indexOf("<WorkspaceSwitcher");
  if (open === -1) return "";
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (depth === 0 && c === ">") return src.slice(open, i + 1);
  }
  return "";
}

function switcherOrgProp(src: string): string | null {
  const el = switcherElement(src);
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
    const el = switcherElement(src);
    expect(el).toMatch(/^<WorkspaceSwitcher/);

    const prop = switcherOrgProp(src);
    expect(prop).not.toBeNull();

    // 🛑 `selectedOrgId` 단독 금지 — 미선택 시 "" 이고, 스위처가 그 빈 값을 받으면
    //    `organizations[0]` 을 자기가 세운다(라벨 != 데이터).
    expect(prop).not.toBe("selectedOrgId");

    // 허용: 활성 조직에서 파생된 두 형태만
    expect(["effectiveOrgId", "currentOrg.id"]).toContain(prop);
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
});
