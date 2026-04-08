/**
 * POST /api/ai/safety-check
 *
 * 발주 품목의 이름을 분석하여 화학물질 위험성, 규제 사항,
 * 필수 보호구, 보관 조건 등을 자동으로 안내합니다.
 *
 * Gemini AI 사용 + 로컬 fallback (API 키 없을 때)
 */

import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY ?? "";

const SAFETY_CHECK_PROMPT = `You are an AI Lab Safety & Compliance Officer (EHS) in South Korea.
Check the following item for chemical safety and regulatory compliance.

Item Name: {itemName}
Category: {category}

Identify if it's a hazardous chemical or requires special handling.
Consider Korean regulations: 화학물질관리법(화관법), 산업안전보건법, 위험물안전관리법.
If it is a general item (like a laptop, standard plastic tube, or paper), mark isHazardous as false.

Return ONLY a valid JSON object (no markdown, no code blocks):
{
  "isHazardous": boolean,
  "hazardClass": "string in Korean (e.g., '인화성 액체', '독성물질', '해당없음')",
  "ghs_pictograms": ["string (GHS pictogram codes, e.g., 'GHS02', 'GHS06')"],
  "requiredPPE": ["string in Korean (e.g., '보안경', '니트릴 장갑', '방독마스크')"],
  "storageRequirements": "string in Korean (e.g., '서늘하고 환기가 잘 되는 곳에 보관, 열원으로부터 격리')",
  "regulatoryWarnings": ["string in Korean (e.g., '화관법 유독물질 해당', 'MSDS 필수 비치', '특별관리물질')"],
  "handlingPrecautions": "string in Korean with key handling notes",
  "riskLevel": "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
}`;

interface SafetyCheckRequest {
  itemName: string;
  category?: string;
}

interface SafetyCheckResult {
  isHazardous: boolean;
  hazardClass: string;
  ghs_pictograms: string[];
  requiredPPE: string[];
  storageRequirements: string;
  regulatoryWarnings: string[];
  handlingPrecautions: string;
  riskLevel: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

// ── 화학물질 키워드 DB (로컬 fallback용) ─────────────────────────

const HAZARDOUS_KEYWORDS: Array<{
  pattern: RegExp;
  hazardClass: string;
  ghs: string[];
  ppe: string[];
  storage: string;
  warnings: string[];
  handling: string;
  risk: SafetyCheckResult["riskLevel"];
}> = [
  {
    pattern: /메탄올|methanol|메틸알코올/i,
    hazardClass: "인화성 액체 / 독성물질",
    ghs: ["GHS02", "GHS06", "GHS08"],
    ppe: ["보안경", "니트릴 장갑", "흄후드 사용"],
    storage: "서늘하고 환기가 잘 되는 곳, 열원 격리, 밀폐 용기",
    warnings: ["화관법 유독물질 해당", "MSDS 필수 비치", "인화점 11°C 주의"],
    handling: "흄후드에서만 취급, 정전기 방지 조치 필요",
    risk: "HIGH",
  },
  {
    pattern: /에탄올|ethanol|에틸알코올/i,
    hazardClass: "인화성 액체",
    ghs: ["GHS02"],
    ppe: ["보안경", "니트릴 장갑"],
    storage: "서늘하고 환기가 잘 되는 곳, 화기 엄금",
    warnings: ["위험물안전관리법 4류 해당", "MSDS 필수 비치"],
    handling: "환기가 잘 되는 곳에서 취급",
    risk: "MEDIUM",
  },
  {
    pattern: /포름알데히드|formaldehyde|파라포름알데히드|paraformaldehyde/i,
    hazardClass: "독성물질 / 발암성",
    ghs: ["GHS06", "GHS08"],
    ppe: ["보안경", "니트릴 장갑", "방독마스크", "실험복"],
    storage: "밀폐 용기, 서늘한 곳, 환기 필수",
    warnings: ["화관법 유독물질 해당", "MSDS 필수 비치", "특별관리물질(발암성 1A)", "작업환경측정 대상"],
    handling: "반드시 흄후드 내에서 취급, 피부 접촉 절대 금지",
    risk: "CRITICAL",
  },
  {
    pattern: /클로로포름|chloroform|트리클로로메탄/i,
    hazardClass: "독성물질",
    ghs: ["GHS06", "GHS08"],
    ppe: ["보안경", "니트릴 장갑", "흄후드 사용"],
    storage: "차광 밀폐 용기, 서늘한 곳",
    warnings: ["화관법 유독물질 해당", "MSDS 필수 비치", "간독성 주의"],
    handling: "흄후드에서만 취급, 장시간 노출 금지",
    risk: "HIGH",
  },
  {
    pattern: /트리졸|trizol|TRIzol/i,
    hazardClass: "독성물질 (페놀 함유)",
    ghs: ["GHS05", "GHS06"],
    ppe: ["보안경", "니트릴 장갑(이중)", "실험복", "흄후드 사용"],
    storage: "냉장 보관 (2-8°C), 밀폐 용기",
    warnings: ["화관법 유독물질 해당 (페놀 성분)", "MSDS 필수 비치", "피부 화상 위험"],
    handling: "흄후드에서만 취급, 피부 접촉 시 즉시 세척",
    risk: "HIGH",
  },
  {
    pattern: /DMSO|디메틸설폭사이드/i,
    hazardClass: "피부 침투성 용매",
    ghs: ["GHS07"],
    ppe: ["니트릴 장갑", "보안경"],
    storage: "실온, 밀폐 용기",
    warnings: ["피부를 통한 유해물질 흡수 촉진 주의", "MSDS 비치 권장"],
    handling: "유해물질과 혼합 사용 시 장갑 필수",
    risk: "LOW",
  },
  {
    pattern: /아세톤|acetone/i,
    hazardClass: "인화성 액체",
    ghs: ["GHS02", "GHS07"],
    ppe: ["보안경", "니트릴 장갑"],
    storage: "화기 엄금, 환기가 잘 되는 곳",
    warnings: ["위험물안전관리법 4류 해당", "MSDS 필수 비치"],
    handling: "환기 필수, 화기 근처 사용 금지",
    risk: "MEDIUM",
  },
  {
    pattern: /염산|hydrochloric|HCl/i,
    hazardClass: "부식성 물질",
    ghs: ["GHS05", "GHS07"],
    ppe: ["보안경", "내산 장갑", "실험복", "흄후드 사용"],
    storage: "내산 용기, 환기가 잘 되는 곳",
    warnings: ["화관법 유독물질 해당", "MSDS 필수 비치", "부식성 증기 발생"],
    handling: "반드시 흄후드 사용, 금속 접촉 금지",
    risk: "HIGH",
  },
  {
    pattern: /황산|sulfuric|H2SO4/i,
    hazardClass: "부식성 물질",
    ghs: ["GHS05"],
    ppe: ["보안경", "내산 장갑", "실험복", "페이스 실드"],
    storage: "내산 용기, 유기물과 격리",
    warnings: ["화관법 유독물질 해당", "MSDS 필수 비치", "물과 접촉 시 발열"],
    handling: "희석 시 반드시 산을 물에 넣을 것 (역순 금지)",
    risk: "CRITICAL",
  },
  {
    pattern: /에티디움|ethidium|EtBr/i,
    hazardClass: "변이원성 물질",
    ghs: ["GHS06", "GHS08"],
    ppe: ["니트릴 장갑(이중)", "보안경", "실험복"],
    storage: "차광 용기, 지정 폐기물 수거함",
    warnings: ["MSDS 필수 비치", "변이원성 물질 — 특별폐기물로 처리", "배수구 폐기 절대 금지"],
    handling: "전용 구역에서 취급, 폐액은 지정 용기에 수거",
    risk: "HIGH",
  },
];

function localSafetyCheck(req: SafetyCheckRequest): SafetyCheckResult {
  const name = req.itemName;

  for (const entry of HAZARDOUS_KEYWORDS) {
    if (entry.pattern.test(name)) {
      return {
        isHazardous: true,
        hazardClass: entry.hazardClass,
        ghs_pictograms: entry.ghs,
        requiredPPE: entry.ppe,
        storageRequirements: entry.storage,
        regulatoryWarnings: entry.warnings,
        handlingPrecautions: entry.handling,
        riskLevel: entry.risk,
      };
    }
  }

  // 일반 시약/소모품 기본 판정
  const isReagent = /시약|reagent|buffer|solution|antibody|enzyme|primer|media|serum|fbs|dmem|pbs/i.test(name);
  if (isReagent) {
    return {
      isHazardous: false,
      hazardClass: "일반 시약",
      ghs_pictograms: [],
      requiredPPE: ["니트릴 장갑", "보안경"],
      storageRequirements: "제조사 권장 온도에 따라 보관",
      regulatoryWarnings: ["MSDS 비치 권장"],
      handlingPrecautions: "기본 실험실 안전 수칙 준수",
      riskLevel: "LOW",
    };
  }

  return {
    isHazardous: false,
    hazardClass: "해당없음",
    ghs_pictograms: [],
    requiredPPE: [],
    storageRequirements: "일반 보관",
    regulatoryWarnings: [],
    handlingPrecautions: "특별한 취급 주의사항 없음",
    riskLevel: "NONE",
  };
}

// ── Route Handler ────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body: SafetyCheckRequest = await request.json();

    if (!body.itemName) {
      return NextResponse.json(
        { success: false, error: "itemName 필수" },
        { status: 400 },
      );
    }

    // Gemini API 호출 시도
    if (GEMINI_API_KEY) {
      try {
        const prompt = SAFETY_CHECK_PROMPT
          .replace("{itemName}", body.itemName)
          .replace("{category}", body.category ?? "미분류");

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 1024,
              },
            }),
          },
        );

        if (res.ok) {
          const json = await res.json();
          const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          const parsed: SafetyCheckResult = JSON.parse(cleaned);
          return NextResponse.json({ success: true, data: parsed, source: "gemini" });
        }
      } catch {
        // Gemini 실패 시 fallback
      }
    }

    // 로컬 fallback
    const result = localSafetyCheck(body);
    return NextResponse.json({ success: true, data: result, source: "local" });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Safety check 분석 중 오류 발생" },
      { status: 500 },
    );
  }
}
