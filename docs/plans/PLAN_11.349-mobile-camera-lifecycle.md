# Implementation Plan: §11.349 — 모바일 웹뷰 카메라 lifecycle 정정

- **Status:** 🔄 In Progress (Phase 0)
- **Priority:** P2 (라이브 dead button — 대기열 §11.335b·§11.336 동급)
- **유형:** Bugfix / 모바일 웹뷰 카메라 lifecycle (dead button 제거) · same-canvas
- **Scope:** Small (3 phase)
- **Last Updated:** 2026-06-02

> Quality Gate: build/compile + 관련 test(또는 "실행 불가") + no-op/dead button 없음 + same-canvas + 카메라 stream cleanup.

## Overview
재고 스캔(QR/라벨) 화면에서 "중지" 버튼 dead. 모바일 웹뷰(브라우저 getUserMedia, native expo-camera 아님). 권한·init 정상, "중지" no-op. lifecycle 상태 머신 부재 + 시작/재시도 경로 없음.

## Diagnosis (가설)
- A(유력): "중지" onClick이 MediaStream track 못 멈춤(ref/클로저 누락) → no-op.
- B: 멈추나 UI 미전환 + 재시작 버튼 없어 상태 인지 불가.

## Phases
- Phase 0 Context & Truth Lock: 중지 onClick 실제 동작 / MediaStream 참조 위치 / 시작·재시도 핸들러 유무 / 언마운트 cleanup → 가설 확정.
- Phase 1 Contract & Failing Tests: 중지=track stop, 중지됨→시작/재시도 노출+재시작, 언마운트 cleanup, 상태별 UI.
- Phase 2 Core + UI Wiring: lifecycle 상태머신(요청중/작동중/중지됨/실패) + 중지 핸들러 stop + 시작/재시도 버튼 + cleanup + 웹뷰 guard + 상태별 UI.
- Phase 3 실기기 수동 검증(자동화 한계 — getUserMedia): 중지→LED off / 재시작 / 권한거부 사유 / 이탈·재진입 / 백그라운드 복귀 / QR·라벨 토글.

## Risks
- getUserMedia 자동 테스트 한계 → 실기기 수동 검증 보완.
- 언마운트 cleanup 누락 → 카메라 점유. iOS/Android 웹뷰 차이.

## Rollback
- P1 scaffolding revert / P2 lifecycle revert→기존 화면 / P3 feature flag off.
