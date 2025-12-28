import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateGuestKey } from "@/lib/api/guest-key";
import { handleApiError } from "@/lib/api/utils";
import {
  buildItemsTSV,
  buildResponsesCSV,
  buildExportZip,
} from "@/lib/export/quote-export";
import { format } from "date-fns";

// ZIP 생성을 위해 Node.js runtime 필요
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/quote-lists/[id]/export?type=items_tsv|responses_csv|pack_zip
 * 견적요청서 내보내기 (구매팀 제출용)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const guestKey = await getOrCreateGuestKey();
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") || "items_tsv";

    // QuoteList 조회 (권한 확인 포함)
    const quoteList = await db.quoteList.findFirst({
      where: {
        id,
        OR: [
          { guestKey },
          // TODO: userId 추가 시 확장
        ],
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                vendors: {
                  include: {
                    vendor: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!quoteList) {
      return NextResponse.json(
        { error: "Quote list not found" },
        { status: 404 }
      );
    }

    // 날짜 포맷 (파일명용)
    const dateStr = format(new Date(), "yyyyMMdd");
    const baseFilename = `bioinsight_submit_${id}_${dateStr}`;

    // 품목 데이터 변환 (QuoteListItem 모델 필드에 맞춤)
    type QuoteListItemType = (typeof quoteList.items)[number];
    const exportItems = quoteList.items.map((item: QuoteListItemType) => ({
      id: item.id,
      productName: item.name || item.product?.name || "",
      catalogNumber: item.catalogNumber || item.product?.catalogNumber,
      vendor: item.product?.vendors?.[0]?.vendor?.name,
      specification: item.product?.description,
      unit: item.unit,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      leadTime: null, // QuoteListItem doesn't have leadTime field
      notes: item.notes,
      selectedVendor: null, // Selection fields not in QuoteListItem
      selectedPrice: null,
      selectedLeadTime: null,
    }));

    const exportData = {
      id: quoteList.id,
      title: quoteList.title,
      createdAt: quoteList.createdAt,
      items: exportItems,
    };

    // TODO: 실제 vendorResponses는 별도 API나 DB에서 가져와야 함
    // 현재는 빈 배열로 처리
    const vendorResponses: any[] = [];

    // 타입별 처리
    switch (type) {
      case "items_tsv": {
        const tsvContent = buildItemsTSV(exportData);
        const headers = new Headers();
        headers.set("Content-Type", "text/tab-separated-values; charset=utf-8");
        headers.set(
          "Content-Disposition",
          `attachment; filename="${baseFilename}.tsv"`
        );
        return new NextResponse(tsvContent, { headers });
      }

      case "responses_csv": {
        const csvContent = buildResponsesCSV(exportData, vendorResponses);
        const headers = new Headers();
        headers.set("Content-Type", "text/csv; charset=utf-8");
        headers.set(
          "Content-Disposition",
          `attachment; filename="${baseFilename}_responses.csv"`
        );
        return new NextResponse(csvContent, { headers });
      }

      case "pack_zip": {
        const zipBuffer = await buildExportZip(exportData, vendorResponses);
        const headers = new Headers();
        headers.set("Content-Type", "application/zip");
        headers.set(
          "Content-Disposition",
          `attachment; filename="${baseFilename}_pack.zip"`
        );
        // Convert Buffer to Uint8Array for NextResponse compatibility
        return new NextResponse(new Uint8Array(zipBuffer), { headers });
      }

      default:
        return NextResponse.json(
          { error: "Invalid export type. Use: items_tsv, responses_csv, or pack_zip" },
          { status: 400 }
        );
    }
  } catch (error) {
    return handleApiError(error, "GET /api/quote-lists/[id]/export");
  }
}

