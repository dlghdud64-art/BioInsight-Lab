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

/* ═══════════════════════════════════════════════════════════════════════
 * 🔑 결정 교체 (호영님 명시 승인 2026-08-30) — **(다) 근거 소멸**
 *   "(다) 근거 소멸 — (나)-1b 가 승인 경로를 열었고 3단 실측(3569ede8)으로 도달 확인"
 *
 *   (다)가 지시형 5곳을 내린 근거는 "APPROVER 를 줘도 승인이 안 열린다" 였다
 *   (승인 라우트가 TeamRole.ADMIN · prod Team 0). (나)-1b 가 조직 축으로 교체했고
 *   tvkl 3단 실측이 ① 역할 변경 → ② 승인 게이트 통과 → ③ 예산 게이트 도달을 확인했다.
 *
 *   🛑 되살림은 **선별**이다 — 다섯 중 ①c 하나만. 기준은 "사실이 안 보이는가" 가
 *     아니라 **"행동이 없는가"** 다. (나)-2 가 목록·상세에 사실 표시를 채웠으므로
 *     남은 결핍은 그 자리에서 고치러 가는 **경로** 하나뿐이었다.
 *     기각 4: ①d 배지(KPI 수+톤과 중복) · ①a/①b 목록 문구((나)-2 3축이 사실을 말함) ·
 *     ①e 문구(현재 사실 표기가 있고 지정 수단은 ①c 가 든다).
 *
 *   🛑 그리고 되살린 지시는 **조건을 갖는다.** (다)를 만든 원인이 "조건 없이 뜨는
 *     지시" 였다. 실측이 문구보다 큰 사실을 줬다 — 승인권자 0이 항상 문제가 아니다:
 *       approvalPolicy = "none"(FREE·Basic)  승인 단계 자체가 없어 요청이 안 멈춘다
 *       approvalPolicy = in_app_approval     승인권자 0이면 요청이 PENDING 에서 멈춘다
 *     prod T1 이 전자다. 거기 띄우면 그것도 틀린 경보다.
 * ═══════════════════════════════════════════════════════════════════════ */

describe("지시형 — 기각 4곳 부재 + ①c 조건부 존재 (되살림 1 · 기각 4)", () => {
  it("목록 — 상태 라인·경고에서 '승인권자 미지정' 이 없다 (2곳)", () => {
    const code = stripComments(read(LIST));
    expect(code).not.toMatch(/승인권자 미지정/);
    /* 파생 자체가 사라졌는지 — 문구만 바꾸고 분기를 남기면 다시 붙는다 */
    expect(code).not.toMatch(/org\.adminCount === 0/);
  });

  it("✅ ①c 되살림 — '승인자 미지정' 처리 항목이 **조건부로** 존재한다", () => {
    /* 다섯 중 이것만 성격이 달랐다: 문구가 아니라 배선된 CTA 였고, 그 끝이
     * 비어 있어서 dead button 이었다. 이제 끝이 실재한다(3단 실측). */
    const code = stripComments(read(DETAIL));
    expect(code).toMatch(/label: "승인자 미지정"/);
    expect(code).toMatch(/actionLabel: "승인자 지정"/);
    /* CTA 의 끝 — 멤버 탭으로 간다. 거기서 역할을 APPROVER 로 바꿀 수 있다. */
    expect(code).toMatch(/actionLabel: "승인자 지정"[\s\S]{0,80}?setActiveTab\("members"\)/);
  });

  it("🛑 발화 조건 — approvalPolicy ≠ none && approverCount === 0 (조건을 잃으면 RED)", () => {
    /* 🔑 (다)를 만든 원인이 **조건 없이 뜨는 지시**였다. 되살린 지시가 조건을 잃으면
     * 같은 결함이 돌아온다 — 그 분기 자체를 잠근다(호영님 지시 2026-08-30).
     *   approvalPolicy = "none" 인 조직(FREE·Basic)에서는 승인 단계 자체가 없어
     *   "요청이 멈춥니다" 가 거짓이 된다. prod T1 이 정확히 그 상태다. */
    const code = stripComments(read(DETAIL));
    expect(code).toMatch(
      /const approvalPolicy = resolveApprovalPolicyForPlan\(\(organization as any\)\.plan\);/
    );
    expect(code).toMatch(
      /if \(approvalPolicy !== "none" && approverCount === 0\) actionableItems\.push\(\{/
    );
    expect(code).toMatch(
      /import \{ resolveApprovalPolicyForPlan \} from "@\/lib\/billing\/plan-descriptor"/
    );
  });

  it("🛑 옛 consequence 는 되살리지 않는다 — 사실이 반대였다", () => {
    /* `구매 요청이 승인 단계 없이 통과됩니다` 는 틀린 문안이다. 승인권자가 0이고
     * approvalPolicy 가 in_app_approval 이면 요청은 **멈춘다** — 통과하지 않는다.
     * 새 문구로 되살리고 옛 문구 금지는 유지한다(호영님 판정). */
    const code = stripComments(read(DETAIL));
    expect(code).not.toMatch(/구매 요청이 승인 단계 없이 통과됩니다/);
    expect(code).toMatch(/consequence: "승인할 사람이 없어 요청이 멈춥니다"/);
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
    /* 🔑 승계 (§approver-axis (나)-2 · 2026-08-30). 잠그는 결정은 "카운트가 남아 있다"
     * 이지 합산식이 아니다. approverCount 가 A축으로 넓어져 adminCount 를 흡수했으므로
     * 더할 것이 없다 — `approverCount + adminCount` 는 이제 **중복 계수**다. */
    expect(stripComments(read(DETAIL))).toMatch(/승인 권한 보유자 \(\{approverCount\}\)/);
    expect(stripComments(read(DETAIL))).not.toMatch(/approverCount \+ adminCount/);
  });

  it("목록 — 초대 대기 상태 라인이 남아 있다 (승인권자 분기만 걷어냈다)", () => {
    const code = stripComments(read(LIST));
    expect(code).toMatch(/초대 대기 \$\{org\.pendingCount\}명/);
  });
});

describe("✅ 축 해결 — 통일 단언 (직전 판본의 '미해결' 을 승계 교체)", () => {
  /* 🔑 직전 판본은 "목록은 adminCount(ADMIN||OWNER) · 상세는 approverCount(APPROVER) 로
   *   여전히 갈린다" 를 **긍정으로** 잠그고 있었다. 설계된 자기소멸 경로 그대로
   *   (나)-2 가 축을 모으자 RED 가 떴고, 여기서 통일 단언으로 교체한다.
   *   미해결을 침묵이 아니라 단언으로 들었기 때문에 **닫히는 순간 소리가 났다.**
   *
   * 🛑 은퇴만 하면 새 결정이 무잠금이다 — 역방향(사본 부활)을 같은 자리에 남긴다. */

  it("정본이 하나다 — 목록·상세·CTA 가 같은 모듈을 쓴다", () => {
    const list = stripComments(read(LIST));
    const detail = stripComments(read(DETAIL));
    const cta = stripComments(read("src/lib/operations/cta-helpers.ts"));
    for (const src of [list, detail, cta]) {
      expect(src).toMatch(/from "@\/lib\/permissions\/org-approver-roles"/);
    }
    expect(list).toMatch(/approverCount: countOrgApprovers\(members\)/);
    expect(detail).toMatch(/const approverCount = countOrgApprovers\(members\)/);
    expect(cta).toMatch(/return isOrgApprover\(userRole\)/);
  });

  it("정본 내용 — APPROVER · ADMIN · OWNER (client-safe 모듈)", () => {
    const canon = stripComments(read("src/lib/permissions/org-approver-roles.ts"));
    expect(canon).toMatch(
      /export const ORG_APPROVER_ROLES = \["APPROVER", "ADMIN", "OWNER"\] as const;/
    );
    expect(canon).toMatch(/export function isOrgApprover/);
    expect(canon).toMatch(/export function countOrgApprovers/);
    /* 🛑 Prisma 를 끌어오면 "use client" 화면이 번들에 DB 클라이언트를 싣는다 */
    expect(canon).not.toMatch(/@\/lib\/db/);
    expect(canon).not.toMatch(/PrismaClient/);
  });

  it("🛑 사본 부활 잠금 — 승인권 비교를 인라인으로 되살리면 RED", () => {
    /* 통일 전 실측 정의 5개의 재발을 막는다. 판정/계수는 정본 함수로만 한다.
     *
     * 🛑 창을 **비교식**으로 좁힌다. 처음엔 `=== "ADMIN" || role === "OWNER"` 도 금지로
     *   걸었는데, 상세 화면의 `isAdminRole`(멤버 목록을 admin/member 표시로 접는 UI 축)이
     *   걸렸다 — 그것은 승인권 판정이 아니다. 결정은 "승인권 비교를 인라인으로 두지
     *   않는다" 이지 "파일에 ADMIN·OWNER 문자열이 없다" 가 아니다.
     *   (§4-a-2 — 부정 단언이 결정보다 넓으면 멀쩡한 코드를 잠근다. 오늘 3회차.)
     *
     * 🔑 `role: "APPROVER"` 같은 **객체 리터럴은 허용**한다 — 역할 선택기·권한표가
     *   그 문자열을 정당하게 쓴다. 금지하는 것은 `role === "APPROVER"` 비교뿐이다. */
    for (const rel of [
      "src/app/dashboard/organizations/page.tsx",
      "src/app/dashboard/organizations/[id]/page.tsx",
      "src/lib/operations/cta-helpers.ts",
      "src/app/api/organizations/route.ts",
    ]) {
      const src = stripComments(read(rel));
      expect(src).not.toMatch(/role === "APPROVER"/);
    }
  });

  it("승인 라우트도 같은 축이다 — 표면만 통일하면 절반이다", () => {
    /* (다) 시점의 결함은 "APPROVER 를 줘도 승인이 안 열린다" 였다.
     * 표면 5정의를 모아도 서버가 TeamRole 을 보면 그대로다 — 1b 가 그것을 옮겼고
     * 여기서 함께 잠근다. 둘이 갈라지면 다시 실행 불가능한 표시가 된다. */
    const approve = stripComments(read("src/app/api/request/[id]/approve/route.ts"));
    expect(approve).toMatch(/isOrgApprover\(actorOrgMembership\?\.role\)/);
    expect(approve).not.toMatch(/TeamRole/);
  });
});
