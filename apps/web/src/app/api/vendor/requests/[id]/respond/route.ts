import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/vendor/requests/[id]/respond — **미구현. 성공을 반환하지 않는다.**
 *
 * §placeholder-success-audit (2026-08-10, 호영님 P1 분리 처리)
 *
 * 이전 상태: 본문을 파싱만 하고 DB 에 아무것도 쓰지 않은 채
 *   `{ success: true, message: "Response submitted successfully" }` 를 반환했다.
 *   (실측 보정: zod 스키마가 `items` 를 요구하는데 UI 는 `responses` 를 보내
 *    항상 500 으로 떨어지고 있었다 — 저장도 성공 응답도 실제로는 없었다.)
 *
 * 왜 라우트까지 막는가: 다른 호출자(모바일·외부 연동)가 있을 수 있어 UI 차단만으로는
 *   부족하다. 라우트가 스스로 "구현되지 않았다" 를 말해야 한다.
 *
 * 실제로 동작하는 벤더 회신 경로는 **토큰 기반** `/api/vendor-requests/[token]/response`
 *   다 (quoteVendorResponseItem upsert + quoteVendorRequest status 갱신).
 *   로그인 포털 경로를 그쪽과 통합하는 것이 §vendor-request-respond 트랙이며,
 *   회신 상태값이 §quote-status-vocabulary 와 얽혀 있어 지금 구현하지 않는다.
 */
export async function POST(
  _request: NextRequest,
  _context: { params: Promise<{ id: string }> }
) {
  return NextResponse.json(
    {
      error:
        "이 경로의 견적 회신은 아직 열려 있지 않습니다. 요청 메일의 회신 링크를 사용해 주세요.",
      code: "VENDOR_RESPOND_NOT_IMPLEMENTED",
    },
    { status: 501 }
  );
}
