import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// ─── 상수 ────────────────────────────────────────────────────────────────────
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const ALLOWED_EXTS = [".png", ".jpg", ".jpeg", ".webp"];

// ─── Supabase Storage 업로드 헬퍼 (환경변수 있을 때만 사용) ──────────────────
async function uploadToSupabase(
  buffer: Buffer,
  mimeType: string,
  path: string
): Promise<string> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.");
  }

  const bucket = "org-logos";
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${path}`;

  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": mimeType,
      "x-upsert": "true", // 덮어쓰기 허용
    },
    body: buffer,
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Supabase Storage 업로드 실패: ${res.status} ${errBody}`);
  }

  // 공개 URL 반환
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

// ─── 기존 Supabase Storage 파일 삭제 헬퍼 ──────────────────────────────────
async function deleteFromSupabase(publicUrl: string): Promise<void> {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) return;

    // URL에서 버킷/경로 추출
    // 예: https://xxx.supabase.co/storage/v1/object/public/org-logos/abc/logo.png
    const marker = "/object/public/";
    const markerIdx = publicUrl.indexOf(marker);
    if (markerIdx === -1) return;
    const objectPath = publicUrl.slice(markerIdx + marker.length); // "org-logos/abc/logo.png"
    const [bucket, ...rest] = objectPath.split("/");
    const filePath = rest.join("/");

    await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${filePath}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${serviceKey}` },
    });
  } catch {
    // 삭제 실패는 무시 (업로드는 이미 성공)
  }
}

// ─── POST /api/organizations/[id]/logo ───────────────────────────────────────
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

    // ADMIN 권한 확인
    const membership = await db.organizationMember.findFirst({
      where: { organizationId: id, userId: session.user.id, role: "ADMIN" },
    });
    if (!membership) {
      return NextResponse.json(
        { error: "관리자만 로고를 변경할 수 있습니다." },
        { status: 403 }
      );
    }

    // 조직 존재 확인 + 기존 로고 URL 가져오기
    const organization = await db.organization.findUnique({
      where: { id },
      select: { id: true, logoUrl: true },
    });
    if (!organization) {
      return NextResponse.json({ error: "조직을 찾을 수 없습니다." }, { status: 404 });
    }

    // ── FormData 파싱 ─────────────────────────────────────────────────────────
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "요청 형식이 올바르지 않습니다. FormData를 사용해 주세요." },
        { status: 400 }
      );
    }

    const file = formData.get("logo") as File | null;
    if (!file) {
      return NextResponse.json(
        { error: "logo 파일이 없습니다. FormData에 'logo' 키로 파일을 포함해 주세요." },
        { status: 400 }
      );
    }

    // ── 파일 유효성 검사 ──────────────────────────────────────────────────────
    // 1) MIME 타입 검증
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `허용되지 않는 파일 형식입니다. 허용: ${ALLOWED_TYPES.join(", ")}` },
        { status: 422 }
      );
    }

    // 2) 확장자 검증 (이중 검증)
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      return NextResponse.json(
        { error: `허용되지 않는 확장자입니다. 허용: ${ALLOWED_EXTS.join(", ")}` },
        { status: 422 }
      );
    }

    // 3) 파일 크기 검증
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: `파일 크기가 너무 큽니다. 최대 5MB까지 허용합니다. (현재: ${(file.size / 1024 / 1024).toFixed(1)}MB)` },
        { status: 422 }
      );
    }

    // ── 파일 버퍼 변환 ─────────────────────────────────────────────────────────
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // ── 스토리지 업로드 (Supabase Storage → base64 폴백) ──────────────────────
    let logoUrl: string;
    const hasSupabaseConfig =
      !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (hasSupabaseConfig) {
      // Supabase Storage 업로드
      const storagePath = `${id}/logo${ext}`;
      logoUrl = await uploadToSupabase(buffer, file.type, storagePath);

      // 기존 Supabase 파일 삭제 (다른 확장자 덮어쓰기 방지)
      if (organization.logoUrl && organization.logoUrl !== logoUrl) {
        await deleteFromSupabase(organization.logoUrl);
      }
    } else {
      // 폴백: base64 Data URL로 DB에 직접 저장
      // (Supabase Storage 미설정 환경 – 개발/스테이징)
      logoUrl = `data:${file.type};base64,${buffer.toString("base64")}`;
    }

    // ── DB 업데이트 ─────────────────────────────────────────────────────────────
    const updated = await db.organization.update({
      where: { id },
      data: { logoUrl },
      select: { id: true, name: true, logoUrl: true },
    });

    return NextResponse.json({ organization: updated, logoUrl });
  } catch (error: any) {
    console.error("[Logo Upload] Error:", error);
    return NextResponse.json(
      { error: error.message || "로고 업로드에 실패했습니다." },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/organizations/[id]/logo ─────────────────────────────────────
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

    const membership = await db.organizationMember.findFirst({
      where: { organizationId: id, userId: session.user.id, role: "ADMIN" },
    });
    if (!membership) {
      return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }

    const organization = await db.organization.findUnique({
      where: { id },
      select: { logoUrl: true },
    });
    if (!organization) {
      return NextResponse.json({ error: "조직을 찾을 수 없습니다." }, { status: 404 });
    }

    // Supabase Storage 파일 삭제
    if (organization.logoUrl && !organization.logoUrl.startsWith("data:")) {
      await deleteFromSupabase(organization.logoUrl);
    }

    // DB에서 logoUrl 제거
    const updated = await db.organization.update({
      where: { id },
      data: { logoUrl: null },
      select: { id: true, name: true, logoUrl: true },
    });

    return NextResponse.json({ organization: updated });
  } catch (error: any) {
    console.error("[Logo Delete] Error:", error);
    return NextResponse.json(
      { error: error.message || "로고 삭제에 실패했습니다." },
      { status: 500 }
    );
  }
}
