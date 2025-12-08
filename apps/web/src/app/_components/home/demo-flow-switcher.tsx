"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Search, ListChecks, ClipboardList } from "lucide-react";

type StepId = "search" | "compare" | "groupware";

const STEPS: {
  id: StepId;
  label: string;
  badge: string;
  title: string;
  subtitle: string;
  bullets: string[];
  cta?: string;
}[] = [
  {
    id: "search",
    label: "寃??,
    badge: "Step 1",
    title: "寃?됱쑝濡??꾨낫瑜???踰덉뿉 紐⑥쑝湲?,
    subtitle:
      "?쒗뭹紐? ?源? 移댄뀒怨좊━濡??щ윭 踰ㅻ뜑 ?쒗뭹????踰덉뿉 議고쉶?⑸땲??",
    bullets: [
      "GPT媛 寃?됱뼱瑜??댄빐?댁꽌 ?좎궗 ?쒗뭹???먮룞?쇰줈 ?뺣━",
      "踰ㅻ뜑 / 移댄뀒怨좊━ / Grade濡??꾪꽣留?,
      "?좏깮???쒗뭹??諛붾줈 ?덈ぉ 由ъ뒪?몄뿉 ?닿린",
    ],
    cta: "寃???붾㈃ ?닿린",
  },
  {
    id: "compare",
    label: "鍮꾧탳",
    badge: "Step 2",
    title: "?꾩슂???쒗뭹留?怨⑤씪??鍮꾧탳 쨌 ?덈ぉ 由ъ뒪??留뚮뱾湲?,
    subtitle: "?ㅼ젣 援щℓ ?꾨낫留??λ컮援щ땲泥섎읆 紐⑥븘 ?뺣━?⑸땲??",
    bullets: [
      "踰ㅻ뜑 / ?④? / 洹쒓꺽?????붾㈃?먯꽌 鍮꾧탳",
      "?섎웾, 鍮꾧퀬瑜??낅젰?섎㈃ ?덈ぉ 由ъ뒪???먮룞 ?뺣━",
      "寃ъ쟻 ?붿껌??諛붾줈 ?????덈뒗 ?뺥깭濡????,
    ],
    cta: "?덈ぉ 由ъ뒪??蹂대윭 媛湲?,
  },
  {
    id: "groupware",
    label: "洹몃９?⑥뼱??遺숈뿬?ｊ린",
    badge: "Step 3",
    title: "洹몃９?⑥뼱 寃곗옱 ?묒떇??遺숈뿬?ｊ린",
    subtitle:
      "?뚯궗?먯꽌 ?곕뒗 ?꾩옄寃곗옱/洹몃９?⑥뼱 ?꾨줈?몄뒪瑜?洹몃?濡??ъ슜?⑸땲??",
    bullets: [
      "?꾩꽦???덈ぉ 由ъ뒪?몃? TSV/?띿뒪?몃줈 蹂듭궗",
      "援щℓ ?붿껌 ?묒떇??洹몃?濡?遺숈뿬?ｊ린",
      "?ν썑?먮뒗 吏곸젒 寃ъ쟻 ?붿껌/援щℓ源뚯? ?뺤옣 ?덉젙",
    ],
    cta: "寃ъ쟻 ?붿껌 ?붾㈃ ?닿린",
  },
];

export function DemoFlowSwitcherSection() {
  const [active, setActive] = useState<StepId>("search");
  const current = STEPS.find((s) => s.id === active)!;

  return (
    <section
      id="demo-flow-section"
      className="border-y border-slate-100 bg-slate-50/60 py-10"
    >
      {/* ???ш린?쒕????꾩껜瑜?媛?대뜲濡?紐⑥???*/}
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-4">
        {/* ?뱀뀡 ?ㅻ뜑 */}
        <header className="text-center space-y-1">
          <p className="text-xs font-medium text-slate-500">
            3?④퀎 ?곕え ?뚮줈??          </p>
          <h2 className="text-lg font-semibold text-slate-900">
            寃????鍮꾧탳 ??洹몃９?⑥뼱源뚯? ?ㅼ젣 ?ъ슜 ?먮쫫??媛꾨떒??泥댄뿕??蹂댁꽭??
          </h2>
        </header>

        {/* ?좉? + 移대뱶: ?꾩껜 ??쓣 ??以꾩씠怨?媛?대뜲 ?뺣젹 */}
        <div className="w-full max-w-xl space-y-4">
          {/* ?좉? 踰꾪듉 洹몃９ */}
          <div className="inline-flex w-full rounded-full border border-slate-200 bg-white/80 p-1 text-xs shadow-sm">
            {STEPS.map((step) => {
              const selected = step.id === active;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setActive(step.id)}
                  onMouseEnter={() => setActive(step.id)}
                  className={cn(
                    "flex-1 rounded-full px-3 py-1.5 inline-flex items-center justify-center gap-1 transition",
                    selected
                      ? "bg-slate-900 text-slate-50"
                      : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wide">
                    {step.badge}
                  </span>
                  <span className="text-xs font-medium">{step.label}</span>
                </button>
              );
            })}
          </div>

          {/* ?좏깮???④퀎 移대뱶 */}
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-start gap-3">
              <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100">
                {active === "search" && <Search className="h-4 w-4" />}
                {active === "compare" && <ListChecks className="h-4 w-4" />}
                {active === "groupware" && (
                  <ClipboardList className="h-4 w-4" />
                )}
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">
                  {current.title}
                </CardTitle>
                <CardDescription className="mt-1 text-xs text-slate-500">
                  {current.subtitle}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 px-6 pb-5">
              <ul className="space-y-1.5 text-xs text-slate-600">
                {current.bullets.map((b) => (
                  <li key={b} className="flex gap-2">
                    <span className="mt-[6px] h-1 w-1 rounded-full bg-slate-400" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              {current.cta && (
                <div className="pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="inline-flex items-center gap-1 text-xs"
                    onClick={() => {
                      if (current.id === "search") {
                        window.location.href = "/test/search";
                      } else if (current.id === "compare") {
                        window.location.href = "/test/quote";
                      } else {
                        window.location.href = "/test/quote/request";
                      }
                    }}
                  >
                    {current.cta}
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Search, ListChecks, ClipboardList } from "lucide-react";

type StepId = "search" | "compare" | "groupware";

const STEPS: {
  id: StepId;
  label: string;
  badge: string;
  title: string;
  subtitle: string;
  bullets: string[];
  cta?: string;
}[] = [
  {
    id: "search",
    label: "寃??,
    badge: "Step 1",
    title: "寃?됱쑝濡??꾨낫瑜???踰덉뿉 紐⑥쑝湲?,
    subtitle:
      "?쒗뭹紐? ?源? 移댄뀒怨좊━濡??щ윭 踰ㅻ뜑 ?쒗뭹????踰덉뿉 議고쉶?⑸땲??",
    bullets: [
      "GPT媛 寃?됱뼱瑜??댄빐?댁꽌 ?좎궗 ?쒗뭹???먮룞?쇰줈 ?뺣━",
      "踰ㅻ뜑 / 移댄뀒怨좊━ / Grade濡??꾪꽣留?,
      "?좏깮???쒗뭹??諛붾줈 ?덈ぉ 由ъ뒪?몄뿉 ?닿린",
    ],
    cta: "寃???붾㈃ ?닿린",
  },
  {
    id: "compare",
    label: "鍮꾧탳",
    badge: "Step 2",
    title: "?꾩슂???쒗뭹留?怨⑤씪??鍮꾧탳 쨌 ?덈ぉ 由ъ뒪??留뚮뱾湲?,
    subtitle: "?ㅼ젣 援щℓ ?꾨낫留??λ컮援щ땲泥섎읆 紐⑥븘 ?뺣━?⑸땲??",
    bullets: [
      "踰ㅻ뜑 / ?④? / 洹쒓꺽?????붾㈃?먯꽌 鍮꾧탳",
      "?섎웾, 鍮꾧퀬瑜??낅젰?섎㈃ ?덈ぉ 由ъ뒪???먮룞 ?뺣━",
      "寃ъ쟻 ?붿껌??諛붾줈 ?????덈뒗 ?뺥깭濡????,
    ],
    cta: "?덈ぉ 由ъ뒪??蹂대윭 媛湲?,
  },
  {
    id: "groupware",
    label: "洹몃９?⑥뼱??遺숈뿬?ｊ린",
    badge: "Step 3",
    title: "洹몃９?⑥뼱 寃곗옱 ?묒떇??遺숈뿬?ｊ린",
    subtitle:
      "?뚯궗?먯꽌 ?곕뒗 ?꾩옄寃곗옱/洹몃９?⑥뼱 ?꾨줈?몄뒪瑜?洹몃?濡??ъ슜?⑸땲??",
    bullets: [
      "?꾩꽦???덈ぉ 由ъ뒪?몃? TSV/?띿뒪?몃줈 蹂듭궗",
      "援щℓ ?붿껌 ?묒떇??洹몃?濡?遺숈뿬?ｊ린",
      "?ν썑?먮뒗 吏곸젒 寃ъ쟻 ?붿껌/援щℓ源뚯? ?뺤옣 ?덉젙",
    ],
    cta: "寃ъ쟻 ?붿껌 ?붾㈃ ?닿린",
  },
];