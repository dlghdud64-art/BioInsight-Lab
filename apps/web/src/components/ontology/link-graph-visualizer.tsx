"use client";

/**
 * LinkGraphVisualizer — Ontology Object Link Graph 인터랙티브 시각화
 *
 * Phase 4: 객체 간 연결 관계를 SVG 기반 그래프로 시각화.
 * 노드 클릭 시 상세 패널 표시, 연결된 객체 하이라이트.
 *
 * 규칙:
 * 1. Ontology types의 OntologyLink 구조 직접 사용
 * 2. 외부 라이브러리 최소화 (D3 미설치 → 순수 SVG + React state)
 * 3. 노드 배치는 force-directed 간이 레이아웃
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import type { OntologyObjectType, OntologyLinkType } from "@/lib/ontology/types";

// ══════════════════════════════════════════════
// Graph Data Types
// ══════════════════════════════════════════════

export interface GraphNode {
  id: string;
  type: OntologyObjectType;
  label: string;
  /** 보조 정보 (금액, 수량 등) */
  sublabel?: string;
  /** 상태 색상 */
  statusColor?: "green" | "amber" | "red" | "blue" | "gray" | "purple";
  /** 노드 좌표 (auto-layout 시 무시) */
  x?: number;
  y?: number;
}

export interface GraphEdge {
  sourceId: string;
  targetId: string;
  linkType: OntologyLinkType;
  label?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ══════════════════════════════════════════════
// Node Detail Panel
// ══════════════════════════════════════════════

export interface NodeDetail {
  node: GraphNode;
  /** 연결된 노드 목록 */
  connectedNodes: GraphNode[];
  /** 연결 타입별 요약 */
  linkSummary: Array<{ linkType: OntologyLinkType; count: number; direction: "outgoing" | "incoming" }>;
  /** 도메인별 추가 정보 */
  properties?: Record<string, string | number>;
}

// ══════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════

const NODE_TYPE_STYLES: Record<OntologyObjectType, { bg: string; border: string; icon: string }> = {
  Product:           { bg: "fill-blue-500/20",     border: "stroke-blue-500/50",     icon: "📦" },
  Vendor:            { bg: "fill-violet-500/20",   border: "stroke-violet-500/50",   icon: "🏢" },
  Budget:            { bg: "fill-emerald-500/20",  border: "stroke-emerald-500/50",  icon: "💰" },
  Quote:             { bg: "fill-amber-500/20",    border: "stroke-amber-500/50",    icon: "📋" },
  QuoteLine:         { bg: "fill-amber-500/10",    border: "stroke-amber-500/30",    icon: "📝" },
  PurchaseOrder:     { bg: "fill-cyan-500/20",     border: "stroke-cyan-500/50",     icon: "📄" },
  PurchaseOrderLine: { bg: "fill-cyan-500/10",     border: "stroke-cyan-500/30",     icon: "📑" },
  Inventory:         { bg: "fill-green-500/20",    border: "stroke-green-500/50",    icon: "📊" },
  DispatchPackage:   { bg: "fill-orange-500/20",   border: "stroke-orange-500/50",   icon: "📨" },
  ReceivingRecord:   { bg: "fill-teal-500/20",     border: "stroke-teal-500/50",     icon: "✅" },
  QuoteComparison:   { bg: "fill-amber-500/15",    border: "stroke-amber-500/40",    icon: "⚖️" },
  BomParseSession:   { bg: "fill-slate-500/20",    border: "stroke-slate-500/50",    icon: "📄" },
  FastTrackRecommendation: { bg: "fill-lime-500/20", border: "stroke-lime-500/50", icon: "⚡" },
};

const STATUS_RING: Record<string, string> = {
  green:  "stroke-emerald-400",
  amber:  "stroke-amber-400",
  red:    "stroke-red-400",
  blue:   "stroke-blue-400",
  gray:   "stroke-slate-500",
  purple: "stroke-purple-400",
};

// ══════════════════════════════════════════════
// Simple Force Layout (no D3)
// ══════════════════════════════════════════════

interface LayoutNode extends GraphNode {
  lx: number;
  ly: number;
}

function computeLayout(nodes: GraphNode[], edges: GraphEdge[], width: number, height: number): LayoutNode[] {
  if (nodes.length === 0) return [];

  // Group by type for layered placement
  const typeOrder: OntologyObjectType[] = [
    "Product", "Quote", "QuoteLine", "Vendor",
    "PurchaseOrder", "PurchaseOrderLine", "Budget",
    "DispatchPackage", "Inventory", "ReceivingRecord",
  ];

  const grouped = new Map<OntologyObjectType, GraphNode[]>();
  for (const node of nodes) {
    const arr = grouped.get(node.type) || [];
    arr.push(node);
    grouped.set(node.type, arr);
  }

  const result: LayoutNode[] = [];
  const usedTypes = typeOrder.filter(t => grouped.has(t));
  const rowCount = usedTypes.length;
  const rowHeight = height / (rowCount + 1);

  for (let rowIdx = 0; rowIdx < usedTypes.length; rowIdx++) {
    const type = usedTypes[rowIdx];
    const group = grouped.get(type) || [];
    const colWidth = width / (group.length + 1);
    const y = rowHeight * (rowIdx + 1);

    for (let colIdx = 0; colIdx < group.length; colIdx++) {
      const x = colWidth * (colIdx + 1);
      result.push({ ...group[colIdx], lx: x, ly: y });
    }
  }

  return result;
}

// ══════════════════════════════════════════════
// Props
// ══════════════════════════════════════════════

export interface LinkGraphVisualizerProps {
  data: GraphData;
  /** 선택된 노드 변경 핸들러 */
  onNodeSelect?: (detail: NodeDetail | null) => void;
  /** SVG 너비 */
  width?: number;
  /** SVG 높이 */
  height?: number;
  className?: string;
}

// ══════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════

export function LinkGraphVisualizer({
  data,
  onNodeSelect,
  width = 800,
  height = 500,
  className,
}: LinkGraphVisualizerProps) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);

  // ── Zoom / Pan state ──
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [viewBox, setViewBox] = React.useState({ x: 0, y: 0, w: width, h: height });
  const [isPanning, setIsPanning] = React.useState(false);
  const panStart = React.useRef({ x: 0, y: 0, vx: 0, vy: 0 });

  // Zoom (wheel)
  React.useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const scaleFactor = e.deltaY > 0 ? 1.1 : 0.9;
      const rect = svg.getBoundingClientRect();
      // cursor position in viewBox coords
      const mx = viewBox.x + (e.clientX - rect.left) / rect.width * viewBox.w;
      const my = viewBox.y + (e.clientY - rect.top) / rect.height * viewBox.h;
      const nw = viewBox.w * scaleFactor;
      const nh = viewBox.h * scaleFactor;
      // clamp zoom (min 200, max 3000)
      if (nw < 200 || nw > 3000) return;
      setViewBox({
        x: mx - (mx - viewBox.x) * scaleFactor,
        y: my - (my - viewBox.y) * scaleFactor,
        w: nw,
        h: nh,
      });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [viewBox]);

  // Pan (drag)
  const handlePanStart = React.useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, vx: viewBox.x, vy: viewBox.y };
  }, [viewBox]);

  const handlePanMove = React.useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const dx = (e.clientX - panStart.current.x) / rect.width * viewBox.w;
    const dy = (e.clientY - panStart.current.y) / rect.height * viewBox.h;
    setViewBox(prev => ({ ...prev, x: panStart.current.vx - dx, y: panStart.current.vy - dy }));
  }, [isPanning, viewBox.w, viewBox.h]);

  const handlePanEnd = React.useCallback(() => {
    setIsPanning(false);
  }, []);

  // Reset zoom
  const handleResetZoom = React.useCallback(() => {
    setViewBox({ x: 0, y: 0, w: width, h: height });
  }, [width, height]);

  const layoutNodes = React.useMemo(
    () => computeLayout(data.nodes, data.edges, width, height),
    [data.nodes, data.edges, width, height],
  );

  const nodeMap = React.useMemo(() => {
    const map = new Map<string, LayoutNode>();
    for (const n of layoutNodes) map.set(n.id, n);
    return map;
  }, [layoutNodes]);

  // Connected node IDs for highlight
  const connectedIds = React.useMemo(() => {
    if (!selectedId) return new Set<string>();
    const ids = new Set<string>();
    for (const edge of data.edges) {
      if (edge.sourceId === selectedId) ids.add(edge.targetId);
      if (edge.targetId === selectedId) ids.add(edge.sourceId);
    }
    return ids;
  }, [selectedId, data.edges]);

  function handleNodeClick(node: LayoutNode) {
    const isDeselect = selectedId === node.id;
    setSelectedId(isDeselect ? null : node.id);

    if (isDeselect) {
      onNodeSelect?.(null);
      return;
    }

    const connected = data.edges
      .filter(e => e.sourceId === node.id || e.targetId === node.id)
      .map(e => {
        const otherId = e.sourceId === node.id ? e.targetId : e.sourceId;
        return data.nodes.find(n => n.id === otherId);
      })
      .filter(Boolean) as GraphNode[];

    const linkSummary = new Map<OntologyLinkType, { count: number; direction: "outgoing" | "incoming" }>();
    for (const edge of data.edges) {
      if (edge.sourceId === node.id) {
        const existing = linkSummary.get(edge.linkType) || { count: 0, direction: "outgoing" as const };
        linkSummary.set(edge.linkType, { ...existing, count: existing.count + 1 });
      } else if (edge.targetId === node.id) {
        const existing = linkSummary.get(edge.linkType) || { count: 0, direction: "incoming" as const };
        linkSummary.set(edge.linkType, { ...existing, count: existing.count + 1 });
      }
    }

    onNodeSelect?.({
      node,
      connectedNodes: connected,
      linkSummary: Array.from(linkSummary.entries()).map(([linkType, v]) => ({
        linkType,
        count: v.count,
        direction: v.direction,
      })),
    });
  }

  const nodeRadius = 28;

  const zoomLevel = Math.round((width / viewBox.w) * 100);

  return (
    <div className={cn("relative", className)}>
      {/* Zoom controls */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
        <span className="text-[10px] text-slate-500 mr-1 tabular-nums">{zoomLevel}%</span>
        <button
          onClick={() => setViewBox(prev => {
            const nw = prev.w * 0.8; const nh = prev.h * 0.8;
            if (nw < 200) return prev;
            return { x: prev.x + (prev.w - nw) / 2, y: prev.y + (prev.h - nh) / 2, w: nw, h: nh };
          })}
          className="h-6 w-6 flex items-center justify-center rounded bg-slate-800 border border-slate-700 text-slate-400 hover:text-white text-xs"
          title="확대"
        >+</button>
        <button
          onClick={() => setViewBox(prev => {
            const nw = prev.w * 1.2; const nh = prev.h * 1.2;
            if (nw > 3000) return prev;
            return { x: prev.x + (prev.w - nw) / 2, y: prev.y + (prev.h - nh) / 2, w: nw, h: nh };
          })}
          className="h-6 w-6 flex items-center justify-center rounded bg-slate-800 border border-slate-700 text-slate-400 hover:text-white text-xs"
          title="축소"
        >−</button>
        <button
          onClick={handleResetZoom}
          className="h-6 px-2 flex items-center justify-center rounded bg-slate-800 border border-slate-700 text-slate-400 hover:text-white text-[10px]"
          title="리셋"
        >리셋</button>
      </div>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        className={cn("bg-slate-950 rounded border border-slate-800", isPanning ? "cursor-grabbing" : "cursor-grab")}
        onMouseDown={handlePanStart}
        onMouseMove={handlePanMove}
        onMouseUp={handlePanEnd}
        onMouseLeave={handlePanEnd}
      >
        {/* Edges */}
        {data.edges.map((edge, idx) => {
          const source = nodeMap.get(edge.sourceId);
          const target = nodeMap.get(edge.targetId);
          if (!source || !target) return null;

          const isHighlighted = selectedId === edge.sourceId || selectedId === edge.targetId;
          const isDimmed = selectedId && !isHighlighted;

          return (
            <line
              key={`edge-${idx}`}
              x1={source.lx}
              y1={source.ly}
              x2={target.lx}
              y2={target.ly}
              className={cn(
                "transition-all duration-200",
                isHighlighted ? "stroke-blue-400/60" : isDimmed ? "stroke-slate-800/30" : "stroke-slate-700/40",
              )}
              strokeWidth={isHighlighted ? 2 : 1}
              strokeDasharray={isHighlighted ? undefined : "4 4"}
            />
          );
        })}

        {/* Nodes */}
        {layoutNodes.map(node => {
          const styles = NODE_TYPE_STYLES[node.type];
          const isSelected = selectedId === node.id;
          const isConnected = connectedIds.has(node.id);
          const isHovered = hoveredId === node.id;
          const isDimmed = selectedId && !isSelected && !isConnected;

          return (
            <g
              key={node.id}
              transform={`translate(${node.lx}, ${node.ly})`}
              onClick={() => handleNodeClick(node)}
              onMouseEnter={() => setHoveredId(node.id)}
              onMouseLeave={() => setHoveredId(null)}
              className="cursor-pointer"
              style={{ opacity: isDimmed ? 0.3 : 1 }}
            >
              {/* Status ring */}
              {node.statusColor && (
                <circle
                  r={nodeRadius + 3}
                  className={cn("fill-none", STATUS_RING[node.statusColor] || "stroke-slate-600")}
                  strokeWidth={isSelected ? 3 : isHovered ? 2 : 1.5}
                  strokeDasharray={isSelected ? undefined : "3 3"}
                />
              )}

              {/* Node circle */}
              <circle
                r={nodeRadius}
                className={cn(styles.bg, styles.border, "transition-all duration-200")}
                strokeWidth={isSelected ? 2 : 1}
              />

              {/* Icon */}
              <text
                textAnchor="middle"
                dominantBaseline="central"
                className="text-sm select-none pointer-events-none"
                dy={-4}
              >
                {styles.icon}
              </text>

              {/* Label */}
              <text
                textAnchor="middle"
                dy={nodeRadius + 14}
                className={cn(
                  "text-[9px] font-medium select-none pointer-events-none fill-slate-400",
                  isSelected && "fill-white",
                )}
              >
                {node.label.length > 12 ? node.label.slice(0, 12) + "…" : node.label}
              </text>

              {/* Sublabel */}
              {node.sublabel && (
                <text
                  textAnchor="middle"
                  dy={nodeRadius + 24}
                  className="text-[8px] fill-slate-600 select-none pointer-events-none"
                >
                  {node.sublabel}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ══════════════════════════════════════════════
// Node Detail Panel (separate component)
// ══════════════════════════════════════════════

export interface NodeDetailPanelProps {
  detail: NodeDetail;
  onClose: () => void;
  className?: string;
}

export function NodeDetailPanel({ detail, onClose, className }: NodeDetailPanelProps) {
  const styles = NODE_TYPE_STYLES[detail.node.type];

  return (
    <div className={cn("rounded border border-slate-800 bg-slate-900 p-4 space-y-3 w-72", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{styles.icon}</span>
          <div>
            <p className="text-sm font-medium text-slate-200">{detail.node.label}</p>
            <p className="text-[10px] text-slate-500">{detail.node.type}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-600 hover:text-slate-400 text-xs"
        >
          ✕
        </button>
      </div>

      {/* Sublabel */}
      {detail.node.sublabel && (
        <p className="text-xs text-slate-500">{detail.node.sublabel}</p>
      )}

      {/* Properties */}
      {detail.properties && Object.keys(detail.properties).length > 0 && (
        <div className="space-y-1">
          <h5 className="text-[10px] font-medium uppercase tracking-wider text-slate-500">속성</h5>
          {Object.entries(detail.properties).map(([key, value]) => (
            <div key={key} className="flex justify-between text-xs">
              <span className="text-slate-500">{key}</span>
              <span className="text-slate-400">{String(value)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Connected nodes */}
      <div className="space-y-1">
        <h5 className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
          연결된 객체 ({detail.connectedNodes.length})
        </h5>
        {detail.connectedNodes.map(cn => {
          const nodeStyle = NODE_TYPE_STYLES[cn.type];
          return (
            <div key={cn.id} className="flex items-center gap-2 text-xs">
              <span>{nodeStyle.icon}</span>
              <span className="text-slate-400">{cn.label}</span>
              <span className="text-[9px] text-slate-600">{cn.type}</span>
            </div>
          );
        })}
      </div>

      {/* Link summary */}
      <div className="space-y-1">
        <h5 className="text-[10px] font-medium uppercase tracking-wider text-slate-500">연결 유형</h5>
        {detail.linkSummary.map((ls, i) => (
          <div key={i} className="flex justify-between text-[10px]">
            <span className="text-slate-500">{ls.linkType.replace(/_/g, " ")}</span>
            <span className="text-slate-400">
              {ls.direction === "outgoing" ? "→" : "←"} {ls.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
