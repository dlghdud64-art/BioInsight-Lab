import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpCircle } from "lucide-react";

export default function FAQPage() {
  const faqs = [
    {
      q: "견적 요청 후 답변은 언제쯤 오나요?",
      a: "영업일 기준 평균 24시간 이내에 AI 및 전담 매니저가 분석한 최적의 견적서를 대시보드 및 이메일로 발송해 드립니다.",
    },
    {
      q: "보유 중인 자체 엑셀 양식으로도 발주가 가능한가요?",
      a: "네, 가능합니다. 메인 화면의 '엑셀 업로드' 기능을 이용하시거나, 1:1 문의를 통해 파일을 전달해 주시면 시스템에 맞게 변환하여 처리해 드립니다.",
    },
    {
      q: "결제 방식(연구비 카드, 세금계산서)은 어떻게 되나요?",
      a: "대학교 산학협력단 및 기업 연구소의 규정에 맞춰 연구비 카드 결제 및 전자세금계산서 후불 발행을 모두 지원합니다.",
    },
    {
      q: "조직 내 다른 연구원들과 재고를 공유할 수 있나요?",
      a: "조직 관리 메뉴에서 팀원을 초대하면, 해당 랩실의 모든 시약 재고와 예산 현황을 실시간으로 공유하고 공동 관리할 수 있습니다.",
    },
  ];

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 max-w-4xl mx-auto w-full">
      <div className="flex flex-col space-y-2 mb-8">
        <h2 className="text-3xl font-bold tracking-tight">자주 묻는 질문 🤔</h2>
        <p className="text-muted-foreground">
          가장 많이 궁금해하시는 질문들을 모았습니다.
        </p>
      </div>

      <div className="space-y-4">
        {faqs.map((faq, i) => (
          <Card key={i} className="border-slate-200">
            <CardHeader className="py-4">
              <CardTitle className="text-base flex items-start gap-3">
                <HelpCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <span>{faq.q}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-slate-600 text-sm pb-4 pt-0 pl-14">
              {faq.a}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
