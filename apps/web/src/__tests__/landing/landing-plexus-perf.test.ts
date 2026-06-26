/**
 * §landing-plexus-perf — 랜딩 히어로 Plexus 네트워크 perf/a11y 개선 (drop-in)
 *   (호영님 spec — README-ce729dc0: 룩앤필 보존, 내부 동작만 개선)
 *
 * 개선 6항목:
 *   1. prefers-reduced-motion 존중 — 모션 끄기 사용자는 정적 1프레임만
 *   2. DPR(레티나) 대응 — ctx.setTransform(dpr...)로 선/노드 또렷 (2배 상한)
 *   3. 입자 상한 — 데스크탑 150 / 모바일 70 (4K 발열·끊김 방지)
 *   4. 화면 밖(IntersectionObserver) / 탭 비활성(visibilitychange) 루프 정지
 *   5. 모바일 터치 인터랙션 — touchmove 로 노드 인력
 *   6. 셀 그리드 인접 탐색 — O(n²) → 근사 O(n)
 *
 * 룩앤필 보존 lock (READMEе 주의):
 *   - LINK_DIST 150 / alpha 식 / rgba 색 / canvas className 불변
 *   - cluster 판정(maxDist*0.45) / 노드 반경 식 불변
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const HERO_PATH = resolve(__dirname, "../../app/_components/bioinsight-hero-section.tsx");
const hero = readFileSync(HERO_PATH, "utf8");

describe("§landing-plexus-perf — 개선 6항목 적용", () => {
  it("trace marker 존재", () => {
    expect(hero).toMatch(/§landing-plexus-perf/);
  });

  it("1. prefers-reduced-motion 감지 + 정적 1프레임", () => {
    expect(hero).toMatch(/matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
    expect(hero).toMatch(/if \(reduceMQ\.matches\) \{ drawScene\(\); return; \}/);
  });

  it("2. DPR(레티나) 대응 — setTransform(dpr) + 2배 상한", () => {
    expect(hero).toMatch(/Math\.min\(window\.devicePixelRatio \|\| 1, 2\)/);
    expect(hero).toMatch(/ctx\.setTransform\(dpr, 0, 0, dpr, 0, 0\)/);
  });

  it("3. 입자 상한 — 데스크탑 150 / 모바일 70", () => {
    expect(hero).toMatch(/PARTICLE_CAP = 150/);
    expect(hero).toMatch(/MOBILE_CAP = 70/);
    expect(hero).toMatch(/Math\.min\(Math\.floor\(\(cssW \* cssH\) \/ 9000\), cap\)/);
  });

  it("4. 화면 밖/탭 비활성 정지 — IntersectionObserver + visibilitychange", () => {
    expect(hero).toMatch(/new IntersectionObserver/);
    expect(hero).toMatch(/document\.addEventListener\("visibilitychange", onVis\)/);
  });

  it("5. 모바일 터치 인터랙션 — touchmove 노드 인력", () => {
    expect(hero).toMatch(/addEventListener\("touchmove", onTouch, \{ passive: true \}\)/);
  });

  it("6. 셀 그리드 인접 탐색(buildGrid) — O(n²)→근사 O(n)", () => {
    expect(hero).toMatch(/const buildGrid = \(\) => \{/);
    expect(hero).toMatch(/for \(let ox = -1; ox <= 1; ox\+\+\)/);
  });
});

describe("§landing-plexus-perf — 룩앤필 보존(회귀 0)", () => {
  it("LINK_DIST 150 + alpha 식 보존(연결선 톤 불변)", () => {
    expect(hero).toMatch(/LINK_DIST = 150/);
    expect(hero).toMatch(/0\.55 - \(dist \/ LINK_DIST\) \* 0\.40/);
    expect(hero).toMatch(/0\.30 - \(dist \/ LINK_DIST\) \* 0\.22/);
  });

  it("입자/노드 rgba 색 보존(시각 룩 불변)", () => {
    expect(hero).toMatch(/rgba\(130,180,240,\$\{alpha\}\)/);
    expect(hero).toMatch(/rgba\(110,160,220,\$\{alpha\}\)/);
    expect(hero).toMatch(/rgba\(140,190,250,1\.0\)/);
    expect(hero).toMatch(/rgba\(120,170,230,0\.75\)/);
  });

  it("cluster 판정 + 노드 반경 식 보존", () => {
    expect(hero).toMatch(/distFromCenter > maxDist \* 0\.45/);
    expect(hero).toMatch(/isCluster \? Math\.random\(\) \* 2\.5 \+ 1\.4 : Math\.random\(\) \* 1\.8 \+ 1\.0/);
  });

  it("canvas mount className 보존(레이아웃 불변) + 사용처 보존", () => {
    expect(hero).toMatch(/<canvas ref=\{canvasRef\} className="absolute inset-0 w-full h-full" \/>/);
    expect(hero).toMatch(/<PlexusCanvas \/>/);
  });

  it("cleanup — observer disconnect + touch/vis 리스너 해제(누수 0)", () => {
    expect(hero).toMatch(/io\.disconnect\(\)/);
    expect(hero).toMatch(/removeEventListener\("touchmove", onTouch\)/);
    expect(hero).toMatch(/removeEventListener\("visibilitychange", onVis\)/);
  });
});
