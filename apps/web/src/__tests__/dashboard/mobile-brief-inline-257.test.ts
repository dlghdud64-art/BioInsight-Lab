/**
 * §11.257 — 모바일 대시보드 운영 브리핑 + 스캔 FAB 겹침 해소 (방안 3 인라인 배치).
 *
 * 호영님 spec: 모바일 우하단에서 ✨ 운영 브리핑 button + ⇄ 스캔 FAB 이
 *   `fixed bottom-[72px] right-4 z-40` 동일 좌표 충돌 → 운영 브리핑 텍스트
 *   "운영 브" 까지만 보임 + 오탭 위험.
 *
 * 권장안 (방안 3 인라인 배치):
 *   - 운영 브리핑을 floating 에서 대시보드 헤더 영역의 inline link 로 전환 (모바일).
 *   - 데스크탑 (lg+) 은 기존 floating 보존 (BottomNav / scan FAB 없음 → 겹침 0).
 *   - FAB 은 스캔 전용 유지 (lg:hidden 보존, 변경 0).
 *
 * canonical truth lock:
 *   - useOperationalBriefPopup hook 보존 (popup.open() 동일 호출).
 *   - §11.181 trace + controls="operational-brief-popup" 보존.
 *   - BarcodeScanFab mount (dashboard-shell.tsx) 변경 0.
 *   - 모바일 하단 빠른 실행 바 (시약 검색/재고 등록/견적 요청) 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const PAGE_PATH = resolve(__dirname, "../../app/dashboard/page.tsx");
const code = safeRead(PAGE_PATH);

describe("§11.257 #1 — 모바일 인라인 운영 브리핑 link 추가", () => {
  it("§11.257 trace marker", () => {
    expect(code).toMatch(/§11\.257|11\.257/);
  });

  it("Sparkles icon import 보존 (인라인 link icon)", () => {
    expect(code).toMatch(/(Sparkles)(?=\s*,|\s*}|\s*from)/);
  });

  it("'운영 브리핑 보기' inline 라벨 + lg:hidden 분기", () => {
    // §11.257 trace 인근에 "운영 브리핑 보기" + lg:hidden (모바일 only).
    expect(code).toMatch(/§11\.257[\s\S]{0,2000}lg:hidden[\s\S]{0,500}운영\s*브리핑\s*보기|운영\s*브리핑\s*보기[\s\S]{0,500}lg:hidden|lg:hidden[\s\S]{0,500}§11\.257[\s\S]{0,500}운영/);
  });

  it("inline link 터치 타깃 min-h-[44px] 또는 h-11+ (Apple HIG)", () => {
    expect(code).toMatch(/§11\.257[\s\S]{0,3000}(min-h-\[44px\]|h-11|h-12)/);
  });

  it("inline link onClick → useOperationalBriefPopup 사용 (canonical popup hook)", () => {
    // useOperationalBriefPopup import + popup.open() 호출.
    expect(code).toMatch(/useOperationalBriefPopup/);
  });
});

describe("§11.257 #2 — FloatingEntry 데스크탑 한정 (모바일 hide)", () => {
  it("OperationalBriefFloatingEntry mount 가 lg:block / hidden lg:* / max-lg:hidden 분기 wrap", () => {
    // floating entry 가 lg+ 에서만 노출되도록 wrap.
    expect(code).toMatch(/(hidden\s+lg:block|max-lg:hidden|lg:block[\s\S]{0,200}OperationalBriefFloatingEntry|OperationalBriefFloatingEntry[\s\S]{0,200}(hidden|lg:))/);
  });

  it("OperationalBriefFloatingEntry controls='operational-brief-popup' 보존", () => {
    expect(code).toMatch(/OperationalBriefFloatingEntry[\s\S]{0,200}controls=["']operational-brief-popup["']/);
  });
});

describe("§11.257 — invariant 보존", () => {
  it("§11.181 trace 또는 운영 브리핑 floating entry comment 보존", () => {
    expect(code).toMatch(/§11\.181|운영\s*브리핑\s*floating/);
  });

  it("모바일 하단 빠른 실행 바 보존 (시약 검색/재고 등록/견적 요청)", () => {
    expect(code).toMatch(/시약\s*검색/);
    expect(code).toMatch(/재고\s*등록/);
    expect(code).toMatch(/견적\s*요청/);
  });

  it("AIInsightDialog 헤더 mount 보존", () => {
    expect(code).toMatch(/AIInsightDialog/);
  });

  it("OperationalBriefFloatingEntry import 보존 (컴포넌트 자체 변경 0)", () => {
    expect(code).toMatch(/OperationalBriefFloatingEntry/);
  });
});
