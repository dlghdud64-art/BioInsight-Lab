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
            <h1 className="text-3xl md:text-4xl font-bold mb-4">서비스 소개</h1>
            <p className="text-muted-foreground text-lg">
              BioInsight Lab은 바이오·제약 연구자를 위한 AI 기반 시약·장비 검색·비교·견적 플랫폼입니다.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>우리의 목표</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                바이오·제약 연구/품질/생산 현장에서 사용하는 시약·소모품·장비에 대해,
                검색/AI 분석 → 제품 비교 → 견적 요청 리스트 생성 → 그룹웨어/전자결재용 텍스트·파일 생성까지
                하나의 웹 서비스 안에서 자연스럽게 이어주는 구매 준비 플랫폼을 만드는 것이 목표입니다.
              </p>
              <p>
                우리는 "시약 쇼핑몰"이 아니라, 연구실/조직의 시약·장비 구매 준비/정리 도구 + 인사이트 도구를 지향합니다.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>핵심 가치</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="list-disc list-inside space-y-2">
                <li>한 번의 검색/입력 → 여러 벤더 제품 자동 정리</li>
                <li>GPT로 의미 분석, 유사 제품 추천, 필터 정리</li>
                <li>비교/견적 리스트를 구조화된 형식으로 자동 생성</li>
                <li>조직에서 실제로 쓰는 그룹웨어/엑셀 양식에 바로 붙여넣기</li>
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
                문의사항이 있으시면 <a href="mailto:contact@bioinsight.lab" className="text-primary hover:underline">contact@bioinsight.lab</a>으로 연락주세요.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
      <MainFooter />
    </MainLayout>
  );
}

