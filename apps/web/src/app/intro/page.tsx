import { MainLayout } from "../_components/main-layout";
import { MainHeader } from "../_components/main-header";
import { MainFooter } from "../_components/main-footer";
import {
  Search, GitCompare, FileText, Package, ArrowRight, ChevronRight,
  ShoppingCart, ClipboardCheck, Warehouse,
  AlertTriangle, Clock, PackageX,
  Microscope, Users, ShieldCheck,
  KeyRound, CheckSquare, ScrollText, Wallet,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";

const ComparisonSection = dynamic(
  () => import("../_components/comparison-section").then((mod) => ({ default: mod.ComparisonSection })),
  { loading: () => <div className="h-96 w-full bg-pg" /> }
);
const FinalCTASection = dynamic(
  () => import("../_components/final-cta-section").then((mod) => ({ default: mod.FinalCTASection })),
  { loading: () => <div className="h-64 w-full bg-pg" /> }
);

export default function IntroPage() {
  return (
    <MainLayout>
      <MainHeader />
      <div className="w-full">

        {/* ══ 1. Hero ══════════════════════════════════════════════════════ */}
        <section className="relative pt-20 pb-10 md:pt-28 md:pb-20 bg-pg overflow-hidden">
          {/* Grid background */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.04]" style={{
            backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }} />

          <div className="relative mx-auto max-w-6xl px-4 md:px-6 flex flex-col md:flex-row md:items-center md:gap-12">
            {/* Left copy */}
            <div className="flex-1 min-w-0">
              {/* Eyebrow */}
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-teal-400 bg-pn border border-bd rounded-full px-3 py-1.5 mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 flex-shrink-0" />
                연구실 구매 운영 플랫폼
              </div>

              {/* Headline */}
              <h1 className="text-[28px] md:text-5xl font-extrabold tracking-tight text-slate-100 mb-4 leading-snug break-keep">
                시약·장비 검색부터<br />
                <span className="text-blue-400">구매 운영</span>까지 한곳에서
              </h1>
              <p className="hidden md:block text-lg text-slate-300 mb-8 leading-relaxed max-w-xl break-keep">
                반복 검색, 수기 견적, 재고 공백 — 연구실 구매 운영의 병목을 제거하고
                검색에서 입고까지 하나의 흐름으로 연결합니다.
              </p>
              <p className="md:hidden text-sm text-slate-300 mb-5 leading-relaxed break-keep">
                반복 검색, 수기 견적, 재고 공백을 제거하고 구매 운영을 하나의 흐름으로 연결합니다.
              </p>

              {/* Flow chips */}
              <div className="hidden md:flex flex-wrap items-center gap-1.5">
                {[
                  { label: "통합 검색", icon: Search, color: "text-blue-400" },
                  { label: "제품 비교", icon: GitCompare, color: "text-violet-400" },
                  { label: "견적 요청", icon: FileText, color: "text-teal-400" },
                  { label: "발주·입고", icon: ShoppingCart, color: "text-amber-400" },
                  { label: "재고 운영", icon: Package, color: "text-slate-300" },
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-300 bg-pn border border-bd rounded-lg px-3 py-1.5">
                      <step.icon className={`h-3 w-3 ${step.color} flex-shrink-0`} />
                      {step.label}
                    </div>
                    {i < 4 && <ChevronRight className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />}
                  </div>
                ))}
              </div>
            </div>

            {/* Right: mini UI mockup (desktop) */}
            <div className="hidden md:flex flex-col gap-2 flex-shrink-0 w-[380px]">
              <div className="bg-pn rounded-xl border border-bd shadow-md p-3">
                <div className="flex items-center gap-2 bg-pg border border-bd rounded-lg px-3 py-2 mb-3">
                  <Search className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-sm text-slate-400">PBS buffer 10x, 500ml</span>
                </div>
                {[
                  { brand: "Sigma-Aldrich", name: "PBS 10X, pH 7.4 (500mL)", price: "\u20A938,000", lead: "3\uC77C", badge: "\uCD5C\uC800\uAC00" },
                  { brand: "Thermo Fisher", name: "Dulbecco\u2019s PBS 10X (500mL)", price: "\u20A941,500", lead: "5\uC77C", badge: "" },
                  { brand: "Bio-Rad", name: "10X PBS Concentrate (500mL)", price: "\u20A945,200", lead: "7\uC77C", badge: "" },
                ].map((item, i) => (
                  <div key={i} className={`flex items-center gap-2.5 px-2 py-2 rounded-lg ${i === 0 ? "bg-el" : "hover:bg-el"} ${i < 2 ? "mb-1" : ""}`}>
                    <div className="w-7 h-7 rounded-md bg-st flex-shrink-0 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-slate-400">{item.brand.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-100 truncate">{item.name}</p>
                      <p className="text-[10px] text-slate-400">{item.brand} · \uB0A9\uAE30 {item.lead}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold text-slate-100">{item.price}</p>
                      {item.badge && (
                        <span className="text-[9px] font-semibold text-teal-400 bg-pn border border-bd px-1.5 py-0.5 rounded-full">{item.badge}</span>
                      )}
                    </div>
                  </div>
                ))}
                <div className="mt-2 flex gap-2">
                  <div className="flex-1 h-8 rounded-lg bg-blue-600 flex items-center justify-center gap-1">
                    <GitCompare className="h-3 w-3 text-slate-100" />
                    <span className="text-[11px] font-semibold text-slate-100">\uBE44\uAD50 \uBAA9\uB85D\uC5D0 \uCD94\uAC00</span>
                  </div>
                  <div className="h-8 px-3 rounded-lg border border-bd flex items-center">
                    <span className="text-[11px] text-slate-300">\uACAC\uC801 \uC694\uCCAD</span>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 text-center">\uC2E4\uC81C \uC81C\uD488 \uAC80\uC0C9·\uBE44\uAD50·\uACAC\uC801 \uD654\uBA74</p>
            </div>
          </div>
        </section>

        {/* ══ 2. 운영 문제 — 현재 연구실 구매 운영의 병목 ═════════════════ */}
        <section className="py-10 md:py-16 bg-pn border-b border-bd">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="mb-6 md:mb-10">
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1 md:mb-2">\uC6B4\uC601 \uBCD1\uBAA9</p>
              <h2 className="text-xl md:text-3xl font-bold text-slate-100 break-keep">
                \uD604\uC7AC \uC5F0\uAD6C\uC2E4 \uAD6C\uB9E4 \uC6B4\uC601\uC758 \uBCD1\uBAA9
              </h2>
              <p className="text-sm md:text-base text-slate-400 mt-2 max-w-2xl break-keep">
                \uBC18\uBCF5\uB418\uB294 \uBE44\uD6A8\uC728\uC774 \uC5F0\uAD6C \uC2DC\uAC04\uC744 \uAE4E\uC544\uBA39\uACE0 \uC788\uC2B5\uB2C8\uB2E4.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6">
              {[
                {
                  icon: Clock,
                  iconColor: "text-amber-400",
                  title: "\uBC18\uBCF5 \uAC80\uC0C9",
                  desc: "\uBCA4\uB354 \uC0AC\uC774\uD2B8 10\uAC1C \uC774\uC0C1\uC744 \uC77C\uC77C\uC774 \uBC29\uBB38\uD574 \uAC19\uC740 \uC2DC\uC57D\uC744 \uAC80\uC0C9\uD569\uB2C8\uB2E4. \uAC74\uB2F9 30\uBD84 \uC774\uC0C1 \uC18C\uC694.",
                  stat: "\uAC74\uB2F9 30\uBD84+",
                },
                {
                  icon: AlertTriangle,
                  iconColor: "text-red-400",
                  title: "\uC218\uAE30 \uACAC\uC801",
                  desc: "\uC774\uBA54\uC77C·\uC804\uD654\uB85C \uACAC\uC801\uC744 \uC218\uC9D1\uD558\uACE0, \uC5D1\uC140\uC5D0 \uC218\uAE30\uB85C \uC815\uB9AC\uD569\uB2C8\uB2E4. \uBC84\uC804 \uAD00\uB9AC\uC640 \uBE44\uAD50\uAC00 \uBD88\uAC00\uB2A5.",
                  stat: "\uAC74\uB2F9 45\uBD84+",
                },
                {
                  icon: PackageX,
                  iconColor: "text-red-400",
                  title: "\uC7AC\uACE0 \uACF5\uBC31",
                  desc: "\uAD6C\uB9E4 \uC644\uB8CC \uD6C4 \uC7AC\uACE0 \uBC18\uC601\uC774 \uB204\uB77D\uB429\uB2C8\uB2E4. \uC720\uD6A8\uAE30\uAC04 \uB9CC\uB8CC·\uC548\uC804\uC7AC\uACE0 \uBD80\uC871\uC744 \uB4A4\uB2A6\uAC8C \uBC1C\uACAC.",
                  stat: "\uC5F0\uAC04 15%+ \uC190\uC2E4",
                },
              ].map((item, i) => (
                <div key={i} className="bg-pg border border-bd rounded-xl p-4 md:p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-el flex items-center justify-center flex-shrink-0">
                      <item.icon className={`h-4.5 w-4.5 ${item.iconColor}`} strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-100">{item.title}</h3>
                      <span className="text-[10px] font-semibold text-amber-400">{item.stat}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed break-keep">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ 3. LabAxis 운영 흐름 — 6단계 파이프라인 ═══════════════════ */}
        <section className="py-10 md:py-16 bg-pg border-b border-bd">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="mb-6 md:mb-10">
              <p className="text-xs font-semibold text-teal-400 uppercase tracking-wider mb-1 md:mb-2">\uC6B4\uC601 \uD750\uB984</p>
              <h2 className="text-xl md:text-3xl font-bold text-slate-100 break-keep">
                \uAC80\uC0C9 \u2192 \uBE44\uAD50 \u2192 \uACAC\uC801 \u2192 \uBC1C\uC8FC \u2192 \uC785\uACE0 \u2192 \uC7AC\uACE0
              </h2>
              <p className="text-sm md:text-base text-slate-400 mt-2 max-w-2xl break-keep">
                LabAxis\uB294 \uC5F0\uAD6C\uC2E4 \uAD6C\uB9E4\uC758 \uC804 \uACFC\uC815\uC744 \uD558\uB098\uC758 \uD30C\uC774\uD504\uB77C\uC778\uC73C\uB85C \uC5F0\uACB0\uD569\uB2C8\uB2E4.
              </p>
            </div>

            {/* Mobile: vertical list */}
            <div className="md:hidden space-y-2">
              {[
                { num: 1, icon: Search, title: "\uD1B5\uD569 \uAC80\uC0C9", change: "\uBCA4\uB354 10\uACF3 \u2192 \uD55C \uBC88\uC5D0 \uAC80\uC0C9", color: "text-blue-400", dot: "bg-blue-500" },
                { num: 2, icon: GitCompare, title: "\uC81C\uD488 \uBE44\uAD50", change: "\uC5D1\uC140 \uC815\uB9AC \u2192 \uBE44\uAD50\uD45C \uC790\uB3D9 \uC0DD\uC131", color: "text-violet-400", dot: "bg-violet-500" },
                { num: 3, icon: FileText, title: "\uACAC\uC801 \uC694\uCCAD", change: "\uC774\uBA54\uC77C \uC218\uC9D1 \u2192 \uD074\uB9AD \uD55C \uBC88\uC73C\uB85C \uC804\uC1A1", color: "text-teal-400", dot: "bg-teal-500" },
                { num: 4, icon: ShoppingCart, title: "\uBC1C\uC8FC", change: "\uC218\uAE30 \uBC1C\uC8FC \u2192 \uC2B9\uC778 \uD6C4 \uC790\uB3D9 \uBC1C\uC8FC", color: "text-amber-400", dot: "bg-amber-500" },
                { num: 5, icon: ClipboardCheck, title: "\uC785\uACE0 \uAC80\uC218", change: "\uC218\uAE30 \uD655\uC778 \u2192 \uC785\uACE0 \uC2A4\uCE94\uC73C\uB85C \uC790\uB3D9 \uBC18\uC601", color: "text-emerald-400", dot: "bg-emerald-500" },
                { num: 6, icon: Warehouse, title: "\uC7AC\uACE0 \uC6B4\uC601", change: "\uC5D1\uC140 \uAD00\uB9AC \u2192 Lot·\uC720\uD6A8\uAE30\uAC04 \uC790\uB3D9 \uCD94\uC801", color: "text-slate-300", dot: "bg-slate-500" },
              ].map((step) => (
                <div key={step.num} className="flex items-start gap-2.5 px-3 py-2.5 bg-pn rounded-lg border border-bd">
                  <div className={`shrink-0 w-5 h-5 rounded-full ${step.dot} text-slate-100 text-[10px] font-bold flex items-center justify-center mt-0.5`}>{step.num}</div>
                  <div className="min-w-0">
                    <span className="font-semibold text-xs text-slate-100">{step.title}</span>
                    <p className="text-[10px] text-slate-400 leading-tight">{step.change}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: 6-column pipeline */}
            <div className="hidden md:grid md:grid-cols-6 gap-3">
              {[
                { num: 1, icon: Search, title: "\uD1B5\uD569 \uAC80\uC0C9", change: "\uBCA4\uB354 10\uACF3 \u2192 \uD55C \uBC88\uC5D0", color: "text-blue-400", dot: "bg-blue-500" },
                { num: 2, icon: GitCompare, title: "\uC81C\uD488 \uBE44\uAD50", change: "\uC5D1\uC140 \u2192 \uBE44\uAD50\uD45C \uC790\uB3D9", color: "text-violet-400", dot: "bg-violet-500" },
                { num: 3, icon: FileText, title: "\uACAC\uC801 \uC694\uCCAD", change: "\uC774\uBA54\uC77C \u2192 \uD074\uB9AD \uD55C \uBC88", color: "text-teal-400", dot: "bg-teal-500" },
                { num: 4, icon: ShoppingCart, title: "\uBC1C\uC8FC", change: "\uC218\uAE30 \u2192 \uC2B9\uC778 \uD6C4 \uBC1C\uC8FC", color: "text-amber-400", dot: "bg-amber-500" },
                { num: 5, icon: ClipboardCheck, title: "\uC785\uACE0 \uAC80\uC218", change: "\uC218\uAE30 \u2192 \uC2A4\uCE94 \uBC18\uC601", color: "text-emerald-400", dot: "bg-emerald-500" },
                { num: 6, icon: Warehouse, title: "\uC7AC\uACE0 \uC6B4\uC601", change: "\uC5D1\uC140 \u2192 \uC790\uB3D9 \uCD94\uC801", color: "text-slate-300", dot: "bg-slate-500" },
              ].map((step, i) => (
                <div key={step.num} className="relative">
                  <div className="bg-pn border border-bd rounded-xl p-4 h-full flex flex-col items-center text-center">
                    <div className={`w-10 h-10 rounded-full ${step.dot} text-slate-100 text-sm font-bold flex items-center justify-center mb-3`}>
                      {step.num}
                    </div>
                    <step.icon className={`h-5 w-5 ${step.color} mb-2`} strokeWidth={1.5} />
                    <h3 className="text-sm font-bold text-slate-100 mb-1">{step.title}</h3>
                    <p className="text-[11px] text-slate-400 leading-snug">{step.change}</p>
                  </div>
                  {i < 5 && (
                    <div className="absolute -right-2 top-1/2 -translate-y-1/2 z-10">
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ 4. 비교표 ═══════════════════════════════════════════════════ */}
        <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
          <ComparisonSection />
        </div>

        {/* ══ 5. 역할별 변화 ══════════════════════════════════════════════ */}
        <section className="py-10 md:py-16 bg-pn border-b border-bd">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="mb-6 md:mb-10">
              <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-1 md:mb-2">\uC5ED\uD560\uBCC4 \uBCC0\uD654</p>
              <h2 className="text-xl md:text-3xl font-bold text-slate-100 break-keep">
                LabAxis \uB3C4\uC785 \uD6C4, \uAC01 \uC5ED\uD560\uC740 \uC774\uB807\uAC8C \uB2EC\uB77C\uC9D1\uB2C8\uB2E4
              </h2>
              <p className="text-sm md:text-base text-slate-400 mt-2 max-w-2xl break-keep">
                \uC5F0\uAD6C\uC6D0\uBD80\uD130 \uAD00\uB9AC\uC790\uAE4C\uC9C0, \uAC01 \uC5ED\uD560\uC5D0 \uB9DE\uB294 \uC6B4\uC601 \uBCC0\uD654\uB97C \uD655\uC778\uD558\uC138\uC694.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6">
              {/* 연구원 */}
              <div className="bg-pg border border-bd rounded-xl p-4 md:p-6 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-el flex items-center justify-center flex-shrink-0">
                    <Microscope className="h-5 w-5 text-amber-400" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">\uC5F0\uAD6C\uC6D0</p>
                    <h3 className="text-sm font-bold text-slate-100">\uC2E4\uD5D8 \uC900\uBE44 \uC2DC\uAC04 \uB2E8\uCD95</h3>
                  </div>
                </div>
                <div className="rounded-lg bg-pn border border-bd p-3">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">\uAE30\uC874</p>
                  <ul className="space-y-1">
                    {["\uBCA4\uB354 \uC0AC\uC774\uD2B8 10+\uAC1C \uBC18\uBCF5 \uBC29\uBB38", "\uC2A4\uD399 \uBE44\uAD50\uB97C \uC5D1\uC140\uC5D0 \uC218\uAE30 \uC815\uB9AC"].map((t, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-slate-400">
                        <span className="text-slate-400 mt-0.5">\u00B7</span>{t}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg bg-pn border border-bd p-3">
                  <p className="text-[10px] font-semibold text-teal-400 uppercase tracking-wider mb-1.5">LabAxis</p>
                  <ul className="space-y-1">
                    {["\uD1B5\uD569 \uAC80\uC0C9\uC73C\uB85C \uD6C4\uBCF4 \uD55C \uBC88\uC5D0 \uD655\uC778", "\uD504\uB85C\uD1A0\uCF5C \uBD99\uC5EC\uB123\uAE30 \u2192 \uD544\uC694 \uC2DC\uC57D \uC790\uB3D9 \uCD94\uCD9C"].map((t, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-teal-300 font-medium">
                        <CheckCircle2 className="h-3 w-3 text-teal-400 mt-0.5 flex-shrink-0" />{t}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* 구매 담당자 */}
              <div className="bg-pg border border-bd rounded-xl p-4 md:p-6 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-el flex items-center justify-center flex-shrink-0">
                    <ShoppingCart className="h-5 w-5 text-violet-400" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider">\uAD6C\uB9E4 \uB2F4\uB2F9\uC790</p>
                    <h3 className="text-sm font-bold text-slate-100">\uACAC\uC801 \uC218\uC9D1·\uBE44\uAD50 \uC790\uB3D9\uD654</h3>
                  </div>
                </div>
                <div className="rounded-lg bg-pn border border-bd p-3">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">\uAE30\uC874</p>
                  <ul className="space-y-1">
                    {["\uBCA4\uB354\uBCC4 \uACAC\uC801 \uC218\uC9D1\u00B7\uC815\uB9AC\uC5D0 \uAC74\uB2F9 45\uBD84+", "\uACAC\uC801 \uBC84\uC804 \uAD00\uB9AC\uAC00 \uC774\uBA54\uC77C\u00B7\uD30C\uC77C\uC5D0 \uBD84\uC0B0"].map((t, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-slate-400">
                        <span className="text-slate-400 mt-0.5">\u00B7</span>{t}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg bg-pn border border-bd p-3">
                  <p className="text-[10px] font-semibold text-teal-400 uppercase tracking-wider mb-1.5">LabAxis</p>
                  <ul className="space-y-1">
                    {["\uD1B5\uD569 \uACAC\uC801 \uC694\uCCAD \u2014 \uAC00\uACA9 \uBE44\uAD50\uD45C \uC790\uB3D9 \uC0DD\uC131", "\uAD6C\uB9E4 \uC774\uB825\u00B7\uACF5\uAE09\uC0AC \uC751\uB2F5 \uD1B5\uD569 \uAD00\uB9AC"].map((t, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-teal-300 font-medium">
                        <CheckCircle2 className="h-3 w-3 text-teal-400 mt-0.5 flex-shrink-0" />{t}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* 관리자 */}
              <div className="bg-pg border border-bd rounded-xl p-4 md:p-6 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-el flex items-center justify-center flex-shrink-0">
                    <Users className="h-5 w-5 text-teal-400" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-teal-400 uppercase tracking-wider">\uAD00\uB9AC\uC790</p>
                    <h3 className="text-sm font-bold text-slate-100">\uC608\uC0B0\u00B7\uAD8C\uD55C\u00B7\uC774\uB825 \uD1B5\uC81C</h3>
                  </div>
                </div>
                <div className="rounded-lg bg-pn border border-bd p-3">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">\uAE30\uC874</p>
                  <ul className="space-y-1">
                    {["\uAD6C\uB9E4 \uD604\uD669\uC744 \uC5D1\uC140\uB85C \uC9D1\uACC4, \uC2E4\uC2DC\uAC04 \uD30C\uC545 \uBD88\uAC00", "\uC2B9\uC778 \uD504\uB85C\uC138\uC2A4\uAC00 \uAD6C\uB450\u00B7\uBB38\uC11C \uAE30\uBC18"].map((t, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-slate-400">
                        <span className="text-slate-400 mt-0.5">\u00B7</span>{t}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg bg-pn border border-bd p-3">
                  <p className="text-[10px] font-semibold text-teal-400 uppercase tracking-wider mb-1.5">LabAxis</p>
                  <ul className="space-y-1">
                    {["\uC2E4\uC2DC\uAC04 \uC608\uC0B0 \uC18C\uC9C4 \uD604\uD669 + \uC2B9\uC778 \uB77C\uC778 \uC790\uB3D9\uD654", "Audit Trail\uB85C \uAD6C\uB9E4 \uC774\uB825 \uC804\uAC74 \uCD94\uC801"].map((t, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-teal-300 font-medium">
                        <CheckCircle2 className="h-3 w-3 text-teal-400 mt-0.5 flex-shrink-0" />{t}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ 6. 통제·추적·승인 — 조직 운영 기능 ═════════════════════════ */}
        <section className="py-10 md:py-16 bg-pg border-b border-bd">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="mb-6 md:mb-10">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 md:mb-2">\uC870\uC9C1 \uC6B4\uC601</p>
              <h2 className="text-xl md:text-3xl font-bold text-slate-100 break-keep">
                \uD1B5\uC81C\u00B7\uCD94\uC801\u00B7\uC2B9\uC778 \u2014 \uC870\uC9C1 \uC6B4\uC601\uC744 \uC704\uD55C \uAE30\uBC18
              </h2>
              <p className="text-sm md:text-base text-slate-400 mt-2 max-w-2xl break-keep">
                \uC5ED\uD560 \uAE30\uBC18 \uAD8C\uD55C, \uC2B9\uC778 \uB77C\uC778, \uAC10\uC0AC \uC774\uB825, \uC608\uC0B0 \uD1B5\uD569\uC73C\uB85C \uC870\uC9C1\uC758 \uAD6C\uB9E4 \uD504\uB85C\uC138\uC2A4\uB97C \uCCB4\uACC4\uD654\uD569\uB2C8\uB2E4.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6 mb-6 md:mb-8">
              {[
                {
                  icon: KeyRound,
                  iconColor: "text-amber-400",
                  title: "\uC5ED\uD560 \uAE30\uBC18 \uAD8C\uD55C \uC81C\uC5B4",
                  desc: "\uC870\uC9C1\uC6D0\uBCC4 \uAD8C\uD55C\uC744 \uC138\uBC00\uD558\uAC8C \uC124\uC815\uD569\uB2C8\uB2E4. \uACAC\uC801 \uC694\uCCAD\u00B7\uC2B9\uC778\u00B7\uAD00\uB9AC\uC790 \uC5ED\uD560\uC744 \uBD84\uB9AC\uD558\uC5EC \uB0B4\uBD80 \uAD6C\uB9E4 \uD504\uB85C\uC138\uC2A4\uC5D0 \uB9DE\uAC8C \uC6B4\uC601\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.",
                },
                {
                  icon: CheckSquare,
                  iconColor: "text-violet-400",
                  title: "\uC2B9\uC778 \uB77C\uC778",
                  desc: "\uACAC\uC801 \uC694\uCCAD\u00B7\uBC1C\uC8FC \uC804 \uC2B9\uC778 \uB2E8\uACC4\uB97C \uC124\uC815\uD569\uB2C8\uB2E4. \uAE08\uC561 \uAE30\uC900 \uC790\uB3D9 \uB77C\uC6B0\uD305, \uC2B9\uC778\uC790 \uC9C0\uC815 \uBC0F \uC5D0\uC2A4\uCEEC\uB808\uC774\uC158\uC744 \uC9C0\uC6D0\uD569\uB2C8\uB2E4.",
                },
                {
                  icon: ScrollText,
                  iconColor: "text-teal-400",
                  title: "Audit Trail",
                  desc: "\uBAA8\uB4E0 \uAD6C\uB9E4 \uD65C\uB3D9\uC774 \uC790\uB3D9\uC73C\uB85C \uAE30\uB85D\uB429\uB2C8\uB2E4. \uB204\uAC00, \uC5B8\uC81C, \uBB34\uC5C7\uC744 \uC694\uCCAD\u00B7\uC2B9\uC778\u00B7\uBC1C\uC8FC\uD588\uB294\uC9C0 \uC804\uAC74 \uCD94\uC801\uD569\uB2C8\uB2E4. GMP/GLP \uAC10\uC0AC \uB300\uBE44\uC5D0 \uD65C\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.",
                },
                {
                  icon: Wallet,
                  iconColor: "text-emerald-400",
                  title: "\uC608\uC0B0 \uD1B5\uD569",
                  desc: "\uBD80\uC11C\u00B7\uD504\uB85C\uC81D\uD2B8\uBCC4 \uC608\uC0B0\uC744 \uC124\uC815\uD558\uACE0 \uC2E4\uC2DC\uAC04 \uC18C\uC9C4 \uD604\uD669\uC744 \uD30C\uC545\uD569\uB2C8\uB2E4. \uC608\uC0B0 \uCD08\uACFC \uC2DC \uC790\uB3D9 \uC54C\uB9BC\uACFC \uBC1C\uC8FC \uCC28\uB2E8\uC744 \uC9C0\uC6D0\uD569\uB2C8\uB2E4.",
                },
              ].map((item, i) => (
                <div key={i} className="bg-pn border border-bd rounded-xl p-4 md:p-6 flex gap-4">
                  <div className="w-10 h-10 rounded-lg bg-el flex items-center justify-center flex-shrink-0">
                    <item.icon className={`h-5 w-5 ${item.iconColor}`} strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-slate-100 mb-1">{item.title}</h3>
                    <p className="text-xs text-slate-300 leading-relaxed break-keep">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* 도입 적합성 체크 */}
            <div className="bg-pn rounded-xl border border-bd p-4 md:p-6">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 md:mb-4">\uB3C4\uC785 \uC801\uD569\uC131 \uCCB4\uD06C</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                {[
                  "\uC5F0\uAD6C\uD300\uACFC \uAD6C\uB9E4\uD300\uC774 \uBD84\uB9AC\uB41C \uC870\uC9C1 \uAD6C\uC870",
                  "GMP/GLP \uD658\uACBD\uC5D0\uC11C Lot \uCD94\uC801 \uBC0F \uC774\uB825 \uAD00\uB9AC \uD544\uC694",
                  "\uC5EC\uB7EC \uBCA4\uB354\uC5D0\uC11C \uC2DC\uC57D\u00B7\uC7A5\uBE44\uB97C \uAD6C\uB9E4\uD558\uB294 \uB2E4\uACF5\uAE09\uC0AC \uD658\uACBD",
                  "\uAD6C\uB9E4 \uD504\uB85C\uC138\uC2A4\uC5D0 \uC2B9\uC778 \uB2E8\uACC4\uAC00 \uD544\uC694\uD55C \uC870\uC9C1",
                  "\uC7AC\uACE0 \uC2E4\uC0AC\u00B7\uC720\uD6A8\uAE30\uAC04 \uAD00\uB9AC\uB97C \uCCB4\uACC4\uD654\uD558\uB824\uB294 \uD300",
                  "\uC218\uAE30 \uC5D1\uC140 \uC911\uC2EC \uAD6C\uB9E4 \uAD00\uB9AC\uB97C \uB514\uC9C0\uD138\uD654\uD558\uB824\uB294 \uC870\uC9C1",
                ].map((item, i) => (
                  <div key={i} className={`flex items-start gap-2 ${i >= 4 ? "hidden md:flex" : ""}`}>
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span className="text-xs md:text-sm text-slate-300 break-keep">{item}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 pt-4 border-t border-bd flex flex-wrap items-center justify-center gap-3">
                <Link href="/pricing">
                  <button className="h-9 px-5 text-sm font-semibold text-blue-400 border border-bd bg-pn hover:bg-el rounded-lg transition-colors">
                    \uC694\uAE08 & \uD50C\uB79C \uBCF4\uAE30
                  </button>
                </Link>
                <Link href="/support">
                  <button className="h-9 px-5 text-sm font-medium text-slate-300 border border-bd hover:bg-el rounded-lg transition-colors">
                    \uB3C4\uC785 \uC0C1\uB2F4 \uBB38\uC758
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ══ 7. Final CTA ════════════════════════════════════════════════ */}
        <FinalCTASection />
      </div>
      <MainFooter />
    </MainLayout>
  );
}
