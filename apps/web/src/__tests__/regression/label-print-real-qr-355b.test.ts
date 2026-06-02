/**
 * §11.355-B (회귀) — 라벨 인쇄 실 QR (inv.id 인코딩) sentinel
 *
 * 폐루프(라벨→스캔→차감)의 물리적 끊김 해소: LabelPrintModal 이 가짜 바코드(||||)
 * 대신 inv.id 를 인코딩한 실 QR 을 인쇄·미리보기에 출력(미리보기=인쇄 일치).
 * payload 표준 = inv.id (GET /api/inventory/scan?id= 가 받는 cuid). 스캔 가능.
 *
 * 문자열 매칭은 toContain 사용(esbuild ts-loader 모호성 회피).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}
const MODAL = "src/components/inventory/LabelPrintModal.tsx";

describe("§11.355-B — 실 QR 인쇄 (가짜 바코드 제거)", () => {
  it("qrcode 라이브러리로 QR dataURL 생성 (inv.id 인코딩)", () => {
    const src = read(MODAL);
    expect(src).toContain('import QRCode from "qrcode"');
    expect(src).toContain("QRCode.toDataURL(item.id");
  });
  it("가짜 파이프 바코드(||||) 완전 제거", () => {
    const src = read(MODAL);
    expect(src).not.toContain("||||||||");
  });
  it("인쇄 HTML 에 실 QR img 삽입 (qrMap)", () => {
    const src = read(MODAL);
    expect(src).toContain('img class="qr"');
    expect(src).toContain("qrMap[item.id]");
  });
  it("미리보기도 실 QR img (미리보기=인쇄 일치, dead toggle 해소)", () => {
    const src = read(MODAL);
    expect(src).toContain("qrPreviewMap[item.id]");
    expect(src).toContain("QRCode.toDataURL(it.id");
  });
  it("인쇄 템플릿 HTML 이스케이프 (주입/깨짐 방지)", () => {
    const src = read(MODAL);
    expect(src).toContain("escapeHtml(item.name)");
  });
});

describe("§11.355-B 회귀 0 — 기존 동작 보존", () => {
  it("규격 5종(폼텍/DYMO) + 토글 옵션 보존", () => {
    const src = read(MODAL);
    expect(src).toContain("폼텍 3100");
    expect(src).toContain("DYMO 11354");
    expect(src).toContain("setIncludeQR");
    expect(src).toContain("setIncludeBarcode");
  });
  it("인쇄 트리거(window.open + print) 보존", () => {
    const src = read(MODAL);
    expect(src).toContain('window.open("", "_blank")');
    expect(src).toContain("printWindow.print()");
  });
});
