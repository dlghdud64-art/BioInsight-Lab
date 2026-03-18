import { ShieldCheck, Lock, Users, History, FlaskConical } from "lucide-react";

const TRUST_POINTS = [
  { icon: ShieldCheck, label: "역할·승인 체계" },
  { icon: Lock, label: "조직별 데이터 격리" },
  { icon: History, label: "구매 이력 자동 기록" },
  { icon: FlaskConical, label: "Lot·유효기간 추적" },
  { icon: Users, label: "팀 단위 운영" },
];

export function LandingTrustBar() {
  return (
    <section className="py-5 md:py-6 bg-sh border-b border-bd">
      <div className="container px-4 md:px-6 mx-auto">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {TRUST_POINTS.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 text-[#4b5563]" strokeWidth={1.8} />
                <span className="text-[11px] md:text-xs text-[#6b7280] font-medium">{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
