/**
 * §org-management-web P4a — 개요 2열 재구성 sentinel
 *
 * 계획서: docs/plans/PLAN_org-management-web.md
 * 잠그는 것: 개요 탭이 **폭을 쓰고**, 처리 항목이 **결과와 행동**을 함께 말한다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const ORG_DETAIL = "src/app/dashboard/organizations/[id]/page.tsx";

/** 개요 탭 블록만 잘라낸다 — 파일 전역 단언 금지. */
function overviewBlock(code: string): string {
  const m = code.match(/<TabsContent value="overview">[\s\S]*?<\/TabsContent>/);
  return m?.[0] ?? "";
}

describe("개요 탭 — 2열 · 정적 3카드 흡수", () => {
  it("2열 그리드(1fr + 380px)", () => {
    const ov = overviewBlock(stripComments(read(ORG_DETAIL)));
    expect(ov.length).toBeGreaterThan(0);
    expect(ov).toMatch(/lg:grid-cols-\[1fr_380px\]/);
  });

  it("🛑 구성 요약 카드가 없다 — 3축을 KPI 4카드가 이미 든다 (겹 2 은퇴)", () => {
    /* 🛑 재조준 — **결정 교체** (호영님 판정 2026-08-26 · "겹 2 직접 자르세요").
     *
     * 옛 결정 (P4a): 정적 3카드를 우측 "구성 요약" 이 흡수한다.
     * 실측 (P6 QA): 그 3축(멤버 · 초대 대기 · 승인자)을 **P3 KPI 4카드가 이미 든다.**
     *   개요 탭에서 같은 값이 세로로 인접해 두 번 그려졌다 — P4a 가 요약 바를 걷어내며
     *   한 겹을 줄였지만 자기가 만든 카드와 KPI 사이에 겹이 남아 있었다.
     * 카드 항목 6 대로 "3축을 빼면 무엇이 남는지" 를 먼저 셌다 — **0 이다.**
     *   그 카드는 세 행이 전부였다. 그래서 행 제거가 아니라 카드째 은퇴다.
     *
     * 🔑 2열(1fr_380px)은 P4a 결정이라 **유지**하고 우측을 최근 활동이 승계한다.
     *   빈 우측 컬럼을 남기면 P5 가 목록에서 지운 "0건에도 자리를 차지하는 패널" 이 된다. */
    const ov = overviewBlock(stripComments(read(ORG_DETAIL)));
    expect(ov).not.toMatch(/>구성 요약</);
    /* 역방향 잠금 — 3축이 개요 탭에 다시 그려지면 RED (KPI 는 이 블록 밖이다) */
    expect(ov).not.toMatch(/\{totalMembers\}명/);
    expect(ov).not.toMatch(/\{pendingCount\}명/);
    expect(ov).not.toMatch(/\{approverCount\}명/);
  });

  it("3축은 KPI 4카드가 든다 — 옮긴 게 아니라 이미 거기 있었다", () => {
    /* 은퇴가 안전한 근거. 이 단언이 없으면 "지웠는데 아무 데도 없다" 와 구분이 안 된다. */
    const code = stripComments(read(ORG_DETAIL));
    expect(code).toMatch(/\{totalMembers\}<\/p>|\{totalMembers\}</);
    expect(code).toMatch(/\{pendingCount\}</);
    expect(code).toMatch(/\{approverCount\}</);
  });

  it("우측 컬럼은 최근 활동이 승계한다 (빈 컬럼 0)", () => {
    const ov = overviewBlock(stripComments(read(ORG_DETAIL)));
    expect(ov).toMatch(/lg:grid-cols-\[1fr_380px\][\s\S]*?최근 활동/);
  });

  it("🛑 정적 3카드가 없다 — 구성 요약이 흡수했다", () => {
    const ov = overviewBlock(stripComments(read(ORG_DETAIL)));
    expect(ov).not.toMatch(/멤버 현황/);
    expect(ov).not.toMatch(/초대 상태/);
    expect(ov).not.toMatch(/승인 체계/);
  });

  it("🛑 '관리자 N명' 요약 칩이 없다 (정적 3카드와 함께 소멸)", () => {
    /* 핸드오프 §4 는 멤버 탭 소관으로 적었으나 실물은 개요 탭 "승인 체계" 카드 안이었다.
     * 지시가 가리키는 자리를 먼저 열어봐야 한다는 사례 (P2 노트). */
    expect(stripComments(read(ORG_DETAIL))).not.toMatch(/관리자 \{adminCount\}명/);
  });

  it("🛑 개요에 플랜 카드를 다시 두지 않는다 — P3 KPI 4번째 카드가 이미 흡수했다", () => {
    /* 다시 두면 핸드오프 §2 가 "플랜/좌석 보기" 를 지운 이유(화면 내 정보 중복)를
     * 그대로 재생산한다. */
    const ov = overviewBlock(stripComments(read(ORG_DETAIL)));
    expect(ov).not.toMatch(/플랜 및 좌석 사용률/);
  });
});

describe("바로 처리할 항목 — 결과와 행동을 함께 말한다", () => {
  it("항목마다 결과 설명(consequence)과 액션이 있다 — 초대 항목 축", () => {
    /* 🔑 **재교체** (호영님 명시 승인 2026-08-30) —
     *   "(다) 근거 소멸 — (나)-1b 가 승인 경로를 열었고 3단 실측(3569ede8)으로 도달 확인"
     *
     * 2026-08-26 (다): 승인자 미지정 항목은 다섯 지시형 중 유일하게 배선된 CTA 였으나
     *   끝까지 따라가 APPROVER 를 줘도 승인이 안 열려(TeamRole.ADMIN · prod Team 0)
     *   dead button 이었다 → 은퇴.
     * 2026-08-30 ①c: (나)-1b 가 게이트를 조직 축으로 교체했고 tvkl 3단 실측이
     *   ① 역할 변경 → ② 승인 게이트 통과 → ③ 예산 게이트 도달을 확인했다 → 되살림.
     *   🛑 **actionLabel 금지만 해제한다.** 옛 consequence(`구매 요청이 승인 단계 없이
     *     통과됩니다`)는 사실이 반대여서 금지를 **유지**한다 — 승인권자 0 + in_app_approval
     *     이면 요청은 멈추지 초과 통과하지 않는다.
     * 초대 항목은 두 번 다 무손상. */
    const code = stripComments(read(ORG_DETAIL));
    /* consequence/actionLabel 계약은 살아 있다 — 남은 초대 항목으로 승계 */
    expect(code).toMatch(/consequence: "초대받은 멤버가 아직 참여하지 않았습니다"/);
    expect(code).toMatch(/actionLabel: "초대 확인"/);
    /* 🔑 actionLabel 금지 해제 — ①c 가 조건부로 되살아났다(발화 조건은
     *   organizations-approver-alarm-retired 가 소유한다. 여기서 다시 핀하지 않는다 —
     *   같은 사실을 두 곳이 말하면 그것이 다음 갈라짐의 씨앗이다). */
    expect(code).toMatch(/actionLabel: "승인자 지정"/);
    /* 🛑 옛 문안 금지는 **유지** — 사실이 반대인 문장이다. 새 문구와 별개. */
    expect(code).not.toMatch(/구매 요청이 승인 단계 없이 통과됩니다/);
    expect(overviewBlock(code)).toMatch(/onClick=\{item\.onAction\}/);
  });

  it("처리 항목의 액션은 탭 딥링크로 간다 — 초대 항목 축", () => {
    /* 🔑 **재교체** (호영님 명시 승인 2026-08-30) —
     *   "(다) 근거 소멸 — (나)-1b 가 승인 경로를 열었고 3단 실측(3569ede8)으로 도달 확인"
     *
     * 2026-08-26 (다): 승인자 미지정 항목은 다섯 지시형 중 유일하게 배선된 CTA 였으나
     *   끝까지 따라가 APPROVER 를 줘도 승인이 안 열려(TeamRole.ADMIN · prod Team 0)
     *   dead button 이었다 → 은퇴.
     * 2026-08-30 ①c: (나)-1b 가 게이트를 조직 축으로 교체했고 tvkl 3단 실측이
     *   ① 역할 변경 → ② 승인 게이트 통과 → ③ 예산 게이트 도달을 확인했다 → 되살림.
     *   🛑 **actionLabel 금지만 해제한다.** 옛 consequence(`구매 요청이 승인 단계 없이
     *     통과됩니다`)는 사실이 반대여서 금지를 **유지**한다 — 승인권자 0 + in_app_approval
     *     이면 요청은 멈추지 초과 통과하지 않는다.
     * 초대 항목은 두 번 다 무손상. */
    const code = stripComments(read(ORG_DETAIL));
    expect(code).toMatch(/actionLabel: "초대 확인"[\s\S]{0,120}?setActiveTab\("invites"\)/);
    /* 역방향 잠금 — 멤버 탭 딥링크(역할 열 강조 포함)가 되살아나면 RED */
    expect(code).not.toMatch(/setRoleColumnHint/);
  });

  it("처리 항목 0건이면 그렇다고 말한다 (빈 상태)", () => {
    const ov = overviewBlock(stripComments(read(ORG_DETAIL)));
    expect(ov).toMatch(/actionableItems\.length === 0[\s\S]{0,300}?처리할 항목이 없습니다/);
  });
});

describe("최근 활동 — 빈 상태를 정직하게", () => {
  it("가짜 피드를 만들지 않고 없다는 사실을 적는다", () => {
    /* §11.318 honesty 승계 — org-scoped 활동 엔드포인트가 아직 없다. */
    const ov = overviewBlock(stripComments(read(ORG_DETAIL)));
    expect(ov).toMatch(/아직 기록된 활동이 없습니다/);
  });

  it("전체 활동 로그 딥링크가 활동 탭으로 간다", () => {
    const ov = overviewBlock(stripComments(read(ORG_DETAIL)));
    expect(ov).toMatch(/setActiveTab\("activity"\)[\s\S]{0,200}?전체 활동 로그/);
  });
});
