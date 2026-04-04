import { MainLayout } from "../_components/main-layout";
import { MainHeader } from "../_components/main-header";
import { MainFooter } from "../_components/main-footer";
import {
  Search, GitCompare, FileText, ShoppingCart, ClipboardCheck, Warehouse,
  ArrowRight, CheckCircle2, Shield, ScrollText, Wallet, History,
  BarChart3, Microscope, Users, ChevronRight,
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";

const FinalCTASection = dynamic(
  () => import("../_components/final-cta-section").then((mod) => ({ default: mod.FinalCTASection })),
  { loading: () => <div className="h-64 w-full" style={{ backgroundColor: "#0E1B2E" }} /> }
);

/* ── Surface colors ─────────────────────────────────────────────── */
const S = {
  bg: "#0c1324",
  containerLowest: "#070d1f",
  containerLow: "#151b2d",
  container: "#191f31",
  containerHigh: "#23293c",
  containerHighest: "#2e3447",
  bright: "#33394c",
  onSurface: "#dce1fb",
  onSurfaceVariant: "#c2c6d6",
  outline: "#8c909f",
  outlineVariant: "#424754",
  primary: "#adc6ff",
  primaryContainer: "#4d8eff",
  onPrimary: "#002e6a",
  secondary: "#4edea3",
  secondaryContainer: "#00a572",
  tertiary: "#ffb95f",
  tertiaryContainer: "#ca8100",
  error: "#ffb4ab",
} as const;

export default function IntroPage() {
  return (
    <MainLayout>
      <MainHeader />
      <div className="w-full" style={{ backgroundColor: S.bg, color: S.onSurface }}>

        {/* ══════════════════════════════════════════════════════════════
            1. Hero — 센터 정렬 + 하단 operating cue strip
           ══════════════════════════════════════════════════════════════ */}
        <section className="relative pt-24 md:pt-32 pb-12 md:pb-16 flex flex-col items-center overflow-hidden px-6">
          {/* Background glow orbs */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-[120px]" style={{ backgroundColor: "rgba(77,142,255,0.05)" }} />
            <div className="absolute top-1/4 right-0 w-[400px] h-[400px] rounded-full blur-[100px]" style={{ backgroundColor: "rgba(78,222,163,0.05)" }} />
          </div>

          <div className="relative z-10 max-w-5xl text-center">
            {/* Pill badge */}
            <div className="inline-flex items-center px-3 py-1 mb-8 rounded-full text-sm font-medium tracking-wide" style={{ backgroundColor: S.containerHighest, border: `1px solid ${S.outlineVariant}30`, color: S.primary }}>
              <span className="w-2 h-2 rounded-full mr-2 animate-pulse" style={{ backgroundColor: S.secondary }} />
              연구 구매 운영을 위한 새로운 기준
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-[1.1]" style={{ textShadow: "0 0 15px rgba(173,198,255,0.3)" }}>
              시약·장비 검색부터<br />
              구매 운영까지 <span style={{ color: S.primary }}>한 곳에서</span>
            </h1>

            <p className="text-lg md:text-2xl max-w-3xl mx-auto mb-10 leading-relaxed" style={{ color: S.onSurfaceVariant }}>
              시약·장비 검색, 후보 정리, 비교·선택, 요청 생성, 발주 준비까지<br className="hidden md:block" />
              분리된 구매 작업을 한 화면 흐름으로 정리합니다.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
              <Link href="/search">
                <button className="w-full sm:w-auto px-8 py-4 text-lg font-bold rounded-xl shadow-lg transition-all hover:shadow-xl active:scale-95" style={{ backgroundColor: S.primary, color: S.onPrimary, boxShadow: "0 8px 32px rgba(77,142,255,0.2)" }}>
                  제품 시작하기
                </button>
              </Link>
              <Link href="/support">
                <button className="w-full sm:w-auto px-8 py-4 text-lg font-bold rounded-xl transition-all hover:brightness-110 active:scale-95" style={{ backgroundColor: S.containerHighest, color: S.primary, border: `1px solid ${S.outlineVariant}20` }}>
                  도입 문의
                </button>
              </Link>
            </div>

            {/* ── Operating cue strip — Hero 하단 product signal ── */}
            <div className="flex items-center justify-center gap-1 sm:gap-2 flex-wrap">
              {[
                { icon: Search, label: "검색", active: true },
                { icon: GitCompare, label: "비교·선택" },
                { icon: FileText, label: "요청 생성" },
                { icon: ShoppingCart, label: "발주 준비" },
                { icon: ClipboardCheck, label: "입고 반영" },
                { icon: Warehouse, label: "재고 운영" },
              ].map((s, i) => (
                <div key={s.label} className="flex items-center gap-1">
                  <div
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] sm:text-[13px] font-medium transition-colors"
                    style={{
                      backgroundColor: s.active ? "rgba(77,142,255,0.12)" : "rgba(255,255,255,0.03)",
                      color: s.active ? S.primary : S.outline,
                      border: s.active ? "1px solid rgba(77,142,255,0.2)" : "1px solid transparent",
                    }}
                  >
                    <s.icon className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={1.8} />
                    {s.label}
                  </div>
                  {i < 5 && <ChevronRight className="h-3 w-3 flex-shrink-0" style={{ color: S.outlineVariant }} />}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            2. 연결 포인트 — 2col: 좌 텍스트 + 우 progress bar 패널
               - progress line 차등 (높이/밝기)
               - 미니 카드 역할 분화 (icon 차별, weight 차등)
           ══════════════════════════════════════════════════════════════ */}
        <section className="py-24 relative overflow-hidden" style={{ backgroundColor: S.containerLowest }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at top, rgba(77,142,255,0.08), transparent 42%)" }} />
          <div className="max-w-7xl mx-auto px-6 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              {/* Left: copy */}
              <div>
                <h2 className="text-3xl md:text-4xl font-bold mb-6 leading-tight">
                  연구와 구매 사이의<br /><span style={{ color: S.primary }}>끊기는 흐름을 줄입니다</span>
                </h2>
                <p className="text-lg mb-12 leading-relaxed" style={{ color: S.onSurfaceVariant }}>
                  검색, 비교, 요청, 입고와 재고 기록이 분리될수록 같은 품목을 다시 찾고 같은 결정을 반복하게 됩니다. LabAxis는 반복 작업을 줄이고 구매 운영의 맥락을 이어서 볼 수 있게 정리합니다.
                </p>

                {/* 3 mini cards — 역할 분화 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <div className="p-5 rounded-xl" style={{ backgroundColor: S.containerLow, border: `1px solid ${S.outlineVariant}15` }}>
                    <Search className="h-4 w-4 mb-2" style={{ color: S.primary }} strokeWidth={1.8} />
                    <p className="text-xs mb-1 font-medium" style={{ color: S.outline }}>검색·후보 정리</p>
                    <p className="text-base font-bold" style={{ color: S.onSurface }}>한 번에 연결</p>
                  </div>
                  <div className="p-5 rounded-xl" style={{ backgroundColor: S.containerLow, border: `1px solid ${S.outlineVariant}15` }}>
                    <GitCompare className="h-4 w-4 mb-2" style={{ color: S.secondary }} strokeWidth={1.8} />
                    <p className="text-xs mb-1 font-medium" style={{ color: S.outline }}>비교·요청 전환</p>
                    <p className="text-lg font-bold" style={{ color: S.onSurface }}>결정 기록 유지</p>
                  </div>
                  <div className="p-5 rounded-xl" style={{ backgroundColor: S.containerLow, border: `1px solid ${S.outlineVariant}15` }}>
                    <Warehouse className="h-4 w-4 mb-2" style={{ color: S.tertiary }} strokeWidth={1.8} />
                    <p className="text-xs mb-1 font-medium" style={{ color: S.outline }}>입고 이후 운영</p>
                    <p className="text-sm font-bold leading-snug" style={{ color: S.onSurface }}>재고·Lot 추적 유지</p>
                  </div>
                </div>
              </div>

              {/* Right: progress bar panel — 차등 적용 */}
              <div className="p-8 md:p-12 rounded-3xl shadow-2xl" style={{ backgroundColor: S.containerHigh, border: `1px solid ${S.outlineVariant}20`, boxShadow: "0 25px 50px rgba(0,0,0,0.2)" }}>
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-bold">LabAxis 운영 연결 포인트</h3>
                  <span className="px-3 py-1 rounded-full text-xs font-bold tracking-wide" style={{ backgroundColor: "rgba(78,222,163,0.1)", color: S.secondary }}>연결됨</span>
                </div>

                <div className="flex flex-col gap-7">
                  {/* Primary — 가장 강조 */}
                  <div>
                    <div className="flex justify-between mb-2 gap-4">
                      <span className="font-semibold" style={{ color: S.onSurface }}>검색 → 후보 정리</span>
                      <span className="font-bold whitespace-nowrap" style={{ color: S.secondary }}>한 화면 연결</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: S.containerHighest }}>
                      <div className="h-full rounded-full" style={{ width: "88%", backgroundColor: S.secondary }} />
                    </div>
                  </div>
                  {/* Secondary */}
                  <div>
                    <div className="flex justify-between mb-2 gap-4">
                      <span className="font-medium" style={{ color: S.onSurfaceVariant }}>비교 → 요청 생성</span>
                      <span className="font-bold whitespace-nowrap" style={{ color: "rgba(78,222,163,0.75)" }}>결정 기록 유지</span>
                    </div>
                    <div className="h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: S.containerHighest }}>
                      <div className="h-full rounded-full" style={{ width: "82%", backgroundColor: "rgba(78,222,163,0.7)" }} />
                    </div>
                  </div>
                  {/* Tertiary */}
                  <div>
                    <div className="flex justify-between mb-2 gap-4">
                      <span className="font-medium text-sm" style={{ color: S.outline }}>입고 → 재고 반영</span>
                      <span className="font-bold whitespace-nowrap text-sm" style={{ color: "rgba(78,222,163,0.55)" }}>lot/기한 추적</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: S.containerHighest }}>
                      <div className="h-full rounded-full" style={{ width: "78%", backgroundColor: "rgba(78,222,163,0.5)" }} />
                    </div>
                  </div>
                </div>

                <div className="mt-10 flex items-center p-4 rounded-xl" style={{ backgroundColor: "rgba(77,142,255,0.05)", border: "1px solid rgba(77,142,255,0.15)" }}>
                  <BarChart3 className="h-5 w-5 mr-3 flex-shrink-0" style={{ color: S.primary }} />
                  <p className="text-sm font-medium" style={{ color: S.onSurfaceVariant }}>
                    AI 보조 레이어가 후보 정리, 비교 준비, 요청 생성 전환을 돕고 작업 흐름을 끊기지 않게 이어줍니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            3. 6단계 운영 흐름 — Decision flow (1~3) / Operation flow (4~6) 그룹
           ══════════════════════════════════════════════════════════════ */}
        <section className="py-24 md:py-28 overflow-hidden" style={{ backgroundColor: S.bg }}>
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">하나로 연결된 연구 구매 운영 흐름</h2>
              <p className="max-w-2xl mx-auto text-lg" style={{ color: S.onSurfaceVariant }}>
                검색, 비교·선택, 요청 생성, 발주 준비, 입고 반영, 재고 운영이 한 맥락 안에서 이어집니다.
              </p>
            </div>

            {/* Desktop: 2-group strip */}
            <div className="hidden lg:flex flex-col gap-8">
              {/* Group A: Decision flow */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: S.primary }}>의사결정 흐름</p>
                <div className="flex items-stretch gap-3">
                  {[
                    { num: 1, icon: Search, title: "통합 검색", desc: "품목·제조사·카탈로그 기준 탐색" },
                    { num: 2, icon: GitCompare, title: "비교·선택", desc: "대체품, 가격, 조건 비교 정리" },
                    { num: 3, icon: FileText, title: "요청 생성", desc: "선택안 기준으로 요청안 작성" },
                  ].map((step, i) => (
                    <div key={step.num} className="flex items-center gap-3 flex-1">
                      <div className="flex-1 rounded-2xl p-6 transition-all" style={{ backgroundColor: S.containerLow, border: `1px solid ${S.outlineVariant}15` }}>
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-7 h-7 rounded-full text-[11px] font-bold flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "rgba(77,142,255,0.15)", color: S.primary }}>{step.num}</div>
                          <step.icon className="h-4 w-4" style={{ color: S.primary }} strokeWidth={1.8} />
                          <span className="text-sm font-bold">{step.title}</span>
                        </div>
                        <p className="text-xs leading-relaxed pl-10" style={{ color: S.outline }}>{step.desc}</p>
                      </div>
                      {i < 2 && <ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: S.outlineVariant }} />}
                    </div>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-4 px-4">
                <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, transparent, ${S.outlineVariant}40, transparent)` }} />
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: S.outlineVariant }}>운영 실행으로 전환</span>
                <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, transparent, ${S.outlineVariant}40, transparent)` }} />
              </div>

              {/* Group B: Operation flow */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: S.secondary }}>운영 실행 흐름</p>
                <div className="flex items-stretch gap-3">
                  {[
                    { num: 4, icon: ShoppingCart, title: "발주 준비", desc: "전환 가능 상태와 검토 항목 확인" },
                    { num: 5, icon: ClipboardCheck, title: "입고 반영", desc: "수령 정보와 lot 기록 연결" },
                    { num: 6, icon: Warehouse, title: "재고 운영", desc: "부족, 만료, 재주문 판단 유지" },
                  ].map((step, i) => (
                    <div key={step.num} className="flex items-center gap-3 flex-1">
                      <div className="flex-1 rounded-2xl p-6 transition-all" style={{ backgroundColor: S.containerLow, border: `1px solid ${S.outlineVariant}15` }}>
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-7 h-7 rounded-full text-[11px] font-bold flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "rgba(78,222,163,0.12)", color: S.secondary }}>{step.num}</div>
                          <step.icon className="h-4 w-4" style={{ color: S.secondary }} strokeWidth={1.8} />
                          <span className="text-sm font-bold">{step.title}</span>
                        </div>
                        <p className="text-xs leading-relaxed pl-10" style={{ color: S.outline }}>{step.desc}</p>
                      </div>
                      {i < 2 && <ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: S.outlineVariant }} />}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Mobile: 2×3 grid with group labels */}
            <div className="lg:hidden flex flex-col gap-6">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: S.primary }}>의사결정 흐름</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { num: 1, icon: Search, title: "검색", color: S.primary },
                  { num: 2, icon: GitCompare, title: "비교·선택", color: S.primary },
                  { num: 3, icon: FileText, title: "요청 생성", color: S.primary },
                ].map((s) => (
                  <div key={s.num} className="rounded-xl p-3 text-center" style={{ backgroundColor: S.containerLow, border: `1px solid ${S.outlineVariant}10` }}>
                    <div className="w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: "rgba(77,142,255,0.15)", color: s.color }}>{s.num}</div>
                    <s.icon className="h-4 w-4 mx-auto mb-1" style={{ color: s.color }} strokeWidth={1.8} />
                    <p className="text-[11px] font-bold">{s.title}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: S.secondary }}>운영 실행 흐름</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { num: 4, icon: ShoppingCart, title: "발주 준비", color: S.secondary },
                  { num: 5, icon: ClipboardCheck, title: "입고 반영", color: S.secondary },
                  { num: 6, icon: Warehouse, title: "재고 운영", color: S.secondary },
                ].map((s) => (
                  <div key={s.num} className="rounded-xl p-3 text-center" style={{ backgroundColor: S.containerLow, border: `1px solid ${S.outlineVariant}10` }}>
                    <div className="w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: "rgba(78,222,163,0.12)", color: s.color }}>{s.num}</div>
                    <s.icon className="h-4 w-4 mx-auto mb-1" style={{ color: s.color }} strokeWidth={1.8} />
                    <p className="text-[11px] font-bold">{s.title}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            4. 역할별 변화 — 3col before/after (3번째 카피 구체화)
           ══════════════════════════════════════════════════════════════ */}
        <section className="py-24" style={{ backgroundColor: S.containerLow }}>
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">도입 후 달라지는 운영 흐름</h2>
              <p style={{ color: S.onSurfaceVariant }}>역할마다 반복 업무는 줄이고 다음 작업으로 이어지는 연결성은 강화합니다.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  icon: Microscope,
                  role: "연구원",
                  roleBg: S.primaryContainer,
                  roleTextColor: "#00285d",
                  accentColor: S.primary,
                  accentBg: "rgba(77,142,255,0.05)",
                  cornerBg: "rgba(77,142,255,0.05)",
                  title: "후보 정리가 빨라집니다",
                  before: "여러 벤더를 따로 열고 품목을 수기로 모아 비교 준비",
                  after: "검색 결과에서 후보를 바로 정리하고 다음 비교 단계로 이동",
                },
                {
                  icon: ShoppingCart,
                  role: "구매 담당",
                  roleBg: S.secondaryContainer,
                  roleTextColor: "#00311f",
                  accentColor: S.secondary,
                  accentBg: "rgba(78,222,163,0.05)",
                  cornerBg: "rgba(78,222,163,0.05)",
                  title: "요청에서 발주 준비까지 이어집니다",
                  before: "비교 결과를 다시 정리하고 전화·이메일로 요청 초안 수동 작성",
                  after: "선택안 기준으로 요청안을 만들고 발주 준비 상태까지 이어서 확인",
                },
                {
                  icon: Users,
                  role: "운영 관리자",
                  roleBg: S.tertiaryContainer,
                  roleTextColor: "#3e2400",
                  accentColor: S.tertiary,
                  accentBg: "rgba(255,185,95,0.05)",
                  cornerBg: "rgba(255,185,95,0.05)",
                  title: "구매·입고·재고를 같은 맥락에서 추적합니다",
                  before: "구매 이력, 입고 상태, 재고 공백을 각각 다른 문서와 시스템에서 확인",
                  after: "결정 이력, 입고 반영, 재고 운영 상태를 하나의 운영 흐름에서 연결 추적",
                },
              ].map((card) => (
                <div key={card.role} className="p-8 rounded-2xl relative overflow-hidden group" style={{ backgroundColor: S.containerLowest, border: `1px solid ${S.outlineVariant}10` }}>
                  {/* Corner accent */}
                  <div className="absolute top-0 right-0 w-32 h-32 rounded-bl-full transition-all" style={{ backgroundColor: card.cornerBg }} />

                  <span className="inline-block px-3 py-1 rounded-md text-xs font-bold mb-6 relative z-10" style={{ backgroundColor: card.roleBg, color: card.roleTextColor }}>
                    {card.role}
                  </span>
                  <h4 className="text-xl md:text-2xl font-bold mb-4 relative z-10 leading-snug">{card.title}</h4>

                  <div className="flex flex-col gap-4 relative z-10">
                    <div className="p-4 rounded-xl" style={{ backgroundColor: `${S.containerHigh}80`, borderLeft: `2px solid ${S.outlineVariant}` }}>
                      <p className="text-xs mb-1" style={{ color: S.outline }}>이전</p>
                      <p className="text-sm">{card.before}</p>
                    </div>
                    <div className="p-4 rounded-xl" style={{ backgroundColor: card.accentBg, borderLeft: `2px solid ${card.accentColor}` }}>
                      <p className="text-xs mb-1" style={{ color: card.accentColor }}>LabAxis 이후</p>
                      <p className="text-sm font-bold">{card.after}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            5. 조직 운영 관리 — Bento Grid (hierarchy 통일)
               - 4카드 모두 같은 surface family, border 통일
               - 큰 카드의 radial glow 제거, 작은 카드 contrast 강화
           ══════════════════════════════════════════════════════════════ */}
        <section className="py-28" style={{ backgroundColor: S.bg }}>
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col lg:flex-row items-start lg:items-end justify-between mb-16 gap-6">
              <div className="max-w-2xl">
                <h2 className="text-3xl md:text-4xl font-bold mb-4">조직 기준에 맞는 운영 관리</h2>
                <p className="text-lg" style={{ color: S.onSurfaceVariant }}>
                  연구실과 팀의 운영 기준에 맞춰 승인 기준, 활동 기록, 예산 기준과 운영 데이터를 한곳에서 정리합니다.
                </p>
              </div>
              <Link href="/intro#org-controls">
                <button className="px-5 py-2.5 rounded-lg text-sm font-bold transition-all hover:brightness-110 active:scale-95 flex items-center gap-2 flex-shrink-0" style={{ backgroundColor: S.containerHighest, color: S.primary, border: `1px solid ${S.outlineVariant}30` }}>
                  운영 기준 보기 <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 auto-rows-auto">
              {/* Row 1: 8 + 4 — 통일된 surface */}
              <div className="md:col-span-8 rounded-2xl p-8 md:p-10" style={{ backgroundColor: S.containerHigh, border: `1px solid ${S.outlineVariant}20` }}>
                <Shield className="h-8 w-8 mb-4" style={{ color: S.primary }} strokeWidth={1.5} />
                <h3 className="text-xl md:text-2xl font-bold mb-2">승인 기준과 권한 정리</h3>
                <p className="max-w-md" style={{ color: S.onSurfaceVariant }}>
                  조직 구조에 맞는 승인 기준과 역할별 권한을 정리해 요청과 발주 준비가 팀 운영 방식과 어긋나지 않게 맞춥니다.
                </p>
              </div>

              <div className="md:col-span-4 rounded-2xl p-8 md:p-10 flex flex-col justify-between" style={{ backgroundColor: S.containerHigh, border: `1px solid ${S.outlineVariant}20` }}>
                <div>
                  <History className="h-8 w-8 mb-4" style={{ color: S.secondary }} strokeWidth={1.5} />
                  <h3 className="text-xl font-bold mb-2">활동 기록</h3>
                  <p className="text-sm" style={{ color: S.onSurfaceVariant }}>
                    요청, 선택, 승인, 변경 이력을 남겨 팀 내 공유와 사후 확인에 필요한 기준을 유지합니다.
                  </p>
                </div>
                <div className="h-1 w-full rounded-full mt-6" style={{ background: `linear-gradient(to right, ${S.secondary}, transparent)` }} />
              </div>

              {/* Row 2: 4 + 8 */}
              <div className="md:col-span-4 rounded-2xl p-8 md:p-10 flex flex-col justify-between" style={{ backgroundColor: S.containerHigh, border: `1px solid ${S.outlineVariant}20` }}>
                <div>
                  <Wallet className="h-8 w-8 mb-4" style={{ color: S.tertiary }} strokeWidth={1.5} />
                  <h3 className="text-xl font-bold mb-2">예산 기준 연결</h3>
                  <p className="text-sm" style={{ color: S.onSurfaceVariant }}>
                    과제별 예산 기준과 구매 이력을 연결해 초과 사용 위험이나 기준 이탈 여부를 빠르게 확인합니다.
                  </p>
                </div>
                <div className="h-1 w-full rounded-full mt-6" style={{ background: `linear-gradient(to right, ${S.tertiary}, transparent)` }} />
              </div>

              <div className="md:col-span-8 rounded-2xl p-8 md:p-10" style={{ backgroundColor: S.containerHigh, border: `1px solid ${S.outlineVariant}20` }}>
                <BarChart3 className="h-8 w-8 mb-4" style={{ color: S.primary }} strokeWidth={1.5} />
                <h3 className="text-xl md:text-2xl font-bold mb-2">운영 데이터 가시화</h3>
                <p className="max-w-md" style={{ color: S.onSurfaceVariant }}>
                  품목별 구매 빈도, 공급사 비교, 입고 이후 재고 흐름을 함께 보며 다음 구매 판단에 필요한 근거를 쌓습니다.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            6. Final CTA — 재고 운영 mockup (공유 컴포넌트)
           ══════════════════════════════════════════════════════════════ */}
        <FinalCTASection />

      </div>
      <MainFooter />
    </MainLayout>
  );
}
