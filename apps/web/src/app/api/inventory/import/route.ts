import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as XLSX from "xlsx";
import { v4 as uuidv4 } from "uuid";
import { fileCache } from "@/lib/cache/file-cache";
import { sanitizeText, sanitizeQuantity, sanitizeDate, validateRow } from "@/lib/utils/excel-sanitizer";
import { handleApiError } from "@/lib/api-error-handler";
import { createLogger } from "@/lib/logger";
import { auth } from "@/auth";

const logger = createLogger("inventory/import");

// Inventory row schema (strict validation)
const InventoryRowSchema = z.object({
  productName: z.string().min(1, "제품명 필수"),
  brand: z.string().optional(),
  catalogNumber: z.string().optional(),
  quantity: z.number().int().positive("수량은 양수여야 함"),
  unit: z.string().default("ea"),
  location: z.string().default("미지정"),
  purchasedAt: z.date().optional(),
  notes: z.string().optional(),
});

interface ImportPreviewResult {
  fileId: string;
  filename: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  preview: any[];
  errors: Array<{ row: number; errors: string[] }>;
  columnHeaders: string[];
}

/**
 * POST /api/inventory/import
 * 엑셀 파일 업로드 및 Preview (실제 저장 X)
 *
 * 실무 데이터 보정:
 * - 수량: "3개", "3box" → 3
 * - 날짜: Excel serial number → Date
 * - 텍스트: 공백 정리
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // 1. Multipart form data 파싱
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "파일이 없습니다." },
        { status: 400 }
      );
    }

    // 파일 확장자 확인
    const filename = file.name;
    const ext = filename.split(".").pop()?.toLowerCase();
    if (!ext || !["xlsx", "xls", "csv"].includes(ext)) {
      return NextResponse.json(
        { error: "지원하지 않는 파일 형식입니다. (xlsx, xls, csv만 가능)" },
        { status: 400 }
      );
    }

    logger.info(`Importing inventory file: ${filename} (${file.size} bytes)`);

    // 2. 파일 읽기
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. 엑셀 파싱 (xlsx 라이브러리)
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // JSON으로 변환 (header: 1 → 첫 행을 헤더로)
    const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

    if (rawData.length < 2) {
      return NextResponse.json(
        { error: "데이터가 없습니다. 최소 2행(헤더 + 데이터) 필요" },
        { status: 400 }
      );
    }

    // 4. 헤더 추출
    const headers = rawData[0].map((h: any) => String(h || "").trim());
    const dataRows = rawData.slice(1);

    logger.info(`Parsed ${dataRows.length} rows with headers:`, headers);

    // 5. 데이터 매핑 및 검증
    const result: ImportPreviewResult = {
      fileId: uuidv4(),
      filename,
      totalRows: dataRows.length,
      validRows: 0,
      invalidRows: 0,
      preview: [],
      errors: [],
      columnHeaders: headers,
    };

    const processedRows: any[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const rawRow = dataRows[i];
      const rowNumber = i + 2; // Excel 행 번호 (헤더가 1행)

      try {
        // 빈 행 스킵
        if (rawRow.every((cell: any) => !cell || String(cell).trim() === "")) {
          logger.debug(`Row ${rowNumber}: Empty row, skipping`);
          continue;
        }

        // 헤더 기반 객체 생성
        const rowObj: Record<string, any> = {};
        headers.forEach((header: string, idx: number) => {
          rowObj[header] = rawRow[idx];
        });

        // 🔧 Smart Data Sanitization (데이터 정수기)
        const mappedRow: any = {
          productName: sanitizeText(
            rowObj["제품명"] || rowObj["품목명"] || rowObj["상품명"] || rowObj["Product Name"]
          ),
          brand: sanitizeText(
            rowObj["브랜드"] || rowObj["제조사"] || rowObj["Brand"]
          ),
          catalogNumber: sanitizeText(
            rowObj["카탈로그번호"] || rowObj["Cat.No"] || rowObj["Catalog Number"]
          ),
          quantity: sanitizeQuantity(
            rowObj["수량"] || rowObj["Quantity"] || rowObj["Qty"]
          ),
          unit: sanitizeText(
            rowObj["단위"] || rowObj["Unit"]
          ) || "ea",
          location: sanitizeText(
            rowObj["위치"] || rowObj["보관위치"] || rowObj["Location"]
          ) || "미지정",
          purchasedAt: sanitizeDate(
            rowObj["구매일"] || rowObj["입고일"] || rowObj["Purchase Date"]
          ),
          notes: sanitizeText(
            rowObj["비고"] || rowObj["메모"] || rowObj["Notes"]
          ),
        };

        // 필수 필드 검증
        const validation = validateRow(mappedRow, ["productName"]);
        if (!validation.valid) {
          result.invalidRows++;
          result.errors.push({
            row: rowNumber,
            errors: validation.errors,
          });
          continue;
        }

        // Zod 스키마 검증
        const validated = InventoryRowSchema.parse(mappedRow);

        processedRows.push({
          ...validated,
          _rowNumber: rowNumber,
          _originalData: rowObj,
        });
        result.validRows++;
      } catch (error: any) {
        result.invalidRows++;
        const errors: string[] = [];

        if (error instanceof z.ZodError) {
          errors.push(...error.errors.map((e) => `${e.path.join(".")}: ${e.message}`));
        } else {
          errors.push(error.message || "알 수 없는 에러");
        }

        result.errors.push({ row: rowNumber, errors });
        logger.debug(`Row ${rowNumber} validation failed:`, errors);
      }
    }

    // 6. 프리뷰 생성 (최대 10개)
    result.preview = processedRows.slice(0, 10).map((row) => {
      const { _rowNumber, _originalData, ...cleanRow } = row;
      return {
        ...cleanRow,
        purchasedAt: cleanRow.purchasedAt?.toISOString(),
      };
    });

    // 7. 캐시에 저장 (15분 TTL)
    fileCache.set(result.fileId, {
      userId,
      filename,
      rows: processedRows,
      timestamp: Date.now(),
    });

    logger.info(
      `Preview generated: ${result.validRows} valid, ${result.invalidRows} invalid rows`
    );

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "inventory/import");
  }
}
