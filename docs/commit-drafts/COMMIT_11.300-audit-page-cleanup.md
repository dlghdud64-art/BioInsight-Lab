# §11.300 Commit Message Draft (호영님 P1 Phase 1a — audit 개발 지표 제거)

```
fix(audit): §11.300 #audit-page-cleanup — 개발 지표 4 block 제거 (운영 브리핑 캐시 통계 / Injection 패턴 Top / fitness drift / StatCell helper) + 사이드바 영문 병기 제거 (호영님 P1)

호영님 P1 (2026-05-24):
/dashboard/audit 가 일반 사용자 화면에 개발 디버깅 대시보드 노출 —
운영 브리핑 캐시 통계 (HIT RATE / CACHE SIZE / EVICT / INVALIDATE /
FITNESS PASS/FAIL) + "$11,142 ecosystem · KV 통합 · LLM hallucination ·
prompt drift" 영문 raw 텍스트 + "Injection 시도" filter chip + Top 5
injection pattern breakdown. GMP 감사 증적 관점에서 부적합.

호영님 의사결정 (Phase 1 spec):
- Q1 OK: Phase 1a (제거 + 사이드바 라벨) 먼저 단일 batch
- Q2 C 보류: 활동 로그 데이터 source 연결은 별도 batch (§11.300b) —
  AuditLog 가 비어있는 상태에서 ActivityLog 를 억지로 합치면 데이터
  모델 꼬임. 화면 cleanup 후 event hook wiring 별도 설계.
- Q3 C 보류: 캐시 통계 별도 admin route 이전 별도 batch (§11.300c) —
  page-per-feature 회귀 위험. 전체 관리자 기능이 모일 때 한 번에 설계.

Fix (2 file ~100 line 제거 + 1 NEW test):

- apps/web/src/app/dashboard/audit/page.tsx:
  · briefCacheStats useQuery 제거 (line 258-284, ~27 line)
    → §11.300 주석 6 line 으로 대체 (Phase 1b/c 의사결정 trace)
  · "Injection 시도" quick filter chip 제거 (line 504-527, ~24 line)
  · 운영 브리핑 캐시 통계 block 전체 제거 (line 530-577, ~48 line)
    - h2 "운영 브리핑 캐시 통계"
    - 8-cell StatCell grid (hit rate / cache size / hit / miss /
      evict / invalidate / fitness pass / fitness fail)
    - description text ("$11,142 ecosystem · 1분 자동 갱신 ·
      KV 통합 · LLM hallucination 차단 · prompt drift 검토")
    - Top 5 injection pattern breakdown (rose accent)
  · StatCell helper component 제거 (line 681-693, ~13 line)

- apps/web/src/app/_components/dashboard-sidebar.tsx:
  · adminMenuItems line 146 라벨 swap:
    "감사 증적 (Audit Trail)" → "감사 증적"
  · GMP 감사 양식 용어 호영님 spec — 영문 병기 제거

- apps/web/src/__tests__/regression/audit-page-cleanup-300.test.ts
  (NEW, 12 it × 3 nested describe):
  · §11.300 trace
  · 개발 지표 4 block 제거 (캐시 통계 / StatCell / briefCacheStats /
    개발 raw text / Injection / fitness drift) 6 sentinel
  · 기본 감사 로그 표시 보존 (테이블 헤더 5 / 필터 3 / 내보내기 3 /
    main fetcher / 권한 카드) 5 sentinel
  · 사이드바 라벨 swap 1 sentinel

canonical truth 보존 (회귀 0):
- AuditLog (Prisma) source 변경 0 — /api/audit-logs main fetcher 보존
- adaptLog (changes JSON → before/after 추출) 보존
- AUDIT_EVENT_LABELS / AUDIT_TONE_CLASSES / buildEventTypeOptions helper
  import 그대로
- 권한 체크 (canAccessAudit + ADMIN/manager) 보존
- ShieldAlert 권한 카드 보존
- 간단 인쇄 / 정형 PDF (/api/audit-logs/pdf-view) / CSV 내보내기 보존
- print:hidden / print:block CSS 보존 — 인쇄용 헤더 정형 양식 보존
- PDF 출력본 헤더 "LabAxis 감사 증적 (Audit Trail)"
  (route.ts:250) 보존 — 호영님 spec 외, 규제 양식 영문 병기 의미

호영님 production effect:
1. /dashboard/audit 진입 → 캐시 통계 / Injection chip / 개발 raw text
   0 노출
2. 사이드바 "감사 증적" 라벨 — 영문 병기 제거
3. 기본 감사 로그 테이블 (일시 / 작업자 / 액션 / 변경 내역 / 사유) 보존
4. AuditLog 데이터가 비어있으면 empty state ("감사 로그가 없습니다") —
   §11.300b 별도 batch 에서 event hook wiring 으로 채울 예정
5. ADMIN 가시성 (캐시 통계 / fitness drift / injection pattern) 은
   /api/admin/operational-brief-cache-stats 직접 조회 또는 로그
   모니터링으로 임시 유지 — §11.300c 별도 batch 에서 admin route 신설

§11.300 Out of Scope (별도 batch — 호영님 Q2/Q3 C 보류):
- §11.300b 활동 로그 → 감사 증적 데이터 source 연결 (event hook
  wiring 설계 — AuditLog 가 실제 채워지도록)
- §11.300c 캐시 통계 admin route 신설 (/admin/system-health 또는
  /settings/system-health — 전체 관리자 기능 design 시 결정)
- Phase 2 (중기): 변경 전/후 값 + 사유 강제 입력
- Phase 3 (장기): 전자서명 / append-only / 접근 권한 분리 / 정기 리뷰

Rollback path: git revert <SHA>
- 2 file ~100 line 복원 + sentinel test 삭제
- /api/admin/operational-brief-cache-stats endpoint 자체는 변경 0 —
  기존 cache stats fetcher / fitness drift 데이터 그대로 살아있음

Lessons:
1. 개발 디버깅 지표 (캐시 통계 / fitness drift / injection pattern) 는
   사용자 화면 (특히 GMP 감사 증적) 에 노출 금지 — 별도 admin route
   에서만 가시
2. 영문 병기 (Audit Trail) 는 PDF 출력본 같은 규제 양식 한정 —
   사이드바 / 화면 헤더는 한국어 단일
3. 데이터 source 연결 (ActivityLog ↔ AuditLog) 은 truth-conflict 위험
   이 큰 작업 — 화면 cleanup 후 별도 설계 → 호영님 Q2=C 결정 정합
4. page-per-feature 회피 — admin route 신설은 전체 관리자 기능 design
   시 한 번에 (호영님 Q3=C 결정 정합)
5. Karpathy minimum-diff — 2 file ~100 line 제거 + 1 NEW test (12)
```

## Push

```bash
git add apps/web/src/app/dashboard/audit/page.tsx \
        apps/web/src/app/_components/dashboard-sidebar.tsx \
        apps/web/src/__tests__/regression/audit-page-cleanup-300.test.ts \
        docs/commit-drafts/COMMIT_11.300-audit-page-cleanup.md

git commit -F docs/commit-drafts/COMMIT_11.300-audit-page-cleanup.md
git push origin main
```

## Production smoke

1. labaxis.co.kr/dashboard/audit Cmd+Shift+R
2. 운영 브리핑 캐시 통계 block 0 (h2 "운영 브리핑 캐시 통계" 부재)
3. "Injection 시도" chip 0 (filter row 에 chip 부재)
4. 개발 raw text 0 ("$11,142 ecosystem · KV 통합 · LLM hallucination ·
   prompt drift" 부재)
5. 기본 감사 로그 테이블 (일시 / 작업자 / 액션 및 대상 / 변경 내역 /
   사유 / 인증) 보존
6. 필터 (기간 / 액션 / 검색) 정상 작동
7. 내보내기 버튼 3종 (간단 인쇄 / 정형 PDF / CSV) 정상 click
8. AuditLog empty 시 "감사 로그가 없습니다" empty state 표시
9. 사이드바 라벨 "감사 증적" (영문 병기 0)
10. /api/admin/operational-brief-cache-stats 직접 조회 시 cache stats
    여전히 응답 (endpoint 변경 0 확인)

## 후속 batch 후보 (호영님 결정 대기)

| § | scope | 결정 필요 |
|---|---|---|
| §11.300b | 활동 로그 → 감사 증적 데이터 연결 | event hook wiring 설계 |
| §11.300c | 캐시 통계 admin route 이전 | URL 결정 (admin/* vs settings/*) |
| §11.298f | _workbench/search/page.tsx Radix 제거 + sentinel test fix | application-wide grep 0 재완성 |
| §11.301 | dead file cleanup (components/ui/dropdown-menu.tsx + @radix-ui/react-dropdown-menu package) | §11.298f 완료 후 |
