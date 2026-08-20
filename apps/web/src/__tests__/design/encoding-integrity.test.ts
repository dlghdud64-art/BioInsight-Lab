/**
 * §encoding-integrity (⑧-3) — 인코딩 손상 유입 차단
 *
 * 실측 2026-08-19: 사용자가 주문 접수 화면에서 `???제할 과제` 를 봤다.
 * 원인은 빌드/전송이 아니라 **소스 파일 자체**였고, U+FFFD 3바이트로
 * 한글 1음절이 소실돼 있었다(`결제할` → 복원 `f088ac28`).
 * 12개 커밋이 깨진 채 통과했다 — 잠그는 것이 없었다.
 *
 * 🛑 **축을 둘로 가른다.** 하나로 묶으면 부채를 기준선에 봉인하게 된다.
 *    전수 스캔에서 `data-table.tsx` 가 U+FFFD 109건으로 나왔는데, 그건 손상이 아니라
 *    파일이 **UTF-16LE** 라 UTF-8 로 읽어서 생긴 값이다. 109 를 baseline 에 넣으면
 *    amber ratchet 과 같은 형태가 되어 **새 손상이 그 안에 숨는다.**
 *
 *      축 1  UTF-16 BOM 이 아닌 파일  →  U+FFFD 전수 0        (부채 봉인 없음)
 *      축 2  UTF-16 BOM 파일 목록 자체를 고정 →  늘면 RED      (부채는 목록으로 격리)
 *
 *    ⑧-2(data-table.tsx 처분)가 끝나면 축 2 의 목록에서 그 파일이 빠진다.
 *    즉 이 sentinel 은 ⑧-2 를 기다리지 않고 지금 발효하며, ⑧-2 완료를 스스로 요구한다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";

const ROOT = join(__dirname, "..", "..");          // apps/web/src
/* 🛑 ROOT 가 apps/web/src 이므로 접두 `src/` 를 다시 붙인다 — 기준 목록·보고 경로가 레포 기준이어야 읽힌다. */
const REL = (p: string) => "src/" + p.slice(ROOT.length + 1).split(sep).join("/");
const SKIP = /^(node_modules|\.next|\.git)$/;
const TARGET = /\.(tsx?|json|md)$/;

/** UTF-16 BOM — LE(ff fe) · BE(fe ff). UTF-8 BOM(ef bb bf) 은 대상 아님. */
function isUtf16(b: Buffer): boolean {
  return b.length >= 2 && ((b[0] === 0xff && b[1] === 0xfe) || (b[0] === 0xfe && b[1] === 0xff));
}

type Scan = { scanned: number; utf16: string[]; damaged: string[] };

function scan(): Scan {
  const utf16: string[] = [];
  const damaged: string[] = [];
  let scanned = 0;
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (!SKIP.test(e.name)) walk(join(dir, e.name));
        continue;
      }
      if (!TARGET.test(e.name)) continue;
      const p = join(dir, e.name);
      const buf = readFileSync(p);
      scanned++;
      if (isUtf16(buf)) {
        utf16.push(REL(p));
        continue;                                   // 축 1 대상 아님
      }
      const text = buf.toString("utf8");
      const idx = text.indexOf("\uFFFD")  /* 🛑 리터럴 금지 — 이 파일도 스캔 대상이라 스스로 RED 가 된다 */;
      if (idx >= 0) {
        const line = text.slice(0, idx).split("\n").length;
        damaged.push(`${REL(p)}:${line}`);
      }
    }
  };
  walk(ROOT);
  return { scanned, utf16: utf16.sort(), damaged: damaged.sort() };
}

const result = scan();

/* 🛑 ⑧-2 처분 시 여기서 해당 경로를 **뺀다**. 목록이 비면 축 2 는 "UTF-16 파일 0" 이 된다.
 *    늘리는 방향으로 고치지 말 것 — 늘리면 부채를 봉인하는 것이고 이 파일의 전제가 깨진다. */
const UTF16_BASELINE = ["src/components/ui/data-table.tsx"] as const;

describe("§encoding-integrity 축 1 — UTF-8 파일에 손상 문자 0", () => {
  it("🛑 스캔이 실제로 돌았다 (무의미 통과 방지)", () => {
    /* 워크가 0건이면 아래 단언들이 전부 자동 통과한다. 실측 2026-08-19 = 3236 파일. */
    expect(result.scanned).toBeGreaterThan(2000);
  });

  it("U+FFFD 를 포함한 UTF-8 소스가 없다", () => {
    /* 실패 시 파일:줄 이 그대로 보이도록 배열째 비교한다. */
    expect(result.damaged).toEqual([]);
  });
});

describe("§encoding-integrity 축 2 — UTF-16 파일 목록 고정", () => {
  it("UTF-16 BOM 파일이 기준 목록과 정확히 같다 (늘면 RED)", () => {
    expect(result.utf16).toEqual([...UTF16_BASELINE]);
  });

  it("🛑 기준 목록은 부채다 — 처분 대상임을 명시한다", () => {
    /* 이 단언은 목록이 비는 순간 스스로 무의미해진다(0 <= 1).
     * 남겨두는 이유는 다음 사람이 "왜 1건이 허용돼 있나" 를 코드에서 읽게 하기 위해서다.
     * ⑧-2 처분 후 UTF16_BASELINE 을 [] 로 바꾸고 이 it 을 지운다. */
    expect(UTF16_BASELINE.length).toBeLessThanOrEqual(1);
  });
});

describe("§encoding-integrity — 복원분 회귀 0 (⑧-1)", () => {
  it("주문 접수 예산 라벨이 `결제할 과제` 다", () => {
    /* f088ac28 복원분. 원형은 8adf19fc 판본 바이트에서 확인했다:
     * EA B2 B0 · EC A0 9C · ED 95 A0 · 20 · EA B3 BC · EC A0 9C */
    const src = readFileSync(join(ROOT, "app", "quotes", "[id]", "page.tsx"), "utf8");
    expect(src).toMatch(/<Label>결제할 과제/);
  });
});
