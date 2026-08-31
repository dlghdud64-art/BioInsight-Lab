/**
 * §invite-dead-end a — 조직 상세 초대 진입점 정직화 sentinel (호영님 승인 2026-08-31)
 *
 * 잠그는 것: **끝이 끊긴 초대 버튼을 활성으로 두지 않는다.**
 *
 * 실측 (2026-08-31 · 코드 + prod www.labaxis.co.kr):
 *   ① 초대 모달 → POST /api/organizations/[id]/members — 그 라우트에 POST 핸들러 0
 *      (GET·PATCH·DELETE 만). "초대 메일 발송" = dead button.
 *   ② 초대 재발송 → /members/resend-invite — 라우트 자체 0.
 *   ③ 실제 초대 API(/invites)는 토큰만 만들고 수락 화면 /invite/[token] 이 없다(prod 404).
 *      §onboarding-blocker #7 의도된 미완 — invite-accept-pairing 이 "수락 화면 없는 동안
 *      초대 UI 렌더 금지" 를 settings/workspace 에 강제하는데, 조직 상세는 그 짝에서 빠져 있었다.
 *
 * 처방 (a): 진입점 3곳 disabled + 사유 1줄. 모달·mutation 보존(b 트랙 복원용).
 * b 트랙(수락 화면 + OrganizationMember 생성 + 좌석 게이트)이 서면 INVITE_AVAILABLE 을
 * 올리고 이 파일을 승계한다 — I0 이 그 순간을 알린다.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const ORG_DETAIL = "src/app/dashboard/organizations/[id]/page.tsx";
const MEMBERS_ROUTE = "src/app/api/organizations/[id]/members/route.ts";
const ACCEPT_PAGES = ["src/app/invite/[token]/page.tsx", "src/app/invite/[token]/page.ts"];
const acceptScreenExists = ACCEPT_PAGES.some((p) => existsSync(join(REPO_ROOT, p)));

describe("I0 — 승계 신호: 수락 화면이 생기면 이 파일을 승계해야 한다", () => {
  it("수락 화면이 없는 동안 INVITE_AVAILABLE 은 false 다 (생기면 이 단언이 RED 로 알린다)", () => {
    const code = stripComments(read(ORG_DETAIL));
    if (acceptScreenExists) {
      /* 수락 화면이 생겼다 — b 트랙이 섰으니 플래그를 올리고 이 파일을 승계할 때다. */
      expect(code).toMatch(/const INVITE_AVAILABLE = true;/);
    } else {
      expect(code).toMatch(/const INVITE_AVAILABLE = false;/);
    }
  });
});

describe("진입점 3곳 — disabled + 사유", () => {
  it("헤더 멤버 초대 · 멤버 탭 첫 멤버 초대하기 · 승인·초대 탭 새 초대 — 셋 다 플래그를 본다", () => {
    const code = stripComments(read(ORG_DETAIL));
    const gated = code.match(/disabled=\{!INVITE_AVAILABLE\}/g) ?? [];
    expect(gated.length).toBe(3);
    /* 각 진입점 라벨이 플래그 뒤 300자 안에 있다 — 무관한 버튼에 걸린 게 아니다 */
    expect(code).toMatch(/disabled=\{!INVITE_AVAILABLE\}[\s\S]{0,450}?멤버 초대/);
    expect(code).toMatch(/disabled=\{!INVITE_AVAILABLE\}[\s\S]{0,450}?첫 멤버 초대하기/);
    expect(code).toMatch(/disabled=\{!INVITE_AVAILABLE\}[\s\S]{0,450}?새 초대/);
  });

  it("사유가 화면에 보인다 — 툴팁만이 아니라 텍스트로 (터치 환경)", () => {
    const code = stripComments(read(ORG_DETAIL));
    expect(code).toMatch(/const INVITE_UNAVAILABLE_REASON = "초대 수락 화면 준비 중/);
    const shown = code.match(/\{INVITE_UNAVAILABLE_REASON\}<\//g) ?? [];
    expect(shown.length).toBeGreaterThanOrEqual(3);
  });

  it("모달·mutation 은 보존된다 — 지운 게 아니라 잠근 것이다 (b 복원용)", () => {
    const code = stripComments(read(ORG_DETAIL));
    expect(code).toMatch(/const inviteMemberMutation = useMutation/);
    expect(code).toMatch(/<DialogTitle className="text-slate-900">멤버 초대<\/DialogTitle>/);
  });
});

describe("근거 실재 — 처방의 전제가 무너지면 여기서 소리가 난다", () => {
  it("members 라우트에 POST 핸들러가 없다 (생기면 a 의 근거 ①이 사라진다 → 재판정)", () => {
    const route = stripComments(read(MEMBERS_ROUTE));
    expect(route).not.toMatch(/export async function POST/);
  });
  it("resend-invite 라우트가 없다", () => {
    expect(existsSync(join(REPO_ROOT, "src/app/api/organizations/[id]/members/resend-invite"))).toBe(false);
  });
});
