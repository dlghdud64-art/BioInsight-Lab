"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function BioInsightHeroSection() {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // TODO: 폼 제출 로직 구현
    console.log("견적 요청 제출");
  };

  return (
    <section className="relative w-full py-24 lg:py-32 bg-white overflow-hidden border-b border-slate-200">
      {/* 배경 장식 요소 - 은은하게 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-10 w-72 h-72 bg-blue-100/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-indigo-100/10 rounded-full blur-3xl"></div>
      </div>

      <div className="container px-4 md:px-6 mx-auto relative">
        <div className="grid gap-12 lg:grid-cols-2 items-center">
          
          {/* 좌측: 가치 제안 텍스트 */}
          <div className="flex flex-col justify-center space-y-6">
            <div className="space-y-4">
              <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none text-slate-900">
                연구실 재고 관리,<br />
                <span className="text-blue-600">비용 견적</span>부터 확인하세요.
              </h1>
              <p className="max-w-[600px] text-slate-600 md:text-xl">
                더 이상 엑셀로 고통받지 마세요. 우리 연구실 규모에 딱 맞는 플랜을 제안해 드립니다.
                초기 도입 비용 0원, 2주 무료 체험으로 시작해보세요.
              </p>
            </div>
            
            {/* 신뢰도 요소를 텍스트 하단에 배치 */}
            <div className="flex items-center gap-4 text-sm text-slate-500">
              <span>✓ 1,200+ 연구실 사용 중</span>
              <span>✓ 평균 30% 비용 절감</span>
            </div>
          </div>

          {/* 우측: 즉시 견적/상담 요청 폼 (Card 형태) */}
          <div className="flex flex-col p-8 bg-slate-50 border border-slate-200 rounded-2xl shadow-lg">
            <h3 className="text-xl font-bold mb-4 text-slate-900">도입 문의 / 견적 요청</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-2">
                <label htmlFor="lab-name" className="text-sm font-medium text-slate-700">연구실/기관명</label>
                <Input id="lab-name" placeholder="BioInsight 대학교" required />
              </div>
              <div className="grid gap-2">
                <label htmlFor="email" className="text-sm font-medium text-slate-700">이메일</label>
                <Input id="email" type="email" placeholder="researcher@lab.com" required />
              </div>
              <div className="grid gap-2">
                <label htmlFor="phone" className="text-sm font-medium text-slate-700">연락처</label>
                <Input id="phone" type="tel" placeholder="010-1234-5678" required />
              </div>
              <Button type="submit" size="lg" className="w-full bg-blue-600 hover:bg-blue-700 mt-2">
                무료 견적서 받기
              </Button>
              <p className="text-xs text-center text-slate-400 mt-2">
                전문 컨설턴트가 24시간 이내에 연락드립니다.
              </p>
            </form>
          </div>

        </div>
      </div>
    </section>
  );
}

