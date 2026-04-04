import { MainLayout } from "../_components/main-layout";
import { MainHeader } from "../_components/main-header";
import { MainFooter } from "../_components/main-footer";
import {
  Search, GitCompare, FileText, ShoppingCart, ClipboardCheck, Warehouse,
  ArrowRight, Shield, Wallet, History,
  BarChart3, Microscope, Users,
} from "lucide-react";
import Link from "next/link";

/* ── Surface palette ───────────────────────────────────────────── */
/*
  명도 위계:
  hero/footer     → deep navy (bg)
  lifted sections → slatePlane / slatePanel (blue-gray lifted)
  cards           → slateCard / slateCardHigh (panel 위의 카드)
  text            → onSurface / onSurfaceVariant / outline

  signal color 역할:
  blue (#adc6ff / #4d8eff) → CTA fill, active/selected state ONLY
  emerald (#4edea3)        → capability, readiness, availability, check
  amber (#ffb95f)          → warning, tertiary accent
*/
const S = {
  /* deep navy base */
  bg: "#0c1324",
  containerLowest: "#070d1f",
  /* lifted blue-gray planes — hero 아래 section base */
  slatePlane: "#131a2e",       /* section bg — navy보다 한 단계 밝은 slate */
  slatePanel: "#1a2240",       /* panel bg — plane 위의 lifted surface */
  slateCard: "#1e2848",        /* card bg — panel 위의 카드 */
  slateCardHigh: "#243050",    /* emphasized card bg */
  /* existing M3 tokens (fallback) */
  containerLow: "#151b2d",
  container: "#191f31",
  containerHigh: "#23293c",
  containerHighest: "#2e3447",
  bright: "#33394c",
  /* text */
  onSurface: "#dce1fb",
  onSurfaceVariant: "#c2c6d6",
  outline: "#8c909f",
  outlineVariant: "#424754",
  /* signal: action */
  primary: "#adc6ff",
  primaryContainer: "#4d8eff",
  onPrimary: "#002e6a",
  onPrimaryContainer: "#00285d",
  /* signal: capability/readiness */
  secondary: "#4edea3",
  secondaryContainer: "#00a572",
  onSecondaryContainer: "#00311f",
  /* signal: tertiary */
  tertiary: "#ffb95f",
  tertiaryContainer: "#ca8100",
  onTertiaryContainer: "#3e2400",
} as const;

export default function IntroPage() {
  return (
    <MainLayout>
      <MainHeader />
      <div className="w-full" style={{ backgroundColor: S.bg, color: S.onSurface }}>

        {/* ══════════════════════════════════════════════════════════════
            1. Hero — deep navy field (메인 랜딩과 동일 깊이)
           ══════════════════════════════════════════════════════════════ */}
        <section className="relative min-h-[760px] flex items-center justify-center overflow-hidden px-6">
          <div className="absolute inset-0 z-0 pointer-events-none">
            <div className="absolute inset-0" style={{ background: "radial-gradient(circle at center, rgba(39,95,208,0.14) 0%, rgba(12,19,36,0) 68%)" }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full blur-[140px]" style={{ backgroundColor: "rgba(77,142,255,0.04)" }} />
            <div className="absolute top-24 right-[-120px] w-[360px] h-[360px] rounded-full blur-[110px]" style={{ backgroundColor: "rgba(78,222,163,0.04)" }} />
          </div>

          <div className="relative z-10 max-w-5xl text-center">
            {/* Pill badge — emerald dot = capability signal */}
            <div className="inline-flex items-center px-3 py-1 mb-8 rounded-full text-sm font-medium tracking-wide" style={{ backgroundColor: S.containerHighest, border: `1px solid ${S.outlineVariant}30`, color: S.onSurfaceVariant }}>
              <span className="w-2 h-2 rounded-full mr-2 animate-pulse" style={{ backgroundColor: S.secondary }} />
              연구 구매 운영을 위한 새로운 기준
            </div>

            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-[1.08]" style={{ color: S.onSurface }}>
              시약·장비 검색부터<br />
              구매 운영까지 <span style={{ color: S.primary }}>한 곳에서</span>
            </h1>

            <p className="text-xl md:text-2xl max-w-3xl mx-auto mb-12 leading-relaxed" style={{ color: S.onSurfaceVariant }}>
              시약·장비 검색, 후보 정리, 비교·선택, 요청 생성, 발주 준비까지<br className="hidden md:block" />
              분리된 구매 작업을 한 화면 흐름으로 정리합니다.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
              <Link href="/search">
                <button className="w-full sm:w-auto px-8 py-4 text-lg font-bold rounded-xl shadow-lg transition-all hover:shadow-xl active:scale-95" style={{ backgroundColor: S.primary, color: S.onPrimary, boxShadow: "0 8px 32px rgba(77,142,255,0.18)" }}>
                  제품 시작하기
                </button>
              </Link>
              <Link href="/support">
                <button className="w-full sm:w-auto px-8 py-4 text-lg font-bold rounded-xl transition-all hover:brightness-110 active:scale-95" style={{ backgroundColor: S.containerHighest, color: S.onSurface, border: `1px solid ${S.outlineVariant}30` }}>
                  도입 문의
                </button>
              </Link>
            </div>

            {/* Operating cue 카드 패널 */}
            <div className="max-w-3xl mx-auto rounded-3xl overflow-hidden" style={{ backgroundColor: "rgba(26,34,64,0.82)", backdropFilter: "blur(18px)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 24px 80px rgba(12,25,52,0.55)" }}>
              <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                {[
                  { num: "01", title: "검색 → 후보 정리", desc: "같은 화면에서 다음 비교 단계로 연결" },
                  { num: "02", title: "비교·선택 → 요청 생성", desc: "선택안 기준과 결정 기록을 이어서 유지", active: true },
                  { num: "03", title: "발주 준비 → 입고·재고 연결", desc: "운영 상태가 다음 반영 단계로 끊기지 않음" },
                ].map((cue) => (
                  <div key={cue.num} className="px-5 py-4 text-left" style={{ backgroundColor: cue.active ? "rgba(78,222,163,0.03)" : "transparent" }}>
                    <div className="text-[11px] uppercase tracking-[0.18em] mb-2" style={{ color: S.secondary }}>운영 cue {cue.num}</div>
                    <div className="text-sm font-semibold" style={{ color: S.onSurface }}>{cue.title}</div>
                    <div className="mt-1 text-xs" style={{ color: S.onSurfaceVariant }}>{cue.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            2. 연결 포인트 — LIFTED SLATE PLANE (hero보다 밝은 blue-gray)
           ══════════════════════════════════════════════════════════════ */}
        <section className="py-24 relative overflow-hidden" style={{ backgroundColor: S.slatePlane }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at top, rgba(78,222,163,0.06), transparent 40%)" }} />
          <div className="max-w-7xl mx-auto px-6 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              {/* Left: copy */}
              <div>
                <h2 className="text-4xl font-bold mb-6 leading-tight">
                  연구와 구매 사이의<br /><span style={{ color: S.secondary }}>끊기는 흐름을 줄입니다</span>
                </h2>
                <p className="text-lg mb-12 leading-relaxed" style={{ color: S.onSurfaceVariant }}>
                  검색, 비교, 요청, 입고와 재고 기록이 분리될수록 같은 품목을 다시 찾고 같은 결정을 반복하게 됩니다. LabAxis는 반복 작업을 줄이고 구매 운영의 맥락을 이어서 볼 수 있게 정리합니다.
                </p>

                {/* 3 mini cards — emerald capability signal */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <div className="p-6 rounded-2xl" style={{ backgroundColor: S.slateCardHigh, border: "1px solid rgba(78,222,163,0.15)", boxShadow: "0 16px 48px rgba(0,0,0,0.22)" }}>
                    <p className="text-sm mb-2 font-medium" style={{ color: S.secondary }}>검색 반복 감소</p>
                    <p className="text-2xl font-bold leading-tight" style={{ color: S.onSurface }}>후보 정리까지<br />연결</p>
                  </div>
                  <div className="p-6 rounded-2xl" style={{ backgroundColor: S.slateCard, border: `1px solid ${S.outlineVariant}20` }}>
                    <p className="text-sm mb-2" style={{ color: S.outline }}>비교 준비 단축</p>
                    <p className="text-2xl font-bold leading-tight" style={{ color: S.onSurface }}>선택안 검토로<br />이어짐</p>
                  </div>
                  <div className="p-6 rounded-2xl" style={{ backgroundColor: S.slateCard, border: `1px solid ${S.outlineVariant}20` }}>
                    <p className="text-sm mb-2" style={{ color: S.outline }}>입고 이후 추적</p>
                    <p className="text-2xl font-bold leading-tight" style={{ color: S.onSurface }}>재고 운영까지<br />유지</p>
                  </div>
                </div>
              </div>

              {/* Right: progress bar panel */}
              <div className="p-8 md:p-10 rounded-3xl" style={{ backgroundColor: S.slatePanel, border: `1px solid ${S.outlineVariant}25`, boxShadow: "0 22px 60px rgba(0,0,0,0.25)" }}>
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-bold">LabAxis 운영 연결 포인트</h3>
                  <span className="px-3 py-1 rounded-full text-xs font-bold tracking-wide" style={{ backgroundColor: "rgba(78,222,163,0.1)", color: S.secondary }}>연결됨</span>
                </div>

                <div className="flex flex-col gap-7">
                  {/* 1st — emerald (capability) */}
                  <div>
                    <div className="flex justify-between mb-2 gap-4">
                      <span className="font-medium" style={{ color: S.onSurface }}>검색 → 후보 정리</span>
                      <span className="font-bold whitespace-nowrap" style={{ color: S.secondary }}>한 화면 연결</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: S.slateCardHigh }}>
                      <div className="h-full rounded-full" style={{ width: "89%", backgroundColor: S.secondary }} />
                    </div>
                  </div>
                  {/* 2nd — emerald muted */}
                  <div>
                    <div className="flex justify-between mb-2 gap-4">
                      <span className="font-medium" style={{ color: S.onSurfaceVariant }}>비교 → 요청 생성</span>
                      <span className="font-bold whitespace-nowrap" style={{ color: "rgba(78,222,163,0.75)" }}>결정 기록 유지</span>
                    </div>
                    <div className="h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: S.slateCardHigh }}>
                      <div className="h-full rounded-full" style={{ width: "79%", backgroundColor: "rgba(78,222,163,0.7)" }} />
                    </div>
                  </div>
                  {/* 3rd — gradient emerald→muted */}
                  <div>
                    <div className="flex justify-between mb-2 gap-4">
                      <span className="font-medium" style={{ color: S.outline }}>입고 → 재고 반영</span>
                      <span className="font-bold whitespace-nowrap" style={{ color: "rgba(78,222,163,0.55)" }}>lot/기한 추적</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: S.slateCardHigh }}>
                      <div className="h-full rounded-full" style={{ width: "72%", background: "linear-gradient(to right, rgba(78,222,163,0.5), rgba(78,222,163,0.25))" }} />
                    </div>
                  </div>
                </div>

                <div className="mt-10 rounded-2xl p-4" style={{ backgroundColor: "rgba(78,222,163,0.04)", border: "1px solid rgba(78,222,163,0.12)" }}>
                  <div className="flex items-start gap-3">
                    <BarChart3 className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: S.secondary }} />
                    <p className="text-sm font-medium" style={{ color: S.onSurfaceVariant }}>
                      AI 보조 레이어가 후보 정리, 비교 준비, 요청 생성 전환을 돕고 작업 흐름을 끊기지 않게 이어줍니다.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            3. 6단계 운영 흐름 — slightly lighter slate plane
           ══════════════════════════════════════════════════════════════ */}
        <section className="py-28 overflow-hidden" style={{ backgroundColor: S.slatePanel }}>
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4 tracking-tight">하나로 연결된 연구 구매 운영 흐름</h2>
              <p className="max-w-2xl mx-auto text-lg" style={{ color: S.onSurfaceVariant }}>
                검색과 선택은 의사결정 흐름으로, 발주 준비 이후는 운영 반영 흐름으로 이어집니다.
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
              {/* Decision flow card */}
              <div className="rounded-3xl p-7" style={{ backgroundColor: S.slateCard, border: `1px solid ${S.outlineVariant}20`, boxShadow: "0 18px 48px rgba(0,0,0,0.2)" }}>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] mb-2" style={{ color: S.outline }}>decision flow</div>
                    <h3 className="text-2xl font-bold">앞단 의사결정 흐름</h3>
                  </div>
                  <span className="text-xs" style={{ color: S.onSurfaceVariant }}>검색 · 비교·선택 · 요청 생성</span>
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                  {[
                    { num: "01", icon: Search, title: "통합 검색", desc: "품목, 제조사, 카탈로그 기준 탐색" },
                    { num: "02", icon: GitCompare, title: "비교·선택", desc: "대체품, 가격, 조건 비교 정리" },
                    { num: "03", icon: FileText, title: "요청 생성", desc: "선택안 기준으로 요청안 작성" },
                  ].map((step) => (
                    <div key={step.num} className="rounded-2xl p-5" style={{ backgroundColor: S.slateCardHigh, border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div className="text-xs mb-3" style={{ color: S.outline }}>{step.num}</div>
                      <step.icon className="h-7 w-7 mb-3" style={{ color: S.onSurfaceVariant }} strokeWidth={1.5} />
                      <div className="font-bold mb-1">{step.title}</div>
                      <div className="text-xs" style={{ color: S.onSurfaceVariant }}>{step.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Operation flow card — emerald accent */}
              <div className="rounded-3xl p-7" style={{ backgroundColor: S.slateCard, border: "1px solid rgba(78,222,163,0.12)", boxShadow: "0 18px 48px rgba(0,0,0,0.2)" }}>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] mb-2" style={{ color: S.secondary }}>operation flow</div>
                    <h3 className="text-2xl font-bold">뒷단 운영 반영 흐름</h3>
                  </div>
                  <span className="text-xs" style={{ color: S.onSurfaceVariant }}>발주 준비 · 입고 반영 · 재고 운영</span>
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                  {[
                    { num: "04", icon: ShoppingCart, title: "발주 준비", desc: "전환 가능 상태와 검토 항목 확인" },
                    { num: "05", icon: ClipboardCheck, title: "입고 반영", desc: "수령 정보와 lot 기록 연결" },
                    { num: "06", icon: Warehouse, title: "재고 운영", desc: "부족, 만료, 재주문 판단 유지" },
                  ].map((step) => (
                    <div key={step.num} className="rounded-2xl p-5" style={{ backgroundColor: S.slateCardHigh, border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div className="text-xs mb-3" style={{ color: S.secondary }}>{step.num}</div>
                      <step.icon className="h-7 w-7 mb-3" style={{ color: S.secondary }} strokeWidth={1.5} />
                      <div className="font-bold mb-1">{step.title}</div>
                      <div className="text-xs" style={{ color: S.onSurfaceVariant }}>{step.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            4. 역할별 변화 — support plane (slatePlane보다 반 단계 밝음)
           ══════════════════════════════════════════════════════════════ */}
        <section className="py-24" style={{ backgroundColor: "#172038" }}>
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4">도입 후 달라지는 운영 흐름</h2>
              <p style={{ color: S.onSurfaceVariant }}>역할마다 반복 업무는 줄이고 다음 작업으로 이어지는 연결성은 강화합니다.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  role: "연구원",
                  roleBg: "rgba(78,222,163,0.15)",
                  roleTextColor: S.secondary,
                  accentColor: S.secondary,
                  accentBg: "rgba(78,222,163,0.04)",
                  cornerBg: "rgba(78,222,163,0.04)",
                  title: "후보 정리가 빨라집니다",
                  before: "여러 벤더를 따로 열고 품목을 수기로 모아 비교 준비",
                  after: "검색 결과에서 후보를 바로 정리하고 다음 비교 단계로 이동",
                },
                {
                  role: "구매 담당",
                  roleBg: "rgba(78,222,163,0.15)",
                  roleTextColor: S.secondary,
                  accentColor: S.secondary,
                  accentBg: "rgba(78,222,163,0.04)",
                  cornerBg: "rgba(78,222,163,0.04)",
                  title: "요청 준비가 연결됩니다",
                  before: "비교 결과를 다시 정리하고 전화·이메일로 요청 초안 수동 작성",
                  after: "선택안 기준으로 요청안을 만들고 발주 준비 상태까지 이어서 확인",
                },
                {
                  role: "운영 관리자",
                  roleBg: "rgba(255,185,95,0.15)",
                  roleTextColor: S.tertiary,
                  accentColor: S.tertiary,
                  accentBg: "rgba(255,185,95,0.04)",
                  cornerBg: "rgba(255,185,95,0.04)",
                  title: "구매 이력과 재고 상태를 함께 추적합니다",
                  before: "구매 이력, 입고 상태, 재고 공백을 각각 다른 문서에서 확인",
                  after: "선택 기록, 입고 반영, 재고 상태를 같은 흐름에서 추적하고 다음 조치까지 연결",
                },
              ].map((card) => (
                <div key={card.role} className="p-8 rounded-2xl relative overflow-hidden group" style={{ backgroundColor: S.slateCard, border: `1px solid ${S.outlineVariant}18` }}>
                  <div className="absolute top-0 right-0 w-32 h-32 rounded-bl-full transition-all" style={{ backgroundColor: card.cornerBg }} />

                  <span className="inline-block px-3 py-1 rounded-md text-xs font-bold mb-6 relative z-10" style={{ backgroundColor: card.roleBg, color: card.roleTextColor }}>
                    {card.role}
                  </span>
                  <h4 className="text-2xl font-bold mb-4 relative z-10 leading-snug">{card.title}</h4>

                  <div className="flex flex-col gap-4 relative z-10">
                    <div className="p-4 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.03)", borderLeft: `2px solid ${S.outlineVariant}` }}>
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
            5. 조직 운영 관리 — Bento Grid (slatePanel보다 반 단계 밝음)
           ══════════════════════════════════════════════════════════════ */}
        <section className="py-28" style={{ backgroundColor: "#1e274a" }}>
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col lg:flex-row items-start lg:items-end justify-between mb-14 gap-8">
              <div className="max-w-2xl">
                <h2 className="text-4xl font-bold mb-4">조직 기준에 맞는 운영 관리</h2>
                <p className="text-lg" style={{ color: S.onSurfaceVariant }}>
                  연구실과 팀의 운영 기준에 맞춰 승인 기준, 활동 기록, 예산 기준과 운영 데이터를 한곳에서 정리합니다. 구매 흐름을 막지 않으면서 필요한 통제와 추적을 유지합니다.
                </p>
              </div>
              <Link href="/intro#org-controls">
                <button className="inline-flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all hover:brightness-110 active:scale-95 flex-shrink-0" style={{ backgroundColor: S.slateCard, color: S.onSurface, border: `1px solid ${S.outlineVariant}25` }}>
                  운영 기준 보기 <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Row 1: 7 + 5 */}
              <div className="md:col-span-7 rounded-3xl p-8" style={{ backgroundColor: S.slateCard, border: `1px solid ${S.outlineVariant}18`, boxShadow: "0 18px 48px rgba(0,0,0,0.2)" }}>
                <Shield className="h-10 w-10 mb-4" style={{ color: S.secondary }} strokeWidth={1.5} />
                <h3 className="text-2xl font-bold mb-3">승인 기준과 권한 정리</h3>
                <p className="max-w-lg mb-6" style={{ color: S.onSurfaceVariant }}>
                  조직 구조에 맞는 승인 기준과 역할별 권한을 정리해 요청과 발주 준비가 팀 운영 방식과 어긋나지 않게 맞춥니다.
                </p>
                <div className="flex flex-wrap gap-3 text-xs">
                  <span className="px-3 py-2 rounded-full font-medium" style={{ backgroundColor: "rgba(78,222,163,0.08)", color: S.secondary, border: "1px solid rgba(78,222,163,0.15)" }}>승인 기준 유지</span>
                  <span className="px-3 py-2 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.04)", color: S.onSurfaceVariant, border: "1px solid rgba(255,255,255,0.06)" }}>역할별 권한 매핑</span>
                  <span className="px-3 py-2 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.04)", color: S.onSurfaceVariant, border: "1px solid rgba(255,255,255,0.06)" }}>발주 전환 전 확인</span>
                </div>
              </div>

              <div className="md:col-span-5 rounded-3xl p-8" style={{ backgroundColor: S.slateCard, border: "1px solid rgba(78,222,163,0.12)", boxShadow: "0 18px 48px rgba(0,0,0,0.2)" }}>
                <History className="h-10 w-10 mb-4" style={{ color: S.secondary }} strokeWidth={1.5} />
                <h3 className="text-2xl font-bold mb-3">활동 기록</h3>
                <p className="mb-6" style={{ color: S.onSurfaceVariant }}>
                  요청, 선택, 승인, 변경 이력을 남겨 팀 내 공유와 사후 확인에 필요한 기준을 유지합니다.
                </p>
                <div className="h-1 w-full rounded-full" style={{ background: `linear-gradient(to right, ${S.secondary}, rgba(78,222,163,0.3), transparent)` }} />
              </div>

              {/* Row 2: 4 + 8 */}
              <div className="md:col-span-4 rounded-3xl p-8" style={{ backgroundColor: S.slateCard, border: "1px solid rgba(255,185,95,0.12)", boxShadow: "0 18px 48px rgba(0,0,0,0.2)" }}>
                <Wallet className="h-10 w-10 mb-4" style={{ color: S.tertiary }} strokeWidth={1.5} />
                <h3 className="text-2xl font-bold mb-3">예산 기준 연결</h3>
                <p className="mb-6" style={{ color: S.onSurfaceVariant }}>
                  과제별 예산 기준과 구매 이력을 연결해 초과 사용 위험이나 기준 이탈 여부를 빠르게 확인합니다.
                </p>
                <div className="h-1 w-2/3 rounded-full" style={{ background: `linear-gradient(to right, ${S.tertiary}, transparent)` }} />
              </div>

              <div className="md:col-span-8 rounded-3xl p-8" style={{ backgroundColor: S.slateCard, border: `1px solid ${S.outlineVariant}18`, boxShadow: "0 18px 48px rgba(0,0,0,0.2)" }}>
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 h-full">
                  <div className="max-w-md">
                    <BarChart3 className="h-10 w-10 mb-4" style={{ color: S.secondary }} strokeWidth={1.5} />
                    <h3 className="text-2xl font-bold mb-3">운영 데이터 가시화</h3>
                    <p style={{ color: S.onSurfaceVariant }}>
                      품목별 구매 빈도, 공급사 비교, 입고 이후 재고 흐름을 함께 보며 다음 구매 판단에 필요한 근거를 쌓습니다.
                    </p>
                  </div>
                  <div className="flex-1 grid sm:grid-cols-3 gap-3 text-sm">
                    {[
                      { label: "빈도", value: "품목별 구매 빈도" },
                      { label: "비교", value: "공급사 조건 비교" },
                      { label: "운영", value: "입고 이후 재고 흐름" },
                    ].map((m) => (
                      <div key={m.label} className="rounded-2xl p-4" style={{ backgroundColor: S.slateCardHigh, border: "1px solid rgba(255,255,255,0.06)" }}>
                        <div className="text-xs mb-2" style={{ color: S.outline }}>{m.label}</div>
                        <div className="font-semibold" style={{ color: S.onSurface }}>{m.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            6. Final CTA — 입고 이후 운영 closure (deep navy로 돌아옴)
           ══════════════════════════════════════════════════════════════ */}
        <section className="py-24 relative overflow-hidden" style={{ backgroundColor: S.bg }}>
          <div className="absolute inset-0" style={{ background: "radial-gradient(circle at center, rgba(78,222,163,0.08), transparent 55%)" }} />
          <div className="relative z-10 max-w-7xl mx-auto px-6">
            <div className="max-w-4xl mx-auto rounded-[2rem] p-10 md:p-14 text-center" style={{ backgroundColor: "rgba(26,34,64,0.75)", backdropFilter: "blur(18px)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 24px 80px rgba(12,25,52,0.55)" }}>
              <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wide mb-6" style={{ backgroundColor: "rgba(78,222,163,0.08)", color: S.secondary }}>
                입고 이후 운영 closure
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">
                입고 이후 재고 운영까지<br />끊기지 않습니다.
              </h2>
              <p className="text-lg md:text-xl max-w-2xl mx-auto mb-10" style={{ color: S.onSurfaceVariant }}>
                입고 반영, lot·유효기간 추적, 부족 판단과 재주문 검토까지 같은 운영 흐름 안에서 이어집니다.
              </p>

              <div className="grid sm:grid-cols-3 gap-4 text-left mb-10">
                {[
                  { num: "01", text: "입고 정보와 재고 상태 연결" },
                  { num: "02", text: "lot·유효기간·위치 추적" },
                  { num: "03", text: "부족 판단과 재주문 검토 전환" },
                ].map((item) => (
                  <div key={item.num} className="rounded-2xl px-5 py-5" style={{ backgroundColor: S.slateCard, border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="text-xs mb-2" style={{ color: S.secondary }}>{item.num}</div>
                    <div className="font-semibold" style={{ color: S.onSurface }}>{item.text}</div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/pricing">
                  <button className="w-full sm:w-auto px-10 py-5 text-lg font-bold rounded-xl shadow-2xl transition-all hover:translate-y-[-2px] active:scale-95" style={{ backgroundColor: S.primary, color: S.onPrimary, boxShadow: "0 12px 40px rgba(77,142,255,0.2)" }}>
                    요금 &amp; 플랜 보기
                  </button>
                </Link>
                <Link href="/support">
                  <button className="w-full sm:w-auto px-10 py-5 text-lg font-bold rounded-xl transition-all hover:brightness-110 active:scale-95" style={{ backgroundColor: S.containerHighest, color: S.onSurface, border: `1px solid ${S.outlineVariant}` }}>
                    도입 상담 신청
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </section>

      </div>
      <MainFooter />
    </MainLayout>
  );
}
