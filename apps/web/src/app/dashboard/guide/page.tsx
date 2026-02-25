import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, FileText, ShoppingCart, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function GuidePage() {
  return (
    <div className="flex-1 space-y-6 p-8 pt-6 max-w-5xl mx-auto w-full">
      <div className="flex flex-col space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">이용 가이드 📖</h2>
        <p className="text-muted-foreground">
          BioInsight Lab을 200% 활용하는 방법을 안내해 드립니다.
        </p>
      </div>

      <Alert className="bg-blue-50 border-blue-200 text-blue-800">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertTitle>업데이트 안내</AlertTitle>
        <AlertDescription>
          상세한 비디오 튜토리얼과 매뉴얼 문서가 곧 업데이트될 예정입니다.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 md:grid-cols-3 mt-6">
        <Card>
          <CardHeader className="pb-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mb-2">
              <Search className="h-5 w-5 text-blue-600" />
            </div>
            <CardTitle className="text-lg">Step 1. 시약 및 장비 검색</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            500만 개의 데이터베이스에서 필요한 품목의 이름, CAS Number, 또는 카탈로그 번호를 검색하여 최적의 제품을 찾으세요.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mb-2">
              <FileText className="h-5 w-5 text-emerald-600" />
            </div>
            <CardTitle className="text-lg">Step 2. 견적 요청</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            필요한 수량을 확인하고 장바구니에 담아 견적을 요청하세요. 보유하신 엑셀 리스트를 업로드하여 한 번에 처리할 수도 있습니다.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center mb-2">
              <ShoppingCart className="h-5 w-5 text-purple-600" />
            </div>
            <CardTitle className="text-lg">Step 3. 발주 및 재고 관리</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            도착한 견적서를 확인 후 발주를 진행하세요. 입고된 제품은 자동으로 인벤토리에 등록되어 유통기한까지 꼼꼼하게 관리됩니다.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
