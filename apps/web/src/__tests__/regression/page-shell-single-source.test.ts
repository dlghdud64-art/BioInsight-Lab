/**
 * §page-shell-single-source (호영님 2026-09-07) —
 * **한 페이지가 마케팅 셸과 대시보드 셸을 동시에 렌더하면 안 된다.**
 *
 * 사고 실측 — `/billing`:
 *   `MainHeader`(마케팅 · `fixed h-14`)와 `DashboardSidebar`(대시보드)를 같이 썼다.
 *   결과 (a) 로그인 상태인데 "로그인 / 무료로 시작하기" CTA 가 뜨고
 *        (b) `fixed` 헤더가 자기 자리를 안 차지해 페이지 제목을 덮었다.
 *   §dashboard-header-swap(2026-09-07)이 `DashboardHeader`(`sticky`)로 교체해 닫혔다.
 *
 * 🛑 이 명제는 원래 §11.303-hotfix 에 얹힐 뻔했다. 그 sentinel 의 진짜 명제는
 *   **CRLF 0**(원 사고 79780f1d: CRLF 가 SWC 파서를 깨 Vercel 배포 20회 연속 ERROR)이고
 *   레이아웃과 무관하다. 이름 아래 다른 것을 지키게 하면 다음 사람이 오독한다 —
 *   2026-09-07 실제로 그 오독이 있었다. 그래서 **자기 이름으로 분리**했다(호영님 지시).
 *
 * 🔑 잠그는 것은 **명제**다. 컴포넌트 이름을 계약으로 삼지 않는다 —
 *   셸의 **역할**(마케팅 / 대시보드)로 판정한다. 새 셸이 생기면 아래 두 배열에
 *   역할만 추가하면 되고, 페이지 쪽 단언은 손대지 않는다.
 *   (오늘 상시 RED 3건이 전부 이름·문자열·공백을 핀해서 생긴 일이다.)
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const WEB_ROOT = join(__dirname, "..", "..", "..");

/** 공개 마케팅 셸 — 비로그인 방문자용 헤더/푸터. */
const MARKETING_SHELL = ["MainHeader", "MainFooter"] as const;
/** 로그인 후 앱 셸 — 사이드바·대시보드 헤더. */
/* 승계 (2026-09-07, §self-shell-zero): 부품 2개에 **셸 컴포넌트 자체**를 더한다.
 * 8곳이 자체 셸을 버리고 `<DashboardShell>` 을 쓰게 되면서, 부품 이름만 보면
 * "대시보드 셸을 렌더한다" 를 못 본다 — 이 파일이 처음부터 적어 둔 확장 방식이다
 * ("새 셸이 생기면 아래 두 배열에 역할만 추가"). 페이지 쪽 단언은 손대지 않았다. */
const DASHBOARD_SHELL = ["DashboardShell", "DashboardSidebar", "DashboardHeader"] as const;

function pageFiles(): string[] {
  const out: string[] = [];
  (function walk(dir: string) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === "__tests__") continue;
        walk(p);
      } else if (/^(page|layout|template)\.tsx$/.test(e.name)) {
        out.push(p);
      }
    }
  })(join(WEB_ROOT, "src", "app"));
  return out;
}

/** 이 파일이 렌더하는 셸의 역할 — JSX 사용처만 본다(import 만 남은 것은 렌더가 아니다). */
function shellsRendered(code: string): { marketing: string[]; dashboard: string[] } {
  const uses = (names: readonly string[]) =>
    names.filter((n) => new RegExp(`<${n}\\b`).test(code));
  return { marketing: uses(MARKETING_SHELL), dashboard: uses(DASHBOARD_SHELL) };
}

function violations(): string[] {
  const hits: string[] = [];
  for (const f of pageFiles()) {
    const code = stripComments(readFileSync(f, "utf8"));
    const { marketing, dashboard } = shellsRendered(code);
    if (marketing.length > 0 && dashboard.length > 0) {
      const rel = f.slice(f.indexOf("src")).replace(/\\/g, "/");
      hits.push(`${rel} → ${marketing.join("+")} × ${dashboard.join("+")}`);
    }
  }
  return hits;
}

describe("§page-shell-single-source — 한 페이지에 셸은 하나", () => {
  it("축이 비어 있지 않다 (검사가 조용히 사라지지 않게)", () => {
    /* 🛑 경로 구분자·확장자 조건이 틀리면 스코프가 통째로 0이 되고
     *   그때 이 sentinel 은 영구 GREEN 이 된다. 먼저 스코프를 잠근다. */
    expect(pageFiles().length).toBeGreaterThan(50);
  });

  it("마케팅 셸과 대시보드 셸을 함께 렌더하는 페이지가 0이다", () => {
    /* 🔑 래칫이 아니라 0 이다. 첫 판본은 `my/orders/page.tsx` 를 알려진 위반으로
     *   적어 뒀는데, 그건 내 grep 오탐이었다 — 그 파일은 `DashboardSidebar` 를
     *   **import 만** 하고 렌더하지 않는다(JSX 는 `<MainHeader />` 3곳뿐).
     *   이 sentinel 이 `<Name` 사용처만 보게 만든 덕에 내 오탐이 그 자리에서 잡혔다.
     *   → 지금 위반은 실제로 0이므로 예외 목록을 두지 않는다. 목록이 없으면 헐거워질 수도 없다.
     *   ⚠️ 별건: `my/orders/page.tsx:16` 의 미사용 import 는 죽은 코드다(정리 대상). */
    const hits = violations();
    expect(hits, `마케팅 셸 × 대시보드 셸 동시 렌더: ${hits.join(" · ")}`).toHaveLength(0);
  });

  /* ── 명제 확장 (호영님 2026-09-08 실측) ─────────────────────────────
   * 🛑 위 단언은 "**둘 다** 렌더" 만 본다. "**잘못된 하나만** 렌더" 는 안 잡는다.
   *   그 한계를 파일 작성 시 적어 뒀는데(2026-09-07), 실제 위반이 나왔다:
   *     `/my/orders` — 로그인 사용자의 개인 주문 내역(주문번호·금액·상태)인데
   *     마케팅 셸만 렌더. 사이드바 0 · 로그인 상태로 "young a" 표시.
   *   → 명제를 넓힌다: **인증이 필요한 화면은 대시보드 셸을 쓴다.**
   */

  /** 이 페이지가 인증을 요구하는 신호. 미들웨어 축과 페이지 가드 축을 함께 본다. */
  function requiresAuth(code: string): boolean {
    return code.includes("useSession(") || code.includes("await auth()");
  }

  /**
   * 공개 셸이 **계약인** 경로. 예외 목록이 아니라 **판정된 결정**이라 여기 적는다.
   * (CLAUDE.md "예외 목록에는 만료일과 소유자" — 아래 둘은 소유자·사유가 있고,
   *  두 번째는 **기계로 검사되는 만료 조건**을 함께 건다.)
   */
  const PUBLIC_SHELL_BY_CONTRACT = [
    {
      route: "src/app/billing/success",
      // §dashboard-header-swap 판정 · 미들웨어가 `/billing` 을 **정확 일치**로 둔 이유와 같다:
      // 결제 복귀 랜딩은 외부 리디렉트로 도착하므로 공개 헤더를 유지한다.
      reason: "결제 복귀 랜딩 (호영님 판정 · §dashboard-header-swap)",
      expiry: null as string | null,
    },
    {
      route: "src/app/protocol/bom",
      // 실측 2026-09-08: 인바운드 링크 0. `_workbench/search/page.tsx` 가
      // "BOM 미완 라이브 숨김" 사유로 링크를 제거해 뒀다.
      reason: "미완 · 인바운드 0 (라이브에서 숨김)",
      // 🔑 만료 조건이 **기계로 검사된다** — 링크가 생기면 아래 단언이 RED 가 된다.
      expiry: "인바운드 링크가 생기면 즉시 대시보드 셸로 교체",
    },
  ];

  it("🛑 인증이 필요한 화면은 대시보드 셸을 쓴다 (마케팅 셸 단독 렌더 0)", () => {
    const hits: string[] = [];
    for (const f of pageFiles()) {
      const code = stripComments(readFileSync(f, "utf8"));
      const { marketing, dashboard } = shellsRendered(code);
      if (marketing.length === 0 || dashboard.length > 0) continue;
      if (!requiresAuth(code)) continue;
      const rel = f.slice(f.indexOf("src")).replace(/\\/g, "/");
      if (PUBLIC_SHELL_BY_CONTRACT.some((c) => rel.startsWith(c.route))) continue;
      hits.push(`${rel} → ${marketing.join("+")} 만 · 인증 필요`);
    }
    expect(
      hits,
      `인증 화면인데 마케팅 셸만 렌더: ${hits.join(" · ")}`,
    ).toHaveLength(0);
  });

  it("🔑 공개 셸 계약 경로가 실재하고, 만료 조건이 지켜진다", () => {
    /* 목록이 stale 해지면 계약이 헐거워진다 — 고쳐졌으면 목록에서도 지워야 한다. */
    for (const c of PUBLIC_SHELL_BY_CONTRACT) {
      const p = join(WEB_ROOT, c.route, "page.tsx");
      const code = stripComments(readFileSync(p, "utf8"));
      const { marketing } = shellsRendered(code);
      expect(
        `${c.route}: ${marketing.length > 0}`,
        `${c.route} 는 이미 대시보드 셸이다. PUBLIC_SHELL_BY_CONTRACT 에서 지워라.`,
      ).toBe(`${c.route}: true`);
    }

    /* 🔑 `/protocol/bom` 의 만료 조건 — 인바운드 링크가 생기면 계약이 끝난다.
     *   "나중에" 로 증발하지 않게 **기계가** 감시한다. */
    const inbound: string[] = [];
    for (const f of pageFiles()) {
      const rel = f.slice(f.indexOf("src")).replace(/\\/g, "/");
      if (rel.startsWith("src/app/protocol/bom")) continue;
      const code = stripComments(readFileSync(f, "utf8"));
      if (/href=["'`]\/protocol\/bom/.test(code)) inbound.push(rel);
    }
    expect(
      inbound,
      `/protocol/bom 에 인바운드 링크가 생겼다 — 대시보드 셸로 교체할 때다: ${inbound.join(" · ")}`,
    ).toHaveLength(0);
  });

  it("🔑 `/billing` 은 고쳐진 상태다 (오늘 사고의 회귀 0)", () => {
    const code = stripComments(
      readFileSync(join(WEB_ROOT, "src/app/billing/page.tsx"), "utf8"),
    );
    const { marketing, dashboard } = shellsRendered(code);
    expect(marketing).toEqual([]);
    expect(dashboard.length).toBeGreaterThan(0);
  });
});
