"use client";

// 대학 로고는 실제 이미지로 교체 가능
const universities = [
  { name: "서울대학교", abbreviation: "SNU", color: "bg-blue-600" },
  { name: "KAIST", abbreviation: "KAIST", color: "bg-indigo-600" },
  { name: "연세대학교", abbreviation: "YONSEI", color: "bg-blue-500" },
  { name: "고려대학교", abbreviation: "KU", color: "bg-red-600" },
  { name: "POSTECH", abbreviation: "POSTECH", color: "bg-purple-600" },
  { name: "성균관대학교", abbreviation: "SKKU", color: "bg-emerald-600" },
];

const stats = [
  { value: "100+", label: "연구실", color: "text-blue-600" },
  { value: "10,000+", label: "관리 품목", color: "text-indigo-600" },
];

// Marquee 아이템 생성
const createMarqueeItem = (item: typeof universities[0] | typeof stats[0], index: number) => {
  if ("abbreviation" in item) {
    return (
      <div key={`university-${index}`} className="flex items-center gap-6 md:gap-8 px-6 md:px-8 flex-shrink-0">
        <div className="flex flex-col items-center gap-1">
          <div className={`${item.color} text-white font-bold text-sm md:text-base px-3 py-1.5 rounded-lg`}>
            {item.abbreviation}
          </div>
          <div className="text-xs text-slate-600 font-medium whitespace-nowrap">{item.name}</div>
        </div>
        <div className="h-12 w-px bg-slate-300" />
      </div>
    );
  } else {
    return (
      <div key={`stat-${index}`} className="flex items-center gap-6 md:gap-8 px-6 md:px-8 flex-shrink-0">
        <div className="flex flex-col items-center gap-0.5">
          <div className={`text-xl md:text-2xl font-bold ${item.color}`}>{item.value}</div>
          <div className="text-xs text-slate-600 whitespace-nowrap">{item.label}</div>
        </div>
        <div className="h-12 w-px bg-slate-300" />
      </div>
    );
  }
};

// 레이아웃: [대학 로고 그룹] - [핵심 숫자 2개] - [대학 로고 그룹] 형태로 배치
const marqueeItems = [
  ...universities.slice(0, 3), // 첫 번째 대학 로고 그룹 (3개)
  ...stats, // 핵심 숫자 2개
  ...universities.slice(3), // 두 번째 대학 로고 그룹 (나머지 3개)
];

export function BioInsightSocialProofSection() {
  return (
    <section className="py-4 md:py-6 bg-slate-100/50 border-y border-slate-200 overflow-hidden relative">
      {/* 좌측 그라데이션 마스크 */}
      <div className="absolute left-0 top-0 bottom-0 w-16 md:w-24 bg-gradient-to-r from-white via-white/80 to-transparent z-10 pointer-events-none" />
      {/* 우측 그라데이션 마스크 */}
      <div className="absolute right-0 top-0 bottom-0 w-16 md:w-24 bg-gradient-to-l from-white via-white/80 to-transparent z-10 pointer-events-none" />
      
      <div className="relative h-[100px] md:h-[120px] flex items-center">
        {/* Infinite Marquee - 두 개의 동일한 세트를 나란히 배치 */}
        <div className="absolute inset-0 flex items-center">
          <div className="flex animate-marquee whitespace-nowrap">
            {/* 첫 번째 세트 */}
            {marqueeItems.map((item, index) => createMarqueeItem(item, index))}
            {/* 두 번째 세트 (무한 루프를 위해) */}
            {marqueeItems.map((item, index) => createMarqueeItem(item, index + marqueeItems.length))}
          </div>
        </div>
      </div>
    </section>
  );
}
