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
    <section className="py-16 md:py-20 bg-gradient-to-b from-slate-50 to-white border-y border-slate-200">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-slate-900 mb-4">
            이미 100+ 연구실이 엑셀을 버렸습니다
          </h2>
          <p className="text-lg md:text-xl text-slate-600">
            국내 주요 대학 연구실에서 신뢰하고 있습니다
          </p>
        </div>

        {/* 대학 로고 그리드 */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-6">
          {universities.map((university, index) => (
            <Card
              key={index}
              className="border-2 border-slate-200 hover:border-slate-300 transition-all duration-300 hover:shadow-lg"
            >
              <CardContent className="p-6 md:p-8 flex items-center justify-center min-h-[120px]">
                <div className="text-center">
                  <div
                    className={`${university.color} text-white font-bold text-lg md:text-xl px-4 py-2 rounded-lg mb-2 inline-block`}
                  >
                    {university.abbreviation}
                  </div>
                  <div className="text-xs md:text-sm text-slate-600 font-medium">
                    {university.name}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 추가 통계 */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div>
            <div className="text-3xl md:text-4xl font-bold text-blue-600 mb-2">100+</div>
            <div className="text-sm md:text-base text-slate-600">연구실</div>
          </div>
          <div>
            <div className="text-3xl md:text-4xl font-bold text-indigo-600 mb-2">10,000+</div>
            <div className="text-sm md:text-base text-slate-600">관리 품목</div>
          </div>
          <div>
            <div className="text-3xl md:text-4xl font-bold text-purple-600 mb-2">99%</div>
            <div className="text-sm md:text-base text-slate-600">시간 절약</div>
          </div>
        </div>
      </div>
    </section>
  );
}

