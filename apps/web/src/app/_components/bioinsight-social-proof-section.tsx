"use client";

import { Card, CardContent } from "@/components/ui/card";

// 대학 로고는 실제 이미지로 교체 가능
const universities = [
  { name: "서울대학교", abbreviation: "SNU", color: "bg-blue-600" },
  { name: "KAIST", abbreviation: "KAIST", color: "bg-indigo-600" },
  { name: "연세대학교", abbreviation: "YONSEI", color: "bg-blue-500" },
  { name: "고려대학교", abbreviation: "KU", color: "bg-red-600" },
  { name: "POSTECH", abbreviation: "POSTECH", color: "bg-purple-600" },
  { name: "성균관대학교", abbreviation: "SKKU", color: "bg-emerald-600" },
];

export function BioInsightSocialProofSection() {
  return (
    <section className="py-8 md:py-12 bg-gradient-to-b from-slate-50 to-white border-y border-slate-200">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="text-center mb-6 md:mb-8">
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-slate-900 mb-2">
            이미 100+ 연구실이 엑셀을 버렸습니다
          </h2>
          <p className="text-sm md:text-base text-slate-600">
            국내 주요 대학 연구실에서 신뢰하고 있습니다
          </p>
        </div>

        {/* Marquee 로고 티커 */}
        <div className="relative overflow-hidden py-4">
          {/* Gradient overlays for smooth edges */}
          <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-slate-50 to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

          <div className="flex gap-6 animate-marquee">
            {/* 첫 번째 세트 */}
            {universities.map((university, index) => (
              <div
                key={`set1-${index}`}
                className="flex-shrink-0 w-[140px]"
              >
                <Card className="border border-slate-200 bg-white/80 backdrop-blur-sm">
                  <CardContent className="p-4 flex items-center justify-center min-h-[80px]">
                    <div className="text-center">
                      <div
                        className={`${university.color} text-white font-bold text-sm px-3 py-1.5 rounded-lg mb-1.5 inline-block`}
                      >
                        {university.abbreviation}
                      </div>
                      <div className="text-[10px] text-slate-600 font-medium">
                        {university.name}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
            {/* 두 번째 세트 (seamless loop를 위해 복제) */}
            {universities.map((university, index) => (
              <div
                key={`set2-${index}`}
                className="flex-shrink-0 w-[140px]"
              >
                <Card className="border border-slate-200 bg-white/80 backdrop-blur-sm">
                  <CardContent className="p-4 flex items-center justify-center min-h-[80px]">
                    <div className="text-center">
                      <div
                        className={`${university.color} text-white font-bold text-sm px-3 py-1.5 rounded-lg mb-1.5 inline-block`}
                      >
                        {university.abbreviation}
                      </div>
                      <div className="text-[10px] text-slate-600 font-medium">
                        {university.name}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>

        {/* 추가 통계 */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl md:text-3xl font-bold text-blue-600 mb-1">100+</div>
            <div className="text-xs md:text-sm text-slate-600">연구실</div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-bold text-indigo-600 mb-1">10,000+</div>
            <div className="text-xs md:text-sm text-slate-600">관리 품목</div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-bold text-purple-600 mb-1">99%</div>
            <div className="text-xs md:text-sm text-slate-600">시간 절약</div>
          </div>
        </div>
      </div>
    </section>
  );
}
