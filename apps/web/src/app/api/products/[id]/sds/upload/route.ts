import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { OrganizationRole } from "@prisma/client";
import { randomBytes } from "crypto";

export const runtime = "nodejs";
export const maxDuration = 60; // 파일 업로드는 시간이 걸릴 수 있음

// SDS 파일 업로드
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // 제품 확인
    const product = await db.product.findUnique({
      where: { id },
    });

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    // 권한 확인: safety_admin 또는 admin
    const userOrganizations = await db.organizationMember.findMany({
      where: {
        userId: session.user.id,
        role: {
          in: [OrganizationRole.ADMIN, OrganizationRole.VIEWER], // VIEWER = safety_admin
        },
      },
    });

    if (userOrganizations.length === 0 && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: safety_admin or admin role required" },
        { status: 403 }
      );
    }

    // 첫 번째 조직 ID 사용 (또는 null로 공용)
    const organizationId = userOrganizations.length > 0 ? userOrganizations[0].organizationId : null;

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "File is required" },
        { status: 400 }
      );
    }

    // 파일 타입 검증 (PDF만 허용)
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are allowed" },
        { status: 400 }
      );
    }

    // 파일 크기 제한 (50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size must be less than 50MB" },
        { status: 400 }
      );
    }

    // 파일을 Buffer로 변환
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 파일명 생성 (타임스탬프 + 랜덤)
    const timestamp = Date.now();
    const randomStr = randomBytes(8).toString("hex");
    const fileExtension = file.name.split(".").pop() || "pdf";
    const fileName = `sds_${timestamp}_${randomStr}.${fileExtension}`;

    // Supabase Storage에 업로드 (구현 필요)
    // 현재는 임시로 경로만 저장
    const bucket = "sds-documents";
    const path = `products/${id}/${fileName}`;

    // TODO: Supabase Storage에 실제 업로드
    // const { data, error } = await supabase.storage
    //   .from(bucket)
    //   .upload(path, buffer, {
    //     contentType: file.type,
    //     upsert: false,
    //   });

    // SDSDocument 생성
    const sdsDocument = await db.sDSDocument.create({
      data: {
        productId: id,
        organizationId: organizationId || undefined,
        source: organizationId ? "uploaded" : "vendor",
        fileName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
        bucket,
        path,
      },
    });

    return NextResponse.json({ sdsDocument }, { status: 201 });
  } catch (error: any) {
    console.error("Error uploading SDS:", error);
    return NextResponse.json(
      { error: "Failed to upload SDS" },
      { status: 500 }
    );
  }
}






