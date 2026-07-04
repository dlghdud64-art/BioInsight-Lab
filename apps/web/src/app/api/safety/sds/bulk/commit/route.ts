import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { uploadSdsFile, StorageNotConfiguredError } from "@/lib/safety/sds-storage";
import { backfillHazardFromMsds } from "@/lib/safety/msds-hazard-backfill";
import { supersedePriorSds } from "@/lib/safety/supersede-sds";
import { createActivityLog } from "@/lib/activity-log";
import { ActivityType } from "@prisma/client";

/**
 * §msds-bulk-registration B-P3 — 일괄 MSDS 등록 확정(commit).
 *   POST multipart: files[] + mapping(JSON, index별 {productId, docVersion?, issuedAt?, expiresAt?}).
 *   확정 productId 있는 건만: 파일 저장 + SDSDocument 생성(실 등록) + 위험분류 backfill.
 *   productId 없음=skip(no-op 아님, 사용자 선택). pool 밖 productId=forbidden(오등록 방지).
 *   부분 실패 격리(건별 status). fake success 금지 — 저장/생성 성공만 registered.
 *
 * ⚠ 감사(누가) 로그는 ActivityType enum 확장(migration) 필요 → 별도 트랙. createdAt=when 은 기록됨.
 */
interface MapEntry { productId?: string | null; docVersion?: string | null; issuedAt?: string | null; expiresAt?: string | null; }

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const form = await request.formData();
    const files = form.getAll("files").filter((f): f is File => typeof f !== "string");
    const mappingRaw = form.get("mapping");
    if (files.length === 0 || typeof mappingRaw !== "string") {
      return NextResponse.json({ error: "files 와 mapping 이 필요합니다.", code: "BAD_REQUEST" }, { status: 400 });
    }
    let mapping: MapEntry[];
    try {
      mapping = JSON.parse(mappingRaw);
      if (!Array.isArray(mapping)) throw new Error();
    } catch {
      return NextResponse.json({ error: "mapping 형식 오류(JSON 배열).", code: "BAD_MAPPING" }, { status: 400 });
    }

    // 조직 스코프 + 등록 가능한 재고 품목 pool(오등록 방지).
    const memberships = await db.organizationMember.findMany({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });
    const orgIds = memberships.map((m: { organizationId: string }) => m.organizationId);
    const organizationId = orgIds[0] ?? null;
    const inventories = await db.productInventory.findMany({
      where: { OR: [{ userId: session.user.id }, ...(orgIds.length ? [{ organizationId: { in: orgIds } }] : [])] },
      select: { product: { select: { id: true } } },
    });
    const allowed = new Set<string>();
    for (const inv of inventories as Array<{ product: { id: string } | null }>) if (inv.product) allowed.add(inv.product.id);

    const parseDate = (v?: string | null): Date | null => {
      if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d;
    };

    const results = [] as Array<Record<string, unknown>>;
    let registeredCount = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const m = mapping[i] ?? {};
      const productId = m.productId ?? null;
      if (!productId) { results.push({ fileName: f.name, status: "skipped" }); continue; }
      if (!allowed.has(productId)) { results.push({ fileName: f.name, productId, status: "forbidden" }); continue; }
      try {
        const buffer = Buffer.from(await f.arrayBuffer());
        let stored: { bucket: string; path: string };
        try {
          stored = await uploadSdsFile({ productId, fileName: f.name || "sds.pdf", buffer, contentType: f.type || undefined });
        } catch (e) {
          if (e instanceof StorageNotConfiguredError) { results.push({ fileName: f.name, productId, status: "storage_not_configured" }); continue; }
          throw e;
        }
        const doc = await db.sDSDocument.create({
          data: {
            productId, organizationId, fileName: f.name || "sds.pdf",
            bucket: stored.bucket, path: stored.path, source: "upload", docType: "sds",
            contentType: f.type || null, sizeBytes: buffer.length,
            docVersion: m.docVersion?.trim() || null, issuedAt: parseDate(m.issuedAt), expiresAt: parseDate(m.expiresAt),
          },
          select: { id: true },
        });
        // §msds-audit-versioning — 개정본 대체(이전 현행본 supersede) + 감사(누가·언제). best-effort(등록은 canonical).
        try { await supersedePriorSds(productId, doc.id); } catch (e) { console.error("MSDS supersede 실패:", e); }
        try {
          await createActivityLog({
            activityType: ActivityType.MSDS_REGISTERED, entityType: "PRODUCT", entityId: productId,
            userId: session.user.id, organizationId,
            metadata: { fileName: f.name, docVersion: m.docVersion?.trim() || null, source: "bulk" },
          });
        } catch (e) { console.error("MSDS 감사 로그 실패:", e); }
        const bf = await backfillHazardFromMsds({ productId, buffer, contentType: f.type, docType: "sds" });
        registeredCount += 1;
        results.push({ fileName: f.name, productId, status: "registered", hazardBackfilled: bf.backfilled });
      } catch (err) {
        console.error("MSDS bulk commit item 실패:", f.name, err);
        results.push({ fileName: f.name, productId, status: "failed" });
      }
    }

    return NextResponse.json({ registeredCount, total: files.length, results }, { status: 201 });
  } catch (error) {
    console.error("Error in MSDS bulk commit:", error);
    return NextResponse.json({ error: "일괄 등록에 실패했습니다." }, { status: 500 });
  }
}
