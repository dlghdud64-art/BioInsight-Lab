/**
 * GET /api/ocr/jobs/[jobId]/image · 인식 원본 이미지 열람 (§quote-scan-public-storage P0-b2)
 *
 * 호영님 승인 2026-09-13. P0-b1 발주서 프록시와 같은 형태다.
 *   OCR 원본(견적서·라벨)은 private blob 에 있고, 브라우저는 blob URL 을 받지 않는다.
 *   `<img src>` 는 이 경로를 가리킨다 → 열람마다 인증·조직 대조·감사가 붙는다.
 *
 * 순서: 인증 → OcrJob 조회 → **조직 대조(403)** → enforceAction → complete → private 스트림.
 *   OcrJob.organizationId 는 Organization FK 다(§scan-org-identity B-3) · 멤버십으로만 연다.
 *   OcrJob.imageUrl 에는 blob URL 이 들어 있다. `get()` 은 URL 을 그대로 받는다.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    const { jobId } = await params;

    const job = await db.ocrJob.findUnique({
      where: { id: jobId },
      select: { id: true, organizationId: true, type: true, imageUrl: true },
    });
    if (!job) {
      return NextResponse.json({ error: "인식 기록을 찾을 수 없습니다." }, { status: 404 });
    }

    /* 🛑 조직 대조 · 다른 조직의 견적서 원본을 열 수 없다.
     *   jobId 는 응답 JSON 에 실려 나가는 식별자다. 식별자를 안다고 열리면 public 과 같다. */
    const membership = await db.organizationMember.findFirst({
      where: { userId: session.user.id, organizationId: job.organizationId },
      select: { id: true },
    });
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!job.imageUrl) {
      return NextResponse.json(
        { error: "원본 이미지가 없습니다.", code: "NO_OCR_IMAGE" },
        { status: 404 },
      );
    }

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: "sensitive_data_export",
      targetEntityType: job.type === "QUOTE" ? "quote" : "receiving",
      targetEntityId: job.id,
      sourceSurface: "web_app",
      routePath: "/api/ocr/jobs/[jobId]/image",
    });
    if (!enforcement.allowed) return enforcement.deny();

    const { get } = await import("@vercel/blob");
    const blob = await get(job.imageUrl, { access: "private" });
    if (!blob || !blob.stream) {
      enforcement.fail();
      return NextResponse.json(
        { error: "원본 이미지를 찾을 수 없습니다.", code: "BLOB_NOT_FOUND" },
        { status: 404 },
      );
    }

    // 열람도 감사 대상이다 · 스트림을 내보내기 전에 기록한다(P0-b1 과 같은 순서).
    enforcement.complete({ organizationId: job.organizationId });

    return new NextResponse(blob.stream as unknown as BodyInit, {
      headers: {
        "Content-Type": blob.blob.contentType ?? "application/octet-stream",
        "Content-Disposition": "inline",
        // 조직 내부 문서 · 공유 캐시(CDN·프록시)에 남기지 않는다.
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    enforcement?.fail();
    console.error("[ocr/jobs/[jobId]/image] error:", error);
    return NextResponse.json({ error: "이미지를 여는 중 오류가 발생했습니다." }, { status: 500 });
  }
}
