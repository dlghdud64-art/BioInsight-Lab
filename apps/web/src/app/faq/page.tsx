import { MainLayout } from "../_components/main-layout";
import { MainHeader } from "../_components/main-header";
import { MainFooter } from "../_components/main-footer";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

const FAQ_CATEGORIES = [
  {
    id: "general",
    label: "일반",
    items: [
      { q: "LabAxis는 어떤 서비스인가요?", a: "LabAxis는 연구실의 시약·장비 검색, 견적, 구매, 재고 관리를 하나의 운영 흐름으로 연결하는 바이오 R&D 구매 운영 플랫폼입니다." },
      { q: "누가 사용할 수 있나요?", a: "연구원, 구매 담당자, 연구실 관리자, 조직 운영자 등 연구 구매에 관련된 모든 역할이 사용할 수 있습니다." },
      { q: "무료로 시작할 수 있나요?", a: "네, Starter 플랜은 무료입니다. 개인 연구자와 초기 검토를 위한 기본 기능을 제공합니다." },
    ],
  },
  {
    id: "features",
    label: "기능",
    items: [
      { q: "어떤 제품을 검색할 수 있나요?", a: "시약, 장비, 소모품 등 바이오 R&D에 필요한 품목을 제조사, CAS No., 카탈로그 번호로 통합 검색할 수 있습니다." },
      { q: "견적 요청은 어떻게 하나요?", a: "검색 후 비교 → 견적 요청 흐름으로 공급사에 직접 견적을 요청할 수 있습니다. 복수 공급사 비교도 지원합니다." },
      { q: "재고 관리 기능이 있나요?", a: "네, Lot 추적, 유효기간 관리, 안전재고 알림, 재주문 추천 등 연구실 맞춤 재고 운영 기능을 제공합니다." },
      { q: "PDF 견적서를 분석할 수 있나요?", a: "네, PDF 견적서를 업로드하면 AI가 품목, 수량, 단가를 자동 추출합니다. 실패 시 텍스트 붙여넣기로 대체할 수 있습니다." },
    ],
  },
  {
    id: "subscription",
    label: "구독/결제",
    items: [
      { q: "플랜 차이는 무엇인가요?", a: "Starter(무료), Team(협업), Business(조직 운영), Enterprise(대규모 도입)로 구분됩니다. 자세한 비교는 요금제 페이지에서 확인하세요." },
      { q: "결제 방식은 무엇인가요?", a: "월간 또는 연간(10% 할인) 결제를 지원하며, 카드 결제로 진행됩니다." },
      { q: "해지는 어떻게 하나요?", a: "설정 > 구독 관리에서 언제든 해지할 수 있습니다. 해지 후에도 결제 기간 종료까지 서비스를 이용할 수 있습니다." },
    ],
  },
  {
    id: "support",
    label: "문의/오류",
    items: [
      { q: "문제가 생기면 어디로 문의하나요?", a: "support@labaxis.io로 이메일을 보내시거나, 고객 지원 페이지에서 문의 양식을 제출해 주세요." },
      { q: "데이터는 안전한가요?", a: "256-bit 암호화, 역할 기반 접근 제어, Audit Trail을 적용하여 엔터프라이즈급 데이터 보호를 제공합니다." },
    ],
  },
];

export default function PublicFaqPage() {
  return (
    <MainLayout>
      <MainHeader />
      <div className="w-full pt-24 md:pt-32 pb-16 md:pb-24">
        <div className="max-w-3xl mx-auto px-4 md:px-6">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-100 mb-3">자주 묻는 질문</h1>
          <p className="text-sm md:text-base text-slate-400 mb-10 md:mb-14">
            LabAxis 도입과 사용에 대해 자주 묻는 질문을 정리했습니다.
          </p>

          <div className="space-y-10">
            {FAQ_CATEGORIES.map((cat) => (
              <div key={cat.id}>
                <h2 className="text-sm font-semibold uppercase tracking-widest text-blue-400 mb-4">{cat.label}</h2>
                <div className="divide-y divide-bd rounded-lg border border-bd overflow-hidden">
                  {cat.items.map((item, i) => (
                    <details key={i} className="group bg-pn">
                      <summary className="flex items-center justify-between cursor-pointer px-5 py-4 text-sm font-medium text-slate-200 hover:bg-el transition-colors">
                        {item.q}
                        <ChevronDown className="h-4 w-4 text-slate-500 flex-shrink-0 ml-4 transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="px-5 pb-4 text-sm text-slate-400 leading-relaxed">
                        {item.a}
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-14 text-center">
            <p className="text-sm text-slate-400 mb-4">원하는 답을 찾지 못하셨나요?</p>
            <Link href="/support" className="text-sm text-blue-400 hover:text-blue-300 font-medium">
              고객 지원 문의하기 →
            </Link>
          </div>
        </div>
      </div>
      <MainFooter />
    </MainLayout>
  );
}
