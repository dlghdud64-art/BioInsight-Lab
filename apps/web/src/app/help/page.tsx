import { MainLayout } from "../_components/main-layout";
import { MainHeader } from "../_components/main-header";
import { MainFooter } from "../_components/main-footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

const guides = [
  {
    title: "검색 및 제품 찾기",
    description: "제품명, 타깃, 브랜드, 카탈로그 번호로 검색하는 방법",
    href: "/test/search",
  },
  {
    title: "제품 비교하기",
    description: "여러 제품을 선택하여 가격, 스펙, 납기를 비교하는 방법",
    href: "/test/compare",
  },
  {
    title: "품목 리스트 만들기",
    description: "구매 요청 리스트를 만들고 TSV/CSV로 내보내는 방법",
    href: "/test/quote",
  },
  {
    title: "프로토콜 분석",
    description: "프로토콜 텍스트나 PDF를 업로드하여 필요한 시약을 자동 추출하는 방법",
    href: "/protocol/bom",
  },
  {
    title: "예산 관리",
    description: "조직/팀/프로젝트별 예산을 설정하고 사용률을 추적하는 방법",
    href: "/dashboard/budget",
  },
  {
    title: "구매 리포트",
    description: "구매 내역을 조회하고 분석하는 방법",
    href: "/reports",
  },
];

export default function HelpPage() {
  return (
    <MainLayout>
      <MainHeader />
      <div className="container mx-auto px-4 py-8 md:py-16 max-w-4xl">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-4">도움말 · 가이드</h1>
            <p className="text-muted-foreground text-lg">
              BioInsight Lab 사용 방법을 안내합니다.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {guides.map((guide) => (
              <Card key={guide.title} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg">{guide.title}</CardTitle>
                  <CardDescription>{guide.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link
                    href={guide.href}
                    className="text-sm text-primary hover:underline"
                  >
                    가이드 보기 →
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>자주 묻는 질문 (FAQ)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Q: 검색 결과가 없어요</h3>
                <p className="text-sm text-muted-foreground">
                  A: 검색어를 다르게 입력하거나, 카테고리 필터를 조정해보세요. 
                  제품명, 브랜드명, 카탈로그 번호 등 다양한 키워드로 시도해보실 수 있습니다.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Q: 품목 리스트를 어떻게 공유하나요?</h3>
                <p className="text-sm text-muted-foreground">
                  A: 품목 리스트 페이지에서 "공유 링크 생성" 버튼을 클릭하면 
                  링크가 생성됩니다. 이 링크를 구매 담당자에게 공유하실 수 있습니다.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Q: 문의는 어디로 하나요?</h3>
                <p className="text-sm text-muted-foreground">
                  A: <a href="mailto:contact@bioinsight.lab" className="text-primary hover:underline">contact@bioinsight.lab</a>으로 문의주세요.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <MainFooter />
    </MainLayout>
  );
}

