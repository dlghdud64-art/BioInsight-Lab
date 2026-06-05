fix(api): §11.369-1 #scan-label-lock — sensitive_data_import lock 키 유니크화 + complete/fail 누락 보강

호영님 spec: scan-label 라이브 결함 2건 동시 정정. cross-user/cross-item 409 + warm 람다 후속 스캔 5분 lock 잔존을 한 batch 로.

Fix (apps/web/src/app/api/inventory/scan-label/route.ts):
- L44 targetEntityId: 'unknown' → crypto.randomUUID() (요청별 유니크).
  · 이전: 모든 scan-label 요청이 sensitive_data_import:unknown 단일 키로 묶임 →
    동시 2 user / 2 품목 스캔에서 lock 충돌 = 409.
- 성공 NextResponse return 직전 enforcement.complete() 추가.
  · 이전: complete()/fail() 부재 → 성공 스캔마다 lock 5분 잔존 → 같은 세션
    후속 스캔 결정적 409 (warm 람다 재현률 높음).
- catch 첫 줄 enforcement?.fail() 추가 (restock/route.ts L195·L202 패턴 동일).

Canonical truth 보존:
- enforceAction wiring·deny() 분기·session 가드·OCR 파이프라인·matchedProduct/
  matchedInventory·suggestions payload·error 응답 무변경.
- 외부영향 0(서버 단일 파일).

회귀 검증:
- tsc src 0
- scan-label-lock-369-1: 6/6 green (1·2 fix + 회귀 0 enforceAction/deny/action/targetEntityType)
- npm run build PASS

Production effect:
- 동시 2 스캔(다른 user / 다른 품목) 모두 200.
- 같은 세션 연속 N회 스캔 모두 200 (5분 lock 잔존 차단).
- warm 람다 결정적 409 해소.

Out of Scope:
- SmartReceivingScannerModal 클라 409 핸들링 (근원 아님, §11.369-1 제외).
- 다른 sensitive_data_import 라우트 동형 점검 — 별도 트랙.

Rollback: git revert <hash> — route 단일 파일, 3 hunk(targetEntityId·complete·fail).
