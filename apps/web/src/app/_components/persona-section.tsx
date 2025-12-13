"use client";

// useState 미사용으로 인한 lint 경고 제거
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FlaskConical, CheckCircle2, Factory, ShoppingCart } from "lucide-react";

// UTF-8 인코딩 문제로 인한 한글 깨짐 수정
export function PersonaSection() {
  return (
    <section id="personas" className="mt-6 md:mt-12 space-y-2 md:space-y-4 scroll-mt-14">
      <h2 className="text-sm md:text-lg font-semibold tracking-tight text-slate-900">
        누가 쓰나요?
      </h2>
      <Tabs defaultValue="rnd" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 gap-1 md:gap-0">
          <TabsTrigger value="rnd" className="text-[10px] md:text-sm px-2 md:px-4">R&D 연구자</TabsTrigger>
          <TabsTrigger value="qc" className="text-[10px] md:text-sm px-2 md:px-4">QC·QA 실무자</TabsTrigger>
          <TabsTrigger value="production" className="text-[10px] md:text-sm px-2 md:px-4">생산 엔지니어</TabsTrigger>
          <TabsTrigger value="buyer" className="text-[10px] md:text-sm px-2 md:px-4">구매 담당자</TabsTrigger>
        </TabsList>

        <TabsContent value="rnd" className="mt-6 md:mt-4">
          <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
            <CardHeader className="p-3 md:p-6">
              <div className="flex items-center gap-2 mb-2">
                <FlaskConical className="h-4 w-4 md:h-5 md:w-5 text-slate-900 flex-shrink-0" />
                <CardTitle className="text-sm md:text-base text-slate-900">R&D 연구자</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0">
              <CardDescription className="text-xs md:text-sm text-slate-500">
                <ul className="space-y-2 list-disc list-inside">
                  <li>실험 프로토콜에서 필요한 시약을 자동으로 추출</li>
                  <li>스펙 중심으로 제품 비교 및 대체품 검토</li>
                  <li>영문 데이터시트를 한글로 요약/번역</li>
                  <li>연구실 예산 내에서 최적의 제품 선택</li>
                </ul>
              </CardDescription>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="qc" className="mt-6 md:mt-4">
          <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
            <CardHeader className="p-3 md:p-6">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5 text-slate-900 flex-shrink-0" />
                <CardTitle className="text-sm md:text-base text-slate-900">QC/QA 실무자</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0">
              <CardDescription className="text-xs md:text-sm text-slate-500">
                <ul className="space-y-2 list-disc list-inside">
                  <li>동일 Grade/규격 유지가 중요한 대체품 검토</li>
                  <li>GMP, 분석용 등급 정보 중심 비교</li>
                  <li>규격 준수 여부 빠른 확인</li>
                  <li>품질 기준에 맞는 제품만 필터링</li>
                </ul>
              </CardDescription>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="production" className="mt-6 md:mt-4">
          <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
            <CardHeader className="p-3 md:p-6">
              <div className="flex items-center gap-2 mb-2">
                <Factory className="h-4 w-4 md:h-5 md:w-5 text-slate-900 flex-shrink-0" />
                <CardTitle className="text-sm md:text-base text-slate-900">생산 엔지니어</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0">
              <CardDescription className="text-xs md:text-sm text-slate-500">
                <ul className="space-y-2 list-disc list-inside">
                  <li>대량 구매 시 가격·납기 중심 비교</li>
                  <li>재고 관리 및 자동 재주문 추천</li>
                  <li>프로젝트별 구매 내역 리포트</li>
                  <li>예산 대비 사용률 추적</li>
                </ul>
              </CardDescription>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="buyer" className="mt-6 md:mt-4">
          <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
            <CardHeader className="p-3 md:p-6">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingCart className="h-4 w-4 md:h-5 md:w-5 text-slate-900 flex-shrink-0" />
                <CardTitle className="text-sm md:text-base text-slate-900">구매 담당자</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0">
              <CardDescription className="text-xs md:text-sm text-slate-500">
                <ul className="space-y-2 list-disc list-inside">
                  <li>팀에서 요청한 품목 리스트를 한 번에 확인</li>
                  <li>벤더별 가격·납기 비교 및 견적 요청</li>
                  <li>기간별/프로젝트별 구매 리포트 생성</li>
                  <li>예산 책정 및 사용률 관리</li>
                </ul>
              </CardDescription>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}
