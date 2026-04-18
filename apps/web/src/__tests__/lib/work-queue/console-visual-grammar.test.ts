/**
 * Console Visual Grammar 검증 테스트
 *
 * §1: Typography Scale 완성도
 * §2: Severity Indicator 매핑 + anti-pattern gate
 * §3: CTA Hierarchy 규칙
 * §4: Queue Column 정합성
 * §5: Metadata Order 완성도
 * §6: Helper 함수 동작
 */

import {
  TYPOGRAPHY,
  SPACING,
  SURFACE,
  SEVERITY_INDICATORS,
  CTA_HIERARCHY,
  QUEUE_COLUMNS,
  METADATA_ORDER,
  getSeverityIndicator,
  getCtaVariant,
  type SeverityIndicator,
  type QueueColumnDef,
  type CtaRule,
} from "@/lib/work-queue/console-visual-grammar";

// ══════════════════════════════════════════════════════
// §1: Typography Scale
// ══════════════════════════════════════════════════════

describe("§1: Typography Scale", () => {
  it("should define all 7 typography tiers", () => {
    expect(Object.keys(TYPOGRAPHY)).toHaveLength(7);
  });

  it("should have 3 main tiers (pageTitle, sectionTitle, rowTitle) + 4 micro tiers", () => {
    expect(TYPOGRAPHY.pageTitle).toBeTruthy();
    expect(TYPOGRAPHY.sectionTitle).toBeTruthy();
    expect(TYPOGRAPHY.rowTitle).toBeTruthy();
    expect(TYPOGRAPHY.metadata).toBeTruthy();
    expect(TYPOGRAPHY.timestamp).toBeTruthy();
    expect(TYPOGRAPHY.badge).toBeTruthy();
    expect(TYPOGRAPHY.cta).toBeTruthy();
  });

  it("should use tabular-nums for timestamp", () => {
    expect(TYPOGRAPHY.timestamp).toContain("tabular-nums");
  });
});

// ══════════════════════════════════════════════════════
// §2: Severity Indicators
// ══════════════════════════════════════════════════════

describe("§2: Severity Indicators", () => {
  const ALL_TIERS = [
    "urgent_blocker",
    "approval_needed",
    "action_needed",
    "monitoring",
    "informational",
  ] as const;

  it("should have indicator for every PriorityTier", () => {
    ALL_TIERS.forEach((tier) => {
      expect(SEVERITY_INDICATORS[tier]).toBeDefined();
    });
  });

  it("should NOT use bg- tokens in any indicator (anti-pattern gate)", () => {
    Object.values(SEVERITY_INDICATORS).forEach((indicator: SeverityIndicator) => {
      expect(indicator.borderColor).not.toMatch(/^bg-/);
      expect(indicator.textColor).not.toMatch(/^bg-/);
    });
  });

  it("should use border-l- pattern for all severity borders", () => {
    Object.values(SEVERITY_INDICATORS).forEach((indicator: SeverityIndicator) => {
      expect(indicator.borderColor).toMatch(/^border-l-/);
    });
  });

  it("should pulse only urgent_blocker", () => {
    expect(SEVERITY_INDICATORS.urgent_blocker.dotPulse).toBe(true);
    expect(SEVERITY_INDICATORS.approval_needed.dotPulse).toBe(false);
    expect(SEVERITY_INDICATORS.monitoring.dotPulse).toBe(false);
  });
});

// ══════════════════════════════════════════════════════
// §3: CTA Hierarchy
// ══════════════════════════════════════════════════════

describe("§3: CTA Hierarchy", () => {
  const VALID_VARIANTS = ["default", "outline", "destructive", "ghost"];

  it("should define 4 CTA levels", () => {
    expect(Object.keys(CTA_HIERARCHY)).toHaveLength(4);
  });

  it("should only reference valid Button variants", () => {
    Object.values(CTA_HIERARCHY).forEach((rule: CtaRule) => {
      expect(VALID_VARIANTS).toContain(rule.variant);
    });
  });

  it("should allow max 1 primary per row", () => {
    expect(CTA_HIERARCHY.primary.maxPerRow).toBe(1);
  });

  it("should restrict overflow to detail panel only", () => {
    expect(CTA_HIERARCHY.overflow.inDetailOnly).toBe(true);
    expect(CTA_HIERARCHY.primary.inDetailOnly).toBe(false);
  });
});

// ══════════════════════════════════════════════════════
// §4: Queue Columns
// ══════════════════════════════════════════════════════

describe("§4: Queue Column Definitions", () => {
  it("should define 7 columns", () => {
    expect(QUEUE_COLUMNS).toHaveLength(7);
  });

  it("should have unique column IDs", () => {
    const ids = QUEUE_COLUMNS.map((col: QueueColumnDef) => col.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("should have severity as first column and cta as last", () => {
    expect(QUEUE_COLUMNS[0].id).toBe("severity");
    expect(QUEUE_COLUMNS[QUEUE_COLUMNS.length - 1].id).toBe("cta");
  });

  it("should have Korean labels for visible columns", () => {
    const labeled = QUEUE_COLUMNS.filter((col: QueueColumnDef) => col.label !== "");
    expect(labeled.length).toBeGreaterThanOrEqual(4);
    labeled.forEach((col: QueueColumnDef) => {
      expect(/[가-힣]/.test(col.label)).toBe(true);
    });
  });
});

// ══════════════════════════════════════════════════════
// §5: Metadata Order
// ══════════════════════════════════════════════════════

describe("§5: Metadata Placement Order", () => {
  it("should define 7 metadata fields", () => {
    expect(METADATA_ORDER).toHaveLength(7);
  });

  it("should start with current_state and end with remediation_handoff_note", () => {
    expect(METADATA_ORDER[0]).toBe("current_state");
    expect(METADATA_ORDER[METADATA_ORDER.length - 1]).toBe("remediation_handoff_note");
  });

  it("should have unique entries", () => {
    expect(new Set(METADATA_ORDER).size).toBe(METADATA_ORDER.length);
  });
});

// ══════════════════════════════════════════════════════
// §6: Helper Functions
// ══════════════════════════════════════════════════════

describe("§6: Helper Functions", () => {
  it("getSeverityIndicator should return correct indicator", () => {
    const indicator = getSeverityIndicator("urgent_blocker");
    expect(indicator.borderColor).toBe("border-l-red-500");
    expect(indicator.dotPulse).toBe(true);
  });

  it("getCtaVariant should return correct variant", () => {
    expect(getCtaVariant("primary")).toBe("default");
    expect(getCtaVariant("destructive")).toBe("destructive");
    expect(getCtaVariant("overflow")).toBe("ghost");
  });
});

// ══════════════════════════════════════════════════════
// §7: Surface & Spacing Integrity
// ══════════════════════════════════════════════════════

describe("§7: Surface & Spacing", () => {
  it("should define surface hierarchy within 3 depth levels", () => {
    // page, primary, secondary = 3 levels; alert/summary/section/row are variants
    expect(SURFACE.page).toBeTruthy();
    expect(SURFACE.primary).toBeTruthy();
    expect(SURFACE.secondary).toBeTruthy();
  });

  it("should not use box-shadow in any surface", () => {
    Object.values(SURFACE).forEach((cls: string) => {
      expect(cls).not.toContain("shadow");
    });
  });

  it("should define all required spacing keys", () => {
    expect(SPACING.sectionGap).toBeTruthy();
    expect(SPACING.rowPadding).toBeTruthy();
    expect(SPACING.panelPadding).toBeTruthy();
    expect(SPACING.metadataGap).toBeTruthy();
    expect(SPACING.ctaCluster).toBeTruthy();
  });
});
