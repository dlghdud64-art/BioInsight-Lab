"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FlaskConical, CheckCircle2, Factory, ShoppingCart } from "lucide-react";

export function PersonaSection() {
  return (
    <section id="personas" className="mt-20 space-y-4">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">
        ?„ê? ?°ë‚˜??
      </h2>
      <Tabs defaultValue="rnd" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="rnd">R&D ?°êµ¬??/TabsTrigger>
          <TabsTrigger value="qc">QCÂ·QA ?¤ë¬´??/TabsTrigger>
          <TabsTrigger value="production">?ì‚° ?”ì??ˆì–´</TabsTrigger>
          <TabsTrigger value="buyer">êµ¬ë§¤ ?´ë‹¹??/TabsTrigger>
        </TabsList>

        <TabsContent value="rnd" className="mt-4">
          <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <FlaskConical className="h-5 w-5 text-slate-900" />
                <CardTitle className="text-base text-slate-900">R&D ?°êµ¬??/CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm text-slate-500">
                <ul className="space-y-2 list-disc list-inside">
                  <li>?¤í—˜ ?„ë¡œ? ì½œ?ì„œ ?„ìš”???œì•½???ë™?¼ë¡œ ì¶”ì¶œ</li>
                  <li>?¤í™ ì¤‘ì‹¬?¼ë¡œ ?œí’ˆ ë¹„êµ ë°??€ì²´í’ˆ ê²€??/li>
                  <li>?ë¬¸ ?°ì´?°ì‹œ?¸ë? ?œê?ë¡??”ì•½/ë²ˆì—­</li>
                  <li>?°êµ¬???ˆì‚° ?´ì—??ìµœì ???œí’ˆ ? íƒ</li>
                </ul>
              </CardDescription>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="qc" className="mt-4">
          <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-5 w-5 text-slate-900" />
                <CardTitle className="text-base text-slate-900">QC/QA ?¤ë¬´??/CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm text-slate-500">
                <ul className="space-y-2 list-disc list-inside">
                  <li>?™ì¼ Grade/ê·œê²© ? ì?ê°€ ì¤‘ìš”???€ì²´í’ˆ ê²€??/li>
                  <li>GMP, ë¶„ì„???±ê¸‰ ?•ë³´ ì¤‘ì‹¬ ë¹„êµ</li>
                  <li>ê·œê²© ì¤€???¬ë? ë¹ ë¥¸ ?•ì¸</li>
                  <li>?ˆì§ˆ ê¸°ì???ë§ëŠ” ?œí’ˆë§??„í„°ë§?/li>
                </ul>
              </CardDescription>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="production" className="mt-4">
          <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <Factory className="h-5 w-5 text-slate-900" />
                <CardTitle className="text-base text-slate-900">?ì‚° ?”ì??ˆì–´</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm text-slate-500">
                <ul className="space-y-2 list-disc list-inside">
                  <li>?€??êµ¬ë§¤ ??ê°€ê²©Â·ë‚©ê¸?ì¤‘ì‹¬ ë¹„êµ</li>
                  <li>?¬ê³  ê´€ë¦?ë°??ë™ ?¬ì£¼ë¬?ì¶”ì²œ</li>
                  <li>?„ë¡œ?íŠ¸ë³?êµ¬ë§¤ ?´ì—­ ë¦¬í¬??/li>
                  <li>?ˆì‚° ?€ë¹??¬ìš©ë¥?ì¶”ì </li>
                </ul>
              </CardDescription>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="buyer" className="mt-4">
          <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <ShoppingCart className="h-5 w-5 text-slate-900" />
                <CardTitle className="text-base text-slate-900">êµ¬ë§¤ ?´ë‹¹??/CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm text-slate-500">
                <ul className="space-y-2 list-disc list-inside">
                  <li>?€?ì„œ ?”ì²­???ˆëª© ë¦¬ìŠ¤?¸ë? ??ë²ˆì— ?•ì¸</li>
                  <li>ë²¤ë”ë³?ê°€ê²©Â·ë‚©ê¸?ë¹„êµ ë°?ê²¬ì  ?”ì²­</li>
                  <li>ê¸°ê°„ë³??„ë¡œ?íŠ¸ë³?êµ¬ë§¤ ë¦¬í¬???ì„±</li>
                  <li>?ˆì‚° ì±…ì • ë°??¬ìš©ë¥?ê´€ë¦?/li>
                </ul>
              </CardDescription>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}
