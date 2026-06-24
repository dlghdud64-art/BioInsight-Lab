"use client";

/**
 * §quote-management P3 — 공급사 실명 이니셜 아바타(익명 점 A·B·C 폐기)
 *
 * 지시문 §05. 실제 공급사명을 이니셜 아바타로, 회신 여부를 색으로 구분.
 *   - 앞 3곳 이니셜(name[0]), 4곳+ 는 +N 축약.
 *   - 회신=파랑(accent), 미회신=회색. hover 시 전체 목록 툴팁(회신 ✓).
 *   - 공급사 0 = "공급사 미정"(회색, dead/가짜 0).
 *   - 이름 없으면 이메일 도메인/입력값 이니셜(지시문 §05 데이터 규칙).
 */

import { type Supplier } from "@/lib/quote-management/derive";

/** vendorRequests → Supplier[] 파생(이름·회신). 이름 없으면 이메일 도메인/fallback. */
export function toSuppliers(
  vendorRequests?: Array<{
    vendorName?: string | null;
    vendorEmail?: string | null;
    respondedAt?: string | Date | null;
    status?: string | null;
  }>,
): Supplier[] {
  return (vendorRequests ?? []).map((v) => {
    const name =
      v.vendorName?.trim() ||
      (v.vendorEmail ? v.vendorEmail.split("@")[1] || v.vendorEmail : "공급사");
    return {
      name,
      replied: v.respondedAt != null || v.status === "RESPONDED",
      email: v.vendorEmail ?? undefined,
    };
  });
}

export function SupplierAvatars({ suppliers }: { suppliers: Supplier[] }) {
  if (suppliers.length === 0) {
    // §quotes-workbench-rail A — whitespace-nowrap: 셀 압축 시 "공급사 미정"이 글자 중간에서
    //   잘리거나 줄바꿈되지 않도록(깨진 라벨 "공급 미경" 방지). 잘려도 셀 폭은 테이블 min-w 가 보호.
    return <span className="text-xs text-slate-500 whitespace-nowrap">공급사 미정</span>;
  }
  const shown = suppliers.slice(0, 3);
  const extra = suppliers.length - shown.length;
  const tooltip = suppliers.map((s) => `${s.name}${s.replied ? " ✓" : ""}`).join("\n");

  return (
    <div className="flex items-center -space-x-1.5" title={tooltip}>
      {shown.map((s, i) => (
        <span
          key={i}
          className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold border-2 border-white ${
            s.replied ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"
          }`}
        >
          {s.name[0] ?? "?"}
        </span>
      ))}
      {extra > 0 && (
        <span className="flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold border-2 border-white bg-slate-100 text-slate-500">
          +{extra}
        </span>
      )}
    </div>
  );
}
