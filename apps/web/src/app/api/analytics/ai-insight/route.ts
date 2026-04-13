import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY ?? "";

const ANALYSIS_PROMPT = `당신은 연구 구매 운영 분석 전문가입니다.
아래 JSON 데이터는 연구실/조직의 최근 구매 지출 내역입니다.

데이터를 분석하여 다음을 한국어로 작성하세요:

1. **핵심 요약** (1-2문장): 전체 지출 상태를 한 문장으로 요약
2. **주요 발견** (2-3개): 눈에 띄는 패턴, 이상 징후, 집중 현상
3. **조치 권고** (1-2개): 즉시 또는 단기적으로 취할 수 있는 행동

규칙:
- 반드시 한국어로 작성
- 구체적 숫자와 비율을 포함
- 공급사명, 품목명 등 실제 데이터를 인용
- 과장하지 말고 데이터 기반으로만 분석
- JSON이 아닌 자연어 텍스트로 응답
- 마크다운 헤더(##) 사용하지 말 것, 볼드(**) 정도만 사용
- 총 200자 이내로 간결하게`;

export async function POST() {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'sensitive_data_export',
      targetEntityType: 'ai_action',
      targetEntityId: 'unknown',
      sourceSurface: 'web_app',
      routePath: '/analytics/ai-insight',
    });
    if (!enforcement.allowed) return enforcement.deny();

        if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // 워크스페이스 멤버십 조회
    const memberships = await db.workspaceMember.findMany({
      where: { userId },
      select: { workspaceId: true },
    });
    const wsIds = memberships.map((m: { workspaceId: string }) => m.workspaceId);

    // 최근 90일 구매 데이터 조회 (PurchaseRecord 모델 사용)
    const since = new Date(Date.now() - 90 * 86400000);
    const purchaseScopeKeys = [userId, ...wsIds];
    const purchases = await db.purchaseRecord.findMany({
      where: {
        OR: [
          { scopeKey: { in: purchaseScopeKeys } },
          ...(wsIds.length > 0 ? [{ workspaceId: { in: wsIds } }] : []),
        ],
        purchasedAt: { gte: since },
      },
      select: {
        itemName: true,
        vendorName: true,
        category: true,
        amount: true,
        purchasedAt: true,
      },
      orderBy: { purchasedAt: "desc" },
      take: 200,
    });

    if (purchases.length === 0) {
      return NextResponse.json({
        summary: "분석할 구매 데이터가 없습니다. 구매 내역이 축적되면 AI 분석이 가능합니다.",
        generated: false,
      });
    }

    // 집계 데이터 구성
    const totalAmount = purchases.reduce((s: number, p: any) => s + (p.amount ?? 0), 0);
    const vendorMap: Record<string, { count: number; amount: number }> = {};
    const categoryMap: Record<string, { count: number; amount: number }> = {};

    for (const p of purchases) {
      const v = p.vendorName || "미등록";
      if (!vendorMap[v]) vendorMap[v] = { count: 0, amount: 0 };
      vendorMap[v].count++;
      vendorMap[v].amount += p.amount ?? 0;

      const c = p.category || "기타";
      if (!categoryMap[c]) categoryMap[c] = { count: 0, amount: 0 };
      categoryMap[c].count++;
      categoryMap[c].amount += p.amount ?? 0;
    }

    const dataPayload = {
      period: "최근 90일",
      totalPurchases: purchases.length,
      totalAmount,
      vendors: Object.entries(vendorMap)
        .sort(([, a]: any, [, b]: any) => b.amount - a.amount)
        .slice(0, 10)
        .map(([name, data]: any) => ({ name, ...data, pct: Math.round((data.amount / totalAmount) * 100) })),
      categories: Object.entries(categoryMap)
        .sort(([, a]: any, [, b]: any) => b.amount - a.amount)
        .map(([name, data]: any) => ({ name, ...data, pct: Math.round((data.amount / totalAmount) * 100) })),
      recentHighSpend: purchases
        .filter((p: any) => (p.amount ?? 0) > totalAmount * 0.05)
        .slice(0, 5)
        .map((p: any) => ({
          item: p.itemName,
          vendor: p.vendorName,
          amount: p.amount,
          date: p.purchasedAt ? new Date(p.purchasedAt).toISOString().split("T")[0] : null,
        })),
    };

    let summary: string;

    if (!GEMINI_API_KEY) {
      // 로컬 fallback 분석
      const topVendor = dataPayload.vendors[0];
      const topCategory = dataPayload.categories[0];
      const lines: string[] = [];
      lines.push(`최근 90일간 총 ${purchases.length}건, ${totalAmount.toLocaleString()}원 지출.`);
      if (topVendor) lines.push(`최다 공급사: ${topVendor.name} (${topVendor.pct}%, ${topVendor.amount.toLocaleString()}원).`);
      if (topCategory) lines.push(`주요 카테고리: ${topCategory.name} (${topCategory.pct}%).`);
      if (dataPayload.recentHighSpend.length > 0) {
        lines.push(`고액 지출 ${dataPayload.recentHighSpend.length}건 감지 — 담당자 확인을 권장합니다.`);
      }
      summary = lines.join(" ");
    } else {
      try {
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: [
            {
              role: "user",
              parts: [
                { text: `${ANALYSIS_PROMPT}\n\n데이터:\n${JSON.stringify(dataPayload, null, 2)}` },
              ],
            },
          ],
          config: {
            temperature: 0.3,
            maxOutputTokens: 600,
          },
        });
        summary = response.text ?? "분석 결과를 생성하지 못했습니다.";
      } catch (importErr) {
        console.warn("[ai-insight] @google/genai 모듈 로드 실패, 로컬 fallback 사용:", importErr);
        const topVendor = dataPayload.vendors[0];
        summary = `최근 90일간 총 ${purchases.length}건, ${totalAmount.toLocaleString()}원 지출. 모듈 미설치로 상세 AI 분석은 제공되지 않습니다.`;
        if (topVendor) summary += ` 최다 공급사: ${topVendor.name} (${topVendor.pct}%).`;
      }
    }

    return NextResponse.json({
      summary,
      generated: true,
      dataPoints: purchases.length,
      analyzedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    console.error("[ai-insight]", err);
    const message = err instanceof Error ? err.message : "AI 분석 중 오류 발생";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
