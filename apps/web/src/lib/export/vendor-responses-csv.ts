/**
 * CSV Export utility for vendor responses
 * Generates CSV with UTF-8 BOM for Excel compatibility
 */

interface QuoteItem {
  id: string;
  lineNumber?: number;
  name?: string;
  catalogNumber?: string;
  quantity: number;
  unit?: string;
}

interface VendorResponseItem {
  quoteItemId: string;
  unitPrice?: number;
  currency?: string;
  leadTimeDays?: number;
  moq?: number;
  vendorSku?: string;
  notes?: string;
}

interface VendorRequest {
  id: string;
  vendorEmail: string;
  vendorName?: string;
  status: string;
  responseItems: VendorResponseItem[];
}

interface VendorResponsesExportData {
  quoteId: string;
  quoteTitle?: string;
  items: QuoteItem[];
  vendorRequests: VendorRequest[];
}

/**
 * Escape CSV value with quotes if needed
 */
function escapeCsvValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = value.toString();

  // Escape quotes by doubling them
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Export vendor responses to CSV format
 */
export function exportVendorResponsesToCSV(data: VendorResponsesExportData): string {
  const { items, vendorRequests } = data;

  // Build header row
  const headers: string[] = [
    "품목번호",
    "제품명",
    "Cat No.",
    "요청수량",
    "단위",
  ];

  // Add vendor-specific columns
  vendorRequests.forEach((vendor) => {
    const vendorLabel = vendor.vendorName || vendor.vendorEmail;
    headers.push(
      `${vendorLabel}_상태`,
      `${vendorLabel}_단가`,
      `${vendorLabel}_통화`,
      `${vendorLabel}_납기(일)`,
      `${vendorLabel}_MOQ`,
      `${vendorLabel}_벤더SKU`,
      `${vendorLabel}_비고`
    );
  });

  // Build data rows
  const rows: string[][] = [];

  items.forEach((item) => {
    const row: string[] = [
      escapeCsvValue(item.lineNumber),
      escapeCsvValue(item.name),
      escapeCsvValue(item.catalogNumber),
      escapeCsvValue(item.quantity),
      escapeCsvValue(item.unit || "ea"),
    ];

    // Add vendor response data
    vendorRequests.forEach((vendor) => {
      const response = vendor.responseItems.find((r) => r.quoteItemId === item.id);

      // Status
      let statusText = "대기중";
      if (vendor.status === "RESPONDED") statusText = "회신완료";
      else if (vendor.status === "EXPIRED") statusText = "만료";
      else if (vendor.status === "CANCELLED") statusText = "취소";

      row.push(
        escapeCsvValue(statusText),
        escapeCsvValue(response?.unitPrice),
        escapeCsvValue(response?.currency || "KRW"),
        escapeCsvValue(response?.leadTimeDays),
        escapeCsvValue(response?.moq),
        escapeCsvValue(response?.vendorSku),
        escapeCsvValue(response?.notes)
      );
    });

    rows.push(row);
  });

  // Combine into CSV string
  const csvLines = [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((row: any) => row.join(",")),
  ];

  return csvLines.join("\n");
}

/**
 * Download CSV file (triggers browser download)
 */
export function downloadVendorResponsesCSV(data: VendorResponsesExportData) {
  const csvContent = exportVendorResponsesToCSV(data);

  // Add UTF-8 BOM for Excel compatibility
  const bom = "\uFEFF";
  const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });

  // Generate filename
  const timestamp = new Date().toISOString().split("T")[0].replace(/-/g, "");
  const filename = `quote_responses_${data.quoteId}_${timestamp}.csv`;

  // Trigger download
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
