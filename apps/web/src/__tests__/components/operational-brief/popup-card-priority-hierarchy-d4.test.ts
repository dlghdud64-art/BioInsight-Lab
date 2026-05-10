/**
 * #operational-brief-card-priority-hierarchy-d4
 *
 * 호영님 production 검증 5 axis redesign Batch 3 (D4).
 *
 * spec: "두 건의 RFQ 카드 간 시각적 위계가 약해요. '견적 검토·높음' 이 위에,
 *       '견적 대기·보통'이 아래에 있는데, 둘 다 비슷한 카드 크기라서 어느 게
 *       더 급한지 한눈에 안 잡혀요. 상위 건은 더 크게 또는 테두리 강조,
 *       하위 건은 축소 표시."
 *
 * canonical truth lock:
 *   - p0/p1 (urgent): border-l-[6px] 강조 + 기본 padding/title size 유지.
 *   - p2/p3 (non-urgent): border-l-2 얇게 + py-3 (축소) + title text-sm (축소).
 *   - canonical truth = item.priority (변경 0).
 *   - PRIORITY_BADGE / SOURCE_MODULE_COLORS 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const POPUP_PATH = resolve(__dirname, "../../../components/operational-brief/popup.tsx");
const popup = readFileSync(POPUP_PATH, "utf8");

describe("#operational-brief-card-priority-hierarchy-d4 — urgent (p0/p1) 강조", () => {
  it("border width 강조 — border-l-[6px] 분기 (urgent)", () => {
    expect(popup).toMatch(/border-l-\[6px\]/);
  });

  it("기존 priority tone color 보존 (rose/amber/blue/slate)", () => {
    expect(popup).toMatch(/border-l-rose-500/);
    expect(popup).toMatch(/border-l-amber-400/);
    expect(popup).toMatch(/border-l-blue-400/);
    expect(popup).toMatch(/border-l-slate-300/);
  });
});

describe("#operational-brief-card-priority-hierarchy-d4 — non-urgent (p2/p3) 축소", () => {
  it("padding 축소 — py-3 분기 사용", () => {
    expect(popup).toMatch(/py-3/);
  });

  it("title text size 축소 분기 — text-sm 사용", () => {
    // 기존 text-base 유지 (urgent), 추가로 text-sm (non-urgent) 분기.
    expect(popup).toMatch(/text-sm/);
  });
});

describe("#operational-brief-card-priority-hierarchy-d4 — drift sentinel", () => {
  it("기존 단일 'border-l-4' 단독 className 잔존하지 않음", () => {
    // 옛 패턴: 모든 priority 동일 border-l-4. 새 패턴: priority 별 분기.
    // 단순 grep — `cn("border-l-4", toneBorder)` literal 패턴 차단.
    expect(popup).not.toMatch(/cn\(\s*"border-l-4"\s*,\s*toneBorder\s*\)/);
  });

  it("cluster trace marker", () => {
    expect(popup).toMatch(/#operational-brief-card-priority-hierarchy-d4|시각 위계|hierarchy/);
  });
});

describe("#operational-brief-card-priority-hierarchy-d4 — handler 보존", () => {
  it("PopupItemRow component 보존 (PopupBriefInline expand 분기)", () => {
    expect(popup).toMatch(/PopupBriefInline/);
  });

  it("aria-expanded + onToggle 보존 (a11y)", () => {
    expect(popup).toMatch(/aria-expanded/);
    expect(popup).toMatch(/onToggle/);
  });
});
