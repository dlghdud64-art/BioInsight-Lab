import { describe, it, expect } from "vitest";
import { extractTemplateCandidates, applyTemplateHints } from "../vendor-template";

/**
 * §scan-recognition-upgrade P4 — 공급사 템플릿 학습·주입 순수함수 계약.
 * 🛑 RED 단계 — 구현은 호영님 "진행"(prod DDL 적용) 뒤에만(§9 순서).
 *
 * 잠그는 계약:
 *   1) 학습 대상 = **사람이 보정한 필드만**(ocr 값 ≠ 확정값). 보정 0건 → [].
 *      앵커 = 값 앞 문맥 ≤ 40자(정규화). 지어내는 앵커 0.
 *   2) 주입 = 앵커 매칭 시 후보 반환(source: "template") · 미매칭 = [] (기존 tier 폴백).
 *      자동 확정 축 없음 — 후보일 뿐.
 *   3) 회차 정확도: 1회차 보정 → 학습 → 2회차 같은 서식에서 해당 필드 hit.
 */

// 픽스처 — 기존 LOT 앵커(label-parser)가 모르는 국문 서식("제조번호").
const DOC_ROUND1 = ["시험 성적서", "품명: 완충액 키트", "제조번호: ABC-123", "유효기한: 2027-01-01"].join("\n");
const DOC_ROUND2 = ["시험 성적서", "품명: 완충액 키트", "제조번호: XYZ-999", "유효기한: 2027-06-30"].join("\n");

describe("§scan-recognition-upgrade P4 — extractTemplateCandidates (학습)", () => {
  it("보정된 필드만 학습 — ocr null → 확정 ABC-123 = 후보 1건 (값 앞 문맥 ≤ 40자)", () => {
    const out = extractTemplateCandidates(
      DOC_ROUND1,
      { lot: "ABC-123" }, // 사람 확정값
      { lot: null }, // ocr 추출값(실패)
    );
    expect(out).toHaveLength(1);
    expect(out[0].fieldKey).toBe("lot");
    expect(out[0].anchorPattern.length).toBeLessThanOrEqual(40);
    expect(out[0].anchorPattern).toContain("제조번호");
  });

  it("보정 0건(ocr == 확정) → [] — 이미 잡는 서식은 학습하지 않는다", () => {
    const out = extractTemplateCandidates(DOC_ROUND1, { lot: "ABC-123" }, { lot: "ABC-123" });
    expect(out).toEqual([]);
  });

  it("확정값이 원문에 없으면 후보 0 — 앵커를 지어내지 않는다", () => {
    const out = extractTemplateCandidates(DOC_ROUND1, { lot: "NOT-IN-DOC" }, { lot: null });
    expect(out).toEqual([]);
  });

  // §P4-fix (호영님 실측 2026-08-31) — Tier 1(Gemini) 의 OcrResult.rawText 는 문서 원문이
  //   아니라 **모델이 뱉은 JSON**(gemini-label-parser `rawText: jsonStr`)이다.
  //   그대로 학습하면 앵커가 `"lotNumber": "` 같은 출력 스키마가 되어
  //   전 공급사에 같은 앵커가 쌓이고, 2회차 힌트는 이미 파서가 뽑은 값을 되돌려주는 무효값이 된다.
  it("JSON 형태 rawText → 후보 0 (모델 출력 스키마 오학습 차단)", () => {
    const jsonRaw = '{"catalogNo":null,"lotNo":"L-1","expirationDate":"2027-01-01"}';
    expect(extractTemplateCandidates(jsonRaw, { lot: "L-1" }, { lot: null })).toEqual([]);
  });

  it("앵커에 JSON 토큰(`\":` · `{\"`)이 섞이면 폐기 — 부분 JSON 혼입 방어", () => {
    const mixed = '문서 머리글\n{"lotNo": "ABC-9"}';
    const out = extractTemplateCandidates(mixed, { lot: "ABC-9" }, { lot: null });
    expect(out).toEqual([]);
  });
});

describe("§scan-recognition-upgrade P4 — applyTemplateHints (주입) + 회차 정확도", () => {
  it("1회차 학습 → 2회차 같은 서식 hit (source: template · 후보일 뿐)", () => {
    const learned = extractTemplateCandidates(DOC_ROUND1, { lot: "ABC-123" }, { lot: null });
    const hints = applyTemplateHints(DOC_ROUND2, learned);
    expect(hints).toHaveLength(1);
    expect(hints[0]).toMatchObject({ fieldKey: "lot", value: "XYZ-999", source: "template" });
    // 자동 확정 축 없음 — 후보 shape 고정.
    expect(Object.keys(hints[0]).sort()).toEqual(["fieldKey", "source", "value"]);
  });

  it("앵커 미매칭 서식 → [] (기존 tier 폴백)", () => {
    const learned = extractTemplateCandidates(DOC_ROUND1, { lot: "ABC-123" }, { lot: null });
    const hints = applyTemplateHints("전혀 다른 서식\nLot No.: QQ-1", learned);
    expect(hints).toEqual([]);
  });
});
