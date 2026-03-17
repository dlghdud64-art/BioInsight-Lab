"use client";

import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { FileText } from "lucide-react";

interface QuoteDocumentProps {
  quote: {
    id: string;
    quoteNumber?: string | null;
    title: string;
    createdAt: string | Date;
    totalAmount?: number | null;
    items?: Array<{
      id: string;
      lineNumber?: number | null;
      name?: string | null;
      brand?: string | null;
      catalogNumber?: string | null;
      quantity: number;
      unitPrice?: number | null;
      lineTotal?: number | null;
      notes?: string | null;
      product?: {
        spec?: string | null;
      } | null;
    }>;
    deliveryDate?: string | Date | null;
    deliveryLocation?: string | null;
    message?: string | null;
  };
  companyInfo?: {
    name?: string;
    businessNumber?: string;
    address?: string;
    phone?: string;
    email?: string;
  };
}

export function QuoteDocument({ quote, companyInfo }: QuoteDocumentProps) {
  const quoteDate = new Date(quote.createdAt);
  const items = quote.items || [];
  
  // 합계 계산
  const subtotal = items.reduce((sum, item) => {
    const lineTotal = item.lineTotal || (item.unitPrice || 0) * item.quantity;
    return sum + lineTotal;
  }, 0);
  const vat = Math.floor(subtotal * 0.1); // 부가세 10%
  const total = subtotal + vat;

  // 기본 회사 정보
  const company = {
    name: companyInfo?.name || "BioInsight Lab",
    businessNumber: companyInfo?.businessNumber || "123-45-67890",
    address: companyInfo?.address || "서울특별시 강남구 테헤란로 123",
    phone: companyInfo?.phone || "02-1234-5678",
    email: companyInfo?.email || "info@bioinsight.com",
  };

  return (
    <div className="bg-white print:bg-white" id="quote-document">
      {/* A4 용지 스타일 */}
      <div className="max-w-[210mm] mx-auto bg-white border border-gray-300 shadow-lg print:shadow-none print:border-0">
        <div className="p-8 md:p-12 print:p-12 space-y-8">
          {/* 헤더: 견적번호, 날짜, 공급자 정보 */}
          <div className="border-b-2 border-gray-800 pb-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">견 적 서</h1>
                <div className="space-y-1 text-sm text-gray-600">
                  <div>
                    <span className="font-semibold">견적번호:</span>{" "}
                    {quote.quoteNumber || `QUO-${quote.id.slice(0, 8).toUpperCase()}`}
                  </div>
                  <div>
                    <span className="font-semibold">견적일자:</span>{" "}
                    {format(quoteDate, "yyyy년 MM월 dd일", { locale: ko })}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-gray-900 mb-2">{company.name}</div>
                <div className="text-xs text-gray-600 space-y-0.5">
                  <div>사업자등록번호: {company.businessNumber}</div>
                  <div>{company.address}</div>
                  <div>Tel: {company.phone} | Email: {company.email}</div>
                </div>
              </div>
            </div>
          </div>

          {/* 바디: 품목 테이블 */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">견적 품목</h2>
            <div className="border border-gray-300 rounded overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b-2 border-gray-300">
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 border-r border-gray-300 w-12">
                      No.
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 border-r border-gray-300">
                      품명
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 border-r border-gray-300 w-32">
                      규격
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 border-r border-gray-300 w-20">
                      수량
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-bold text-gray-900 border-r border-gray-300 w-28">
                      단가
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-bold text-gray-900 border-r border-gray-300 w-32">
                      공급가액
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-bold text-gray-900 w-32">
                      세액
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                        품목이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    items.map((item, index) => {
                      const lineNumber = item.lineNumber || index + 1;
                      const unitPrice = item.unitPrice || 0;
                      const lineTotal = item.lineTotal || unitPrice * item.quantity;
                      const vatAmount = Math.floor(lineTotal * 0.1);

                      return (
                        <tr key={item.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200">
                            {lineNumber}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200">
                            <div className="font-medium">{item.name || "품명 없음"}</div>
                            {(item.brand || item.catalogNumber) && (
                              <div className="text-xs text-gray-500 mt-1">
                                {item.brand && <span>브랜드: {item.brand}</span>}
                                {item.catalogNumber && (
                                  <span className="ml-2">카탈로그: {item.catalogNumber}</span>
                                )}
                              </div>
                            )}
                            {item.notes && (
                              <div className="text-xs text-gray-500 mt-1 italic">{item.notes}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200">
                            {item.product?.spec || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-center border-r border-gray-200">
                            {item.quantity}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right border-r border-gray-200">
                            {unitPrice > 0 ? `₩${unitPrice.toLocaleString()}` : "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right border-r border-gray-200 font-medium">
                            {lineTotal > 0 ? `₩${lineTotal.toLocaleString()}` : "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                            {vatAmount > 0 ? `₩${vatAmount.toLocaleString()}` : "-"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 합계 영역 */}
          <div className="flex justify-end">
            <div className="w-full md:w-80 space-y-2">
              <div className="flex justify-between items-center py-2 border-b border-gray-300">
                <span className="text-sm font-medium text-gray-700">공급가액 합계</span>
                <span className="text-sm font-semibold text-gray-900">
                  ₩{subtotal.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-300">
                <span className="text-sm font-medium text-gray-700">부가세 (10%)</span>
                <span className="text-sm font-semibold text-gray-900">
                  ₩{vat.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-t-2 border-gray-800 mt-2">
                <span className="text-base font-bold text-gray-900">총 견적 금액</span>
                <span className="text-xl font-bold text-gray-900">
                  ₩{total.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* 푸터: 유효기간, 문구, 직인 영역 */}
          <div className="border-t-2 border-gray-800 pt-6 space-y-6">
            {quote.deliveryDate && (
              <div className="text-sm text-gray-700">
                <span className="font-semibold">납기 희망일:</span>{" "}
                {format(new Date(quote.deliveryDate), "yyyy년 MM월 dd일", { locale: ko })}
              </div>
            )}
            {quote.deliveryLocation && (
              <div className="text-sm text-gray-700">
                <span className="font-semibold">납품 장소:</span> {quote.deliveryLocation}
              </div>
            )}
            <div className="text-sm text-gray-700">
              <span className="font-semibold">견적 유효기간:</span>{" "}
              {format(new Date(quoteDate.getTime() + 30 * 24 * 60 * 60 * 1000), "yyyy년 MM월 dd일", {
                locale: ko,
              })}{" "}
              까지
            </div>
            <div className="text-center py-8 border-t border-gray-300">
              <p className="text-base font-semibold text-gray-900 mb-4">
                위와 같이 견적합니다.
              </p>
              <div className="flex justify-end mt-12">
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900 mb-2">{company.name}</div>
                  <div className="text-sm text-gray-600 mb-8">대표이사: 홍길동</div>
                  <div className="border-2 border-gray-400 w-32 h-32 mx-auto flex items-center justify-center text-xs text-gray-500">
                    인
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


