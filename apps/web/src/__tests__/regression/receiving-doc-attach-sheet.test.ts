/**
 * #receiving-doc-attach-sheet (호영님 2026-07-06) — 문서 첨부 바텀시트 시안 정합.
 * Dialog→Sheet(bottom) + 문서별 상태 체크리스트 + 진행률 + 완료 CTA(게이트) + 실 게이트 전이.
 * 촬영/파일 = 정직-disabled(실 업로드 입고 DB 연동 후, fake upload 0).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const C = readFileSync(
  join(__dirname, "..", "..", "components/receiving/receiving-doc-attach-modal.tsx"),
  "utf8",
);

describe("#receiving-doc-attach-sheet — 바텀시트 전환", () => {
  it("Sheet(side=bottom) 사용, Dialog 제거", () => {
    expect(C).toMatch(/from "@\/components\/ui\/sheet"/);
    expect(C).toMatch(/side="bottom"/);
    expect(C).not.toMatch(/from "@\/components\/ui\/dialog"/);
  });
  it("문서별 상태(미첨부 rose / 첨부됨 emerald) + 진행률 + 완료 CTA(게이트)", () => {
    expect(C).toMatch(/bg-rose-50 border-rose-200/); // 미첨부
    expect(C).toMatch(/bg-emerald-50 border-emerald-200/); // 첨부됨
    expect(C).toMatch(/첨부됨/);
    expect(C).toMatch(/필수 \{remaining\}건 남음/); // 진행률
    expect(C).toMatch(/문서 첨부 완료/); // 완료 CTA
    expect(C).toMatch(/disabled=\{!allDone/); // 필수 충족 시에만 활성
  });
});

describe("#receiving-doc-attach-sheet — no-op 0(정직)", () => {
  it("첨부 = 실 게이트 전이(onAttach) 보존", () => {
    expect(C).toMatch(/onClick=\{\(\) => onAttach\(line\.id, type\)\}/);
  });
  it("촬영/파일선택 = 정직-disabled(fake upload 0)", () => {
    expect(C).toMatch(/촬영/);
    expect(C).toMatch(/파일 선택/);
    expect(C).toMatch(/입고 DB 연동 후/); // 정직 안내
    // 촬영/파일 버튼은 disabled(실 업로드 미배선 — fake 금지)
    expect(C).toMatch(/disabled\n\s*className/);
  });
});
