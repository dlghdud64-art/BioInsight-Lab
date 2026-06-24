/**
 * §dashboard-home-redesign P2 — 헤더 정리 (호영님 시안)
 *   (PLAN: docs/plans/PLAN_dashboard-home-redesign.md)
 *
 * 장식성 인사("○○님") 제거 + 중복 카운트("확인이 필요한 항목 N건", ActionInbox 소유) 제거.
 * description = 기능 맥락(날짜, SSR-safe). 워크스페이스명은 canonical org 소스 부재로 보류(날조 금지).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PAGE = readFileSync(join(REPO_ROOT, "src/app/dashboard/page.tsx"), "utf8");

describe("§dashboard-home-redesign P2 — 헤더 정리", () => {
  it("장식성 인사 제거 — session.user.name 인사 미사용", () => {
    expect(PAGE).not.toMatch(/\$\{session\.user\.name\}님/);
    expect(PAGE).not.toMatch(/data: session/); // status 만 구독(unused 0)
  });
  it("중복 카운트 제거 — '확인이 필요한 항목 N건' 헤더 description 부재(ActionInbox 소유)", () => {
    expect(PAGE).not.toMatch(/확인이 필요한 항목 \$\{processingRequiredCount/);
  });
  it("description = 날짜(기능 맥락) + SSR-safe(default '' + mount)", () => {
    expect(PAGE).toMatch(/description=\{todayLabel\}/);
    expect(PAGE).toMatch(/const \[todayLabel, setTodayLabel\] = useState\(""\)/);
    expect(PAGE).toMatch(/toLocaleDateString\("ko-KR"/);
  });
  it("회귀 0 — title '대시보드' + AI 리포트 actions 보존", () => {
    expect(PAGE).toMatch(/title="대시보드"/);
    expect(PAGE).toMatch(/<AIInsightDialog/);
  });
  it("회귀 0 — 카운트 소스(processingRequiredCount 등)는 ActionInbox/isBlocked용 보존", () => {
    expect(PAGE).toMatch(/const processingRequiredCount =/);
    expect(PAGE).toMatch(/const dashboardState/); // mobile fallback 등에서 계속 사용
  });
});
