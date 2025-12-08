"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    id: "search",
    label: "寃??,
    stepLabel: "Step 1",
    title: "寃??쨌 AI 遺꾩꽍",
    description:
      "?쒗뭹紐? ?源? 移댄뀒怨좊━濡?寃?됲븯硫??꾨낫 ?쒗뭹????踰덉뿉 ?뺤씤?섍퀬, GPT媛 寃?됱뼱瑜?遺꾩꽍???源?移댄뀒怨좊━瑜??④퍡 ?쒖븞?⑸땲??",
    ctaLabel: "寃???뚮줈??泥댄뿕?섍린",
    href: "/test/search",
  },
  {
    id: "compare",
    label: "鍮꾧탳",
    stepLabel: "Step 2",
    title: "鍮꾧탳 쨌 ?덈ぉ 由ъ뒪??留뚮뱾湲?,
    description:
      "?꾩슂???쒗뭹留?怨⑤씪 鍮꾧탳?섍퀬, ?ㅼ젣濡?援щℓ ?붿껌???ъ슜???덈ぉ 由ъ뒪?몃? 留뚮뱾???〓땲?? ?섎웾怨?鍮꾧퀬留?梨꾩슦硫?由ъ뒪?멸? ?꾩꽦?⑸땲??",
    ctaLabel: "鍮꾧탳 ?뚮줈??泥댄뿕?섍린",
    href: "/test/quote",
  },
  {
    id: "groupware",
    label: "洹몃９?⑥뼱",
    stepLabel: "Step 3",
    title: "洹몃９?⑥뼱??遺숈뿬?ｊ린",
    description:
      "?꾩꽦???덈ぉ 由ъ뒪?몃? TSV/?묒? ?뺥깭濡?蹂듭궗???щ궡 洹몃９?⑥뼱 寃곗옱 ?묒떇??洹몃?濡?遺숈뿬?ｌ쓣 ???덉뒿?덈떎. 湲곗〈 援щℓ ?꾨줈?몄뒪??洹몃?濡??좎??⑸땲??",
    ctaLabel: "洹몃９?⑥뼱??由ъ뒪??蹂닿린",
    href: "/test/quote/request",
  },
];

export function DemoFlowSwitcher() {
  const [active, setActive] = React.useState<string>("search");
  const router = useRouter();

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-slate-900">
          3?④퀎 ?곕え ?뚮줈??
        </CardTitle>
        <CardDescription className="text-xs text-slate-500">
          寃????鍮꾧탳 ??洹몃９?⑥뼱 遺숈뿬?ｊ린源뚯? ?ㅼ젣 ?붾㈃ ?먮쫫??媛꾨떒???댄렣蹂????덉뒿?덈떎.
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-0">
        <Tabs value={active} onValueChange={setActive}>
          {/* ?곷떒 ?좉? / ??*/}
          <TabsList className="mb-4 grid grid-cols-3 bg-slate-50">
            {STEPS.map((step) => (
              <TabsTrigger
                key={step.id}
                value={step.id}
                className="text-xs data-[state=active]:bg-white data-[state=active]:text-slate-900"
                onMouseEnter={() => setActive(step.id)} // 留덉슦???щ젮???꾪솚
              >
                {step.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ???댁슜 */}
          {STEPS.map((step) => (
            <TabsContent
              key={step.id}
              value={step.id}
              className="mt-0 focus-visible:outline-none focus-visible:ring-0"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-500">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-semibold text-white">
                      {step.stepLabel.replace("Step ", "")}
                    </span>
                    <span>{step.stepLabel}</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {step.title}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      {step.description}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-col items-start gap-2 md:mt-0 md:items-end">
                  {/* ?섏쨷???ㅼ젣 ?곕え ?대?吏/?ㅽ겕由곗꺑 ?몃꽕???ｌ쓣 ?먮━ */}
                  {/* 
                  <div className="h-20 w-40 rounded-md border border-dashed border-slate-200 bg-slate-50 text-[11px] text-slate-400 flex items-center justify-center">
                    ?ㅽ겕由곗꺑 / 誘몃땲 ?곕え
                  </div>
                  */}
                  <Button
                    size="sm"
                    className="mt-1 bg-blue-600 text-white hover:bg-blue-700"
                    onClick={() => router.push(step.href)}
                  >
                    {step.ctaLabel}
                  </Button>
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}


import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    id: "search",
    label: "寃??,
    stepLabel: "Step 1",
    title: "寃??쨌 AI 遺꾩꽍",
    description:
      "?쒗뭹紐? ?源? 移댄뀒怨좊━濡?寃?됲븯硫??꾨낫 ?쒗뭹????踰덉뿉 ?뺤씤?섍퀬, GPT媛 寃?됱뼱瑜?遺꾩꽍???源?移댄뀒怨좊━瑜??④퍡 ?쒖븞?⑸땲??",
    ctaLabel: "寃???뚮줈??泥댄뿕?섍린",
    href: "/test/search",
  },
  {
    id: "compare",
    label: "鍮꾧탳",
    stepLabel: "Step 2",
    title: "鍮꾧탳 쨌 ?덈ぉ 由ъ뒪??留뚮뱾湲?,
    description:
      "?꾩슂???쒗뭹留?怨⑤씪 鍮꾧탳?섍퀬, ?ㅼ젣濡?援щℓ ?붿껌???ъ슜???덈ぉ 由ъ뒪?몃? 留뚮뱾???〓땲?? ?섎웾怨?鍮꾧퀬留?梨꾩슦硫?由ъ뒪?멸? ?꾩꽦?⑸땲??",
    ctaLabel: "鍮꾧탳 ?뚮줈??泥댄뿕?섍린",
    href: "/test/quote",
  },
  {
    id: "groupware",
    label: "洹몃９?⑥뼱",
    stepLabel: "Step 3",
    title: "洹몃９?⑥뼱??遺숈뿬?ｊ린",
    description:
      "?꾩꽦???덈ぉ 由ъ뒪?몃? TSV/?묒? ?뺥깭濡?蹂듭궗???щ궡 洹몃９?⑥뼱 寃곗옱 ?묒떇??洹몃?濡?遺숈뿬?ｌ쓣 ???덉뒿?덈떎. 湲곗〈 援щℓ ?꾨줈?몄뒪??洹몃?濡??좎??⑸땲??",
    ctaLabel: "洹몃９?⑥뼱??由ъ뒪??蹂닿린",
    href: "/test/quote/request",
  },
];