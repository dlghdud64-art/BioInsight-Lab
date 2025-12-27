"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Thermometer, AlertTriangle, CheckCircle2, FileText } from "lucide-react";

// 견적 시트 미리보기용 샘플 데이터 - 실무 필드 포함 (메인 화면용)
const SAMPLE_QUOTE_SHEET = [
  {
    name: "Human IL-6 ELISA Kit",
    vendor: "R&D Systems",
    catNo: "D6050",
    unitPrice: "₩450,000",
    leadTime: "7일",
    storage: "2-8°C",
    hazard: null,
    status: "Verified",
  },
  {
    name: "PCR Master Mix 2X",
    vendor: "Thermo Fisher",
    catNo: "K0171",
    unitPrice: "₩150,000",
    leadTime: "3일",
    storage: "-20°C",
    hazard: null,
    status: "Verified",
  },
  {
    name: "Trypsin-EDTA 0.25%",
    vendor: "Gibco",
    catNo: "25200-056",
    unitPrice: "₩85,000",
    leadTime: "5일",
    storage: "-20°C",
    hazard: "GHS07",
    status: "Draft",
  },
  {
    name: "DMEM High Glucose",
    vendor: "Sigma-Aldrich",
    catNo: "D6429",
    unitPrice: "₩120,000",
    leadTime: "4일",
    storage: "2-8°C",
    hazard: null,
    status: "Verified",
  },
];

export function HeroDemoFlowPanel() {
  return (
    <div className="w-full border border-slate-200 bg-white rounded-lg overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-slate-600" strokeWidth={1.5} />
          <span className="text-xs font-semibold text-slate-900 tracking-tight">견적 요청 시트</span>
        </div>
        <span className="text-[10px] text-slate-500">4개 품목</span>
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full text-[9px] leading-tight">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/50">
              <th className="px-2 py-1 text-left font-semibold text-slate-600 whitespace-nowrap">제품명</th>
              <th className="px-2 py-1 text-left font-semibold text-slate-600 whitespace-nowrap">벤더</th>
              <th className="px-2 py-1 text-left font-semibold text-slate-600 whitespace-nowrap">Cat.No</th>
              <th className="px-2 py-1 text-right font-semibold text-slate-600 whitespace-nowrap">단가</th>
              <th className="px-2 py-1 text-center font-semibold text-slate-600 whitespace-nowrap">리드타임</th>
              <th className="px-2 py-1 text-center font-semibold text-slate-600 whitespace-nowrap">보관</th>
              <th className="px-2 py-1 text-center font-semibold text-slate-600 whitespace-nowrap">위험</th>
              <th className="px-2 py-1 text-center font-semibold text-slate-600 whitespace-nowrap">상태</th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE_QUOTE_SHEET.map((item, idx) => (
              <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                <td className="px-2 py-1 text-slate-900 font-medium whitespace-nowrap max-w-[100px] truncate" title={item.name}>
                  {item.name}
                </td>
                <td className="px-2 py-1 text-slate-600 whitespace-nowrap">{item.vendor}</td>
                <td className="px-2 py-1 text-slate-500 font-mono whitespace-nowrap">{item.catNo}</td>
                <td className="px-2 py-1 text-right text-slate-900 font-medium whitespace-nowrap">{item.unitPrice}</td>
                <td className="px-2 py-1 text-center text-slate-600 whitespace-nowrap">{item.leadTime}</td>
                <td className="px-2 py-1 text-center whitespace-nowrap">
                  <span className="inline-flex items-center gap-0.5 text-slate-600">
                    <Thermometer className="h-2.5 w-2.5 text-indigo-500" strokeWidth={1.5} />
                    <span>{item.storage}</span>
                  </span>
                </td>
                <td className="px-2 py-1 text-center whitespace-nowrap">
                  {item.hazard ? (
                    <span className="inline-flex items-center gap-0.5 text-amber-600" title={item.hazard}>
                      <AlertTriangle className="h-2.5 w-2.5" strokeWidth={1.5} />
                    </span>
                  ) : (
                    <span className="text-slate-300">-</span>
                  )}
                </td>
                <td className="px-2 py-1 text-center whitespace-nowrap">
                  {item.status === "Verified" ? (
                    <span className="inline-flex items-center gap-0.5 text-indigo-600">
                      <CheckCircle2 className="h-2.5 w-2.5" strokeWidth={1.5} />
                      <span className="text-[8px]">확인됨</span>
                    </span>
                  ) : (
                    <span className="text-[8px] text-slate-400">작성중</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 푸터 - 출처 표시 예시 */}
      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-3 py-1">
        <div className="flex items-center gap-1">
          <span className="text-[8px] text-slate-400">출처:</span>
          <span className="text-[8px] px-1 py-0.5 bg-slate-100 rounded text-slate-500">datasheet</span>
          <span className="text-[8px] px-1 py-0.5 bg-slate-100 rounded text-slate-500">vendor catalog</span>
        </div>
        <Link href="/test/search">
          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 border-slate-200 text-indigo-600 hover:bg-indigo-50">
            직접 만들기 →
          </Button>
        </Link>
      </div>
    </div>
  );
}
