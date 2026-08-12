"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  Search, GitCompare, FileText, ShoppingCart, ClipboardCheck,
  Shield, BarChart3, ArrowRight,
} from "lucide-react";

/* ── Scroll reveal ───────────────────────────────────────────────── */
function Reveal({ children, delay = 0, y = 40, className = "" }: {
  children: ReactNode; delay?: number; y?: number; className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ── Color tokens ────────────────────────────────────────────────── */
const L = {
  bg: "#FFFFFF",
  bgSoft: "#F0F4F8",
  bgMuted: "#E8EDF3",
  text1: "#0F172A",
  text2: "#334155",
  text3: "#64748B",
  text4: "#94A3B8",
  border: "#E2E8F0",
  blue: "#3B82F6",
  blueSoft: "#DBEAFE",
  blueText: "#1D4ED8",
} as const;

const D = {
  bg: "#0B1120",
  text1: "#F1F5F9",
  text2: "#94A3B8",
  primary: "#3B82F6",
  onPrimary: "#FFFFFF",
} as const;


/* ══════════════════════════════════════════════════════════════════
 *  연결 포인트 섹션
 * ══════════════════════════════════════════════════════════════════ */
export function ConnectionSection() {
  return (
    <section className="py-20 md:py-28" style={{ backgroundColor: L.bg, color: L.text1 }}>
      <div className="max-w-5xl mx-auto px-6">
        <Reveal>
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
              끊기지 않는 운영 연결
            </h2>
            <p className="text-base" style={{ color: L.text3 }}>
              각 단계의 결정이 다음 작업으로 자연스럽게 이어집니다.
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { icon: Search, label: "검색 → 후보 정리", pct: 92 },
            { icon: GitCompare, label: "비교 → 선택안 확정", pct: 85 },
            { icon: FileText, label: "요청 생성 → 초안 작성", pct: 78 },
            { icon: ShoppingCart, label: "발주 준비 → 전환 검토", pct: 70 },
            { icon: ClipboardCheck, label: "입고 반영 → Lot 기록", pct: 65 },
          ].map((item, i) => (
            <Reveal key={item.label} delay={i * 0.08}>
              <div className="rounded-xl p-5" style={{ backgroundColor: L.bgSoft, border: `1px solid ${L.border}` }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: L.blueSoft }}>
                    <item.icon className="h-4 w-4" style={{ color: L.blueText }} strokeWidth={1.8} />
                  </div>
                  <span className="text-sm font-semibold" style={{ color: L.text1 }}>{item.label}</span>
                </div>
                <div className="h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: L.bgMuted }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: L.blue }}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${item.pct}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, delay: 0.3 + i * 0.1, ease: "easeOut" }}
                  />
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}


/* ══════════════════════════════════════════════════════════════════
 *  역할별 변화 섹션
 * ══════════════════════════════════════════════════════════════════ */
export function RolesSection() {
  return (
    <section className="py-20 md:py-28" style={{ backgroundColor: L.bgSoft, color: L.text1, borderTop: `1px solid ${L.border}` }}>
      <div className="max-w-5xl mx-auto px-6">
        <Reveal>
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
              도입 후 달라지는 흐름
            </h2>
            <p className="text-base" style={{ color: L.text3 }}>
              역할마다 반복은 줄이고, 연결은 강화합니다.
            </p>
          </div>
        </Reveal>

        <div className="flex flex-col gap-5">
          {[
            {
              role: "연구원",
              before: "여러 벤더를 따로 열고 품목을 수기로 모아 비교 준비",
              after: "검색 결과에서 후보를 바로 정리하고 비교 단계로 이동",
            },
            {
              role: "구매 담당",
              before: "비교 결과를 다시 정리하고 전화·이메일로 수동 요청",
              after: "선택안 기준으로 요청안을 만들고 발주 준비까지 연결",
            },
            {
              role: "운영 관리자",
              before: "구매 이력, 입고 상태, 재고를 각각 다른 문서에서 확인",
              after: "선택 기록, 입고, 재고를 같은 흐름에서 추적",
            },
          ].map((card, i) => (
            <Reveal key={card.role} delay={i * 0.1}>
              <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${L.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                <div className="grid grid-cols-1 md:grid-cols-[140px_1fr_1fr]">
                  <div className="flex items-center justify-center p-5 md:p-6" style={{ backgroundColor: L.blueSoft }}>
                    <span className="text-sm font-bold" style={{ color: L.blueText }}>{card.role}</span>
                  </div>
                  <div className="p-5 md:p-6" style={{ backgroundColor: L.bgSoft }}>
                    <p className="text-[11px] font-bold tracking-wide uppercase mb-2" style={{ color: L.text4 }}>이전</p>
                    <p className="text-sm" style={{ color: L.text2 }}>{card.before}</p>
                  </div>
                  <div className="p-5 md:p-6" style={{ backgroundColor: L.bg }}>
                    <p className="text-[11px] font-bold tracking-wide uppercase mb-2" style={{ color: L.blue }}>LabAxis 이후</p>
                    <p className="text-sm font-medium" style={{ color: L.text1 }}>{card.after}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}


/* ══════════════════════════════════════════════════════════════════
 *  데이터 시각화 섹션
 * ══════════════════════════════════════════════════════════════════ */
export function DataSection() {
  return (
    <section className="py-20 md:py-28" style={{ backgroundColor: L.bg, color: L.text1, borderTop: `1px solid ${L.border}` }}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <Reveal>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: L.blueSoft }}>
                <BarChart3 className="h-5 w-5" style={{ color: L.blueText }} strokeWidth={1.8} />
              </div>
              <span className="text-sm font-bold tracking-wide" style={{ color: L.blue }}>Data Visualization</span>
            </div>
            <h3 className="text-2xl md:text-3xl font-bold mb-4 leading-tight">
              운영 데이터가 쌓이면<br />다음 판단이 빨라집니다
            </h3>
            <p className="text-base leading-relaxed" style={{ color: L.text2 }}>
              품목별 구매 빈도, 공급사 조건 비교, 입고 이후 재고 흐름을 함께 보며 다음 구매 판단에 필요한 근거를 쌓습니다.
            </p>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: L.bg, border: `1px solid ${L.border}`, boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
              <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${L.border}` }}>
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#EF4444" }} />
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#F59E0B" }} />
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#22C55E" }} />
                </div>
                <span className="text-[10px] font-medium" style={{ color: L.text4 }}>구매 의사결정 효율 · 최근 8주</span>
              </div>

              <div className="grid grid-cols-3 gap-px" style={{ backgroundColor: L.border }}>
                {[
                  { label: "평균 소요 시간", value: "2.1일", change: "8주 전 대비 −58%" },
                  { label: "주간 처리 건수", value: "34건", change: "8주 전 대비 +142%" },
                  { label: "재사용 선택안", value: "68%", change: "이전 결정 기반 비율" },
                ].map((kpi) => (
                  <div key={kpi.label} className="px-4 py-3" style={{ backgroundColor: L.bg }}>
                    <p className="text-[9px] uppercase tracking-wider font-semibold mb-0.5" style={{ color: L.text4 }}>{kpi.label}</p>
                    <p className="text-sm font-bold" style={{ color: L.text1 }}>{kpi.value}</p>
                    <p className="text-[10px] font-medium" style={{ color: L.blue }}>{kpi.change}</p>
                  </div>
                ))}
              </div>

              <div className="px-6 pt-5 pb-4">
                <div className="flex gap-3">
                  <div className="flex flex-col justify-between h-36 text-[9px] font-medium pr-1 w-7 flex-shrink-0" style={{ color: L.text4 }}>
                    <span>40</span><span>20</span><span>0</span>
                  </div>
                  <div className="flex-1 relative">
                    <div className="flex items-end gap-1.5 h-36">
                      {[35, 42, 50, 55, 65, 72, 80, 88].map((bar, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center">
                          <motion.div
                            className="w-full rounded-t-md"
                            style={{ backgroundColor: i >= 6 ? L.blue : L.blueSoft }}
                            initial={{ height: 0 }}
                            whileInView={{ height: `${bar}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.3 + i * 0.08, ease: "easeOut" }}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="absolute inset-0 flex items-stretch pointer-events-none">
                      {[5.0, 4.5, 4.1, 3.6, 3.0, 2.7, 2.3, 2.1].map((days, i) => {
                        const pct = ((days - 1.5) / 4.0) * 100;
                        return (
                          <div key={i} className="flex-1 relative flex justify-center">
                            <motion.div
                              className="absolute w-2.5 h-2.5 rounded-full border-2"
                              style={{
                                top: `${Math.max(5, Math.min(85, pct))}%`,
                                backgroundColor: "#F97316",
                                borderColor: L.bg,
                                boxShadow: "0 1px 4px rgba(249,115,22,0.4)",
                              }}
                              initial={{ opacity: 0, scale: 0 }}
                              whileInView={{ opacity: 1, scale: 1 }}
                              viewport={{ once: true }}
                              transition={{ duration: 0.3, delay: 0.6 + i * 0.08 }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex flex-col justify-between h-36 text-[9px] font-medium pl-1 w-7 flex-shrink-0" style={{ color: "#F97316" }}>
                    <span>5일</span><span>3일</span><span>1일</span>
                  </div>
                </div>
                <div className="flex mt-2" style={{ marginLeft: "28px", marginRight: "28px" }}>
                  {["1주", "2주", "3주", "4주", "5주", "6주", "7주", "8주"].map((w) => (
                    <span key={w} className="flex-1 text-center text-[9px] font-medium" style={{ color: L.text4 }}>{w}</span>
                  ))}
                </div>
                <div className="flex items-center gap-5 mt-4 pt-3" style={{ borderTop: `1px solid ${L.border}` }}>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: L.blue }} />
                    <span className="text-[10px] font-medium" style={{ color: L.text3 }}>주간 처리 건수</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#F97316" }} />
                    <span className="text-[10px] font-medium" style={{ color: L.text3 }}>평균 소요일</span>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}


/* ══════════════════════════════════════════════════════════════════
 *  Closing CTA 섹션
 * ══════════════════════════════════════════════════════════════════ */
export function ClosingCTASection() {
  return (
    <section className="py-20 md:py-28 relative overflow-hidden" style={{ backgroundColor: D.bg, color: D.text1 }}>
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "radial-gradient(rgba(148,163,184,0.08) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(circle at center, rgba(59,130,246,0.06), transparent 55%)",
      }} />

      <Reveal>
        <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-5 tracking-tight">
            지금 시작할 수 있습니다.
          </h2>
          <p className="text-base md:text-lg mb-10" style={{ color: D.text2 }}>
            검색부터 재고 운영까지, 조직에 맞는 범위부터 도입하세요.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/pricing">
              <button className="w-full sm:w-auto px-8 py-4 text-base font-bold rounded-xl transition-all hover:brightness-110 active:scale-[0.98]" style={{ backgroundColor: D.primary, color: D.onPrimary }}>
                요금 &amp; 플랜 보기
              </button>
            </Link>
            <Link href="/support">
              <button className="w-full sm:w-auto px-8 py-4 text-base font-bold rounded-xl transition-all hover:brightness-110 active:scale-[0.98] flex items-center gap-2" style={{ color: D.text1, border: "1px solid rgba(255,255,255,0.15)" }}>
                도입 상담 <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
