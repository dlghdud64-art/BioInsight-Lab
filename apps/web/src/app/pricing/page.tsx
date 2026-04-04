"use client";

import { useState } from "react";
import { MainHeader } from "@/app/_components/main-header";
import { MainFooter } from "@/app/_components/main-footer";
import { MainLayout } from "@/app/_components/main-layout";
import { CheckCircle2, ArrowRight } from "lucide-react";
import Link from "next/link";

/* ── Surface colors (shared with intro) ──────────────────────── */
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
  onPrimaryContainer: "#00285d",
  secondary: "#4edea3",
  tertiary: "#ffb95f",
} as const;

const TEAM_MONTHLY = 129_000;
const BUSINESS_MONTHLY = 349_000;

function fmt(n: number) {
  return `₩${n.toLocaleString("ko-KR")}`;
}

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const discount = annual ? 0.9 : 1;

  return (
    <MainLayout>
      <MainHeader />
      <div className="w-full" style={{ backgroundColor: S.bg, color: S.onSurface }}>

        {/* ══ Hero ═════════════════════════════════════════════════════ */}
        <section className="pt-32 pb-24 max-w-7xl mx-auto px-6 md:px-8 text-center relative overflow-hidden">
          {/* Radial glow */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: "radial-gradient(circle at 50% 18%, rgba(77,142,255,0.22), transparent 32%), radial-gradient(circle at 50% 100%, rgba(77,142,255,0.08), transparent 40%)",
          }} />

          <div className="relative z-10 max-w-4xl mx-auto">
            {/* Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[13px] mb-8" style={{ backgroundColor: S.containerLow, border: `1px solid ${S.outlineVariant}40`, color: S.onSurfaceVariant }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: S.secondary }} />
              운영 범위에 맞는 단계적 도입
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tighter mb-8 leading-[1.1]" style={{
              background: "linear-gradient(135deg, #d8e2ff 0%, #94b9ff 42%, #4d8eff 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              우리 조직에 맞는 도입 구조
            </h1>

            <p className="text-lg md:text-xl max-w-3xl mx-auto mb-10 leading-relaxed" style={{ color: S.onSurfaceVariant }}>
              시약·장비 검색부터 비교·요청 생성, 발주 준비, 입고 반영, 재고 운영까지.<br className="hidden md:block" />
              현재 팀의 운영 범위에 맞는 플랜으로 시작하고 필요한 단계에 맞춰 확장할 수 있습니다.
            </p>

            {/* Toggle */}
            <div className="flex items-center justify-center gap-4 mb-10">
              <span className="font-medium" style={{ color: !annual ? S.onSurface : S.onSurfaceVariant }}>월간</span>
              <button
                onClick={() => setAnnual(!annual)}
                className="w-14 h-7 rounded-full p-1 flex items-center relative transition-colors"
                style={{ backgroundColor: S.containerHighest, border: "1px solid rgba(255,255,255,0.05)" }}
              >
                <div className="w-5 h-5 rounded-full transition-all" style={{
                  backgroundColor: S.primary,
                  transform: annual ? "translateX(28px)" : "translateX(0)",
                }} />
              </button>
              <span className="font-medium" style={{ color: annual ? S.onSurface : S.onSurfaceVariant }}>연간</span>
              {annual && (
                <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: "rgba(78,222,163,0.1)", color: S.secondary, border: "1px solid rgba(78,222,163,0.2)" }}>
                  연간 결제 10% 할인
                </span>
              )}
            </div>

            {/* Stage indicator */}
            <div className="max-w-4xl mx-auto mb-14 rounded-2xl px-5 py-4" style={{
              background: "rgba(25,31,49,0.76)",
              backdropFilter: "blur(18px)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-left text-sm">
                {[
                  { stage: "1단계", label: "검색·후보 정리" },
                  { stage: "2단계", label: "비교·요청 생성" },
                  { stage: "3단계", label: "발주 준비·입고 반영" },
                  { stage: "4단계", label: "재고 운영·권한·연동" },
                ].map((s) => (
                  <div key={s.stage} className="rounded-xl px-4 py-3" style={{ backgroundColor: `${S.containerLowest}B3`, border: "1px solid rgba(255,255,255,0.05)" }}>
                    <p className="text-[11px] mb-1" style={{ color: S.outline }}>{s.stage}</p>
                    <p className="font-semibold">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Plan cards ─────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch text-left relative z-10">
            {/* Starter */}
            <PlanCard
              name="Starter"
              desc="개인 단위 검색과 기본 기록 시작"
              price="Free"
              period="/월"
              features={["시약·장비 검색과 기본 후보 저장", "기본 비교 기록", "기본 재고 등록"]}
              cta="시작하기"
              ctaStyle="outline"
            />

            {/* Team */}
            <PlanCard
              name="Team"
              desc="팀 단위 공유와 비교·요청 연결 시작"
              price={fmt(Math.round(TEAM_MONTHLY * discount))}
              period="/월"
              features={["최대 5인 팀 공유", "비교 결과·요청 이력 공유", "입고·재고 상태 공동 확인"]}
              cta="무료 체험 시작"
              ctaStyle="outline"
            />

            {/* Business — featured */}
            <PlanCard
              name="Business"
              desc="요청, 발주 준비, 입고·재고까지 운영 연결"
              price={fmt(Math.round(BUSINESS_MONTHLY * discount))}
              period="/월"
              features={["운영형 비교·요청 생성 흐름", "발주 준비와 운영 이력 관리", "입고 반영 및 재고 운영", "예산·권한 기준 적용"]}
              cta="플랜 선택"
              ctaStyle="primary"
              featured
            />

            {/* Enterprise */}
            <PlanCard
              name="Enterprise"
              desc="조직 기준, 보안, 내부 시스템 연결까지 확장"
              price="별도 문의"
              features={["조직 보안 정책과 접근 기준 적용", "내부 시스템 맞춤 연동 지원", "다기관 운영과 전담 지원"]}
              cta="도입 상담"
              ctaStyle="primaryOutline"
            />
          </div>
        </section>

        {/* ══ Info banner ══════════════════════════════════════════════ */}
        <section className="max-w-7xl mx-auto px-6 md:px-8 mb-10">
          <div className="rounded-2xl px-5 py-4 text-sm" style={{
            background: "rgba(25,31,49,0.76)",
            backdropFilter: "blur(18px)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: S.onSurfaceVariant,
          }}>
            도입 구조는 단순 저장 용량보다 <span className="font-semibold" style={{ color: S.onSurface }}>도입 범위</span> 기준으로 나뉩니다. 검색과 비교 중심으로 시작한 뒤, 요청·발주 준비·입고·재고 운영으로 확장할 수 있습니다.
          </div>
        </section>

        {/* ══ Comparison table ═════════════════════════════════════════ */}
        <section className="max-w-7xl mx-auto px-6 md:px-8 mb-28">
          <h2 className="text-3xl font-bold mb-12 text-center">도입 범위 비교</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-0 rounded-2xl overflow-hidden" style={{
              background: "rgba(25,31,49,0.76)",
              backdropFilter: "blur(18px)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}>
              <thead>
                <tr style={{ backgroundColor: S.containerHigh }}>
                  <th className="p-6 text-xs uppercase tracking-wider" style={{ color: S.onSurfaceVariant }}>운영 항목</th>
                  <th className="p-6">Starter</th>
                  <th className="p-6">Team</th>
                  <th className="p-6" style={{ color: S.primary }}>Business</th>
                  <th className="p-6">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: "검색·후보 정리", starter: "기본", team: "팀 공유 가능", business: "조직 공용", enterprise: "멀티 조직/사이트", odd: false },
                  { feature: "비교·선택안 정리", starter: "—", team: "기본 비교", business: "운영형 비교 흐름", enterprise: "조직 기준 반영", odd: true },
                  { feature: "요청 생성·기록 공유", starter: "—", team: "요청 초안/공유", business: "운영형 요청 관리", enterprise: "조직 기준 연동", odd: false },
                  { feature: "발주 준비·운영 큐", starter: "—", team: "—", business: "포함", enterprise: "포함", odd: true },
                  { feature: "입고 반영·재고 운영", starter: "기본 재고 등록", team: "상태 공유", business: "운영 반영", enterprise: "조직 단위 운영", odd: false },
                  { feature: "예산·권한 기준", starter: "—", team: "기본 권한", business: "운영 기준 적용", enterprise: "고급 정책/감사", odd: true },
                  { feature: "외부 시스템 연결", starter: "—", team: "기본 연결", business: "확장 연결", enterprise: "내부 시스템 맞춤 연동", odd: false },
                ].map((row) => (
                  <tr key={row.feature} className="transition-colors hover:brightness-110" style={{ backgroundColor: row.odd ? S.containerLowest : "transparent", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                    <td className="p-6 font-medium">{row.feature}</td>
                    <td className="p-6" style={{ color: S.onSurfaceVariant }}>{row.starter}</td>
                    <td className="p-6" style={{ color: S.onSurfaceVariant }}>{row.team}</td>
                    <td className="p-6 font-bold" style={{ color: row.business === "✓" ? S.secondary : S.primary }}>{row.business}</td>
                    <td className="p-6" style={{ color: row.enterprise === "✓" ? S.secondary : S.onSurfaceVariant }}>{row.enterprise}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ══ Bottom CTA — 도입 설계 ══════════════════════════════════ */}
        <section className="max-w-7xl mx-auto px-6 md:px-8 pb-24">
          <div className="relative overflow-hidden rounded-3xl p-8 md:p-12" style={{
            background: "rgba(25,31,49,0.76)",
            backdropFilter: "blur(18px)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}>
            {/* Glow */}
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ background: "radial-gradient(circle at 50% 35%, #4d8eff 0%, transparent 70%)" }} />

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              {/* Left copy */}
              <div className="text-left">
                <p className="text-sm font-semibold tracking-wide mb-4" style={{ color: S.primary }}>도입 설계</p>
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 leading-tight">
                  조직 운영에 맞는<br />도입 범위를 함께 설계합니다.
                </h2>
                <p className="text-lg mb-8 max-w-2xl leading-relaxed" style={{ color: S.onSurfaceVariant }}>
                  검색·비교 중심으로 먼저 시작하고, 이후 요청·발주 준비·입고·재고 운영까지 확장할 수 있습니다. 현재 팀 구조와 운영 기준에 맞는 범위부터 함께 정리해드립니다.
                </p>
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                  <Link href="/support">
                    <button className="px-8 py-4 rounded-xl font-bold text-lg transition-all hover:brightness-110 active:scale-95" style={{ backgroundColor: S.primaryContainer, color: S.onPrimaryContainer }}>
                      도입 상담 신청
                    </button>
                  </Link>
                  <button className="font-bold flex items-center gap-2 transition-colors hover:opacity-80" style={{ color: S.onSurface }}>
                    요금표 검토하기 <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Right panel */}
              <div className="rounded-2xl p-5 md:p-6 shadow-2xl" style={{ backgroundColor: S.containerLow, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 25px 50px rgba(0,30,80,0.2)" }}>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-xs mb-1" style={{ color: S.onSurfaceVariant }}>추천 도입 흐름</p>
                    <h3 className="text-xl font-bold">Team → Business 확장</h3>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: "rgba(78,222,163,0.1)", color: S.secondary, border: "1px solid rgba(78,222,163,0.2)" }}>운영 기준</span>
                </div>
                <div className="flex flex-col gap-3 text-sm">
                  {[
                    { stage: "현재", label: "검색·비교·요청 공유 중심" },
                    { stage: "다음 단계에서 필요한 범위", label: "발주 준비 · 입고 반영 · 재고 운영 연결" },
                    { stage: "내부 시스템 연결이 필요한 경우", label: "조직 보안 기준 · 내부 시스템 연동 · 멀티 사이트 운영" },
                  ].map((s) => (
                    <div key={s.stage} className="rounded-xl px-4 py-3" style={{ backgroundColor: `${S.containerLowest}B3`, border: "1px solid rgba(255,255,255,0.05)" }}>
                      <p className="text-[11px] mb-1" style={{ color: S.outline }}>{s.stage}</p>
                      <p className="font-semibold">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

      </div>
      <MainFooter />
    </MainLayout>
  );
}

/* ── Plan Card Component ──────────────────────────────────────── */
function PlanCard({
  name, desc, price, period, features, cta, ctaStyle, featured,
}: {
  name: string;
  desc: string;
  price: string;
  period?: string;
  features: string[];
  cta: string;
  ctaStyle: "outline" | "primary" | "primaryOutline";
  featured?: boolean;
}) {
  return (
    <div
      className={`p-8 rounded-2xl flex flex-col transition-all relative ${featured ? "scale-[1.02] z-10" : "hover:translate-y-[-4px]"}`}
      style={{
        backgroundColor: featured ? "rgba(25,31,49,0.76)" : S.containerLow,
        backdropFilter: featured ? "blur(18px)" : undefined,
        border: featured ? `1px solid rgba(173,198,255,0.25)` : "1px solid rgba(255,255,255,0.05)",
        boxShadow: featured ? "0 24px 60px -28px rgba(39,108,233,0.55)" : undefined,
      }}
    >
      {/* Top edge highlight for featured */}
      {featured && (
        <>
          <div className="absolute inset-x-[14px] top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(173,198,255,0.55), transparent)", opacity: 0.9 }} />
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.18em]" style={{ backgroundColor: S.primaryContainer, color: S.onPrimaryContainer }}>
            가장 많이 선택
          </div>
        </>
      )}

      <div className="mb-8">
        <h3 className="text-xl font-bold mb-2" style={{ color: featured ? S.primary : S.onSurface }}>{name}</h3>
        <p className="text-sm h-12" style={{ color: S.onSurfaceVariant }}>{desc}</p>
      </div>

      <div className="mb-7">
        <span className="text-4xl font-bold">{price}</span>
        {period && <span className="text-sm" style={{ color: S.onSurfaceVariant }}>{period}</span>}
      </div>

      <ul className="flex flex-col gap-4 mb-12 flex-grow text-sm">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <CheckCircle2 className="h-[18px] w-[18px] mt-0.5 flex-shrink-0" style={{ color: S.secondary }} />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <button
        className="w-full py-4 rounded-xl font-bold transition-all active:scale-[0.98]"
        style={
          ctaStyle === "primary"
            ? { backgroundColor: S.primaryContainer, color: S.onPrimaryContainer, boxShadow: "0 8px 24px rgba(77,142,255,0.15)" }
            : ctaStyle === "primaryOutline"
            ? { border: `1px solid ${S.primary}`, color: S.primary, backgroundColor: "transparent" }
            : { border: `1px solid ${S.outlineVariant}`, color: S.onSurface, backgroundColor: "transparent" }
        }
      >
        {cta}
      </button>
    </div>
  );
}
