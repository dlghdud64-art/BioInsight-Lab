"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import { MainHeader } from "@/app/_components/main-header";
import { PageHeader } from "@/app/_components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Plus,
  Search,
  Loader2,
  Download,
  Trash2,
} from "lucide-react";

interface Template {
  id: string;
  name: string;
  description?: string;
  itemCount: number;
  items: any[];
  createdAt: string;
  category?: string;
}

export default function TemplatesPage() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/templates");
      if (!response.ok) throw new Error("Failed to fetch templates");
      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error("Fetch templates error:", error);
      toast({
        title: "불러오기 실패",
        description: "템플릿 목록을 불러올 수 없습니다.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToList = async (template: Template) => {
    try {
      // TODO: Implement actual add to list logic
      // This would typically add items to a shopping cart or quote list
      toast({
        title: "추가 완료",
        description: `${template.name} (${template.itemCount}개 품목)이 목록에 추가되었습니다.`,
      });
    } catch (error) {
      console.error("Add to list error:", error);
      toast({
        title: "추가 실패",
        description: "목록에 추가할 수 없습니다.",
        variant: "destructive",
      });
    }
  };

  const handleExportTemplate = async (template: Template) => {
    try {
      const response = await fetch(`/api/templates/${template.id}/export`);
      if (!response.ok) throw new Error("Export failed");
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `template_${template.name}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "내보내기 완료",
        description: "템플릿이 엑셀 파일로 다운로드되었습니다.",
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "내보내기 실패",
        description: "파일을 생성할 수 없습니다.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm("정말 이 템플릿을 삭제하시겠습니까?")) return;

    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Delete failed");

      setTemplates(templates.filter((t) => t.id !== templateId));
      toast({
        title: "삭제 완료",
        description: "템플릿이 삭제되었습니다.",
      });
    } catch (error) {
      console.error("Delete error:", error);
      toast({
        title: "삭제 실패",
        description: "템플릿을 삭제할 수 없습니다.",
        variant: "destructive",
      });
    }
  };

  const filteredTemplates = templates.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <MainHeader />
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <PageHeader
          title="실험 템플릿"
          description="자주 사용하는 실험 구성을 템플릿으로 저장하고 빠르게 불러오세요."
          icon={FileText}
          iconColor="text-purple-600"
        />

        {/* Search & Filter */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
            <Input
              placeholder="템플릿 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            새 템플릿 만들기
          </Button>
        </div>

        {/* Templates Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-600 mb-1">
              {searchQuery ? "검색 결과가 없습니다." : "저장된 템플릿이 없습니다."}
            </p>
            <p className="text-xs text-slate-500">
              자주 사용하는 실험 구성을 템플릿으로 저장해보세요.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className="bg-white border border-slate-200 rounded-lg p-4 hover:border-slate-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 mb-1 truncate">
                      {template.name}
                    </h3>
                    {template.description && (
                      <p className="text-xs text-slate-600 line-clamp-2">
                        {template.description}
                      </p>
                    )}
                  </div>
                  {template.category && (
                    <Badge variant="outline" className="text-xs flex-shrink-0 ml-2">
                      {template.category}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2 mb-4 text-xs text-slate-500">
                  <span>{template.itemCount}개 품목</span>
                  <span>•</span>
                  <span>
                    {new Date(template.createdAt).toLocaleDateString("ko-KR")}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleAddToList(template)}
                    className="flex-1"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add to List
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleExportTemplate(template)}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteTemplate(template.id)}
                  >
                    <Trash2 className="h-3 w-3 text-slate-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

