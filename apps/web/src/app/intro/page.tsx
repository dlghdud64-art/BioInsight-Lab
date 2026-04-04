import { MainLayout } from "../_components/main-layout";
import { MainHeader } from "../_components/main-header";
import { MainFooter } from "../_components/main-footer";
import {
  Search, GitCompare, FileText, ShoppingCart, ClipboardCheck, Warehouse,
  ArrowRight, CheckCircle2, Shield, ScrollText, Wallet, History,
  BarChart3, Microscope, Users,
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
            1. Hero — 센터 정렬, 대형 타이포, glow 배경
           ══════════════════════════════════════════════════════════════ */}
        <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden px-6">
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

            <p className="text-lg md:text-2xl max-w-3xl mx-auto mb-12 leading-relaxed" style={{ color: S.onSurfaceVariant }}>
              시약·장비 검색, 후보 정리, 비교·선택, 요청 생성, 발주 준비까지<br className="hidden md:block" />
              분리된 구매 작업을 한 화면 흐름으로 정리합니다.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/search">
                <button className="w-full sm:w-auto px-8 py-4 text-lg font-bold rounded-xl shadow-lg transition-all hover:shadow-xl active:scale-95" style={{ backgroundColor: S.primary, color: S.onPrimary, boxShadow: `0 8px 32px rgba(77,142,255,0.2)` }}>
                  제품 시작하기
                </button>
              </Link>
              <Link href="/support">
                <button className="w-full sm:w-auto px-8 py-4 text-lg font-bold rounded-xl transition-all hover:brightness-110 active:scale-95" style={{ backgroundColor: S.containerHighest, color: S.primary, border: `1px solid ${S.outlineVariant}20` }}>
                  도입 문의
                </button>
              </Link>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            2. 연결 포인트 — 2col: 좌 텍스트 + 우 progress bar 패널
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {[
                    { label: "검색 반복 감소", value: "후보 정리까지 연결" },
                    { label: "비교 준비 단축", value: "선택안 검토로 이어짐" },
                    { label: "입고 이후 추적", value: "재고 운영까지 유지" },
                  ].map((m) => (
                    <div key={m.label} className="p-6 rounded-xl" style={{ backgroundColor: S.containerLow, border: `1px solid ${S.outlineVariant}15` }}>
                      <p className="text-sm mb-2" style={{ color: S.outline }}>{m.label}</p>
                      <p className="text-xl font-bold" style={{ color: S.onSurface }}>{m.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: progress bar panel */}
              <div className="p-8 md:p-12 rounded-3xl shadow-2xl" style={{ backgroundColor: S.containerHigh, border: `1px solid ${S.outlineVariant}20`, boxShadow: "0 25px 50px rgba(0,0,0,0.2)" }}>
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-bold">LabAxis 운영 연결 포인트</h3>
                  <span className="px-3 py-1 rounded-full text-xs font-bold tracking-wide" style={{ backgroundColor: "rgba(78,222,163,0.1)", color: S.secondary }}>연결됨</span>
                </div>

                <div className="flex flex-col gap-8">
                  {[
                    { label: "검색 → 후보 정리", result: "한 화면 연결", pct: 88 },
                    { label: "비교 → 요청 생성", result: "결정 기록 유지", pct: 82 },
                    { label: "입고 → 재고 반영", result: "lot/기한 추적", pct: 78 },
                  ].map((bar) => (
                    <div key={bar.label}>
                      <div className="flex justify-between mb-2 gap-4">
                        <span className="font-medium" style={{ color: S.onSurface }}>{bar.label}</span>
                        <span className="font-bold whitespace-nowrap" style={{ color: S.secondary }}>{bar.result}</span>
                      </div>
                      <div className="h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: S.containerHighest }}>
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${bar.pct}%`, backgroundColor: S.secondary }} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-12 flex items-center p-4 rounded-xl" style={{ backgroundColor: "rgba(77,142,255,0.05)", border: "1px solid rgba(77,142,255,0.15)" }}>
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
            3. 6단계 파이프라인 — 정사각 카드 + 연결선
           ══════════════════════════════════════════════════════════════ */}
        <section className="py-28 overflow-hidden" style={{ backgroundColor: S.bg }}>
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-20">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">하나로 연결된 연구 구매 운영 흐름</h2>
              <p className="max-w-2xl mx-auto text-lg" style={{ color: S.onSurfaceVariant }}>
                검색, 비교·선택, 요청 생성, 발주 준비, 입고 반영, 재고 운영이 한 맥락 안에서 이어집니다.
              </p>
            </div>

            <div className="relative">
              {/* Connecting line — desktop only */}
              <div className="absolute top-1/2 left-0 w-full h-px hidden lg:block" style={{ background: `linear-gradient(to right, transparent, rgba(77,142,255,0.3), transparent)` }} />

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 relative z-10">
                {[
                  { icon: Search, title: "통합 검색", desc: "품목, 제조사, 카탈로그 기준 탐색" },
                  { icon: GitCompare, title: "비교·선택", desc: "대체품, 가격, 조건 비교 정리" },
                  { icon: FileText, title: "요청 생성", desc: "선택안 기준으로 요청안 작성" },
                  { icon: ShoppingCart, title: "발주 준비", desc: "전환 가능 상태와 검토 항목 확인" },
                  { icon: ClipboardCheck, title: "입고 반영", desc: "수령 정보와 lot 기록 연결" },
                  { icon: Warehouse, title: "재고 운영", desc: "부족, 만료, 재주문 판단 유지" },
                ].map((step) => (
                  <div key={step.title} className="group">
                    <div className="aspect-square rounded-2xl flex flex-col items-center justify-center p-6 transition-all duration-500" style={{ backgroundColor: S.containerLow, border: `1px solid ${S.outlineVariant}10` }}>
                      <step.icon className="h-8 w-8 mb-4 transition-colors" style={{ color: S.primary }} strokeWidth={1.5} />
                      <h4 className="font-bold mb-1" style={{ color: S.onSurface }}>{step.title}</h4>
                      <p className="text-xs text-center" style={{ color: S.outline }}>{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            4. 역할별 변화 — 3col before/after
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
                  roleColor: S.primaryContainer,
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
                  roleColor: S.secondaryContainer,
                  roleBg: S.secondaryContainer,
                  roleTextColor: "#00311f",
                  accentColor: S.secondary,
                  accentBg: "rgba(78,222,163,0.05)",
                  cornerBg: "rgba(78,222,163,0.05)",
                  title: "요청 준비가 연결됩니다",
                  before: "비교 결과를 다시 정리하고 전화·이메일로 요청 초안 수동 작성",
                  after: "선택안 기준으로 요청안을 만들고 발주 준비 상태까지 이어서 확인",
                },
                {
                  icon: Users,
                  role: "운영 관리자",
                  roleColor: S.tertiaryContainer,
                  roleBg: S.tertiaryContainer,
                  roleTextColor: "#3e2400",
                  accentColor: S.tertiary,
                  accentBg: "rgba(255,185,95,0.05)",
                  cornerBg: "rgba(255,185,95,0.05)",
                  title: "기록과 상태를 함께 봅니다",
                  before: "구매 이력, 입고 상태, 재고 공백을 각각 다른 문서에서 확인",
                  after: "결정 이력, 입고 반영, 재고 운영 상태를 같은 흐름에서 추적",
                },
              ].map((card) => (
                <div key={card.role} className="p-8 rounded-2xl relative overflow-hidden group" style={{ backgroundColor: S.containerLowest, border: `1px solid ${S.outlineVariant}10` }}>
                  {/* Corner accent */}
                  <div className="absolute top-0 right-0 w-32 h-32 rounded-bl-full transition-all" style={{ backgroundColor: card.cornerBg }} />

                  <span className="inline-block px-3 py-1 rounded-md text-xs font-bold mb-6 relative z-10" style={{ backgroundColor: card.roleBg, color: card.roleTextColor }}>
                    {card.role}
                  </span>
                  <h4 className="text-2xl font-bold mb-4 relative z-10">{card.title}</h4>

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
            5. 조직 운영 관리 — Bento Grid
           ══════════════════════════════════════════════════════════════ */}
        <section className="py-28" style={{ backgroundColor: S.bg }}>
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col lg:flex-row items-end justify-between mb-16 gap-8">
              <div className="max-w-2xl">
                <h2 className="text-3xl md:text-4xl font-bold mb-4">조직 기준에 맞는 운영 관리</h2>
                <p className="text-lg" style={{ color: S.onSurfaceVariant }}>
                  연구실과 팀의 운영 기준에 맞춰 승인 기준, 활동 기록, 예산 기준과 운영 데이터를 한곳에서 정리합니다. 구매 흐름을 막지 않으면서 필요한 통제와 추적을 유지합니다.
                </p>
              </div>
              <Link href="/intro#org-controls" className="flex items-center gap-2 font-bold whitespace-nowrap" style={{ color: S.primary }}>
                <span>운영 기준 보기</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-auto">
              {/* Row 1: 8 + 4 */}
              <div className="md:col-span-8 rounded-3xl p-10 relative overflow-hidden group" style={{ backgroundColor: S.containerHigh }}>
                <div className="relative z-10">
                  <Shield className="h-10 w-10 mb-4" style={{ color: S.primary }} strokeWidth={1.5} />
                  <h3 className="text-2xl font-bold mb-2">승인 기준과 권한 정리</h3>
                  <p className="max-w-sm" style={{ color: S.onSurfaceVariant }}>
                    조직 구조에 맞는 승인 기준과 역할별 권한을 정리해 요청과 발주 준비가 팀 운영 방식과 어긋나지 않게 맞춥니다.
                  </p>
                </div>
              </div>

              <div className="md:col-span-4 rounded-3xl p-10 flex flex-col justify-between" style={{ backgroundColor: S.containerLowest, border: `1px solid ${S.outlineVariant}30` }}>
                <div>
                  <History className="h-10 w-10 mb-4" style={{ color: S.secondary }} strokeWidth={1.5} />
                  <h3 className="text-2xl font-bold mb-2">활동 기록</h3>
                  <p style={{ color: S.onSurfaceVariant }}>
                    요청, 선택, 승인, 변경 이력을 남겨 팀 내 공유와 사후 확인에 필요한 기준을 유지합니다.
                  </p>
                </div>
                <div className="h-1 w-full rounded-full mt-8" style={{ background: `linear-gradient(to right, ${S.secondary}, transparent)` }} />
              </div>

              {/* Row 2: 4 + 8 */}
              <div className="md:col-span-4 rounded-3xl p-10 flex flex-col justify-between" style={{ backgroundColor: S.containerLowest, border: `1px solid ${S.outlineVariant}30` }}>
                <div>
                  <Wallet className="h-10 w-10 mb-4" style={{ color: S.tertiary }} strokeWidth={1.5} />
                  <h3 className="text-2xl font-bold mb-2">예산 기준 연결</h3>
                  <p style={{ color: S.onSurfaceVariant }}>
                    과제별 예산 기준과 구매 이력을 연결해 초과 사용 위험이나 기준 이탈 여부를 빠르게 확인합니다.
                  </p>
                </div>
                <div className="h-1 w-full rounded-full mt-8" style={{ background: `linear-gradient(to right, ${S.tertiary}, transparent)` }} />
              </div>

              <div className="md:col-span-8 rounded-3xl p-10 relative overflow-hidden" style={{ background: `linear-gradient(to bottom right, ${S.containerHigh}, ${S.containerHighest})` }}>
                <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: `radial-gradient(circle at center, ${S.primary}, transparent)` }} />
                <div className="relative z-10">
                  <BarChart3 className="h-10 w-10 mb-4" style={{ color: S.primary }} strokeWidth={1.5} />
                  <h3 className="text-2xl font-bold mb-2">운영 데이터 가시화</h3>
                  <p className="max-w-lg" style={{ color: S.onSurfaceVariant }}>
                    품목별 구매 빈도, 공급사 비교, 입고 이후 재고 흐름을 함께 보며 다음 구매 판단에 필요한 근거를 쌓습니다.
                  </p>
                </div>
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
