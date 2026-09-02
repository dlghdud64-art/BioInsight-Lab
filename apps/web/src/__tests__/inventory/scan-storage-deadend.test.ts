import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

/**
 * §scan-storage-deadend (2026-09-02 호영님 실측 · 3회 연속 등록 실패) —
 *
 * 배경: 이미지 저장소(STORAGE_PROVIDER) 미설정이면 runOcrPipeline 이 업로드를 skip 해
 *   OcrJob 이 생성되지 않고(jobId null), smart-receiving 는 ocrJobId 를 필수(400)로 받는다.
 *   그래서 "인식은 성공한 것처럼 보이고 마지막 등록에서만 실패" 하는 dead end 가 났다 —
 *   placeholder success 의 변형이다.
 *
 * 잠그는 계약:
 *   1) jobId 가 없으면 등록 버튼이 **비활성** (누르고 나서 실패시키지 않는다)
 *   2) 차단 사유를 **미리** 화면에 노출 + 버튼 라벨에 인라인(툴팁 금지 — 레포 선례)
 *   3) 발주 매핑 경로(selectedOrderId)는 ocrJobId 를 쓰지 않으므로 이 차단에서 제외
 *   4) /api/health 가 저장소 상태를 노출 — 대시보드 접근 없이 원인(키 vs 토큰)을 가른다
 */

const REPO_ROOT = join(__dirname, "..", "..", "..");
const MODAL = "src/components/inventory/SmartReceivingScannerModal.tsx";
const HEALTH = "src/app/api/health/route.ts";
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");

describe("§scan-storage-deadend (1) — jobId 없으면 등록 잠금", () => {
  it("storageBlocked 파생 — jobId null + 발주 매핑 아님", () => {
    const src = stripComments(read(MODAL));
    expect(src).toMatch(/const scanJobId = scanResult\?\.ocrMetadata\?\.jobId \?\? null;/);
    expect(src).toMatch(/const storageBlocked = !selectedOrderId && !scanJobId;/);
  });

  it("등록 버튼 disabled 에 storageBlocked 포함 (①접두사: aria- 제외)", () => {
    const src = stripComments(read(MODAL));
    // ② 창 시작점 — 여는 태그(<Button)부터 열어 속성 앞부분을 창 안에 둔다.
    const btn = src.match(
      /<Button[\s\S]{0,160}?data-testid="smart-receiving-submit-cta"[\s\S]{0,1200}?className=/,
    )?.[0];
    expect(btn, "submit 버튼 창").toBeTruthy();
    expect(btn!).toMatch(/(?<!aria-)disabled=\{[\s\S]{0,120}?storageBlocked/);
  });
});

describe("§scan-storage-deadend (2) — 사유를 미리 드러낸다", () => {
  it("차단 안내 블록 실재 (인식 화면에서 등록 전에 노출)", () => {
    const src = stripComments(read(MODAL));
    expect(src).toMatch(/storageBlocked && \(/);
    expect(src).toMatch(/data-testid="srm-storage-blocked"/);
    expect(src).toMatch(/이미지 저장소가 설정되지 않아 입고 등록을 완료할 수 없습니다/);
  });

  it("버튼 라벨에 차단 사유 인라인 (툴팁 금지 선례)", () => {
    const src = stripComments(read(MODAL));
    expect(src).toMatch(/storageBlocked\s*\?\s*"입고 등록 · 이미지 저장소 미설정"/);
  });
});

describe("§scan-storage-deadend (3) — health 진단 축", () => {
  it("provider · hasBlobToken · ready 노출 (값이 아니라 존재 여부)", () => {
    const src = stripComments(read(HEALTH));
    expect(src).toMatch(/provider: process\.env\.STORAGE_PROVIDER \|\| null/);
    expect(src).toMatch(/hasBlobToken: !!process\.env\.BLOB_READ_WRITE_TOKEN/);
    expect(src).toMatch(/ready:/);
    // 토큰 값 자체는 절대 내보내지 않는다.
    expect(src).not.toMatch(/BLOB_READ_WRITE_TOKEN\?\.slice|token: process\.env\.BLOB_READ_WRITE_TOKEN[^!]/);
  });
});
