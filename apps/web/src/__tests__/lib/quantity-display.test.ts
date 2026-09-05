/**
 * §scan-unit-guard (호영님 2026-09-05) — 곱셈 좌우는 다른 출처다.
 *
 * 사고 실측 (같은 문서, 두 스캔에서 모델이 다르게 답했다):
 *   07:50  spec "4 L" · qty 6 · unit "EA"  → `4 L × 6 EA`   맞다
 *   09:52  spec "4 L" · qty 6 · unit "L"   → `4 L × 6 L`    24 L 로 읽힌다
 *   원인은 UI 가 아니라 **프롬프트**였다(operator 가 unit 의 정의를 안 적었다).
 *   UI 는 이미 line.unit 을 쓰고 있었고 무고했다.
 *
 * 🛑 그래서 프롬프트만 고치지 않는다 — 프롬프트는 확률을 옮길 뿐 다음 호출에서 다시 흔들린다.
 *    출처만 잠그면 `l.unit` 을 쓰면서도 `4 L × 6 L` 이 나올 수 있다 — 실제로 그랬다.
 *    그래서 이 파일은 **화면 문자열을 값으로 실측**한다.
 */

import { describe, it, expect } from "vitest";
import {
  formatQuantityWithSpec,
  specUnit,
  UNIT_SOURCE,
} from "@/lib/inventory/quantity-display";

describe("§scan-unit-guard — 규격 단위 추출", () => {
  it("규격 문자열에서 단위만 뽑는다", () => {
    expect(specUnit("4 L")).toBe("L");
    expect(specUnit("500 mL")).toBe("mL");
    expect(specUnit("50 EA")).toBe("EA");
    expect(specUnit("0.22um")).toBe("um");
  });

  it("단위가 없거나 비면 null", () => {
    expect(specUnit("")).toBeNull();
    expect(specUnit(null)).toBeNull();
    expect(specUnit("100")).toBeNull();
  });
});

describe("§scan-unit-guard — 이번 사고 케이스 (값으로 실측)", () => {
  it("🛑 규격 단위가 수량에 복사돼도 `4 L × 6 L` 이 안 나온다", () => {
    const r = formatQuantityWithSpec({ specification: "4 L", quantity: 6, unit: "L" });
    expect(r.text).not.toBe("4 L × 6 L");
    expect(r.text).toBe("4 L × 6개");
    expect(r.unitSource).toBe(UNIT_SOURCE.FALLBACK);
  });

  it("500 mL × 12 mL · 1 L × 10 L 도 같은 자리에서 막힌다", () => {
    expect(
      formatQuantityWithSpec({ specification: "500 mL", quantity: 12, unit: "mL" }).text,
    ).toBe("500 mL × 12개");
    expect(
      formatQuantityWithSpec({ specification: "1 L", quantity: 10, unit: "L" }).text,
    ).toBe("1 L × 10개");
  });

  it("모델이 제대로 답하면 그 값을 그대로 쓴다 (07:50 스캔 형태)", () => {
    const r = formatQuantityWithSpec({ specification: "4 L", quantity: 6, unit: "EA" });
    expect(r.text).toBe("4 L × 6 EA");
    expect(r.unitSource).toBe(UNIT_SOURCE.MODEL);
    expect(r.resolvedUnit).toBe("EA");
  });

  it("`50 EA × 4 EA` 도 폴백한다 — 그게 더 정확하다 (호영님 판단)", () => {
    // 왼쪽은 포장 단위, 오른쪽은 낱개 수량이다. 같은 라벨을 쓰면 안 된다.
    const r = formatQuantityWithSpec({ specification: "50 EA", quantity: 4, unit: "EA" });
    expect(r.text).toBe("50 EA × 4개");
    expect(r.unitSource).toBe(UNIT_SOURCE.FALLBACK);
  });

  it("대소문자가 달라도 충돌로 본다", () => {
    expect(formatQuantityWithSpec({ specification: "4 L", quantity: 6, unit: "l" }).text).toBe(
      "4 L × 6개",
    );
  });
});

describe("§scan-unit-guard — 경계", () => {
  it("unit 이 없으면 폴백 + FALLBACK 기록", () => {
    const r = formatQuantityWithSpec({ specification: "4 L", quantity: 6, unit: null });
    expect(r.text).toBe("4 L × 6개");
    expect(r.unitSource).toBe(UNIT_SOURCE.FALLBACK);
  });

  it("규격이 없으면 수량만 — 지어내지 않는다", () => {
    expect(
      formatQuantityWithSpec({ specification: null, quantity: 6, unit: "EA" }).text,
    ).toBe("6 EA");
    expect(formatQuantityWithSpec({ specification: "", quantity: 6, unit: null }).text).toBe(
      "6개",
    );
  });

  it("규격 단위가 없으면(숫자뿐) 모델 unit 을 쓰되 **미검증**으로 기록한다", () => {
    /* 승계 (2026-09-05, Cowork QA 계측 공백): 원 단언은 `MODEL` 이었다.
     * 🛑 표시는 그대로다 — 바뀐 것은 **기록**뿐이다. `su === null` 이면 충돌 여부를
     *   판정할 수 없었던 것이지 모델이 맞았다는 뜻이 아니다.
     *   그 둘을 같은 값으로 적으면 `unitSource` 분포에서 프롬프트 수정 효과가 안 보인다. */
    const r = formatQuantityWithSpec({ specification: "100", quantity: 3, unit: "BOX" });
    expect(r.text).toBe("100 × 3 BOX");
    expect(r.unitSource).toBe(UNIT_SOURCE.UNVERIFIED);
  });

  it("규격이 아예 없어도 미검증이다 (대조 대상이 없다)", () => {
    const r = formatQuantityWithSpec({ specification: null, quantity: 6, unit: "EA" });
    expect(r.text).toBe("6 EA");
    expect(r.unitSource).toBe(UNIT_SOURCE.UNVERIFIED);
  });

  it("🔑 검증된 MODEL 과 미검증이 **다른 값**이다 (분포에서 갈린다)", () => {
    const verified = formatQuantityWithSpec({ specification: "4 L", quantity: 6, unit: "EA" });
    const unverified = formatQuantityWithSpec({ specification: "100", quantity: 3, unit: "BOX" });
    // 리터럴로도 본다 — enum 멤버가 사라져도 공허하게 통과하지 않게(위 주석 참조)
    expect(verified.unitSource).toBe("MODEL");
    expect(unverified.unitSource).toBe("UNVERIFIED");
    expect(verified.unitSource).not.toBe(unverified.unitSource);
  });

  it("세 출처가 각각 존재한다 — **이름까지** 고정", () => {
    /* 🛑 개수만 세면 부족하고, `toBe(UNIT_SOURCE.X)` 만 쓰면 **공허해진다**:
     *   enum 멤버를 지우면 `r.unitSource` 도 `UNIT_SOURCE.X` 도 둘 다 `undefined` 라
     *   비교가 통과한다(프로브 V2 실측 — 13건 중 1건만 RED 였다).
     *   → 값 집합을 **문자열로** 고정한다. 이건 지우면 반드시 RED 다. */
    expect(Object.values(UNIT_SOURCE).slice().sort()).toEqual([
      "FALLBACK",
      "MODEL",
      "UNVERIFIED",
    ]);
  });
});
