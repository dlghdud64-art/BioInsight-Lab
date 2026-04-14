"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ScanLine,
  X,
  Loader2,
  CheckCircle2,
  Smartphone,
} from "lucide-react";
import { useSmartSourcingStore } from "@/lib/store/smart-sourcing-store";

/**
 * BarcodeScanFab
 *
 * 연구실 현장에서 스마트폰으로 시약 바코드를 스캔해 BOM 파서로 즉시
 * 넘기는 운영 플로우의 mock. 모바일 뷰(< lg)에서만 플로팅 액션 버튼으로
 * 표시되며, 데스크탑에는 노출되지 않는다.
 *
 * 동작:
 * 1) FAB 탭 → 카메라 프레이밍 overlay를 짧게 표시 (scanning)
 * 2) 1.2s 후 mock 시약 정보를 smart-sourcing store의 bomText로 푸시
 * 3) smart-sourcing 페이지의 BOM 탭으로 라우팅
 *
 * 주의:
 * - 실제 카메라/바코드 디코딩은 연결하지 않는다 (mock).
 * - bomText는 persist된 store slice에 쓰여 페이지 이동 후에도 유지된다.
 * - 이미 페이지에 있는 operator가 기존에 작성 중인 bomText를 덮어쓰지
 *   않기 위해 수락 버튼을 통해서만 반영한다.
 */
export function BarcodeScanFab() {
  const router = useRouter();
  const setBomText = useSmartSourcingStore((s) => s.setBomText);
  const setActiveTab = useSmartSourcingStore((s) => s.setActiveTab);

  const [phase, setPhase] = useState<"idle" | "scanning" | "ready">("idle");
  const [scanned, setScanned] = useState<MockScanResult | null>(null);

  const openScanner = () => {
    if (phase !== "idle") return;
    setPhase("scanning");
    // 바코드 디코딩 mock — 랜덤으로 하나 선택
    const pick = MOCK_REAGENTS[Math.floor(Math.random() * MOCK_REAGENTS.length)]!;
    window.setTimeout(() => {
      setScanned(pick);
      setPhase("ready");
    }, 1200);
  };

  const handleAccept = () => {
    if (!scanned) return;
    const line = `${scanned.name}\t${scanned.lotCode}\t${scanned.qty}\t${scanned.unit}`;
    setBomText(line);
    setActiveTab("bom-sourcing");
    reset();
    router.push("/dashboard/quotes?dock=intake&source=bom_import");
  };

  const handleRescan = () => {
    setScanned(null);
    openScanner();
  };

  const reset = () => {
    setPhase("idle");
    setScanned(null);
  };

  return (
    <>
      {/* FAB — 모바일 뷰에서만 표시 */}
      <button
        type="button"
        onClick={openScanner}
        aria-label="바코드 스캔"
        className="fixed bottom-20 right-4 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 ring-4 ring-white/60 transition-colors hover:bg-blue-500 active:scale-95 lg:hidden"
      >
        <ScanLine className="h-5 w-5" />
      </button>

      {/* Scanner overlay */}
      <AnimatePresence>
        {phase !== "idle" ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] flex flex-col items-center justify-end bg-slate-950/85 lg:hidden"
            onClick={(e) => {
              if (e.target === e.currentTarget) reset();
            }}
          >
            {/* 상단 카메라 프레임 mock */}
            <div className="relative mt-16 aspect-[4/3] w-[88%] overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/80">
              <div className="absolute inset-0 flex items-center justify-center">
                {phase === "scanning" ? (
                  <div className="flex flex-col items-center gap-2 text-slate-300">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                    <p className="text-xs">카메라 프리뷰 (시뮬레이션)</p>
                    <p className="text-[11px] text-slate-400">바코드 인식 중…</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-200">
                    <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                    <p className="text-xs font-medium">인식 완료</p>
                  </div>
                )}
              </div>
              {/* 모서리 마커 */}
              <div className="pointer-events-none absolute inset-4 rounded-xl border-2 border-blue-400/50" />
              {phase === "scanning" ? (
                <motion.div
                  initial={{ y: 0 }}
                  animate={{ y: ["0%", "100%", "0%"] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-x-6 top-6 h-0.5 bg-blue-400/80 shadow-[0_0_12px_#60a5fa]"
                />
              ) : null}
              {/* 닫기 */}
              <button
                type="button"
                onClick={reset}
                aria-label="닫기"
                className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/70 text-white hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 결과 bottom sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="mt-4 w-full rounded-t-2xl bg-white p-4 pb-8"
            >
              <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-300" />
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <Smartphone className="h-3.5 w-3.5" />
                바코드 스캔 (시뮬레이션)
              </div>

              {phase === "scanning" ? (
                <p className="mt-3 text-xs text-slate-500">
                  스캐너가 시약 바코드를 인식하고 있습니다…
                </p>
              ) : scanned ? (
                <div className="mt-3 space-y-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="text-sm font-semibold text-slate-900">
                      {scanned.name}
                    </p>
                    <dl className="mt-1 grid grid-cols-3 gap-2 text-[11px] text-slate-600">
                      <div>
                        <dt className="uppercase tracking-wide text-slate-500">
                          LOT
                        </dt>
                        <dd className="font-medium tabular-nums">{scanned.lotCode}</dd>
                      </div>
                      <div>
                        <dt className="uppercase tracking-wide text-slate-500">
                          수량
                        </dt>
                        <dd className="font-medium tabular-nums">
                          {scanned.qty} {scanned.unit}
                        </dd>
                      </div>
                      <div>
                        <dt className="uppercase tracking-wide text-slate-500">
                          보관
                        </dt>
                        <dd className="font-medium">{scanned.storage}</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleAccept}
                      className="flex-1 rounded-lg bg-slate-900 px-3 py-2.5 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      BOM 파서로 보내기
                    </button>
                    <button
                      type="button"
                      onClick={handleRescan}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      다시 스캔
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    실제 카메라 접근은 연결되지 않은 시뮬레이션 화면입니다. 제품
                    출시 시 디바이스 카메라 및 코드 디코더로 대체됩니다.
                  </p>
                </div>
              ) : null}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

// ── Mock reagent catalog ─────────────────────────────────────────────

interface MockScanResult {
  name: string;
  lotCode: string;
  qty: number;
  unit: string;
  storage: string;
}

const MOCK_REAGENTS: MockScanResult[] = [
  {
    name: "Taq DNA Polymerase 500U",
    lotCode: "TQ25A042",
    qty: 2,
    unit: "vial",
    storage: "-20°C",
  },
  {
    name: "dNTP Mix 10mM (each)",
    lotCode: "DN25B019",
    qty: 1,
    unit: "kit",
    storage: "-20°C",
  },
  {
    name: "FBS, qualified (500 mL)",
    lotCode: "FB2604L",
    qty: 2,
    unit: "bottle",
    storage: "-80°C",
  },
  {
    name: "SYBR Green Master Mix",
    lotCode: "SG25C007",
    qty: 3,
    unit: "kit",
    storage: "4°C",
  },
];
