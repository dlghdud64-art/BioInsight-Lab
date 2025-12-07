import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// CSV 파일 업로드 및 실제 구매 데이터 Import
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const organizationId = formData.get("organizationId") as string | null;
    const projectName = formData.get("projectName") as string | null;
    const mapping = JSON.parse((formData.get("mapping") as string) || "{}");

    if (!file) {
      return NextResponse.json(
        { error: "CSV 파일이 필요합니다." },
        { status: 400 }
      );
    }

    // CSV 파일 읽기
    const text = await file.text();
    const lines = text.split("\n").filter((line) => line.trim());

    if (lines.length < 2) {
      return NextResponse.json(
        { error: "CSV 파일에 헤더와 데이터가 필요합니다." },
        { status: 400 }
      );
    }

    // 헤더 파싱
    const headers = lines[0]
      .split(",")
      .map((h) => h.trim().replace(/^"|"$/g, ""));
    
    // 기본 매핑 (사용자가 제공하지 않은 경우)
    const defaultMapping = {
      date: mapping.date || headers.find((h) => 
        /날짜|date|구매일|purchase.*date/i.test(h)
      ) || "",
      vendor: mapping.vendor || headers.find((h) => 
        /벤더|vendor|공급사|supplier/i.test(h)
      ) || "",
      product: mapping.product || headers.find((h) => 
        /제품|product|품목|item|name/i.test(h)
      ) || "",
      quantity: mapping.quantity || headers.find((h) => 
        /수량|quantity|qty/i.test(h)
      ) || "",
      unitPrice: mapping.unitPrice || headers.find((h) => 
        /단가|unit.*price|price|가격/i.test(h)
      ) || "",
      totalAmount: mapping.totalAmount || headers.find((h) => 
        /총액|total|amount|금액/i.test(h)
      ) || "",
      currency: mapping.currency || headers.find((h) => 
        /통화|currency/i.test(h)
      ) || "",
      category: mapping.category || headers.find((h) => 
        /카테고리|category|분류/i.test(h)
      ) || "",
      externalDocId: mapping.externalDocId || headers.find((h) => 
        /문서|doc|번호|number|id/i.test(h)
      ) || "",
    };

    // 데이터 파싱 및 저장
    const records = [];
    const errors = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      
      try {
        // 매핑된 컬럼에서 값 추출
        const getValue = (key: string) => {
          const headerIndex = headers.indexOf(defaultMapping[key as keyof typeof defaultMapping]);
          return headerIndex >= 0 ? values[headerIndex] : "";
        };

        const dateStr = getValue("date");
        const vendorName = getValue("vendor");
        const productName = getValue("product");
        const quantityStr = getValue("quantity");
        const unitPriceStr = getValue("unitPrice");
        const totalAmountStr = getValue("totalAmount");
        const currencyStr = getValue("currency");
        const categoryStr = getValue("category");
        const externalDocIdStr = getValue("externalDocId");

        // 필수 필드 검증
        if (!dateStr || !totalAmountStr) {
          errors.push(`행 ${i + 1}: 날짜와 총액은 필수입니다.`);
          continue;
        }

        // 날짜 파싱
        let purchaseDate: Date;
        try {
          purchaseDate = new Date(dateStr);
          if (isNaN(purchaseDate.getTime())) {
            // 다른 날짜 형식 시도
            const [year, month, day] = dateStr.split(/[-/.]/);
            purchaseDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          }
        } catch {
          errors.push(`행 ${i + 1}: 날짜 형식이 올바르지 않습니다: ${dateStr}`);
          continue;
        }

        // 숫자 파싱
        const quantity = quantityStr ? parseInt(quantityStr) || 1 : 1;
        const unitPrice = unitPriceStr ? parseFloat(unitPriceStr.replace(/,/g, "")) || 0 : 0;
        const totalAmount = parseFloat(totalAmountStr.replace(/,/g, "")) || 0;
        const currency = currencyStr || "KRW";

        // 벤더 찾기 또는 생성
        let vendorId: string | null = null;
        if (vendorName) {
          const vendor = await db.vendor.findFirst({
            where: {
              OR: [
                { name: { contains: vendorName, mode: "insensitive" } },
                { nameEn: { contains: vendorName, mode: "insensitive" } },
              ],
            },
          });

          if (vendor) {
            vendorId = vendor.id;
          } else {
            // 벤더가 없으면 생성
            const newVendor = await db.vendor.create({
              data: {
                name: vendorName,
                currency: currency,
              },
            });
            vendorId = newVendor.id;
          }
        }

        // 제품 찾기 (이름으로 검색)
        let productId: string | null = null;
        if (productName) {
          const product = await db.product.findFirst({
            where: {
              OR: [
                { name: { contains: productName, mode: "insensitive" } },
                { nameEn: { contains: productName, mode: "insensitive" } },
              ],
            },
          });
          if (product) {
            productId = product.id;
          }
        }

        // PurchaseRecord 생성
        const record = await db.purchaseRecord.create({
          data: {
            organizationId: organizationId || null,
            projectName: projectName || null,
            vendorId,
            productId,
            externalDocId: externalDocIdStr || null,
            purchaseDate,
            quantity,
            unitPrice: unitPrice || totalAmount / quantity,
            currency,
            totalAmount,
            category: categoryStr || null,
            importedBy: session.user.id,
            notes: `CSV Import: ${vendorName || ""} ${productName || ""}`.trim(),
          },
        });

        records.push(record);
      } catch (error: any) {
        errors.push(`행 ${i + 1}: ${error.message || "처리 중 오류 발생"}`);
      }
    }

    return NextResponse.json({
      success: true,
      imported: records.length,
      errors: errors.length > 0 ? errors : undefined,
      records: records.slice(0, 10), // 처음 10개만 반환
    });
  } catch (error: any) {
    console.error("Error importing CSV:", error);
    return NextResponse.json(
      { error: error.message || "CSV Import에 실패했습니다." },
      { status: 500 }
    );
  }
}


