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
                  { brand: "Sigma-Aldrich", name: "PBS 10X, pH 7.4 (500mL)", price: "\₩38,000", lead: "3\일", badge: "\최\저\가" },
                  { brand: "Thermo Fisher", name: "Dulbecco\’s PBS 10X (500mL)", price: "\₩41,500", lead: "5\일", badge: "" },
                  { brand: "Bio-Rad", name: "10X PBS Concentrate (500mL)", price: "\₩45,200", lead: "7\일", badge: "" },
                ].map((item, i) => (
                  <div key={i} className={`flex items-center gap-2.5 px-2 py-2 rounded-lg ${i === 0 ? "bg-el" : "hover:bg-el"} ${i < 2 ? "mb-1" : ""}`}>
                    <div className="w-7 h-7 rounded-md bg-st flex-shrink-0 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-slate-400">{item.brand.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-100 truncate">{item.name}</p>
                      <p className="text-[10px] text-slate-400">{item.brand} · \납\기 {item.lead}</p>
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
                    <span className="text-[11px] font-semibold text-slate-100">\비\교 \목\록\에 \추\가</span>
                  </div>
                  <div className="h-8 px-3 rounded-lg border border-bd flex items-center">
                    <span className="text-[11px] text-slate-300">\견\적 \요\청</span>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 text-center">\실\제 \제\품 \검\색·\비\교·\견\적 \화\면</p>
            </div>
          </div>
        </section>

        {/* ══ 2. 운영 문제 — 현재 연구실 구매 운영의 병목 ═════════════════ */}
        <section className="py-10 md:py-16 bg-pn border-b border-bd">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="mb-6 md:mb-10">
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1 md:mb-2">\운\영 \병\목</p>
              <h2 className="text-xl md:text-3xl font-bold text-slate-100 break-keep">
                \현\재 \연\구\실 \구\매 \운\영\의 \병\목
              </h2>
              <p className="text-sm md:text-base text-slate-400 mt-2 max-w-2xl break-keep">
                \반\복\되\는 \비\효\율\이 \연\구 \시\간\을 \깎\아\먹\고 \있\습\니\다.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6">
              {[
                {
                  icon: Clock,
                  iconColor: "text-amber-400",
                  title: "\반\복 \검\색",
                  desc: "\벤\더 \사\이\트 10\개 \이\상\을 \일\일\이 \방\문\해 \같\은 \시\약\을 \검\색\합\니\다. \건\당 30\분 \이\상 \소\요.",
                  stat: "\건\당 30\분+",
                },
                {
                  icon: AlertTriangle,
                  iconColor: "text-red-400",
                  title: "\수\기 \견\적",
                  desc: "\이\메\일·\전\화\로 \견\적\을 \수\집\하\고, \엑\셀\에 \수\기\로 \정\리\합\니\다. \버\전 \관\리\와 \비\교\가 \불\가\능.",
                  stat: "\건\당 45\분+",
                },
                {
                  icon: PackageX,
                  iconColor: "text-red-400",
                  title: "\재\고 \공\백",
                  desc: "\구\매 \완\료 \후 \재\고 \반\영\이 \누\락\됩\니\다. \유\효\기\간 \만\료·\안\전\재\고 \부\족\을 \뒤\늦\게 \발\견.",
                  stat: "\연\간 15%+ \손\실",
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
              <p className="text-xs font-semibold text-teal-400 uppercase tracking-wider mb-1 md:mb-2">\운\영 \흐\름</p>
              <h2 className="text-xl md:text-3xl font-bold text-slate-100 break-keep">
                \검\색 \→ \비\교 \→ \견\적 \→ \발\주 \→ \입\고 \→ \재\고
              </h2>
              <p className="text-sm md:text-base text-slate-400 mt-2 max-w-2xl break-keep">
                LabAxis\는 \연\구\실 \구\매\의 \전 \과\정\을 \하\나\의 \파\이\프\라\인\으\로 \연\결\합\니\다.
              </p>
            </div>

            {/* Mobile: vertical list */}
            <div className="md:hidden space-y-2">
              {[
                { num: 1, icon: Search, title: "\통\합 \검\색", change: "\벤\더 10\곳 \→ \한 \번\에 \검\색", color: "text-blue-400", dot: "bg-blue-500" },
                { num: 2, icon: GitCompare, title: "\제\품 \비\교", change: "\엑\셀 \정\리 \→ \비\교\표 \자\동 \생\성", color: "text-violet-400", dot: "bg-violet-500" },
                { num: 3, icon: FileText, title: "\견\적 \요\청", change: "\이\메\일 \수\집 \→ \클\릭 \한 \번\으\로 \전\송", color: "text-teal-400", dot: "bg-teal-500" },
                { num: 4, icon: ShoppingCart, title: "\발\주", change: "\수\기 \발\주 \→ \승\인 \후 \자\동 \발\주", color: "text-amber-400", dot: "bg-amber-500" },
                { num: 5, icon: ClipboardCheck, title: "\입\고 \검\수", change: "\수\기 \확\인 \→ \입\고 \스\캔\으\로 \자\동 \반\영", color: "text-emerald-400", dot: "bg-emerald-500" },
                { num: 6, icon: Warehouse, title: "\재\고 \운\영", change: "\엑\셀 \관\리 \→ Lot·\유\효\기\간 \자\동 \추\적", color: "text-slate-300", dot: "bg-slate-500" },
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
                { num: 1, icon: Search, title: "\통\합 \검\색", change: "\벤\더 10\곳 \→ \한 \번\에", color: "text-blue-400", dot: "bg-blue-500" },
                { num: 2, icon: GitCompare, title: "\제\품 \비\교", change: "\엑\셀 \→ \비\교\표 \자\동", color: "text-violet-400", dot: "bg-violet-500" },
                { num: 3, icon: FileText, title: "\견\적 \요\청", change: "\이\메\일 \→ \클\릭 \한 \번", color: "text-teal-400", dot: "bg-teal-500" },
                { num: 4, icon: ShoppingCart, title: "\발\주", change: "\수\기 \→ \승\인 \후 \발\주", color: "text-amber-400", dot: "bg-amber-500" },
                { num: 5, icon: ClipboardCheck, title: "\입\고 \검\수", change: "\수\기 \→ \스\캔 \반\영", color: "text-emerald-400", dot: "bg-emerald-500" },
                { num: 6, icon: Warehouse, title: "\재\고 \운\영", change: "\엑\셀 \→ \자\동 \추\적", color: "text-slate-300", dot: "bg-slate-500" },
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
              <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-1 md:mb-2">\역\할\별 \변\화</p>
              <h2 className="text-xl md:text-3xl font-bold text-slate-100 break-keep">
                LabAxis \도\입 \후, \각 \역\할\은 \이\렇\게 \달\라\집\니\다
              </h2>
              <p className="text-sm md:text-base text-slate-400 mt-2 max-w-2xl break-keep">
                \연\구\원\부\터 \관\리\자\까\지, \각 \역\할\에 \맞\는 \운\영 \변\화\를 \확\인\하\세\요.
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
                    <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">\연\구\원</p>
                    <h3 className="text-sm font-bold text-slate-100">\실\험 \준\비 \시\간 \단\축</h3>
                  </div>
                </div>
                <div className="rounded-lg bg-pn border border-bd p-3">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">\기\존</p>
                  <ul className="space-y-1">
                    {["\벤\더 \사\이\트 10+\개 \반\복 \방\문", "\스\펙 \비\교\를 \엑\셀\에 \수\기 \정\리"].map((t, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-slate-400">
                        <span className="text-slate-400 mt-0.5">\·</span>{t}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg bg-pn border border-bd p-3">
                  <p className="text-[10px] font-semibold text-teal-400 uppercase tracking-wider mb-1.5">LabAxis</p>
                  <ul className="space-y-1">
                    {["\통\합 \검\색\으\로 \후\보 \한 \번\에 \확\인", "\프\로\토\콜 \붙\여\넣\기 \→ \필\요 \시\약 \자\동 \추\출"].map((t, i) => (
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
                    <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider">\구\매 \담\당\자</p>
                    <h3 className="text-sm font-bold text-slate-100">\견\적 \수\집·\비\교 \자\동\화</h3>
                  </div>
                </div>
                <div className="rounded-lg bg-pn border border-bd p-3">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">\기\존</p>
                  <ul className="space-y-1">
                    {["\벤\더\별 \견\적 \수\집\·\정\리\에 \건\당 45\분+", "\견\적 \버\전 \관\리\가 \이\메\일\·\파\일\에 \분\산"].map((t, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-slate-400">
                        <span className="text-slate-400 mt-0.5">\·</span>{t}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg bg-pn border border-bd p-3">
                  <p className="text-[10px] font-semibold text-teal-400 uppercase tracking-wider mb-1.5">LabAxis</p>
                  <ul className="space-y-1">
                    {["\통\합 \견\적 \요\청 \— \가\격 \비\교\표 \자\동 \생\성", "\구\매 \이\력\·\공\급\사 \응\답 \통\합 \관\리"].map((t, i) => (
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
                    <p className="text-[10px] font-semibold text-teal-400 uppercase tracking-wider">\관\리\자</p>
                    <h3 className="text-sm font-bold text-slate-100">\예\산\·\권\한\·\이\력 \통\제</h3>
                  </div>
                </div>
                <div className="rounded-lg bg-pn border border-bd p-3">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">\기\존</p>
                  <ul className="space-y-1">
                    {["\구\매 \현\황\을 \엑\셀\로 \집\계, \실\시\간 \파\악 \불\가", "\승\인 \프\로\세\스\가 \구\두\·\문\서 \기\반"].map((t, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-slate-400">
                        <span className="text-slate-400 mt-0.5">\·</span>{t}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg bg-pn border border-bd p-3">
                  <p className="text-[10px] font-semibold text-teal-400 uppercase tracking-wider mb-1.5">LabAxis</p>
                  <ul className="space-y-1">
                    {["\실\시\간 \예\산 \소\진 \현\황 + \승\인 \라\인 \자\동\화", "Audit Trail\로 \구\매 \이\력 \전\건 \추\적"].map((t, i) => (
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
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 md:mb-2">\조\직 \운\영</p>
              <h2 className="text-xl md:text-3xl font-bold text-slate-100 break-keep">
                \통\제\·\추\적\·\승\인 \— \조\직 \운\영\을 \위\한 \기\반
              </h2>
              <p className="text-sm md:text-base text-slate-400 mt-2 max-w-2xl break-keep">
                \역\할 \기\반 \권\한, \승\인 \라\인, \감\사 \이\력, \예\산 \통\합\으\로 \조\직\의 \구\매 \프\로\세\스\를 \체\계\화\합\니\다.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6 mb-6 md:mb-8">
              {[
                {
                  icon: KeyRound,
                  iconColor: "text-amber-400",
                  title: "\역\할 \기\반 \권\한 \제\어",
                  desc: "\조\직\원\별 \권\한\을 \세\밀\하\게 \설\정\합\니\다. \견\적 \요\청\·\승\인\·\관\리\자 \역\할\을 \분\리\하\여 \내\부 \구\매 \프\로\세\스\에 \맞\게 \운\영\할 \수 \있\습\니\다.",
                },
                {
                  icon: CheckSquare,
                  iconColor: "text-violet-400",
                  title: "\승\인 \라\인",
                  desc: "\견\적 \요\청\·\발\주 \전 \승\인 \단\계\를 \설\정\합\니\다. \금\액 \기\준 \자\동 \라\우\팅, \승\인\자 \지\정 \및 \에\스\컬\레\이\션\을 \지\원\합\니\다.",
                },
                {
                  icon: ScrollText,
                  iconColor: "text-teal-400",
                  title: "Audit Trail",
                  desc: "\모\든 \구\매 \활\동\이 \자\동\으\로 \기\록\됩\니\다. \누\가, \언\제, \무\엇\을 \요\청\·\승\인\·\발\주\했\는\지 \전\건 \추\적\합\니\다. GMP/GLP \감\사 \대\비\에 \활\용\할 \수 \있\습\니\다.",
                },
                {
                  icon: Wallet,
                  iconColor: "text-emerald-400",
                  title: "\예\산 \통\합",
                  desc: "\부\서\·\프\로\젝\트\별 \예\산\을 \설\정\하\고 \실\시\간 \소\진 \현\황\을 \파\악\합\니\다. \예\산 \초\과 \시 \자\동 \알\림\과 \발\주 \차\단\을 \지\원\합\니\다.",
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
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 md:mb-4">\도\입 \적\합\성 \체\크</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                {[
                  "\연\구\팀\과 \구\매\팀\이 \분\리\된 \조\직 \구\조",
                  "GMP/GLP \환\경\에\서 Lot \추\적 \및 \이\력 \관\리 \필\요",
                  "\여\러 \벤\더\에\서 \시\약\·\장\비\를 \구\매\하\는 \다\공\급\사 \환\경",
                  "\구\매 \프\로\세\스\에 \승\인 \단\계\가 \필\요\한 \조\직",
                  "\재\고 \실\사\·\유\효\기\간 \관\리\를 \체\계\화\하\려\는 \팀",
                  "\수\기 \엑\셀 \중\심 \구\매 \관\리\를 \디\지\털\화\하\려\는 \조\직",
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
                    \요\금 & \플\랜 \보\기
                  </button>
                </Link>
                <Link href="/support">
                  <button className="h-9 px-5 text-sm font-medium text-slate-300 border border-bd hover:bg-el rounded-lg transition-colors">
                    \도\입 \상\담 \문\의
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
