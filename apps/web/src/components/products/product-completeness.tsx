"use client";

/**
 * §product-detail PD-B (§04·§05) + §product-detail-refinement 계약②·⑦
 *   - 완성도 %(분모 8 고정, computeCompleteness) + 100% 시 숨김.
 *   - 미등록 = **6항목(가변, D8) 2열 체크리스트 그리드**(1줄 축약 폐기). 항목 = missingLabels 파생 + 위험도 행(D7).
 *   - 역할 분기(D6): buyer 는 편집 라벨(스펙 편집·안전 정보 편집) 미노출 → `정보 요청`/`SDS 요청`(/support) 수렴.
 *     ADMIN·SUPPLIER(canEdit) 만 편집 액션. dead button 0(정보 요청 = 실 이동, 편집 = handler). disabled 미사용.
 *   - 색 = 프로토타입 amber hex 8토큰(§0-B, D5 — CEO §11.302 예외 승계). Tailwind amber/orange 클래스 0, 빨강 0.
 */

import Link from "next/link";
import {
  computeCompleteness,
  resolveCompletenessActions,
  type CompletenessRole,
  type CompletenessActionKind,
} from "@/lib/product-detail/completeness";

export function ProductCompleteness({
  product,
  role = "buyer",
  classified,
  onSpecEdit,
  onSafetyEdit,
  onSdsUpload,
}: {
  product: Record<string, unknown> | null | undefined;
  role?: CompletenessRole;
  /** 위험도 분류 여부 — false 면 위험도 행 추가(D7). undefined 면 위험도 행 없음. */
  classified?: boolean;
  onSpecEdit?: () => void;
  onSafetyEdit?: () => void;
  onSdsUpload?: () => void;
}) {
  const { pct } = computeCompleteness(product);
  if (pct >= 100) return null; // 완전한 제품 = 완성도 배지 숨김(§04)

  const canEdit = role === "ADMIN" || role === "SUPPLIER";
  const items = resolveCompletenessActions(product, role, { classified });

  // actionKind → 라벨. buyer(!canEdit): 편집 라벨(스펙 편집·안전 정보 편집) 미노출 → 정보 요청 수렴(D6, 이중 방어).
  function actionText(kind: CompletenessActionKind): string {
    if (!canEdit && (kind === "spec_edit" || kind === "safety_edit")) return "정보 요청";
    switch (kind) {
      case "spec_edit":
        return "스펙 편집";
      case "safety_edit":
        return "안전 정보 편집";
      case "sds_upload":
        return canEdit ? "SDS 업로드" : "SDS 요청";
      case "sds_request":
        return "SDS 요청";
      default:
        return "정보 요청";
    }
  }

  function editHandler(kind: CompletenessActionKind): (() => void) | undefined {
    if (kind === "spec_edit") return onSpecEdit;
    if (kind === "safety_edit") return onSafetyEdit;
    if (kind === "sds_upload") return onSdsUpload;
    return undefined;
  }

  return (
    <div className="mb-6 rounded-xl border px-4 py-3" style={{ backgroundColor: "#fffbeb", borderColor: "#fde68a" }}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold" style={{ color: "#92400e" }}>제품 정보 완성도</span>
        <span className="text-xs font-bold tabular-nums" style={{ color: "#92400e" }}>{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: "#fef3c7" }}>
        <div className="h-full rounded-full" style={{ backgroundColor: "#d97706", width: `${pct}%` }} />
      </div>

      {items.length > 0 && (
        <>
          {/* 등록이 필요한 정보 — 6항목(가변 D8) 2열 그리드. buyer 에게도 미등록 사실 노출(은폐 0). */}
          <p className="text-[11px] font-semibold mt-3 mb-1.5" style={{ color: "#92400e" }}>
            등록이 필요한 정보 ({items.length})
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {items.map((item, i) => {
              const label = actionText(item.actionKind);
              const handler = editHandler(item.actionKind);
              const useLink = !!item.href && !(canEdit && handler);
              return (
                <div key={`${item.label}-${i}`} className="flex items-center gap-1.5 text-[11px] min-w-0">
                  <span aria-hidden style={{ color: "#b45309" }}>•</span>
                  <span className="truncate" style={{ color: "#78350f" }}>{item.label}</span>
                  <span className="ml-auto shrink-0">
                    {useLink ? (
                      <Link
                        href={item.href as string}
                        className="font-semibold underline underline-offset-2"
                        style={{ color: "#b45309" }}
                      >
                        {label}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={handler}
                        className="font-semibold underline underline-offset-2"
                        style={{ color: "#b45309" }}
                      >
                        {label}
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] mt-2 leading-relaxed" style={{ color: "#a16207" }}>
            미등록 정보는 견적·문의 시 안내됩니다.
          </p>
        </>
      )}
    </div>
  );
}
