/**
 * POST /api/pricing-assistant — 요금 페이지 "AI에게 바로 물어보기" 즉답 백엔드.
 *
 * §pricing-assistant (호영님 2026-06-27) — 시안의 window.claude.complete(아티팩트 전용)는
 *   라이브에 없으므로 서버 라우트 → Anthropic 으로 실배선. 핵심 규약:
 *   - 절대 5xx 던지지 않음: 키 없음/타임아웃/에러 전부 200 + 폴백 문구(프런트 불깨짐).
 *   - max_tokens 작게(2문장 강제) + slice(0,400)로 인젝션·과금 방어.
 *   - ANTHROPIC_API_KEY 서버 전용(NEXT_PUBLIC_ 금지).
 *   - 가격 89,000 / 259,000 = plan-descriptor SSOT 정합.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SYSTEM = `당신은 연구 구매 운영 플랫폼 "LabAxis"의 요금·도입 안내 도우미입니다.
플랜: Free(1인·견적 월 3건·재고 10), Basic(₩89,000/월·3명·견적/구매 무제한·재고 50·AI 견적비교·활동로그), Pro(₩259,000/월·10명·재고 200·승인 1단계·LOT/GMP 추적·감사 PDF), Enterprise(계약형·SSO/SAML·전담 온보딩·기관 SLA). 연간 결제 시 약 11% 할인(출시 후 적용). 무료체험·자동결제 등 미확정 혜택은 지어내지 말고 도입 문의로 안내.
기능: 시약·장비 통합검색, 구매 후보 비교, 견적 요청(RFQ), 발주 준비, 입고·재고·Lot 운영, AI 견적 비교/문서 추출/운영 브리핑.
답변 규칙(반드시): 한국어로 친절·전문적으로 딱 2문장. 목록·단계·마크다운 금지. 이모지·장식 기호 금지. 확정 안 된 숫자/SLA/기관명은 지어내지 말고 "도입 문의를 남겨주시면 담당자가 안내"로 유도. 위에 적힌 플랜 가격·혜택은 사용해도 됩니다.`;

// AI 불가 시 폴백(키 매핑은 클라이언트 chip 의 fbKey 와 동일)
const FB: Record<string, string> = {
  "0": "조직 규모와 필요한 통제 수준에 맞춰 추천드리며, 1~3인은 Free·Basic, 다부서·승인/감사가 필요하면 Pro·Enterprise가 적합합니다. 정확한 추천은 도입 문의를 남겨주시면 담당자가 운영 규모를 보고 안내드립니다.",
  "1": "네, 도입 후에도 상위 플랜으로 언제든 업그레이드할 수 있고 좌석도 추가할 수 있습니다. 변경 시점의 정산 방식은 도입 문의를 남겨주시면 정확히 안내드립니다.",
  "2": "네, Free로 가입 즉시 검색·비교·견적 요청부터 바로 시작하실 수 있습니다. 조직 단위 설정이 필요하면 도입 문의를 남겨주시면 함께 설계해 드립니다.",
  "3": "Enterprise는 좌석·운영량 협의와 보안 검토를 거쳐 계약형으로 진행되며 SSO/SAML과 전담 온보딩이 포함됩니다. 구체 절차는 도입 문의를 남겨주시면 담당자가 단계별로 안내드립니다.",
  def: "문의해 주신 내용은 플랜 구성과 도입 범위에 따라 달라질 수 있습니다. 도입 문의를 남겨주시면 담당자가 환경에 맞춰 정확히 안내드립니다.",
};

const stripEmoji = (s: string) =>
  s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, "");
const stripMd = (s: string) =>
  s.replace(/^#{1,6}\s*/gm, "").replace(/^\s*[-*]\s+/gm, "").replace(/^\s*---+\s*$/gm, "")
   .replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").replace(/`([^`]+)`/g, "$1");
const clean = (s: string) =>
  stripMd(stripEmoji(s)).replace(/\n{2,}/g, " ").replace(/\n/g, " ").replace(/\s{2,}/g, " ").trim();

export async function POST(req: Request) {
  let q = "", fbKey = "def";
  try {
    const body = (await req.json()) as { q?: string; fbKey?: string };
    q = (body.q || "").slice(0, 400).trim();
    fbKey = body.fbKey && FB[body.fbKey] ? body.fbKey : "def";
  } catch {
    return NextResponse.json({ answer: FB.def }, { status: 200 });
  }
  if (!q) return NextResponse.json({ answer: FB.def }, { status: 200 });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ answer: FB[fbKey] }, { status: 200 }); // 키 없으면 폴백

  try {
    // §11.290 정합 — @anthropic-ai/sdk dynamic import(sandbox vitest 호환 + tree-shake).
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: key });
    const msg = await client.messages.create({
      model: "claude-3-5-haiku-latest", // 즉답·저비용. 필요 시 sonnet 으로.
      max_tokens: 220,
      system: SYSTEM,
      messages: [{ role: "user", content: q }],
    });
    const raw = msg.content.map((b) => (b.type === "text" ? b.text : "")).join(" ");
    const answer = clean(raw) || FB[fbKey];
    return NextResponse.json({ answer }, { status: 200 });
  } catch {
    return NextResponse.json({ answer: FB[fbKey] }, { status: 200 }); // 실패해도 항상 200 + 폴백
  }
}
