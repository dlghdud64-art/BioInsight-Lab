/**
 * §inventory-org-required (호영님 2026-09-11) — **재고는 조직의 것이다.** 조직이 없으면 422 + 갈 길.
 *
 * 제품 판정: LabAxis 는 랩 운영 OS 이고 개인 재고는 제품 개념이 아니다. 스키마의
 * `ProductInventory.organizationId` nullable 은 허용이지 의도가 아니다.
 * 그런데 생성 경로 두 곳이 조직 없는 행을 만들고 있었다(POST /api/inventory 의 개인 재고 fallback ·
 * import/commit 의 조직 미해석). 그 결과가 prod BCP 1행 · orgOwnership.ownerlessCount 1 이다.
 *
 * 🛑 막다른 길로 끝내지 않는다(호영님 요건). 기능을 잃는 사용자가 실제로 있을 수 있으므로
 *   응답에 **갈 길**(조직 화면)을 함께 싣고, 화면은 그 버튼을 띄운다.
 *   `/dashboard/organizations` 는 조직 생성(POST /api/organizations)이 되는 실재 화면이다.
 *   초대로 참여하는 사용자는 초대 링크로 들어온다.
 */
import { NextResponse } from "next/server";

export const NO_ORGANIZATION_CODE = "NO_ORGANIZATION" as const;

/** 조직을 만들거나 참여하는 화면. 존재는 sentinel 이 파일로 확인한다. */
export const ORGANIZATION_ENTRY_HREF = "/dashboard/organizations";

export interface NoOrganizationBody {
  error: string;
  code: typeof NO_ORGANIZATION_CODE;
  action: { label: string; href: string };
}

/** @param blocked 무엇이 막혔는지 — 예: "재고를 등록할 수 없습니다" */
export function noOrganizationBody(blocked: string): NoOrganizationBody {
  return {
    error: `소속 조직이 없어 ${blocked} · 조직을 만들거나 초대를 받아 참여한 뒤 다시 시도하세요.`,
    code: NO_ORGANIZATION_CODE,
    action: { label: "조직 만들기·참여", href: ORGANIZATION_ENTRY_HREF },
  };
}

export function noOrganizationResponse(blocked: string) {
  return NextResponse.json(noOrganizationBody(blocked), { status: 422 });
}
