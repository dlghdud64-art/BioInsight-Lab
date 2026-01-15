"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, Users, Brain } from "lucide-react";

export function BioInsightFeaturesSection() {
  const features = [
    {
      icon: Zap,
      title: "자동화",
      description: "배송 완료와 동시에 인벤토리 등록.",
      details: "주문 내역이 자동으로 인벤토리에 반영되어 수동 입력이 필요 없습니다.",
      color: "from-blue-500 to-blue-600",
      bgColor: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    {
      icon: Users,
      title: "중복 구매 방지",
      titleSub: "Inventory Sharing",
      description: "옆 실험대에 있는데 또 주문하셨나요?",
      details: "연구실 전체 재고를 통합 검색하세요. 불필요한 지출을 막고, 급할 땐 동료의 시약을 바로 찾을 수 있습니다.",
      color: "from-indigo-500 to-indigo-600",
      bgColor: "bg-indigo-50",
      iconColor: "text-indigo-600",
    },
    {
      icon: Brain,
      title: "AI 예측",
      description: "떨어질 때를 미리 알려주는 스마트 알림.",
      details: "과거 주문 패턴을 분석하여 재구매 시점을 예측하고 알림을 보내드립니다.",
      color: "from-purple-500 to-purple-600",
      bgColor: "bg-purple-50",
      iconColor: "text-purple-600",
    },
  ];

  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
            연구에만 집중하세요
          </h2>
          <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto">
            복잡한 재고 관리는 우리가 알아서 처리합니다
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card
                key={index}
                className={`${feature.bgColor} border-2 border-transparent hover:border-slate-300 transition-all duration-300 hover:shadow-xl`}
              >
                <CardHeader>
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 shadow-lg`}>
                    <Icon className="h-7 w-7 text-white" />
                  </div>
                  <CardTitle className="text-xl md:text-2xl font-bold text-slate-900 mb-1">
                    {feature.title}
                    {feature.titleSub && (
                      <span className="text-xs md:text-sm font-normal text-slate-500 ml-2">
                        ({feature.titleSub})
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription className="text-base md:text-lg font-semibold text-slate-700">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm md:text-base text-slate-600 leading-relaxed">
                    {feature.details}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

