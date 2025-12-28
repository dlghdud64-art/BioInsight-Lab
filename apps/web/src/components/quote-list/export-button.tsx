"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, Archive } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ExportButtonProps {
  quoteListId: string;
  disabled?: boolean;
}

export function ExportButton({ quoteListId, disabled }: ExportButtonProps) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (type: "items_tsv" | "responses_csv" | "pack_zip") => {
    try {
      setIsExporting(true);

      const response = await fetch(
        `/api/quote-lists/${quoteListId}/export?type=${type}`
      );

      if (!response.ok) {
        throw new Error("Export failed");
      }

      // 파일 다운로드
      const blob = await response.blob();
      const contentDisposition = response.headers.get("content-disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || `export.${type.split("_")[1]}`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "다운로드 완료",
        description: `${filename} 파일이 다운로드되었습니다.`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "오류",
        description: "파일 내보내기에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || isExporting}>
          <Download className="h-4 w-4 mr-2" />
          구매팀 제출용 내보내기
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("items_tsv")}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          품목 리스트 (TSV)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("responses_csv")}>
          <FileText className="h-4 w-4 mr-2" />
          회신 비교 (CSV)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("pack_zip")}>
          <Archive className="h-4 w-4 mr-2" />
          전체 패키지 (ZIP)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

