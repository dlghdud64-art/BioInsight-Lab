"use client";

// useState 미사용으로 인한 lint 경고 제거
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FlaskConical, CheckCircle2, Factory, ShoppingCart } from "lucide-react";

// UTF-8 인코딩 문제로 인한 한글 깨짐 수정
export function PersonaSection() {
  return (
    <section id="personas" className="py-8 md:py-10 border-b border-slate-200 bg-white scroll-mt-14">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <h2 className="text-base md:text-lg font-semibold tracking-tight text-slate-900 mb-3">
          누가 쓰나요?
        </h2>
        <Tabs defaultValue="rnd" className="w-full">
          <TabsList className="grid w-full grid-cols-4 gap-1 overflow-x-auto">
            <TabsTrigger value="rnd" className="text-[10px] md:text-xs px-1.5 md:px-3 whitespace-nowrap">R&D 연구자</TabsTrigger>
            <TabsTrigger value="qc" className="text-[10px] md:text-xs px-1.5 md:px-3 whitespace-nowrap">QC·QA</TabsTrigger>
            <TabsTrigger value="production" className="text-[10px] md:text-xs px-1.5 md:px-3 whitespace-nowrap">생산</TabsTrigger>
            <TabsTrigger value="buyer" className="text-[10px] md:text-xs px-1.5 md:px-3 whitespace-nowrap">구매</TabsTrigger>
          </TabsList>

          <TabsContent value="rnd" className="mt-4">
            <Card className="border border-slate-200 bg-white rounded-lg">
              <CardHeader className="p-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-purple-100 flex-shrink-0">
                    <FlaskConical className="h-3.5 w-3.5 text-purple-600 flex-shrink-0" strokeWidth={1.5} />
                  </div>
                  <CardTitle className="text-sm text-slate-900">R&D 연구자</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-2">
                <CardDescription className="text-xs text-slate-600 leading-snug">
                  <ul className="space-y-1 list-disc list-inside">
                    <li>실험 프로토콜에서 필요한 시약을 자동으로 추출</li>
                    <li>스펙 중심으로 제품 비교 및 대체품 검토</li>
                    <li>영문 데이터시트를 한글로 요약/번역</li>
                    <li>연구실 예산 내에서 최적의 제품 선택</li>
                  </ul>
                </CardDescription>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="qc" className="mt-4">
            <Card className="border border-slate-200 bg-white rounded-lg">
              <CardHeader className="p-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100 flex-shrink-0">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" strokeWidth={1.5} />
                  </div>
                  <CardTitle className="text-sm text-slate-900">QC/QA 실무자</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-2">
                <CardDescription className="text-xs text-slate-600 leading-snug">
                  <ul className="space-y-1 list-disc list-inside">
                    <li>동일 Grade/규격 유지가 중요한 대체품 검토</li>
                    <li>GMP, 분석용 등급 정보 중심 비교</li>
                    <li>규격 준수 여부 빠른 확인</li>
                    <li>품질 기준에 맞는 제품만 필터링</li>
                  </ul>
                </CardDescription>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="production" className="mt-4">
            <Card className="border border-slate-200 bg-white rounded-lg">
              <CardHeader className="p-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-100 flex-shrink-0">
                    <Factory className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" strokeWidth={1.5} />
                  </div>
                  <CardTitle className="text-sm text-slate-900">생산 엔지니어</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-2">
                <CardDescription className="text-xs text-slate-600 leading-snug">
                  <ul className="space-y-1 list-disc list-inside">
                    <li>대량 구매 시 가격·납기 중심 비교</li>
                    <li>재고 관리 및 자동 재주문 추천</li>
                    <li>프로젝트별 구매 내역 리포트</li>
                    <li>예산 대비 사용률 추적</li>
                  </ul>
                </CardDescription>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="buyer" className="mt-4">
            <Card className="border border-slate-200 bg-white rounded-lg">
              <CardHeader className="p-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-100 flex-shrink-0">
                    <ShoppingCart className="h-3.5 w-3.5 text-indigo-600 flex-shrink-0" strokeWidth={1.5} />
                  </div>
                  <CardTitle className="text-sm text-slate-900">구매 담당자</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-2">
                <CardDescription className="text-xs text-slate-600 leading-snug">
                  <ul className="space-y-1 list-disc list-inside">
                    <li>팀에서 요청한 견적 요청 리스트를 한 번에 확인</li>
                    <li>벤더별 가격·납기 비교 및 견적 요청</li>
                    <li>기간별/프로젝트별 구매 리포트 생성</li>
                    <li>예산 책정 및 사용률 관리</li>
                  </ul>
                </CardDescription>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}
