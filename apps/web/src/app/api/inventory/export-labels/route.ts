import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { getStorageConditionLabel } from "@/lib/constants";

export const dynamic = "force-dynamic";

// ─── 보관 조건 레이블 매핑 (Product.storageCondition) ─────────────────────────
// getStorageConditionLabel 은 선택자 코드(예: "freezer_20") → 한글 문자열 변환
// Product.storageCondition 은 자유 텍스트일 수도 있으므로 그대로도 반환

// ─── notes 에서 Lot 번호 추출 헬퍼 ────────────────────────────────────────────
// POST /api/inventory 에서 "[Lot: xxx]" 형식으로 notes 에 병합 저장
function extractLotFromNotes(notes: string | null): string {
  if (!notes) return "";
  const match = notes.match(/\[Lot:\s*([^\]]+)\]/);
  return match ? match[1].trim() : "";
}

// ─── specifications JSON 에서 CAS No. 추출 헬퍼 ──────────────────────────────
function extractCasNumber(specifications: any): string {
  if (!specifications || typeof specifications !== "object") return "";
  // 흔한 key 이름 탐색
  const casKeys = ["casNumber", "cas_number", "cas", "CAS", "CASNo", "casNo"];
  for (const key of casKeys) {
    if (specifications[key]) return String(specifications[key]);
  }
  return "";
}

// ─── GET /api/inventory/export-labels ────────────────────────────────────────
// Query: organizationId (optional) - 미전달 시 로그인 사용자 개인 재고
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId") ?? undefined;

    // ── 조직 멤버 권한 확인 ─────────────────────────────────────────────────
    if (organizationId) {
      const membership = await db.organizationMember.findFirst({
        where: { organizationId, userId: session.user.id },
      });
      if (!membership) {
        return NextResponse.json(
          { error: "해당 조직에 접근 권한이 없습니다." },
          { status: 403 }
        );
      }
    }

    // ── 재고 목록 조회 ──────────────────────────────────────────────────────
    const inventories = await db.productInventory.findMany({
      where: organizationId
        ? { organizationId }
        : { userId: session.user.id },
      include: {
        product: {
          select: {
            name: true,
            nameEn: true,
            catalogNumber: true,
            lotNumber: true,
            brand: true,
            specifications: true,
            storageCondition: true,
          },
        },
      },
      orderBy: [{ expiryDate: "asc" }, { createdAt: "asc" }],
    });

    if (inventories.length === 0) {
      return NextResponse.json(
        { error: "내보낼 재고 데이터가 없습니다." },
        { status: 404 }
      );
    }

    // ── 라벨 데이터 정제 ────────────────────────────────────────────────────
    const rows: Record<string, string | number>[] = inventories.map((inv: (typeof inventories)[number]) => {
      const p = inv.product;

      // CAS No.: specifications JSON 우선, 없으면 catalogNumber 활용
      const casNo = extractCasNumber(p.specifications) || "";

      // Lot 번호: product.lotNumber 우선, 없으면 notes 에서 추출
      const lotNo =
        p.lotNumber?.trim() ||
        extractLotFromNotes(inv.notes) ||
        "";

      // 유효기간
      const expiryDateStr = inv.expiryDate
        ? format(new Date(inv.expiryDate), "yyyy-MM-dd")
        : "";

      // 보관 온도: Product.storageCondition (코드 → 한글 라벨 변환)
      const storageLabel = getStorageConditionLabel(p.storageCondition) || "";

      // 고유 바코드 번호: 재고 레코드 ID (CUID, 전역 고유)
      const barcodeId = inv.id;

      return {
        "시약명": p.name ?? "",
        "영문명": p.nameEn ?? "",
        "CAS No.": casNo,
        "카탈로그 번호": p.catalogNumber ?? "",
        "제조사 / 브랜드": p.brand ?? "",
        "Lot 번호": lotNo,
        "고유 바코드 번호": barcodeId,
        "현재 재고량": inv.currentQuantity,
        "단위": inv.unit ?? "",
        "유효기간": expiryDateStr,
        "보관 온도": storageLabel,
        "보관 위치": inv.location ?? "",
      };
    });

    // ── Excel 파일 생성 (순수 Raw Data – 수식·매크로 배제) ─────────────────
    const workbook = XLSX.utils.book_new();

    // aoa(Array of Arrays) 방식으로 헤더 + 데이터 직접 구성
    // → 수식이나 스타일 없이 순수 셀 값만 기록
    const headers = Object.keys(rows[0]);
    const dataRows = rows.map((row) => headers.map((h) => row[h] ?? ""));
    const sheetData = [headers, ...dataRows];

    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

    // 열 너비 자동 조정 (최대 50자)
    worksheet["!cols"] = headers.map((h) => {
      const maxLen = Math.max(
        h.length,
        ...rows.map((r) => String(r[h] ?? "").length)
      );
      return { wch: Math.min(maxLen + 2, 50) };
    });

    // 첫 행(헤더) 고정 (freeze pane)
    worksheet["!freeze"] = { xSplit: 0, ySplit: 1 } as any;

    XLSX.utils.book_append_sheet(workbook, worksheet, "Label_Data");

    // ── Buffer 생성 및 다운로드 응답 ────────────────────────────────────────
    const dateStamp = format(new Date(), "yyyyMMdd");
    const fileName = `Label_Data_${dateStamp}.xlsx`;

    // XLSX.write → Uint8Array → ArrayBuffer 로 변환 (Edge Runtime BodyInit 호환)
    const xlsxArray = XLSX.write(workbook, {
      type: "array",
      bookType: "xlsx",
      bookSST: false, // Shared String Table 최소화 (파일 크기 절감)
    }) as number[];
    const uint8 = new Uint8Array(xlsxArray);

    return new NextResponse(uint8.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Content-Length": String(uint8.buffer.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("[export-labels] Error:", error);
    return NextResponse.json(
      { error: error.message || "라벨 데이터 내보내기에 실패했습니다." },
      { status: 500 }
    );
  }
}
