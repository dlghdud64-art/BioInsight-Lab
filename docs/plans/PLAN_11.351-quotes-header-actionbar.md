# Implementation Plan: §11.351 — 견적 관리 헤더 정리 + 하단 고정 액션 바 + 일괄 액션 상태 정합

- **Status:** 🔄 In Progress (Phase 0)
- **Priority:** P2 (라이브 UX — §11.349 동급)
- **유형:** UI 정정(dead UI 제거 + layout shift 제거 + 일괄 ontology 정합) · same-canvas · §11.343 후속
- **Scope:** Small~Medium (3 phase)
- **Last Updated:** 2026-06-02 (rev2)

> Quality Gate: build/compile + test(또는 "실행 불가") + no-op/dead 없음 + canonical 보호 + same-canvas + one-primary.

## Overview — 3 결함
1. 헤더 4액션 과밀(새 견적 요청+드롭다운 / 견적서 비교 / 견적서 스캔 / **초안 만들기**) — one-primary 위반. "초안 만들기"=불필요(이전 업로드 창, 실가치 0).
2. 선택 시 상단 배너+카드 블록 삽입 → KPI 5칸 밀림 = layout shift.
3. **일괄 발송 집계가 `회신 대기` 포함 (ontology/canonical 버그).** 회신 대기=이미 발송·회신 대기 상태라 발송 대상 아님. "발송 가능 14"가 거짓(실제=`요청 발송 전`만). 중복 발송/no-op 위험. 행 단위는 정상("회신 확인").

## Decision (확정)
- 초안 만들기 = 헤더 버튼 숨김(방안 a, 모달 코드 잔존). 새 견적요청/비교/스캔 유지, one-primary 위계.
- 선택 액션 = **하단 고정 액션 바**(레이아웃 push 0).
- 일괄 발송 대상 = `요청 발송 전`만. `회신 대기` 제외 → 리마인더/회신 확인 분기. "발송 가능 N"=실제 발송 가능 수.

## Truth
- Source of Truth: 견적 데이터(서버), **상태(`요청 발송 전`/`회신 대기`)가 canonical.** 선택=UI state. 일괄 집계=상태 기반 파생(canonical 무시 금지).
- Surface: /dashboard/quotes, same-canvas. Must Not: 초안 외 기능 변경, 실 mutation(일괄 발송/상태변경/리마인더) 훼손, layout shift 재발.

## Phases
- Phase 0: ① 헤더 4액션 onClick/route, ② 선택 배너 삽입 위치(KPI 위), ③ 일괄 액션 mutation wiring, ④ **"발송 가능 N" 집계가 상태 필터 거치는지 + 일괄 발송이 `회신 대기`에 어떻게 동작하는지(중복/no-op)**.
- Phase 1: 초안 부재 / one-primary / 비교·스캔 유지 / 하단 고정 바 + layout shift 0 / 실 mutation 유지 / **혼합선택 시 발송가능=`요청 발송 전`만, 회신 대기 제외, 중복 발송 0**.
- Phase 2: 초안 hide + one-primary + 하단 고정 액션 바 + **일괄 집계 상태 정합(발송 가능 8·회신 대기 6 분리)** + safe-area.

## Rollback
- P1 scaffolding revert / P2 헤더·액션바·집계 revert(초안 모달 코드 잔존).
