"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Thermometer,
  Snowflake,
  Sun,
  AlertTriangle,
  HelpCircle,
  Package,
  Clock,
  ShoppingCart,
  Wrench,
  Flame,
  ChevronRight,
  ArrowRight,
  FileText,
  MapPin,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────

type ZoneId = "cold" | "frozen" | "ambient" | "hazardous" | "unassigned";

interface ZoneItem {
  id: string;
  name: string;
  catalogNumber: string;
  lot: string;
  quantity: number;
  unit: string;
  expiryDate: string; // ISO
  daysUntilExpiry: number;
  storageCondition: string;
  conditionViolation: boolean;
  needsRelocation: boolean;
  needsInspection: boolean;
  isHazardous: boolean;
  reorderNeeded: boolean;
  sdsRequired: boolean;
}

interface ZoneSummary {
  id: ZoneId;
  label: string;
  tempRange: string;
  icon: React.ReactNode;
  iconColor: string;
  totalItems: number;
  expiringItems: number;
  reorderItems: number;
  issueItems: number;
  hasHazardous: boolean;
  items: ZoneItem[];
}

// ─── Mock Data ────────────────────────────────────────────────────────

function buildMockItems(zoneId: ZoneId): ZoneItem[] {
  const today = new Date();
  const daysFromNow = (d: number) => {
    const dt = new Date(today);
    dt.setDate(dt.getDate() + d);
    return dt.toISOString().slice(0, 10);
  };

  const zones: Record<ZoneId, ZoneItem[]> = {
    cold: [
      { id: "c1", name: "Anti-GAPDH Antibody", catalogNumber: "AB-1001", lot: "L2025-034", quantity: 12, unit: "vial", expiryDate: daysFromNow(5), daysUntilExpiry: 5, storageCondition: "2-8°C", conditionViolation: false, needsRelocation: false, needsInspection: false, isHazardous: false, reorderNeeded: false, sdsRequired: false },
      { id: "c2", name: "ELISA Kit (IL-6)", catalogNumber: "EK-2045", lot: "L2025-078", quantity: 3, unit: "kit", expiryDate: daysFromNow(3), daysUntilExpiry: 3, storageCondition: "2-8°C", conditionViolation: false, needsRelocation: false, needsInspection: true, isHazardous: false, reorderNeeded: true, sdsRequired: false },
      { id: "c3", name: "FBS (Fetal Bovine Serum)", catalogNumber: "FB-500", lot: "L2024-112", quantity: 8, unit: "bottle", expiryDate: daysFromNow(45), daysUntilExpiry: 45, storageCondition: "2-8°C", conditionViolation: false, needsRelocation: false, needsInspection: false, isHazardous: false, reorderNeeded: false, sdsRequired: false },
      { id: "c4", name: "Trypsin-EDTA (0.25%)", catalogNumber: "TE-025", lot: "L2025-009", quantity: 2, unit: "bottle", expiryDate: daysFromNow(12), daysUntilExpiry: 12, storageCondition: "2-8°C", conditionViolation: true, needsRelocation: true, needsInspection: true, isHazardous: false, reorderNeeded: true, sdsRequired: false },
      { id: "c5", name: "PBS Buffer (10X)", catalogNumber: "PB-1010", lot: "L2025-055", quantity: 15, unit: "bottle", expiryDate: daysFromNow(90), daysUntilExpiry: 90, storageCondition: "2-8°C", conditionViolation: false, needsRelocation: false, needsInspection: false, isHazardous: false, reorderNeeded: false, sdsRequired: false },
    ],
    frozen: [
      { id: "f1", name: "Restriction Enzyme (EcoRI)", catalogNumber: "RE-ECO1", lot: "L2025-041", quantity: 5, unit: "vial", expiryDate: daysFromNow(180), daysUntilExpiry: 180, storageCondition: "-20°C", conditionViolation: false, needsRelocation: false, needsInspection: false, isHazardous: false, reorderNeeded: false, sdsRequired: false },
      { id: "f2", name: "Taq DNA Polymerase", catalogNumber: "TP-500U", lot: "L2024-198", quantity: 1, unit: "vial", expiryDate: daysFromNow(6), daysUntilExpiry: 6, storageCondition: "-20°C", conditionViolation: false, needsRelocation: false, needsInspection: false, isHazardous: false, reorderNeeded: true, sdsRequired: false },
      { id: "f3", name: "siRNA Pool (TP53)", catalogNumber: "SI-TP53", lot: "L2025-067", quantity: 10, unit: "tube", expiryDate: daysFromNow(120), daysUntilExpiry: 120, storageCondition: "-20°C", conditionViolation: false, needsRelocation: false, needsInspection: false, isHazardous: false, reorderNeeded: false, sdsRequired: false },
      { id: "f4", name: "Competent Cells (DH5a)", catalogNumber: "CC-DH5A", lot: "L2025-011", quantity: 4, unit: "vial", expiryDate: daysFromNow(30), daysUntilExpiry: 30, storageCondition: "-20°C", conditionViolation: true, needsRelocation: true, needsInspection: true, isHazardous: false, reorderNeeded: false, sdsRequired: false },
    ],
    ambient: [
      { id: "a1", name: "Agarose (Molecular Grade)", catalogNumber: "AG-500", lot: "L2025-022", quantity: 6, unit: "bottle", expiryDate: daysFromNow(365), daysUntilExpiry: 365, storageCondition: "15-25°C", conditionViolation: false, needsRelocation: false, needsInspection: false, isHazardous: false, reorderNeeded: false, sdsRequired: false },
      { id: "a2", name: "NaCl (Reagent Grade)", catalogNumber: "NC-1KG", lot: "L2024-156", quantity: 3, unit: "bottle", expiryDate: daysFromNow(200), daysUntilExpiry: 200, storageCondition: "15-25°C", conditionViolation: false, needsRelocation: false, needsInspection: false, isHazardous: false, reorderNeeded: false, sdsRequired: false },
      { id: "a3", name: "Tris Base", catalogNumber: "TB-500G", lot: "L2025-033", quantity: 2, unit: "bottle", expiryDate: daysFromNow(150), daysUntilExpiry: 150, storageCondition: "15-25°C", conditionViolation: false, needsRelocation: false, needsInspection: false, isHazardous: false, reorderNeeded: true, sdsRequired: false },
    ],
    hazardous: [
      { id: "h1", name: "Ethidium Bromide", catalogNumber: "EB-10ML", lot: "L2025-005", quantity: 2, unit: "bottle", expiryDate: daysFromNow(60), daysUntilExpiry: 60, storageCondition: "15-25°C", conditionViolation: false, needsRelocation: false, needsInspection: false, isHazardous: true, reorderNeeded: false, sdsRequired: true },
      { id: "h2", name: "Formaldehyde (37%)", catalogNumber: "FA-500", lot: "L2025-019", quantity: 1, unit: "bottle", expiryDate: daysFromNow(14), daysUntilExpiry: 14, storageCondition: "15-25°C", conditionViolation: false, needsRelocation: false, needsInspection: true, isHazardous: true, reorderNeeded: false, sdsRequired: true },
      { id: "h3", name: "Chloroform", catalogNumber: "CF-1L", lot: "L2024-201", quantity: 1, unit: "bottle", expiryDate: daysFromNow(7), daysUntilExpiry: 7, storageCondition: "15-25°C", conditionViolation: false, needsRelocation: false, needsInspection: false, isHazardous: true, reorderNeeded: true, sdsRequired: false },
      { id: "h4", name: "DMSO (Cell Culture Grade)", catalogNumber: "DM-100", lot: "L2025-044", quantity: 5, unit: "bottle", expiryDate: daysFromNow(90), daysUntilExpiry: 90, storageCondition: "15-25°C", conditionViolation: false, needsRelocation: false, needsInspection: false, isHazardous: true, reorderNeeded: false, sdsRequired: false },
    ],
    unassigned: [
      { id: "u1", name: "미확인 시약 A", catalogNumber: "UNK-001", lot: "L2025-088", quantity: 1, unit: "bottle", expiryDate: daysFromNow(10), daysUntilExpiry: 10, storageCondition: "미지정", conditionViolation: true, needsRelocation: true, needsInspection: true, isHazardous: false, reorderNeeded: false, sdsRequired: false },
      { id: "u2", name: "Sample Buffer (2X)", catalogNumber: "SB-2X", lot: "L2025-071", quantity: 3, unit: "bottle", expiryDate: daysFromNow(60), daysUntilExpiry: 60, storageCondition: "미지정", conditionViolation: true, needsRelocation: true, needsInspection: true, isHazardous: false, reorderNeeded: false, sdsRequired: false },
    ],
  };

  return zones[zoneId] ?? [];
}

function buildZones(): ZoneSummary[] {
  const defs: { id: ZoneId; label: string; tempRange: string; icon: React.ReactNode; iconColor: string }[] = [
    { id: "cold", label: "냉장", tempRange: "2-8°C", icon: <Thermometer className="w-5 h-5" />, iconColor: "text-sky-400" },
    { id: "frozen", label: "냉동", tempRange: "-20°C", icon: <Snowflake className="w-5 h-5" />, iconColor: "text-blue-400" },
    { id: "ambient", label: "상온", tempRange: "15-25°C", icon: <Sun className="w-5 h-5" />, iconColor: "text-amber-400" },
    { id: "hazardous", label: "위험물 보관", tempRange: "별도 관리", icon: <AlertTriangle className="w-5 h-5" />, iconColor: "text-red-400" },
    { id: "unassigned", label: "미지정", tempRange: "—", icon: <HelpCircle className="w-5 h-5" />, iconColor: "text-slate-400" },
  ];

  return defs.map((d) => {
    const items = buildMockItems(d.id);
    return {
      ...d,
      totalItems: items.length,
      expiringItems: items.filter((i) => i.daysUntilExpiry <= 7).length,
      reorderItems: items.filter((i) => i.reorderNeeded).length,
      issueItems: items.filter((i) => i.needsInspection || i.conditionViolation).length,
      hasHazardous: items.some((i) => i.isHazardous),
      items,
    };
  });
}

// ─── Priority Alert Builder ───────────────────────────────────────────

function buildPriorityAlerts(zones: ZoneSummary[]): { zone: string; message: string; severity: "critical" | "warning" | "info" }[] {
  const alerts: { zone: string; message: string; severity: "critical" | "warning" | "info" }[] = [];

  for (const z of zones) {
    if (z.expiringItems > 0) {
      const inspectionNeeded = z.items.filter((i) => i.needsInspection && i.daysUntilExpiry <= 7).length;
      let msg = `만료 D-7 ${z.expiringItems}건`;
      if (inspectionNeeded > 0) msg += ` / 위치 점검 필요 ${inspectionNeeded}건`;
      alerts.push({ zone: z.label, message: msg, severity: "critical" });
    }
    const sdsNeeded = z.items.filter((i) => i.sdsRequired).length;
    if (sdsNeeded > 0) {
      alerts.push({ zone: z.label, message: `SDS 확인 필요 ${sdsNeeded}건`, severity: "warning" });
    }
    const relocate = z.items.filter((i) => i.needsRelocation).length;
    if (relocate > 0 && z.expiringItems === 0) {
      alerts.push({ zone: z.label, message: `이동 필요 ${relocate}건`, severity: "info" });
    }
  }

  return alerts;
}

// ─── Expiry Badge ─────────────────────────────────────────────────────

function ExpiryBadge({ days }: { days: number }) {
  if (days <= 3) {
    return <Badge className="bg-red-950/60 text-red-400 border-red-500/30 text-[11px]">D-{days}</Badge>;
  }
  if (days <= 7) {
    return <Badge className="bg-amber-950/60 text-amber-400 border-amber-500/30 text-[11px]">D-{days}</Badge>;
  }
  if (days <= 30) {
    return <Badge className="bg-yellow-950/60 text-yellow-400 border-yellow-500/30 text-[11px]">D-{days}</Badge>;
  }
  return <Badge className="bg-emerald-950/60 text-emerald-400 border-emerald-500/30 text-[11px]">D-{days}</Badge>;
}

// ─── Main Component ───────────────────────────────────────────────────

export function StorageLocationView() {
  const [selectedZone, setSelectedZone] = useState<ZoneId | null>(null);

  const zones = useMemo(() => buildZones(), []);
  const priorityAlerts = useMemo(() => buildPriorityAlerts(zones), [zones]);
  const activeZone = zones.find((z) => z.id === selectedZone) ?? null;

  return (
    <div className="space-y-5">
      {/* ── Priority Alerts ── */}
      {priorityAlerts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            우선 조치 알림
          </h3>
          <div className="flex flex-wrap gap-2">
            {priorityAlerts.map((a, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium border ${
                  a.severity === "critical"
                    ? "bg-red-950/40 border-red-500/30 text-red-300"
                    : a.severity === "warning"
                      ? "bg-amber-950/40 border-amber-500/30 text-amber-300"
                      : "bg-blue-950/40 border-blue-500/30 text-blue-300"
                }`}
              >
                {a.severity === "critical" ? (
                  <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                ) : a.severity === "warning" ? (
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                ) : (
                  <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" />
                )}
                <span className="font-bold">{a.zone}</span>
                <span className="text-slate-400">/</span>
                <span>{a.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Zone Cards Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {zones.map((zone) => {
          const isSelected = selectedZone === zone.id;
          return (
            <button
              key={zone.id}
              onClick={() => setSelectedZone(isSelected ? null : zone.id)}
              className={`relative flex flex-col gap-3 rounded-xl border p-4 text-left transition-all duration-200 hover:border-[#3a3a3e] ${
                isSelected
                  ? "bg-[#1a1a1e] border-blue-500/60 ring-2 ring-blue-500 shadow-lg shadow-blue-500/10"
                  : "bg-[#1a1a1e] border-[#2a2a2e] hover:bg-[#222226]"
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={zone.iconColor}>{zone.icon}</span>
                  <div>
                    <div className="text-sm font-bold text-slate-200">{zone.label}</div>
                    <div className="text-[11px] text-slate-500">{zone.tempRange}</div>
                  </div>
                </div>
                {zone.hasHazardous && (
                  <Badge className="bg-red-950/60 text-red-400 border-red-500/30 text-[10px] px-1.5 py-0.5">
                    <Flame className="w-3 h-3 mr-0.5" />
                    위험
                  </Badge>
                )}
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1.5 text-[11px]">
                  <Package className="w-3 h-3 text-slate-500" />
                  <span className="text-slate-400">보관</span>
                  <span className="font-bold text-slate-200 ml-auto">{zone.totalItems}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <Clock className="w-3 h-3 text-amber-500" />
                  <span className="text-slate-400">만료</span>
                  <span className={`font-bold ml-auto ${zone.expiringItems > 0 ? "text-amber-400" : "text-slate-500"}`}>
                    {zone.expiringItems}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <ShoppingCart className="w-3 h-3 text-blue-500" />
                  <span className="text-slate-400">재주문</span>
                  <span className={`font-bold ml-auto ${zone.reorderItems > 0 ? "text-blue-400" : "text-slate-500"}`}>
                    {zone.reorderItems}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <Wrench className="w-3 h-3 text-rose-500" />
                  <span className="text-slate-400">이슈</span>
                  <span className={`font-bold ml-auto ${zone.issueItems > 0 ? "text-rose-400" : "text-slate-500"}`}>
                    {zone.issueItems}
                  </span>
                </div>
              </div>

              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute -bottom-px left-1/2 -translate-x-1/2 w-8 h-1 rounded-t-full bg-blue-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Drill-down: Selected Zone Items ── */}
      {activeZone && (
        <div className="rounded-xl border border-[#2a2a2e] bg-[#111114] overflow-hidden animate-in slide-in-from-top-2 duration-300">
          {/* Drill-down Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a2a2e] bg-[#1a1a1e]/50">
            <div className="flex items-center gap-2">
              <span className={activeZone.iconColor}>{activeZone.icon}</span>
              <h3 className="text-sm font-bold text-slate-200">
                {activeZone.label}
                <span className="text-slate-500 font-normal ml-2">({activeZone.tempRange})</span>
              </h3>
              <Badge variant="outline" className="border-slate-600 text-slate-400 text-[11px]">
                {activeZone.totalItems}건
              </Badge>
            </div>
            <button
              onClick={() => setSelectedZone(null)}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              닫기
            </button>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2e] text-[11px] text-slate-500 uppercase tracking-wide">
                  <th className="text-left px-5 py-2.5 font-medium">품목</th>
                  <th className="text-left px-3 py-2.5 font-medium">Lot</th>
                  <th className="text-center px-3 py-2.5 font-medium">수량</th>
                  <th className="text-center px-3 py-2.5 font-medium">유효기간</th>
                  <th className="text-center px-3 py-2.5 font-medium">보관조건</th>
                  <th className="text-center px-3 py-2.5 font-medium">상태</th>
                </tr>
              </thead>
              <tbody>
                {activeZone.items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-[#2a2a2e]/50 hover:bg-[#1a1a1e]/60 transition-colors"
                  >
                    {/* Name + Catalog */}
                    <td className="px-5 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-slate-200 font-medium text-[13px]">{item.name}</span>
                        <span className="text-[11px] text-slate-500">{item.catalogNumber}</span>
                      </div>
                    </td>

                    {/* Lot */}
                    <td className="px-3 py-3 text-slate-400 text-[13px]">{item.lot}</td>

                    {/* Quantity */}
                    <td className="px-3 py-3 text-center">
                      <span className="text-slate-200 font-medium">{item.quantity}</span>
                      <span className="text-slate-500 text-[11px] ml-1">{item.unit}</span>
                    </td>

                    {/* Expiry */}
                    <td className="px-3 py-3 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-slate-400 text-[12px]">{item.expiryDate}</span>
                        <ExpiryBadge days={item.daysUntilExpiry} />
                      </div>
                    </td>

                    {/* Storage Condition */}
                    <td className="px-3 py-3 text-center">
                      <span className="text-slate-400 text-[12px]">{item.storageCondition}</span>
                      {item.conditionViolation && (
                        <div className="flex items-center justify-center gap-1 mt-1">
                          <AlertTriangle className="w-3 h-3 text-red-400" />
                          <span className="text-[10px] text-red-400">위반</span>
                        </div>
                      )}
                    </td>

                    {/* Status Badges */}
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap justify-center gap-1">
                        {item.needsRelocation && (
                          <Badge className="bg-violet-950/60 text-violet-400 border-violet-500/30 text-[10px] px-1.5">
                            <MapPin className="w-3 h-3 mr-0.5" />
                            이동
                          </Badge>
                        )}
                        {item.needsInspection && (
                          <Badge className="bg-amber-950/60 text-amber-400 border-amber-500/30 text-[10px] px-1.5">
                            <Wrench className="w-3 h-3 mr-0.5" />
                            점검
                          </Badge>
                        )}
                        {item.reorderNeeded && (
                          <Badge className="bg-blue-950/60 text-blue-400 border-blue-500/30 text-[10px] px-1.5">
                            <ShoppingCart className="w-3 h-3 mr-0.5" />
                            재주문
                          </Badge>
                        )}
                        {item.sdsRequired && (
                          <Badge className="bg-red-950/60 text-red-400 border-red-500/30 text-[10px] px-1.5">
                            <FileText className="w-3 h-3 mr-0.5" />
                            SDS
                          </Badge>
                        )}
                        {item.isHazardous && (
                          <Badge className="bg-red-950/60 text-red-400 border-red-500/30 text-[10px] px-1.5">
                            <Flame className="w-3 h-3 mr-0.5" />
                            위험
                          </Badge>
                        )}
                        {!item.needsRelocation && !item.needsInspection && !item.reorderNeeded && !item.sdsRequired && !item.isHazardous && (
                          <Badge className="bg-emerald-950/60 text-emerald-400 border-emerald-500/30 text-[10px] px-1.5">
                            <CheckCircle2 className="w-3 h-3 mr-0.5" />
                            정상
                          </Badge>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Zone-level summary footer */}
          <div className="flex items-center gap-4 px-5 py-3 border-t border-[#2a2a2e] bg-[#1a1a1e]/30 text-[11px] text-slate-500">
            <span>
              총 <span className="text-slate-300 font-medium">{activeZone.totalItems}</span>건
            </span>
            {activeZone.expiringItems > 0 && (
              <span>
                만료 임박 <span className="text-amber-400 font-medium">{activeZone.expiringItems}</span>건
              </span>
            )}
            {activeZone.reorderItems > 0 && (
              <span>
                재주문 필요 <span className="text-blue-400 font-medium">{activeZone.reorderItems}</span>건
              </span>
            )}
            {activeZone.issueItems > 0 && (
              <span>
                점검/이슈 <span className="text-rose-400 font-medium">{activeZone.issueItems}</span>건
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
