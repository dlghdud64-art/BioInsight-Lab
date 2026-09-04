/**
 * §invite-flow Phase 3-3 — 수락 화면 계약 (`/invite/[token]`)
 *
 * 판정 2(조용한 실패 금지) 설계 기준을 화면에서 집행한다.
 * 🔑 그리고 3-2 후속의 `alreadyMember: true` 가 **화면에서도 성공으로 보이는지** —
 *    200 인데 실패로 그리면 서버만 고친 셈이다(Cowork QA 지시).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "../_helpers/em-dash-scan";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const PAGE = readFileSync(
  join(WEB_ROOT, "src", "app", "invite", "[token]", "page.tsx"),
  "utf8",
);
const CODE = stripComments(PAGE);

describe("§invite-flow Phase 3-3 — 수락 화면", () => {
  it("🔑 alreadyMember 는 **성공**으로 그린다 (200 을 실패로 렌더 0)", () => {
    /* 두 번 눌러 P2002 로 갈린 경합이 이 경로로 돌아온다(§3-2 후속).
     * 성공 분기 안에서 `alreadyMember` 를 읽어야 한다 — 실패 분기로 새면 서버만 고친 셈이다. */
    expect(CODE).toMatch(
      /if \(res\.ok && [\s\S]{0,80}?\.ok\)[\s\S]{0,400}?alreadyMember: Boolean\(/,
    );
    // 성공 화면의 두 문구가 모두 성공 톤이다
    expect(CODE).toMatch(/result\?\.ok[\s\S]{0,600}?tone="ok"/);
    expect(PAGE).toMatch(/이미 이 워크스페이스의 멤버입니다/);
    expect(PAGE).toMatch(/워크스페이스에 참여했습니다/);
    // 🛑 alreadyMember 가 실패 분기에서 쓰이면 안 된다
    const failBlock = CODE.slice(CODE.indexOf("if (result && !result.ok)"));
    expect(failBlock).not.toMatch(/alreadyMember/);
  });

  it("실패를 토스트로 흘려보내지 않는다 (화면에 남는 영역)", () => {
    /* 여기는 외부 링크 착지점이다 — 토스트가 사라지면 사용자는 단서 없는 흰 화면을 본다. */
    expect(CODE).not.toMatch(/useToast|toast\(/);
    expect(CODE).toMatch(/function Notice\(/);
    expect(CODE).toMatch(/setResult\(\{\s*ok: false/);
  });

  it("문구가 다음 행동까지 말한다", () => {
    expect(PAGE).toMatch(/초대한 분에게 새 링크를 요청해 주세요/);
    expect(PAGE).toMatch(/초대받은 계정으로 로그인해 주세요/);
    /* 좌석 초과는 **서버 문구 + 서버가 준 플랜 경로**를 그대로 쓴다(생성·수락 공용 코드).
     * 🛑 `toMatch(/upgradeHref/)` 로는 부족했다 — `upgradeHref: undefined` 로 배선을 끊어도
     *    **필드명이 남아 통과**했다(프로브 N4 실측, 4원칙 ④ 대체 매칭 계열).
     *    토큰이 아니라 **값이 서버에서 흘러오는지**를 본다. */
    expect(CODE).toMatch(/upgradeHref: d\.upgradeHref/);
    expect(CODE).toMatch(/result\.upgradeHref[\s\S]{0,200}?href=\{result\.upgradeHref\}/);
    expect(PAGE).toMatch(/플랜 확인하기/);
    // 문구도 서버 것을 쓴다 (화면이 자기 문구를 새로 지으면 생성 쪽과 갈린다)
    expect(CODE).toMatch(/body: d\.error \?\?/);
  });

  it("🔑 로그인 왕복에서 토큰을 잃지 않는다 (callbackUrl 복귀)", () => {
    /* 이 화면엔 입력 폼이 없다. "입력 보존" 과 같은 자리의 위험은 **토큰 유실**이다. */
    expect(CODE).toMatch(
      /callbackUrl=\$\{encodeURIComponent\(`\/invite\/\$\{token\}`\)\}/,
    );
    // 401 도 같은 경로로 되돌린다 (조용히 실패하지 않는다)
    expect(CODE).toMatch(/res\.status === 401[\s\S]{0,120}?signinHref/);
  });

  it("상태 4종을 각각 다르게 말한다 (뭉개기 0)", () => {
    expect(PAGE).toMatch(/취소된 초대입니다/);
    expect(PAGE).toMatch(/만료된 초대입니다/);
    expect(PAGE).toMatch(/이미 사용된 초대입니다/);
    expect(CODE).toMatch(/preview\.status !== "valid"/);
  });

  it("미리보기가 서버가 준 최소 필드만 읽는다 (PII 축 유지)", () => {
    /* GET 이 안 주는 것을 화면이 요구하면 다음 사람이 서버에 필드를 더한다. */
    expect(CODE).not.toMatch(/createdBy|inviterName|inviterEmail/);
    expect(CODE).not.toMatch(/preview\.email\b/);
    expect(CODE).toMatch(/preview\.emailLocked/);
  });
});
