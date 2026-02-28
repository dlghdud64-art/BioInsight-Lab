"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { CloudUpload, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const TEMPLATE_HEADERS = [
  "시약명",
  "영문명",
  "CAS No",
  "카탈로그번호",
  "수량",
  "단위",
  "유효기간",
  "안전재고",
  "최소주문수량",
  "보관위치",
  "비고",
] as const;

const COLUMN_MAP: Record<string, string> = {
  시약명: "productName",
  영문명: "englishName",
  "CAS No": "casNo",
  카탈로그번호: "catalogNumber",
  수량: "currentQuantity",
  단위: "unit",
  유효기간: "expiryDate",
  안전재고: "safetyStock",
  최소주문수량: "minOrderQty",
  보관위치: "location",
  비고: "notes",
};

interface BulkImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function BulkImportModal({
  open,
  onOpenChange,
  onSuccess,
}: BulkImportModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const { data: orgsData } = useQuery({
    queryKey: ["user-organizations"],
    queryFn: async () => {
      const res = await fetch("/api/organizations");
      if (!res.ok) throw new Error("Failed to fetch organizations");
      return res.json();
    },
    enabled: open,
  });

  const organizations = orgsData?.organizations || [];
  const adminOrg = organizations.find(
    (org: { role?: string; id?: string }) => org.role === "ADMIN"
  );
  const organizationId = adminOrg?.id ?? organizations[0]?.id;

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "재고 템플릿");
    XLSX.writeFile(wb, "재고_일괄등록_템플릿.xlsx");
  };

  const parseExcelToItems = (file: File): Promise<Record<string, unknown>[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          if (!data) {
            reject(new Error("파일을 읽을 수 없습니다."));
            return;
          }
          const workbook = XLSX.read(data, { type: "binary" });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
            header: 1,
            defval: "",
          }) as unknown[][];

          if (rows.length < 2) {
            reject(new Error("데이터 행이 없습니다. 헤더와 최소 1개 이상의 데이터 행이 필요합니다."));
            return;
          }

          const headers = rows[0] as string[];
          const items: Record<string, unknown>[] = [];

          for (let i = 1; i < rows.length; i++) {
            const row = rows[i] as unknown[];
            const item: Record<string, unknown> = {};
            headers.forEach((h, idx) => {
              const key = COLUMN_MAP[h?.trim() ?? ""] ?? h?.trim();
              if (key) {
                const val = row[idx];
                if (val !== undefined && val !== null && String(val).trim() !== "") {
                  item[key] = val;
                }
              }
            });
            const productName = String(item.productName ?? "").trim();
            const currentQuantity = item.currentQuantity;
            if (productName && (currentQuantity !== undefined || currentQuantity !== null)) {
              items.push(item);
            }
          }

          resolve(items);
        } catch (err) {
          reject(err instanceof Error ? err : new Error("파일 파싱에 실패했습니다."));
        }
      };
      reader.onerror = () => reject(new Error("파일 읽기 오류"));
      reader.readAsBinaryString(file);
    });
  };

  const mapToApiItems = (
    parsed: Record<string, unknown>[]
  ): Array<{
    productName: string;
    catalogNumber?: string;
    currentQuantity: number;
    unit?: string;
    category?: string;
    safetyStock?: number;
    minOrderQty?: number;
    location?: string;
    expiryDate?: string;
    notes?: string;
  }> => {
    return parsed
      .map((row) => {
        const productName = String(row.productName ?? "").trim();
        if (!productName) return null;

        const qtyRaw = row.currentQuantity;
        let currentQuantity = 0;
        if (typeof qtyRaw === "number" && !isNaN(qtyRaw)) {
          currentQuantity = qtyRaw;
        } else if (qtyRaw !== undefined && qtyRaw !== null) {
          const parsedQty = parseFloat(String(qtyRaw).replace(/[,\s]/g, ""));
          if (!isNaN(parsedQty) && parsedQty >= 0) currentQuantity = parsedQty;
        }

        const catalogNumber = row.catalogNumber
          ? String(row.catalogNumber).trim() || undefined
          : undefined;

        let notes = row.notes ? String(row.notes).trim() : undefined;
        const englishName = row.englishName ? String(row.englishName).trim() : "";
        const casNo = row.casNo ? String(row.casNo).trim() : "";
        if (englishName || casNo) {
          const extra = [englishName, casNo].filter(Boolean).join(" / ");
          notes = notes ? `${notes} (${extra})` : extra;
        }

        let expiryDate: string | undefined;
        const expRaw = row.expiryDate;
        if (expRaw !== undefined && expRaw !== null && String(expRaw).trim() !== "") {
          let d: Date;
          if (typeof expRaw === "number") {
            d = new Date((expRaw - 25569) * 86400000);
          } else {
            d = new Date(String(expRaw));
          }
          if (!isNaN(d.getTime())) {
            expiryDate = d.toISOString().split("T")[0];
          }
        }

        const safetyStock =
          row.safetyStock !== undefined && row.safetyStock !== null
            ? parseFloat(String(row.safetyStock).replace(/[,\s]/g, ""))
            : undefined;
        const minOrderQty =
          row.minOrderQty !== undefined && row.minOrderQty !== null
            ? parseFloat(String(row.minOrderQty).replace(/[,\s]/g, ""))
            : undefined;

        return {
          productName,
          catalogNumber,
          currentQuantity,
          unit: row.unit ? String(row.unit).trim() || undefined : undefined,
          category: row.category ? String(row.category).trim() || undefined : undefined,
          safetyStock: !isNaN(safetyStock ?? NaN) && (safetyStock ?? 0) >= 0 ? safetyStock : undefined,
          minOrderQty: !isNaN(minOrderQty ?? NaN) && (minOrderQty ?? 0) >= 0 ? minOrderQty : undefined,
          location: row.location ? String(row.location).trim() || undefined : undefined,
          expiryDate,
          notes,
        };
      })
      .filter(
        (x): x is NonNullable<typeof x> => x !== null && x.currentQuantity >= 0
      );
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) handleFile(files[0]);
    },
    [organizationId]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) handleFile(files[0]);
      e.target.value = "";
    },
    [organizationId]
  );

  const handleFile = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext ?? "")) {
      toast({
        title: "파일 형식 오류",
        description: "xlsx, xls, csv 파일만 업로드할 수 있습니다.",
        variant: "destructive",
      });
      return;
    }

    if (!organizationId) {
      toast({
        title: "조직 정보 필요",
        description: "대량 등록은 조직 관리자(ADMIN)만 가능합니다. 조직에 가입해 주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const parsed = await parseExcelToItems(file);
      const items = mapToApiItems(parsed);

      if (items.length === 0) {
        toast({
          title: "데이터 없음",
          description: "시약명과 수량이 있는 행이 없습니다. 템플릿 형식을 확인해 주세요.",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch("/api/inventory/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, items }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          (data as { error?: string }).error ||
            data.details?.map((d: { message: string }) => d.message).join(", ") ||
            "등록에 실패했습니다."
        );
      }

      const count = (data as { count?: number }).count ?? items.length;
      router.refresh();
      onOpenChange(false);
      onSuccess?.();
      toast({
        title: "등록 완료",
        description: `${count}개의 재고가 등록되었습니다.`,
      });
    } catch (err) {
      toast({
        title: "등록 실패",
        description: err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>재고 일괄 등록</DialogTitle>
          <DialogDescription>
            엑셀 파일로 기존 재고 대장을 한 번에 업로드합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={downloadTemplate}
          >
            <Download className="h-4 w-4 mr-2" />
            표준 엑셀 템플릿 다운로드
          </Button>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              border-dashed border-2 border-slate-300 bg-slate-50 rounded-lg p-12
              flex flex-col items-center justify-center text-center
              transition-colors cursor-pointer
              ${isDragging ? "border-blue-400 bg-slate-100" : "hover:border-slate-400 hover:bg-slate-100"}
              ${isUploading ? "pointer-events-none opacity-70" : ""}
            `}
          >
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              className="hidden"
              id="bulk-import-file"
              disabled={isUploading}
            />
            <label
              htmlFor="bulk-import-file"
              className="cursor-pointer flex flex-col items-center gap-3 w-full"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-12 w-12 text-slate-500 animate-spin" />
                  <p className="text-sm font-medium text-slate-700">
                    데이터를 분석하고 저장 중입니다...
                  </p>
                </>
              ) : (
                <>
                  <CloudUpload className="h-12 w-12 text-slate-500" />
                  <p className="text-sm font-medium text-slate-700">
                    여기로 엑셀 파일을 드래그하거나 클릭하여 업로드하세요
                  </p>
                </>
              )}
            </label>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
