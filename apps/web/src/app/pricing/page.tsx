"use client";

import { useState } from "react";
import { MainHeader } from "@/app/_components/main-header";
import { MainFooter } from "@/app/_components/main-footer";
import { MainLayout } from "@/app/_components/main-layout";
import { CheckCircle2, ArrowRight, Minus, ChevronDown } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

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

const TEAM_MONTHLY = 129_000;
const BUSINESS_MONTHLY = 349_000;

function fmt(n: number) {
  return `₩${n.toLocaleString("ko-KR")}`;
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
    a: "Starter 플랜은 가입 즉시 무료로 이용할 수 있습니다. Team 및 Business 플랜은 결제 후 바로 활성화되며, 추가 설정 없이 팀원을 초대할 수 있습니다.",
  },
  {
    q: "Enterprise 도입은 어떤 절차로 진행되나요?",
    a: "도입 상담 → 운영 범위 설계 → 보안 검토 → 시스템 연동 → 파일럿 운영 순서로 진행됩니다. 전담 매니저가 전체 과정을 지원합니다.",
  },
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const discount = annual ? 0.9 : 1;

  return (
    <MainLayout>
      <MainHeader />
      <div className="w-full" style={{ backgroundColor: P.bg }}>

        {/* ══ Header spacer — MainHeader(h-14, z-40) 위에 배경 보장 ══ */}
        <div className="h-14" style={{ backgroundColor: "#0B1120" }} />

        {/* ══ Hero — white, clean ════════════════════════════════════ */}
        <section className="pt-16 pb-16 md:pt-24 md:pb-20 text-center" style={{ backgroundColor: P.bgSoft }}>
          <div className="max-w-4xl mx-auto px-6">
            <Reveal>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-5 leading-[1.1] whitespace-nowrap" style={{ color: P.text1 }}>
                연구실 규모에 맞는 플랜을 선택하세요
              </h1>
              <p className="text-base md:text-lg max-w-3xl mx-auto mb-10 leading-relaxed" style={{ color: P.text3 }}>
                시약·장비 검색부터 비교·요청 생성, 발주 준비, 입고 반영, 재고 운영까지.<br className="hidden md:block" />
                현재 팀의 운영 범위에 맞는 플랜으로 시작하고 필요한 단계에 맞춰 확장할 수 있습니다.
              </p>
            </Reveal>

            {/* Toggle */}
            <Reveal delay={0.1}>
              <div className="flex items-center justify-center gap-4 mb-4">
                <span className="text-sm font-medium" style={{ color: !annual ? P.text1 : P.text4 }}>월간</span>
                <button
                  onClick={() => setAnnual(!annual)}
                  className="w-14 h-7 rounded-full p-1 flex items-center relative transition-colors"
                  style={{ backgroundColor: annual ? P.blue : P.bgMuted, border: `1px solid ${P.border}` }}
                >
                  <div className="w-5 h-5 rounded-full transition-all shadow-sm" style={{
                    backgroundColor: annual ? "#FFFFFF" : P.text4,
                    transform: annual ? "translateX(28px)" : "translateX(0)",
                  }} />
                </button>
                <span className="text-sm font-medium" style={{ color: annual ? P.text1 : P.text4 }}>연간</span>
                {annual && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: P.blueSoft, color: P.blueText }}>
                    10% 할인
                  </span>
                )}
              </div>
            </Reveal>
          </div>
        </section>

        {/* ══ Plan cards ════════════════════════════════════════════ */}
        <section className="py-12 md:py-16" style={{ backgroundColor: P.bgSoft }}>
          <div className="max-w-7xl mx-auto px-6 md:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
              {[
                {
                  name: "Starter", desc: "개인 단위 검색과 기본 기록 시작",
                  price: "Free", period: "",
                  features: ["시약·장비 검색 및 후보 저장", "기본 비교 기록", "기본 재고 등록"],
                  cta: "무료 플랜 시작하기", href: "/search", featured: false,
                },
                {
                  name: "Team", desc: "팀 단위 공유와 비교·요청 연결 시작",
                  price: fmt(Math.round(TEAM_MONTHLY * discount)), period: "/월",
                  features: ["최대 5인 팀 공유", "비교 결과·요청 이력 공유", "입고·재고 상태 공동 확인"],
                  cta: "플랜 선택하기", href: "/search", featured: true,
                },
                {
                  name: "Business", desc: "요청, 발주 준비, 입고·재고까지 운영 연결",
                  price: fmt(Math.round(BUSINESS_MONTHLY * discount)), period: "/월",
                  features: ["운영형 비교·요청 생성 흐름", "발주 준비와 운영 이력 관리", "입고 반영 및 재고 운영", "예산·권한 기준 적용"],
                  cta: "플랜 선택하기", href: "/search", featured: false,
                },
                {
                  name: "Enterprise", desc: "조직 기준, 보안, 내부 시스템 연결까지 확장",
                  price: "Custom", period: "",
                  features: ["조직 보안 정책·접근 기준 적용", "내부 시스템 맞춤 연동 지원", "다기관 운영과 전담 지원"],
                  cta: "도입 상담하기", href: "/support", featured: false,
                },
              ].map((plan, i) => (
                <Reveal key={plan.name} delay={i * 0.08}>
                  <PlanCard {...plan} />
                </Reveal>
              ))}
            </div>
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
                    조직 운영에 맞는 도입 범위를 함께 설계합니다. 검색·비교 중심으로 시작하고, 요청·발주·입고·재고 운영까지 확장할 수 있습니다.
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
                      <th className="p-3 md:p-5 text-center text-xs md:text-sm font-semibold whitespace-nowrap" style={{ color: P.text2 }}>Starter</th>
                      <th className="p-3 md:p-5 text-center text-xs md:text-sm font-semibold whitespace-nowrap" style={{ color: P.text1 }}>Team</th>
                      <th className="p-3 md:p-5 text-center text-xs md:text-sm font-bold whitespace-nowrap" style={{ color: P.text1 }}>Business</th>
                      <th className="p-3 md:p-5 text-center text-xs md:text-sm font-semibold whitespace-nowrap" style={{ color: P.text2 }}>Enterprise</th>
                    </tr>
                  </thead>
                  <tbody>
                    {([
                      { feature: "검색·후보 정리", starter: "기본", team: "팀 공유", business: "check", businessLabel: "조직 공용", enterprise: "check", enterpriseLabel: "멀티 조직" },
                      { feature: "비교·선택안 정리", starter: "none", team: "기본", business: "check", businessLabel: "운영형 비교", enterprise: "check", enterpriseLabel: "조직 기준" },
                      { feature: "요청 생성·기록 공유", starter: "none", team: "초안·공유", business: "check", businessLabel: "운영형 관리", enterprise: "check", enterpriseLabel: "조직 기준" },
                      { feature: "발주 준비·운영 큐", starter: "none", team: "none", business: "check", enterprise: "check" },
                      { feature: "입고 반영·재고 운영", starter: "기본 등록", team: "상태 공유", business: "check", businessLabel: "운영 반영", enterprise: "check", enterpriseLabel: "조직 운영" },
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
                  검색·비교 중심으로 먼저 시작하고, 이후 요청·발주 준비·입고·재고 운영까지 확장할 수 있습니다.
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

/* ── Plan Card Component — light design ──────────────────────── */
function PlanCard({
  name, desc, price, period, features, cta, featured, href,
}: {
  name: string;
  desc: string;
  price: string;
  period?: string;
  features: string[];
  cta: string;
  href: string;
  featured?: boolean;
}) {
  if (featured) {
    return (
      <div className="relative">
        {/* MOST POPULAR badge */}
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10 px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest text-white whitespace-nowrap" style={{ backgroundColor: P.blue }}>
          MOST POPULAR
        </div>
        <div
          className="p-9 md:p-10 rounded-3xl flex flex-col h-full transition-shadow duration-200 hover:shadow-[0_24px_56px_rgba(0,0,0,0.2)]"
          style={{
            backgroundColor: D.bg,
            border: `1px solid ${D.border}`,
            boxShadow: "0 20px 48px rgba(0,0,0,0.15)",
          }}
        >
          <div className="mb-7">
            <h3 className="text-2xl font-bold mb-2" style={{ color: D.text1 }}>{name}</h3>
            <p className="text-sm leading-relaxed min-h-[40px]" style={{ color: D.text2 }}>{desc}</p>
          </div>
          <div className="mb-8">
            <span className="text-[30px] font-bold leading-none" style={{ color: D.text1 }}>{price}</span>
            {period && <span className="text-sm ml-1" style={{ color: D.text2 }}>{period}</span>}
          </div>
          <ul className="flex flex-col gap-4 mb-12 flex-grow">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-[15px]">
                <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: P.green }} />
                <span style={{ color: D.text1 }}>{f}</span>
              </li>
            ))}
          </ul>
          <Link href={href}>
            <button className="w-full py-4 rounded-xl font-bold text-white text-base transition-all hover:brightness-110 active:scale-[0.98] flex items-center justify-center gap-2" style={{ backgroundColor: P.blue }}>
              {cta} <ArrowRight className="h-4 w-4" />
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="p-9 md:p-10 rounded-3xl flex flex-col h-full transition-all duration-200 hover:translate-y-[-4px] hover:shadow-xl"
      style={{
        backgroundColor: P.bg,
        border: `1px solid ${P.border}`,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <div className="mb-7">
        <h3 className="text-2xl font-bold mb-2" style={{ color: P.text1 }}>{name}</h3>
        <p className="text-sm leading-relaxed min-h-[40px]" style={{ color: P.text3 }}>{desc}</p>
      </div>
      <div className="mb-8">
        <span className="text-[30px] font-bold leading-none" style={{ color: P.text1 }}>{price}</span>
        {period && <span className="text-sm ml-1" style={{ color: P.text3 }}>{period}</span>}
      </div>
      <ul className="flex flex-col gap-4 mb-12 flex-grow">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-[15px]">
            <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: P.green }} />
            <span style={{ color: P.text2 }}>{f}</span>
          </li>
        ))}
      </ul>
      <Link href={href}>
        <button className="w-full py-4 rounded-xl font-bold text-base transition-all hover:brightness-95 active:scale-[0.98] flex items-center justify-center gap-2" style={{ color: P.text1, backgroundColor: P.bg, border: `1px solid ${P.text1}` }}>
          {cta} <ArrowRight className="h-4 w-4" />
        </button>
      </Link>
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
