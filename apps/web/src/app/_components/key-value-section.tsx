import { Card, CardContent } from "@/components/ui/card";
import { Search, FileSpreadsheet, Users } from "lucide-react";

export function KeyValueSection() {
  return (
    <section id="features" className="mt-20 space-y-4">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">
        검???�이?��? ?�니?? 구매 준�??�구?�니??
      </h2>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
          <CardContent className="flex items-start gap-3 p-4">
            {/* ?�이�?*/}
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 flex-shrink-0">
              <Search className="h-5 w-5 text-slate-900" />
            </div>
            {/* ?�스??블록 */}
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-900">
                검????번으�??�보 ?�리
              </h3>
              <p className="text-xs leading-relaxed text-slate-500">
                GPT가 검?�어?� 비슷???�품?�을 ?�동?�로 ?�리??줍니??
                ?�러 ?�이?��? ?�아?�니지 ?�고 ??번에 ?�보�?모을 ???�습?�다.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
          <CardContent className="flex items-start gap-3 p-4">
            {/* ?�이�?*/}
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 flex-shrink-0">
              <FileSpreadsheet className="h-5 w-5 text-slate-900" />
            </div>
            {/* ?�스??블록 */}
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-900">
                ?�목 리스???�동 ?�리
              </h3>
              <p className="text-xs leading-relaxed text-slate-500">
                ?�택???�품?�을 ?�목 리스?�로 ?�동 ?�리?�니??
                ?�량, 비고�??�력?�면 구매?�청??리스?��? ?�성?�니??
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
          <CardContent className="flex items-start gap-3 p-4">
            {/* ?�이�?*/}
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 flex-shrink-0">
              <Users className="h-5 w-5 text-slate-900" />
            </div>
            {/* ?�스??블록 */}
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-900">
                ?�구·QC·?�산·구매 모두�??�한 �?              </h3>
              <p className="text-xs leading-relaxed text-slate-500">
                ?�구?? QC ?�무?? 구매 ?�당?��? 같�? 리스?��? 기�??�로 ?�업?????�습?�다.
                �???��??맞는 ?�드�?골라??�????�도�??�장 ?�정?�니??
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

