import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { handleApiError } from "@/lib/api-error-handler";
import { createLogger } from "@/lib/logger";
import { parseFileBuffer } from "@/lib/file-parser";
import { fileCache, cleanupFileCache } from "@/lib/cache/file-cache";

const logger = createLogger("inventory/import/preview");

export interface PreviewResponse {
  columns: string[];
  sampleRows: Record<string, any>[];
  totalRows: number;
  filename: string;
  fileId: string; // Temporary ID for later commit
}

export async function POST(request: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'sensitive_data_import',
      targetEntityType: 'inventory',
      // §enforcement-handle-close-sweep (inventory) — 'unknown' 유지. 업로드 파일 미리보기라
      //   대상 재고 엔티티가 없다(아직 아무것도 생성/수정하지 않는다). 'unknown' 은 전역 공용
      //   키가 아니라 userId 폴백(§11.369-3)이라 같은 사용자의 연타만 막는다 — 의도한 보호다.
      targetEntityId: 'unknown',
      sourceSurface: 'web_app',
      routePath: '/inventory/import/preview',
    });
    if (!enforcement.allowed) return enforcement.deny();

    cleanupFileCache();

    // session already obtained and verified above

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      throw new Error("No file provided");
    }

    // Validate file type
    const filename = file.name;
    const ext = filename.split(".").pop()?.toLowerCase();
    if (!ext || !["csv", "xlsx", "xls"].includes(ext)) {
      throw new Error("Invalid file type. Only CSV and XLSX files are supported.");
    }

    logger.info(`Previewing inventory file: ${filename} for user: ${session.user.id}`);

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse file to rows
    const parseResult = parseFileBuffer(buffer, filename);
    if (parseResult.errors.length > 0) {
      throw new Error(`File parsing failed: ${parseResult.errors.join(", ")}`);
    }

    const { rows } = parseResult;
    if (rows.length === 0) {
      throw new Error("File contains no data rows");
    }

    // Extract columns from first row
    const columns = Object.keys(rows[0]);

    // Get sample rows (first 50 for preview)
    const sampleRows = rows.slice(0, 50);

    // Generate file ID for cache
    const fileId = `${session.user.id}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // Store parsed data in cache
    fileCache.set(fileId, {
      rows,
      filename,
      timestamp: Date.now(),
    });

    logger.info(`Preview generated for ${filename}: ${rows.length} rows, ${columns.length} columns`);

    const response: PreviewResponse = {
      columns,
      sampleRows,
      totalRows: rows.length,
      filename,
      fileId,
    };

    // ⚠️ 정상 완료 경로인데 fail() 이다 — **버그 아님. complete() 로 바꾸지 말 것.**
    //   이 라우트는 DB 를 바꾸지 않는다(파싱 결과를 fileCache 에 담고 fileId 만 반환.
    //   실제 반영은 import/commit 라우트). complete() 는 audit envelope 에 before/after 를
    //   남기므로, 아무것도 바꾸지 않은 호출에 "변경 완료" 기록이 생긴다 = 거짓 감사.
    //   fail() 은 이름이 "실패"일 뿐 실제 의미는 **lock 해제(audit 미기록)** 다.
    //   readOnly:true 도 검토했으나 부적합 — 순수 조회가 아니라 fileCache 항목을 만들고,
    //   파일 파싱 비용이 커 같은 사용자 연타를 막는 lock 의 값이 있다(2026-08-09 판정).
    enforcement.fail();
    return NextResponse.json(response);
  } catch (error) {
    enforcement?.fail();
    return handleApiError(error, "inventory/import/preview");
  }
}

