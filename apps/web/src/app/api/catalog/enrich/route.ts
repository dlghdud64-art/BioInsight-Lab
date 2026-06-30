/**
 * GET /api/catalog/enrich?cas=&name= — §pubchem-enrich (호영님 2026-06-30)
 *
 * Tier 2 substance 보강: CAS(우선)/제품명 → PubChem 정규화명·동의어·분자식(무키·무료).
 * 읽기 전용·canonical(db.product) 무접촉·best-effort(무결과/실패 → enrichment:null, 200).
 * scan-label 인라인 X — 리뷰 카드 렌더 후 클라이언트가 비동기 호출(스캔 속도 무영향).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { pubchemEnrich } from "@/lib/catalog/pubchem-enrich";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const cas = searchParams.get("cas");
  const name = searchParams.get("name");

  if (!cas && !name) {
    return NextResponse.json({ enrichment: null });
  }

  // best-effort — 실패/무결과는 enrichment:null(에러 아님). 스캔 흐름 차단 0.
  const enrichment = await pubchemEnrich({ cas, name });
  return NextResponse.json({ enrichment });
}
