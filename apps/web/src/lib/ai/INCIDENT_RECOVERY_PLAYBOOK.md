# LabAxis Incident / Recovery Playbook

> 운영 중 발생할 수 있는 장애 상황별 대응 절차서.
> 대상: pilot operator, ops lead, on-call engineer.

---

## 1. Stale Blocking 장기 지속

### 증상
workbench에 stale 배너가 표시되고 refresh 후에도 해제되지 않음. dock의 irreversible action이 계속 잠겨 있음.

### 원인 후보
- event bus 구독 누락: 해당 domain의 subscriber가 등록되지 않음
- invalidation rule 미작동: 트리거 이벤트가 발행되었으나 invalidation이 실행되지 않음
- 데이터 변경이 실제로 진행 중: 다른 actor가 같은 PO를 수정 중

### 대응 절차
1. Monitoring Workbench에서 RS-3 Event Bus Health 점수 확인
2. event bus subscriber count가 예상치(8)와 일치하는지 확인
3. 해당 domain의 stale detection이 활성화되어 있는지 확인
4. 다른 actor의 동시 작업이 있는지 concurrency guard 로그 확인
5. 해결: 구독 재등록 또는 해당 PO의 context refresh 실행
6. 5분 내 해결 안 되면: 해당 PO를 workbench에서 닫고 re-entry

### 에스컬레이션
30분 이상 지속 시 RBT-3 trigger 확인. 파일럿 중이면 rollback 판단.

---

## 2. Missed Event / Replay 실패

### 증상
PO 상태가 변경되었으나 workbench에 반영되지 않음. 또는 연결 끊김 후 reconnect는 되었으나 이전 이벤트가 누락됨.

### 원인 후보
- reconnect 후 replay window 초과: 이벤트가 retention 기간을 넘김
- event bus history가 clear됨
- 이벤트 발행 자체가 누락됨 (엔진 오류)

### 대응 절차
1. event bus history에서 해당 PO의 최근 이벤트 확인
2. 누락된 이벤트가 있는지 시간순으로 추적
3. 해결 A: 이벤트가 history에 있으면 manual replay 실행
4. 해결 B: 이벤트 자체가 없으면 해당 engine의 상태를 직접 확인하고 context refresh
5. 감사 로그에 "event gap detected" 기록

### 에스컬레이션
같은 PO에서 2회 이상 반복 시 event bus wiring 점검 필요.

---

## 3. Concurrency Lock Stuck

### 증상
"다른 사용자가 작업 중입니다" 메시지가 표시되고 해제되지 않음. 실제로는 아무도 작업하고 있지 않음.

### 원인 후보
- 이전 사용자의 세션이 비정상 종료됨 (브라우저 닫힘, 네트워크 끊김)
- lock timeout이 아직 만료되지 않음
- idempotency guard가 이전 요청을 중복으로 판단

### 대응 절차
1. lock 상태의 PO 번호와 lock 보유자 확인
2. 해당 사용자에게 세션 종료 여부 확인
3. lock timeout 대기 (보통 5분)
4. timeout 후에도 해제되지 않으면: 관리자 권한으로 강제 lock 해제
5. 해제 후 idempotency guard reset 실행

### 주의
강제 lock 해제는 데이터 불일치 위험이 있으므로 반드시 해당 PO의 현재 상태를 먼저 확인하세요.

---

## 4. Compliance Snapshot 누락

### 증상
Monitoring Workbench rail에서 "컴플라이언스 스냅샷 없음" 또는 "24시간 이상 경과" 경고가 표시됨.

### 원인 후보
- compliance snapshot store가 비가용 상태
- periodic 캡처 스케줄이 중단됨
- event-driven 캡처 trigger가 누락됨

### 대응 절차
1. Operational Readiness에서 OB-2 (컴플라이언스 스냅샷 불가) 상태 확인
2. compliance snapshot store 가용성 확인
3. periodic 캡처 설정 (30분 간격) 확인
4. 수동으로 즉시 스냅샷 캡처 실행
5. 자동 캡처 복원 확인

### 에스컬레이션
store 자체가 불가하면 observability category blocker → operational gate no_go.

---

## 5. Decision Log / Audit Discrepancy

### 증상
audit review에서 decision log와 실제 PO 상태가 불일치. 예: log에는 "approved"인데 PO는 "blocked" 상태.

### 원인 후보
- approval 후 snapshot invalidation이 발생했으나 log에 반영되지 않음
- reopen 이후 기존 decision log가 갱신되지 않음
- 동시 수정으로 인한 race condition

### 대응 절차
1. 해당 PO의 전체 event history 추출
2. decision log와 event history 시간순 비교
3. invalidation 이벤트가 누락되었는지 확인
4. 불일치 원인 식별 후 compliance snapshot에 기록
5. 필요 시 해당 PO의 현재 상태를 기준으로 log 보정

### 주의
log 보정은 감사 추적을 위해 "correction" 유형으로 별도 기록해야 합니다. 기존 log를 직접 수정하지 마세요.

---

## 6. Pilot Rollback Required 상황 대응

### 증상
Monitoring Workbench에 "롤백 필수" 배지가 표시됨. complete 버튼이 비활성화됨.

### 원인
rollback trigger 중 critical 2건 이상 적중 또는 irreversible failure 발생.

### 대응 절차
1. 적중된 trigger 목록 확인 (center에 표시)
2. 각 trigger의 원인 분석 (rail의 critical issues 참조)
3. 운영 팀에 rollback 실행 사전 공지
4. dock에서 `Rollback Pilot` 클릭 → confirmation dialog
5. rollback 사유를 상세히 입력
6. 시스템이 자동으로: 파일럿 비활성화 + 감사 스냅샷 캡처 + dashboard 반영
7. 진행 중이던 PO들의 상태 확인: blocked 상태가 아닌 PO는 기존 flow로 계속 처리 가능

### 사후 조치
1. Audit Review에서 rollback 이력 확인
2. 원인 trigger별 근본 원인 분석
3. 수정 후 전체 acceptance 재검증
4. Operational Readiness Gate 재평가
5. pilot_limited부터 다시 시작

---

## 7. Full Refresh vs Stay vs Return to Panel 기준

### Full Refresh
event bus 자체가 불안정하거나 stale detection이 전혀 작동하지 않을 때. 전체 workbench context를 처음부터 다시 로드합니다.

### Stay (현재 화면 유지)
일시적인 경고 (soft blocker, warning signal)이면 현재 화면에서 작업을 계속합니다. Rail의 경고 메시지를 참고하면서 진행합니다.

### Return to Panel (상위 화면으로)
해당 PO의 reopen이 필요하거나, 다른 PO로 전환해야 할 때. Breadcrumbs를 통해 dashboard 또는 inbox로 돌아갑니다.

### 판단 기준

| 상황 | 조치 |
|------|------|
| stale 배너 + refresh 성공 | Stay |
| stale 배너 + refresh 실패 | Full refresh |
| hard blocker 발생 | Stay (blocker 해결 시도) |
| reopen 필요 | Return to panel → reopen workbench |
| event bus 이상 | Full refresh |
| concurrency block | 대기 또는 return to panel |
