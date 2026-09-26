// 🛑 은퇴 §quote-brief-rail-removed (2026-09-26 · 호영님 판정) — 견적 관리 브리핑 레일(우측 4탭)·모바일 맥락 시트·모바일 브리핑 시트 삭제.
//   이 파일의 견적 레일 전용 단언 5건을 it.skip 으로 은퇴했다. 원 명제는 각 it 제목에 그대로 남아 있다.
//   살아 있는 명제(표면 0 · 행 클릭 = 선택만 · 대체 진입점)는 regression/quote-brief-rail-removed.test.ts 로 이관했다.
/**
 * #quote-brief-next-prune — 호영님 Batch II #5: 해당없음 항목 숨기기
 *
 * 호영님 spec: '다음 조치' 영역의 "승인 정책: 없음" + "외부 승인: 불필요"
 * hardcoded row 는 "할 게 없다" 정보가 "할 게 있다" 만큼 면적 점유 → 숨김.
 * 실제 액션 필요 항목 (handoffTarget + handoffStatus) 만 노출.
 *
 * canonical truth lock:
 *   - selectedSignals.handoffTarget / handoffStatus 보존
 *   - "다음 조치" section 자체 보존 (id="brief-next")
 *   - §11.217 / §11.218 / §11.221 cluster invariant 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("#quote-brief-next-prune — hardcoded '없음'/'불필요' 2 줄 hide", () => {
  it("'승인 정책' hardcoded row 제거", () => {
    expect(page).not.toMatch(/text-slate-400">승인 정책<\/span><span className="text-slate-500">없음/);
  });

  it("'외부 승인' hardcoded row 제거", () => {
    expect(page).not.toMatch(/text-slate-400">외부 승인<\/span><span className="text-slate-500">불필요/);
  });
});

describe("#quote-brief-next-prune — invariant 보존", () => {
  it.skip("'다음 조치' section (brief-next) 보존", () => {
    expect(page).toMatch(/id="brief-next"/);
  });

  it.skip("'다음 연결' (handoffTarget) row 보존", () => {
    expect(page).toMatch(/다음 연결[\s\S]{0,200}handoffTarget/);
  });

  it.skip("'진행 상태' (handoffStatus) row 보존", () => {
    /* 승계 §order-entry-removed (2026-09-25 · 호영님 판정) — 「발주 전환」 은 제품에 없는 다음 단계였다.
     *   결재로 바꾸지도 않았다(prod FREE → approvalPolicy "none" · ADMIN 0 → 두 번 막힘).
     *   명제(브리핑이 다음 단계를 한 자리에서 보여준다)는 불변이고 **이름만** 참인 것으로 옮겼다. */
    expect(page).toMatch(/진행 상태[\s\S]{0,200}handoffStatus/);
  });

  it.skip("§11.221 판단 근거 (buildBriefRationale 한 줄 + collapsible) 보존", () => {
    expect(page).toMatch(/buildBriefRationale/);
    expect(page).toMatch(/factsExpanded/);
  });

  it.skip("cluster trace marker (§11.222)", () => {
    expect(page).toMatch(/#quote-brief-next-prune|§11\.222|해당없음 hide/);
  });
});
