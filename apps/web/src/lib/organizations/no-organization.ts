/**
 * §inventory-org-required (호영님 2026-09-11) — **재고는 조직의 것이다.** 조직이 없으면 422 + 갈 길.
 *
 * 제품 판정: LabAxis 는 랩 운영 OS 이고 개인 재고는 제품 개념이 아니다. 스키마의
 * `ProductInventory.organizationId` nullable 은 허용이지 의도가 아니다.
 *
 * 🛑 막다른 길로 끝내지 않는다(호영님 요건). 갈 길은 **두 갈래**다 (2026-09-11 화면 실측):
 *   `/dashboard/organizations` 에는 「조직 생성」 이 있고 「조직 참여」·「초대 코드 입력」 은 **없다**.
 *   참여는 초대 수락 경로뿐이다. 그래서
 *     버튼  하나 · 「조직 만들기」 → 조직 화면 (실재 · sentinel 이 파일로 확인)
 *     문장  초대 요청 안내 (버튼으로 만들 곳이 없다 · 없는 화면을 가리키면 또 막다른 길)
 *   🛑 옛 판본 라벨 「조직 만들기·참여」 는 없는 기능(참여)을 약속했다.
 *
 * 코드는 `NO_ORGANIZATION` (대문자) · smart-receiving · scan-label · OCR 5라우트 · team 과 같은 코드.
 * 카피와 코드는 이 파일 한 곳에서 같이 다닌다.
 */
import { NextResponse } from "next/server";

export const NO_ORGANIZATION_CODE = "NO_ORGANIZATION" as const;

/** 조직을 만드는 화면. 존재는 sentinel 이 파일로 확인한다. */
export const ORGANIZATION_ENTRY_HREF = "/dashboard/organizations";
export const ORGANIZATION_CREATE_LABEL = "조직 만들기";
export const NO_ORGANIZATION_DETAIL = "LabAxis 재고는 조직(랩) 단위로 관리됩니다.";
export const NO_ORGANIZATION_INVITE_HINT = "이미 소속될 조직이 있다면 그 조직 관리자에게 초대를 요청하세요.";

export interface NoOrganizationBody {
  /** 제목 */
  error: string;
  /** 본문 */
  detail: string;
  /** 초대 갈래 · 문장으로만 */
  hint: string;
  code: typeof NO_ORGANIZATION_CODE;
  /** 버튼은 하나 · 조직 만들기 */
  action: { label: string; href: string };
}

/** @param task 막힌 일 · 예: "재고를 등록할" → 「조직에 속해야 재고를 등록할 수 있습니다」 */
export function noOrganizationBody(task: string): NoOrganizationBody {
  return {
    error: `조직에 속해야 ${task} 수 있습니다`,
    detail: NO_ORGANIZATION_DETAIL,
    hint: NO_ORGANIZATION_INVITE_HINT,
    code: NO_ORGANIZATION_CODE,
    action: { label: ORGANIZATION_CREATE_LABEL, href: ORGANIZATION_ENTRY_HREF },
  };
}

export function noOrganizationResponse(task: string) {
  return NextResponse.json(noOrganizationBody(task), { status: 422 });
}
