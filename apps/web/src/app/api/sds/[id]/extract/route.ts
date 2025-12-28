import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { OrganizationRole } from "@prisma/client";
import { extractSafetyInfoFromMSDS } from "@/lib/ai/safety-extractor";
import { extractTextFromPDF } from "@/lib/ai/pdf-parser";

// SDS 문서에서 AI 추출 작업 시작
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

    // SDS 문서 확인
    const sdsDocument = await db.sDSDocument.findUnique({
      where: { id },
      include: {
        product: true,
        organization: true,
      },
    });

    if (!sdsDocument) {
      return NextResponse.json(
        { error: "SDS document not found" },
        { status: 404 }
      );
    }

    // 권한 확인: safety_admin 또는 admin
    if (sdsDocument.organizationId) {
      const membership = await db.organizationMember.findFirst({
        where: {
          userId: session.user.id,
          organizationId: sdsDocument.organizationId,
          role: {
            in: [OrganizationRole.ADMIN, OrganizationRole.VIEWER], // VIEWER = safety_admin
          },
        },
      });

      if (!membership && session.user.role !== "ADMIN") {
        return NextResponse.json(
          { error: "Forbidden: safety_admin or admin role required" },
          { status: 403 }
        );
      }
    }

    // 이미 처리 중이면 에러
    if (sdsDocument.extractionStatus === "processing" || sdsDocument.extractionStatus === "queued") {
      return NextResponse.json(
        { error: "Extraction already in progress" },
        { status: 400 }
      );
    }

    // 작업 ID 생성
    const jobId = `extract_${id}_${Date.now()}`;

    // 상태를 queued로 업데이트
    await db.sDSDocument.update({
      where: { id },
      data: {
        extractionStatus: "queued",
        extractionJobId: jobId,
      },
    });

    // 비동기로 추출 작업 시작 (백그라운드 처리)
    // 실제로는 큐 시스템을 사용하는 것이 좋지만, 여기서는 간단하게 처리
    processExtractionAsync(id, jobId).catch((error) => {
      console.error("Extraction failed:", error);
      db.sDSDocument.update({
        where: { id },
        data: {
          extractionStatus: "failed",
        },
      }).catch(console.error);
    });

    return NextResponse.json({
      jobId,
      status: "queued",
    });
  } catch (error: any) {
    console.error("Error starting extraction:", error);
    return NextResponse.json(
      { error: "Failed to start extraction" },
      { status: 500 }
    );
  }
}

// 비동기 추출 처리 함수
async function processExtractionAsync(sdsDocumentId: string, jobId: string) {
  try {
    // 상태를 processing으로 업데이트
    await db.sDSDocument.update({
      where: { id: sdsDocumentId },
      data: {
        extractionStatus: "processing",
      },
    });

    // SDS 문서 조회
    const sdsDocument = await db.sDSDocument.findUnique({
      where: { id: sdsDocumentId },
      include: {
        product: true,
      },
    });

    if (!sdsDocument) {
      throw new Error("SDS document not found");
    }

    // 텍스트 추출
    let textToAnalyze = sdsDocument.extractedText;

    // extractedText가 없으면 파일에서 추출 (TODO: Supabase Storage에서 다운로드)
    if (!textToAnalyze && sdsDocument.path) {
      // TODO: Supabase Storage에서 파일 다운로드 및 PDF 파싱
      // 현재는 extractedText가 있으면 사용
      throw new Error("File download not implemented yet");
    }

    if (!textToAnalyze || textToAnalyze.trim().length === 0) {
      throw new Error("No text to analyze");
    }

    // AI로 안전 정보 추출
    const safetyInfo = await extractSafetyInfoFromMSDS(textToAnalyze);

    // 결과 저장
    await db.sDSDocument.update({
      where: { id: sdsDocumentId },
      data: {
        extractionStatus: "done",
        extractionResult: {
          hazardCodes: safetyInfo.hazardCodes || [],
          pictograms: safetyInfo.pictograms || [],
          storageCondition: safetyInfo.storageCondition || null,
          ppe: safetyInfo.ppe || [],
          summary: safetyInfo.summary || null,
        },
      },
    });
  } catch (error: any) {
    console.error("Extraction error:", error);
    await db.sDSDocument.update({
      where: { id: sdsDocumentId },
      data: {
        extractionStatus: "failed",
      },
    });
    throw error;
  }
}

// 추출 작업 취소
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const sdsDocument = await db.sDSDocument.findUnique({
      where: { id },
    });

    if (!sdsDocument) {
      return NextResponse.json(
        { error: "SDS document not found" },
        { status: 404 }
      );
    }

    // queued 또는 processing 상태만 취소 가능
    if (sdsDocument.extractionStatus !== "queued" && sdsDocument.extractionStatus !== "processing") {
      return NextResponse.json(
        { error: "Cannot cancel: extraction not in progress" },
        { status: 400 }
      );
    }

    // 상태 초기화
    await db.sDSDocument.update({
      where: { id },
      data: {
        extractionStatus: null,
        extractionJobId: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error canceling extraction:", error);
    return NextResponse.json(
      { error: "Failed to cancel extraction" },
      { status: 500 }
    );
  }
}





