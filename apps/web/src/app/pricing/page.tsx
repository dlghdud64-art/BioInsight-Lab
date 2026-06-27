"use client";

import { useCallback, useState } from "react";
import { MainHeader } from "@/app/_components/main-header";
import { MainFooter } from "@/app/_components/main-footer";
import { MainLayout } from "@/app/_components/main-layout";
import { CheckCircle2, ArrowRight, Minus, ChevronDown, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { PLAN_INTENT_VALUES, type PlanIntent } from "@/lib/billing/plan-select";
import {
  PLAN_DESCRIPTOR,
  type PlanDescriptor,
} from "@/lib/billing/plan-descriptor";

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

/** §11.201 — 운영량 / Credit 한 줄 요약. 카드 안의 "왜 이 가격인가" 정량 근거.
 *  §11.303b — Basic/Pro 견적/PO null (무제한) 시 "견적·구매 무제한" 표기 분기.
 *    backend maxQuotesPerMonth null 과 UI literal 동시 정합 (§pricing-redesign: PO 한도 field 폐기).
 */
function formatOperatingVolume(descriptor: PlanDescriptor): string[] {
  // Enterprise — 모두 null (계약 기반)
  if (
    descriptor.operatingVolume.monthlyRfq === null &&
    descriptor.operatingVolume.monthlyPo === null &&
    descriptor.operatingVolume.inventoryItems === null
  ) {
    return ["좌석·운영량 모두 계약 기반"];
  }
  // §11.303b — Basic/Pro: 견적/PO null (무제한) + 재고 quota 있음
  const seatsLine =
    descriptor.seatsRecommended !== null
      ? `사용자 ${descriptor.seatsRecommended}명 권장`
      : "사용자 무제한 (계약)";
  // §pricing-redesign P3 — PO 한도 폐기(전 플랜 무제한). Free 는 RFQ 만 유한(3) → 비대칭 정직 표기.
  const rfqPoLine =
    descriptor.operatingVolume.monthlyRfq === null
      ? "견적·구매 무제한"
      : `견적 요청 월 ${descriptor.operatingVolume.monthlyRfq}건 · 구매 무제한`;
  const itemsLine =
    descriptor.operatingVolume.inventoryItems !== null
      ? `재고 ${descriptor.operatingVolume.inventoryItems.toLocaleString("ko-KR")} 품목`
      : "재고 무제한 (계약)";
  return [seatsLine, rfqPoLine, itemsLine];
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

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  // §pricing-prelaunch — 연간 가격은 명시 월환산(priceAnnualMonthlyKrw). 배수 계산 폐기.
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<PlanIntent | null>(null);
  const [selectError, setSelectError] = useState<string | null>(null);
  // §pricing-prelaunch P5 — 출시 알림 신청 리드폼(인라인). 결제수단 0, 이메일만.
  const [leadPlan, setLeadPlan] = useState<"team" | "business" | "">("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadStatus, setLeadStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [leadMsg, setLeadMsg] = useState("");
  const [leadCompany, setLeadCompany] = useState("");
  const [leadName, setLeadName] = useState("");

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
      <MainHeader />
      <div className="w-full" style={{ backgroundColor: P.bg }}>

        {/* ══ Header spacer — MainHeader(h-14, z-40) 위에 배경 보장 ══ */}
        <div className="h-14" style={{ backgroundColor: "#0B1120" }} />

        {/* ══ §11.304 — Hero 섹션 제거 (서비스 소개 /intro 와 역할 중복).
            §11.303b 추가 — 페이지 정체성 제목만 가볍게 복원 ("요금 안내").
            ═══════════════════════════════════════════════════════════ */}

        {/* §11.303b — 페이지 제목 복원 (휑한 상단 정리, 가볍게).
            대시보드 페이지 제목 체계 정합 (text-2xl font-bold + 부제 sm/gray-500).
            이전 무거운 히어로 (4단계 탭/칩/데모 버튼) 는 복원 0 — /intro 가 책임. */}
        <section className="pt-12 pb-2 text-center" style={{ backgroundColor: P.bgSoft }}>
          <div className="max-w-4xl mx-auto px-6">
            <Reveal>
              <h1 className="text-2xl font-bold" style={{ color: P.text1 }}>
                요금 안내
              </h1>
              <p className="mt-2 text-sm" style={{ color: P.text4 }}>
                연구 구매 운영 규모에 맞는 플랜을 선택하세요.
              </p>
            </Reveal>
          </div>
        </section>

        {/* §11.304 — 월간/연간 토글 (plan cards 직전 별도 section).
            §11.303b — 제목 복원 후 spacing 정리 (제목과 토글 간격 좁힘). */}
        <section className="pt-4 pb-2 md:pt-5 md:pb-3" style={{ backgroundColor: P.bgSoft }}>
          <div className="max-w-4xl mx-auto px-6">
            <Reveal>
              <div className="flex items-center justify-center gap-4">
                <span className="text-sm font-medium" style={{ color: !annual ? P.text1 : P.text4 }}>월간</span>
                <button
                  onClick={() => setAnnual(!annual)}
                  className="w-14 h-7 rounded-full p-1 flex items-center relative transition-colors"
                  style={{ backgroundColor: annual ? P.blue : P.bgMuted, border: `1px solid ${P.border}` }}
                  aria-label={annual ? "연간 결제 선택됨, 월간으로 전환" : "월간 결제 선택됨, 연간으로 전환"}
                >
                  <div className="w-5 h-5 rounded-full transition-all shadow-sm" style={{
                    backgroundColor: annual ? "#FFFFFF" : P.text4,
                    transform: annual ? "translateX(28px)" : "translateX(0)",
                  }} />
                </button>
                <span className="text-sm font-medium" style={{ color: annual ? P.text1 : P.text4 }}>연간</span>
                {annual && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: P.blueSoft, color: P.blueText }}>
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
            {/* §pricing-carousel — 모바일 전용 스와이프 힌트(≤560). 데스크톱/태블릿 숨김. */}
            <div
              className="flex min-[561px]:hidden items-center justify-center gap-2 mb-4 text-xs font-semibold"
              style={{ color: P.text3 }}
            >
              <ArrowRight className="h-3.5 w-3.5 rotate-180" style={{ color: P.blue }} />
              좌우로 넘겨 플랜을 비교하세요
              <ArrowRight className="h-3.5 w-3.5" style={{ color: P.blue }} />
            </div>
            {/* §pricing-carousel (호영님 2026-06-27) — 데스크톱(≥981) 4열 / 태블릿(561~980) 2열 /
                모바일(≤560) 가로 스와이프 캐러셀(peek 84% + snap). 기능 목록 항상 노출(아코디언 X).
                §11.201e — items-stretch + 카드 h-full 로 카드 높이 통일 유지. */}
            <div
              className="flex snap-x snap-mandatory overflow-x-auto gap-4 pt-6 pb-2 items-stretch
                [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
                min-[561px]:grid min-[561px]:grid-cols-2 min-[561px]:gap-6 min-[561px]:overflow-x-visible min-[561px]:pt-0
                min-[981px]:grid-cols-4"
            >
              {PLAN_INTENT_VALUES.map((intent, i) => {
                const descriptor = PLAN_DESCRIPTOR[intent];
                const { price, period } = formatPlanPrice(descriptor, annual);
                const operatingVolume = formatOperatingVolume(descriptor);
                // §11.304 — featured = "가장 많이 선택" 추천 카드 (Basic 티어)
                //   — dark navy 톤. recommendTag 등급화 정합.
                const featured =
                  descriptor.recommendTag !== null &&
                  /가장\s*많이\s*선택/.test(descriptor.recommendTag);
                return (
                  <Reveal
                    key={descriptor.intent}
                    delay={i * 0.08}
                    className="h-full shrink-0 basis-[84%] snap-center min-[561px]:basis-auto min-[561px]:shrink"
                  >
                    <PlanCard
                      descriptor={descriptor}
                      price={price}
                      period={period}
                      operatingVolume={operatingVolume}
                      featured={featured}
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
              <div className="overflow-x-auto rounded-2xl -mx-2 px-2 md:mx-0 md:px-0" style={{ border: `1px solid ${P.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                <table className="w-full min-w-[640px] text-left border-separate border-spacing-0" style={{ backgroundColor: P.bg }}>
                  <thead>
                    <tr style={{ backgroundColor: P.bgSoft }}>
                      <th className="p-3 md:p-5 text-xs uppercase tracking-wider font-bold whitespace-nowrap" style={{ color: P.text4 }}>운영 항목</th>
                      {/* §11.304 — 비교 표 헤더 티어명 정합 (Starter→Free / Lab Team→Basic / R&D Operations→Pro). */}
                      <th className="p-3 md:p-5 text-center text-xs md:text-sm font-semibold whitespace-nowrap" style={{ color: P.text2 }}>Free</th>
                      <th className="p-3 md:p-5 text-center text-xs md:text-sm font-semibold whitespace-nowrap" style={{ color: P.text1 }}>Basic</th>
                      <th className="p-3 md:p-5 text-center text-xs md:text-sm font-bold whitespace-nowrap" style={{ color: P.text1 }}>Pro</th>
                      <th className="p-3 md:p-5 text-center text-xs md:text-sm font-semibold whitespace-nowrap" style={{ color: P.text2 }}>Enterprise</th>
                    </tr>
                  </thead>
                  <tbody>
                    {([
                      { feature: "검색·후보 정리", starter: "기본", team: "팀 공유", business: "check", businessLabel: "조직 공용", enterprise: "check", enterpriseLabel: "멀티 조직" },
                      { feature: "비교·선택안 정리", starter: "none", team: "기본", business: "check", businessLabel: "운영형 비교", enterprise: "check", enterpriseLabel: "조직 기준" },
                      { feature: "요청 생성·기록 공유", starter: "none", team: "초안·공유", business: "check", businessLabel: "운영형 관리", enterprise: "check", enterpriseLabel: "조직 기준" },
                      { feature: "구매 준비·운영 큐", starter: "none", team: "none", business: "check", enterprise: "check" },
                      { feature: "입고 반영·재고 운영", starter: "기본 등록", team: "상태 공유", business: "check", businessLabel: "운영 반영", enterprise: "check", enterpriseLabel: "조직 운영" },
                      // §pricing-redesign P3 — 라벨 스캔 훅(Free 월 10회 / 이상 무제한, P2b enforce 정합) + LOT/GMP 추적(Pro, P2a 게이팅 정합).
                      { feature: "라벨 스캔 (월)", starter: "10회", team: "무제한", business: "무제한", enterprise: "무제한" },
                      { feature: "LOT / GMP 추적", starter: "none", team: "none", business: "check", businessLabel: "GMP 추적", enterprise: "check", enterpriseLabel: "조직 정책" },
                      { feature: "예산·권한 기준", starter: "none", team: "기본 권한", business: "check", businessLabel: "운영 기준", enterprise: "check", enterpriseLabel: "정책/감사" },
                      { feature: "외부 시스템 연결", starter: "none", team: "기본", business: "check", businessLabel: "확장", enterprise: "check", enterpriseLabel: "내부 연동" },
                    ] as TableRow[]).map((row, i) => (
                      <tr key={row.feature} style={{ borderTop: `1px solid ${P.border}`, backgroundColor: i % 2 === 0 ? P.bg : P.bgSoft }}>
                        <td className="p-3 md:p-5 font-medium text-xs md:text-sm whitespace-nowrap" style={{ color: P.text1 }}>{row.feature}</td>
                        <td className="p-3 md:p-5 text-center"><CellValue value={row.starter} /></td>
                        <td className="p-3 md:p-5 text-center"><CellValue value={row.team} /></td>
                        <td className="p-3 md:p-5 text-center"><CellValue value={row.business} label={row.businessLabel} highlight /></td>
                        <td className="p-3 md:p-5 text-center"><CellValue value={row.enterprise} label={row.enterpriseLabel} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
  if (value === "none") {
    return <Minus className="h-4 w-4 mx-auto" style={{ color: P.text4 }} />;
  }
  if (value === "check") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <CheckCircle2 className="h-[18px] w-[18px] flex-shrink-0" style={{ color: P.green }} />
        {label && <span className={`text-sm ${highlight ? "font-semibold" : ""}`} style={{ color: highlight ? P.text1 : P.text2 }}>{label}</span>}
      </span>
    );
  }
  return <span className="text-sm" style={{ color: P.text4 }}>{value}</span>;
}

/* ── Plan Card Component — descriptor 통과 (light or featured navy) ──────────────────────── */
function PlanCard({
  descriptor, price, period, operatingVolume, featured, onSelect, loading, disabled,
}: {
  descriptor: PlanDescriptor;
  price: string;
  period?: string;
  operatingVolume: string[];
  featured?: boolean;
  onSelect: (plan: PlanIntent) => void | Promise<void>;
  loading?: boolean;
  disabled?: boolean;
}) {
  const { intent, label, tagline, features, ctaLabel, recommendTag } = descriptor;
  const handleClick = () => {
    if (loading || disabled) return;
    void onSelect(intent);
  };

  // §11.201 — featured (dark navy) vs default (light) 두 variant.
  //   recommendTag 가 있고 "단일 연구실" 추천이면 featured, 그 외는 default.
  //   recommendTag 가 있고 "R&D 센터" 같은 다른 추천은 light + outline blue badge.
  const isDarkNavy = featured === true;
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
      <div
        className={
          isDarkNavy
            ? "p-9 md:p-10 rounded-3xl flex flex-col h-full transition-shadow duration-200 hover:shadow-[0_24px_56px_rgba(0,0,0,0.2)]"
            : "p-9 md:p-10 rounded-3xl flex flex-col h-full transition-all duration-200 hover:translate-y-[-4px] hover:shadow-xl"
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
        </div>

        {/* §11.201 — 운영량 / Credit 정량 근거 (descriptor.seatsRecommended /
            operatingVolume / labOpsCreditMonthly 통과). 카드 안의 "왜 이 가격인가". */}
        <div
          className="mb-6 p-4 rounded-xl min-h-[148px]"
          style={{
            backgroundColor: isDarkNavy ? D.surface : P.bgSoft,
            border: `1px solid ${isDarkNavy ? D.border : P.border}`,
          }}
        >
          <div
            className="text-[10px] font-bold uppercase tracking-[0.08em] mb-2"
            style={{ color: isDarkNavy ? D.text2 : P.text4 }}
          >
            운영 범위
          </div>
          <ul className="flex flex-col gap-1.5">
            {operatingVolume.map((line) => (
              <li
                key={line}
                className="text-[12px] leading-snug"
                style={{ color: isDarkNavy ? D.text1 : P.text2 }}
              >
                {line}
              </li>
            ))}
          </ul>
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
          onClick={handleClick}
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
