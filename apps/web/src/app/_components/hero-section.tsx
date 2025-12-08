import Link from "next/link";

import { Button } from "@/components/ui/button";
import { HeroDemoFlowPanel } from "./home/hero-demo-flow-panel";

export function HeroSection() {
  return (
    <section className="border-b border-slate-100 bg-white py-10">
      {/* 히어로만 살짝 더 안으로 */}
      <div className="mx-auto max-w-5xl px-2 md:px-6 lg:px-8 grid grid-cols-1 gap-10 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:items-start">
        {/* 왼쪽: 제목 / 설명 / 버튼들 */}
        <div className="space-y-4 md:pr-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
            <span className="mr-2 h-1.5 w-1.5 rounded-full bg-blue-600" />
            <span>Beta</span>
            <span className="h-3 w-px bg-slate-300" />
            <span>바이오 시약·장비 견적 준비 도구</span>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl font-bold leading-tight text-slate-900 md:text-4xl">
              바이오 시약·장비 견적 준비,{" "}
              <span className="whitespace-nowrap">검색 한 번으로 끝내세요.</span>
            </h1>
            <p className="text-sm leading-relaxed text-slate-600 max-w-xl">
              BioInsight Lab은 연구·QC 현장에서 쓰는 시약/소모품을 한 번에 검색·비교하고,
              <br />
              사내 그룹웨어에 붙여넣을 수 있는 구매요청 리스트를 만들어 주는 베타 SaaS입니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/test/search">
              <Button size="lg" className="bg-blue-600 text-white hover:bg-blue-700">
                검색/비교 시작하기
              </Button>
            </Link>
            <a href="#flow">
              <Button size="lg" variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-50">
                3단계 플로우 둘러보기
              </Button>
            </a>
          </div>
        </div>

        {/* 오른쪽: 데모 플로우 패널 */}
        <div className="w-full max-w-md md:pl-6">
          <HeroDemoFlowPanel />
        </div>
      </div>
    </section>
  );
}




import { Button } from "@/components/ui/button";
import { HeroDemoFlowPanel } from "./home/hero-demo-flow-panel";

export function HeroSection() {
  return (
    <section className="border-b border-slate-100 bg-white py-10">
      {/* 히어로만 살짝 더 안으로 */}
      <div className="mx-auto max-w-5xl px-2 md:px-6 lg:px-8 grid grid-cols-1 gap-10 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:items-start">
        {/* 왼쪽: 제목 / 설명 / 버튼들 */}
        <div className="space-y-4 md:pr-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
            <span className="mr-2 h-1.5 w-1.5 rounded-full bg-blue-600" />
            <span>Beta</span>
            <span className="h-3 w-px bg-slate-300" />
            <span>바이오 시약·장비 견적 준비 도구</span>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl font-bold leading-tight text-slate-900 md:text-4xl">
              바이오 시약·장비 견적 준비,{" "}
              <span className="whitespace-nowrap">검색 한 번으로 끝내세요.</span>
            </h1>
            <p className="text-sm leading-relaxed text-slate-600 max-w-xl">
              BioInsight Lab은 연구·QC 현장에서 쓰는 시약/소모품을 한 번에 검색·비교하고,
              <br />
              사내 그룹웨어에 붙여넣을 수 있는 구매요청 리스트를 만들어 주는 베타 SaaS입니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/test/search">
              <Button size="lg" className="bg-blue-600 text-white hover:bg-blue-700">
                검색/비교 시작하기
              </Button>
            </Link>
            <a href="#flow">
              <Button size="lg" variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-50">
                3단계 플로우 둘러보기
              </Button>
            </a>
          </div>
        </div>

        {/* 오른쪽: 데모 플로우 패널 */}
        <div className="w-full max-w-md md:pl-6">
          <HeroDemoFlowPanel />
        </div>
      </div>
    </section>
  );
}




import { Button } from "@/components/ui/button";
import { HeroDemoFlowPanel } from "./home/hero-demo-flow-panel";

export function HeroSection() {
  return (
    <section className="border-b border-slate-100 bg-white py-10">
      {/* 히어로만 살짝 더 안으로 */}
      <div className="mx-auto max-w-5xl px-2 md:px-6 lg:px-8 grid grid-cols-1 gap-10 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:items-start">
        {/* 왼쪽: 제목 / 설명 / 버튼들 */}
        <div className="space-y-4 md:pr-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
            <span className="mr-2 h-1.5 w-1.5 rounded-full bg-blue-600" />
            <span>Beta</span>
            <span className="h-3 w-px bg-slate-300" />
            <span>바이오 시약·장비 견적 준비 도구</span>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl font-bold leading-tight text-slate-900 md:text-4xl">
              바이오 시약·장비 견적 준비,{" "}
              <span className="whitespace-nowrap">검색 한 번으로 끝내세요.</span>
            </h1>
            <p className="text-sm leading-relaxed text-slate-600 max-w-xl">
              BioInsight Lab은 연구·QC 현장에서 쓰는 시약/소모품을 한 번에 검색·비교하고,
              <br />
              사내 그룹웨어에 붙여넣을 수 있는 구매요청 리스트를 만들어 주는 베타 SaaS입니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/test/search">
              <Button size="lg" className="bg-blue-600 text-white hover:bg-blue-700">
                검색/비교 시작하기
              </Button>
            </Link>
            <a href="#flow">
              <Button size="lg" variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-50">
                3단계 플로우 둘러보기
              </Button>
            </a>
          </div>
        </div>

        {/* 오른쪽: 데모 플로우 패널 */}
        <div className="w-full max-w-md md:pl-6">
          <HeroDemoFlowPanel />
        </div>
      </div>
    </section>
  );
}



