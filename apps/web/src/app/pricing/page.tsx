"use client";

import { useState } from "react";
import { MainHeader } from "@/app/_components/main-header";
import { MainFooter } from "@/app/_components/main-footer";
import { MainLayout } from "@/app/_components/main-layout";
import { CheckCircle2, ArrowRight, Minus } from "lucide-react";
import Link from "next/link";

/* ── Surface palette (shared with intro) ───────────────────────── */
/*
  signal color 역할:
  blue (#adc6ff / #4d8eff) → CTA fill, active/selected state ONLY
  emerald (#4edea3)        → capability, readiness, availability, check
  amber (#ffb95f)          → warning, tertiary accent
*/
const S = {
  bg: "#0c1324",
  containerLowest: "#070d1f",
  slatePlane: "#131a2e",
  slatePanel: "#1a2240",
  slateCard: "#1e2848",
  slateCardHigh: "#243050",
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
  onPrimaryContainer: "#00285d",
  secondary: "#4edea3",
  secondaryContainer: "#00a572",
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

        {/* ══ Hero — deep navy field ═════════════════════════════════ */}
        <section className="pt-32 pb-24 max-w-7xl mx-auto px-6 md:px-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" style={{
            background: "radial-gradient(circle at 50% 18%, rgba(78,222,163,0.12), transparent 32%), radial-gradient(circle at 50% 100%, rgba(78,222,163,0.05), transparent 40%)",
          }} />

          <div className="relative z-10 max-w-4xl mx-auto">
            {/* Pill — emerald capability signal */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[13px] mb-8" style={{ backgroundColor: S.slateCard, border: `1px solid ${S.outlineVariant}30`, color: S.onSurfaceVariant }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: S.secondary }} />
              운영 범위에 맞는 단계적 도입
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tighter mb-8 leading-[1.1]">
              우리 조직에 맞는 도입 구조
            </h1>

            <p className="text-lg md:text-xl max-w-3xl mx-auto mb-10 leading-relaxed" style={{ color: S.onSurfaceVariant }}>
              시약·장비 검색부터 비교·요청 생성, 발주 준비, 입고 반영, 재고 운영까지.<br className="hidden md:block" />
              현재 팀의 운영 범위에 맞는 플랜으로 시작하고 필요한 단계에 맞춰 확장할 수 있습니다.
            </p>

            {/* Toggle */}
            <div className="flex items-center justify-center gap-4 mb-10">
              <span className="font-medium" style={{ color: !annual ? S.onSurface : S.outline }}>월간</span>
              <button
                onClick={() => setAnnual(!annual)}
                className="w-14 h-7 rounded-full p-1 flex items-center relative transition-colors"
                style={{ backgroundColor: S.slateCardHigh, border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <div className="w-5 h-5 rounded-full transition-all" style={{
                  backgroundColor: S.secondary,
                  transform: annual ? "translateX(28px)" : "translateX(0)",
                }} />
              </button>
              <span className="font-medium" style={{ color: annual ? S.onSurface : S.outline }}>연간</span>
              {annual && (
                <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: "rgba(78,222,163,0.08)", color: S.secondary, border: "1px solid rgba(78,222,163,0.15)" }}>
                  연간 결제 10% 할인
                </span>
              )}
            </div>

            {/* Stage indicator — slightly lifted */}
            <div className="max-w-4xl mx-auto mb-14 rounded-2xl px-5 py-4" style={{
              backgroundColor: S.slateCard,
              border: `1px solid ${S.outlineVariant}20`,
            }}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-left text-sm">
                {[
                  { stage: "1단계", label: "검색·후보 정리" },
                  { stage: "2단계", label: "비교·요청 생성" },
                  { stage: "3단계", label: "발주 준비·입고 반영" },
                  { stage: "4단계", label: "재고 운영·권한·연동" },
                ].map((s) => (
                  <div key={s.stage} className="rounded-xl px-4 py-3" style={{ backgroundColor: S.slateCardHigh, border: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-[11px] mb-1" style={{ color: S.secondary }}>{s.stage}</p>
                    <p className="font-semibold">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Plan cards ─────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch text-left relative z-10">
            <PlanCard
              name="Starter"
              desc="개인 단위 검색과 기본 기록 시작"
              price="Free"
              period="/월"
              features={["시약·장비 검색과 기본 후보 저장", "기본 비교 기록", "기본 재고 등록"]}
              cta="시작하기"
            />
            <PlanCard
              name="Team"
              desc="팀 단위 공유와 비교·요청 연결 시작"
              price={fmt(Math.round(TEAM_MONTHLY * discount))}
              period="/월"
              features={["최대 5인 팀 공유", "비교 결과·요청 이력 공유", "입고·재고 상태 공동 확인"]}
              cta="무료 체험 시작"
            />
            <PlanCard
              name="Business"
              desc="요청, 발주 준비, 입고·재고까지 운영 연결"
              price={fmt(Math.round(BUSINESS_MONTHLY * discount))}
              period="/월"
              features={["운영형 비교·요청 생성 흐름", "발주 준비와 운영 이력 관리", "입고 반영 및 재고 운영", "예산·권한 기준 적용"]}
              cta="플랜 선택"
              featured
            />
            <PlanCard
              name="Enterprise"
              desc="조직 기준, 보안, 내부 시스템 연결까지 확장"
              price="별도 문의"
              features={["조직 보안 정책과 접근 기준 적용", "내부 시스템 맞춤 연동 지원", "다기관 운영과 전담 지원"]}
              cta="도입 상담"
            />
          </div>
        </section>

        {/* ══ Info banner ══════════════════════════════════════════════ */}
        <section className="max-w-7xl mx-auto px-6 md:px-8 mb-10">
          <div className="rounded-2xl px-5 py-4 text-sm" style={{
            backgroundColor: S.slateCard,
            border: `1px solid ${S.outlineVariant}20`,
            color: S.onSurfaceVariant,
          }}>
            도입 구조는 단순 저장 용량보다 <span className="font-semibold" style={{ color: S.onSurface }}>도입 범위</span> 기준으로 나뉩니다. 검색과 비교 중심으로 시작한 뒤, 요청·발주 준비·입고·재고 운영으로 확장할 수 있습니다.
          </div>
        </section>

        {/* ══ Comparison table — STATE MATRIX ═════════════════════════ */}
        <section className="max-w-7xl mx-auto px-6 md:px-8 mb-28" style={{ backgroundColor: S.slatePlane, marginTop: 0 }}>
          <div className="py-20 -mx-6 md:-mx-8 px-6 md:px-8" style={{ backgroundColor: S.slatePlane }}>
            <h2 className="text-3xl font-bold mb-12 text-center">도입 범위 비교</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-0 rounded-2xl overflow-hidden" style={{
                backgroundColor: S.slateCard,
                border: `1px solid ${S.outlineVariant}20`,
              }}>
                <thead>
                  <tr style={{ backgroundColor: S.slateCardHigh }}>
                    <th className="p-5 text-xs uppercase tracking-wider" style={{ color: S.outline }}>운영 항목</th>
                    <th className="p-5 text-center">Starter</th>
                    <th className="p-5 text-center">Team</th>
                    <th className="p-5 text-center" style={{ color: S.onSurface }}>Business</th>
                    <th className="p-5 text-center">Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {([
                    { feature: "검색·후보 정리", starter: "기본", team: "팀 공유", business: "check", enterprise: "check" },
                    { feature: "비교·선택안 정리", starter: "none", team: "기본", business: "check", enterprise: "check" },
                    { feature: "요청 생성·기록 공유", starter: "none", team: "초안·공유", business: "check", enterprise: "check" },
                    { feature: "발주 준비·운영 큐", starter: "none", team: "none", business: "check", enterprise: "check" },
                    { feature: "입고 반영·재고 운영", starter: "기본 등록", team: "상태 공유", business: "check", businessLabel: "운영 반영", enterprise: "check", enterpriseLabel: "조직 운영" },
                    { feature: "예산·권한 기준", starter: "none", team: "기본 권한", business: "check", businessLabel: "운영 기준", enterprise: "check", enterpriseLabel: "정책/감사" },
                    { feature: "외부 시스템 연결", starter: "none", team: "기본", business: "check", businessLabel: "확장", enterprise: "check", enterpriseLabel: "내부 연동" },
                  ] as TableRow[]).map((row, i) => (
                    <tr key={row.feature} style={{ backgroundColor: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                      <td className="p-5 font-medium">{row.feature}</td>
                      <td className="p-5 text-center"><CellValue value={row.starter} /></td>
                      <td className="p-5 text-center"><CellValue value={row.team} /></td>
                      <td className="p-5 text-center"><CellValue value={row.business} label={row.businessLabel} highlight /></td>
                      <td className="p-5 text-center"><CellValue value={row.enterprise} label={row.enterpriseLabel} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ══ Bottom CTA — 도입 설계 (slatePanel) ═════════════════════ */}
        <section className="max-w-7xl mx-auto px-6 md:px-8 pb-24">
          <div className="relative overflow-hidden rounded-3xl p-8 md:p-12" style={{
            backgroundColor: S.slatePanel,
            border: `1px solid ${S.outlineVariant}20`,
          }}>
            <div className="absolute inset-0 opacity-8 pointer-events-none" style={{ background: "radial-gradient(circle at 50% 35%, rgba(78,222,163,0.1) 0%, transparent 70%)" }} />

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              <div className="text-left">
                <p className="text-sm font-semibold tracking-wide mb-4" style={{ color: S.secondary }}>도입 설계</p>
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 leading-tight">
                  조직 운영에 맞는<br />도입 범위를 함께 설계합니다.
                </h2>
                <p className="text-lg mb-8 max-w-2xl leading-relaxed" style={{ color: S.onSurfaceVariant }}>
                  검색·비교 중심으로 먼저 시작하고, 이후 요청·발주 준비·입고·재고 운영까지 확장할 수 있습니다. 현재 팀 구조와 운영 기준에 맞는 범위부터 함께 정리해드립니다.
                </p>
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                  <Link href="/support">
                    <button className="px-8 py-4 rounded-xl font-bold text-lg transition-all hover:brightness-110 active:scale-95" style={{ backgroundColor: S.primary, color: S.onPrimary }}>
                      도입 상담 신청
                    </button>
                  </Link>
                  <Link href="/pricing">
                    <button className="font-bold flex items-center gap-2 transition-colors hover:opacity-80" style={{ color: S.onSurface }}>
                      요금표 검토하기 <ArrowRight className="h-4 w-4" />
                    </button>
                  </Link>
                </div>
              </div>

              <div className="rounded-2xl p-5 md:p-6" style={{ backgroundColor: S.slateCard, border: `1px solid ${S.outlineVariant}18`, boxShadow: "0 22px 48px rgba(0,0,0,0.2)" }}>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-xs mb-1" style={{ color: S.onSurfaceVariant }}>추천 도입 흐름</p>
                    <h3 className="text-xl font-bold">Team → Business 확장</h3>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: "rgba(78,222,163,0.08)", color: S.secondary, border: "1px solid rgba(78,222,163,0.15)" }}>운영 기준</span>
                </div>
                <div className="flex flex-col gap-3 text-sm">
                  {[
                    { stage: "현재", label: "검색·비교·요청 공유 중심" },
                    { stage: "다음 단계에서 필요한 범위", label: "발주 준비 · 입고 반영 · 재고 운영 연결" },
                    { stage: "내부 시스템 연결이 필요한 경우", label: "조직 보안 기준 · 내부 시스템 연동 · 멀티 사이트 운영" },
                  ].map((s) => (
                    <div key={s.stage} className="rounded-xl px-4 py-3" style={{ backgroundColor: S.slateCardHigh, border: "1px solid rgba(255,255,255,0.06)" }}>
                      <p className="text-[11px] mb-1" style={{ color: S.secondary }}>{s.stage}</p>
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

/* ── Table row type ──────────────────────────────────────────────── */
type TableRow = {
  feature: string;
  starter: string;
  team: string;
  business: string;
  businessLabel?: string;
  enterprise: string;
  enterpriseLabel?: string;
};

/* ── Cell Value Component — state matrix rendering ───────────── */
function CellValue({ value, label, highlight }: { value: string; label?: string; highlight?: boolean }) {
  if (value === "none") {
    return <Minus className="h-4 w-4 mx-auto" style={{ color: S.outlineVariant }} />;
  }
  if (value === "check") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <CheckCircle2 className="h-[18px] w-[18px] flex-shrink-0" style={{ color: S.secondary }} />
        {label && <span className={`text-sm ${highlight ? "font-semibold" : ""}`} style={{ color: highlight ? S.onSurface : S.onSurfaceVariant }}>{label}</span>}
      </span>
    );
  }
  return <span className="text-sm" style={{ color: S.outline }}>{value}</span>;
}

/* ── Plan Card Component ──────────────────────────────────────── */
function PlanCard({
  name, desc, price, period, features, cta, featured,
}: {
  name: string;
  desc: string;
  price: string;
  period?: string;
  features: string[];
  cta: string;
  featured?: boolean;
}) {
  return (
    <div
      className={`p-8 rounded-2xl flex flex-col transition-all relative ${featured ? "scale-[1.02] z-10" : "hover:translate-y-[-4px]"}`}
      style={{
        backgroundColor: S.slateCard,
        border: featured ? "1px solid rgba(78,222,163,0.25)" : `1px solid ${S.outlineVariant}20`,
        boxShadow: featured ? "0 20px 48px rgba(0,0,0,0.25)" : "0 12px 32px rgba(0,0,0,0.15)",
      }}
    >
      {/* Top edge highlight for featured */}
      {featured && (
        <>
          <div className="absolute inset-x-[14px] top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(78,222,163,0.4), transparent)", opacity: 0.9 }} />
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.18em]" style={{ backgroundColor: S.secondaryContainer, color: S.onSurface }}>
            가장 많이 선택
          </div>
        </>
      )}

      <div className="mb-8">
        <h3 className="text-xl font-bold mb-2" style={{ color: featured ? S.secondary : S.onSurface }}>{name}</h3>
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
          featured
            ? { backgroundColor: S.primary, color: S.onPrimary, boxShadow: "0 8px 24px rgba(77,142,255,0.15)" }
            : { border: `1px solid ${S.outlineVariant}40`, color: S.onSurface, backgroundColor: S.slateCardHigh }
        }
      >
        {cta}
      </button>
    </div>
  );
}
