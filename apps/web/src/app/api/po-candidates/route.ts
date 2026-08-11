/**
 * /api/po-candidates — PO Conversion Candidates CRUD
 *
 * GET    ?stage=po_conversion_candidate   — 현재 user 의 후보 목록
 * POST   { ...POCandidateCreateInput }    — 후보 생성
 * PATCH  { id, stage, approvalStatus? }   — stage 업데이트
 * DELETE ?id=xxx                          — 후보 삭제
 *
 * Seed data 는 prisma/seed.ts 에서 관리.
 * 이 route 는 runtime auto-seed 를 하지 않는다.
 */

import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  listPOCandidates,
  createPOCandidate,
  updatePOCandidateStage,
  deletePOCandidate,
  type POCandidateCreateInput,
} from "@/lib/persistence/po-candidate-server";
// §11.209b Phase 2 — workspace.plan → ApprovalPolicy fallback (옵션 1
// 보수적 wiring). PLAN_DESCRIPTOR single source 통과.
import { resolveApprovalPolicyForPlan } from "@/lib/billing/plan-descriptor";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const stage = req.nextUrl.searchParams.get("stage") ?? undefined;
    const orgId = req.nextUrl.searchParams.get("organizationId") ?? undefined;

    const candidates = await listPOCandidates(session.user.id, { stage, organizationId: orgId });
    return NextResponse.json({ candidates });
  } catch (err) {
    console.error("[po-candidates] GET error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'sensitive_data_import',
      targetEntityType: 'ai_action',
      // §enforcement-handle-close-sweep (기타) — 'unknown' 유지.
      //   POCandidate 는 이 핸들 이후에 생성된다(클래스 ②).
      //   ⚠️ 같은 파일의 PATCH/DELETE 는 enforceAction 자체가 없다
      //     → §enforcement-coverage-gap E7 목록 후보.
      targetEntityId: 'unknown',
      sourceSurface: 'web_app',
      routePath: '/api/po-candidates',
    });
    if (!enforcement.allowed) return enforcement.deny();

    // (죽은 재검사 제거: 같은 POST 핸들러 상단에서 이미 401 처리했다)
    const body = await req.json();

    // §11.209b Phase 2 — body.approvalPolicy 부재 시 user 의 workspace.plan
    // 으로부터 PLAN_DESCRIPTOR.approvalPolicy fallback. caller override 우선
    // (body 에 명시된 값은 그대로 사용).
    //
    // billing/checkout 의 workspaceMember.findFirst 패턴과 정합. user 가 다중
    // workspace 인 경우 first match (보수적 — 후속 batch 에서 active workspace
    // 명시 매핑 가능).
    // §11.209c Phase 2 — workspace.plan + stripePriceId 둘 다 select.
    // resolveApprovalPolicyForPlan 의 stripePriceId 분기 활성 (TEAM +
    // BUSINESS_MONTHLY → "in_app_approval").
    let resolvedApprovalPolicy = body.approvalPolicy;
    if (!resolvedApprovalPolicy) {
      const member = await db.workspaceMember.findFirst({
        where: { userId: session.user.id },
        include: { workspace: { select: { plan: true, stripePriceId: true } } },
      });
      resolvedApprovalPolicy = resolveApprovalPolicyForPlan(
        member?.workspace?.plan ?? null,
        member?.workspace?.stripePriceId ?? null,
      );
    }

    const input: POCandidateCreateInput = {
      ...body,
      userId: session.user.id,
      approvalPolicy: resolvedApprovalPolicy,
    };

    const created = await createPOCandidate(input);
    enforcement.complete({
      beforeState: { candidateId: null },
      afterState: { candidateId: created.id, approvalPolicy: resolvedApprovalPolicy },
    });

    return NextResponse.json({ candidate: created }, { status: 201 });
  } catch (err) {
    enforcement?.fail();
    console.error("[po-candidates] POST error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, stage, approvalStatus } = body;

    // 검증은 lock 획득 이전에 — 400 이 lock 을 잡지 않게 한다.
    if (!id || !stage) {
      return NextResponse.json({ error: "id and stage required" }, { status: 400 });
    }

    // §enforcement-coverage-gap 확정 사례 — 이 핸들러에는 enforceAction 이 없었다.
    //   같은 파일 POST 에는 있는데 PATCH/DELETE 에만 빠져 있던 부분 누락.
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'sensitive_data_import',
      targetEntityType: 'ai_action',
      targetEntityId: id,
      sourceSurface: 'web_app',
      routePath: '/api/po-candidates',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const updated = await updatePOCandidateStage(id, session.user.id, stage, { approvalStatus });

    // §po-candidate-idor — 남의 후보이거나 없으면 헬퍼가 쓰기 없이 null 을 준다.
    //   존재 여부를 노출하지 않도록 403 이 아니라 404 로 응답한다.
    if (!updated) {
      enforcement.fail();
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    enforcement.complete({
      beforeState: { candidateId: id },
      afterState: { candidateId: id, stage, approvalStatus: approvalStatus ?? null },
    });

    return NextResponse.json({ candidate: updated });
  } catch (err) {
    enforcement?.fail();
    console.error("[po-candidates] PATCH error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    // §enforcement-coverage-gap 확정 사례 — 파괴적 연산인데 enforceAction 이 없었다.
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'sensitive_data_delete',
      targetEntityType: 'ai_action',
      targetEntityId: id,
      sourceSurface: 'web_app',
      routePath: '/api/po-candidates',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const deleted = await deletePOCandidate(id, session.user.id);

    // §po-candidate-idor — 남의 후보이거나 없으면 삭제가 일어나지 않는다.
    //   존재 여부를 노출하지 않도록 403 이 아니라 404 로 응답한다.
    if (!deleted) {
      enforcement.fail();
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    enforcement.complete({
      beforeState: { candidateId: id, deleted: false },
      afterState: { candidateId: id, deleted: true },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    enforcement?.fail();
    console.error("[po-candidates] DELETE error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
