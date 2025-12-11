import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

export function TestHeader() {
  return (
    <header className="mb-8 border-b bg-white pb-6">
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-xs">
              기능 체험 환경
            </Badge>
            <span className="text-xs text-muted-foreground">local</span>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">
              데모 플로우
            </h1>
            <p className="text-sm text-slate-600 max-w-2xl">
              검색/AI 분석 → 제품 비교 → 품목 리스트 → 그룹웨어 공유까지 전체 플로우를 단계별로 체험할 수 있는 페이지입니다.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="/docs/PRD.md" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              문서 보기
            </a>
          </Button>
        </div>
      </div>
    </header>
  );
}