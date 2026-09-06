"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * 페이지 전환 래퍼 (Next App Router `app/template.tsx`).
 *
 * 🛑 **초기 상태가 콘텐츠를 비가시로 만들면 안 된다** (호영님 2026-09-06, (가)).
 *
 * 사고 실측 — `/billing` 이 회색 막만 남고 본문이 통째로 사라졌다:
 *   inline    opacity: 0 · transform: translateY(1.16832px)
 *   computed  opacity 0.85418   ← 애니메이션이 **끝나기 직전에 멈췄다**
 *   parent BODY · child `min-h-screen bg-pg`(페이지 본문 전체)
 *
 *   구 판본은 `initial={{ opacity: 0, y: 8 }}` 이었다. 이 래퍼는 **루트 template** 이라
 *   `/billing` 만이 아니라 **전 라우트**를 감싼다. 평소엔 0.25초 만에 opacity 1 로 끝나
 *   안 보이지만, 애니메이션이 완료되지 않으면 **페이지가 통째로 비가시**가 된다.
 *   실패가 "덜 예쁨" 이 아니라 **전면 불능**으로 나타나는 구조였다.
 *
 *   ⇒ 0.25초 페이드를 얻는 대가로 전 라우트 백지화 위험을 걸고 있었다. 거래가 성립하지 않는다.
 *   opacity 축을 제거한다. 애니메이션이 **한 프레임도 안 돌아도** 콘텐츠는 보인다 —
 *   최악의 경우 8px 아래에 그대로 있을 뿐이다.
 *
 * 🛑 안전 타이머(일정 시간 뒤 강제 opacity 1)는 기각됐다 — 증상을 덮고 사유를 안 남기며
 *   타이머가 도는 동안 화면은 여전히 안 보인다.
 *
 * 별건(원인 미규명): 왜 완료되지 않았는지는 아직 모른다. 후보 — 하이드레이션 중단 ·
 *   rAF starvation · 재렌더로 motion 노드 교체. 같은 원인이 다른 애니메이션도 멈추게 하고
 *   있을 수 있어 추적 가치가 있으나, 이 커밋의 처방은 원인과 무관하게 성립한다.
 *
 * 부수 관측: `exit` 는 `AnimatePresence` 없이는 **실행되지 않는다**(이 트리에 없다).
 *   구 판본의 `exit.opacity` 는 동작한 적이 없다 — 함께 정리한다.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ y: 8 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
