"use client";

import { useCallback, useRef, useState } from "react";
import { MainHeader } from "@/app/_components/main-header";
import { MainFooter } from "@/app/_components/main-footer";
import { MainLayout } from "@/app/_components/main-layout";
import { CheckCircle2, ArrowRight, Minus, ChevronDown, Loader2, Users, FileText, Package } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { PLAN_INTENT_VALUES, type PlanIntent } from "@/lib/billing/plan-select";
import {
  PLAN_DESCRIPTOR,
  type PlanDescriptor,
} from "@/lib/billing/plan-descriptor";
// §pricing-assistant / §pricing-고도화 — AI 즉답 카드 + 상단 스크롤 진행바.
import { PricingAssistant } from "@/app/pricing/_components/pricing-assistant";
import { ScrollProgress } from "@/app/pricing/_components/scroll-progress";

/* ── Light palette — 인트로 editorial과 동일 톤 ───────────────── */
const P = {
  bg: "#FFFFFF",
  bgSoft: "#F0F4F8",
  bgMuted: "#E8EDF3",
  text1: "#0F172A",
  text2: "#334155",
  text3: "#64748B",
  text4: "#94A3B8",
  border: "#E2E8F0",
  blue: "#3B82F6",
  blueHover: "#2563EB",
  blueSoft: "#DBEAFE",
  blueText: "#1D4ED8",
  green: "#10B981",
  greenSoft: "#D1FAE5",
  greenText: "#065F46",
} as const;

/* Featured card — dark navy */
const D = {
  bg: "#0F172A",
  surface: "#1E293B",
  text1: "#F1F5F9",
  text2: "#94A3B8",
  border: "rgba(59,130,246,0.25)",
} as const;

/* §pricing-handoff D1 — 시안 네이비 히어로 토큰(딥 네이비 + accent glow). */
const H = {
  bg: "#0A1124",
  surface: "#0F1B34",
  glow: "rgba(59,130,246,0.22)",
  text1: "#F1F5F9",
  text2: "#AEB9D0",
  text3: "#6B7488",
  tagText: "#9DBBF5",
  tagBorder: "rgba(59,130,246,0.30)",
  toggleTrack: "#16284C",
} as const;

/* §11.201 — 가격 / 운영량 / Credit 매트릭스는 lib/billing/plan-descriptor.ts
   single source. Hard-coded TEAM_MONTHLY / BUSINESS_MONTHLY magic number 폐기. */

function fmt(n: number) {
  return `₩${n.toLocaleString("ko-KR")}`;
}

/** §pricing-prelaunch — 연간은 명시 월환산(priceAnnualMonthlyKrw, ×11/12 배수 폐기).
 *  Enterprise (null) 은 "Custom". 연간 가격은 "출시 후 적용"(토글 라벨). */
function formatPlanPrice(descriptor: PlanDescriptor, annual: boolean): {
  price: string;
  period: string;
} {
  const krw = annual ? descriptor.priceAnnualMonthlyKrw : descriptor.priceMonthlyKrw;
  if (krw === null) {
    return { price: "Custom", period: "" };
  }
  if (krw === 0) {
    return { price: "Free", period: "" };
  }
  return {
    price: fmt(krw),
    period: "/월",
  };
}

/** §pricing-handoff D2 (호영님 2026-06-28) — 시안 카드 상단 3 스탯배지(사용자 / 견적·구매 / 재고 품목).
 *  descriptor SSOT 파생. Enterprise(전 항목 null = 계약형) → 협의/계약/협의. */
function formatStatBadges(descriptor: PlanDescriptor): { label: string; value: string }[] {
  const ov = descriptor.operatingVolume;
  const isContract =
    descriptor.seatsRecommended === null &&
    ov.monthlyRfq === null &&
    ov.monthlyPo === null &&
    ov.inventoryItems === null;
  const seats = descriptor.seatsRecommended !== null ? `${descriptor.seatsRecommended}명` : "협의";
  const quote = isContract ? "계약" : ov.monthlyRfq === null ? "무제한" : `월 ${ov.monthlyRfq}건`;
  const items = ov.inventoryItems !== null ? ov.inventoryItems.toLocaleString("ko-KR") : "협의";
  return [
    { label: "사용자", value: seats },
    { label: "견적·구매", value: quote },
    { label: "재고 품목", value: items },
  ];
}

/* ── Scroll animation wrapper ──────────────────────────────────── */
function Reveal({ children, delay = 0, y = 30, className = "" }: {
  children: ReactNode; delay?: number; y?: number; className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ── FAQ data ─────────────────────────────────────────────────── */
const FAQ_DATA = [
  {
    q: "우리 조직에 맞는 플랜을 어떻게 선택하나요?",
    a: "현재 운영 범위를 기준으로 추천드립니다. 대부분의 연구실은 Team 또는 Business 플랜으로 시작합니다. 도입 상담을 통해 최적의 시작점을 함께 설계해드립니다.",
  },
  {
    q: "플랜을 업그레이드하거나 변경할 수 있나요?",
    a: "네, 운영 범위가 확장되면 언제든 플랜을 변경할 수 있습니다. 고객 지원팀에 문의해 주세요.",
  },
  {
    q: "바로 시작할 수 있나요?",
    a: "Starter 플랜은 가입 즉시 무료로 이용할 수 있습니다. Team·Business 플랜은 출시 준비 중이며, 출시 알림을 신청하시면 출시 시 가장 먼저 안내드립니다.",
  },
  {
    q: "Enterprise 도입은 어떤 절차로 진행되나요?",
    a: "도입 상담 → 운영 범위 설계 → 보안 검토 → 시스템 연동 → 파일럿 운영 순서로 진행됩니다. 전담 매니저가 전체 과정을 지원합니다.",
  },
];

/* §pricing-handoff D12/D13 — 도입 범위 비교 9행 (데스크탑/모바일 압축 표 공유 SoT). */
const COMPARISON_ROWS: TableRow[] = [
  // §pricing-handoff D16 — 도입 범위 비교 9행(데스크탑 표 + 모바일 카드 스택 공유 SoT, 4플랜+칩).
  { feature: "검색·후보 정리", starter: "기본", team: "팀 공유", business: "check", businessLabel: "조직 공용", enterprise: "check", enterpriseLabel: "멀티 조직" },
  { feature: "비교·선택안 정리", starter: "none", team: "기본", business: "check", businessLabel: "운영형 비교", enterprise: "check", enterpriseLabel: "조직 기준" },
  { feature: "요청 생성·기록 공유", starter: "none", team: "초안·공유", business: "check", businessLabel: "운영형 관리", enterprise: "check", enterpriseLabel: "조직 기준" },
  { feature: "구매 준비·운영 큐", starter: "none", team: "none", business: "check", enterprise: "check" },
  { feature: "입고 반영·재고 운영", starter: "기본 등록", team: "상태 공유", business: "check", businessLabel: "운영 반영", enterprise: "check", enterpriseLabel: "조직 운영" },
  { feature: "라벨 스캔 (월)", starter: "10회", team: "무제한", business: "무제한", enterprise: "무제한" },
  { feature: "LOT / GMP 추적", starter: "none", team: "none", business: "check", businessLabel: "GMP 추적", enterprise: "check", enterpriseLabel: "조직 정책" },
  { feature: "예산·권한 기준", starter: "none", team: "기본 권한", business: "check", businessLabel: "운영 기준", enterprise: "check", enterpriseLabel: "정책/감사" },
  { feature: "외부 시스템 연결", starter: "none", team: "기본", business: "check", businessLabel: "확장", enterprise: "check", enterpriseLabel: "내부 연동" },
];

/* §pricing-handoff D16 — 모바일 카드 스택용 플랜 메타(이름/좌석/값키/라벨키/Basic accent). */
const CMP_PLANS = [
  { name: "Free", seat: "1인", vKey: "starter", lKey: undefined, feat: false },
  { name: "Basic", seat: "3명", vKey: "team", lKey: undefined, feat: true },
  { name: "Pro", seat: "10명", vKey: "business", lKey: "businessLabel", feat: false },
  { name: "Enterprise", seat: "협의", vKey: "enterprise", lKey: "enterpriseLabel", feat: false },
] as const;


export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  // §pricing-prelaunch — 연간 가격은 명시 월환산(priceAnnualMonthlyKrw). 배수 계산 폐기.
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<PlanIntent | null>(null);
  const [selectError, setSelectError] = useState<string | null>(null);
  // §pricing-final §2 — 카드 클릭 선택형. 기본 선택 = Basic(team). navy 셸이 선택 카드로 이동.
  const [selectedPlan, setSelectedPlan] = useState<PlanIntent>("team");
  // §pricing-prelaunch P5 — 출시 알림 신청 리드폼(인라인). 결제수단 0, 이메일만.
  const [leadPlan, setLeadPlan] = useState<"team" | "business" | "">("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadStatus, setLeadStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [leadMsg, setLeadMsg] = useState("");
  const [leadCompany, setLeadCompany] = useState("");
  const [leadName, setLeadName] = useState("");

  // §pricing-handoff D9 (호영님 2026-06-28) — 모바일 캐러셀: 스크롤바 숨김 + 터치 외(데스크탑 협폭)
  //   넘길 수단 부재 → 힌트 ← → 를 실 클릭 버튼으로 전환(터치 스와이프 병행). dead hint 해소.
  const carouselRef = useRef<HTMLDivElement>(null);
  const scrollCarousel = useCallback((dir: -1 | 1) => {
    const el = carouselRef.current;
    if (!el) return;
    const firstCard = el.firstElementChild as HTMLElement | null;
    const amount = firstCard
      ? firstCard.getBoundingClientRect().width + 16
      : Math.round(el.clientWidth * 0.85);
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  }, []);

  /**
   * 플랜 선택 단일 진입점.
   * 여기서 하드코딩 /auth/signin 으로 보내지 않고, 서버 resolver 를 통해
   * 세션·워크스페이스·권한·구독 상태를 보고 올바른 목적지로 라우팅한다.
   */
  const handlePlanSelect = useCallback(
    async (plan: PlanIntent) => {
      // §pricing-prelaunch — Basic/Pro 는 PG 미연동 → 결제 대신 인라인 출시 알림 신청.
      if (plan === "team" || plan === "business") {
        setLeadPlan(plan);
        if (typeof document !== "undefined") {
          document.getElementById("notify")?.scrollIntoView({ behavior: "smooth" });
        }
        return;
      }
      setSelectError(null);
      setLoadingPlan(plan);
      try {
        const res = await fetch("/api/billing/plan-select", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selectedPlan: plan }),
        });
        if (!res.ok) {
          // 이 경우에도 로그인창으로 자동 폴백 금지.
          // 사용자에게 에러를 보여주고 다시 시도할 수 있게 한다.
          setSelectError(
            "플랜 선택 처리 중 일시적 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
          );
          return;
        }
        const data = (await res.json()) as {
          destination?: { kind: string; url: string };
        };
        if (!data.destination?.url) {
          setSelectError("목적지를 확인할 수 없습니다. 도입 상담으로 연결해 주세요.");
          return;
        }
        router.push(data.destination.url);
      } catch {
        setSelectError(
          "네트워크 오류로 플랜 선택을 완료할 수 없습니다. 연결 상태를 확인해 주세요."
        );
      } finally {
        setLoadingPlan(null);
      }
    },
    [router]
  );

  // §pricing-launch-manual P3 — 도입 신청 제출(EnrollmentRequest, 결제수단 0).
  const submitLead = useCallback(async () => {
    if (!leadEmail.trim()) {
      setLeadMsg("이메일을 입력해 주세요.");
      setLeadStatus("error");
      return;
    }
    if (leadPlan !== "team" && leadPlan !== "business") {
      setLeadMsg("도입할 플랜(Basic/Pro)을 선택해 주세요.");
      setLeadStatus("error");
      return;
    }
    setLeadStatus("loading");
    setLeadMsg("");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactEmail: leadEmail.trim(),
          company: leadCompany.trim() || undefined,
          contactName: leadName.trim() || undefined,
          planIntent: leadPlan,
          billingCycle: annual ? "yearly" : "monthly",
        }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setLeadMsg(d.error || "도입 신청 처리 중 오류가 발생했습니다.");
        setLeadStatus("error");
        return;
      }
      setLeadStatus("done");
    } catch {
      setLeadMsg("네트워크 오류로 신청을 완료하지 못했습니다.");
      setLeadStatus("error");
    }
  }, [leadEmail, leadPlan, leadCompany, leadName, annual]);

  return (
    <MainLayout>
      <ScrollProgress />
      <MainHeader />
      <div className="w-full" style={{ backgroundColor: P.bg }}>

        {/* ══ Header spacer — MainHeader(h-14, z-40) 위에 배경 보장 ══ */}
        <div className="h-14" style={{ backgroundColor: H.bg }} />

        {/* ══ §pricing-handoff D1 (호영님 2026-06-28) — 시안 네이비 히어로 복원.
            §11.304 의 라이트 "요금 안내" → 시안 §7 네이비 그라데이션 히어로
            (ph-tag 칩 + h1 + 서브카피 + 빌링 토글 in-hero). /intro 일부 중복은 호영님 감수. */}
        <section
          className="relative overflow-hidden pt-14 pb-12 md:pt-16 md:pb-14 text-center"
          style={{
            background: `radial-gradient(120% 90% at 85% 0%, ${H.glow} 0%, rgba(0,0,0,0) 55%), linear-gradient(180deg, ${H.surface} 0%, ${H.bg} 100%)`,
          }}
        >
          <div className="max-w-4xl mx-auto px-6">
            <Reveal>
              <span
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-5"
                style={{ backgroundColor: "rgba(59,130,246,0.14)", color: H.tagText, border: `1px solid ${H.tagBorder}` }}
              >
                <span style={{ color: P.blue }}>◆</span> 연구 구매 운영 플랫폼
              </span>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ color: H.text1 }}>
                운영 규모에 맞는 플랜을 선택하세요
              </h1>
              <p className="mt-3 text-sm md:text-base max-w-2xl mx-auto" style={{ color: H.text2 }}>
                검색·비교 중심으로 시작하고, 요청·구매·입고·재고 운영까지 확장할 수 있습니다.
              </p>

              {/* §11.304 월간/연간 토글 — §pricing-handoff D1: 히어로 내부 이동(네이비 스타일). */}
              <div className="mt-8 flex items-center justify-center gap-4">
                <span className="text-sm font-medium" style={{ color: !annual ? H.text1 : H.text3 }}>월간</span>
                <button
                  onClick={() => setAnnual(!annual)}
                  className="w-14 h-7 rounded-full p-1 flex items-center relative transition-colors"
                  style={{ backgroundColor: annual ? P.blue : H.toggleTrack, border: `1px solid ${H.tagBorder}` }}
                  aria-label={annual ? "연간 결제 선택됨, 월간으로 전환" : "월간 결제 선택됨, 연간으로 전환"}
                >
                  <div className="w-5 h-5 rounded-full transition-all shadow-sm" style={{
                    backgroundColor: "#FFFFFF",
                    transform: annual ? "translateX(28px)" : "translateX(0)",
                  }} />
                </button>
                <span className="text-sm font-medium" style={{ color: annual ? H.text1 : H.text3 }}>연간</span>
                {annual && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: "rgba(59,130,246,0.18)", color: H.tagText }}>
                    약 11% 할인 · 출시 후 적용
                  </span>
                )}
              </div>
            </Reveal>
          </div>
        </section>

        {/* ══ Plan cards ════════════════════════════════════════════ */}
        {/* §11.201 — PLAN_DESCRIPTOR (lib/billing/plan-descriptor.ts) single
            source 통과. Hard-coded magic number 폐기.
            §11.304 — recommendTag 등급화 ("가장 많이 선택" / "성장 단계 추천")
            정합. featured 카드는 "가장 많이 선택" 추천 (Basic 티어) — dark navy. */}
        <section id="plans" className="py-8 md:py-12" style={{ backgroundColor: P.bgSoft }}>
          <div className="max-w-7xl mx-auto px-6 md:px-8">
            {/* §pricing-carousel — 모바일 전용 스와이프 힌트(≤560). §pricing-handoff D9 — ← → 실 버튼(넘김 수단). */}
            <div
              className="flex min-[561px]:hidden items-center justify-center gap-3 mb-4 text-xs font-semibold"
              style={{ color: P.text3 }}
            >
              <button
                type="button"
                aria-label="이전 플랜"
                onClick={() => scrollCarousel(-1)}
                className="h-10 w-10 flex items-center justify-center rounded-full transition-all hover:brightness-95 active:scale-95"
                style={{ border: `1px solid ${P.border}`, backgroundColor: P.bg }}
              >
                <ArrowRight className="h-4 w-4 rotate-180" style={{ color: P.blue }} />
              </button>
              좌우로 넘겨 플랜을 비교하세요
              <button
                type="button"
                aria-label="다음 플랜"
                onClick={() => scrollCarousel(1)}
                className="h-10 w-10 flex items-center justify-center rounded-full transition-all hover:brightness-95 active:scale-95"
                style={{ border: `1px solid ${P.border}`, backgroundColor: P.bg }}
              >
                <ArrowRight className="h-4 w-4" style={{ color: P.blue }} />
              </button>
            </div>
            {/* §pricing-carousel (호영님 2026-06-27) — 데스크톱(≥981) 4열 / 태블릿(561~980) 2열 /
                모바일(≤560) 가로 스와이프 캐러셀(peek 84% + snap). 기능 목록 항상 노출(아코디언 X).
                §11.201e — items-stretch + 카드 h-full 로 카드 높이 통일 유지. */}
            <div
              ref={carouselRef}
              className="flex snap-x snap-mandatory overflow-x-auto gap-4 pt-12 pb-2 items-stretch
                [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
                min-[561px]:grid min-[561px]:grid-cols-2 min-[561px]:gap-6 min-[561px]:overflow-x-visible min-[561px]:pt-0
                min-[981px]:grid-cols-4"
            >
              {PLAN_INTENT_VALUES.map((intent, i) => {
                const descriptor = PLAN_DESCRIPTOR[intent];
                const { price, period } = formatPlanPrice(descriptor, annual);
                const statBadges = formatStatBadges(descriptor);
                // §pricing-final §2 — navy 셸은 선택 상태로 구동(클릭 선택형). "가장 많이 선택"
                //   배지는 PlanCard 내부 recommendTag(Basic 고정)로 독립 노출.
                return (
                  <Reveal
                    key={descriptor.intent}
                    delay={i * 0.08}
                    className="shrink-0 basis-[84%] snap-center min-[561px]:basis-auto min-[561px]:shrink"
                  >
                    <PlanCard
                      descriptor={descriptor}
                      price={price}
                      period={period}
                      statBadges={statBadges}
                      selected={selectedPlan === intent}
                      onCardSelect={setSelectedPlan}
                      annualBilling={annual}
                      onSelect={handlePlanSelect}
                      loading={loadingPlan === descriptor.intent}
                      disabled={
                        loadingPlan !== null && loadingPlan !== descriptor.intent
                      }
                    />
                  </Reveal>
                );
              })}
            </div>
            {selectError && (
              <div className="max-w-3xl mx-auto mt-6 px-6 py-4 rounded-xl text-sm" style={{ backgroundColor: "#FEF2F2", color: "#991B1B", border: "1px solid #FECACA" }}>
                {selectError}
              </div>
            )}
          </div>
        </section>

        {/* ══ 도입 신청 — §pricing-launch-manual P3 (수동 결제) ════════ */}
        <section id="notify" className="py-12 md:py-16" style={{ backgroundColor: P.bg }}>
          <div className="max-w-2xl mx-auto px-6 md:px-8 text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-3" style={{ color: P.text1 }}>도입 신청</h2>
            <p className="text-sm md:text-base mb-6" style={{ color: P.text3 }}>
              신청해 주시면 담당자가 도입 절차(견적·인보이스·활성화)를 안내드립니다. (이 단계에서는 결제 정보를 받지 않습니다.)
            </p>
            {leadStatus === "done" ? (
              <div className="rounded-xl px-6 py-5 text-sm font-medium" style={{ backgroundColor: P.bgSoft, color: P.text1, border: `1px solid ${P.border}` }}>
                도입 신청이 접수되었습니다. 담당자가 안내드리겠습니다.
              </div>
            ) : (
              <div className="flex flex-col gap-3 max-w-md mx-auto text-left">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={leadCompany}
                    onChange={(e) => setLeadCompany(e.target.value)}
                    placeholder="회사·기관명 (선택)"
                    className="flex-1 px-4 py-3 rounded-xl text-sm"
                    style={{ border: `1px solid ${P.border}`, backgroundColor: P.bg, color: P.text1 }}
                  />
                  <input
                    type="text"
                    value={leadName}
                    onChange={(e) => setLeadName(e.target.value)}
                    placeholder="담당자명 (선택)"
                    className="flex-1 px-4 py-3 rounded-xl text-sm"
                    style={{ border: `1px solid ${P.border}`, backgroundColor: P.bg, color: P.text1 }}
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <select
                    aria-label="도입 플랜"
                    value={leadPlan}
                    onChange={(e) => setLeadPlan(e.target.value as "team" | "business" | "")}
                    className="px-4 py-3 rounded-xl text-sm"
                    style={{ border: `1px solid ${P.border}`, backgroundColor: P.bg, color: P.text1 }}
                  >
                    <option value="">도입 플랜 선택</option>
                    <option value="team">Basic</option>
                    <option value="business">Pro</option>
                  </select>
                  <input
                    type="email"
                    value={leadEmail}
                    onChange={(e) => setLeadEmail(e.target.value)}
                    placeholder="이메일 주소"
                    className="flex-1 px-4 py-3 rounded-xl text-sm"
                    style={{ border: `1px solid ${P.border}`, backgroundColor: P.bg, color: P.text1 }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void submitLead()}
                  disabled={leadStatus === "loading"}
                  className="w-full px-6 py-3 rounded-xl font-bold text-white text-sm transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ backgroundColor: P.blue }}
                >
                  {leadStatus === "loading" ? "신청 중…" : "도입 신청"}
                </button>
                <p className="text-xs" style={{ color: P.text4 }}>
                  선택 결제 주기: {annual ? "연간" : "월간"} (상단 토글에서 변경)
                </p>
              </div>
            )}
            {leadStatus === "error" && leadMsg && (
              <p className="mt-3 text-sm" style={{ color: "#991B1B" }}>{leadMsg}</p>
            )}
          </div>
        </section>

        {/* ══ Custom solution banner ═══════════════════════════════ */}
        <section className="py-12 md:py-16" style={{ backgroundColor: P.bg }}>
          <div className="max-w-5xl mx-auto px-6 md:px-8">
            <Reveal>
              <div className="rounded-2xl p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6" style={{ backgroundColor: P.bgSoft, border: `1px solid ${P.border}` }}>
                <div>
                  <h3 className="text-xl md:text-2xl font-bold mb-2" style={{ color: P.text1 }}>맞춤형 솔루션이 필요하신가요?</h3>
                  <p className="text-sm md:text-base" style={{ color: P.text3 }}>
                    조직 운영에 맞는 도입 범위를 함께 설계합니다. 검색·비교 중심으로 시작하고, 요청·구매·입고·재고 운영까지 확장할 수 있습니다.
                  </p>
                </div>
                <Link href="/support" className="flex-shrink-0">
                  <button className="px-8 py-3.5 rounded-xl font-bold text-white transition-all hover:brightness-110 active:scale-[0.98] flex items-center gap-2 whitespace-nowrap" style={{ backgroundColor: P.green }}>
                    도입 상담 신청 <ArrowRight className="h-4 w-4" />
                  </button>
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ══ Comparison table ═════════════════════════════════════ */}
        <section className="py-16 md:py-20" style={{ backgroundColor: P.bgSoft, borderTop: `1px solid ${P.border}` }}>
          <div className="max-w-7xl mx-auto px-6 md:px-8">
            <Reveal>
              <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center" style={{ color: P.text1 }}>도입 범위 비교</h2>
            </Reveal>
            <Reveal delay={0.1}>
              {/* §pricing-handoff D16 — 데스크탑(>560): 비교 표(4플랜+칩). 모바일은 아래 카드 스택. */}
              <div className="hidden min-[561px]:block overflow-x-auto rounded-2xl" style={{ border: `1px solid ${P.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                <table className="w-full text-left border-separate border-spacing-0" style={{ backgroundColor: P.bg }}>
                  <thead>
                    <tr style={{ backgroundColor: P.bgSoft }}>
                      <th className="p-4 lg:p-5 text-xs uppercase tracking-wider font-bold whitespace-nowrap" style={{ color: P.text4 }}>운영 항목</th>
                      <th className="p-4 lg:p-5 text-center text-sm font-semibold whitespace-nowrap border-l border-slate-200" style={{ color: P.text2 }}>Free</th>
                      <th className="p-4 lg:p-5 text-center text-sm font-bold whitespace-nowrap border-l border-slate-200" style={{ color: P.blueText, backgroundColor: "rgba(59,130,246,0.06)" }}>Basic</th>
                      <th className="p-4 lg:p-5 text-center text-sm font-semibold whitespace-nowrap border-l border-slate-200" style={{ color: P.text1 }}>Pro</th>
                      <th className="p-4 lg:p-5 text-center text-sm font-semibold whitespace-nowrap border-l border-slate-200" style={{ color: P.text2 }}>Enterprise</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARISON_ROWS.map((row) => (
                      <tr key={row.feature} style={{ borderTop: `1px solid ${P.border}`, backgroundColor: P.bg }}>
                        <td className="p-4 lg:p-5 font-medium text-sm whitespace-nowrap" style={{ color: P.text1 }}>{row.feature}</td>
                        <td className="p-4 lg:p-5 text-center border-l border-slate-200"><CellValue value={row.starter} /></td>
                        <td className="p-4 lg:p-5 text-center border-l border-slate-200" style={{ backgroundColor: "rgba(59,130,246,0.04)" }}><CellValue value={row.team} highlight /></td>
                        <td className="p-4 lg:p-5 text-center border-l border-slate-200"><CellValue value={row.business} label={row.businessLabel} /></td>
                        <td className="p-4 lg:p-5 text-center border-l border-slate-200"><CellValue value={row.enterprise} label={row.enterpriseLabel} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* §pricing-handoff D16 — 모바일(≤560): 플랜별 세로 카드 스택(가로 스크롤 0, Basic accent). */}
              <div className="min-[561px]:hidden flex flex-col gap-3.5">
                {CMP_PLANS.map((plan) => (
                  <div key={plan.name} className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${P.border}`, backgroundColor: P.bg, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                    <div
                      className="flex items-baseline gap-2 px-4 py-3 text-base font-bold"
                      style={plan.feat
                        ? { color: P.blueText, backgroundColor: "rgba(59,130,246,0.06)" }
                        : { color: P.text1, backgroundColor: P.bgSoft }}
                    >
                      {plan.name}<span className="text-xs font-semibold" style={{ color: P.text4 }}>{plan.seat}</span>
                    </div>
                    <div>
                      {COMPARISON_ROWS.map((row) => (
                        <div key={row.feature} className="flex items-center justify-between gap-3 px-4 py-2.5" style={{ borderTop: `1px solid ${P.border}` }}>
                          <span className="text-[13px] font-semibold" style={{ color: P.text3 }}>{row.feature}</span>
                          <span className="flex-shrink-0 text-right">
                            <CellValue value={row[plan.vKey]} label={plan.lKey ? row[plan.lKey] : undefined} highlight={plan.feat} />
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* ══ FAQ ═══════════════════════════════════════════════════ */}
        <section className="py-16 md:py-20" style={{ backgroundColor: P.bg }}>
          <div className="max-w-3xl mx-auto px-6 md:px-8">
            <Reveal>
              <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center" style={{ color: P.text1 }}>
                자주 묻는 질문
              </h2>
            </Reveal>

            {/* §pricing-assistant — AI 즉답 카드(아코디언 위). 정적 FAQ 보존. */}
            <Reveal>
              <PricingAssistant />
            </Reveal>

            <div className="flex flex-col gap-4">
              {FAQ_DATA.map((faq, i) => (
                <Reveal key={faq.q} delay={i * 0.06}>
                  <FAQItem question={faq.q} answer={faq.a} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ══ Bottom CTA — 도입 설계 ════════════════════════════════ */}
        <section className="py-16 md:py-20" style={{ backgroundColor: P.bgSoft, borderTop: `1px solid ${P.border}` }}>
          <div className="max-w-5xl mx-auto px-6 md:px-8">
            <Reveal>
              <div className="text-center">
                <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: P.text1 }}>
                  조직 운영에 맞는 도입 범위를 함께 설계합니다
                </h2>
                <p className="text-base mb-8 max-w-2xl mx-auto" style={{ color: P.text3 }}>
                  검색·비교 중심으로 먼저 시작하고, 이후 요청·구매 준비·입고·재고 운영까지 확장할 수 있습니다.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Link href="/support">
                    <button className="px-8 py-4 rounded-xl font-bold text-white transition-all hover:brightness-110 active:scale-[0.98]" style={{ backgroundColor: P.blue }}>
                      도입 상담 신청
                    </button>
                  </Link>
                  <Link href="/search">
                    <button className="px-8 py-4 rounded-xl font-bold transition-all hover:brightness-95 active:scale-[0.98] flex items-center gap-2" style={{ color: P.text1, border: `1px solid ${P.border}`, backgroundColor: P.bg }}>
                      무료로 시작하기 <ArrowRight className="h-4 w-4" />
                    </button>
                  </Link>
                </div>
              </div>
            </Reveal>
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

/* ── Cell Value Component ──────────────────────────────────────── */
function CellValue({ value, label, highlight }: { value: string; label?: string; highlight?: boolean }) {
  // §pricing-handoff D16 — none(—) / check(✓ + 칩 라벨) / 수량값 텍스트.
  if (value === "none") {
    return <Minus className="h-4 w-4 mx-auto" style={{ color: P.text4 }} />;
  }
  if (value === "check") {
    return (
      <span className="inline-flex items-center justify-center gap-1.5">
        <CheckCircle2 className="h-[18px] w-[18px] flex-shrink-0" style={{ color: P.green }} />
        {label && <span className={`text-xs md:text-sm ${highlight ? "font-semibold" : ""}`} style={{ color: highlight ? P.text1 : P.text2 }}>{label}</span>}
      </span>
    );
  }
  return <span className="text-xs md:text-sm font-medium" style={{ color: highlight ? P.text1 : P.text2 }}>{value}</span>;
}

/* ── Plan Card Component — descriptor 통과 (light or featured navy) ──────────────────────── */
function PlanCard({
  descriptor, price, period, statBadges, selected, onCardSelect, annualBilling, onSelect, loading, disabled,
}: {
  descriptor: PlanDescriptor;
  price: string;
  period?: string;
  statBadges: { label: string; value: string }[];
  // §pricing-final §2 — 클릭 선택형: 선택된 카드만 dark navy + 체크 배지. navy = 선택 상태 구동.
  selected?: boolean;
  onCardSelect?: (plan: PlanIntent) => void;
  // §pricing-고도화 P1/P2 — 결제주기 라인(월간/연간) 표기를 위해 카드가 현재 토글 상태를 받음.
  annualBilling?: boolean;
  onSelect: (plan: PlanIntent) => void | Promise<void>;
  loading?: boolean;
  disabled?: boolean;
}) {
  const { intent, label, tagline, features, ctaLabel, recommendTag } = descriptor;
  const handleClick = () => {
    if (loading || disabled) return;
    void onSelect(intent);
  };

  // §pricing-final §2 — dark navy = 선택 상태. "가장 많이 선택" 배지는 recommendTag(Basic 고정)로 독립.
  const isDarkNavy = selected === true;
  const labelColor = isDarkNavy ? D.text1 : P.text1;
  const taglineColor = isDarkNavy ? D.text2 : P.text3;

  return (
    <div className="relative h-full flex flex-col"> {/* §11.201f — h-full + flex flex-col 추가 (wrapping div height chain) */}
      {/* §11.201 — recommendTag 한국어 ("추천: 단일 연구실 운영" 등). 영문 popular badge 폐기. */}
      {recommendTag !== null && (
        <div
          className="absolute -top-4 left-1/2 -translate-x-1/2 z-10 px-4 py-1.5 rounded-full text-[11px] font-bold tracking-wide text-white whitespace-nowrap"
          style={{ backgroundColor: P.blue }}
        >
          {recommendTag}
        </div>
      )}
      {/* §pricing-final §2 — 선택 시 우상단 체크 배지 */}
      {selected && (
        <div className="absolute top-4 right-4 z-20 h-7 w-7 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: P.blue, boxShadow: `0 4px 12px -2px ${P.blue}` }}>
          <CheckCircle2 className="h-4 w-4" />
        </div>
      )}
      <div
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        onClick={() => onCardSelect?.(intent)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onCardSelect?.(intent); } }}
        className={
          isDarkNavy
            ? "cursor-pointer p-6 md:p-10 rounded-3xl flex flex-col h-full transition-shadow duration-200 hover:shadow-[0_24px_56px_rgba(0,0,0,0.2)]"
            : "cursor-pointer p-6 md:p-10 rounded-3xl flex flex-col h-full transition-all duration-200 hover:translate-y-[-4px] hover:shadow-xl"
        }
        style={
          isDarkNavy
            ? {
                backgroundColor: D.bg,
                border: `1px solid ${D.border}`,
                boxShadow: "0 20px 48px rgba(0,0,0,0.15)",
              }
            : {
                backgroundColor: P.bg,
                border: `1px solid ${P.border}`,
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }
        }
      >
        {/* §11.201e — 카드 슬롯 height 통일: 헤더 / 가격 / 운영 범위 박스에
            min-height 명시. features 가 flex-grow, CTA wrapper 가 mt-auto 로
            카드 하단 고정. 4 카드 모두 동일 vertical alignment. */}
        <div className="mb-6 min-h-[120px]">
          <h3 className="text-2xl font-bold mb-2" style={{ color: labelColor }}>{label}</h3>
          <p className="text-sm leading-relaxed" style={{ color: taglineColor }}>{tagline}</p>
        </div>
        <div className="mb-6 min-h-[44px]">
          <span className="text-[30px] font-bold leading-none" style={{ color: labelColor }}>{price}</span>
          {period && <span className="text-sm ml-1" style={{ color: taglineColor }}>{period}</span>}

          {/* §pricing-고도화 P2 — 결제주기 명시(카드만 봐도 월간/연간 구분). Free/Custom 제외. */}
          {price !== "Free" && price !== "Custom" && (
            <div className="mt-1.5 text-[12px]" style={{ color: taglineColor }}>
              {annualBilling ? <>연간 결제 · <b>약 11% 할인</b> (출시 후 적용)</> : "월간 결제"}
            </div>
          )}
          {/* §pricing-handoff D4 (호영님 2026-06-28) — Basic "1개월 무료체험" 정보성 라벨 노출.
              CTA 는 "도입 신청" 유지(체험-시작 dead CTA 0). PG+trial 착지 시 실 trial-start 전환(최소 diff). */}
          {descriptor.trialEligible && (
            <div
              className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold"
              style={{
                backgroundColor: isDarkNavy ? "rgba(16,185,129,0.18)" : P.greenSoft,
                color: isDarkNavy ? "#6EE7B7" : P.greenText,
              }}
            >
              1개월 무료체험
            </div>
          )}
        </div>

        {/* §pricing-handoff D2 — 시안 카드 상단 3 스탯배지(사용자 / 견적·구매 / 재고 품목).
            descriptor 파생. 구 "운영 범위" 텍스트 박스 대체. */}
        <div className="mb-6 grid grid-cols-3 gap-2 min-h-[88px]">
          {statBadges.map((stat, si) => {
            const StatIcon = [Users, FileText, Package][si] ?? Users;
            return (
              <div
                key={stat.label}
                className="flex flex-col items-center justify-center text-center px-2 py-3 rounded-xl"
                style={{
                  backgroundColor: isDarkNavy ? D.surface : P.bgSoft,
                  border: `1px solid ${isDarkNavy ? D.border : P.border}`,
                }}
              >
                <StatIcon className="h-4 w-4 mb-1.5 flex-shrink-0" style={{ color: P.blue }} />
                <span className="text-sm font-bold leading-tight" style={{ color: isDarkNavy ? D.text1 : P.text1 }}>{stat.value}</span>
                <span className="text-[10px] mt-0.5 leading-tight" style={{ color: isDarkNavy ? D.text2 : P.text4 }}>{stat.label}</span>
              </div>
            );
          })}
        </div>

        <ul className="flex flex-col gap-3 mb-6 flex-grow">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-[14px]">
              <CheckCircle2 className="h-[18px] w-[18px] mt-0.5 flex-shrink-0" style={{ color: P.green }} />
              <span style={{ color: isDarkNavy ? D.text1 : P.text2 }}>{f}</span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleClick(); }}
          disabled={loading || disabled}
          aria-busy={loading || undefined}
          className={
            isDarkNavy
              ? "mt-auto w-full py-4 rounded-xl font-bold text-white text-base transition-all hover:brightness-110 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              : "mt-auto w-full py-4 rounded-xl font-bold text-base transition-all hover:brightness-95 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          }
          style={
            isDarkNavy
              ? { backgroundColor: P.blue }
              : { color: P.text1, backgroundColor: P.bg, border: `1px solid ${P.text1}` }
          }
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> 확인 중…
            </>
          ) : (
            <>
              {ctaLabel} <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/* ── FAQ Accordion Item ────────────────────────────────────────── */
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="rounded-xl overflow-hidden transition-colors"
      style={{ border: `1px solid ${open ? P.blue : P.border}`, backgroundColor: P.bg }}
    >
      <button
        type="button"
        className="w-full px-6 py-5 text-left flex items-center justify-between gap-4"
        onClick={() => setOpen(!open)}
      >
        <span className="font-bold text-base" style={{ color: P.text1 }}>{question}</span>
        <ChevronDown
          className="h-5 w-5 flex-shrink-0 transition-transform"
          style={{ color: P.text4, transform: open ? "rotate(180deg)" : "rotate(0)" }}
        />
      </button>
      {open && (
        <div className="px-6 pb-5">
          <p className="text-sm leading-relaxed" style={{ color: P.text3 }}>{answer}</p>
        </div>
      )}
    </div>
  );
}
