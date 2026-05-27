import * as XLSX from "xlsx";
import { ColumnMapping } from "@/components/export/column-mapping-row";

/**
 * Generate Excel file with custom column mapping
 * @param data - Array of data objects to export
 * @param mappings - Column mappings (ERP column name -> app data field), null for default
 * @returns Excel file buffer
 */
export async function generateCustomExcel(
  data: any[],
  mappings: ColumnMapping[] | null
): Promise<ArrayBuffer> {
  try {
    // Default columns if no mapping provided
    if (!mappings) {
      mappings = [
        { id: "1", erpColumnName: "Product Name", appDataField: "productName" },
        { id: "2", erpColumnName: "Vendor", appDataField: "vendor" },
        { id: "3", erpColumnName: "Catalog Number", appDataField: "catalogNumber" },
        { id: "4", erpColumnName: "Price", appDataField: "price" },
        { id: "5", erpColumnName: "Quantity", appDataField: "quantity" },
        { id: "6", erpColumnName: "Category", appDataField: "category" },
      ];
    }

    // Create worksheet data
    const worksheetData: any[][] = [];

    // Header row (ERP column names)
    const headers = mappings.map((m: any) => m.erpColumnName);
    worksheetData.push(headers);

    // Data rows
    data.forEach((item) => {
      const row = mappings!.map((mapping) => {
        const field = mapping.appDataField;
        let value = item[field];

        // Format specific fields
        if (field === "price" && typeof value === "number") {
          return value.toLocaleString("ko-KR");
        }
        if (field === "quantity" && item.unit) {
          return `${value} ${item.unit}`;
        }

        return value || "";
      });
      worksheetData.push(row);
    });

    // Create workbook
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Export");

    // Set column widths
    const columnWidths = headers.map((header) => ({
      wch: Math.max(header.length + 2, 15),
    }));
    worksheet["!cols"] = columnWidths;

    // Generate buffer
    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    return excelBuffer as ArrayBuffer;
  } catch (error) {
    console.error("Excel generation error:", error);
    throw new Error("엑셀 파일 생성에 실패했습니다.");
  }
}

/**
 * Generate Excel from template data
 * @param templateItems - Array of template items
 * @returns Excel file buffer
 */
export async function generateTemplateExcel(
  templateItems: any[]
): Promise<ArrayBuffer> {
  const mappings: ColumnMapping[] = [
    { id: "1", erpColumnName: "Item Name", appDataField: "name" },
    { id: "2", erpColumnName: "Category", appDataField: "category" },
    { id: "3", erpColumnName: "Quantity", appDataField: "quantity" },
    { id: "4", erpColumnName: "Specification", appDataField: "specification" },
  ];

  return generateCustomExcel(templateItems, mappings);
}

