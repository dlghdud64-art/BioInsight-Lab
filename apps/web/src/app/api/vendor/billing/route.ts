import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 리드당 과금 처리 (견적 요청 생성 시 호출)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json();
    const { quoteId, vendorIds } = body;

    if (!quoteId || !vendorIds || !Array.isArray(vendorIds)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // 각 벤더에 대해 리드당 과금 처리
    const billingRecords = [];

    for (const vendorId of vendorIds) {
      const vendor = await db.vendor.findUnique({
        where: { id: vendorId },
        select: { id: true, leadPricePerQuote: true, isPremium: true },
      });

      if (!vendor || !vendor.leadPricePerQuote || vendor.leadPricePerQuote <= 0) {
        continue; // 과금이 설정되지 않은 벤더는 스킵
      }

      // 과금 기록 생성
      const billingRecord = await db.vendorBillingRecord.create({
        data: {
          vendorId: vendor.id,
          type: "LEAD",
          amount: vendor.leadPricePerQuote,
          quantity: 1,
          description: `견적 요청 #${quoteId}에 대한 리드 과금`,
        },
      });

      // 벤더 통계 업데이트
      await db.vendor.update({
        where: { id: vendor.id },
        data: {
          totalLeads: { increment: 1 },
          totalRevenue: { increment: vendor.leadPricePerQuote },
        },
      });

      billingRecords.push(billingRecord);
    }

    return NextResponse.json({ success: true, billingRecords });
  } catch (error) {
    console.error("Error processing billing:", error);
    return NextResponse.json(
      { error: "Failed to process billing" },
      { status: 500 }
    );
  }
}

// 벤더 과금 기록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, email: true },
    });

    if (user?.role !== "SUPPLIER") {
      return NextResponse.json({ error: "Only suppliers can access this" }, { status: 403 });
    }

    const vendor = await db.vendor.findFirst({
      where: { email: user.email || undefined },
    });

    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const type = searchParams.get("type");

    const where: any = { vendorId: vendor.id };
    if (type) {
      where.type = type;
    }

    const records = await db.vendorBillingRecord.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // 통계 계산
    const stats = {
      totalRevenue: vendor.totalRevenue,
      totalLeads: vendor.totalLeads,
      thisMonthRevenue: 0,
      thisMonthLeads: 0,
    };

    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);

    const thisMonthRecords = await db.vendorBillingRecord.findMany({
      where: {
        vendorId: vendor.id,
        createdAt: { gte: thisMonthStart },
      },
    });

    thisMonthRecords.forEach((record) => {
      if (record.type === "LEAD") {
        stats.thisMonthLeads += record.quantity || 1;
      }
      stats.thisMonthRevenue += record.amount;
    });

    return NextResponse.json({ records, stats });
  } catch (error) {
    console.error("Error fetching billing records:", error);
    return NextResponse.json(
      { error: "Failed to fetch billing records" },
      { status: 500 }
    );
  }
}



import { auth } from "@/auth";
import { db } from "@/lib/db";

// 리드당 과금 처리 (견적 요청 생성 시 호출)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json();
    const { quoteId, vendorIds } = body;

    if (!quoteId || !vendorIds || !Array.isArray(vendorIds)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // 각 벤더에 대해 리드당 과금 처리
    const billingRecords = [];

    for (const vendorId of vendorIds) {
      const vendor = await db.vendor.findUnique({
        where: { id: vendorId },
        select: { id: true, leadPricePerQuote: true, isPremium: true },
      });

      if (!vendor || !vendor.leadPricePerQuote || vendor.leadPricePerQuote <= 0) {
        continue; // 과금이 설정되지 않은 벤더는 스킵
      }

      // 과금 기록 생성
      const billingRecord = await db.vendorBillingRecord.create({
        data: {
          vendorId: vendor.id,
          type: "LEAD",
          amount: vendor.leadPricePerQuote,
          quantity: 1,
          description: `견적 요청 #${quoteId}에 대한 리드 과금`,
        },
      });

      // 벤더 통계 업데이트
      await db.vendor.update({
        where: { id: vendor.id },
        data: {
          totalLeads: { increment: 1 },
          totalRevenue: { increment: vendor.leadPricePerQuote },
        },
      });

      billingRecords.push(billingRecord);
    }

    return NextResponse.json({ success: true, billingRecords });
  } catch (error) {
    console.error("Error processing billing:", error);
    return NextResponse.json(
      { error: "Failed to process billing" },
      { status: 500 }
    );
  }
}

// 벤더 과금 기록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, email: true },
    });

    if (user?.role !== "SUPPLIER") {
      return NextResponse.json({ error: "Only suppliers can access this" }, { status: 403 });
    }

    const vendor = await db.vendor.findFirst({
      where: { email: user.email || undefined },
    });

    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const type = searchParams.get("type");

    const where: any = { vendorId: vendor.id };
    if (type) {
      where.type = type;
    }

    const records = await db.vendorBillingRecord.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // 통계 계산
    const stats = {
      totalRevenue: vendor.totalRevenue,
      totalLeads: vendor.totalLeads,
      thisMonthRevenue: 0,
      thisMonthLeads: 0,
    };

    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);

    const thisMonthRecords = await db.vendorBillingRecord.findMany({
      where: {
        vendorId: vendor.id,
        createdAt: { gte: thisMonthStart },
      },
    });

    thisMonthRecords.forEach((record) => {
      if (record.type === "LEAD") {
        stats.thisMonthLeads += record.quantity || 1;
      }
      stats.thisMonthRevenue += record.amount;
    });

    return NextResponse.json({ records, stats });
  } catch (error) {
    console.error("Error fetching billing records:", error);
    return NextResponse.json(
      { error: "Failed to fetch billing records" },
      { status: 500 }
    );
  }
}



import { auth } from "@/auth";
import { db } from "@/lib/db";

// 리드당 과금 처리 (견적 요청 생성 시 호출)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json();
    const { quoteId, vendorIds } = body;

    if (!quoteId || !vendorIds || !Array.isArray(vendorIds)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // 각 벤더에 대해 리드당 과금 처리
    const billingRecords = [];

    for (const vendorId of vendorIds) {
      const vendor = await db.vendor.findUnique({
        where: { id: vendorId },
        select: { id: true, leadPricePerQuote: true, isPremium: true },
      });

      if (!vendor || !vendor.leadPricePerQuote || vendor.leadPricePerQuote <= 0) {
        continue; // 과금이 설정되지 않은 벤더는 스킵
      }

      // 과금 기록 생성
      const billingRecord = await db.vendorBillingRecord.create({
        data: {
          vendorId: vendor.id,
          type: "LEAD",
          amount: vendor.leadPricePerQuote,
          quantity: 1,
          description: `견적 요청 #${quoteId}에 대한 리드 과금`,
        },
      });

      // 벤더 통계 업데이트
      await db.vendor.update({
        where: { id: vendor.id },
        data: {
          totalLeads: { increment: 1 },
          totalRevenue: { increment: vendor.leadPricePerQuote },
        },
      });

      billingRecords.push(billingRecord);
    }

    return NextResponse.json({ success: true, billingRecords });
  } catch (error) {
    console.error("Error processing billing:", error);
    return NextResponse.json(
      { error: "Failed to process billing" },
      { status: 500 }
    );
  }
}

// 벤더 과금 기록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, email: true },
    });

    if (user?.role !== "SUPPLIER") {
      return NextResponse.json({ error: "Only suppliers can access this" }, { status: 403 });
    }

    const vendor = await db.vendor.findFirst({
      where: { email: user.email || undefined },
    });

    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const type = searchParams.get("type");

    const where: any = { vendorId: vendor.id };
    if (type) {
      where.type = type;
    }

    const records = await db.vendorBillingRecord.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // 통계 계산
    const stats = {
      totalRevenue: vendor.totalRevenue,
      totalLeads: vendor.totalLeads,
      thisMonthRevenue: 0,
      thisMonthLeads: 0,
    };

    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);

    const thisMonthRecords = await db.vendorBillingRecord.findMany({
      where: {
        vendorId: vendor.id,
        createdAt: { gte: thisMonthStart },
      },
    });

    thisMonthRecords.forEach((record) => {
      if (record.type === "LEAD") {
        stats.thisMonthLeads += record.quantity || 1;
      }
      stats.thisMonthRevenue += record.amount;
    });

    return NextResponse.json({ records, stats });
  } catch (error) {
    console.error("Error fetching billing records:", error);
    return NextResponse.json(
      { error: "Failed to fetch billing records" },
      { status: 500 }
    );
  }
}






