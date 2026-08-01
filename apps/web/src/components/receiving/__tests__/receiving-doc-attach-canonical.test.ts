/**
 * §receiving-doc-attach-canonical (T1) — 입고 문서 첨부 canonical 배선 sentinel.
 *
 * 문제(핸드오프 §0, release blocker):
 *   - "추가" = front-only success — 파일 선택기 없이 클릭 즉시 첨부됨 처리(업로드 배선 0).
 *   - MSDS 허위 표시 — 첨부 이력 없는데 첨부됨 렌더(데모 seed 플래그).
 *   근본: /dashboard/receiving 전 surface가 useOpsStore(in-memory seed) 기반 — 서버 미배선.
 *
 * 결정(PLAN_receiving-doc-attach-canonical.md §0, 호영님 승인 2026-07-31):
 *   - 거래명세서·기타 = 신규 `ReceivingDocument` 모델(입고 증빙 전용).
 *     SDSDocument 는 CHECK `SDSDocument_coa_lot_check` 가 docType 을 sds/coa 로 하드 잠금 →
 *     제3 docType 추가 시 INSERT 전면 차단. **CHECK 무접촉이 절대 조건.**
 *   - MSDS = 품목 단위 문서(SDSDocument.productId, docType='sds') 조회 파생 — 재첨부 불필요.
 *   - COA = 입고 확정분(restockId 존재)만 T1 범위. 검수 중 업로드는 T2.
 *   - 데이터 0건 = 정직한 빈 상태(데모 seed 폴백 금지).
 *
 *
 * ⚠️ Sentinel supersession (P3에서 갱신 대상 — 실측 확인 2026-07-31):
 *   - receiving-doc-attach-v2.test.ts: `파일 업로드는 입고 DB 연동 후 제공됩니다`(정직-disabled 드롭존),
 *     `useState<DocTab>("byDoc")` 등 데모 시점 스냅샷을 잠금. 본 트랙이 그 "입고 DB 연동"을 구현하므로
 *     해당 단언은 supersede 대상(보호 intent = 드롭존이 가짜 성공을 내지 않을 것 → canonical 업로드로 승격).
 *   - doc-attach-toast-wiring.test.ts: `onAttach(=store.attachReceivingDocument)` 로컬 dispatch 경유를 잠금.
 *     서버 업로드 전환 시 시그니처 변경 → supersede(보호 intent = 토스트가 첨부 성공 이후에만 → 서버 200 이후로 승격).
 *   두 파일은 P3에서 supersession 주석과 함께 갱신한다. 삭제 금지(보호 intent 보존).
 * canonical truth lock (회귀 0):
 *   - 업로드 성공(서버 확인) 후에만 레코드/상태 전이 — placeholder success 금지.
 *   - 상태·카운트는 문서 레코드에서만 파생(하드코딩·seed 플래그 금지).
 */

import { describe, expect, it } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const MODAL = "src/components/receiving/receiving-doc-attach-modal.tsx";
const SHEET = "src/components/receiving/mobile-doc-attach-sheet.tsx";
// 정적 세그먼트 documents 아래 — api/receiving/[token](벤더 링크)과 슬러그 충돌 회피.
const ROUTE = "src/app/api/receiving/documents/[id]/route.ts";
// 실제 서버 업로드(XHR/fetch·2xx 게이트)는 훅 계층에 위임 — surface 는 훅만 소비.
const HOOK = "src/hooks/use-receiving-documents.ts";
const SCHEMA = "prisma/schema.prisma";

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8");
const exists = (rel: string) => existsSync(resolve(process.cwd(), rel));

describe("§receiving-doc-attach-canonical P2 — 서버 계약", () => {
  it("ReceivingDocument 모델 신설(입고 증빙 전용)", () => {
    const schema = read(SCHEMA);
    expect(schema).toMatch(/model ReceivingDocument /);
    expect(schema).toMatch(/bucket/);
    expect(schema).toMatch(/path/);
  });

  it("문서 라우트 존재 + ownership 게이트", () => {
    expect(exists(ROUTE)).toBe(true);
    const src = read(ROUTE);
    expect(src).toContain("auth()");
    expect(src).toMatch(/403/);
  });

  it("업로드 성공 후에만 레코드 생성 — placeholder success 금지", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/formData\(\)/);
    // 스토리지 업로드 호출이 레코드 생성보다 앞서야 함(성공 시에만 create).
    const uploadIdx = src.search(/upload[A-Za-z]*\(/);
    const createIdx = src.search(/receivingDocument\.create/);
    expect(uploadIdx).toBeGreaterThan(-1);
    expect(createIdx).toBeGreaterThan(-1);
    expect(uploadIdx).toBeLessThan(createIdx);
    // 스토리지 미설정은 명시 실패(삼킴 금지).
    expect(src).toMatch(/StorageNotConfiguredError|스토리지/);
  });

  it("⚠️ SDSDocument CHECK 무접촉 — 신규 migration 이 CHECK/SDSDocument 를 건드리지 않음", () => {
    const dir = resolve(process.cwd(), "prisma/migrations");
    const newDirs = readdirSync(dir).filter((d) => /receiving_document/i.test(d));
    expect(newDirs.length).toBeGreaterThan(0);
    for (const d of newDirs) {
      const sql = readFileSync(resolve(dir, d, "migration.sql"), "utf8");
      expect(sql).not.toMatch(/SDSDocument_coa_lot_check/);
      expect(sql).not.toMatch(/ALTER TABLE "SDSDocument"/);
      expect(sql).toMatch(/CREATE TABLE/); // additive
      expect(sql).not.toMatch(/DROP TABLE(?!.*IF EXISTS "ReceivingDocument")/);
    }
  });
});

describe("§receiving-doc-attach-canonical P3 — 모달·시트 배선", () => {
  const surfaces = [MODAL, SHEET];

  it("파일 선택기 존재 — 추가 클릭 즉시 완료 금지", () => {
    for (const f of surfaces) {
      const src = read(f);
      expect(src).toMatch(/type="file"|accept=/);
    }
  });

  it("업로드 진행률 + 취소", () => {
    for (const f of surfaces) {
      const src = read(f);
      expect(src).toMatch(/progress|진행률|업로드 중/);
      expect(src).toMatch(/취소|abort/i);
    }
  });

  it("서버 경유 업로드(로컬 dispatch 즉시 전이 아님) — surface 는 훅 위임", () => {
    // surface 는 인라인 fetch 대신 canonical 훅을 소비한다(업로드 배선은 훅 단일 소스).
    for (const f of surfaces) {
      const src = read(f);
      expect(src).toMatch(/useReceivingDocuments|use-receiving-documents/);
      // 구 front-only dispatch 경로가 남아있으면 안 됨.
      expect(src).not.toMatch(/attachReceivingDocument/);
    }
  });

  it("훅이 실제 서버 업로드·2xx 게이트 보유(front-only success 금지)", () => {
    const src = read(HOOK);
    // 실 전송 경로(XHR 또는 fetch)와 서버 확인 게이트가 훅에 존재해야 한다.
    expect(src).toMatch(/XMLHttpRequest|fetch\(|csrfFetch\(/);
    // 2xx 확인 후에만 성공 처리(placeholder success 금지).
    expect(src).toMatch(/status\s*>=\s*200|res\.ok|status\s*<\s*300/);
    expect(src).toMatch(/canonical API|documents/); // documents 라우트로 전송
  });

  it("데모 seed 플래그 참조 0 — 허위 첨부됨 금지", () => {
    for (const f of surfaces) {
      const src = read(f);
      expect(src).not.toMatch(/msdsAttached/);
      expect(src).not.toMatch(/coaAttached/);
    }
  });

  it("MSDS = 품목 단위 문서 연동(재첨부 불필요) 표기", () => {
    for (const f of surfaces) {
      const src = read(f);
      expect(src).toMatch(/품목에 등록됨|품목 연동|품목 문서/);
    }
  });

  it("푸터 카운트 파생(첨부·업로드 중·품목 연동)", () => {
    const src = read(MODAL);
    expect(src).toMatch(/첨부 \$\{|첨부 \{|attachedCount/);
    expect(src).toMatch(/품목 연동/);
  });

  it("빈 상태 — 데이터 0건 정직 표기(seed 폴백 금지)", () => {
    for (const f of surfaces) {
      const src = read(f);
      expect(src).toMatch(/없습니다|없음/);
    }
  });

  it("§9 신호등 — amber/orange 0", () => {
    for (const f of surfaces) {
      expect(read(f)).not.toMatch(/\bamber-\d|\borange-\d/);
    }
  });
});
