/**
 * ⚠️ SUPERSEDED by §receiving-doc-attach-canonical (T1, 2026-07-31).
 *
 * 이 파일이 잠그던 배선은 데모 store 기반(onAttach = store.attachReceivingDocument, 로컬 dispatch)이었다.
 * 당시 주석은 "front-only 아님" 이라 표기했으나, 실제로는 서버 저장이 없는 in-memory 게이트 전이였고
 * 핸드오프 §0 이 이를 release blocker(front-only success)로 판정했다.
 *
 * 보호 intent 는 폐기하지 않고 canonical 기준으로 승격 이관한다:
 *   - "첨부 성공 이후에만 성공 피드백" → 서버 2xx 확인 후 토스트 (receiving-doc-attach-canonical.test.ts)
 *   - "개별 버튼이 래퍼 경유(직접 호출 금지)" → 업로드 헬퍼 경유 + 진행률/취소 (동 sentinel)
 *   - "가짜 성공 금지" → 스토리지 업로드 성공 후에만 DB 레코드 생성 (동 sentinel P2)
 *
 * 따라서 옛 시그니처 단언은 제거하고, 회귀 방지는 신 sentinel 이 담당한다. 파일은 이력 보존용으로 남긴다.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MODAL = "src/components/receiving/receiving-doc-attach-modal.tsx";
const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8");

describe("§receiving-doc-attach-canonical — v2 폼팩터 보존(승격 보존)", () => {
  it("same-canvas 센터 Dialog 유지(바텀 Sheet 회귀 금지)", () => {
    const src = read(MODAL);
    expect(src).not.toMatch(/from "@\/components\/ui\/sheet"/);
    expect(src).toMatch(/role="dialog"/);
    expect(src).toMatch(/aria-modal="true"/);
    expect(src).toMatch(/items-center justify-center/);
  });

  it("정직-disabled 드롭존 문구는 실업로드로 승격(잔존 금지)", () => {
    const src = read(MODAL);
    expect(src).not.toMatch(/파일 업로드는 입고 DB 연동 후 제공됩니다/);
    expect(src).toMatch(/type="file"/);
  });
});
