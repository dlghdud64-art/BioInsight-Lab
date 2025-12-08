import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function PricingSection() {
  return (
    <section id="pricing" className="mt-20 space-y-4">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">
        ?”ê¸ˆ & ?„ì…
      </h2>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
          <CardHeader>
            <div className="flex items-center justify-between mb-2">
              <CardTitle className="text-base text-slate-900">Free / Beta</CardTitle>
              <Badge variant="secondary" className="bg-slate-100 text-slate-700">?„ì¬</Badge>
            </div>
            <CardDescription className="text-xs text-slate-500">
              ?ŒìŠ¤??ë°??Œì¼??ëª©ì 
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs text-slate-500 list-disc list-inside">
              <li>ê²€?? ë¹„êµ, ?ˆëª© ë¦¬ìŠ¤???ì„±</li>
              <li>??ë³µì‚¬/?¤ìš´ë¡œë“œ</li>
              <li>ê³µìœ  ë§í¬ (?¼ë? ?œí•œ)</li>
              <li>ë¡œê·¸???†ì´ ì²´í—˜ ê°€??/li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle className="text-base text-slate-900">Team ?Œëœ</CardTitle>
            <CardDescription className="text-xs text-slate-500">
              ?°êµ¬???€ ?¨ìœ„
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs text-slate-500 list-disc list-inside">
              <li>?€ ?Œí¬?¤í˜?´ìŠ¤</li>
              <li>ë§í¬/ë¦¬ìŠ¤???œí•œ ?„í™”</li>
              <li>ê¸°ë³¸ ë¦¬í¬??/li>
              <li>Seat ê¸°ë°˜ ê³¼ê¸ˆ</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle className="text-base text-slate-900">Organization / Enterprise</CardTitle>
            <CardDescription className="text-xs text-slate-500">
              ?Œì‚¬/ë³‘ì› ?¨ìœ„
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs text-slate-500 list-disc list-inside">
              <li>?¤ìˆ˜ ?€/ë¶€??ê´€ë¦?/li>
              <li>ê¶Œí•œ/SSO ?°ë™</li>
              <li>?¨í”„?ˆë????µì…˜</li>
              <li>ê·¸ë£¹?¨ì–´ ?°ë™</li>
              <li>?°ì„  ì§€??/li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 text-center">
        <p className="text-sm text-slate-600">
          ?„ì¬??<strong className="text-slate-900">Beta ë¬´ë£Œ</strong>ë¡?ëª¨ë“  ê¸°ëŠ¥??ì²´í—˜?????ˆìŠµ?ˆë‹¤.
        </p>
      </div>
    </section>
  );
}
