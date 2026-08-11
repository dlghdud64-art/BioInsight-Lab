import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/sender";
import { generateLowStockAlertEmail } from "@/lib/email/templates";

/**
 * 재고 부족 알림 이메일 발송 API
 */
export async function POST(request: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    const body = await request.json();
    const { alertSettingId, inventoryId } = body;

    // 입력 검증은 lock 획득 **이전**에 — 400 이 lock 을 잡지 않게 한다.
    if (!alertSettingId || !inventoryId) {
      return NextResponse.json(
        { error: "alertSettingId and inventoryId are required" },
        { status: 400 }
      );
    }

    // §enforcement-handle-close-sweep (inventory 배치) — 대상 엔티티 실재(inventoryId 필수)
    //   → per-resource 키. 아래 모든 early-return 과 catch 에서 fail(), 성공 시 complete().
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'sensitive_data_export',
      targetEntityType: 'inventory',
      targetEntityId: inventoryId,
      sourceSurface: 'web_app',
      routePath: '/api/inventory/alerts/send',
    });
    if (!enforcement.allowed) return enforcement.deny();

    // 알림 설정 및 재고 정보 조회
    const alertSetting = await db.inventoryAlertSetting.findUnique({
      where: { id: alertSettingId },
      include: {
        inventory: {
          include: {
            product: true,
          },
        },
        user: true,
      },
    });

    if (!alertSetting || !alertSetting.enabled) {
      enforcement.fail();
      return NextResponse.json(
        { error: "Alert setting not found or disabled" },
        { status: 404 }
      );
    }

    // #api-inventory-mutation-info-leak — alertSetting.inventory ownership
    //   검증 (trigger leak 차단). 기존 코드는 alertSettingId 받으면 누구든
    //   trigger 가능 → 다른 organization 의 alert email 발송 가능. isOwner
    //   OR isOrgMember 검증 후 sendEmail 진행.
    {
      const inv = alertSetting.inventory;
      const isOwner = inv.userId === session.user.id;
      let isOrgMember = false;
      if (!isOwner && inv.organizationId) {
        const membership = await db.organizationMember.findFirst({
          where: { userId: session.user.id, organizationId: inv.organizationId },
          select: { id: true },
        });
        isOrgMember = !!membership;
      }
      if (!isOwner && !isOrgMember) {
        enforcement.fail();
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // 재고 부족 확인
    const inventory = alertSetting.inventory;
    if (
      inventory.safetyStock === null ||
      inventory.currentQuantity > inventory.safetyStock
    ) {
      enforcement.fail();
      return NextResponse.json(
        { error: "Inventory is not low stock" },
        { status: 400 }
      );
    }

    // 이메일 수신자 결정
    const recipientEmail = alertSetting.user?.email;
    if (!recipientEmail) {
      enforcement.fail();
      return NextResponse.json(
        { error: "No email address found for recipient" },
        { status: 400 }
      );
    }

    // 이메일 템플릿 생성
    const emailTemplate = generateLowStockAlertEmail({
      productName: inventory.product.name,
      catalogNumber: inventory.product.catalogNumber || null,
      currentQuantity: inventory.currentQuantity,
      unit: inventory.unit,
      safetyStock: inventory.safetyStock,
      location: inventory.location || null,
      inventoryUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/inventory`,
    });

    // 이메일 발송
    await sendEmail({
      to: recipientEmail,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    // 알림 이력 기록
    await db.inventoryAlertLog.create({
      data: {
        alertSettingId: alertSetting.id,
        inventoryId: inventory.id,
        userId: alertSetting.userId || null,
        organizationId: alertSetting.organizationId || null,
        alertType: alertSetting.alertType,
        message: emailTemplate.text,
        triggeredValue: inventory.currentQuantity,
        thresholdValue: inventory.safetyStock,
      },
    });

    // 마지막 알림 시간 업데이트
    await db.inventoryAlertSetting.update({
      where: { id: alertSetting.id },
      data: { lastNotifiedAt: new Date() },
    });

    enforcement.complete({
      beforeState: { inventoryId, alertSettingId, lastNotifiedAt: alertSetting.lastNotifiedAt },
      afterState: { inventoryId, alertSettingId, sentTo: recipientEmail, alertType: alertSetting.alertType },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    enforcement?.fail();
    console.error("Error sending inventory alert:", error);
    return NextResponse.json(
      { error: "Failed to send alert" },
      { status: 500 }
    );
  }
}

