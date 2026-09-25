/**
 * §approval-gate-single-source (2026-09-25 · 호영님 판정)
 *
 * 로그인 뒤 화면이 결재 표면을 그릴지 말지 물어보는 자리.
 * 🛑 판정은 여기서 하지 않는다 — `lib/approval/approval-capability.server` 가 한다.
 *    그 모듈이 `request-approval` 라우트의 400 두 개와 **같은 술어**를 쓴다.
 *
 * 화면이 요금제 이름을 직접 읽지 않게 하려고 둔 엔드포인트다.
 * 오늘 prod 에서는 모든 사용자에게 `enabled: false` 다(정책 none · 결제 게이트 닫힘 · ADMIN 0).
 * 결재가 실제로 켜지는 날 저절로 true 가 되고 표면이 따라 나타난다.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveApprovalCapability } from "@/lib/approval/approval-capability.server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const capability = await resolveApprovalCapability(session.user.id);
  return NextResponse.json(capability);
}
