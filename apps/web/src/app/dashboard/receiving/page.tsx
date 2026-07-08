"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useOpsStore } from "@/lib/ops-console/ops-store";
import {
  buildModuleHeaderStats,
  buildModuleLandingItems,
  MODULE_ORIENTATION,
  type ModuleLandingItem,
} from "@/lib/ops-console/module-landing-adapter";
import { MobileReceivingView } from "@/components/receiving/mobile-receiving-view";
import { ReceivingDesktopList } from "@/components/receiving/receiving-desktop-list";
import { ReceivingQuickviewDrawer } from "@/components/receiving/receiving-quickview-drawer";
import { ReceivingPostModal } from "@/components/receiving/receiving-post-modal";
import { ArrowRight } from "lucide-react";
// §11.348-A-4b — 공급사 입고 회신 검토 패널(same-canvas).
import { ReceivingReviewPanel } from "@/components/receiving/receiving-review-panel";
// §action-toast P3 — 입고 재고반영 결과 토스트 통일(자체 토스트 → labToast).
import { labToast } from "@/lib/toast/lab-toast";

// ── Component ─────────────────────────────────────────────────────
// §11.334 P2 — 입고 목록 데스크탑 리디자인(시안: 입고 목록 웹 리디자인.html).
//   기존 우선처리 카드/bucket 상태탭/다운스트림 → 파이프라인 퍼널 + 탭툴바 + 카드리스트.
//   데이터(allItems) 불변, 파생은 receiving-list-view-model(순수함수). 모바일 뷰 유지.
export default function ReceivingLandingPage() {
  const router = useRouter();
  const { unifiedInboxItems, postToInventory } = useOpsStore();

  const headerStats = useMemo(
    () => buildModuleHeaderStats(unifiedInboxItems, "receiving"),
    [unifiedInboxItems],
  );
  const allItems = useMemo(
    () => buildModuleLandingItems(unifiedInboxItems, "receiving"),
    [unifiedInboxItems],
  );

  const orientation = MODULE_ORIENTATION.receiving;
  const isEmpty = allItems.length === 0;

  // §11.334 P3 — 퀵뷰 드로어(same-canvas). 행클릭 = 드로어 오픈(라우트 이동 대체).
  const [quickviewItem, setQuickviewItem] = useState<ModuleLandingItem | null>(null);
  const goDetail = (item: ModuleLandingItem) => router.push(`/dashboard/receiving/${item.entityId}`);

  // §11.334 P4 — 재고 반영 same-canvas 모달 + 토스트.
  const [postModalItem, setPostModalItem] = useState<ModuleLandingItem | null>(null);

  return (
    <div className="min-h-screen bg-white p-4 md:p-6 space-y-5">
      {/* §11.348-A-4b — 공급사 입고 회신(PENDING_REVIEW) 검토. 0건 시 자동 숨김. */}
      <ReceivingReviewPanel />

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="mb-2 md:mb-0 md:rounded-lg md:bg-white md:border md:border-slate-200 md:p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] md:text-lg font-extrabold md:font-bold text-slate-900">입고 관리</h1>
            <p className="text-[12.5px] md:text-xs text-slate-500 md:text-slate-600 mt-0.5">{orientation.role}</p>
          </div>
          <p className="text-xs text-slate-500 max-w-xs text-right">
            {headerStats.nextActionSummary}
          </p>
        </div>
      </div>

      {/* ── Empty ──────────────────────────────────────────────────── */}
      {isEmpty && (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
          <p className="text-sm text-slate-600">
            현재 처리 중인 입고가 없습니다 — 발주에서 입고 예정을 확인하세요
          </p>
          <Link
            href="/dashboard/purchase-orders"
            className="inline-flex items-center gap-1 mt-3 text-xs text-blue-600 hover:text-blue-700"
          >
            발주 관리로 이동 <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {/* ── Mobile (below md) ──────────────────────────────────────── */}
      {!isEmpty && (
        <div className="md:hidden">
          <MobileReceivingView
            items={allItems}
            onItemClick={(item) => router.push(`/dashboard/receiving/${item.entityId}`)}
          />
        </div>
      )}

      {/* ── Desktop (md+) — §11.334 P2 시안 리디자인 ────────────────── */}
      {!isEmpty && (
        <div className="hidden md:block">
          <ReceivingDesktopList
            items={allItems}
            onRowClick={(item) => setQuickviewItem(item)}
          />
        </div>
      )}

      {/* ── P3 퀵뷰 드로어 (same-canvas) ────────────────────────────── */}
      <ReceivingQuickviewDrawer
        item={quickviewItem}
        onClose={() => setQuickviewItem(null)}
        onDetail={(item) => goDetail(item)}
        onAction={(action, item) => {
          setQuickviewItem(null);
          // §11.334 P4 — post 는 same-canvas 재고반영 모달로 승격. coa/inspect 는 상세 라우트.
          if (action === "post") {
            setPostModalItem(item);
          } else {
            goDetail(item);
          }
        }}
      />

      {/* ── P4 재고 반영 모달 (same-canvas) ──────────────────────────── */}
      <ReceivingPostModal
        item={postModalItem}
        onClose={() => setPostModalItem(null)}
        onConfirm={(item) => {
          // 실 mutation — store.postToInventory(rb.id) (상세 페이지와 동일 경로, front-only 아님).
          postToInventory(item.entityId);
          setPostModalItem(null);
          // §action-toast P3 — 실 mutation 성공 후 success 토스트(자동 3초). 자체 토스트 제거·labToast 통일.
          labToast.success("재고 반영 완료", `<b>${item.title}</b> 재고에 반영되었습니다.`);
        }}
      />
    </div>
  );
}
