import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function CategoryAnalyticsPage() {
  return (
    <div className="flex-1 space-y-6 p-8 pt-6 w-full">
      <div className="flex flex-col space-y-4 mb-6">
        <Button variant="ghost" className="w-fit -ml-4 text-slate-500 hover:text-blue-600" asChild>
          <Link href="/dashboard/analytics">
            <ArrowLeft className="mr-2 h-4 w-4" /> 지출 분석 홈으로
          </Link>
        </Button>
        <h2 className="text-3xl font-bold tracking-tight">카테고리별 지출 분석 📊</h2>
        <p className="text-muted-foreground mt-1">
          어떤 항목에 연구비가 가장 많이 쓰이는지 확인하세요.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>비중 (도넛 차트)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] bg-slate-50 border border-dashed rounded-lg flex items-center justify-center text-slate-400">
              [파이/도넛 차트 렌더링 영역]
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>항목별 상세 금액</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border border-blue-100">
              <span className="font-bold text-blue-700">🧪 시약</span>
              <span className="font-bold">₩ 24,500,000</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg border border-emerald-100">
              <span className="font-bold text-emerald-700">🔬 장비</span>
              <span className="font-bold">₩ 12,000,000</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
