/**
 * PDF 파싱 모듈 (pdf-parse v2.x 대응)
 *
 * pdf-parse@2.x는 클래스 기반 API를 사용합니다:
 *   const { PDFParse } = require('pdf-parse');
 *   const parser = new PDFParse(uint8Array);
 *   await parser.load();
 *   const text = parser.getText();
 *
 * Next.js 서버 사이드(Node.js runtime)에서만 동작합니다.
 */

/**
 * PDF 파싱 결과 인터페이스
 */
export interface PDFParseResult {
  text: string;
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    producer?: string;
    creationDate?: Date;
    modificationDate?: Date;
    pages?: number;
  };
  tables?: Array<Array<string[]>>;
}

/**
 * PDF 버퍼에서 텍스트 추출
 * Next.js 서버 사이드에서만 동작 (Edge Runtime 미지원)
 */
export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string>;
export async function extractTextFromPDF(pdfBuffer: Buffer, options: { includeMetadata?: boolean; detectTables?: boolean }): Promise<PDFParseResult>;
export async function extractTextFromPDF(
  pdfBuffer: Buffer,
  options?: { includeMetadata?: boolean; detectTables?: boolean }
): Promise<string | PDFParseResult> {
  // 서버 사이드 전용
  if (typeof window !== "undefined") {
    throw new Error("PDF 파싱은 서버 사이드에서만 가능합니다.");
  }

  try {
    // pdf-parse v2.x: 클래스 기반 API
    // @ts-ignore - require는 Node.js 런타임에서 사용 가능
    const pdfParseModule = require("pdf-parse");

    const PDFParseClass = pdfParseModule.PDFParse ?? pdfParseModule.default?.PDFParse;

    if (typeof PDFParseClass !== "function") {
      console.error("[pdf-parser] pdf-parse 모듈 구조:", {
        type: typeof pdfParseModule,
        keys: Object.keys(pdfParseModule),
      });
      throw new Error(
        "pdf-parse 모듈에서 PDFParse 클래스를 찾을 수 없습니다. 패키지 버전을 확인하세요."
      );
    }

    // Buffer → Uint8Array 변환 (pdf-parse v2는 Uint8Array 요구)
    const uint8Data = new Uint8Array(
      pdfBuffer.buffer,
      pdfBuffer.byteOffset,
      pdfBuffer.byteLength
    );

    // 파서 인스턴스 생성 및 PDF 로드
    const parser = new PDFParseClass(uint8Data);
    await parser.load();

    // 페이지별 텍스트 추출
    let rawText = "";
    try {
      rawText = parser.getText();
    } catch {
      // getText 실패 시 getPageText로 개별 페이지 추출 시도
      const doc = parser.doc ?? (parser as any).document;
      const numPages = doc?.numPages ?? 0;

      if (numPages === 0) {
        throw new Error(
          "PDF에서 텍스트를 추출할 수 없습니다. 빈 문서이거나 텍스트가 없을 수 있습니다."
        );
      }

      const pageTexts: string[] = [];
      for (let i = 1; i <= numPages; i++) {
        try {
          const pageText = parser.getPageText(i);
          if (pageText) pageTexts.push(pageText);
        } catch {
          // 개별 페이지 실패는 무시
        }
      }
      rawText = pageTexts.join("\n\n");
    }

    if (!rawText || rawText.trim().length === 0) {
      throw new Error(
        "PDF에서 텍스트를 추출할 수 없습니다. 스캔본이거나 이미지 기반 PDF일 수 있습니다."
      );
    }

    // 메타데이터 추출
    let metadata: PDFParseResult["metadata"] | undefined;
    if (options?.includeMetadata) {
      try {
        const info = parser.getInfo?.();
        metadata = {
          title: info?.Title || undefined,
          author: info?.Author || undefined,
          subject: info?.Subject || undefined,
          creator: info?.Creator || undefined,
          producer: info?.Producer || undefined,
          creationDate: info?.CreationDate
            ? new Date(info.CreationDate)
            : undefined,
          modificationDate: info?.ModDate
            ? new Date(info.ModDate)
            : undefined,
          pages: info?.numPages || undefined,
        };
      } catch {
        // 메타데이터 추출 실패는 치명적이지 않음
      }
    }

    // 텍스트 전처리
    let processedText = postProcessText(rawText);

    // 표 감지
    let detectedTables: Array<Array<string[]>> | undefined;
    if (options?.detectTables) {
      detectedTables = detectTablesFromText(processedText);
    }

    // 파서 정리
    try {
      parser.destroy?.();
    } catch {
      // 정리 실패는 무시
    }

    // 결과 반환
    if (options?.includeMetadata || options?.detectTables) {
      return { text: processedText, metadata, tables: detectedTables };
    }
    return processedText;
  } catch (error: any) {
    const msg = error?.message || "알 수 없는 오류";
    console.error("[pdf-parser] PDF 파싱 실패:", msg);
    console.error("[pdf-parser] Stack:", error?.stack);
    throw new Error(`PDF 파싱에 실패했습니다: ${msg}`);
  }
}

/* ── 텍스트 후처리 ── */

function postProcessText(raw: string): string {
  let text = raw;

  // 다단 컬럼: 연속 공백 10개 이상 → 탭 변환
  text = text
    .split("\n")
    .map((line: string) => {
      const leading = line.match(/^ +/)?.[0] || "";
      if (leading.length >= 10) {
        return line.replace(/^(\S+)\s{3,}/, "$1\t");
      }
      return line;
    })
    .join("\n");

  // 연속된 공백 정리 (탭 보존)
  text = text.replace(/[ \t]+/g, (m: string) =>
    m.includes("\t") ? "\t" : " "
  );

  // 2개 이상 연속 공백 → 탭 구분
  text = text.replace(/([^\t\n])\s{2,}([^\t\n])/g, "$1\t$2");

  // 줄바꿈 정리
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  text = text.replace(/\n{4,}/g, "\n\n\n");

  return text;
}

function detectTablesFromText(text: string): Array<Array<string[]>> {
  const lines = text.split("\n");
  const tables: Array<Array<string[]>> = [];
  let current: Array<string[]> = [];
  let prevCols = 0;

  for (const line of lines) {
    const cols = line
      .split("\t")
      .filter((c: string) => c.trim().length > 0);

    if (cols.length >= 2) {
      if (prevCols === 0 || prevCols === cols.length) {
        current.push(cols);
        prevCols = cols.length;
      } else {
        if (current.length >= 2) tables.push(current);
        current = [cols];
        prevCols = cols.length;
      }
    } else {
      if (current.length >= 2) tables.push(current);
      current = [];
      prevCols = 0;
    }
  }
  if (current.length >= 2) tables.push(current);

  return tables;
}
