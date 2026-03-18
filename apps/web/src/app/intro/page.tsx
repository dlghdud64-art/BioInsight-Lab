import { MainLayout } from "../_components/main-layout";
import { MainHeader } from "../_components/main-header";
import { MainFooter } from "../_components/main-footer";
import {
  Search, GitCompare, FileText, Package, ArrowRight, ChevronRight,
  Zap, ShieldCheck, Layers, Shield, Lock, Server,
  CheckCircle2, AlertTriangle, TrendingDown, Users, BarChart2,
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";

const ComparisonSection = dynamic(
  () => import("../_components/comparison-section").then((mod) => ({ default: mod.ComparisonSection })),
  { loading: () => <div className="h-96 w-full bg-[#111114]" /> }
);
const FinalCTASection = dynamic(
  () => import("../_components/final-cta-section").then((mod) => ({ default: mod.FinalCTASection })),
  { loading: () => <div className="h-64 w-full bg-[#111114]" /> }
);

export default function IntroPage() {
  return (
    <MainLayout>
      <MainHeader />
      <div className="w-full">

        {/* ══ 1. Hero ══════════════════════════════════════════════════════ */}
        <section className="relative pt-20 pb-4 md:pt-28 md:pb-16 bg-gradient-to-b from-slate-50 via-white to-white overflow-hidden">
          {/* Grid background */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.035]" style={{
            backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.08) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }} />

          <div className="relative mx-auto max-w-6xl px-4 md:px-6 flex flex-col md:flex-row md:items-center md:gap-12">
            {/* Left copy */}
            <div className="flex-1 min-w-0">
              {/* Eyebrow */}
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-3 py-1.5 mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                바이오 시약·장비 운영 플랫폼
              </div>

              {/* Headline */}
              <h1 className="text-[28px] md:text-5xl font-extrabold tracking-tight text-slate-100 mb-4 leading-snug break-keep">
                <span className="md:hidden">시약·장비 검색부터<br /><span className="text-blue-600">구매 운영</span>까지 한곳에서</span>
                <span className="hidden md:inline">시약·장비 검색부터<br /><span className="text-blue-600">구매 운영</span>까지 한곳에서</span>
              </h1>
              <p className="hidden md:block text-lg text-slate-600 mb-8 leading-relaxed max-w-xl break-keep">
                연구실의 반복 구매와 재고 운영 흐름을 한곳에서 관리하세요.
              </p>
              <p className="md:hidden text-sm text-slate-600 mb-5 leading-relaxed break-keep">
                연구실의 반복 구매와 재고 운영 흐름을 한곳에서 관리하세요.
              </p>

              {/* Flow chips — 데스크탑만 표시 */}
              <div className="hidden md:flex flex-wrap items-center gap-1.5">
                {[
                  { label: "시약·장비 검색", icon: Search, color: "text-blue-600" },
                  { label: "제품 비교", icon: GitCompare, color: "text-violet-600" },
                  { label: "견적 요청", icon: FileText, color: "text-teal-600" },
                  { label: "재고 운영", icon: Package, color: "text-slate-600" },
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-[#1a1a1e] border border-[#2a2a2e] rounded-lg px-3 py-1.5">
                      <step.icon className={`h-3 w-3 ${step.color} flex-shrink-0`} />
                      {step.label}
                    </div>
                    {i < 3 && <ChevronRight className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />}
                  </div>
                ))}
              </div>
              {/* 모바일: flow chips 대체 — 별도 표시 없음 (Hero 문구에서 커버) */}
            </div>

            {/* Right: mini UI mockup (desktop) */}
            <div className="hidden md:flex flex-col gap-2 flex-shrink-0 w-[380px]">
              {/* Search bar mockup */}
              <div className="bg-[#1a1a1e] rounded-xl border border-[#2a2a2e] shadow-md p-3">
                <div className="flex items-center gap-2 bg-[#111114] border border-[#2a2a2e] rounded-lg px-3 py-2 mb-3">
                  <Search className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-sm text-slate-500">PBS buffer 10x, 500ml</span>
                </div>
                {/* Result rows */}
                {[
                  { brand: "Sigma-Aldrich", name: "PBS 10X, pH 7.4 (500mL)", price: "₩38,000", lead: "3일", badge: "최저가" },
                  { brand: "Thermo Fisher", name: "Dulbecco's PBS 10X (500mL)", price: "₩41,500", lead: "5일", badge: "" },
                  { brand: "Bio-Rad", name: "10X PBS Concentrate (500mL)", price: "₩45,200", lead: "7일", badge: "" },
                ].map((item, i) => (
                  <div key={i} className={`flex items-center gap-2.5 px-2 py-2 rounded-lg ${i === 0 ? "bg-blue-50/60" : "hover:bg-[#111114]"} ${i < 2 ? "mb-1" : ""}`}>
                    <div className="w-7 h-7 rounded-md bg-[#222226] flex-shrink-0 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-slate-400">{item.brand.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-800 truncate">{item.name}</p>
                      <p className="text-[10px] text-slate-400">{item.brand} · 납기 {item.lead}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold text-slate-100">{item.price}</p>
                      {item.badge && (
                        <span className="text-[9px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">{item.badge}</span>
                      )}
                    </div>
                  </div>
                ))}
                <div className="mt-2 flex gap-2">
                  <div className="flex-1 h-8 rounded-lg bg-blue-600 flex items-center justify-center gap-1">
                    <GitCompare className="h-3 w-3 text-white" />
                    <span className="text-[11px] font-semibold text-white">비교 목록에 추가</span>
                  </div>
                  <div className="h-8 px-3 rounded-lg border border-[#2a2a2e] flex items-center">
                    <span className="text-[11px] text-slate-600">견적 요청</span>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 text-center">실제 제품 검색·비교·견적 화면</p>
            </div>
          </div>
        </section>

        {/* ══ 제품 한눈 요약 (모바일 전용) ═════════════════════════════════ */}
        <div className="md:hidden py-3 bg-[#1a1a1e] border-b border-slate-100 px-4">
          <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider mb-2">한눈에 보기</p>
          <ul className="space-y-1.5">
            <li className="flex items-center gap-2 text-xs text-slate-700">
              <Search className="h-3 w-3 text-blue-500 shrink-0" />
              시약·장비 통합 검색 + 대체품 확인
            </li>
            <li className="flex items-center gap-2 text-xs text-slate-700">
              <GitCompare className="h-3 w-3 text-violet-500 shrink-0" />
              가격·납기·스펙 비교
            </li>
            <li className="flex items-center gap-2 text-xs text-slate-700">
              <FileText className="h-3 w-3 text-teal-500 shrink-0" />
              견적 → 구매 → 재고 한 번에
            </li>
          </ul>
        </div>

        {/* ══ 2. 핵심 제품 흐름 (4단계) ═══════════════════════════════════ */}
        <section className="py-10 md:py-16 bg-[#1a1a1e] border-b border-slate-100">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="mb-5 md:mb-12">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1 md:mb-2">제품 흐름</p>
              <h2 className="text-lg md:text-3xl font-bold text-slate-100 break-keep">
                검색부터 운영까지 한 번에
              </h2>
              <p className="hidden md:block text-base text-slate-500 mt-2 max-w-2xl break-keep">
                LabAxis는 시약·장비 구매의 전 과정을 하나의 플랫폼에서 처리합니다.
              </p>
            </div>

            {/* 모바일: 프로세스 리스트 */}
            <div className="md:hidden space-y-1.5">
              {[
                { num: 1, title: "시약·장비 검색", desc: "여러 벤더를 통합 검색, 카테고리·브랜드 필터", dot: "bg-blue-600", bg: "bg-blue-50" },
                { num: 2, title: "제품 비교", desc: "가격·납기·순도를 나란히 비교, AI 분석", dot: "bg-violet-600", bg: "bg-violet-50" },
                { num: 3, title: "견적 요청", desc: "비교표에서 바로 견적 생성·전달", dot: "bg-teal-600", bg: "bg-teal-50" },
                { num: 4, title: "재고·이력 운영", desc: "구매 시 자동 재고 반영, Lot·유효기간 추적", dot: "bg-slate-700", bg: "bg-[#111114]" },
              ].map((step) => (
                <div key={step.num} className={`flex items-start gap-2.5 px-3 py-2.5 ${step.bg} rounded-lg border border-slate-100`}>
                  <div className={`shrink-0 w-5 h-5 rounded-full ${step.dot} text-white text-[10px] font-bold flex items-center justify-center mt-0.5`}>{step.num}</div>
                  <div className="min-w-0">
                    <span className="font-semibold text-xs text-slate-100">{step.title}</span>
                    <p className="text-[10px] text-slate-500 leading-tight">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* 데스크탑: 카드 그리드 */}
            <div className="hidden md:grid md:grid-cols-4 gap-4 md:gap-6">
              {/* Step 1: 검색 */}
              <div className="relative">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 md:p-5 h-full">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</div>
                    <span className="text-sm font-bold text-blue-900">시약·장비 검색</span>
                  </div>
                  {/* Mini UI */}
                  <div className="bg-[#1a1a1e] rounded-lg border border-blue-100 p-2.5 mb-3 space-y-1.5">
                    <div className="flex items-center gap-1.5 bg-[#111114] rounded px-2 py-1">
                      <Search className="h-3 w-3 text-slate-300" />
                      <div className="h-2 bg-slate-200 rounded flex-1" />
                    </div>
                    {[{ w: "w-3/4" }, { w: "w-5/6" }, { w: "w-2/3" }].map((bar, i) => (
                      <div key={i} className={`flex items-center gap-2 px-1 py-1 ${i === 0 ? "bg-blue-50 rounded" : ""}`}>
                        <div className="w-4 h-4 rounded bg-[#222226] flex-shrink-0" />
                        <div className={`h-2 bg-slate-200 rounded ${bar.w}`} />
                        <div className="h-2 bg-slate-300 rounded w-8 ml-auto flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-blue-800 leading-relaxed break-keep">
                    통합 검색으로 여러 벤더 제품을 한 번에 검색합니다. 카테고리·브랜드·가격 필터로 후보를 빠르게 좁힙니다.
                  </p>
                </div>
                <div className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                  <ChevronRight className="h-5 w-5 text-slate-300" />
                </div>
              </div>

              {/* Step 2: 비교 */}
              <div className="relative">
                <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 md:p-5 h-full">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</div>
                    <span className="text-sm font-bold text-violet-900">제품 비교</span>
                  </div>
                  {/* Mini comparison table */}
                  <div className="bg-[#1a1a1e] rounded-lg border border-violet-100 p-2 mb-3">
                    <div className="grid grid-cols-3 gap-1 text-[9px] text-center mb-1">
                      <div className="text-slate-400 font-semibold">항목</div>
                      <div className="text-violet-600 font-semibold">A사</div>
                      <div className="text-slate-400 font-semibold">B사</div>
                    </div>
                    {[
                      { label: "가격", a: "₩38K", b: "₩45K", win: true },
                      { label: "순도", a: "≥99%", b: "≥97%", win: true },
                      { label: "납기", a: "3일", b: "7일", win: true },
                    ].map((row, i) => (
                      <div key={i} className="grid grid-cols-3 gap-1 text-[9px] text-center py-0.5 border-t border-slate-50">
                        <div className="text-slate-500">{row.label}</div>
                        <div className={`font-semibold ${row.win ? "text-violet-600" : "text-slate-500"}`}>{row.a}</div>
                        <div className="text-slate-400">{row.b}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-violet-800 leading-relaxed break-keep">
                    가격·납기·순도·스펙을 나란히 비교합니다. AI가 연구 목적에 맞는 최적 선택을 분석합니다.
                  </p>
                </div>
                <div className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                  <ChevronRight className="h-5 w-5 text-slate-300" />
                </div>
              </div>

              {/* Step 3: 견적 요청 */}
              <div className="relative">
                <div className="bg-teal-50 border border-teal-100 rounded-xl p-4 md:p-5 h-full">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">3</div>
                    <span className="text-sm font-bold text-teal-900">견적 요청</span>
                  </div>
                  {/* Mini quote UI */}
                  <div className="bg-[#1a1a1e] rounded-lg border border-teal-100 p-2.5 mb-3 space-y-2">
                    {[
                      { name: "PBS 10X 500mL", qty: "×5" },
                      { name: "DMSO 99.9%", qty: "×2" },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-[10px]">
                        <div className="w-3 h-3 rounded-sm bg-teal-100 flex-shrink-0" />
                        <span className="text-slate-700 flex-1 truncate">{item.name}</span>
                        <span className="text-slate-400 flex-shrink-0">{item.qty}</span>
                      </div>
                    ))}
                    <div className="h-6 bg-teal-600 rounded-md flex items-center justify-center">
                      <span className="text-[9px] text-white font-semibold">견적 요청 전송</span>
                    </div>
                  </div>
                  <p className="text-xs text-teal-800 leading-relaxed break-keep">
                    비교 목록에서 클릭 한 번으로 견적 요청서를 생성합니다. 공급사 응답은 플랫폼 내에서 통합 관리합니다.
                  </p>
                </div>
                <div className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                  <ChevronRight className="h-5 w-5 text-slate-300" />
                </div>
              </div>

              {/* Step 4: 재고 운영 */}
              <div>
                <div className="bg-[#111114] border border-[#2a2a2e] rounded-xl p-4 md:p-5 h-full">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 rounded-full bg-slate-700 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">4</div>
                    <span className="text-sm font-bold text-slate-100">재고·이력 운영</span>
                  </div>
                  {/* Mini inventory UI */}
                  <div className="bg-[#1a1a1e] rounded-lg border border-[#2a2a2e] p-2.5 mb-3 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 px-1">
                      <span>품목</span><span>수량</span><span>상태</span>
                    </div>
                    {[
                      { name: "PBS 10X", qty: "5ea", status: "정상", color: "text-emerald-500" },
                      { name: "DMSO", qty: "2ea", status: "부족", color: "text-red-500" },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-[10px] px-1 py-1 rounded bg-[#111114]">
                        <span className="text-slate-700 font-medium">{item.name}</span>
                        <span className="text-slate-500">{item.qty}</span>
                        <span className={`font-semibold ${item.color}`}>{item.status}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed break-keep">
                    구매 완료 시 자동으로 재고에 반영됩니다. Lot No.·유효기간·구매 이력을 한 곳에서 관리합니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ 3. 누가 쓰나요? (페르소나 — 강화) ═══════════════════════════ */}
        <section className="py-10 md:py-16 bg-[#111114]">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="mb-8 md:mb-10">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">도입 대상</p>
              <h2 className="text-2xl md:text-3xl font-bold text-slate-100 break-keep">
                어떤 팀이 어떻게 사용하나요?
              </h2>
              <p className="text-sm md:text-base text-slate-500 mt-2 break-keep">
                역할별 업무 문제와 LabAxis가 만드는 변화를 확인하세요.
              </p>
            </div>

            {/* 모바일: 압축형 페르소나 리스트 */}
            <div className="md:hidden space-y-2">
              {[
                { role: "R&D 연구자", icon: Zap, color: "text-amber-500", bg: "bg-amber-50", benefits: ["통합 검색으로 후보 즉시 확인", "프로토콜 → 시약 자동 추출"], tags: ["검색", "비교"] },
                { role: "QC/QA 매니저", icon: ShieldCheck, color: "text-emerald-500", bg: "bg-emerald-50", benefits: ["구매→재고→사용 이력 한 곳 추적", "유효기간 자동 알림"], tags: ["이력", "유통기한"] },
                { role: "구매 담당자", icon: Layers, color: "text-indigo-500", bg: "bg-indigo-50", benefits: ["통합 견적 요청, 5분 완료", "구매 이력·응답 통합 관리"], tags: ["견적", "비교"] },
              ].map((p) => (
                <div key={p.role} className="bg-[#1a1a1e] border border-gray-100 rounded-lg p-3.5 flex items-start gap-3">
                  <div className={`shrink-0 w-8 h-8 rounded-lg ${p.bg} flex items-center justify-center`}>
                    <p.icon className={`h-4 w-4 ${p.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-slate-100 mb-1">{p.role}</h3>
                    <ul className="space-y-0.5">
                      {p.benefits.map((b, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                          <CheckCircle2 className="h-3 w-3 text-blue-500 mt-0.5 shrink-0" />{b}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>

            {/* 데스크탑: 캐러셀 카드 */}
            <div className="hidden md:grid md:grid-cols-3 md:gap-6">

              {/* R&D 연구자 */}
              <div className="bg-[#1a1a1e] border border-gray-100 shadow-sm rounded-xl p-5 md:p-6 flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1">R&D 연구자</p>
                    <h3 className="text-base font-bold text-slate-100">실험 준비 시간 단축</h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <Zap className="h-5 w-5 text-amber-500" />
                  </div>
                </div>
                <div className="rounded-lg bg-[#111114] border border-slate-100 p-3">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">기존 업무 문제</p>
                  <ul className="space-y-1">
                    {["벤더 사이트 10+ 개를 반복 방문해 시약 검색", "스펙 비교를 직접 엑셀에 정리 — 건당 20분 이상"].map((t, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                        <span className="text-slate-300 mt-0.5">·</span>{t}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
                  <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider mb-1.5">LabAxis로 달라지는 것</p>
                  <ul className="space-y-1">
                    {["통합 검색으로 후보 한 번에 확인, 비교표 즉시 생성", "프로토콜 붙여넣기 → 필요 시약 자동 추출"].map((t, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-blue-800 font-medium">
                        <CheckCircle2 className="h-3 w-3 text-blue-500 mt-0.5 flex-shrink-0" />{t}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex gap-2 mt-auto">
                  <span className="text-[10px] font-semibold text-slate-500 bg-[#222226] rounded-md px-2 py-1">시약·장비 검색</span>
                  <span className="text-[10px] font-semibold text-slate-500 bg-[#222226] rounded-md px-2 py-1">제품 비교</span>
                </div>
              </div>

              {/* QC/QA 매니저 */}
              <div className="bg-[#1a1a1e] border border-gray-100 shadow-sm rounded-xl p-5 md:p-6 flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1">QC/QA 매니저</p>
                    <h3 className="text-base font-bold text-slate-100">이력 추적과 감사 대비</h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="h-5 w-5 text-emerald-500" />
                  </div>
                </div>
                <div className="rounded-lg bg-[#111114] border border-slate-100 p-3">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">기존 업무 문제</p>
                  <ul className="space-y-1">
                    {["Lot No.·유효기간을 엑셀·수기로 별도 관리", "GMP 감사 대비 이력 취합에 많은 시간 소요"].map((t, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                        <span className="text-slate-300 mt-0.5">·</span>{t}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
                  <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-1.5">LabAxis로 달라지는 것</p>
                  <ul className="space-y-1">
                    {["구매→재고→사용 이력을 하나의 플랫폼에서 추적", "유효기간 임박 자동 알림, 배치 단위 이력 조회"].map((t, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-emerald-800 font-medium">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500 mt-0.5 flex-shrink-0" />{t}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex gap-2 mt-auto">
                  <span className="text-[10px] font-semibold text-slate-500 bg-[#222226] rounded-md px-2 py-1">재고 이력</span>
                  <span className="text-[10px] font-semibold text-slate-500 bg-[#222226] rounded-md px-2 py-1">유통기한 관리</span>
                </div>
              </div>

              {/* 구매 담당자 */}
              <div className="bg-[#1a1a1e] border border-gray-100 shadow-sm rounded-xl p-5 md:p-6 flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1">구매 담당자</p>
                    <h3 className="text-base font-bold text-slate-100">견적 수집과 비교 자동화</h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <Layers className="h-5 w-5 text-indigo-500" />
                  </div>
                </div>
                <div className="rounded-lg bg-[#111114] border border-slate-100 p-3">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">기존 업무 문제</p>
                  <ul className="space-y-1">
                    {["벤더별 견적 수집·정리·비교에 건당 45분 이상", "견적 버전 관리가 이메일·파일 분산으로 복잡"].map((t, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                        <span className="text-slate-300 mt-0.5">·</span>{t}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3">
                  <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider mb-1.5">LabAxis로 달라지는 것</p>
                  <ul className="space-y-1">
                    {["통합 견적 요청 — 가격 비교표 자동 생성, 5분 완료", "구매 이력·공급사 응답을 한 곳에서 관리"].map((t, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-indigo-800 font-medium">
                        <CheckCircle2 className="h-3 w-3 text-indigo-500 mt-0.5 flex-shrink-0" />{t}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex gap-2 mt-auto">
                  <span className="text-[10px] font-semibold text-slate-500 bg-[#222226] rounded-md px-2 py-1">견적 요청</span>
                  <span className="text-[10px] font-semibold text-slate-500 bg-[#222226] rounded-md px-2 py-1">가격 비교</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ 4. 작업 방식 비교 ══════════════════════════════════════════ */}
        <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
          <ComparisonSection />
        </div>

        {/* ══ 5. 보안 & 도입 근거 ═══════════════════════════════════════ */}
        <section className="py-10 md:py-16 bg-[#111114] border-t border-[#2a2a2e]">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="mb-8">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">보안 & 운영 신뢰성</p>
              <h2 className="text-2xl md:text-3xl font-bold text-slate-100 break-keep">
                조직에서 안심하고 운영할 수 있습니다
              </h2>
              <p className="hidden md:block text-sm md:text-base text-slate-500 mt-2 max-w-2xl break-keep">
                연구 데이터와 구매 정보를 안전하게 보호합니다. 기업·기관 도입을 위한 권한 제어와 배포 옵션을 제공합니다.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6 mb-8">
              {[
                {
                  icon: Shield,
                  iconBg: "bg-emerald-100",
                  iconColor: "text-emerald-600",
                  borderColor: "border-emerald-200",
                  title: "역할 기반 접근 제어",
                  mobileDesc: "팀원별 권한 분리, 승인 워크플로우",
                  desc: "조직원별 권한을 세밀하게 설정합니다. 견적 요청·승인·관리자 역할을 분리하여 내부 구매 프로세스에 맞게 운영할 수 있습니다.",
                  badge: "Team / Business",
                  badgeColor: "text-emerald-700 bg-emerald-50 border-emerald-200",
                },
                {
                  icon: Lock,
                  iconBg: "bg-blue-100",
                  iconColor: "text-blue-600",
                  borderColor: "border-blue-200",
                  title: "데이터 격리 & 공유 제어",
                  mobileDesc: "조직 간 완전 분리, 암호화 공유 링크",
                  desc: "조직 내 데이터는 타 조직과 완전히 분리됩니다. 암호화 기반 공유 링크는 만료 설정·비활성화가 가능하며 검색엔진 노출을 차단합니다.",
                  badge: "전 플랜 기본 제공",
                  badgeColor: "text-blue-700 bg-blue-50 border-blue-200",
                },
                {
                  icon: Server,
                  iconBg: "bg-indigo-100",
                  iconColor: "text-indigo-600",
                  borderColor: "border-indigo-200",
                  title: "프라이빗 배포",
                  mobileDesc: "자체 서버 독립 배포 옵션",
                  desc: "민감한 연구 데이터가 외부 클라우드에 보관되는 것이 부담스럽다면, 자체 서버에 독립 배포하는 옵션을 제공합니다.",
                  badge: "Enterprise",
                  badgeColor: "text-indigo-700 bg-indigo-50 border-indigo-200",
                },
              ].map((item, i) => (
                <div key={i} className={`bg-[#1a1a1e] rounded-xl border-2 ${item.borderColor} hover:shadow-md transition-shadow p-3 md:p-6`}>
                  {/* 모바일: 가로 배치 (아이콘 + 제목/설명 + 배지) */}
                  <div className="md:hidden flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${item.iconBg}`}>
                      <item.icon className={`h-4.5 w-4.5 ${item.iconColor}`} strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[13px] font-bold text-slate-100">{item.title}</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">{item.mobileDesc}</p>
                    </div>
                    <span className={`text-[9px] font-semibold border rounded-md px-1.5 py-0.5 flex-shrink-0 whitespace-nowrap ${item.badgeColor}`}>{item.badge}</span>
                  </div>
                  {/* 데스크탑: 세로 배치 */}
                  <div className="hidden md:block">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-4 ${item.iconBg}`}>
                      <item.icon className={`h-4.5 w-4.5 ${item.iconColor}`} strokeWidth={1.5} />
                    </div>
                    <h3 className="text-sm font-bold text-slate-100 mb-2">{item.title}</h3>
                    <p className="text-xs text-slate-600 leading-relaxed mb-4 break-keep">{item.desc}</p>
                    <span className={`text-[10px] font-semibold border rounded-md px-2 py-1 ${item.badgeColor}`}>{item.badge}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* 도입 근거 요약 */}
            <div className="bg-[#1a1a1e] rounded-xl border border-[#2a2a2e] p-4 md:p-6">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 md:mb-4">도입 적합성 체크</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                {[
                  "연구팀과 구매팀이 분리된 조직 구조",
                  "GMP/GLP 환경에서 Lot 추적 및 이력 관리 필요",
                  "여러 벤더에서 시약·장비를 구매하는 다공급사 환경",
                  "구매 프로세스에 승인 단계가 필요한 조직",
                  "재고 실사·유효기간 관리를 체계화하려는 팀",
                  "수기 엑셀 중심 구매 관리를 디지털화하려는 조직",
                ].map((item, i) => (
                  <div key={i} className={`flex items-start gap-2 ${i >= 4 ? "hidden md:flex" : ""}`}>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span className="text-xs md:text-sm text-slate-700 break-keep">{item}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-center gap-3">
                <Link href="/pricing">
                  <button className="h-9 px-5 text-sm font-semibold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                    요금 & 플랜 보기
                  </button>
                </Link>
                <Link href="/support">
                  <button className="h-9 px-5 text-sm font-medium text-slate-600 border border-[#2a2a2e] hover:bg-[#111114] rounded-lg transition-colors">
                    도입 상담 문의
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ══ 6. Final CTA ══════════════════════════════════════════════ */}
        <FinalCTASection />
      </div>
      <MainFooter />
    </MainLayout>
  );
}
