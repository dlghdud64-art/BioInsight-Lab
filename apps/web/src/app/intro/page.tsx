import { MainLayout } from "../_components/main-layout";
import { MainHeader } from "../_components/main-header";
import { MainFooter } from "../_components/main-footer";
import {
  Search, GitCompare, FileText, ShoppingCart, ClipboardCheck, Warehouse,
  ArrowRight, ChevronRight,
} from "lucide-react";
import Link from "next/link";

/* ── Dual palette ────────────────────────────────────────────────
  Dark (hero + closing CTA):
    deep navy brand-field → restrained blue haze → dark CTA
  Light (editorial body):
    near-white → soft gray-blue → white card → spacing/tonal shift
  Blue = CTA / active only. No green, no amber, no semantic color.
────────────────────────────────────────────────────────────────── */
const D = {
  bg: "#0c1324",
  card: "#1a2240",
  cardHigh: "#243050",
  text1: "#dce1fb",
  text2: "#c2c6d6",
  text3: "#8c909f",
  border: "#424754",
  primary: "#adc6ff",
  primaryFill: "#4d8eff",
  onPrimary: "#002e6a",
} as const;

const L = {
  bg: "#F8FAFC",
  bgSoft: "#F1F5F9",
  bgMuted: "#E8ECF2",
  card: "#FFFFFF",
  text1: "#0F172A",
  text2: "#334155",
  text3: "#64748B",
  text4: "#94A3B8",
  border: "#E2E8F0",
  borderStrong: "#CBD5E1",
  blue: "#3B82F6",
  blueHover: "#2563EB",
  blueSoft: "#DBEAFE",
  blueText: "#1D4ED8",
} as const;

export default function IntroPage() {
  return (
    <MainLayout>
      <MainHeader />
      <div className="w-full">

        {/* ══════════════════════════════════════════════════════════════
            A. Hero — dark anchor
           ══════════════════════════════════════════════════════════════ */}
        <section className="relative pt-32 pb-24 md:pt-40 md:pb-32 overflow-hidden" style={{ backgroundColor: D.bg, color: D.text1 }}>
          <div className="absolute inset-0 z-0 pointer-events-none">
            <div className="absolute inset-0" style={{ background: "radial-gradient(circle at center, rgba(39,95,208,0.12) 0%, transparent 65%)" }} />
          </div>

          <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
            <p className="text-sm font-medium tracking-wide mb-6" style={{ color: D.text3 }}>
              연구 구매 운영 플랫폼
            </p>

            <h1 className="text-4xl sm:text-5xl md:text-[3.5rem] font-bold tracking-tight mb-6 leading-[1.12]">
              시약·장비 검색부터<br />
              구매 운영까지 <span style={{ color: D.primary }}>한 곳에서</span>
            </h1>

            <p className="text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed" style={{ color: D.text2 }}>
              검색, 후보 정리, 비교·선택, 요청, 발주 준비까지<br className="hidden md:block" />
              분리된 구매 작업을 하나의 흐름으로 정리합니다.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/search">
                <button className="w-full sm:w-auto px-7 py-3.5 text-base font-bold rounded-xl transition-all hover:brightness-110 active:scale-95" style={{ backgroundColor: D.primary, color: D.onPrimary }}>
                  제품 시작하기
                </button>
              </Link>
              <Link href="/support">
                <button className="w-full sm:w-auto px-7 py-3.5 text-base font-bold rounded-xl transition-all hover:brightness-110 active:scale-95" style={{ color: D.text1, border: `1px solid ${D.border}40` }}>
                  도입 문의
                </button>
              </Link>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            B. Section 1 — 왜 이 제품이 필요한가 (light editorial)
           ══════════════════════════════════════════════════════════════ */}
        <section className="py-20 md:py-28" style={{ backgroundColor: L.bg, color: L.text1 }}>
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              {/* Left: editorial copy */}
              <div>
                <p className="text-sm font-semibold tracking-wide mb-4" style={{ color: L.blue }}>
                  왜 LabAxis인가
                </p>
                <h2 className="text-3xl md:text-4xl font-bold mb-6 leading-tight tracking-tight" style={{ color: L.text1 }}>
                  검색부터 재고까지,<br />
                  끊기던 구매 흐름을<br />
                  하나로 이어줍니다.
                </h2>
                <p className="text-lg leading-relaxed mb-8" style={{ color: L.text2 }}>
                  시약과 장비를 검색할 때 이미 시작된 구매 맥락이, 비교·선택·요청·입고 과정을 거치며 끊기고, 같은 품목을 다시 찾는 일이 반복됩니다. LabAxis는 이 전체 흐름을 하나의 화면 안에서 이어줍니다.
                </p>
                <div className="flex flex-col gap-4">
                  {[
                    { label: "검색 → 후보 정리", desc: "같은 화면에서 바로 다음 비교 단계로" },
                    { label: "비교·선택 → 요청", desc: "선택 기준과 결정 기록이 이어서 유지" },
                    { label: "발주 → 입고·재고", desc: "운영 상태가 다음 반영까지 끊기지 않음" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full mt-2.5 flex-shrink-0" style={{ backgroundColor: L.blue }} />
                      <div>
                        <span className="font-semibold" style={{ color: L.text1 }}>{item.label}</span>
                        <span className="mx-2" style={{ color: L.text4 }}>—</span>
                        <span style={{ color: L.text3 }}>{item.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: structured visual — flow connection diagram */}
              <div className="rounded-2xl p-6 md:p-8" style={{ backgroundColor: L.card, border: `1px solid ${L.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                <p className="text-xs font-semibold tracking-wide mb-6" style={{ color: L.text4 }}>LabAxis 연결 구조</p>
                <div className="flex flex-col gap-0">
                  {[
                    { step: "검색", action: "후보 저장", connected: true },
                    { step: "비교·선택", action: "선택안 확정", connected: true },
                    { step: "요청 생성", action: "요청안 작성", connected: true },
                    { step: "발주 준비", action: "전환·검토", connected: true },
                    { step: "입고 반영", action: "lot·수령 기록", connected: true },
                    { step: "재고 운영", action: "추적·재주문", connected: false },
                  ].map((row, i) => (
                    <div key={row.step}>
                      <div className="flex items-center gap-4 py-3.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: L.blueSoft, color: L.blueText }}>
                          {String(i + 1).padStart(2, "0")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold text-sm" style={{ color: L.text1 }}>{row.step}</span>
                        </div>
                        <span className="text-sm flex-shrink-0" style={{ color: L.text3 }}>{row.action}</span>
                        <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" style={{ color: L.text4 }} />
                      </div>
                      {row.connected && (
                        <div className="ml-4 h-4 flex items-center">
                          <div className="w-px h-full" style={{ backgroundColor: L.borderStrong }} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            C. Section 2 — 제품 흐름 (soft gray-blue)
           ══════════════════════════════════════════════════════════════ */}
        <section className="py-20 md:py-28" style={{ backgroundColor: L.bgSoft, color: L.text1 }}>
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-14">
              <p className="text-sm font-semibold tracking-wide mb-3" style={{ color: L.blue }}>제품 흐름</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                두 흐름이 하나의 구조 안에서 이어집니다
              </h2>
              <p className="max-w-2xl mx-auto text-lg" style={{ color: L.text2 }}>
                앞단 의사결정과 뒷단 운영 반영이 같은 맥락 위에서 연결됩니다.
              </p>
            </div>

            {/* Two-row flow strip */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Decision flow */}
              <div className="rounded-2xl p-6" style={{ backgroundColor: L.card, border: `1px solid ${L.border}` }}>
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: L.blue }} />
                  <span className="text-xs font-bold tracking-wide uppercase" style={{ color: L.text4 }}>앞단 의사결정</span>
                </div>
                <div className="flex flex-col gap-4">
                  {[
                    { icon: Search, title: "통합 검색", desc: "품목·제조사·카탈로그 기준으로 탐색" },
                    { icon: GitCompare, title: "비교·선택", desc: "대체품, 가격, 조건을 나란히 비교" },
                    { icon: FileText, title: "요청 생성", desc: "선택안 기준으로 요청안 작성" },
                  ].map((step) => (
                    <div key={step.title} className="flex items-start gap-4 p-4 rounded-xl" style={{ backgroundColor: L.bgSoft }}>
                      <step.icon className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: L.text4 }} strokeWidth={1.5} />
                      <div>
                        <p className="font-semibold text-sm mb-0.5" style={{ color: L.text1 }}>{step.title}</p>
                        <p className="text-sm" style={{ color: L.text3 }}>{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Operation flow */}
              <div className="rounded-2xl p-6" style={{ backgroundColor: L.card, border: `1px solid ${L.border}` }}>
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: L.borderStrong }} />
                  <span className="text-xs font-bold tracking-wide uppercase" style={{ color: L.text4 }}>뒷단 운영 반영</span>
                </div>
                <div className="flex flex-col gap-4">
                  {[
                    { icon: ShoppingCart, title: "발주 준비", desc: "전환 상태와 검토 항목 확인" },
                    { icon: ClipboardCheck, title: "입고 반영", desc: "수령 정보와 lot 기록 연결" },
                    { icon: Warehouse, title: "재고 운영", desc: "부족, 만료, 재주문 판단 유지" },
                  ].map((step) => (
                    <div key={step.title} className="flex items-start gap-4 p-4 rounded-xl" style={{ backgroundColor: L.bgSoft }}>
                      <step.icon className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: L.text4 }} strokeWidth={1.5} />
                      <div>
                        <p className="font-semibold text-sm mb-0.5" style={{ color: L.text1 }}>{step.title}</p>
                        <p className="text-sm" style={{ color: L.text3 }}>{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Connecting line between the two */}
            <div className="flex items-center justify-center mt-6 gap-3">
              <div className="h-px flex-1 max-w-[120px]" style={{ backgroundColor: L.borderStrong }} />
              <span className="text-xs font-medium px-3 py-1.5 rounded-full" style={{ color: L.text3, backgroundColor: L.card, border: `1px solid ${L.border}` }}>
                하나의 맥락으로 이어짐
              </span>
              <div className="h-px flex-1 max-w-[120px]" style={{ backgroundColor: L.borderStrong }} />
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            D. Section 3 — 역할별 before/after (lighter neutral)
           ══════════════════════════════════════════════════════════════ */}
        <section className="py-20 md:py-28" style={{ backgroundColor: L.bg, color: L.text1 }}>
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-14">
              <p className="text-sm font-semibold tracking-wide mb-3" style={{ color: L.blue }}>도입 전후 비교</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                역할마다 달라지는 운영 흐름
              </h2>
              <p className="text-lg" style={{ color: L.text2 }}>
                반복 업무는 줄이고, 다음 작업으로 이어지는 연결성을 강화합니다.
              </p>
            </div>

            <div className="flex flex-col gap-8">
              {[
                {
                  role: "연구원",
                  before: "여러 벤더 사이트를 따로 열고 품목을 수기로 모아 비교 준비",
                  after: "검색 결과에서 후보를 바로 정리하고 다음 비교 단계로 이동",
                  summary: "후보 정리 시간 단축",
                },
                {
                  role: "구매 담당",
                  before: "비교 결과를 다시 정리하고 전화·이메일로 요청 초안 수동 작성",
                  after: "선택안 기준으로 요청안을 만들고 발주 준비까지 이어서 확인",
                  summary: "요청 준비 흐름 연결",
                },
                {
                  role: "운영 관리자",
                  before: "구매 이력, 입고 상태, 재고 공백을 각각 다른 문서에서 확인",
                  after: "선택 기록, 입고 반영, 재고 상태를 같은 흐름에서 추적",
                  summary: "운영 추적 일원화",
                },
              ].map((card) => (
                <div key={card.role} className="rounded-2xl p-6 md:p-8" style={{ backgroundColor: L.card, border: `1px solid ${L.border}` }}>
                  <div className="flex flex-col md:flex-row md:items-start gap-6 md:gap-10">
                    {/* Role tag + summary */}
                    <div className="md:w-[180px] flex-shrink-0">
                      <span className="inline-block px-2.5 py-1 rounded-md text-xs font-bold mb-2"
                        style={{ backgroundColor: L.blueSoft, color: L.blueText }}>
                        {card.role}
                      </span>
                      <p className="text-sm font-semibold" style={{ color: L.text1 }}>{card.summary}</p>
                    </div>

                    {/* Before / After side by side */}
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="rounded-xl p-4" style={{ backgroundColor: L.bgSoft }}>
                        <p className="text-[11px] font-semibold tracking-wide uppercase mb-2" style={{ color: L.text4 }}>이전</p>
                        <p className="text-sm leading-relaxed" style={{ color: L.text2 }}>{card.before}</p>
                      </div>
                      <div className="rounded-xl p-4" style={{ backgroundColor: L.blueSoft }}>
                        <p className="text-[11px] font-semibold tracking-wide uppercase mb-2" style={{ color: L.blueText }}>LabAxis 이후</p>
                        <p className="text-sm leading-relaxed font-medium" style={{ color: L.text1 }}>{card.after}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            E. Section 4 — 조직 운영 (soft gray-blue, compact)
           ══════════════════════════════════════════════════════════════ */}
        <section className="py-20 md:py-28" style={{ backgroundColor: L.bgSoft, color: L.text1 }}>
          <div className="max-w-6xl mx-auto px-6">
            <div className="mb-14">
              <p className="text-sm font-semibold tracking-wide mb-3" style={{ color: L.blue }}>운영 관리</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                조직 기준에 맞는 통제와 추적
              </h2>
              <p className="text-lg max-w-3xl" style={{ color: L.text2 }}>
                구매 흐름을 막지 않으면서 승인 기준, 활동 기록, 예산 기준을 유지합니다.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[
                {
                  title: "승인 기준과 권한",
                  desc: "조직 구조에 맞는 승인 기준과 역할별 권한을 정리합니다. 요청과 발주 준비가 팀 운영 방식과 어긋나지 않게 맞춥니다.",
                  tags: ["승인 기준 유지", "역할별 권한", "발주 전환 전 확인"],
                },
                {
                  title: "활동 기록과 이력",
                  desc: "요청, 선택, 승인, 변경 이력을 남겨 팀 내 공유와 사후 확인에 필요한 기준을 유지합니다.",
                  tags: ["이력 추적", "변경 감사", "팀 공유"],
                },
                {
                  title: "예산 기준 연결",
                  desc: "과제별 예산 기준과 구매 이력을 연결해 초과 사용 위험이나 기준 이탈을 빠르게 확인합니다.",
                  tags: ["과제별 예산", "초과 알림", "기준 이탈 감지"],
                },
                {
                  title: "운영 데이터 가시화",
                  desc: "품목별 구매 빈도, 공급사 비교, 입고 이후 재고 흐름을 함께 보며 다음 구매 판단 근거를 쌓습니다.",
                  tags: ["구매 빈도", "공급사 비교", "재고 흐름"],
                },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl p-6" style={{ backgroundColor: L.card, border: `1px solid ${L.border}` }}>
                  <h3 className="text-lg font-bold mb-2" style={{ color: L.text1 }}>{item.title}</h3>
                  <p className="text-sm leading-relaxed mb-4" style={{ color: L.text2 }}>{item.desc}</p>
                  <div className="flex flex-wrap gap-2">
                    {item.tags.map((tag) => (
                      <span key={tag} className="text-xs px-2.5 py-1 rounded-md" style={{ backgroundColor: L.bgSoft, color: L.text3, border: `1px solid ${L.border}` }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            F. Closing CTA — dark close
           ══════════════════════════════════════════════════════════════ */}
        <section className="py-20 md:py-28 relative overflow-hidden" style={{ backgroundColor: D.bg, color: D.text1 }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at center, rgba(59,130,246,0.05), transparent 55%)" }} />
          <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-5 tracking-tight">
              지금 시작할 수 있습니다.
            </h2>
            <p className="text-lg mb-10" style={{ color: D.text2 }}>
              검색부터 재고 운영까지, 조직에 맞는 범위부터 도입하세요.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/pricing">
                <button className="w-full sm:w-auto px-8 py-4 text-base font-bold rounded-xl transition-all hover:brightness-110 active:scale-95" style={{ backgroundColor: D.primary, color: D.onPrimary }}>
                  요금 &amp; 플랜 보기
                </button>
              </Link>
              <Link href="/support">
                <button className="w-full sm:w-auto px-8 py-4 text-base font-bold rounded-xl transition-all hover:brightness-110 active:scale-95 flex items-center gap-2" style={{ color: D.text1, border: `1px solid ${D.border}40` }}>
                  도입 상담 <ArrowRight className="h-4 w-4" />
                </button>
              </Link>
            </div>
          </div>
        </section>

      </div>
      <MainFooter />
    </MainLayout>
  );
}
