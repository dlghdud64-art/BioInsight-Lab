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
  { loading: () => <div className="h-96 w-full" style={{ backgroundColor: "#131A24" }} /> }
);
const FinalCTASection = dynamic(
  () => import("../_components/final-cta-section").then((mod) => ({ default: mod.FinalCTASection })),
  { loading: () => <div className="h-64 w-full" style={{ backgroundColor: "#131A24" }} /> }
);

/*
 * ── Surface Family ───────────────────────────────────────────────────
 *  Hero Surface     : #020617  — deepest navy, brand flagship only
 *  Content Surface  : #131A24  — all body sections, unified base
 *  Card Surface     : #1C2535  — elevated cards, border #2A3648
 *  Conversion Panel : #E9EDF3  — contained light-neutral CTA panel
 *  Footer Surface   : #0A0E14  — dark-neutral closing band
 * ─────────────────────────────────────────────────────────────────────
 */

export default function IntroPage() {
  return (
    <MainLayout>
      <MainHeader />
      <div className="w-full">

        {/* ══ 1. Hero Surface ═════════════════════════════════════════════ */}
        <section className="relative pt-20 pb-10 md:pt-28 md:pb-20 overflow-hidden" style={{ backgroundColor: "#020617" }}>
          {/* Grid background */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.04]" style={{
            backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }} />

          <div className="relative mx-auto max-w-6xl px-4 md:px-6 flex flex-col md:flex-row md:items-center md:gap-12">
            {/* Left copy */}
            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-400 rounded-full px-3 py-1.5 mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                연구실 구매 운영 플랫폼
              </div>

              <h1 className="text-[28px] md:text-5xl font-extrabold tracking-tight text-white mb-4 leading-snug break-keep">
                시약·장비 검색부터<br />
                <span className="text-blue-400">구매 운영</span>까지 한곳에서
              </h1>
              <p className="hidden md:block text-lg mb-8 leading-relaxed max-w-xl break-keep" style={{ color: "#C8D4E5" }}>
                시약 검색, 비교, 요청, 발주, 입고, 재고 관리를 분절된 도구가 아닌
                하나의 운영 흐름으로 정리합니다. 건당 30분 이상 소요되던 구매 사이클을 구조적으로 단축합니다.
              </p>
              <p className="md:hidden text-sm mb-5 leading-relaxed break-keep" style={{ color: "#C8D4E5" }}>
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
                    <div className="flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-1.5" style={{ color: "#C8D4E5", backgroundColor: "#0F1520", border: "1px solid #2A3648" }}>
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
              <div className="rounded-xl shadow-md p-3" style={{ backgroundColor: "#0F1520", border: "1px solid #2A3648" }}>
                <div className="flex items-center gap-2 rounded-lg px-3 py-2 mb-3" style={{ backgroundColor: "#020617", border: "1px solid #1E2A3A" }}>
                  <Search className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-sm text-slate-400">PBS buffer 10x, 500ml</span>
                </div>
                {[
                  { brand: "Sigma-Aldrich", name: "PBS 10X, pH 7.4 (500mL)", price: "₩38,000", lead: "3일", badge: "최저가" },
                  { brand: "Thermo Fisher", name: "Dulbecco's PBS 10X (500mL)", price: "₩41,500", lead: "5일", badge: "" },
                  { brand: "Bio-Rad", name: "10X PBS Concentrate (500mL)", price: "₩45,200", lead: "7일", badge: "" },
                ].map((item, i) => (
                  <div key={i} className={`flex items-center gap-2.5 px-2 py-2 rounded-lg ${i < 2 ? "mb-1" : ""}`} style={i === 0 ? { backgroundColor: "#1C2535" } : {}}>
                    <div className="w-7 h-7 rounded-md flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: "#283548" }}>
                      <span className="text-[10px] font-bold" style={{ color: "#8A99AF" }}>{item.brand.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{item.name}</p>
                      <p className="text-[10px]" style={{ color: "#8A99AF" }}>{item.brand} · 납기 {item.lead}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold text-white">{item.price}</p>
                      {item.badge && (
                        <span className="text-[9px] font-semibold text-blue-400 px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#0F1520", border: "1px solid #2A3648" }}>{item.badge}</span>
                      )}
                    </div>
                  </div>
                ))}
                <div className="mt-2 flex gap-2">
                  <div className="flex-1 h-8 rounded-lg bg-blue-600 flex items-center justify-center gap-1">
                    <GitCompare className="h-3 w-3 text-slate-100" />
                    <span className="text-[11px] font-semibold text-slate-100">비교 목록에 추가</span>
                  </div>
                  <div className="h-8 px-3 rounded-lg flex items-center" style={{ border: "1px solid #2A3648" }}>
                    <span className="text-[11px]" style={{ color: "#C8D4E5" }}>견적 요청</span>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 text-center">실제 제품 검색·비교·견적 화면</p>
            </div>
          </div>
        </section>

        {/* ══ 2. 운영 문제 — 핵심 병목 3개 ═══════════════════════════════ */}
        <section className="py-10 md:py-16" style={{ backgroundColor: "#131A24", borderTop: "1px solid #1E2A3A" }}>
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="mb-6 md:mb-8">
              <p className="text-[11px] font-bold uppercase tracking-widest text-blue-400 mb-2">Pain Point</p>
              <h2 className="text-xl md:text-[26px] font-bold text-white break-keep">
                연구실 구매, 왜 느릴까
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
              {[
                { icon: Clock, title: "반복 검색", stat: "건당 30분+", desc: "벤더 사이트 10곳을 일일이 방문해 같은 시약을 검색합니다", iconColor: "#F0A832", cardBg: "rgba(240,168,50,0.06)", statTextColor: "#F0A832", statBgColor: "rgba(240,168,50,0.10)", statBorderColor: "rgba(240,168,50,0.20)" },
                { icon: AlertTriangle, title: "수기 견적", stat: "건당 45분+", desc: "이메일·전화로 견적 수집, 엑셀에 수기 정리. 비교 불가", iconColor: "#F87171", cardBg: "rgba(248,113,113,0.06)", statTextColor: "#F87171", statBgColor: "rgba(248,113,113,0.10)", statBorderColor: "rgba(248,113,113,0.20)" },
                { icon: PackageX, title: "재고 공백", stat: "연간 15%+ 손실", desc: "구매 후 재고 반영 누락. 유효기간 만료를 뒤늦게 발견", iconColor: "#FB923C", cardBg: "rgba(251,146,60,0.06)", statTextColor: "#FB923C", statBgColor: "rgba(251,146,60,0.10)", statBorderColor: "rgba(251,146,60,0.20)" },
              ].map((item, i) => (
                <div key={i} className="rounded-xl p-5" style={{ backgroundColor: item.cardBg, border: "1px solid #2A3648" }}>
                  <div className="flex items-center gap-3 mb-2.5">
                    <item.icon className="h-5 w-5" style={{ color: item.iconColor }} strokeWidth={1.5} />
                    <h3 className="text-sm font-bold text-white">{item.title}</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded ml-auto" style={{ color: item.statTextColor, backgroundColor: item.statBgColor, border: `1px solid ${item.statBorderColor}` }}>{item.stat}</span>
                  </div>
                  <p className="text-[13px] text-[#C8D4E5] leading-relaxed break-keep">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ 3. LabAxis 운영 흐름 — 6단계 파이프라인 ═══════════════════ */}
        <section className="py-10 md:py-16" style={{ backgroundColor: "#131A24", borderTop: "1px solid #1E2A3A" }}>
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="mb-6 md:mb-10">
              <p className="text-[11px] font-bold uppercase tracking-widest mb-2 text-blue-400">운영 흐름</p>
              <h2 className="text-xl md:text-[26px] font-bold text-white break-keep">
                검색 → 비교 → 견적 → 발주 → 입고 → 재고
              </h2>
              <p className="text-[13px] md:text-sm mt-2 max-w-2xl break-keep" style={{ color: "#C8D4E5" }}>
                연구실 구매의 전 과정을 하나의 파이프라인으로 연결합니다.
              </p>
            </div>

            {/* Mobile: horizontal swipe */}
            <div className="md:hidden overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4 pb-2">
              <div className="flex gap-2.5" style={{ width: "max-content" }}>
                {[
                  { num: 1, icon: Search, title: "통합 검색", change: "벤더 10곳 → 한 번에 검색", color: "#6FA2FF", bgColor: "rgba(111,162,255,0.15)" },
                  { num: 2, icon: GitCompare, title: "제품 비교", change: "엑셀 정리 → 비교표 즉시 생성", color: "#67C5E0", bgColor: "rgba(103,197,224,0.12)" },
                  { num: 3, icon: FileText, title: "견적 요청", change: "이메일 수집 → 클릭 한 번 전송", color: "#6FA2FF", bgColor: "rgba(111,162,255,0.12)" },
                  { num: 4, icon: ShoppingCart, title: "발주", change: "수기 발주 → 승인 후 발주 연동", color: "#F0A832", bgColor: "rgba(240,168,50,0.12)" },
                  { num: 5, icon: ClipboardCheck, title: "입고 검수", change: "수기 확인 → 스캔으로 즉시 반영", color: "#4ECDA4", bgColor: "rgba(78,205,164,0.12)" },
                  { num: 6, icon: Warehouse, title: "재고 운영", change: "엑셀 관리 → Lot·유효기간 추적", color: "#4ECDA4", bgColor: "rgba(78,205,164,0.15)" },
                ].map((step) => (
                  <div key={step.num} className="snap-start shrink-0 w-[140px] rounded-xl p-3 flex flex-col items-center text-center" style={{ backgroundColor: "#1C2535", border: "1px solid #2A3648" }}>
                    <div className="w-8 h-8 rounded-full text-white text-xs font-bold flex items-center justify-center mb-2" style={{ backgroundColor: step.bgColor }}>{step.num}</div>
                    <step.icon className="h-4 w-4 mb-1.5" style={{ color: step.color }} strokeWidth={1.5} />
                    <h3 className="text-xs font-bold text-white mb-0.5">{step.title}</h3>
                    <p className="text-[10px] leading-tight" style={{ color: "#9DADC0" }}>{step.change}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop: 6-column pipeline */}
            <div className="hidden md:grid md:grid-cols-6 gap-3">
              {[
                { num: 1, icon: Search, title: "통합 검색", change: "벤더 10곳 → 한 번에", color: "#6FA2FF", bgColor: "rgba(111,162,255,0.15)" },
                { num: 2, icon: GitCompare, title: "제품 비교", change: "엑셀 → 비교표 즉시 생성", color: "#67C5E0", bgColor: "rgba(103,197,224,0.12)" },
                { num: 3, icon: FileText, title: "견적 요청", change: "이메일 → 클릭 한 번", color: "#6FA2FF", bgColor: "rgba(111,162,255,0.12)" },
                { num: 4, icon: ShoppingCart, title: "발주", change: "수기 → 승인 후 발주", color: "#F0A832", bgColor: "rgba(240,168,50,0.12)" },
                { num: 5, icon: ClipboardCheck, title: "입고 검수", change: "수기 → 스캔 반영", color: "#4ECDA4", bgColor: "rgba(78,205,164,0.12)" },
                { num: 6, icon: Warehouse, title: "재고 운영", change: "엑셀 → 연동 추적", color: "#4ECDA4", bgColor: "rgba(78,205,164,0.15)" },
              ].map((step, i) => (
                <div key={step.num} className="relative">
                  <div className="rounded-xl p-4 h-full flex flex-col items-center text-center" style={{ backgroundColor: "#1C2535", border: "1px solid #2A3648" }}>
                    <div className="w-10 h-10 rounded-full text-white text-sm font-bold flex items-center justify-center mb-3" style={{ backgroundColor: step.bgColor }}>{step.num}</div>
                    <step.icon className="h-5 w-5 mb-2" style={{ color: step.color }} strokeWidth={1.5} />
                    <h3 className="text-sm font-bold text-white mb-1">{step.title}</h3>
                    <p className="text-[11px] leading-snug" style={{ color: "#9DADC0" }}>{step.change}</p>
                  </div>
                  {i < 5 && (
                    <div className="absolute -right-2 top-1/2 -translate-y-1/2 z-10">
                      <ChevronRight className="h-4 w-4" style={{ color: "#4A5E78" }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ 4. 비교표 ═══════════════════════════════════════════════════ */}
        <div className="mx-auto w-full max-w-6xl px-4 md:px-6" style={{ backgroundColor: "#131A24" }}>
          <ComparisonSection />
        </div>

        {/* ══ Mid CTA ═══════════════════════════════════════════════════ */}
        <section className="py-8 md:py-12" style={{ backgroundColor: "#131A24" }}>
          <div className="mx-auto max-w-6xl px-4 md:px-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/search">
              <button className="h-11 px-7 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 active:scale-95 rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-blue-600/20">
                시약·장비 검색 시작하기 <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </Link>
            <Link href="/support">
              <button className="h-11 px-7 text-sm font-medium rounded-lg transition-all active:scale-95" style={{ color: "#C8D4E5", border: "1px solid #2A3648" }}>
                도입 상담 문의
              </button>
            </Link>
          </div>
        </section>

        {/* ══ 5. 역할별 변화 — 압축 before/after ═══════════════════════ */}
        <section className="py-10 md:py-16" style={{ backgroundColor: "#131A24", borderTop: "1px solid #1E2A3A" }}>
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="mb-6 md:mb-8">
              <p className="text-[11px] font-bold uppercase tracking-widest mb-2 text-blue-400">역할별 변화</p>
              <h2 className="text-xl md:text-[26px] font-bold text-white break-keep">
                도입 후 각 역할이 달라지는 방식
              </h2>
            </div>

            {/* Mobile: horizontal swipe cards */}
            <div className="md:hidden overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4 pb-2">
              <div className="flex gap-3" style={{ width: "max-content" }}>
                {[
                  { icon: Microscope, role: "연구원", highlight: "탐색 시간 70% 단축", before: "벤더 10+곳 반복 방문 · 엑셀 수기 비교", after: "통합 검색으로 후보 즉시 확인 · 프로토콜 기반 자동 정리", iconColor: "#67C5E0" },
                  { icon: ShoppingCart, role: "구매 담당자", highlight: "견적 수집 80% 절감", before: "벤더별 견적 건당 45분+ · 이메일 분산 관리", after: "통합 견적 → 가격표 즉시 생성 · 이력 통합", iconColor: "#F0A832" },
                  { icon: Users, role: "관리자", highlight: "구매 이력 전건 추적", before: "엑셀 집계 · 구두 승인", after: "실시간 예산 소진 + 승인 라인 · Audit Trail", iconColor: "#6FA2FF" },
                ].map((c, i) => (
                  <div key={i} className="snap-start shrink-0 w-[280px] rounded-xl p-4 flex flex-col gap-3" style={{ backgroundColor: "#1C2535", border: "1px solid #2A3648" }}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#283548" }}>
                        <c.icon className="h-4 w-4" style={{ color: c.iconColor }} strokeWidth={1.5} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#8A99AF" }}>{c.role}</p>
                        <p className="text-[11px] font-semibold text-blue-400">{c.highlight}</p>
                      </div>
                    </div>
                    <div className="rounded-lg p-2.5" style={{ backgroundColor: "rgba(200,120,50,0.06)", border: "1px solid rgba(200,120,50,0.15)" }}>
                      <p className="text-[10px] font-bold uppercase mb-1" style={{ color: "#B09070" }}>기존</p>
                      <p className="text-[11px] leading-relaxed" style={{ color: "#8A99AF" }}>{c.before}</p>
                    </div>
                    <div className="rounded-lg p-2.5" style={{ backgroundColor: "#0F1A2A", border: "1px solid #1E3A5F" }}>
                      <p className="text-[10px] font-bold uppercase mb-1" style={{ color: "#6FA2FF" }}>LabAxis</p>
                      <p className="text-[11px] leading-relaxed" style={{ color: "#C8D4E5" }}>{c.after}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop: 3-column grid */}
            <div className="hidden md:grid md:grid-cols-3 gap-4">
              {[
                { icon: Microscope, role: "연구원", highlight: "탐색 시간 70% 단축", before: "벤더 10+곳 반복 방문 · 엑셀 수기 비교", after: "통합 검색으로 후보 즉시 확인 · 프로토콜 기반 자동 정리", iconColor: "#67C5E0" },
                { icon: ShoppingCart, role: "구매 담당자", highlight: "견적 수집 80% 절감", before: "벤더별 견적 건당 45분+ · 이메일 분산 관리", after: "통합 견적 → 가격표 즉시 생성 · 이력 통합", iconColor: "#F0A832" },
                { icon: Users, role: "관리자", highlight: "구매 이력 전건 추적", before: "엑셀 집계 · 구두 승인", after: "실시간 예산 소진 + 승인 라인 · Audit Trail", iconColor: "#6FA2FF" },
              ].map((c, i) => (
                <div key={i} className="rounded-xl p-5 flex flex-col gap-3" style={{ backgroundColor: "#1C2535", border: "1px solid #2A3648" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#283548" }}>
                      <c.icon className="h-5 w-5" style={{ color: c.iconColor }} strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#8A99AF" }}>{c.role}</p>
                      <h3 className="text-sm font-bold text-white">{c.highlight}</h3>
                    </div>
                  </div>
                  <div className="rounded-lg p-3" style={{ backgroundColor: "rgba(200,120,50,0.06)", border: "1px solid rgba(200,120,50,0.15)" }}>
                    <p className="text-[10px] font-bold uppercase mb-1" style={{ color: "#B09070" }}>기존</p>
                    <p className="text-[12px] leading-relaxed" style={{ color: "#8A99AF" }}>{c.before}</p>
                  </div>
                  <div className="rounded-lg p-3" style={{ backgroundColor: "#0F1A2A", border: "1px solid #1E3A5F" }}>
                    <p className="text-[10px] font-bold uppercase mb-1" style={{ color: "#6FA2FF" }}>LabAxis</p>
                    <p className="text-[12px] leading-relaxed" style={{ color: "#C8D4E5" }}>{c.after}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ 6. 통제·추적·승인 — 조직 기반 ═══════════════════════════ */}
        <section className="py-10 md:py-16" style={{ backgroundColor: "#131A24", borderTop: "1px solid #1E2A3A" }}>
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="mb-6 md:mb-8">
              <p className="text-[11px] font-bold uppercase tracking-widest mb-2 text-blue-400">조직 운영</p>
              <h2 className="text-xl md:text-[26px] font-bold text-white break-keep">
                통제·추적·승인 — 조직 기반
              </h2>
            </div>

            {/* Mobile: horizontal swipe */}
            <div className="md:hidden overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4 pb-3">
              <div className="flex gap-2.5" style={{ width: "max-content" }}>
                {[
                  { icon: KeyRound, title: "역할 권한", desc: "견적·승인·관리자 역할 분리", color: "#6FA2FF" },
                  { icon: CheckSquare, title: "승인 라인", desc: "금액 기준 라우팅 + 에스컬레이션", color: "#67C5E0" },
                  { icon: ScrollText, title: "Audit Trail", desc: "전건 추적, GMP/GLP 감사 대비", color: "#F0A832" },
                  { icon: Wallet, title: "예산 통합", desc: "실시간 소진 현황 + 초과 차단", color: "#4ECDA4" },
                ].map((item, i) => (
                  <div key={i} className="snap-start shrink-0 w-[200px] rounded-xl p-4 flex flex-col gap-2" style={{ backgroundColor: "#1C2535", border: "1px solid #2A3648" }}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#283548" }}>
                      <item.icon className="h-4 w-4" style={{ color: item.color }} strokeWidth={1.5} />
                    </div>
                    <h3 className="text-xs font-bold text-white">{item.title}</h3>
                    <p className="text-[11px] leading-relaxed" style={{ color: "#C8D4E5" }}>{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop: 2×2 grid */}
            <div className="hidden md:grid md:grid-cols-2 gap-4 mb-6">
              {[
                { icon: KeyRound, title: "역할 기반 권한 제어", desc: "견적 요청·승인·관리자 역할을 분리하여 내부 구매 프로세스에 맞게 운영", color: "#6FA2FF" },
                { icon: CheckSquare, title: "승인 라인", desc: "금액 기준 라우팅, 승인자 지정 및 에스컬레이션 지원", color: "#67C5E0" },
                { icon: ScrollText, title: "Audit Trail", desc: "모든 구매 활동 전건 추적. GMP/GLP 감사 대비 활용", color: "#F0A832" },
                { icon: Wallet, title: "예산 통합", desc: "부서·프로젝트별 예산 설정, 실시간 소진 현황, 초과 시 차단", color: "#4ECDA4" },
              ].map((item, i) => (
                <div key={i} className="rounded-xl p-5 flex gap-4" style={{ backgroundColor: "#1C2535", border: "1px solid #2A3648" }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#283548" }}>
                    <item.icon className="h-5 w-5" style={{ color: item.color }} strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-white mb-1">{item.title}</h3>
                    <p className="text-[12px] leading-relaxed break-keep" style={{ color: "#C8D4E5" }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* 도입 적합성 */}
            <div className="rounded-xl p-4 md:p-5" style={{ backgroundColor: "#1C2535", border: "1px solid #2A3648" }}>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: "#8A99AF" }}>이런 조직이면 지금 필요합니다</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {[
                  "연구팀과 구매팀이 분리된 조직",
                  "GMP/GLP 환경, Lot 추적 필요",
                  "다공급사 환경 — 벤더 3곳 이상",
                  "승인 단계가 필요한 구매 프로세스",
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                    <span className="text-[12px] break-keep" style={{ color: "#C8D4E5" }}>{item}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 flex flex-wrap items-center justify-center gap-3" style={{ borderTop: "1px solid #2A3648" }}>
                <Link href="/pricing">
                  <button className="h-10 px-5 text-sm font-semibold text-blue-400 rounded-lg transition-all active:scale-95" style={{ border: "1px solid #2A3648", backgroundColor: "#131A24" }}>
                    요금 & 플랜 보기
                  </button>
                </Link>
                <Link href="/support">
                  <button className="h-10 px-5 text-sm font-medium rounded-lg transition-all active:scale-95" style={{ color: "#C8D4E5", border: "1px solid #2A3648" }}>
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
