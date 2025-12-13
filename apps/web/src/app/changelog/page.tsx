import { MainLayout } from "../_components/main-layout";
import { MainHeader } from "../_components/main-header";
import { MainFooter } from "../_components/main-footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const changelog = [
  {
    version: "v1.0.0",
    date: "2024-12-11",
    type: "feature",
    items: [
      "예산 설정 UI 개선 (입력 검증, 금액 포맷팅, 날짜 유효성 검사)",
      "공유 링크 일괄 삭제 API 구현",
      "벤더 ID 필터링 개선",
      "모바일 대시보드 메뉴 개선",
    ],
  },
  {
    version: "v0.9.0",
    date: "2024-12-10",
    type: "feature",
    items: [
      "안전·규제 정보 기능 추가 (MSDS/SDS 링크, 식약처 링크)",
      "예산 관리 및 리포트 기능",
      "조직 관리 및 Enterprise 기능",
      "인벤토리 관리 기능",
    ],
  },
  {
    version: "v0.8.0",
    date: "2024-12-09",
    type: "feature",
    items: [
      "프로토콜 분석 기능 (PDF 업로드, 텍스트 분석)",
      "Cat.No 및 Lot 번호 검색 기능",
      "전체 웹사이트 모바일 최적화",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <MainLayout>
      <MainHeader />
      <div className="container mx-auto px-4 py-8 md:py-16 max-w-4xl">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-4">변경 로그</h1>
            <p className="text-muted-foreground text-lg">
              BioInsight Lab의 주요 업데이트 내역입니다.
            </p>
          </div>

          <div className="space-y-6">
            {changelog.map((entry) => (
              <Card key={entry.version}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">{entry.version}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{entry.date}</Badge>
                      <Badge>{entry.type === "feature" ? "기능" : "수정"}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside space-y-2">
                    {entry.items.map((item, idx) => (
                      <li key={idx} className="text-sm">{item}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
      <MainFooter />
    </MainLayout>
  );
}

