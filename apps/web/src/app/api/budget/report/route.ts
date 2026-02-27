import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import * as XLSX from "xlsx";

function formatKRW(n: number) {
  return `₩${n.toLocaleString("ko-KR")}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    // 1. 스코프 키 결정
    let scopeKey: string;
    let orgName = "개인 연구실";
    if (organizationId) {
      const membership = await db.organizationMember.findFirst({
        where: { userId: session.user.id, organizationId },
        include: { organization: true },
      });
      if (!membership) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      scopeKey = organizationId;
      orgName = (membership as any).organization?.name ?? orgName;
    } else {
      const userOrg = await db.organizationMember.findFirst({
        where: { userId: session.user.id },
        include: { organization: true },
      });
      if (userOrg) {
        scopeKey = userOrg.organizationId;
        orgName = (userOrg as any).organization?.name ?? orgName;
      } else {
        scopeKey = `user-${session.user.id}`;
        orgName = session.user.name ?? "개인";
      }
    }

    // 2. 현재 예산 조회
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const activeBudget = await db.budget.findFirst({
      where: { scopeKey },
      orderBy: { yearMonth: "desc" },
    });

    if (!activeBudget) {
      return NextResponse.json({ error: "등록된 예산이 없습니다." }, { status: 404 });
    }

    const budgetName =
      activeBudget.description?.match(/^\[([^\]]+)\]/)?.[1] ?? currentYearMonth + " 예산";

    // 3. 최근 3개월 구매 기록
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const purchaseRecords = await db.purchaseRecord.findMany({
      where: { scopeKey, purchasedAt: { gte: threeMonthsAgo } },
      orderBy: { purchasedAt: "asc" },
    });

    // 4. 월별 소진액 집계
    const monthlySpend: Record<string, number> = {};
    const categorySpend: Record<string, number> = {};
    for (const r of purchaseRecords) {
      const ym = `${r.purchasedAt.getFullYear()}-${String(r.purchasedAt.getMonth() + 1).padStart(2, "0")}`;
      monthlySpend[ym] = (monthlySpend[ym] || 0) + ((r as any).amount || 0);
      const cat = (r as any).category || "기타";
      categorySpend[cat] = (categorySpend[cat] || 0) + ((r as any).amount || 0);
    }

    const monthKeys = Object.keys(monthlySpend).sort();
    const monthlyAmounts = monthKeys.map((k) => monthlySpend[k]);
    const totalSpent3M = monthlyAmounts.reduce((s, v) => s + v, 0);
    const avgMonthlyBurnRate = monthKeys.length > 0 ? totalSpent3M / monthKeys.length : 0;
    const dailyBurnRate = avgMonthlyBurnRate / 30;

    const totalSpentAll = purchaseRecords.reduce(
      (s: number, r: any) => s + (r.amount || 0),
      0
    );
    const remaining = Math.max(activeBudget.amount - totalSpentAll, 0);

    // 5. 고갈일 예측
    let runwayDays: number | null = null;
    let exhaustDate: string | null = null;
    if (dailyBurnRate > 0 && remaining > 0) {
      runwayDays = Math.floor(remaining / dailyBurnRate);
      const exhaustAt = new Date(now);
      exhaustAt.setDate(exhaustAt.getDate() + runwayDays);
      exhaustDate = exhaustAt.toISOString().slice(0, 10);
    }

    // 6. 이상치 감지
    const lastMonthDate = new Date(now);
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    const lastYearMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;
    const thisMonthSpend = monthlySpend[currentYearMonth] || 0;
    const lastMonthSpend = monthlySpend[lastYearMonth] || 0;
    const hasWarning = lastMonthSpend > 0 && thisMonthSpend > lastMonthSpend * 1.2;
    const warningNote = hasWarning
      ? `이번 달 지출이 전월 대비 ${Math.round(((thisMonthSpend - lastMonthSpend) / lastMonthSpend) * 100)}% 증가하였습니다. 주요 구매 항목 검토가 필요합니다.`
      : "최근 3개월간 소진 속도가 안정적입니다.";

    // 카테고리별 상위 소비 항목
    const topCategories = Object.entries(categorySpend)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat, amt]) => `${cat}: ${formatKRW(amt)}`)
      .join(" / ") || "데이터 없음";

    // 7. 권장 증액 금액 계산 (월말까지 + 1개월 안전 버퍼)
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysLeft = daysInMonth - now.getDate();
    const bufferMonths = 1;
    const recommendedIncrease = Math.ceil(dailyBurnRate * (daysLeft + bufferMonths * 30));

    // 8. 엑셀 생성
    const wb = XLSX.utils.book_new();

    // 메인 보고서 시트
    const today = formatDate(now.toISOString());
    const exhaustDisplay = exhaustDate
      ? `${formatDate(exhaustDate)} (D-${runwayDays})`
      : "데이터 부족";

    const reportData = [
      ["예산 소진 예측 및 증액 요청서"],
      [],
      ["항목", "내용"],
      ["작성일자", today],
      ["대상 조직명", orgName],
      ["예산 항목명", budgetName],
      [],
      ["현재 예산 현황"],
      ["총 예산", formatKRW(activeBudget.amount)],
      ["누적 소진액", formatKRW(totalSpentAll)],
      ["현재 잔여 예산", formatKRW(remaining)],
      ["예산 사용률", `${activeBudget.amount > 0 ? ((totalSpentAll / activeBudget.amount) * 100).toFixed(1) : 0}%`],
      [],
      ["소진 속도 분석 (최근 3개월)"],
      ["일일 평균 소진액 (Burn Rate)", formatKRW(Math.round(dailyBurnRate))],
      ["월평균 소진액", formatKRW(Math.round(avgMonthlyBurnRate))],
      ["카테고리별 주요 지출", topCategories],
      [],
      ["예산 고갈일 예측"],
      ["예상 고갈일", exhaustDisplay],
      ["AI 분석 요건", warningNote],
      [],
      ["권장 증액 요청"],
      ["잔여 기간 필요 금액 (월말까지)", formatKRW(Math.ceil(dailyBurnRate * daysLeft))],
      ["안전 버퍼 (1개월)", formatKRW(Math.ceil(dailyBurnRate * 30))],
      ["권장 증액 요청 금액", formatKRW(recommendedIncrease)],
      [],
      ["월별 소진 내역 (최근 3개월)"],
      ["연월", "소진액"],
      ...monthKeys.map((ym) => [ym, formatKRW(monthlySpend[ym])]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(reportData);

    // 열 너비 설정
    ws["!cols"] = [{ wch: 32 }, { wch: 40 }];

    // 제목 셀 병합
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];

    XLSX.utils.book_append_sheet(wb, ws, "예산 증액 요청서");

    // 월별 상세 시트
    if (monthKeys.length > 0) {
      const detailData = [
        ["월별 소진 상세"],
        ["연월", "소진액", "전월 대비"],
        ...monthKeys.map((ym, i) => {
          const prev = i > 0 ? monthlySpend[monthKeys[i - 1]] : null;
          const curr = monthlySpend[ym];
          const change = prev != null && prev > 0
            ? `${curr > prev ? "+" : ""}${(((curr - prev) / prev) * 100).toFixed(1)}%`
            : "-";
          return [ym, formatKRW(curr), change];
        }),
      ];
      const ws2 = XLSX.utils.aoa_to_sheet(detailData);
      ws2["!cols"] = [{ wch: 12 }, { wch: 20 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, ws2, "월별 소진 상세");
    }

    // 9. 바이너리 버퍼로 변환
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const yyyymmdd = now.toISOString().slice(0, 10).replace(/-/g, "");
    const filename = `budget_proposal_${yyyymmdd}.xlsx`;

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buf.length),
      },
    });
  } catch (error: any) {
    console.error("[Budget Report API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate report" },
      { status: 500 }
    );
  }
}
