/**
 * 환경 변수 유틸리티
 * 프로덕션 환경 체크 및 개발 환경 전용 기능 제어
 */

import React from "react";

/**
 * 현재 환경이 프로덕션인지 확인
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * 현재 환경이 개발 환경인지 확인
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

/**
 * 개발 환경에서만 실행되는 함수 래퍼
 * 프로덕션에서는 아무것도 실행하지 않음
 */
export function devOnly<T>(fn: () => T): T | undefined {
  if (isDevelopment()) {
    return fn();
  }
  return undefined;
}

/**
 * 개발 환경에서만 렌더링되는 컴포넌트 래퍼
 */
export function DevOnly({ children }: { children: React.ReactNode }) {
  if (isDevelopment()) {
    return <>{children}</>;
  }
  return null;
}

