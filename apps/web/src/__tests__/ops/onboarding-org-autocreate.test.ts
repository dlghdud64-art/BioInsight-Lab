/**
 * §onboarding-blocker 3a — 가입 시 조직 자동 생성 + 임시 이름 확인
 *
 * 배경 (실측 2026-08-12):
 *   가입 직후 목적지가 **퍼블릭 랜딩 `/`** 이고 조직 생성 유도가 **없었다**.
 *   조직이 0 이면 권한 공집합 · 멤버십 요구 라우트 37개 차단 ·
 *   **workspace 생성 경로가 조직 생성 하나뿐**이라 workspaceId 요구 라우트 17개가 빈다.
 *
 * 호영님 결정: **자동 생성 + 즉시 이름 확인**.
 *   자동 생성만 하고 이름을 지어내면 §fabricated-data-surface 에 닿고,
 *   유도 화면 단독은 "조직" 개념 앞에서 이탈한다. 제안하고 확정하게 한다.
 *
 * 계약:
 *   N1. 가입 경로에서 **조직 생성이 호출**된다 (미호출 = RED)
 *   N2. 그 호출이 `createOrganization` 을 탄다 — 별도 코드면 생성자가 ADMIN 이 되고
 *       (Phase 2 무효화) workspace 도 빠진다
 *   N3. 기본 조직명이 **임시 표시와 함께** 렌더된다 (§fabricated-data-surface 방어선)
 *   N4. 회사명을 도메인에서 추측하지 않는다
 *   N5. 로그인 기본 목적지가 퍼블릭 랜딩이 아니다
 *   N6. 프롬프트가 실제로 **도달**한다 (dashboard layout 에 마운트 — "도달하는가")
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(WEB_ROOT, rel), "utf8");
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

const AUTH = read("src/auth.ts");
const AUTH_CODE = stripComments(AUTH);
const NAME_LIB = stripComments(read("src/lib/organization/default-name.ts"));
const PROMPT = read("src/components/onboarding/organization-name-prompt.tsx");
const PROMPT_CODE = stripComments(PROMPT);
const SIGNIN_CODE = stripComments(read("src/app/auth/signin/page.tsx"));
const DASH_LAYOUT_CODE = stripComments(read("src/app/dashboard/layout.tsx"));

describe("§3a N0 — 수집이 실제로 동작한다", () => {
  it("대상 소스가 모두 읽힌다", () => {
    for (const [label, src] of [
      ["auth", AUTH_CODE],
      ["name-lib", NAME_LIB],
      ["prompt", PROMPT_CODE],
      ["signin", SIGNIN_CODE],
      ["dashboard-layout", DASH_LAYOUT_CODE],
    ] as const) {
      expect(src.length, label).toBeGreaterThan(200);
    }
  });
});

describe("§3a N1·N2 — 가입 경로에서 createOrganization 이 호출된다", () => {
  it("auth.ts 가 createOrganization 을 import 한다", () => {
    expect(AUTH_CODE).toMatch(
      /import \{ createOrganization \} from "@\/lib\/api\/organizations"/,
    );
  });

  it("신규 사용자 생성 직후 호출된다 (db.user.create 이후 근접)", () => {
    expect(AUTH_CODE).toMatch(
      /db\.user\.create\([\s\S]{0,900}?createOrganization\(\s*newUser\.id/,
    );
  });

  it("별도 조직 생성 코드를 만들지 않는다 (Phase 2 우회 차단)", () => {
    // auth.ts 안에서 직접 organization/organizationMember 를 만들면
    // 생성자가 다시 ADMIN 이 되고 workspace 도 빠진다.
    expect(AUTH_CODE).not.toMatch(/db\.organization\.create/);
    expect(AUTH_CODE).not.toMatch(/db\.organizationMember\.(create|upsert)/);
  });

  it("조직 생성 실패가 로그인을 막지 않되 침묵하지도 않는다", () => {
    expect(AUTH_CODE).toMatch(/catch \(orgErr\)[\s\S]{0,200}console\.error/);
  });
});

describe("§3a N3 — 임시 이름이 임시라고 표시된다", () => {
  it("다이얼로그가 '임시' 를 명시한다", () => {
    expect(PROMPT_CODE).toMatch(/임시로 지어둔 값/);
  });

  it("건너뛰면 배너가 임시 상태를 계속 알린다", () => {
    expect(PROMPT_CODE).toMatch(/조직 이름이 <strong>임시<\/strong>입니다/);
    expect(PROMPT_CODE).toMatch(/조직 이름 설정/);
  });

  it("임시 판정은 파생이다 (스키마 플래그 아님 — 3a 는 스키마 무관)", () => {
    expect(PROMPT_CODE).toMatch(/isProvisionalOrgName/);
    expect(NAME_LIB).toMatch(/export function isProvisionalOrgName/);
  });

  /** 승계 — 가드가 2줄로 분리됐다(N3b 조직 0 모드 추가). 계약은 동일: 미인증·해당없음이면 렌더 0. */
  it("확정 전에는 프롬프트가 렌더되고, 확정되면 null 이다(상시 노출 0)", () => {
    expect(PROMPT_CODE).toMatch(/if \(status !== "authenticated"\) return null/);
  });

  it("저장 실패를 성공처럼 보이지 않는다", () => {
    expect(PROMPT_CODE).toMatch(/if \(!res\.ok\)[\s\S]{0,400}variant: "destructive"/);
  });
});

/**
 * §3a N3b — **조직 0 을 조용히 두지 않는다** (2026-08-12 지적으로 추가)
 *
 * 자동 생성은 두 경우에 건너뛰거나 실패한다:
 *   ① 기본명 도출 불가(표시 이름·이메일 로컬파트 모두 없음) → 의도적 건너뜀
 *   ② `createOrganization` 예외 → 로그인만 살리고 삼킨다
 *
 * 두 경우 모두 사용자는 조직 0 이다. 프롬프트가 `null` 을 반환하면
 * **3a 이전과 똑같은 조용히 빈 상태**가 된다 — 권한 공집합 · 라우트 37개 차단 ·
 * workspace 부재. 그래서 같은 프롬프트가 **생성 모드**로 받아야 한다.
 */
describe("§3a N3b — 조직 0 도 같은 프롬프트가 받는다", () => {
  it("조직 0 을 감지한다 (로딩 중과 구분 — data !== undefined)", () => {
    expect(PROMPT_CODE).toMatch(/const needsOrg = data !== undefined && orgs\.length === 0/);
  });

  it("조직 0 이면 생성(POST), 임시 이름이면 개명(PATCH)", () => {
    expect(PROMPT_CODE).toMatch(/needsOrg\s*\?[\s\S]{0,200}method: "POST"/);
    expect(PROMPT_CODE).toMatch(/method: "PATCH"/);
  });

  it("조직 0 배너가 결과(기능이 열리지 않음)를 말한다", () => {
    expect(PROMPT_CODE).toMatch(/조직이 없습니다<\/strong> — 재고·견적·예산 기능이 열리지 않습니다/);
  });

  it("조직 0 은 red 톤 (임시 이름보다 심각 — §11.302)", () => {
    expect(PROMPT_CODE).toMatch(/needsOrg[\s\S]{0,80}border-red-200 bg-red-50/);
  });

  it("두 상태 중 하나라도 아니면 렌더 0 (상시 노출 금지)", () => {
    expect(PROMPT_CODE).toMatch(/if \(!provisional && !needsOrg\) return null/);
  });
});

describe("§3a N4 — 회사명을 추측하지 않는다", () => {
  it("이메일 로컬파트만 쓴다 (도메인 미사용)", () => {
    expect(NAME_LIB).toMatch(/email\.split\("@"\)\[0\]/);
    // 도메인 조각을 이름 재료로 쓰는 형태가 없어야 한다
    expect(NAME_LIB).not.toMatch(/split\("@"\)\[1\]/);
  });

  it("도출 불가면 null — 지어내지 않는다", () => {
    expect(NAME_LIB).toMatch(/return base \? `\$\{base\}\$\{SUFFIX\}` : null/);
  });

  it("auth 가 null 일 때 자동 생성을 건너뛴다", () => {
    expect(AUTH_CODE).toMatch(/if \(defaultOrgName\)[\s\S]{0,200}createOrganization/);
  });
});

describe("§3a N5 — 가입 후 퍼블릭 랜딩에 남기지 않는다", () => {
  it("기본 callbackUrl 이 '/' 가 아니다", () => {
    expect(SIGNIN_CODE).toMatch(/:\s*"\/dashboard"/);
    expect(SIGNIN_CODE).not.toMatch(/planParam[\s\S]{0,160}:\s*"\/"\s*;/);
  });
});

/**
 * §3a N7 — **Edge 번들 오염 차단** (2026-08-12 실측으로 추가)
 *
 * 3a 가 `auth.ts` 에서 `createOrganization` 을 부르기 시작하자 빌드가 깨졌다:
 *   `middleware.ts` → `@/auth` → `lib/api/organizations` → `lib/workspace/slug`
 *   → `node:crypto` → **UnhandledSchemeError (Edge 런타임)**
 *
 * 즉 auth 체인에 모듈을 하나 붙이는 것은 **미들웨어 번들에 붙이는 것**이다.
 * 이 계약이 없으면 다음 사람이 같은 방식으로 또 깨뜨린다 —
 * 그리고 sentinel·vitest 는 통과하고 **빌드에서만** 드러난다.
 */
describe("§3a N7 — auth 체인이 Edge 를 깨지 않는다", () => {
  const CHAIN = [
    "src/lib/api/organizations.ts",
    "src/lib/workspace/slug.ts",
    "src/lib/organization/default-name.ts",
  ];

  it("auth 가 끌어오는 모듈에 node: 스킴 import 가 없다", () => {
    const offenders = CHAIN.filter((p) => /from\s+["']node:/.test(stripComments(read(p))));
    expect(offenders).toEqual([]);
  });

  it("slug 는 전역 Web Crypto 를 쓴다 (산출물 동형 8자리 hex)", () => {
    const slug = stripComments(read("src/lib/workspace/slug.ts"));
    expect(slug).toMatch(/crypto\.getRandomValues/);
    expect(slug).not.toMatch(/randomBytes/);
  });
});

describe("§3a N6 — 프롬프트가 도달한다 (네 번째 질문)", () => {
  it("dashboard layout 에 마운트된다", () => {
    expect(DASH_LAYOUT_CODE).toMatch(
      /import \{ OrganizationNamePrompt \} from "@\/components\/onboarding\/organization-name-prompt"/,
    );
    expect(DASH_LAYOUT_CODE).toMatch(/<OrganizationNamePrompt \/>/);
  });
});
