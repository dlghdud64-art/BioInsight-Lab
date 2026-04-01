import { MainLayout } from "../_components/main-layout";
import { MainHeader } from "../_components/main-header";
import { MainFooter } from "../_components/main-footer";
import {
  Search, GitCompare, FileText, Package, ArrowRight, ChevronRight,
  ShoppingCart, ClipboardCheck, Warehouse,
  AlertTriangle, Clock, PackageX,
  Microscope, Users,
  KeyRound, CheckSquare, ScrollText, Wallet,
  CheckCircle2, BarChart3, TrendingDown,
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";

const FinalCTASection = dynamic(
  () => import("../_components/final-cta-section").then((mod) => ({ default: mod.FinalCTASection })),
  { loading: () => <div className="h-64 w-full" style={{ backgroundColor: "#0E1D32" }} /> }
);

/*
 * ── Intro Page: 도입 판단 증거 페이지 ──────────────────────────────
 *  Page role: 브랜드 소개가 아닌, "이 제품을 도입할 근거"를 제시
 *  Structure: Hero(실제 작업 화면) → 병목 증거 → 운영 흐름(압축) → 역할별 변화 → 조직 운영 → CTA
 *
 *  Surface Family:
 *   Hero     : #071A33 — deepest navy
 *   Body     : #0E1D32 — dark body
 *   Card     : #142840 — elevated, border #1E3050
 *   Bridge   : desaturated blue-gray mist (no white bloom)
 * ─────────────────────────────────────────────────────────────────────
 */

export default function IntroPage() {
  return (
    <MainLayout>
      <MainHeader />
      <div className="w-full">

        {/* ══ 1. Hero — 실제 작업 화면 증거 ═══════════════════════════════ */}
        <section className="relative pt-16 pb-8 md:pt-24 md:pb-14 overflow-hidden" style={{ backgroundColor: "#071A33" }}>
          {/* Grid background */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{
            backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }} />

          <div className="relative mx-auto max-w-6xl px-4 md:px-6 flex flex-col md:flex-row md:items-center md:gap-10">
            {/* Left copy — 밀도 높인 텍스트 */}
            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-blue-400 rounded-full px-2.5 py-1 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                연구실 구매 운영 플랫폼
              </div>

              <h1 className="text-[24px] md:text-[38px] font-extrabold tracking-tight text-white mb-3 leading-snug break-keep">
                시약·장비 검색부터<br />
                <span className="text-blue-400">구매 운영</span>까지 한곳에서
              </h1>
              <p className="hidden md:block text-sm mb-6 leading-relaxed max-w-lg break-keep" style={{ color: "#9DADC0" }}>
                벤더 10곳 반복 검색 → 통합 검색, 엑셀 수기 비교 → 비교표 자동 생성,
                이메일 견적 → 클릭 한 번 전송. 건당 30분 이상 소요되던 구매 사이클을 구조적으로 단축합니다.
              </p>
              <p className="md:hidden text-xs mb-4 leading-relaxed break-keep" style={{ color: "#9DADC0" }}>
                검색·비교·견적·발주·입고·재고를 하나의 운영 흐름으로 연결합니다.
              </p>

              {/* Inline process bar — 단일 라인 */}
              <div className="hidden md:flex items-center gap-1 mb-5">
                {[
                  { label: "검색", icon: Search },
                  { label: "비교", icon: GitCompare },
                  { label: "견적", icon: FileText },
                  { label: "발주", icon: ShoppingCart },
                  { label: "입고", icon: ClipboardCheck },
                  { label: "재고", icon: Warehouse },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <div className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded" style={{ color: "#8A99AF", backgroundColor: i === 0 ? "rgba(59,130,246,0.12)" : "transparent" }}>
                      <s.icon className="h-2.5 w-2.5 flex-shrink-0" style={{ color: i === 0 ? "#60A5FA" : "#6A7A8E" }} />
                      {s.label}
                    </div>
                    {i < 5 && <ChevronRight className="h-2.5 w-2.5 flex-shrink-0" style={{ color: "#4A5E78" }} />}
                  </div>
                ))}
              </div>

              {/* Hero CTA */}
              <div className="flex gap-2">
                <Link href="/search">
                  <button className="h-9 px-5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 active:scale-95 rounded-lg transition-all flex items-center gap-1.5 shadow-lg shadow-blue-600/15">
                    제품 검색 시작 <ArrowRight className="h-3 w-3" />
                  </button>
                </Link>
                <Link href="/support">
                  <button className="h-9 px-4 text-xs font-medium rounded-lg transition-all active:scale-95" style={{ color: "#9DADC0", border: "1px solid #1E3050" }}>
                    도입 문의
                  </button>
                </Link>
              </div>
            </div>

            {/* Right: 실제 작업 화면 — 검색 결과 + 비교 선택 + 견적 CTA */}
            <div className="hidden md:flex flex-col gap-1.5 flex-shrink-0 w-[400px]">
              {/* 검색 결과 패널 */}
              <div className="rounded-lg p-2.5" style={{ backgroundColor: "#0A1828", border: "1px solid #1E3050" }}>
                <div className="flex items-center gap-2 rounded px-2.5 py-1.5 mb-2" style={{ backgroundColor: "#071A33", border: "1px solid #162A42" }}>
                  <Search className="h-3 w-3 text-blue-400" />
                  <span className="text-[11px]" style={{ color: "#8A99AF" }}>PBS buffer 10x, 500ml</span>
                  <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded" style={{ color: "#60A5FA", backgroundColor: "rgba(59,130,246,0.1)" }}>3건</span>
                </div>
                {[
                  { brand: "Sigma-Aldrich", name: "PBS 10X, pH 7.4 (500mL)", price: "₩38,000", lead: "3일", checked: true },
                  { brand: "Thermo Fisher", name: "Dulbecco's PBS 10X (500mL)", price: "₩41,500", lead: "5일", checked: true },
                  { brand: "Bio-Rad", name: "10X PBS Concentrate (500mL)", price: "₩45,200", lead: "7일", checked: false },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded" style={item.checked ? { backgroundColor: "rgba(59,130,246,0.06)" } : {}}>
                    <div className="w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0" style={{ borderColor: item.checked ? "#3B82F6" : "#2A3D56", backgroundColor: item.checked ? "rgba(59,130,246,0.15)" : "transparent" }}>
                      {item.checked && <CheckCircle2 className="h-2.5 w-2.5 text-blue-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-white truncate">{item.name}</p>
                      <p className="text-[9px]" style={{ color: "#6A7A8E" }}>{item.brand} · {item.lead}</p>
                    </div>
                    <span className="text-[11px] font-semibold text-white flex-shrink-0">{item.price}</span>
                  </div>
                ))}
              </div>

              {/* 비교 상태 + 견적 CTA */}
              <div className="rounded-lg p-2.5 flex items-center gap-2" style={{ backgroundColor: "#0A1828", border: "1px solid #1E3050" }}>
                <div className="flex items-center gap-1.5 flex-1">
                  <GitCompare className="h-3 w-3 text-blue-400" />
                  <span className="text-[10px] font-medium" style={{ color: "#8A99AF" }}>2건 비교 중</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#132440", color: "#60A5FA" }}>₩3,500 차이</span>
                </div>
                <div className="h-7 px-3 rounded bg-blue-600 flex items-center">
                  <span className="text-[10px] font-semibold text-white">견적 요청</span>
                </div>
              </div>

              {/* 실시간 상태 힌트 */}
              <div className="flex items-center gap-3 px-2">
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-[9px]" style={{ color: "#6A7A8E" }}>재고 확인됨</span>
                </div>
                <div className="flex items-center gap-1">
                  <BarChart3 className="h-2.5 w-2.5" style={{ color: "#6A7A8E" }} />
                  <span className="text-[9px]" style={{ color: "#6A7A8E" }}>가격 추이 제공</span>
                </div>
              </div>
            </div>

            {/* Mobile: compact mock */}
            <div className="md:hidden mt-4 rounded-lg p-2.5" style={{ backgroundColor: "#0A1828", border: "1px solid #1E3050" }}>
              <div className="flex items-center gap-2 mb-2">
                <Search className="h-3 w-3 text-blue-400" />
                <span className="text-[10px]" style={{ color: "#8A99AF" }}>PBS buffer 10x — 3건 검색됨</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <GitCompare className="h-2.5 w-2.5 text-blue-400" />
                  <span className="text-[9px]" style={{ color: "#8A99AF" }}>2건 비교 중</span>
                </div>
                <div className="h-6 px-2.5 rounded bg-blue-600 flex items-center">
                  <span className="text-[9px] font-semibold text-white">견적 요청</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ 1.5. Hero → Body seam ════════════════════════════════════ */}
        <div aria-hidden="true" style={{ height: 1, backgroundColor: "#1E3050" }} />

        {/* ══ 2. 운영 병목 증거 — 숫자 기반 ═══════════════════════════════ */}
        <section className="py-8 md:py-12" style={{ backgroundColor: "#0E1D32" }}>
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="mb-4 md:mb-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-1">현재 구매 병목</p>
              <h2 className="text-lg md:text-xl font-bold text-white break-keep">
                지금 발생하고 있는 시간·비용 낭비
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {[
                { icon: Clock, title: "반복 검색", stat: "건당 30분+", desc: "벤더 사이트 10곳을 일일이 방문하여 동일 시약 검색", color: "#F59E0B" },
                { icon: AlertTriangle, title: "수기 견적", stat: "건당 45분+", desc: "이메일·전화 견적 수집 후 엑셀 수기 정리", color: "#F59E0B" },
                { icon: PackageX, title: "재고 공백", stat: "연간 15%+ 손실", desc: "구매 후 재고 반영 누락, 유효기간 만료 뒤늦게 발견", color: "#EF4444" },
              ].map((item, i) => (
                <div key={i} className="rounded-lg p-4 flex gap-3" style={{ backgroundColor: "#142840", border: "1px solid #1E3050" }}>
                  <item.icon className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: item.color }} strokeWidth={1.5} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-xs font-bold text-white">{item.title}</h3>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ color: "#C8D4E5", backgroundColor: "#1A2D48" }}>{item.stat}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed break-keep" style={{ color: "#8A99AF" }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* 절감 증거 */}
            <div className="mt-3 rounded-lg p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2" style={{ backgroundColor: "#0A1828", border: "1px solid #1E3050" }}>
              <div className="flex items-center gap-2">
                <TrendingDown className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                <span className="text-[11px] font-medium" style={{ color: "#C8D4E5" }}>LabAxis 도입 시 예상 절감</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[11px]" style={{ color: "#8A99AF" }}>검색 시간 <strong className="text-emerald-400">70%↓</strong></span>
                <span className="text-[11px]" style={{ color: "#8A99AF" }}>견적 수집 <strong className="text-emerald-400">80%↓</strong></span>
                <span className="text-[11px]" style={{ color: "#8A99AF" }}>재고 손실 <strong className="text-emerald-400">60%↓</strong></span>
              </div>
            </div>
          </div>
        </section>

        {/* ══ 3. 운영 흐름 — 단일 라인 프로세스 바 + 요약 ═══════════════ */}
        <section className="py-8 md:py-12" style={{ backgroundColor: "#0E1D32", borderTop: "1px solid #162A42" }}>
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="mb-4 md:mb-6">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1 text-blue-400">운영 흐름</p>
              <h2 className="text-lg md:text-xl font-bold text-white break-keep">
                6단계 파이프라인, 하나의 화면에서 운영
              </h2>
            </div>

            {/* Desktop: compact horizontal pipeline */}
            <div className="hidden md:block">
              <div className="flex items-stretch gap-2">
                {[
                  { num: 1, icon: Search, title: "통합 검색", before: "벤더 10곳 방문", after: "한 번에 검색" },
                  { num: 2, icon: GitCompare, title: "비교", before: "엑셀 수기 정리", after: "비교표 자동 생성" },
                  { num: 3, icon: FileText, title: "견적", before: "이메일 수집", after: "클릭 한 번 전송" },
                  { num: 4, icon: ShoppingCart, title: "발주", before: "수기 발주서", after: "승인 후 자동 발주" },
                  { num: 5, icon: ClipboardCheck, title: "입고", before: "수기 확인", after: "스캔으로 즉시 반영" },
                  { num: 6, icon: Warehouse, title: "재고", before: "엑셀 관리", after: "Lot·유효기간 추적" },
                ].map((step, i) => (
                  <div key={step.num} className="flex items-center gap-2 flex-1">
                    <div className="rounded-lg p-3 flex-1" style={{ backgroundColor: "#142840", border: "1px solid #1E3050" }}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center flex-shrink-0" style={{ backgroundColor: step.num === 1 ? "rgba(59,130,246,0.18)" : "#1A2D48", color: step.num === 1 ? "#60A5FA" : "#6A7A8E" }}>{step.num}</div>
                        <step.icon className="h-3 w-3" style={{ color: "#6A7A8E" }} strokeWidth={1.5} />
                        <span className="text-[11px] font-bold text-white">{step.title}</span>
                      </div>
                      <p className="text-[9px] leading-snug" style={{ color: "#6A7A8E" }}>
                        <span style={{ textDecoration: "line-through" }}>{step.before}</span>
                        <span className="mx-1">→</span>
                        <span style={{ color: "#9DADC0" }}>{step.after}</span>
                      </p>
                    </div>
                    {i < 5 && <ChevronRight className="h-3 w-3 flex-shrink-0" style={{ color: "#3A5068" }} />}
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile: horizontal swipe */}
            <div className="md:hidden overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4 pb-1">
              <div className="flex gap-2" style={{ width: "max-content" }}>
                {[
                  { num: 1, icon: Search, title: "검색", change: "10곳 → 한 번에" },
                  { num: 2, icon: GitCompare, title: "비교", change: "엑셀 → 자동 비교표" },
                  { num: 3, icon: FileText, title: "견적", change: "이메일 → 클릭 전송" },
                  { num: 4, icon: ShoppingCart, title: "발주", change: "수기 → 승인 발주" },
                  { num: 5, icon: ClipboardCheck, title: "입고", change: "수기 → 스캔 반영" },
                  { num: 6, icon: Warehouse, title: "재고", change: "엑셀 → Lot 추적" },
                ].map((step) => (
                  <div key={step.num} className="snap-start shrink-0 w-[110px] rounded-lg p-2.5 flex flex-col items-center text-center" style={{ backgroundColor: "#142840", border: "1px solid #1E3050" }}>
                    <div className="w-6 h-6 rounded-full text-[9px] font-bold flex items-center justify-center mb-1.5" style={{ color: step.num === 1 ? "#60A5FA" : "#6A7A8E", backgroundColor: step.num === 1 ? "rgba(59,130,246,0.18)" : "#1A2D48" }}>{step.num}</div>
                    <step.icon className="h-3 w-3 mb-1" style={{ color: "#6A7A8E" }} strokeWidth={1.5} />
                    <h3 className="text-[10px] font-bold text-white mb-0.5">{step.title}</h3>
                    <p className="text-[9px] leading-tight" style={{ color: "#8A99AF" }}>{step.change}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══ 4. 역할별 도입 효과 — 압축 before/after ═══════════════════ */}
        <section className="py-8 md:py-12" style={{ backgroundColor: "#0E1D32", borderTop: "1px solid #162A42" }}>
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="mb-4 md:mb-6">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1 text-blue-400">역할별 효과</p>
              <h2 className="text-lg md:text-xl font-bold text-white break-keep">
                도입 후 달라지는 업무 방식
              </h2>
            </div>

            {/* Mobile: horizontal swipe */}
            <div className="md:hidden overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4 pb-1">
              <div className="flex gap-2.5" style={{ width: "max-content" }}>
                {[
                  { icon: Microscope, role: "연구원", highlight: "탐색 70%↓", before: "벤더 10+곳 반복 방문, 엑셀 비교", after: "통합 검색 → 비교표 자동 생성" },
                  { icon: ShoppingCart, role: "구매 담당", highlight: "견적 80%↓", before: "건당 45분+ 이메일 견적 수집", after: "클릭 한 번 견적 전송, 이력 통합" },
                  { icon: Users, role: "관리자", highlight: "전건 추적", before: "엑셀 집계, 구두 승인", after: "실시간 예산 + 승인 라인 + Audit" },
                ].map((c, i) => (
                  <div key={i} className="snap-start shrink-0 w-[240px] rounded-lg p-3 flex flex-col gap-2" style={{ backgroundColor: "#142840", border: "1px solid #1E3050" }}>
                    <div className="flex items-center gap-2">
                      <c.icon className="h-3.5 w-3.5" style={{ color: "#6A7A8E" }} strokeWidth={1.5} />
                      <span className="text-[10px] font-bold" style={{ color: "#8A99AF" }}>{c.role}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded ml-auto" style={{ color: "#60A5FA", backgroundColor: "rgba(59,130,246,0.1)" }}>{c.highlight}</span>
                    </div>
                    <div className="rounded p-2" style={{ backgroundColor: "#0D1A30" }}>
                      <p className="text-[9px] font-bold mb-0.5" style={{ color: "#6A7A8E" }}>기존</p>
                      <p className="text-[10px] leading-snug" style={{ color: "#8A99AF" }}>{c.before}</p>
                    </div>
                    <div className="rounded p-2" style={{ backgroundColor: "#0D1A30" }}>
                      <p className="text-[9px] font-bold mb-0.5" style={{ color: "#8A99AF" }}>LabAxis</p>
                      <p className="text-[10px] leading-snug" style={{ color: "#C8D4E5" }}>{c.after}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop: 3-column compact */}
            <div className="hidden md:grid md:grid-cols-3 gap-3">
              {[
                { icon: Microscope, role: "연구원", highlight: "탐색 시간 70%↓", before: "벤더 10+곳 반복 방문 · 엑셀 수기 비교", after: "통합 검색으로 후보 즉시 확인 · 비교표 자동 생성" },
                { icon: ShoppingCart, role: "구매 담당자", highlight: "견적 수집 80%↓", before: "벤더별 견적 건당 45분+ · 이메일 분산 관리", after: "통합 견적 → 가격표 즉시 생성 · 이력 통합" },
                { icon: Users, role: "관리자", highlight: "구매 이력 전건 추적", before: "엑셀 집계 · 구두 승인", after: "실시간 예산 소진 + 승인 라인 · Audit Trail" },
              ].map((c, i) => (
                <div key={i} className="rounded-lg p-4 flex flex-col gap-2.5" style={{ backgroundColor: "#142840", border: "1px solid #1E3050" }}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#1A2D48" }}>
                      <c.icon className="h-3.5 w-3.5" style={{ color: "#6A7A8E" }} strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#6A7A8E" }}>{c.role}</p>
                      <p className="text-[11px] font-bold text-white">{c.highlight}</p>
                    </div>
                  </div>
                  <div className="rounded p-2.5" style={{ backgroundColor: "#0D1A30", border: "1px solid #162A42" }}>
                    <p className="text-[9px] font-bold uppercase mb-0.5" style={{ color: "#5A6A7E" }}>기존</p>
                    <p className="text-[11px] leading-relaxed" style={{ color: "#8A99AF" }}>{c.before}</p>
                  </div>
                  <div className="rounded p-2.5" style={{ backgroundColor: "#0D1A30", border: "1px solid #162A42" }}>
                    <p className="text-[9px] font-bold uppercase mb-0.5" style={{ color: "#8A99AF" }}>LabAxis</p>
                    <p className="text-[11px] leading-relaxed" style={{ color: "#C8D4E5" }}>{c.after}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ 5. 조직 운영 기반 — 2×2 그리드 + 도입 적합성 ═══════════════ */}
        <section className="py-8 md:py-12" style={{ backgroundColor: "#0E1D32", borderTop: "1px solid #162A42" }}>
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="mb-4 md:mb-6">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1 text-blue-400">조직 운영</p>
              <h2 className="text-lg md:text-xl font-bold text-white break-keep">
                통제·추적·승인 — 조직 단위 구매 운영
              </h2>
            </div>

            {/* Mobile: horizontal swipe */}
            <div className="md:hidden overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4 pb-2">
              <div className="flex gap-2" style={{ width: "max-content" }}>
                {[
                  { icon: KeyRound, title: "역할 권한", desc: "견적·승인·관리자 분리" },
                  { icon: CheckSquare, title: "승인 라인", desc: "금액 기준 라우팅" },
                  { icon: ScrollText, title: "Audit Trail", desc: "전건 추적, GMP/GLP 대비" },
                  { icon: Wallet, title: "예산 통합", desc: "실시간 소진 + 초과 차단" },
                ].map((item, i) => (
                  <div key={i} className="snap-start shrink-0 w-[160px] rounded-lg p-3 flex flex-col gap-1.5" style={{ backgroundColor: "#142840", border: "1px solid #1E3050" }}>
                    <item.icon className="h-3.5 w-3.5" style={{ color: "#6A7A8E" }} strokeWidth={1.5} />
                    <h3 className="text-[10px] font-bold text-white">{item.title}</h3>
                    <p className="text-[9px] leading-relaxed" style={{ color: "#8A99AF" }}>{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop: 2×2 compact */}
            <div className="hidden md:grid md:grid-cols-2 gap-2.5 mb-4">
              {[
                { icon: KeyRound, title: "역할 기반 권한 제어", desc: "견적 요청·승인·관리자 역할 분리, 구매 프로세스 맞춤 운영" },
                { icon: CheckSquare, title: "승인 라인", desc: "금액 기준 라우팅, 승인자 지정 및 에스컬레이션" },
                { icon: ScrollText, title: "Audit Trail", desc: "모든 구매 활동 전건 추적. GMP/GLP 감사 대비" },
                { icon: Wallet, title: "예산 통합", desc: "부서·프로젝트별 설정, 실시간 소진 현황, 초과 차단" },
              ].map((item, i) => (
                <div key={i} className="rounded-lg p-3.5 flex gap-3" style={{ backgroundColor: "#142840", border: "1px solid #1E3050" }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#1A2D48" }}>
                    <item.icon className="h-3.5 w-3.5" style={{ color: "#6A7A8E" }} strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[11px] font-bold text-white mb-0.5">{item.title}</h3>
                    <p className="text-[10px] leading-relaxed break-keep" style={{ color: "#8A99AF" }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* 도입 적합성 — 압축 */}
            <div className="rounded-lg p-3.5" style={{ backgroundColor: "#142840", border: "1px solid #1E3050" }}>
              <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: "#6A7A8E" }}>이런 조직이면 지금 필요합니다</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                {[
                  "연구팀과 구매팀이 분리된 조직",
                  "GMP/GLP 환경, Lot 추적 필수",
                  "다공급사 환경 — 벤더 3곳 이상",
                  "승인 단계가 필요한 구매 프로세스",
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                    <span className="text-[10px] break-keep" style={{ color: "#C8D4E5" }}>{item}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-2.5 flex flex-wrap items-center justify-center gap-2" style={{ borderTop: "1px solid #1E3050" }}>
                <Link href="/pricing">
                  <button className="h-8 px-4 text-[11px] font-semibold text-blue-400 rounded-lg transition-all active:scale-95" style={{ border: "1px solid #1E3050", backgroundColor: "#0E1D32" }}>
                    요금 & 플랜 보기
                  </button>
                </Link>
                <Link href="/support">
                  <button className="h-8 px-4 text-[11px] font-medium rounded-lg transition-all active:scale-95" style={{ color: "#9DADC0", border: "1px solid #1E3050" }}>
                    도입 상담
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ══ 5.5. Dark → CTA seam ═════════════════════════════════════ */}
        <div aria-hidden="true" style={{ height: 1, backgroundColor: "#1E3050" }} />

        {/* ══ 6. Final CTA ═══════════════════════════════════════════════ */}
        <FinalCTASection />

        {/* ══ 6.5. CTA → Footer seam ════════════════════════════════════ */}
        <div aria-hidden="true" style={{ height: 1, backgroundColor: "#D7E0EB" }} />
      </div>
      <MainFooter />
    </MainLayout>
  );
}
