/**
 * 비교 결과를 CSV 형식으로 내보내기
 */
export function exportComparisonToCSV(products: any[], fields: string[]): string {
  const headers = ["항목", ...products.map((p) => p.name || p.id)];
  const rows: string[][] = [headers];

  // 각 필드에 대해 행 생성
  fields.forEach((fieldKey) => {
    const fieldLabel = getFieldLabel(fieldKey);
    const row = [fieldLabel];

    products.forEach((product) => {
      const value = getFieldValue(product, fieldKey);
      row.push(formatValue(value));
    });

    rows.push(row);
  });

  // CSV 형식으로 변환
  return rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
}

/**
 * 비교 결과를 TSV 형식으로 내보내기
 */
export function exportComparisonToTSV(products: any[], fields: string[]): string {
  const headers = ["항목", ...products.map((p) => p.name || p.id)];
  const rows: string[][] = [headers];

  // 각 필드에 대해 행 생성
  fields.forEach((fieldKey) => {
    const fieldLabel = getFieldLabel(fieldKey);
    const row = [fieldLabel];

    products.forEach((product) => {
      const value = getFieldValue(product, fieldKey);
      row.push(formatValue(value));
    });

    rows.push(row);
  });

  // TSV 형식으로 변환
  return rows.map((row) => row.join("\t")).join("\n");
}

/**
 * 비교 결과를 Excel 형식으로 다운로드 (CSV로 대체)
 */
export function downloadComparisonAsExcel(products: any[], fields: string[], filename: string = "comparison") {
  const csv = exportComparisonToCSV(products, fields);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); // BOM 추가로 한글 깨짐 방지
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * 필드 레이블 가져오기
 */
function getFieldLabel(fieldKey: string): string {
  const labels: Record<string, string> = {
    name: "제품명",
    brand: "브랜드",
    category: "카테고리",
    price: "최저가",
    leadTime: "납기일",
    stockStatus: "재고",
    minOrderQty: "최소 주문량",
    vendorCount: "공급사 수",
    catalogNumber: "카탈로그 번호",
    grade: "Grade",
    specification: "규격",
    description: "설명",
  };
  return labels[fieldKey] || fieldKey;
}

/**
 * 필드 값 가져오기
 */
function getFieldValue(product: any, fieldKey: string): any {
  if (fieldKey === "name") return product.name;
  if (fieldKey === "brand") return product.brand || "-";
  if (fieldKey === "category") return product.category || "-";
  if (fieldKey === "price") {
    const minPrice = product.vendors?.reduce(
      (min: number, v: any) => (v.priceInKRW && (!min || v.priceInKRW < min) ? v.priceInKRW : min),
      null
    );
    return minPrice || 0;
  }
  if (fieldKey === "leadTime") {
    const minLeadTime = product.vendors?.reduce(
      (min: number, v: any) => (v.leadTime !== null && (!min || v.leadTime < min) ? v.leadTime : min),
      null
    );
    return minLeadTime || 0;
  }
  if (fieldKey === "stockStatus") {
    const inStock = product.vendors?.some(
      (v: any) => v.stockStatus === "재고 있음" || v.stockStatus === "In Stock"
    );
    return inStock ? "재고 있음" : "재고 없음";
  }
  if (fieldKey === "minOrderQty") {
    const minOrder = product.vendors?.reduce(
      (min: number, v: any) => (v.minOrderQty && (!min || v.minOrderQty < min) ? v.minOrderQty : min),
      null
    );
    return minOrder || "-";
  }
  if (fieldKey === "vendorCount") {
    return product.vendors?.length || 0;
  }
  if (fieldKey === "catalogNumber") return product.catalogNumber || "-";
  if (fieldKey === "grade") return product.grade || "-";
  if (fieldKey === "specification") return product.specification || "-";
  if (fieldKey === "description") return product.description || "-";
  return "-";
}

/**
 * 값 포맷팅
 */
function formatValue(value: any): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") {
    if (value === 0) return "0";
    return value.toLocaleString("ko-KR");
  }
  return String(value);
}

