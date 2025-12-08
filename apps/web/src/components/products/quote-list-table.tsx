"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Download, FileSpreadsheet, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PRODUCT_CATEGORIES, DEFAULT_TEMPLATE_COLUMNS, TEMPLATE_TYPES } from "@/lib/constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTemplates } from "@/hooks/use-templates";
import type { TemplateType } from "@/lib/constants";
import { PriceDisplay } from "@/components/products/price-display";

interface QuoteListItem {
  id: string;
  productId: string;
  product: {
    id: string;
    name: string;
    brand?: string;
    catalogNumber?: string;
    grade?: string;
    specification?: string;
    category: string;
    vendors?: Array<{
      id: string;
      vendor?: {
        id: string;
        name: string;
      };
      priceInKRW?: number;
      currency?: string;
    }>;
  };
  quantity: number;
  unitPrice?: number;
  currency?: string;
  lineTotal?: number;
  notes?: string;
}

interface QuoteListTableProps {
  items: QuoteListItem[];
  onRemove: (id: string) => void;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onUpdateNotes: (id: string, notes: string) => void;
  onUpdateUnitPrice: (id: string, price: number) => void;
  selectedTemplateId?: string;
  onTemplateChange?: (templateId: string | undefined) => void;
  templateType?: TemplateType;
}

export function QuoteListTable({
  items,
  onRemove,
  onUpdateQuantity,
  onUpdateNotes,
  onUpdateUnitPrice,
  selectedTemplateId,
  onTemplateChange,
  templateType,
}: QuoteListTableProps) {
  const [copied, setCopied] = useState(false);
  
  // 템플릿 목록 조회
  const { data: templatesData } = useTemplates(templateType);
  const templates = templatesData?.templates || [];
  
  // 선택된 템플릿의 컬럼 정의 가져오기 (현재는 기본 컬럼 사용)
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  // 총액 계산
  const totalAmount = items.reduce((sum, item) => {
    const lineTotal = item.lineTotal || (item.unitPrice || 0) * item.quantity;
    return sum + lineTotal;
  }, 0);

  // 클립보드 복사 (TSV 형태)
  const handleCopyToClipboard = async () => {
    const headers = [
      "Line No.",
      "제품명",
      "벤더",
      "카탈로그 번호",
      "규격/용량",
      "Grade/규격",
      "단가",
      "통화",
      "수량",
      "금액",
      "비고",
    ];

    const rows = items.map((item, index) => {
      const vendor = item.product.vendors?.[0];
      const unitPrice = item.unitPrice || vendor?.priceInKRW || 0;
      const lineTotal = item.lineTotal || unitPrice * item.quantity;

      return [
        (index + 1).toString(),
        item.product.name,
        vendor?.vendor?.name || item.product.brand || "",
        item.product.catalogNumber || "",
        item.product.specification || "",
        item.product.grade || "",
        unitPrice.toLocaleString(),
        vendor?.currency || item.currency || "KRW",
        item.quantity.toString(),
        lineTotal.toLocaleString(),
        item.notes || "",
      ];
    });

    const tsv = [headers, ...rows].map((row) => row.join("\t")).join("\n");

    try {
      await navigator.clipboard.writeText(tsv);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
      alert("클립보드 복사에 실패했습니다.");
    }
  };

  // CSV 다운로드
  const handleDownloadCSV = () => {
    const headers = [
      "Line No.",
      "제품명",
      "벤더",
      "카탈로그 번호",
      "규격/용량",
      "Grade/규격",
      "단가",
      "통화",
      "수량",
      "금액",
      "비고",
    ];

    const rows = items.map((item, index) => {
      const vendor = item.product.vendors?.[0];
      const unitPrice = item.unitPrice || vendor?.priceInKRW || 0;
      const lineTotal = item.lineTotal || unitPrice * item.quantity;

      return [
        (index + 1).toString(),
        `"${item.product.name}"`,
        `"${vendor?.vendor?.name || item.product.brand || ""}"`,
        `"${item.product.catalogNumber || ""}"`,
        `"${item.product.specification || ""}"`,
        `"${item.product.grade || ""}"`,
        unitPrice.toLocaleString(),
        vendor?.currency || item.currency || "KRW",
        item.quantity.toString(),
        lineTotal.toLocaleString(),
        `"${item.notes || ""}"`,
      ];
    });

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); // BOM 추가로 Excel 호환성 향상
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `품목리스트-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 엑셀 다운로드 (간단한 CSV 형태, 실제 엑셀은 xlsx 라이브러리 필요)
  const handleDownloadExcel = () => {
    // CSV로 다운로드 (Excel에서 열 수 있음)
    handleDownloadCSV();
  };

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">품목 리스트에 추가된 제품이 없습니다</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle>그룹웨어용 품목 리스트</CardTitle>
            <CardDescription>
              선택한 제품들을 그룹웨어 구매신청 양식에 사용할 수 있는 형태로 정리합니다
            </CardDescription>
          </div>
          {onTemplateChange && templates.length > 0 && (
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">템플릿:</Label>
              <Select
                value={selectedTemplateId || ""}
                onValueChange={(value) => onTemplateChange(value || undefined)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="템플릿 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">기본 템플릿</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                      {template.isDefault && " (기본)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyToClipboard}>
              <Copy className="h-4 w-4 mr-2" />
              {copied ? "복사됨!" : "클립보드 복사"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadCSV}>
              <Download className="h-4 w-4 mr-2" />
              CSV 다운로드
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              엑셀 다운로드
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="px-3 py-2 text-left font-medium">Line No.</th>
                <th className="px-3 py-2 text-left font-medium">제품명</th>
                <th className="px-3 py-2 text-left font-medium">벤더</th>
                <th className="px-3 py-2 text-left font-medium">카탈로그 번호</th>
                <th className="px-3 py-2 text-left font-medium">규격/용량</th>
                <th className="px-3 py-2 text-left font-medium">Grade</th>
                <th className="px-3 py-2 text-right font-medium">단가</th>
                <th className="px-3 py-2 text-left font-medium">통화</th>
                <th className="px-3 py-2 text-right font-medium">수량</th>
                <th className="px-3 py-2 text-right font-medium">금액</th>
                <th className="px-3 py-2 text-left font-medium">비고</th>
                <th className="px-3 py-2 text-center font-medium">삭제</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const vendor = item.product.vendors?.[0];
                const unitPrice = item.unitPrice || vendor?.priceInKRW || 0;
                const lineTotal = item.lineTotal || unitPrice * item.quantity;

                return (
                  <tr key={item.id} className="border-b hover:bg-slate-50">
                    <td className="px-3 py-2">{index + 1}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{item.product.name}</div>
                      {item.product.brand && (
                        <div className="text-xs text-muted-foreground">{item.product.brand}</div>
                      )}
                    </td>
                    <td className="px-3 py-2">{vendor?.vendor?.name || item.product.brand || "-"}</td>
                    <td className="px-3 py-2">{item.product.catalogNumber || "-"}</td>
                    <td className="px-3 py-2">{item.product.specification || "-"}</td>
                    <td className="px-3 py-2">
                      {item.product.grade ? (
                        <Badge variant="outline" className="text-xs">
                          {item.product.grade}
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        type="number"
                        value={unitPrice}
                        onChange={(e) =>
                          onUpdateUnitPrice(item.id, parseFloat(e.target.value) || 0)
                        }
                        className="w-24 h-8 text-right"
                        min="0"
                      />
                    </td>
                    <td className="px-3 py-2">{vendor?.currency || item.currency || "KRW"}</td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) =>
                          onUpdateQuantity(item.id, parseInt(e.target.value) || 1)
                        }
                        className="w-20 h-8 text-right"
                        min="1"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      ₩{lineTotal.toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="text"
                        value={item.notes || ""}
                        onChange={(e) => onUpdateNotes(item.id, e.target.value)}
                        placeholder="비고 입력"
                        className="w-32 h-8 text-xs"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemove(item.id)}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 bg-slate-50 font-semibold">
                <td colSpan={9} className="px-3 py-2 text-right">
                  총액
                </td>
                <td className="px-3 py-2 text-right">₩{totalAmount.toLocaleString()}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}


import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Download, FileSpreadsheet, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PRODUCT_CATEGORIES, DEFAULT_TEMPLATE_COLUMNS, TEMPLATE_TYPES } from "@/lib/constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTemplates } from "@/hooks/use-templates";
import type { TemplateType } from "@/lib/constants";
import { PriceDisplay } from "@/components/products/price-display";

interface QuoteListItem {
  id: string;
  productId: string;
  product: {
    id: string;
    name: string;
    brand?: string;
    catalogNumber?: string;
    grade?: string;
    specification?: string;
    category: string;
    vendors?: Array<{
      id: string;
      vendor?: {
        id: string;
        name: string;
      };
      priceInKRW?: number;
      currency?: string;
    }>;
  };
  quantity: number;
  unitPrice?: number;
  currency?: string;
  lineTotal?: number;
  notes?: string;
}

interface QuoteListTableProps {
  items: QuoteListItem[];
  onRemove: (id: string) => void;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onUpdateNotes: (id: string, notes: string) => void;
  onUpdateUnitPrice: (id: string, price: number) => void;
  selectedTemplateId?: string;
  onTemplateChange?: (templateId: string | undefined) => void;
  templateType?: TemplateType;
}

export function QuoteListTable({
  items,
  onRemove,
  onUpdateQuantity,
  onUpdateNotes,
  onUpdateUnitPrice,
  selectedTemplateId,
  onTemplateChange,
  templateType,
}: QuoteListTableProps) {
  const [copied, setCopied] = useState(false);
  
  // 템플릿 목록 조회
  const { data: templatesData } = useTemplates(templateType);
  const templates = templatesData?.templates || [];
  
  // 선택된 템플릿의 컬럼 정의 가져오기 (현재는 기본 컬럼 사용)
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  // 총액 계산
  const totalAmount = items.reduce((sum, item) => {
    const lineTotal = item.lineTotal || (item.unitPrice || 0) * item.quantity;
    return sum + lineTotal;
  }, 0);

  // 클립보드 복사 (TSV 형태)
  const handleCopyToClipboard = async () => {
    const headers = [
      "Line No.",
      "제품명",
      "벤더",
      "카탈로그 번호",
      "규격/용량",
      "Grade/규격",
      "단가",
      "통화",
      "수량",
      "금액",
      "비고",
    ];

    const rows = items.map((item, index) => {
      const vendor = item.product.vendors?.[0];
      const unitPrice = item.unitPrice || vendor?.priceInKRW || 0;
      const lineTotal = item.lineTotal || unitPrice * item.quantity;

      return [
        (index + 1).toString(),
        item.product.name,
        vendor?.vendor?.name || item.product.brand || "",
        item.product.catalogNumber || "",
        item.product.specification || "",
        item.product.grade || "",
        unitPrice.toLocaleString(),
        vendor?.currency || item.currency || "KRW",
        item.quantity.toString(),
        lineTotal.toLocaleString(),
        item.notes || "",
      ];
    });

    const tsv = [headers, ...rows].map((row) => row.join("\t")).join("\n");

    try {
      await navigator.clipboard.writeText(tsv);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
      alert("클립보드 복사에 실패했습니다.");
    }
  };

  // CSV 다운로드
  const handleDownloadCSV = () => {
    const headers = [
      "Line No.",
      "제품명",
      "벤더",
      "카탈로그 번호",
      "규격/용량",
      "Grade/규격",
      "단가",
      "통화",
      "수량",
      "금액",
      "비고",
    ];

    const rows = items.map((item, index) => {
      const vendor = item.product.vendors?.[0];
      const unitPrice = item.unitPrice || vendor?.priceInKRW || 0;
      const lineTotal = item.lineTotal || unitPrice * item.quantity;

      return [
        (index + 1).toString(),
        `"${item.product.name}"`,
        `"${vendor?.vendor?.name || item.product.brand || ""}"`,
        `"${item.product.catalogNumber || ""}"`,
        `"${item.product.specification || ""}"`,
        `"${item.product.grade || ""}"`,
        unitPrice.toLocaleString(),
        vendor?.currency || item.currency || "KRW",
        item.quantity.toString(),
        lineTotal.toLocaleString(),
        `"${item.notes || ""}"`,
      ];
    });

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); // BOM 추가로 Excel 호환성 향상
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `품목리스트-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 엑셀 다운로드 (간단한 CSV 형태, 실제 엑셀은 xlsx 라이브러리 필요)
  const handleDownloadExcel = () => {
    // CSV로 다운로드 (Excel에서 열 수 있음)
    handleDownloadCSV();
  };

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">품목 리스트에 추가된 제품이 없습니다</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle>그룹웨어용 품목 리스트</CardTitle>
            <CardDescription>
              선택한 제품들을 그룹웨어 구매신청 양식에 사용할 수 있는 형태로 정리합니다
            </CardDescription>
          </div>
          {onTemplateChange && templates.length > 0 && (
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">템플릿:</Label>
              <Select
                value={selectedTemplateId || ""}
                onValueChange={(value) => onTemplateChange(value || undefined)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="템플릿 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">기본 템플릿</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                      {template.isDefault && " (기본)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyToClipboard}>
              <Copy className="h-4 w-4 mr-2" />
              {copied ? "복사됨!" : "클립보드 복사"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadCSV}>
              <Download className="h-4 w-4 mr-2" />
              CSV 다운로드
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              엑셀 다운로드
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="px-3 py-2 text-left font-medium">Line No.</th>
                <th className="px-3 py-2 text-left font-medium">제품명</th>
                <th className="px-3 py-2 text-left font-medium">벤더</th>
                <th className="px-3 py-2 text-left font-medium">카탈로그 번호</th>
                <th className="px-3 py-2 text-left font-medium">규격/용량</th>
                <th className="px-3 py-2 text-left font-medium">Grade</th>
                <th className="px-3 py-2 text-right font-medium">단가</th>
                <th className="px-3 py-2 text-left font-medium">통화</th>
                <th className="px-3 py-2 text-right font-medium">수량</th>
                <th className="px-3 py-2 text-right font-medium">금액</th>
                <th className="px-3 py-2 text-left font-medium">비고</th>
                <th className="px-3 py-2 text-center font-medium">삭제</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const vendor = item.product.vendors?.[0];
                const unitPrice = item.unitPrice || vendor?.priceInKRW || 0;
                const lineTotal = item.lineTotal || unitPrice * item.quantity;

                return (
                  <tr key={item.id} className="border-b hover:bg-slate-50">
                    <td className="px-3 py-2">{index + 1}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{item.product.name}</div>
                      {item.product.brand && (
                        <div className="text-xs text-muted-foreground">{item.product.brand}</div>
                      )}
                    </td>
                    <td className="px-3 py-2">{vendor?.vendor?.name || item.product.brand || "-"}</td>
                    <td className="px-3 py-2">{item.product.catalogNumber || "-"}</td>
                    <td className="px-3 py-2">{item.product.specification || "-"}</td>
                    <td className="px-3 py-2">
                      {item.product.grade ? (
                        <Badge variant="outline" className="text-xs">
                          {item.product.grade}
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        type="number"
                        value={unitPrice}
                        onChange={(e) =>
                          onUpdateUnitPrice(item.id, parseFloat(e.target.value) || 0)
                        }
                        className="w-24 h-8 text-right"
                        min="0"
                      />
                    </td>
                    <td className="px-3 py-2">{vendor?.currency || item.currency || "KRW"}</td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) =>
                          onUpdateQuantity(item.id, parseInt(e.target.value) || 1)
                        }
                        className="w-20 h-8 text-right"
                        min="1"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      ₩{lineTotal.toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="text"
                        value={item.notes || ""}
                        onChange={(e) => onUpdateNotes(item.id, e.target.value)}
                        placeholder="비고 입력"
                        className="w-32 h-8 text-xs"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemove(item.id)}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 bg-slate-50 font-semibold">
                <td colSpan={9} className="px-3 py-2 text-right">
                  총액
                </td>
                <td className="px-3 py-2 text-right">₩{totalAmount.toLocaleString()}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}


import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Download, FileSpreadsheet, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PRODUCT_CATEGORIES, DEFAULT_TEMPLATE_COLUMNS, TEMPLATE_TYPES } from "@/lib/constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTemplates } from "@/hooks/use-templates";
import type { TemplateType } from "@/lib/constants";
import { PriceDisplay } from "@/components/products/price-display";

interface QuoteListItem {
  id: string;
  productId: string;
  product: {
    id: string;
    name: string;
    brand?: string;
    catalogNumber?: string;
    grade?: string;
    specification?: string;
    category: string;
    vendors?: Array<{
      id: string;
      vendor?: {
        id: string;
        name: string;
      };
      priceInKRW?: number;
      currency?: string;
    }>;
  };
  quantity: number;
  unitPrice?: number;
  currency?: string;
  lineTotal?: number;
  notes?: string;
}

interface QuoteListTableProps {
  items: QuoteListItem[];
  onRemove: (id: string) => void;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onUpdateNotes: (id: string, notes: string) => void;
  onUpdateUnitPrice: (id: string, price: number) => void;
  selectedTemplateId?: string;
  onTemplateChange?: (templateId: string | undefined) => void;
  templateType?: TemplateType;
}

export function QuoteListTable({
  items,
  onRemove,
  onUpdateQuantity,
  onUpdateNotes,
  onUpdateUnitPrice,
  selectedTemplateId,
  onTemplateChange,
  templateType,
}: QuoteListTableProps) {
  const [copied, setCopied] = useState(false);
  
  // 템플릿 목록 조회
  const { data: templatesData } = useTemplates(templateType);
  const templates = templatesData?.templates || [];
  
  // 선택된 템플릿의 컬럼 정의 가져오기 (현재는 기본 컬럼 사용)
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  // 총액 계산
  const totalAmount = items.reduce((sum, item) => {
    const lineTotal = item.lineTotal || (item.unitPrice || 0) * item.quantity;
    return sum + lineTotal;
  }, 0);

  // 클립보드 복사 (TSV 형태)
  const handleCopyToClipboard = async () => {
    const headers = [
      "Line No.",
      "제품명",
      "벤더",
      "카탈로그 번호",
      "규격/용량",
      "Grade/규격",
      "단가",
      "통화",
      "수량",
      "금액",
      "비고",
    ];

    const rows = items.map((item, index) => {
      const vendor = item.product.vendors?.[0];
      const unitPrice = item.unitPrice || vendor?.priceInKRW || 0;
      const lineTotal = item.lineTotal || unitPrice * item.quantity;

      return [
        (index + 1).toString(),
        item.product.name,
        vendor?.vendor?.name || item.product.brand || "",
        item.product.catalogNumber || "",
        item.product.specification || "",
        item.product.grade || "",
        unitPrice.toLocaleString(),
        vendor?.currency || item.currency || "KRW",
        item.quantity.toString(),
        lineTotal.toLocaleString(),
        item.notes || "",
      ];
    });

    const tsv = [headers, ...rows].map((row) => row.join("\t")).join("\n");

    try {
      await navigator.clipboard.writeText(tsv);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
      alert("클립보드 복사에 실패했습니다.");
    }
  };

  // CSV 다운로드
  const handleDownloadCSV = () => {
    const headers = [
      "Line No.",
      "제품명",
      "벤더",
      "카탈로그 번호",
      "규격/용량",
      "Grade/규격",
      "단가",
      "통화",
      "수량",
      "금액",
      "비고",
    ];

    const rows = items.map((item, index) => {
      const vendor = item.product.vendors?.[0];
      const unitPrice = item.unitPrice || vendor?.priceInKRW || 0;
      const lineTotal = item.lineTotal || unitPrice * item.quantity;

      return [
        (index + 1).toString(),
        `"${item.product.name}"`,
        `"${vendor?.vendor?.name || item.product.brand || ""}"`,
        `"${item.product.catalogNumber || ""}"`,
        `"${item.product.specification || ""}"`,
        `"${item.product.grade || ""}"`,
        unitPrice.toLocaleString(),
        vendor?.currency || item.currency || "KRW",
        item.quantity.toString(),
        lineTotal.toLocaleString(),
        `"${item.notes || ""}"`,
      ];
    });

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); // BOM 추가로 Excel 호환성 향상
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `품목리스트-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 엑셀 다운로드 (간단한 CSV 형태, 실제 엑셀은 xlsx 라이브러리 필요)
  const handleDownloadExcel = () => {
    // CSV로 다운로드 (Excel에서 열 수 있음)
    handleDownloadCSV();
  };

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">품목 리스트에 추가된 제품이 없습니다</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle>그룹웨어용 품목 리스트</CardTitle>
            <CardDescription>
              선택한 제품들을 그룹웨어 구매신청 양식에 사용할 수 있는 형태로 정리합니다
            </CardDescription>
          </div>
          {onTemplateChange && templates.length > 0 && (
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">템플릿:</Label>
              <Select
                value={selectedTemplateId || ""}
                onValueChange={(value) => onTemplateChange(value || undefined)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="템플릿 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">기본 템플릿</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                      {template.isDefault && " (기본)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyToClipboard}>
              <Copy className="h-4 w-4 mr-2" />
              {copied ? "복사됨!" : "클립보드 복사"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadCSV}>
              <Download className="h-4 w-4 mr-2" />
              CSV 다운로드
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              엑셀 다운로드
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="px-3 py-2 text-left font-medium">Line No.</th>
                <th className="px-3 py-2 text-left font-medium">제품명</th>
                <th className="px-3 py-2 text-left font-medium">벤더</th>
                <th className="px-3 py-2 text-left font-medium">카탈로그 번호</th>
                <th className="px-3 py-2 text-left font-medium">규격/용량</th>
                <th className="px-3 py-2 text-left font-medium">Grade</th>
                <th className="px-3 py-2 text-right font-medium">단가</th>
                <th className="px-3 py-2 text-left font-medium">통화</th>
                <th className="px-3 py-2 text-right font-medium">수량</th>
                <th className="px-3 py-2 text-right font-medium">금액</th>
                <th className="px-3 py-2 text-left font-medium">비고</th>
                <th className="px-3 py-2 text-center font-medium">삭제</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const vendor = item.product.vendors?.[0];
                const unitPrice = item.unitPrice || vendor?.priceInKRW || 0;
                const lineTotal = item.lineTotal || unitPrice * item.quantity;

                return (
                  <tr key={item.id} className="border-b hover:bg-slate-50">
                    <td className="px-3 py-2">{index + 1}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{item.product.name}</div>
                      {item.product.brand && (
                        <div className="text-xs text-muted-foreground">{item.product.brand}</div>
                      )}
                    </td>
                    <td className="px-3 py-2">{vendor?.vendor?.name || item.product.brand || "-"}</td>
                    <td className="px-3 py-2">{item.product.catalogNumber || "-"}</td>
                    <td className="px-3 py-2">{item.product.specification || "-"}</td>
                    <td className="px-3 py-2">
                      {item.product.grade ? (
                        <Badge variant="outline" className="text-xs">
                          {item.product.grade}
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        type="number"
                        value={unitPrice}
                        onChange={(e) =>
                          onUpdateUnitPrice(item.id, parseFloat(e.target.value) || 0)
                        }
                        className="w-24 h-8 text-right"
                        min="0"
                      />
                    </td>
                    <td className="px-3 py-2">{vendor?.currency || item.currency || "KRW"}</td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) =>
                          onUpdateQuantity(item.id, parseInt(e.target.value) || 1)
                        }
                        className="w-20 h-8 text-right"
                        min="1"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      ₩{lineTotal.toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="text"
                        value={item.notes || ""}
                        onChange={(e) => onUpdateNotes(item.id, e.target.value)}
                        placeholder="비고 입력"
                        className="w-32 h-8 text-xs"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemove(item.id)}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 bg-slate-50 font-semibold">
                <td colSpan={9} className="px-3 py-2 text-right">
                  총액
                </td>
                <td className="px-3 py-2 text-right">₩{totalAmount.toLocaleString()}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

