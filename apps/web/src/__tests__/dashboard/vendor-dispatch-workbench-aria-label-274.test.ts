/**
 * §11.274 #vendor-dispatch-workbench-aria-label-korean
 *   vendor-dispatch-workbench.tsx aria-label 한국어 정합 lock fix
 *   (호영님 P1, Phase B cross-surface smoke @ 390x844 / production 134a94ea)
 *
 * Root cause:
 *   §11.248a visible label sweep 가 aria-label 차원 누락.
 *   2 spot 영문 잔존 → SR 사용자 영문 청취 → §11.142 한국어 정합 lock 위반.
 *   - line 805 disabled 분기: aria-label="Send to supplier disabled"
 *   - line 829 active 분기:  aria-label="Send to supplier"
 *
 * Fix (minimum diff, 1 file 2 spot):
 *   - disabled: aria-label="공급사 요청 전달 (비활성)"
 *     (visible "선택 공급사에 요청 전달" 정합 + SR disabled state 명시)
 *   - active:   aria-label="공급사에 전송"
 *     (visible sendReadiness 4 분기 변동 → intent 안정화, WCAG 2.1 SC 2.5.3)
 *
 * ※ Drift 갱신 (§quote-screen-sian): §11.274 의도(한국어 정합·intent 안정화) 유지하되
 *   후속 변경으로 앵커 갱신 — active aria "공급사에 전송"→"견적서 PDF 다운로드"(§11.314-b PDF flow),
 *   footer "공급사 직접 추가" 제거→스텝퍼 "공급사 후보 보강" 단일점(§09 P6.4),
 *   not-ready 색 amber-500→yellow-500(§11.302d-6b-2 amber BAN). 구현 정상·sentinel 앵커만 정합.
 *
 * canonical truth lock:
 *   - data-testid 2개 (quote-dispatch-send-disabled / quote-dispatch-confirm-before-send)
 *   - sendReadiness === "blocked" 분기 + variant="secondary" + disabled prop
 *   - visible label 6종 보존
 *   - Send/UserPlus/AlertTriangle/Check/Loader2 icon 보존
 *   - setConfirmationOpen handler 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const VDW_PATH = resolve(
  __dirname,
  "../../components/quotes/dispatch/vendor-dispatch-workbench.tsx"
);
const vdw = readFileSync(VDW_PATH, "utf8");

describe("§11.274 #1 — aria-label 한국어 swap 검증", () => {
  it("§11.274 trace marker comment 존재", () => {
    expect(vdw).toMatch(/§11\.274/);
  });

  it("disabled 분기 aria-label '공급사 요청 전달 (비활성)' 적용", () => {
    expect(vdw).toContain('aria-label="공급사 요청 전달 (비활성)"');
  });

  // §11.314-b PDF flow — active 버튼이 견적서 PDF 다운로드 흐름으로 전환되며 aria-label 정합 갱신(§11.274 intent 계승).
  it("active 분기 aria-label '견적서 PDF 다운로드' 적용", () => {
    expect(vdw).toContain('aria-label="견적서 PDF 다운로드"');
  });

  it("영문 aria-label 'Send to supplier' 제거 확인", () => {
    expect(vdw).not.toContain('aria-label="Send to supplier"');
    expect(vdw).not.toContain('aria-label="Send to supplier disabled"');
  });
});

describe("§11.274 #2 — §11.142 invariant 보존 (canonical truth)", () => {
  it("data-testid 2개 보존 (send-disabled / confirm-before-send)", () => {
    expect(vdw).toContain('data-testid="quote-dispatch-send-disabled"');
    expect(vdw).toContain('data-testid="quote-dispatch-confirm-before-send"');
  });

  it("sendReadiness === 'blocked' 분기 보존", () => {
    expect(vdw).toContain('sendReadiness === "blocked"');
  });

  it("variant='secondary' + disabled prop 보존 (disabled 버튼)", () => {
    expect(vdw).toMatch(/variant="secondary"[\s\S]{0,200}data-testid="quote-dispatch-send-disabled"/);
  });

  // §09 P6.4 — footer 중복 "공급사 직접 추가" 제거 → 보강 CTA는 스텝퍼 "공급사 후보 보강" 단일점.
  it("visible label 6종 보존 (선택 공급사에 요청 전달 / 공급사 후보 보강 / 전달 중 / 전송 추적 확인됨 / 전송 전 확인 필요 / 최종 확인 후 전송)", () => {
    expect(vdw).toContain("선택 공급사에 요청 전달");
    expect(vdw).toContain("공급사 후보 보강");
    expect(vdw).toContain("전달 중…");
    expect(vdw).toContain("전송 추적 확인됨");
    expect(vdw).toContain("전송 전 확인 필요");
    expect(vdw).toContain("최종 확인 후 전송");
  });

  it("5 icon (Send / UserPlus / AlertTriangle / Check / Loader2) 보존", () => {
    expect(vdw).toContain("Send");
    expect(vdw).toContain("UserPlus");
    expect(vdw).toContain("AlertTriangle");
    expect(vdw).toContain("Check");
    expect(vdw).toContain("Loader2");
  });

  it("setConfirmationOpen handler 보존", () => {
    expect(vdw).toContain("setConfirmationOpen");
  });

  it("isSubmitting + sentTracking + sendReadiness 분기 보존", () => {
    expect(vdw).toContain("isSubmitting");
    expect(vdw).toContain("sentTracking");
    expect(vdw).toContain("sendReadiness");
  });

  // §11.302d-6b-2 — amber BANNED, not-ready 톤은 yellow.
  it("emerald-600 (ready) / yellow-500 (not ready) className 보존", () => {
    expect(vdw).toContain("bg-emerald-600 hover:bg-emerald-700 text-white");
    expect(vdw).toContain("bg-yellow-500 hover:bg-yellow-600 text-white");
  });
});
