import { MainLayout } from "../_components/main-layout";
import { MainHeader } from "../_components/main-header";
import { MainFooter } from "../_components/main-footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AboutPage() {
  return (
    <MainLayout>
      <MainHeader />
      <div className="container mx-auto px-4 py-8 md:py-16 max-w-4xl">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              시약·장비 검색부터<br /><span className="text-blue-600">구매 운영</span>까지 한곳에서
            </h1>
            <p className="text-muted-foreground text-lg">
              연구실의 반복 구매와 재고 운영 흐름을 한곳에서 관리하세요.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>우리의 목표</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                바이오·제약 현장에서 사용하는 시약·소모품·장비에 대해,
                검색 → 제품 비교 → 견적 요청 → 구매 이력·재고 관리까지
                하나의 플랫폼에서 이어주는 운영 도구를 만드는 것이 목표입니다.
              </p>
              <p>
                &quot;시약 쇼핑몰&quot;이 아니라, 연구실과 조직의 구매 흐름을 정리하고 관리하는 운영 플랫폼을 지향합니다.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>핵심 가치</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="list-disc list-inside space-y-2">
                <li>한 번의 검색으로 여러 벤더 제품을 비교·정리</li>
                <li>견적 요청 리스트를 구조화된 형식으로 생성</li>
                <li>구매 이력과 재고 현황을 대시보드에서 관리</li>
                <li>조직에서 실제로 쓰는 그룹웨어·엑셀 양식에 바로 연결</li>
                <li>안전·규제 정보까지 한 번에 확인</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>문의</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                문의사항이 있으시면 <a href="mailto:contact@labaxis.io" className="text-primary hover:underline">contact@labaxis.io</a>으로 연락주세요.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
      <MainFooter />
    </MainLayout>
  );
}

