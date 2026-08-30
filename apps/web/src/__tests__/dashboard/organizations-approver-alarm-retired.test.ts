/**
 * §approver-axis (다) — 실행 불가능한 지시를 내린다 (호영님 판정 2026-08-26 · 좁게)
 *
 * 카드: docs/handoff/CARD_approver-axis-splits-in-one-screen.md
 *
 * 왜 내리는가 (실측):
 *   Team.organizationId 는 required → Team ⊂ Organization. 두 enum 은 충돌이 아니라
 *   **다른 범위**를 센다. 승인 라우트(api/request/[id]/approve:121)가 보는 것은
 *   TeamRole.ADMIN 이고, prod 실측 Team 0 · TeamMember 0 이라 그 게이트를 통과할
 *   주체가 존재하지 않는다.
 *   🔑 "미구현" 이 아니라 **도달 가능한 상태 부재** 다 — 코드는 있다.
 *   → 조직 화면이 "승인자를 지정하라" 고 말해도 조직 범위에 지정 수단이 없다.
 *     지시가 실행 불가능한 경보는 숫자가 틀린 것보다 무겁다.
 *
 * 범위 (좁게): **지시형 5곳만.** 표시형(수·라벨)은 (나) 라벨 범위 정정 몫이다.
 *   실행 불가능한 것은 지시이지 수가 아니고, 좁게 가면 (나)가 (다)를 다시 안 건드린다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const LIST = "src/app/dashboard/organizations/page.tsx";
const DETAIL = "src/app/dashboard/organizations/[id]/page.tsx";

describe("지시형 5곳 — 실행 불가능한 지시 부재", () => {
  it("목록 — 상태 라인·경고에서 '승인권자 미지정' 이 없다 (2곳)", () => {
    const code = stripComments(read(LIST));
    expect(code).not.toMatch(/승인권자 미지정/);
    /* 파생 자체가 사라졌는지 — 문구만 바꾸고 분기를 남기면 다시 붙는다 */
    expect(code).not.toMatch(/org\.adminCount === 0/);
  });

  it("🛑 상세 — '승인자 미지정' 처리 항목이 없다 (유일하게 배선된 CTA 였다)", () => {
    /* 다섯 중 이것만 성격이 달랐다: 문구가 아니라 dead button 이었다.
     * "승인자 지정" 버튼 → 멤버 탭 딥링크 + 역할 열 강조까지 켰는데,
     * 끝까지 따라가 APPROVER 를 줘도 승인은 안 열린다. */
    const code = stripComments(read(DETAIL));
    expect(code).not.toMatch(/label: "승인자 미지정"/);
    expect(code).not.toMatch(/actionLabel: "승인자 지정"/);
    expect(code).not.toMatch(/구매 요청이 승인 단계 없이 통과됩니다/);
  });

  it("상세 — KPI '지정 필요' 배지가 없다", () => {
    expect(stripComments(read(DETAIL))).not.toMatch(/지정 필요/);
  });

  it("상세 — '승인자를 지정해 주세요' 가 없다 (사실 표기로 교체)", () => {
    const code = stripComments(read(DETAIL));
    expect(code).not.toMatch(/승인자를 지정해 주세요/);
    expect(code).toMatch(/승인 권한을 가진 멤버가 없습니다/);
  });
});

describe("표시형 3곳 — 살아 있음 (부재 단언만으로는 '실수로 다 지웠다' 와 안 갈린다)", () => {
  it("상세 KPI — '승인 권한' 라벨 + 수가 남아 있다", () => {
    const code = stripComments(read(DETAIL));
    expect(code).toMatch(/>승인 권한</);
    expect(code).toMatch(/\{approverCount\}</);
  });

  it("상세 — '승인 권한 보유자 (N)' 카운트가 남아 있다", () => {
    expect(stripComments(read(DETAIL))).toMatch(/승인 권한 보유자 \(\{approverCount \+ adminCount\}\)/);
  });

  it("목록 — 초대 대기 상태 라인이 남아 있다 (승인권자 분기만 걷어냈다)", () => {
    const code = stripComments(read(LIST));
    expect(code).toMatch(/초대 대기 \$\{org\.pendingCount\}명/);
  });
});

describe("🛑 축은 미해결 — 안 보이는 것과 닫힌 것을 가른다", () => {
  it("목록은 adminCount(ADMIN||OWNER) · 상세는 approverCount(APPROVER) 로 여전히 갈린다", () => {
    /* (다)가 문구를 내리면 그 갈림이 **화면에서 안 보이게** 된다.
     * 안 보이는 것과 닫힌 것이 갈리지 않으면 다음 세션이 (나)를 스킵한다.
     * 이 단언은 "아직 두 축이다" 를 발화한다 — (나)에서 하나로 좁혀지면 이 단언이
     * RED 가 되고, 그때 이 describe 를 은퇴시키면서 통일 단언으로 교체한다.
     * (오늘 OWNER 불변식에서 쓴 형태 — 미해결을 침묵이 아니라 단언으로 든다.) */
    const list = stripComments(read(LIST));
    const detail = stripComments(read(DETAIL));
    expect(list).toMatch(/adminCount = allMembers|adminCount: number|org\.adminCount/);
    expect(detail).toMatch(/const approverCount = members\.filter\(\(m\) => m\.role === "APPROVER"\)/);
    expect(detail).toMatch(/const adminCount = members\.filter\(\(m\) => m\.role === "ADMIN" \|\| m\.role === "OWNER"\)/);
    /* 두 축이 아직 하나로 안 모였다는 사실 자체 — 목록에 approverCount 가 없다 */
    expect(list).not.toMatch(/approverCount/);
  });
});
