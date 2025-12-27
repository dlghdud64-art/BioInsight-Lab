import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { OrganizationRole } from "@prisma/client";

/**
 * Safety Spend 리포트 Export
 * GET /api/safety/spend/export?format=csv|xlsx&organizationId=&from=&to=
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "csv";
    const organizationId = searchParams.get("organizationId");
    const period = searchParams.get("period") || "month";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // 권한 확인
    if (organizationId) {
      const membership = await db.organizationMember.findFirst({
        where: {
          userId: session.user.id,
          organizationId,
        },
      });

      const hasAccess =
        session.user.role === "ADMIN" ||
        membership?.role === OrganizationRole.ADMIN ||
        membership?.role === OrganizationRole.APPROVER ||
        membership?.role === OrganizationRole.VIEWER;

      if (!hasAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // 기간 계산 (summary API와 동일한 로직)
    let dateStart: Date;
    let dateEnd: Date = new Date();

    if (startDate && endDate) {
      dateStart = new Date(startDate);
      dateEnd = new Date(endDate);
    } else {
      switch (period) {
        case "month":
          dateStart = new Date();
          dateStart.setMonth(dateStart.getMonth() - 1);
          break;
        case "30days":
          dateStart = new Date();
          dateStart.setDate(dateStart.getDate() - 30);
          break;
        case "quarter":
          dateStart = new Date();
          dateStart.setMonth(dateStart.getMonth() - 3);
          break;
        default:
          dateStart = new Date();
          dateStart.setMonth(dateStart.getMonth() - 1);
      }
    }

    // 구매 내역 조회
    const where: any = {
      purchaseDate: {
        gte: dateStart,
        lte: dateEnd,
      },
      ...(organizationId && { organizationId }),
    };

    const purchaseRecords = await db.purchaseRecord.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            catalogNumber: true,
            hazardCodes: true,
            pictograms: true,
            msdsUrl: true,
          },
        },
        vendor: {
          select: {
            id: true,
            name: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        purchaseDate: "desc",
      },
    });

    // 리포트 데이터 구성
    const reportData = purchaseRecords.map((record: any) => {
      const hazardCodes = record.hazardSnapshot
        ? (record.hazardSnapshot as any).hazardCodes || []
        : record.product?.hazardCodes || [];
      const hasHazardCodes = Array.isArray(hazardCodes) && hazardCodes.length > 0;
      const msdsUrl = record.hazardSnapshot
        ? (record.hazardSnapshot as any).msdsUrl || ""
        : record.product?.msdsUrl || "";
      const hasMsds = msdsUrl && msdsUrl.trim() !== "";

      return {
        구매일: record.purchaseDate.toISOString().split("T")[0],
        조직: record.organization?.name || "-",
        프로젝트: record.projectName || "-",
        벤더: record.vendor?.name || "-",
        제품명: record.product?.name || record.notes || "-",
        카탈로그번호: record.product?.catalogNumber || "-",
        위험물여부: hasHazardCodes ? "예" : "아니오",
        위험코드: Array.isArray(hazardCodes) ? hazardCodes.join(", ") : "-",
        SDS보유: hasMsds ? "예" : "아니오",
        SDSURL: msdsUrl || "-",
        수량: record.quantity,
        단가: record.unitPrice,
        통화: record.currency,
        총액: record.totalAmount,
        카테고리: record.category || "-",
        매칭타입: record.matchType || "-",
        비고: record.notes || "-",
      };
    });

    if (format === "xlsx") {
      // XLSX 형식은 준비중이므로 CSV로 반환 (임시)
      // TODO: 실제 XLSX 생성 구현 필요
      const headers = Object.keys(reportData[0] || {});
      const rows = reportData.map((row: any) =>
        headers.map((header: any) => {
          const value = row[header as keyof typeof row];
          if (value === null || value === undefined) return "";
          const stringValue = String(value);
          if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        })
      );

      const csv = [headers.join(","), ...rows.map((row: any) => row.join(","))].join("\n");
      const csvWithBOM = "\uFEFF" + csv;

      return new NextResponse(csvWithBOM, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="safety_spend_report_${new Date().toISOString().split("T")[0]}.xlsx"`,
        },
      });
    }

    // CSV 형식
    const headers = Object.keys(reportData[0] || {});
    const rows = reportData.map((row: any) =>
      headers.map((header: any) => {
        const value = row[header as keyof typeof row];
        // CSV 이스케이프 처리
        if (value === null || value === undefined) return "";
        const stringValue = String(value);
        if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      })
    );

    const csv = [headers.join(","), ...rows.map((row: any) => row.join(","))].join("\n");
    const csvWithBOM = "\uFEFF" + csv; // BOM 추가로 Excel 호환성 향상

    return new NextResponse(csvWithBOM, {
      headers: {
        "Content-Type": "text/csv;charset=utf-8",
        "Content-Disposition": `attachment; filename="safety_spend_report_${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error: any) {
    console.error("Error exporting safety spend report:", error);
    return NextResponse.json(
      { error: "Failed to export report" },
      { status: 500 }
    );
  }
}

