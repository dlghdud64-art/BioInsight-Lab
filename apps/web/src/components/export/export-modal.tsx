"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ColumnMappingRow, ColumnMapping } from "./column-mapping-row";
import { Download, Plus, FileSpreadsheet, Lock, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateCustomExcel } from "@/lib/export/excel-generator";

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: any[];
  userPlan?: "free" | "team" | "organization";
}

const AVAILABLE_FIELDS = [
  { value: "productName", label: "Product Name" },
  { value: "casNumber", label: "CAS No" },
  { value: "catalogNumber", label: "Catalog Number" },
  { value: "vendor", label: "Vendor" },
  { value: "price", label: "Price" },
  { value: "quantity", label: "Quantity" },
  { value: "unit", label: "Unit" },
  { value: "category", label: "Category" },
  { value: "purity", label: "Purity" },
  { value: "grade", label: "Grade" },
];

export function ExportModal({
  open,
  onOpenChange,
  data,
  userPlan = "free",
}: ExportModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("basic");
  const [isExporting, setIsExporting] = useState(false);
  
  // Custom export state
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [mappings, setMappings] = useState<ColumnMapping[]>([
    { id: "1", erpColumnName: "", appDataField: "" },
  ]);
  const [savePreset, setSavePreset] = useState(false);
  const [presetName, setPresetName] = useState("");

  const canUseCustomExport = userPlan === "team" || userPlan === "organization";

  const handleAddMapping = () => {
    const newId = (mappings.length + 1).toString();
    setMappings([...mappings, { id: newId, erpColumnName: "", appDataField: "" }]);
  };

  const handleUpdateMapping = (
    id: string,
    field: keyof ColumnMapping,
    value: string
  ) => {
    setMappings(
      mappings.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  const handleRemoveMapping = (id: string) => {
    if (mappings.length > 1) {
      setMappings(mappings.filter((m) => m.id !== id));
    }
  };

  const handleBasicExport = async () => {
    try {
      setIsExporting(true);
      // Basic export with default columns
      const workbook = await generateCustomExcel(data, null);
      
      // Trigger download
      const blob = new Blob([workbook], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `export_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "내보내기 완료",
        description: "엑셀 파일이 다운로드되었습니다.",
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "내보내기 실패",
        description: "파일 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleCustomExport = async () => {
    // Validate mappings
    const validMappings = mappings.filter(
      (m) => m.erpColumnName && m.appDataField
    );
    if (validMappings.length === 0) {
      toast({
        title: "매핑 오류",
        description: "최소 1개 이상의 컬럼 매핑을 설정해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (savePreset && !presetName.trim()) {
      toast({
        title: "프리셋 이름 필요",
        description: "프리셋을 저장하려면 이름을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsExporting(true);

      // Save preset if requested
      if (savePreset && presetName) {
        await fetch("/api/export/presets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: presetName,
            mappings: validMappings,
          }),
        });
      }

      // Generate custom excel
      const workbook = await generateCustomExcel(data, validMappings);
      
      // Trigger download
      const blob = new Blob([workbook], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `custom_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "내보내기 완료",
        description: `맞춤 형식으로 ${validMappings.length}개 컬럼이 내보내졌습니다.`,
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Custom export error:", error);
      toast({
        title: "내보내기 실패",
        description: "파일 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            엑셀로 내보내기
          </DialogTitle>
          <DialogDescription>
            데이터를 엑셀 파일로 다운로드합니다. {data.length}개 항목
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="custom" disabled={!canUseCustomExport}>
              Custom
              {!canUseCustomExport && (
                <Lock className="h-3 w-3 ml-1.5" />
              )}
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Basic Export */}
          <TabsContent value="basic" className="space-y-4">
            <div className="text-sm text-slate-600">
              기본 형식으로 모든 데이터를 내보냅니다.
            </div>
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div className="text-sm font-medium mb-2">포함될 컬럼:</div>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_FIELDS.slice(0, 6).map((field) => (
                  <Badge key={field.value} variant="secondary">
                    {field.label}
                  </Badge>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Tab 2: Custom Export (Team Plan) */}
          <TabsContent value="custom" className="space-y-4">
            {!canUseCustomExport && (
              <Alert>
                <Lock className="h-4 w-4" />
                <AlertDescription>
                  맞춤 내보내기는 Team 플랜 이상에서 사용 가능합니다.
                </AlertDescription>
              </Alert>
            )}

            {canUseCustomExport && (
              <>
                {/* Preset Select */}
                <div className="space-y-2">
                  <Label>저장된 양식 불러오기</Label>
                  <Select value={selectedPreset} onValueChange={setSelectedPreset}>
                    <SelectTrigger>
                      <SelectValue placeholder="양식을 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sap">SAP 양식</SelectItem>
                      <SelectItem value="oracle">Oracle ERP 양식</SelectItem>
                      <SelectItem value="custom1">맞춤 양식 1</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Column Mapping */}
                <div className="space-y-3">
                  <Label>컬럼 매핑</Label>
                  <div className="space-y-2">
                    {mappings.map((mapping) => (
                      <ColumnMappingRow
                        key={mapping.id}
                        mapping={mapping}
                        onUpdate={handleUpdateMapping}
                        onRemove={handleRemoveMapping}
                        availableFields={AVAILABLE_FIELDS}
                      />
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddMapping}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Column
                  </Button>
                </div>

                {/* Save Preset */}
                <div className="space-y-3 pt-4 border-t border-slate-200">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="save-preset"
                      checked={savePreset}
                      onCheckedChange={(checked) => setSavePreset(!!checked)}
                    />
                    <Label
                      htmlFor="save-preset"
                      className="text-sm font-normal cursor-pointer"
                    >
                      이 설정을 양식으로 저장
                    </Label>
                  </div>
                  {savePreset && (
                    <Input
                      placeholder="양식 이름 (예: SAP 전용 양식)"
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                    />
                  )}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button
            onClick={activeTab === "basic" ? handleBasicExport : handleCustomExport}
            disabled={isExporting || (activeTab === "custom" && !canUseCustomExport)}
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                내보내는 중...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                엑셀 다운로드
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

