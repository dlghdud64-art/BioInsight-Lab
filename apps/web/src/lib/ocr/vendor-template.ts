/**
 * §scan-recognition-upgrade P4 — 공급사 템플릿 학습·주입 순수함수.
 *
 * 학습: **사람이 보정한 필드만**(ocr 값 ≠ 확정값) 대상으로 값 앞 문맥(≤40자, 정규화)을
 *   앵커로 추출한다. 확정값이 원문에 없으면 후보 0 — 앵커를 지어내지 않는다.
 * 주입: 앵커가 매칭되면 필드값 **후보**를 돌려줄 뿐(source: "template") —
 *   자동 확정 축 없음. 미매칭이면 [] (기존 3-tier 폴백).
 * DB 접촉 0 — 저장/조회는 vendor-template-store(서버 전용)가 담당.
 */

export interface TemplateCandidate {
  fieldKey: string;
  /** 값 앞 문맥(공백 정규화, ≤40자) */
  anchorPattern: string;
  valuePattern?: string | null;
}

export interface TemplateHint {
  fieldKey: string;
  value: string;
  source: "template";
}

const ANCHOR_MAX = 40;

function normalizeContext(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** 사람 보정 필드에서 앵커 후보 추출 — 보정 0건이면 []. */
export function extractTemplateCandidates(
  rawText: string,
  confirmedFields: Record<string, string | null | undefined>,
  ocrFields: Record<string, string | null | undefined>,
): TemplateCandidate[] {
  const out: TemplateCandidate[] = [];
  for (const [fieldKey, confirmedRaw] of Object.entries(confirmedFields)) {
    const confirmedValue = confirmedRaw?.trim();
    if (!confirmedValue) continue;
    const ocrValue = ocrFields[fieldKey]?.trim() ?? null;
    if (ocrValue === confirmedValue) continue; // 보정 아님 — 이미 잡는 서식은 학습 X

    const idx = rawText.indexOf(confirmedValue);
    if (idx < 0) continue; // 원문에 없는 값 — 앵커를 지어내지 않는다

    // 값 앞 같은 줄 문맥 우선(서식 앵커) · 없으면 직전 ≤40자.
    const before = rawText.slice(Math.max(0, idx - ANCHOR_MAX), idx);
    const lastLine = before.split("\n").pop() ?? "";
    const anchor = normalizeContext(lastLine) || normalizeContext(before);
    if (!anchor) continue;
    out.push({ fieldKey, anchorPattern: anchor.slice(-ANCHOR_MAX) });
  }
  return out;
}

/** 앵커 매칭 시 필드값 후보 반환 — 후보일 뿐, 확정은 사람. */
export function applyTemplateHints(
  rawText: string,
  templates: TemplateCandidate[],
): TemplateHint[] {
  const lines = rawText.split("\n").map((l) => normalizeContext(l));
  const out: TemplateHint[] = [];
  const seen = new Set<string>();
  for (const t of templates) {
    if (seen.has(t.fieldKey)) continue; // 필드당 첫 매칭만
    for (const line of lines) {
      const at = line.indexOf(t.anchorPattern);
      if (at < 0) continue;
      const value = line.slice(at + t.anchorPattern.length).trim();
      if (!value) continue;
      if (t.valuePattern) {
        try {
          if (!new RegExp(t.valuePattern).test(value)) continue;
        } catch {
          // 잘못 저장된 패턴은 무시(힌트 미적용) — 파싱 중단 금지
          continue;
        }
      }
      out.push({ fieldKey: t.fieldKey, value, source: "template" });
      seen.add(t.fieldKey);
      break;
    }
  }
  return out;
}
