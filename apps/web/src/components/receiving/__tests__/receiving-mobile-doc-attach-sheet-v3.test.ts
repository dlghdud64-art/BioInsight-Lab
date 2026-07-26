import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * §mobile-receiving-rcv-card Phase 3 (호영님 2026-07-26 핸드오프 §2 — 문서 첨부 시트 배선)
 *   `첨부 ›` → same-canvas 바텀 시트. store.attachReceivingDocument 실 게이트 전이,
 *   per-line/per-lot(CoA·MSDS) 모델, 정직-disabled 드롭존, 완료 CTA 사유 인라인.
 *   데스크탑 receiving-doc-attach-modal(센터 Dialog)은 무접촉 — 별도 모바일 시트.
 */

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const SHEET = "src/components/receiving/mobile-doc-attach-sheet.tsx";
const PAGE = "src/app/dashboard/receiving/page.tsx";

describe("§mobile-receiving-rcv-card P3 — 바텀 시트 폼팩터", () => {
  it("바텀 시트(하단 정렬·슬라이드·그랩바) + role=dialog", () => {
    const src = read(SHEET);
    expect(src).toMatch(/role="dialog"/);
    expect(src).toMatch(/aria-modal="true"/);
    expect(src).toMatch(/items-end/); // 하단 정렬(센터 아님)
    expect(src).toMatch(/translate-y-full/); // 슬라이드 업
    expect(src).toMatch(/rounded-t-2xl/);
  });

  it("프리셋 컨텍스트 — RCV 번호 · 라인명", () => {
    const src = read(SHEET);
    expect(src).toMatch(/rb\?\.receivingNumber/);
    expect(src).toMatch(/presetLine/);
  });
});

describe("§mobile-receiving-rcv-card P3 — 실 배선(store.attachReceivingDocument · front-only 아님)", () => {
  it("handleAttach 래퍼 → onAttach(rb.id, ...) 먼저 → 완료 시 labToast 1회", () => {
    const src = read(SHEET);
    expect(src).toMatch(/import \{ labToast \} from "@\/lib\/toast\/lab-toast"/);
    const attachIdx = src.indexOf("onAttach(rb.id, lineId, docType, lotId)");
    const toastIdx = src.indexOf("labToast.success(");
    expect(attachIdx).toBeGreaterThan(-1);
    expect(toastIdx).toBeGreaterThan(attachIdx); // mutation 먼저 → 성공 후 토스트
    expect(src).toMatch(/if \(remaining === 1\)/);
  });

  it("개별 추가 버튼 = handleAttach 경유(직접 onAttach onClick 금지)", () => {
    const src = read(SHEET);
    expect(src).toMatch(/onClick=\{\(\) => handleAttach\(line\.id, type\)\}/);
    expect(stripComments(src)).not.toMatch(/onClick=\{\(\) => onAttach\(/);
  });

  it("per-line/per-lot 문서 모델 보존(CoA·MSDS·lotRecords · GMP)", () => {
    const src = read(SHEET);
    expect(src).toMatch(/성적서\(CoA\)/);
    expect(src).toMatch(/MSDS/);
    expect(src).toMatch(/line\.lotRecords/);
    expect(src).toMatch(/lot\.coaAttached/);
    expect(src).toMatch(/lot\.msdsAttached/);
  });
});

describe("§mobile-receiving-rcv-card P3 — 정직성(없는 기능 주장 금지)", () => {
  it("드롭존 정직-disabled(촬영·파일 실업로드는 DB 연동 후)", () => {
    const src = read(SHEET);
    expect(src).toMatch(/disabled/);
    expect(src).toMatch(/DB 연동 후/);
    expect(src).toMatch(/border-dashed border-\[#93c5fd\]/);
  });

  it("활동 로그 기록 등 미구현 기능 허위 주장 없음", () => {
    const src = read(SHEET);
    expect(stripComments(src)).not.toMatch(/활동 로그/);
  });

  it("완료 CTA 비활성 + 사유 인라인", () => {
    const src = read(SHEET);
    expect(src).toMatch(/CoA 업로드 후 가능/);
    expect(src).toMatch(/disabled=\{!allDone\}/);
  });
});

describe("§mobile-receiving-rcv-card P3 — 신호등(yellow 토큰, amber 금지) · 터치", () => {
  it("반영 차단 callout = yellow 토큰(§11.302, amber sentinel 준수)", () => {
    const src = read(SHEET);
    expect(src).toMatch(/bg-\[#fef9c3\] text-\[#a16207\]/);
    expect(src).not.toMatch(/#b45821/);
    expect(src).not.toMatch(/amber-/);
  });

  it("터치 타겟 44px", () => {
    const src = read(SHEET);
    expect(src).toMatch(/min-h-\[44px\]/);
  });
});

describe("§mobile-receiving-rcv-card P3 — page 배선(첨부 › = 시트, dead button 0)", () => {
  it("첨부 › = setAttachCardId(시트 오픈), 상세 라우팅 폴백 제거", () => {
    const src = read(PAGE);
    expect(src).toMatch(/onAttach=\{\(card: MobileReceivingCard\) => setAttachCardId\(card\.id\)\}/);
  });

  it("live 배치 조회(로컬 복제 truth 없음) + store.attachReceivingDocument 주입", () => {
    const src = read(PAGE);
    expect(src).toMatch(/receivingBatches\.find\(\(b\) => b\.id === attachCardId\)/);
    expect(src).toMatch(/attachReceivingDocument \} =\s*\n?\s*useOpsStore\(\)|attachReceivingDocument \} = useOpsStore\(\)/);
    expect(src).toMatch(/<MobileDocAttachSheet/);
    expect(src).toMatch(/onAttach=\{attachReceivingDocument\}/);
  });
});
