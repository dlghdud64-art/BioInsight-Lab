"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * 페이지 전환 시 부드러운 fade-up 애니메이션을 적용하는 래퍼.
 * Next.js App Router의 template.tsx에서 사용.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
