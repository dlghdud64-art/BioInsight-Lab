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

  it("🔑 `/billing` 은 고쳐진 상태다 (오늘 사고의 회귀 0)", () => {
    const code = stripComments(
      readFileSync(join(WEB_ROOT, "src/app/billing/page.tsx"), "utf8"),
    );
    const { marketing, dashboard } = shellsRendered(code);
    expect(marketing).toEqual([]);
    expect(dashboard.length).toBeGreaterThan(0);
  });
});
