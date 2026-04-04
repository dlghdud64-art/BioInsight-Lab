"use client";

import {
  Search, GitCompare, FileText, ShoppingCart,
  PackageCheck, Warehouse, ClipboardList, History,
} from "lucide-react";

/*
 * ── Product Overview Section ─────────────────────────────────────
 *  dark proof → LIFTED support layer → dark footer
 *  아이콘 기반 제품 흐름 요약. CTA 반복 없음.
 * ─────────────────────────────────────────────────────────────────
 */

const FEATURES = [
  {
    icon: Search,
    title: "시약·장비 검색",
    desc: "이건 찾으면 바로 비교·견적까지 연결",
  },
  {
    icon: ClipboardList,
    title: "후보 정리",
    desc: "후보제품을 리스트로 정리·관리",
  },
  {
    icon: GitCompare,
    title: "비교·선택안 확정",
    desc: "사양·가격·납기를 한눈에 비교",
  },
  {
    icon: FileText,
    title: "요청 생성",
    desc: "견적·구매요청서를 자동으로 생성",
  },
  {
    icon: ShoppingCart,
    title: "발주 준비",
    desc: "PO 전환부터 공급사 발송 준비까지",
  },
  {
    icon: PackageCheck,
    title: "입고 반영",
    desc: "입고 확인·검수 기록을 즉시 반영",
  },
  {
    icon: Warehouse,
    title: "재고 운영",
    desc: "실시간 재고 조회·위치 추적",
  },
  {
    icon: History,
    title: "운영 이력 관리",
    desc: "전체 흐름의 변경·승인 이력 관리",
  },
];

export function FinalCTASection() {
  return (
    <section style={{ backgroundColor: "#334155" }}>
      <div className="mx-auto max-w-[1100px] px-5 md:px-8 pt-20 md:pt-28 pb-16 md:pb-24">

        {/* Heading — mockup 영향권 밖 safe zone */}
        <div className="text-center mb-10 md:mb-14">
          <h2 className="text-xl md:text-[28px] font-bold tracking-tight mb-3" style={{ color: "#F8FAFC" }}>
            제품 흐름 한눈에 보기
          </h2>
          <p className="text-sm md:text-[15px] font-medium" style={{ color: "#E2E8F0" }}>
            검색부터 재고 운영까지, 하나의 워크벤치에서 끊기지 않고 이어집니다.
          </p>
        </div>

        {/* Icon Grid: 4col x 2row (desktop), 2col x 4row (mobile) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl px-4 py-5 md:py-6 flex flex-col items-center text-center"
              style={{
                backgroundColor: "#2B3749",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                style={{ backgroundColor: "rgba(59,130,246,0.12)" }}
              >
                <f.icon className="h-5 w-5" style={{ color: "#60A5FA" }} strokeWidth={1.8} />
              </div>
              <p className="text-[13px] md:text-sm font-semibold mb-1" style={{ color: "#F1F5F9" }}>
                {f.title}
              </p>
              <p className="text-[11px] md:text-xs leading-relaxed" style={{ color: "#B0BEC5" }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
