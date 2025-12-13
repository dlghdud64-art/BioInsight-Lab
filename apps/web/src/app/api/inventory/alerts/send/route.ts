import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/sender";
import { generateLowStockAlertEmail } from "@/lib/email/templates";

/**
 * 재고 부족 알림 이메일 발송 API
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { alertSettingId, inventoryId } = body;

    if (!alertSettingId || !inventoryId) {
      return NextResponse.json(
        { error: "alertSettingId and inventoryId are required" },
        { status: 400 }
      );
    }

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
      return NextResponse.json(
        { error: "Alert setting not found or disabled" },
        { status: 404 }
      );
    }

    // 재고 부족 확인
    const inventory = alertSetting.inventory;
    if (
      inventory.safetyStock === null ||
      inventory.currentQuantity > inventory.safetyStock
    ) {
      return NextResponse.json(
        { error: "Inventory is not low stock" },
        { status: 400 }
      );
    }

    // 이메일 수신자 결정
    const recipientEmail = alertSetting.user?.email;
    if (!recipientEmail) {
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

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error sending inventory alert:", error);
    return NextResponse.json(
      { error: "Failed to send alert" },
      { status: 500 }
    );
  }
}

