fix(quotes) §11.363 #followup-send-wiring — "추가 회신 확보" dead button → 추가 발송 라우팅 (호영님 P-라이브)

호영님 spec: 견적 관리 "추가 회신 확보" 클릭 무반응 = dead button.

root cause: "추가 회신 확보"/재요청 클릭 액션이 activeWorkWindow 라우팅에서
followup_send intent로 매핑되지 않아 work-window 진입 0 → onClick state 세팅만,
UI 반응 0.

Fix (apps/web/src/app/dashboard/quotes/page.tsx):
- onClick 핸들러에서 followup_send intent를 명시 라우팅.
- activeWorkWindow === "followup_send" 분기 추가 → 추가 발송 work-window 노출.

canonical truth 보존: 견적 데이터·발송 mutation·기존 라우팅 분기(intake/compare 등) 무변경. UI surface만 wiring 추가.

production effect: "추가 회신 확보" 클릭 → followup_send work-window 진입 → 추가 발송 path 동작. dead button 해소.

Out of scope: 추가 발송 mutation 자체 변경 / 다른 dead button — 별도 트랙.

Rollback: quotes/page.tsx onClick 분기 1줄 + activeWorkWindow followup_send 분기 revert.
