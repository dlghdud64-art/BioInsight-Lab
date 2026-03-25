import { MainLayout } from "../_components/main-layout";
import { MainHeader } from "../_components/main-header";
import { MainFooter } from "../_components/main-footer";
import {
  Search, GitCompare, FileText, Package, ArrowRight, ChevronRight,
  ShoppingCart, ClipboardCheck, Warehouse,
  AlertTriangle, Clock, PackageX,
  Microscope, Users, ShieldCheck,
  KeyRound, CheckSquare, ScrollText, Wallet,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";

const ComparisonSection = dynamic(
  () => import("../_components/comparison-section").then((mod) => ({ default: mod.ComparisonSection })),
  { loading: () => <div className="h-96 w-full bg-pg" /> }
);
const FinalCTASection = dynamic(
  () => import("../_components/final-cta-section").then((mod) => ({ default: mod.FinalCTASection })),
  { loading: () => <div className="h-64 w-full bg-pg" /> }
);

export default function IntroPage() {
  return (
    <MainLayout>
      <MainHeader />
      <div className="w-full">

        {/* ══ 1. Hero ══════════════════════════════════════════════════════ */}
        <section className="relative pt-20 pb-10 md:pt-28 md:pb-20 bg-pg overflow-hidden">
          {/* Grid background */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.04]" style={{
            backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }} />

          <div className="relative mx-auto max-w-6xl px-4 md:px-6 flex flex-col md:flex-row md:items-center md:gap-12">
            {/* Left copy */}
            <div className="flex-1 min-w-0">
              {/* Eyebrow */}
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-400 bg-pn border border-bd rounded-full px-3 py-1.5 mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                연구실 구매 운영 플랫폼
              </div>

              {/* Headline */}
              <h1 className="text-[28px] md:text-5xl font-extrabold tracking-tight text-slate-100 mb-4 leading-snug break-keep">
                시약·장비 검색부터<br />
                <span className="text-blue-400">구매 운영</span>까지 한곳에서
              </h1>
              <p className="hidden md:block text-lg text-slate-300 mb-8 leading-relaxed max-w-xl break-keep">
                시약 검색, 비교, 요청, 발주, 입고, 재고 관리를 분절된 도구가 아닌
                하나의 운영 흐름으로 정리합니다. 건당 30분 이상 소요되던 구매 사이클을 구조적으로 단축합니다.
              </p>
              <p className="md:hidden text-sm text-slate-300 mb-5 leading-relaxed break-keep">
                검색·비교·견적·발주·입고·재고를 하나의 운영 흐름으로 연결하고 구매 사이클을 단축합니다.
              </p>

              {/* Flow chips */}
              <div className="hidden md:flex flex-wrap items-center gap-1.5">
                {[
                  { label: "통합 검색", icon: Search, color: "text-blue-400" },
                  { label: "제품 비교", icon: GitCompare, color: "text-slate-400" },
                  { label: "견적 요청", icon: FileText, color: "text-slate-400" },
                  { label: "발주·입고", icon: ShoppingCart, color: "text-slate-400" },
                  { label: "재고 운영", icon: Package, color: "text-slate-400" },
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-300 bg-pn border border-bd rounded-lg px-3 py-1.5">
                      <step.icon className={`h-3 w-3 ${step.color} flex-shrink-0`} />
                      {step.label}
                    </div>
                    {i < 4 && <ChevronRight className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />}
                  </div>
                ))}
              </div>
            </div>

            {/* Right: mini UI mockup (desktop) */}
            <div className="hidden md:flex flex-col gap-2 flex-shrink-0 w-[380px]">
              <div className="bg-pn rounded-xl border border-bd shadow-md p-3">
                <div className="flex items-center gap-2 bg-pg border border-bd rounded-lg px-3 py-2 mb-3">
                  <Search className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-sm text-slate-400">PBS buffer 10x, 500ml</span>
                </div>
                {[
                  { brand: "Sigma-Aldrich", name: "PBS 10X, pH 7.4 (500mL)", price: "₩38,000", lead: "3일", badge: "최저가" },
                  { brand: "Thermo Fisher", name: "Dulbecco’s PBS 10X (500mL)", price: "₩41,500", lead: "5일", badge: "" },
                  { brand: "Bio-Rad", name: "10X PBS Concentrate (500mL)", price: "₩45,200", lead: "7일", badge: "" },
                ].map((item, i) => (
                  <div key={i} className={`flex items-center gap-2.5 px-2 py-2 rounded-lg ${i === 0 ? "bg-el" : "hover:bg-el"} ${i < 2 ? "mb-1" : ""}`}>
                    <div className="w-7 h-7 rounded-md bg-st flex-shrink-0 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-slate-400">{item.brand.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-100 truncate">{item.name}</p>
                      <p className="text-[10px] text-slate-400">{item.brand} · 납기 {item.lead}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold text-slate-100">{item.price}</p>
                      {item.badge && (
                        <span className="text-[9px] font-semibold text-blue-400 bg-pn border border-bd px-1.5 py-0.5 rounded-full">{item.badge}</span>
                      )}
                    </div>
                  </div>
                ))}
                <div className="mt-2 flex gap-2">
                  <div className="flex-1 h-8 rounded-lg bg-blue-600 flex items-center justify-center gap-1">
                    <GitCompare className="h-3 w-3 text-slate-100" />
                    <span className="text-[11px] font-semibold text-slate-100">비교 목록에 추가</span>
                  </div>
                  <div className="h-8 px-3 rounded-lg border border-bd flex items-center">
                    <span className="text-[11px] text-slate-300">견적 요청</span>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 text-center">실제 제품 검색·비교·견적 화면</p>
            </div>
          </div>
        </section>

        {/* ══ 2. 운영 문제 — 현재 연구실 구매 운영의 병목 ═════════════════ */}
        <section className="py-10 md:py-16 border-b border-bd" style={{ backgroundColor: "#2a2c30" }}>
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="mb-6 md:mb-10">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 md:mb-2">운영 병목</p>
              <h2 className="text-xl md:text-3xl font-bold text-slate-100 break-keep">
                현재 연구실 구매 운영의 병목
              </h2>
              <p className="text-sm md:text-base text-slate-400 mt-2 max-w-2xl break-keep">
                반복되는 비효율이 연구 시간을 깎아먹고 있습니다.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6">
              {[
                {
                  icon: Clock,
                  iconColor: "text-slate-400",
                  title: "반복 검색",
                  desc: "벤더 사이트 10개 이상을 일일이 방문해 같은 시약을 검색합니다. 건당 30분 이상 소요.",
                  stat: "건당 30분+",
                },
                {
                  icon: AlertTriangle,
                  iconColor: "text-slate-400",
                  title: "수기 견적",
                  desc: "이메일·전화로 견적을 수집하고, 엑셀에 수기로 정리합니다. 버전 관리와 비교가 불가능.",
                  stat: "건당 45분+",
                },
                {
                  icon: PackageX,
                  iconColor: "text-slate-400",
                  title: "재고 공백",
                  desc: "구매 완료 후 재고 반영이 누락됩니다. 유효기간 만료·안전재고 부족을 뒤늦게 발견.",
                  stat: "연간 15%+ 손실",
                },
              ].map((item, i) => (
                <div key={i} className="bg-pg border border-bd rounded-xl p-4 md:p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-el flex items-center justify-center flex-shrink-0">
                      <item.icon className={`h-4.5 w-4.5 ${item.iconColor}`} strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-100">{item.title}</h3>
                      <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">{item.stat}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed break-keep">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ 3. LabAxis 운영 흐름 — 6단계 파이프라인 ═══════════════════ */}
        <section className="py-10 md:py-16 bg-pg border-b border-bd">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="mb-6 md:mb-10">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 md:mb-2">운영 흐름</p>
              <h2 className="text-xl md:text-3xl font-bold text-slate-100 break-keep">
                검색 → 비교 → 견적 → 발주 → 입고 → 재고
              </h2>
              <p className="text-sm md:text-base text-slate-400 mt-2 max-w-2xl break-keep">
                LabAxis는 연구실 구매의 전 과정을 하나의 파이프라인으로 연결합니다.
              </p>
            </div>

            {/* Mobile: vertical list */}
            <div className="md:hidden space-y-2">
              {[
                { num: 1, icon: Search, title: "통합 검색", change: "벤더 10곳 → 한 번에 검색", color: "text-blue-400", dot: "bg-blue-600" },
                { num: 2, icon: GitCompare, title: "제품 비교", change: "엑셀 정리 → 비교표 즉시 생성", color: "text-slate-300", dot: "bg-slate-600" },
                { num: 3, icon: FileText, title: "견적 요청", change: "이메일 수집 → 클릭 한 번으로 전송", color: "text-slate-300", dot: "bg-slate-600" },
                { num: 4, icon: ShoppingCart, title: "발주", change: "수기 발주 → 승인 후 발주 연동", color: "text-slate-300", dot: "bg-slate-600" },
                { num: 5, icon: ClipboardCheck, title: "입고 검수", change: "수기 확인 → 입고 스캔으로 즉시 반영", color: "text-slate-300", dot: "bg-slate-600" },
                { num: 6, icon: Warehouse, title: "재고 운영", change: "엑셀 관리 → Lot·유효기간 연동 추적", color: "text-slate-300", dot: "bg-slate-600" },
              ].map((step) => (
                <div key={step.num} className="flex items-start gap-2.5 px-3 py-2.5 bg-pn rounded-lg border border-bd">
                  <div className={`shrink-0 w-5 h-5 rounded-full ${step.dot} text-slate-100 text-[10px] font-bold flex items-center justify-center mt-0.5`}>{step.num}</div>
                  <div className="min-w-0">
                    <span className="font-semibold text-xs text-slate-100">{step.title}</span>
                    <p className="text-[10px] text-slate-400 leading-tight">{step.change}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: 6-column pipeline */}
            <div className="hidden md:grid md:grid-cols-6 gap-3">
              {[
                { num: 1, icon: Search, title: "통합 검색", change: "벤더 10곳 → 한 번에", color: "text-blue-400", dot: "bg-blue-600" },
                { num: 2, icon: GitCompare, title: "제품 비교", change: "엑셀 → 비교표 즉시 생성", color: "text-slate-300", dot: "bg-slate-600" },
                { num: 3, icon: FileText, title: "견적 요청", change: "이메일 → 클릭 한 번", color: "text-slate-300", dot: "bg-slate-600" },
                { num: 4, icon: ShoppingCart, title: "발주", change: "수기 → 승인 후 발주", color: "text-slate-300", dot: "bg-slate-600" },
                { num: 5, icon: ClipboardCheck, title: "입고 검수", change: "수기 → 스캔 반영", color: "text-slate-300", dot: "bg-slate-600" },
                { num: 6, icon: Warehouse, title: "재고 운영", change: "엑셀 → 연동 추적", color: "text-slate-300", dot: "bg-slate-600" },
              ].map((step, i) => (
                <div key={step.num} className="relative">
                  <div className="bg-pn border border-bd rounded-xl p-4 h-full flex flex-col items-center text-center">
                    <div className={`w-10 h-10 rounded-full ${step.dot} text-slate-100 text-sm font-bold flex items-center justify-center mb-3`}>
                      {step.num}
                    </div>
                    <step.icon className={`h-5 w-5 ${step.color} mb-2`} strokeWidth={1.5} />
                    <h3 className="text-sm font-bold text-slate-100 mb-1">{step.title}</h3>
                    <p className="text-[11px] text-slate-400 leading-snug">{step.change}</p>
                  </div>
                  {i < 5 && (
                    <div className="absolute -right-2 top-1/2 -translate-y-1/2 z-10">
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ 4. 비교표 ═══════════════════════════════════════════════════ */}
        <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
          <ComparisonSection />
        </div>

        {/* ══ Mid CTA ═══════════════════════════════════════════════════ */}
        <section className="py-8 md:py-12 bg-pg">
          <div className="mx-auto max-w-6xl px-4 md:px-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/search">
              <button className="h-10 px-6 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors flex items-center gap-2">
                시약·장비 검색 시작하기 <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </Link>
            <Link href="/support">
              <button className="h-10 px-6 text-sm font-medium text-slate-300 border border-bd hover:bg-el rounded-lg transition-colors">
                도입 상담 문의
              </button>
            </Link>
          </div>
        </section>

        {/* ══ 5. 역할별 변화 ══════════════════════════════════════════════ */}
        <section className="py-10 md:py-16 border-b border-bd" style={{ backgroundColor: "#2e3034" }}>
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="mb-6 md:mb-10">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 md:mb-2">역할별 변화</p>
              <h2 className="text-xl md:text-3xl font-bold text-slate-100 break-keep">
                LabAxis 도입 후, 각 역할은 이렇게 달라집니다
              </h2>
              <p className="text-sm md:text-base text-slate-400 mt-2 max-w-2xl break-keep">
                연구원부터 관리자까지, 각 역할에 맞는 운영 변화를 확인하세요.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6">
              {/* 연구원 */}
              <div className="bg-pg border border-bd rounded-xl p-4 md:p-6 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-el flex items-center justify-center flex-shrink-0">
                    <Microscope className="h-5 w-5 text-slate-400" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">연구원</p>
                    <h3 className="text-sm font-bold text-slate-100">실험 준비 시간 단축</h3>
                  </div>
                </div>
                <p className="text-[11px] font-semibold text-blue-400">시약 탐색 시간 70% 단축, 실험 준비에 집중</p>
                <div className="rounded-lg bg-pn border border-bd p-3">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">기존</p>
                  <ul className="space-y-1">
                    {["벤더 사이트 10+개 반복 방문", "스펙 비교를 엑셀에 수기 정리"].map((t, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-slate-400">
                        <span className="text-slate-400 mt-0.5">·</span>{t}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg bg-pn border border-bd p-3">
                  <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider mb-1.5">LabAxis</p>
                  <ul className="space-y-1">
                    {["통합 검색으로 후보 한 번에 확인", "프로토콜 붙여넣기 → 필요 시약 정리"].map((t, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-blue-300 font-medium">
                        <CheckCircle2 className="h-3 w-3 text-blue-400 mt-0.5 flex-shrink-0" />{t}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* 구매 담당자 */}
              <div className="bg-pg border border-bd rounded-xl p-4 md:p-6 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-el flex items-center justify-center flex-shrink-0">
                    <ShoppingCart className="h-5 w-5 text-slate-400" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">구매 담당자</p>
                    <h3 className="text-sm font-bold text-slate-100">견적 수집·비교 자동화</h3>
                  </div>
                </div>
                <p className="text-[11px] font-semibold text-blue-400">견적 수집 시간 80% 절감, 비교 판단 즉시 가능</p>
                <div className="rounded-lg bg-pn border border-bd p-3">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">기존</p>
                  <ul className="space-y-1">
                    {["벤더별 견적 수집·정리에 건당 45분+", "견적 버전 관리가 이메일·파일에 분산"].map((t, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-slate-400">
                        <span className="text-slate-400 mt-0.5">·</span>{t}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg bg-pn border border-bd p-3">
                  <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider mb-1.5">LabAxis</p>
                  <ul className="space-y-1">
                    {["통합 견적 요청 — 가격 비교표 즉시 생성", "구매 이력·공급사 응답 통합 관리"].map((t, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-blue-300 font-medium">
                        <CheckCircle2 className="h-3 w-3 text-blue-400 mt-0.5 flex-shrink-0" />{t}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* 관리자 */}
              <div className="bg-pg border border-bd rounded-xl p-4 md:p-6 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-el flex items-center justify-center flex-shrink-0">
                    <Users className="h-5 w-5 text-slate-400" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">관리자</p>
                    <h3 className="text-sm font-bold text-slate-100">예산·권한·이력 통제</h3>
                  </div>
                </div>
                <p className="text-[11px] font-semibold text-blue-400">구매 이력 전건 추적, 예산 초과 사전 차단</p>
                <div className="rounded-lg bg-pn border border-bd p-3">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">기존</p>
                  <ul className="space-y-1">
                    {["구매 현황을 엑셀로 집계, 실시간 파악 불가", "승인 프로세스가 구두·문서 기반"].map((t, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-slate-400">
                        <span className="text-slate-400 mt-0.5">·</span>{t}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg bg-pn border border-bd p-3">
                  <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider mb-1.5">LabAxis</p>
                  <ul className="space-y-1">
                    {["실시간 예산 소진 현황 + 승인 라인 설정", "Audit Trail로 구매 이력 전건 추적"].map((t, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-blue-300 font-medium">
                        <CheckCircle2 className="h-3 w-3 text-blue-400 mt-0.5 flex-shrink-0" />{t}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ 6. 통제·추적·승인 — 조직 운영 기능 ═════════════════════════ */}
        <section className="py-10 md:py-16 bg-pg border-b border-bd">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="mb-6 md:mb-10">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 md:mb-2">조직 운영</p>
              <h2 className="text-xl md:text-3xl font-bold text-slate-100 break-keep">
                통제·추적·승인 — 조직 운영을 위한 기반
              </h2>
              <p className="text-sm md:text-base text-slate-400 mt-2 max-w-2xl break-keep">
                역할 기반 권한, 승인 라인, 감사 이력, 예산 통합으로 조직의 구매 프로세스를 체계화합니다.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6 mb-6 md:mb-8">
              {[
                {
                  icon: KeyRound,
                  iconColor: "text-slate-400",
                  title: "역할 기반 권한 제어",
                  desc: "조직원별 권한을 세밀하게 설정합니다. 견적 요청·승인·관리자 역할을 분리하여 내부 구매 프로세스에 맞게 운영할 수 있습니다.",
                },
                {
                  icon: CheckSquare,
                  iconColor: "text-slate-400",
                  title: "승인 라인",
                  desc: "견적 요청·발주 전 승인 단계를 설정합니다. 금액 기준 라우팅, 승인자 지정 및 에스컬레이션을 지원합니다.",
                },
                {
                  icon: ScrollText,
                  iconColor: "text-slate-400",
                  title: "Audit Trail",
                  desc: "모든 구매 활동이 기록됩니다. 누가, 언제, 무엇을 요청·승인·발주했는지 전건 추적합니다. GMP/GLP 감사 대비에 활용할 수 있습니다.",
                },
                {
                  icon: Wallet,
                  iconColor: "text-slate-400",
                  title: "예산 통합",
                  desc: "부서·프로젝트별 예산을 설정하고 실시간 소진 현황을 파악합니다. 예산 초과 시 알림과 발주 차단을 지원합니다.",
                },
              ].map((item, i) => (
                <div key={i} className="bg-pn border border-bd rounded-xl p-4 md:p-6 flex gap-4">
                  <div className="w-10 h-10 rounded-lg bg-el flex items-center justify-center flex-shrink-0">
                    <item.icon className={`h-5 w-5 ${item.iconColor}`} strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-slate-100 mb-1">{item.title}</h3>
                    <p className="text-xs text-slate-300 leading-relaxed break-keep">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* 도입 적합성 체크 */}
            <div className="bg-pn rounded-xl border border-bd p-4 md:p-6">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 md:mb-4">이런 조직이면 지금 필요합니다</p>
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
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span className="text-xs md:text-sm text-slate-300 break-keep">{item}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 pt-4 border-t border-bd flex flex-wrap items-center justify-center gap-3">
                <Link href="/pricing">
                  <button className="h-9 px-5 text-sm font-semibold text-blue-400 border border-bd bg-pn hover:bg-el rounded-lg transition-colors">
                    요금 & 플랜 보기
                  </button>
                </Link>
                <Link href="/support">
                  <button className="h-9 px-5 text-sm font-medium text-slate-300 border border-bd hover:bg-el rounded-lg transition-colors">
                    도입 상담 문의
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ══ 7. Final CTA ════════════════════════════════════════════════ */}
        <FinalCTASection />
      </div>
      <MainFooter />
    </MainLayout>
  );
}
