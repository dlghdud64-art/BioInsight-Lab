# Implementation Plan: 활동·감사 로그 고도화 (§audit-log-enhancement)

- **Status:** 🔄 In Progress (P0 완료)
- **Started:** 2026-07-04
- **Feature ID:** §audit-log-enhancement

**CRITICAL:** phase별 quality gate·rollback. dead button/no-op/fake success 금지. **fake compliance 금지**(근거 없는 "해시 검증됨" 등).

## 0. Truth Reconciliation (P0 완료)
**기존(재사용):** audit/page.tsx(1183줄) 2모드 토글(activity/audit) + /api/activity-logs·/api/audit-logs 실연동 + reason(metadata) 처리 + Part 11 KST + append-only(수정삭제 API 없음).
**데이터 모델:** AuditLog(userId·eventType·entityType·action·changes(전후)·metadata·ipAddress·createdAt) / ActivityLog(userId·activityType·beforeStatus·afterStatus·actorRole·metadata·ipAddress).
**honesty 갭:**
- ❌ 무결성 해시/서명 필드 **없음** → 목업 "해시 검증됨" 배지 = 허위. **정직 문구 대체**(변조 방지 append-only·수정삭제 불가·KST·21 CFR Part 11 정합). 실 hash chain은 별도 백엔드 트랙.
- ✅ 사유(reason)는 metadata에서 이미 파생.
**결정:** audit-first 기본(호영님 승인) · 목업 패리티(점진 phase).

## 1. 제약
same-canvas(기존 route 재사용, 신규 page 0) · canonical(ActivityLog/AuditLog 읽기, UI state가 truth 대체 금지) · append-only 보존 · **fake compliance 0** · 색 규칙(중립 기본·빨강=실패만·카테고리=배지만).

## 2. Phases
- **P0** Truth Lock — ✅ 완료(델타·honesty 갭 확정)
- **P1** 토큰·색 규칙 + 정직한 신뢰 배지 바 (해시 주장 제거)
- **P2** 활동 로그 뷰 — 멤버 칩(아바타+건수)·날짜그룹 sticky 피드·문장형·카테고리 배지·실패 하이라이트
- **P3** 감사 추적 뷰 — 요약 4카드(accent 숨김)·하루 단위 날짜 네비·카테고리 칩·타임라인(전→후·IP·사유·시스템자동·실패)
- **P4** audit-first 기본 + empty/온보딩 + build/sentinel/rollback

## 3. Risks
| Risk | Mit |
| :--- | :--- |
| fake compliance(해시) | 정직 문구만, 실 hash는 별도 트랙 |
| 1183줄 대형 파일 truncation | mount-safe + git HEAD 재구성 + tsc 게이트 |
| 색 과용 | 색 규칙 sentinel(빨강=실패만) |
| canonical 훼손 | API 읽기 전용, UI state 파생만 |

## 4. Progress
- Overall: 80% (P1·P2·P2b·P3-core·P4 완료 / P3b 타임라인·날짜네비 deferred)
- Next: P1 토큰·신뢰 바

## 진행 결과 (2026-07-04)
- P1 신뢰 바(정직, 해시 미주장) · P2 활동 피드(아바타·문장형·카테고리 dot·날짜그룹·변경칩·실패) · P2b 멤버 칩 · P3 요약 스트립(4카드, accent 미사용) · P4 audit-first(기존 만족).
- 검증: sentinel 6/6 GREEN, 괄호 균형 0/0/0, NUL 0.
- **Deferred(P3b/P4b):** 감사 테이블→타임라인 전면전환 · 하루 단위 날짜 네비게이터 · empty 온보딩 3카드. (현 테이블이 전→후·IP·사유 정직 표시라 컴플라이언스 충족; 스타일 후속.)
