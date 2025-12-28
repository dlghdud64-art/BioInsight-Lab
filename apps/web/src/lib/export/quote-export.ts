import JSZip from "jszip";
import { format } from "date-fns";

// UTF-8 BOM (엑셀 한글 깨짐 방지)
const UTF8_BOM = "\uFEFF";

interface QuoteListItem {
  id: string;
  productName: string;
  catalogNumber?: string | null;
  vendor?: string | null;
  specification?: string | null;
  unit?: string | null;
  quantity: number;
  unitPrice?: number | null;
  leadTime?: string | null;
  notes?: string | null;
  selectedVendor?: string | null;
  selectedPrice?: number | null;
  selectedLeadTime?: string | null;
}

interface VendorResponse {
  vendorName: string;
  items: {
    quoteListItemId: string;
    productName: string;
    unitPrice?: number | null;
    leadTime?: string | null;
    notes?: string | null;
  }[];
}

interface QuoteListExportData {
  id: string;
  title: string;
  createdAt: Date;
  items: QuoteListItem[];
  vendorResponses?: VendorResponse[];
}

/**
 * TSV 품목 리스트 생성 (구매팀 제출용)
 */
export function buildItemsTSV(quoteList: QuoteListExportData): string {
  const headers = [
    "No",
    "제품명",
    "CatNo",
    "벤더",
    "규격/단위",
    "수량",
    "단가",
    "금액",
    "납기",
    "비고",
  ];

  const rows = quoteList.items.map((item, index) => {
    const unitPrice = item.selectedPrice || item.unitPrice || 0;
    const amount = item.quantity * unitPrice;
    const vendor = item.selectedVendor || item.vendor || "";
    const leadTime = item.selectedLeadTime || item.leadTime || "";
    const spec = item.specification || "";
    const unit = item.unit || "";
    const specUnit = [spec, unit].filter(Boolean).join(" / ");

    return [
      String(index + 1),
      item.productName,
      item.catalogNumber || "",
      vendor,
      specUnit,
      String(item.quantity),
      unitPrice > 0 ? String(unitPrice) : "",
      amount > 0 ? String(amount) : "",
      leadTime,
      item.notes || "",
    ];
  });

  const tsvContent = [headers, ...rows]
    .map((row) => row.join("\t"))
    .join("\n");

  return UTF8_BOM + tsvContent;
}

/**
 * CSV 회신 비교 생성
 */
export function buildResponsesCSV(
  quoteList: QuoteListExportData,
  vendorResponses: VendorResponse[]
): string {
  if (vendorResponses.length === 0) {
    return UTF8_BOM + "No vendor responses available";
  }

  // 헤더 생성
  const headers = [
    "No",
    "제품명",
    "CatNo",
    "수량",
    "선정 벤더",
    "선정 단가",
  ];

  // 각 벤더별 컬럼 추가
  vendorResponses.forEach((vr) => {
    headers.push(`${vr.vendorName} 단가`);
    headers.push(`${vr.vendorName} 납기`);
  });

  // 데이터 행 생성
  const rows = quoteList.items.map((item, index) => {
    const row = [
      String(index + 1),
      item.productName,
      item.catalogNumber || "",
      String(item.quantity),
      item.selectedVendor || "",
      item.selectedPrice ? String(item.selectedPrice) : "",
    ];

    // 각 벤더의 회신 데이터 추가
    vendorResponses.forEach((vr) => {
      const responseItem = vr.items.find(
        (ri) => ri.quoteListItemId === item.id
      );
      row.push(
        responseItem?.unitPrice ? String(responseItem.unitPrice) : ""
      );
      row.push(responseItem?.leadTime || "");
    });

    return row;
  });

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell}"`).join(","))
    .join("\n");

  return UTF8_BOM + csvContent;
}

/**
 * summary.json 생성
 */
export function buildSummaryJSON(
  quoteList: QuoteListExportData,
  vendorResponses: VendorResponse[]
): string {
  const totalItems = quoteList.items.length;
  const selectedItems = quoteList.items.filter(
    (item) => item.selectedVendor
  ).length;
  const totalAmount = quoteList.items.reduce((sum, item) => {
    const price = item.selectedPrice || item.unitPrice || 0;
    return sum + item.quantity * price;
  }, 0);

  const vendorStatus = vendorResponses.map((vr) => ({
    vendorName: vr.vendorName,
    responseCount: vr.items.length,
    responseRate: `${((vr.items.length / totalItems) * 100).toFixed(1)}%`,
  }));

  const summary = {
    quoteListId: quoteList.id,
    title: quoteList.title,
    generatedAt: new Date().toISOString(),
    createdAt: quoteList.createdAt.toISOString(),
    itemCount: totalItems,
    selectedCount: selectedItems,
    unselectedCount: totalItems - selectedItems,
    totalAmount,
    vendorCount: vendorResponses.length,
    vendorStatus,
  };

  return JSON.stringify(summary, null, 2);
}

/**
 * cover.html 생성 (프린트용 요약)
 */
export function buildCoverHTML(
  quoteList: QuoteListExportData,
  vendorResponses: VendorResponse[]
): string {
  const totalItems = quoteList.items.length;
  const selectedItems = quoteList.items.filter(
    (item) => item.selectedVendor
  ).length;
  const totalAmount = quoteList.items.reduce((sum, item) => {
    const price = item.selectedPrice || item.unitPrice || 0;
    return sum + item.quantity * price;
  }, 0);

  const dateStr = format(quoteList.createdAt, "yyyy-MM-dd");

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${quoteList.title} - 견적 요청서</title>
  <style>
    body {
      font-family: 'Malgun Gothic', sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      line-height: 1.6;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #333;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    h1 {
      margin: 0 0 10px 0;
      color: #333;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 150px 1fr;
      gap: 10px 20px;
      margin: 20px 0;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 8px;
    }
    .info-label {
      font-weight: bold;
      color: #555;
    }
    .info-value {
      color: #333;
    }
    .section {
      margin: 30px 0;
    }
    .section-title {
      font-size: 18px;
      font-weight: bold;
      color: #333;
      border-left: 4px solid #007bff;
      padding-left: 10px;
      margin-bottom: 15px;
    }
    .vendor-list {
      list-style: none;
      padding: 0;
    }
    .vendor-item {
      padding: 10px;
      border-bottom: 1px solid #eee;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #eee;
      text-align: center;
      color: #888;
      font-size: 14px;
    }
    @media print {
      body {
        margin: 0;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${quoteList.title}</h1>
    <p>견적 요청서 요약</p>
  </div>

  <div class="info-grid">
    <div class="info-label">생성일:</div>
    <div class="info-value">${dateStr}</div>
    
    <div class="info-label">품목 수:</div>
    <div class="info-value">${totalItems}개</div>
    
    <div class="info-label">선정 현황:</div>
    <div class="info-value">${selectedItems}개 선정 / ${totalItems - selectedItems}개 미선정</div>
    
    <div class="info-label">총 예상 금액:</div>
    <div class="info-value">₩${totalAmount.toLocaleString()}</div>
    
    <div class="info-label">벤더 수:</div>
    <div class="info-value">${vendorResponses.length}개</div>
  </div>

  <div class="section">
    <div class="section-title">벤더 회신 현황</div>
    <ul class="vendor-list">
      ${vendorResponses
        .map(
          (vr) => `
        <li class="vendor-item">
          <strong>${vr.vendorName}</strong>: ${vr.items.length}개 품목 회신 (${((vr.items.length / totalItems) * 100).toFixed(1)}%)
        </li>
      `
        )
        .join("")}
    </ul>
  </div>

  <div class="footer">
    <p>Generated by BioInsight Lab - ${format(new Date(), "yyyy-MM-dd HH:mm:ss")}</p>
  </div>
</body>
</html>`;
}

/**
 * ZIP 패키지 생성
 */
export async function buildExportZip(
  quoteList: QuoteListExportData,
  vendorResponses: VendorResponse[]
): Promise<Buffer> {
  const zip = new JSZip();

  // 1. items TSV
  const itemsTSV = buildItemsTSV(quoteList);
  zip.file("quote_items.tsv", itemsTSV);

  // 2. responses CSV
  if (vendorResponses.length > 0) {
    const responsesCSV = buildResponsesCSV(quoteList, vendorResponses);
    zip.file("vendor_responses.csv", responsesCSV);
  }

  // 3. summary JSON
  const summaryJSON = buildSummaryJSON(quoteList, vendorResponses);
  zip.file("summary.json", summaryJSON);

  // 4. cover HTML
  const coverHTML = buildCoverHTML(quoteList, vendorResponses);
  zip.file("cover.html", coverHTML);

  // ZIP 생성
  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  return zipBuffer;
}
