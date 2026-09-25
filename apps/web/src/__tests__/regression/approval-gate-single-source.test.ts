/**
 * §approval-gate-single-source (2026-09-25 · 호영님 판정)
 *
 * **API 가 결재를 받아주는 조건과 화면이 결재를 보여주는 조건은 같은 함수에서 나와야 한다.**
 *
 * ── 왜 요금제로 가리지 않는가 (호영님) ──
 * 「요금제로 가리기」 는 어떤 요금제가 결재를 켠다는 전제 위에 있다. 오늘 그런 요금제가 없다:
 *   FREE = approvalPolicy "none" · 유료는 결제 게이트가 닫힘 ·
 *   결제해도 webhook 은 Workspace.plan 에 "TEAM" 만 씀 · 거기에 ADMIN 0명이면 또 400.
 * 결재는 FREE 에서만 막힌 게 아니라 **모든 사용자에게** 막혀 있다.
 * 요금제 라벨로 가리면 그 라벨이 또 하나의 약속이 된다.
 *
 * ── 실측으로 드러난 드리프트 ──
 * `api/quotes/[id]` 는 **정책만** 보고 canRequestApproval 을 내주고 있었다. 라우트는 결재자 부재로도
 * 400 을 낸다 → prod(ADMIN 0)에서 **화면이 CTA 를 보여주고 누르면 400** 이 나는 자리였다.
 * (§화면이 보여주는 수와 게이트가 판정하는 수는 같은 함수에서 나와야 한다 — 같은 형태의 재발.)
 *
 * ── 이 파일이 지키는 명제 ──
 *   ① 판정이 한 모듈에 있고, 두 술어의 합성이다
 *   ② 라우트가 인라인으로 다시 판정하지 않는다
 *   ③ 화면 축(견적 상세 API)이 같은 함수를 부른다
 *   ④ 퍼블릭 표면에 결재 약속이 없다 (방문자는 판정 함수를 부를 수 없다)
 *   ⑤ 판정 모듈이 클라이언트에서도 쓸 수 있다 (Prisma 를 끌고 들어가지 않는다)
 *
 * ── 자기 한계 ──
 *   1. **금액 구간은 보지 않는다.** 라우트의 결재자 선정은 금액 tier 로 후보를 좁히고 high tier 에서
 *      self_admin 을 막는다. 화면은 금액을 모르는 자리(퍼널·지원센터)에서도 판정해야 하므로
 *      「한 명이라도 있는가」 만 본다 → 워크스페이스 ADMIN 이 본인뿐이고 금액이 high tier 면
 *      화면은 보여주고 라우트는 400 이다. 좁히려면 화면에 금액을 들려보내야 한다.
 *   ~~2. 로그인 뒤 표면 배선~~ → **닫힘**(아래 ⑥⑦⑧⑨). 퍼널·모바일·지원센터 전부 판정 뒤에 있다.
 *   3. 금액 구간(한계 1)은 CLAUDE.md §유료 결제 오픈 전 게이트 「의존 항목」 ③ 에 걸었다 —
 *      닫는 방법(같은 함수의 두 호출 방식)까지 적어 뒀다.
 *   3. 소스 문자열만 본다. 런타임 응답은 보지 않는다.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const SRC = join(__dirname, "..", "..");
const raw = (rel: string) => readFileSync(join(SRC, rel), "utf8");
const code = (rel: string) => stripComments(raw(rel));

const PURE = "lib/approval/approval-capability.ts";
const SERVER = "lib/approval/approval-capability.server.ts";
const ROUTE =
  "app/api/work-queue/purchase-conversion/[quoteId]/request-approval/route.ts";
const DETAIL = "app/api/quotes/[id]/route.ts";
const LANDING = "app/_components/bioinsight-hero-section.tsx";
const INTRO = "app/intro/page.tsx";
const FUNNEL = "components/quotes/quote-funnel.tsx";
const MOBILE = "components/quotes/mobile-quotes-view.tsx";
const SUPPORT = "app/dashboard/support-center/page.tsx";

describe("§approval-gate-single-source · 판정은 한 함수에서 나온다", () => {
  it("① 판정 모듈이 라우트의 400 두 개를 그대로 담는다", () => {
    const src = code(PURE);
    expect(src).toMatch(/export function isApprovalPolicyEnabled\(/);
    expect(src).toMatch(/export function hasApproverCandidate\(/);
    expect(src).toMatch(/export function approvalBlockReason\(/);
    expect(src).toMatch(/export function canRequestApproval\(/);
    // 사유 집합을 리터럴로 고정한다 — 개수가 아니라 이름을 핀한다(§개수는 명제가 아니다).
    /* 끝을 묶는다 — 세미콜론이 없으면 멤버를 **더 붙여도** 부분 일치로 통과한다(프로브 ①-2 가 잡았다). */
    expect(src).toMatch(
      /ApprovalBlockReason = "policy_not_enabled" \| "no_approver";/,
    );
    // 합성이 두 술어를 **둘 다** 거친다. 하나가 빠지면 드리프트가 되살아난다.
    expect(src).toMatch(
      /approvalBlockReason\([\s\S]{0,400}isApprovalPolicyEnabled\([\s\S]{0,200}hasApproverCandidate\(/,
    );
    // 문구도 사유와 같은 자리에 둔다 — 갈리면 사용자가 다른 이유를 읽는다.
    expect(src).toMatch(/APPROVAL_BLOCK_MESSAGE[\s\S]{0,400}policy_not_enabled:/);
    expect(src).toMatch(/APPROVAL_BLOCK_MESSAGE[\s\S]{0,600}no_approver:/);
  });

  it("② 라우트가 인라인으로 다시 판정하지 않는다", () => {
    const src = code(ROUTE);
    // 구 판본: 정책 문자열을 라우트에서 직접 비교했다.
    expect(src).not.toMatch(/approvalPolicy !== "in_app_approval"/);
    expect(src).not.toMatch(/resolveApprovalPolicyForPlan\(/);
    // 새 판본: 공용 술어 + 공용 문구.
    expect(src).toMatch(/isApprovalPolicyEnabled\(/);
    expect(src).toMatch(/hasApproverCandidate\(/);
    expect(src).toMatch(/APPROVAL_BLOCK_MESSAGE\.policy_not_enabled/);
    expect(src).toMatch(/APPROVAL_BLOCK_MESSAGE\.no_approver/);
    // 400 두 개의 error 코드는 계약이다(소비자가 분기한다).
    expect(src).toMatch(/error: "APPROVAL_POLICY_NOT_ENABLED"/);
    expect(src).toMatch(/error: "APPROVER_NOT_FOUND"/);
  });

  it("③ 화면 축이 같은 함수를 부른다 · 요금제를 직접 읽지 않는다", () => {
    const src = code(DETAIL);
    /* 구 판본은 정책만 보고 CTA 를 켰다 — 결재자 0명이면 눌러야 400 이 드러났다. */
    expect(src).not.toMatch(/resolveApprovalPolicyForPlan\(/);
    expect(src).not.toMatch(/approvalPolicy === "in_app_approval"/);
    expect(src).toMatch(/resolveApprovalCapability\(session\.user\.id\)/);
    expect(src).toMatch(/canRequestApproval: canRequestApprovalFlag/);
    // 서버 축이 두 입력을 다 모은다 — 하나만 모으면 ③이 ②와 갈린다.
    const server = code(SERVER);
    expect(server).toMatch(/countApproverCandidates\(/);
    expect(server).toMatch(/workspaceMember\.count\([\s\S]{0,120}role: "ADMIN"/);
    expect(server).toMatch(
      /organizationMember\.count\([\s\S]{0,160}role: \{ in: \["OWNER", "ADMIN"\] \}/,
    );
    expect(server).toMatch(/canRequestApproval\(input\)/);
    expect(server).toMatch(/approvalBlockReason\(input\)/);
  });

  it("④ 퍼블릭 표면에 결재 약속이 없다", () => {
    /* 방문자는 워크스페이스가 없어 판정 함수를 부를 수 없다 → 가릴 수가 없으므로 지운다.
       복원 조건은 CLAUDE.md §유료 결제 오픈 전 게이트 의 의존 항목에 걸려 있다. */
    const landing = code(LANDING);
    expect(landing).not.toMatch(/label: "결재"/);
    expect(landing).not.toMatch(/승인 라인/);

    const intro = code(INTRO);
    expect(intro).not.toMatch(/승인/);
    // 지운 자리에 참인 것이 들어갔는지까지 본다 — 「없는 척」 이 되면 안 된다.
    expect(landing).toMatch(/label: "회신 추적"/);
    expect(intro).toMatch(/title: "역할과 권한"/);
  });

  it("⑤ 판정 모듈이 Prisma 를 끌고 들어가지 않는다 (클라이언트 사용 가능)", () => {
    /* "use client" 화면이 판정을 직접 쓰려면 이 파일이 db 를 import 하면 안 된다.
       서버 축은 별도 파일(.server.ts)이 맡는다. */
    const src = raw(PURE);
    expect(src).not.toMatch(/from "@\/lib\/db"/);
    expect(src).not.toMatch(/@prisma\/client/);
    expect(raw(SERVER)).toMatch(/from "@\/lib\/db"/);
  });

  it("⑥ 퍼널 s4 가 결재 이름을 판정 뒤에 둔다", () => {
    const src = code(FUNNEL);
    expect(src).toMatch(/key: "s4", label: "선정 대기", sub: "비교 후 공급사 선정"/);
    expect(src).toMatch(/S4_APPROVAL_LABEL = { label: "승인\/예외", sub: "선정·승인 대기" }/);
    expect(src).toMatch(/approvalEnabled\?: boolean;/);
    expect(src).toMatch(/s\.key === "s4" && approvalEnabled/);
    expect(src).not.toMatch(/in_app_approval/);
    expect(src).not.toMatch(/resolveApprovalPolicyForPlan/);
  });

  it("⑦ 모바일 s4 는 결재가 닫혀 있으면 「승인」 버튼을 렌더하지 않는다", () => {
    const src = code(MOBILE);
    expect(src).toMatch(/vm\.stage === "s4" && !approvalEnabled \? null :/);
    expect(src).toMatch(/s4: {[^}]{0,200}pill: "선정 대기"/);
    expect(src).not.toMatch(/pill: "승인 대기"/);
    expect(src).not.toMatch(/section: "승인 · 입고 준비"/);
    expect(src).not.toMatch(/amountLabel: "발주 금액"/);
    expect(src).toMatch(/amountLabel: "구매 금액"/);
  });

  /* 🛑 은퇴 §funnel-s5-removed (2026-09-25 · 호영님 판정) — ⑧ 「퍼널 s5 가 지운 기능의 이름을 쓰지 않는다」.
   *   그 명제는 **s5 단계가 있다** 를 전제로 했다. 호영님이 관리자 주문 생성까지 지우기로 판정해
   *   PURCHASED 생산자가 0이 됐고, 단계 자체가 사라졌다.
   *   살아 있는 명제(퍼널에 발주 이름 0)는 새 이름으로 옮겼다 —
   *   regression/purchasing-residue-removed.test.ts ④ 가 s5 부재와 플래그 게이트 부재를 함께 든다. */

  it("⑨ 지원센터 결재 카드가 판정 뒤에 있다", () => {
    const src = code(SUPPORT);
    /* 지우지 않았다 — 도달 불가인 기능을 **설명**해 두면 약속이 되므로 판정 뒤에 둔다.
       결재가 켜지는 날 저절로 보인다. 목록은 리터럴로 고정한다(개수가 아니라 이름을 핀한다). */
    expect(src).toMatch(/APPROVAL_ONLY_GUIDE_IDS = new Set\(\["org-2", "role-2"\]\)/);
    expect(src).toMatch(/function visibleGuides\(approvalEnabled: boolean\): GuideEntry\[\]/);
    // 껍데기만 두고 본문을 비우면 전량이 새어 나간다(프로브 ⑨-2 가 잡았다).
    expect(src).toMatch(/return GUIDE_ENTRIES\.filter\(\(e\) => !APPROVAL_ONLY_GUIDE_IDS\.has\(e\.id\)\)/);
    expect(src).toMatch(/useApprovalEnabled\(/);
    expect(src).toMatch(/fetch\(\"\/api\/approval\/capability\"\)/);
    // 소비처가 판정을 거치지 않고 원본 배열을 직접 필터하면 카드가 새어 나온다.
    expect(src).not.toMatch(/GUIDE_ENTRIES\.filter\(\(e\) => e\.category/);
    expect(src).not.toMatch(/const guideHits = GUIDE_ENTRIES/);
    // 결재가 켜졌을 때 보여줄 내용은 **지우지 않았다**(「없는 척」 금지).
    expect(src).toMatch(/결재 요청을 승인·반려합니다/);
    expect(src).toMatch(/Approver의 승인을 거치도록/);
    // 판정과 무관한 자리의 결재 약속은 오늘 참인 것으로.
    expect(src).not.toMatch(/nextAction: "결재 요청"/);
    expect(src).not.toMatch(/승인 한도는 어디서 바꾸나요/);
  });
});
