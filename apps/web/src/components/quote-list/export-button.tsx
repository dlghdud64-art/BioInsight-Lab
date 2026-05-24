"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
// §11.298 Radix DropdownMenu* import 제거 — inline plain dropdown.
import { Download, FileSpreadsheet, FileText, Archive } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { UpgradeModal } from "@/components/billing/upgrade-modal";
import { SubscriptionPlan, getPlanLimits } from "@/lib/plans";
import { useRouter } from "next/navigation";

interface ExportButtonProps {
  quoteListId: string;
  disabled?: boolean;
  currentPlan?: SubscriptionPlan;
}

export function ExportButton({ 
  quoteListId, 
  disabled,
  currentPlan = SubscriptionPlan.FREE 
}: ExportButtonProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isExporting, setIsExporting] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  // §11.298 export-button plain dropdown state.
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  
  const limits = getPlanLimits(currentPlan);
  const hasExportPack = limits.features.exportPack;

  const handleExport = async (type: "items_tsv" | "responses_csv" | "pack_zip") => {
    // 플랜 체크
    if (!hasExportPack) {
      setShowUpgradeModal(true);
      return;
    }

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
      toast({
        title: "오류",
        description: "파일 내보내기에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleUpgrade = () => {
    router.push("/settings/billing");
  };

  return (
    <>
      {/* §11.298 plain dropdown */}
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || isExporting}
          aria-expanded={isExportMenuOpen}
          aria-haspopup="menu"
          onClick={() => setIsExportMenuOpen((v) => !v)}
        >
          <Download className="h-4 w-4 mr-2 pointer-events-none" />
          구매팀 제출용 내보내기
        </Button>
        {isExportMenuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsExportMenuOpen(false)} aria-hidden="true" />
            <div role="menu" className="absolute right-0 top-full mt-1 w-48 rounded-md border border-slate-200 bg-white shadow-lg z-50 py-1">
              <button type="button" role="menuitem" onClick={() => { handleExport("items_tsv"); setIsExportMenuOpen(false); }} className="w-full flex items-center px-3 py-2 text-sm text-left text-slate-700 hover:bg-slate-100">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                품목 리스트 (TSV)
              </button>
              <button type="button" role="menuitem" onClick={() => { handleExport("responses_csv"); setIsExportMenuOpen(false); }} className="w-full flex items-center px-3 py-2 text-sm text-left text-slate-700 hover:bg-slate-100">
                <FileText className="h-4 w-4 mr-2" />
                회신 비교 (CSV)
              </button>
              <button type="button" role="menuitem" onClick={() => { handleExport("pack_zip"); setIsExportMenuOpen(false); }} className="w-full flex items-center px-3 py-2 text-sm text-left text-slate-700 hover:bg-slate-100">
                <Archive className="h-4 w-4 mr-2" />
                전체 패키지 (ZIP)
              </button>
            </div>
          </>
        )}
      </div>

      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        feature="구매팀 제출용 내보내기 (Export Pack)"
        requiredPlan={SubscriptionPlan.TEAM}
        onUpgrade={handleUpgrade}
      />
    </>
  );
}

