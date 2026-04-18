# LabAxis Pilot Runbook

> 파일럿 활성화부터 종료까지의 운영 절차서.
> 대상: pilot operator, release manager, ops lead.

---

## 1. 파일럿 범위 설정 기준

파일럿 범위는 Operational Readiness Gate에서 권고하는 scope를 기준으로 합니다.

**internal_only**: gate 통과 전. 내부 테스트만 가능합니다. 실제 PO 처리 불가.

**pilot_limited**: conditional_go 또는 보수적 go. PO 수량 10건 이하, 도메인 2개 이하, 기간 14일 이하로 제한합니다. 운영 중 conditional issue를 모니터링하면서 진행합니다.

**pilot_expanded**: 전체 검증 통과. PO 수량 20~50건, 도메인 3개 이상, 기간 21~30일. 주요 시나리오를 모두 커버할 수 있는 범위입니다.

### 범위 결정 시 확인 사항
- 포함 stage 목록 (quote_review ~ dispatch_prep 등)
- 활성 domain 목록
- PO 수량 상한
- 기간 (시작일 ~ 종료일)
- 참여 actor 역할 목록

---

## 2. 파일럿 활성화 절차

### Step 1: 사전 조건 확인
Operational Readiness Workbench에서 verdict가 `go` 또는 `conditional_go`인지 확인합니다. `no_go`면 blocker를 해결해야 합니다.

### Step 2: Pilot Plan 생성
Pilot Activation Workbench에서 pilot plan을 생성합니다. scope, checklist, rollback plan, monitoring config가 자동으로 채워집니다.

### Step 3: Checklist 완료
필수 체크리스트 항목을 모두 완료합니다.

- technical: role gating 설정, monitoring 연결, event bus 구독 확인
- operational: 담당자 지정, 교대 일정 확인, 에스컬레이션 경로 확인
- compliance: rollback 절차 확인, 감사 스냅샷 주기 확인
- communication: 관련 팀 공지, 공급사 대응 준비

### Step 4: Rollback Plan 확인
rollback trigger 목록과 대응 절차를 확인합니다. 권한 역할(release_manager, ops_lead)이 지정되어 있는지 확인합니다.

### Step 5: 활성화 승인
모든 checklist가 완료되면 `Activate Pilot` 버튼이 활성화됩니다. Confirmation dialog에서 최종 승인합니다.

---

## 3. 모니터링 확인 포인트

파일럿 중 매일 확인해야 할 항목입니다.

### 3.1 Runtime Signal (5분 주기)
Pilot Monitoring Workbench의 center에서 5개 signal을 확인합니다.

| Signal | 정상 | 주의 | 위험 |
|--------|------|------|------|
| RS-1 Grammar Coverage | 100 | < 90 | < 70 |
| RS-2 Hardening Pipeline | > 90 | < 80 | < 60 |
| RS-3 Event Bus Health | > 85 | < 70 | < 50 |
| RS-4 Audit/Compliance | > 80 | < 70 | < 50 |
| RS-5 Pilot Safety | > 85 | < 70 | < 50 |

### 3.2 Chain Health
QuoteChainProgressStrip에서 blocked PO가 30분 이상 지속되는지 확인합니다. 30분 초과 시 rollback trigger RBT-3이 작동합니다.

### 3.3 Compliance
컴플라이언스 스냅샷이 30분 주기로 캡처되고 있는지 확인합니다. 미준수 비율이 50%를 넘으면 rollback trigger RBT-2가 작동합니다.

### 3.4 Stale Detection
stale blocking이 지속적으로 발생하는 도메인이 있는지 확인합니다. 3개 이상 도메인에서 stale이 지속되면 rollback trigger RBT-4가 작동합니다.

---

## 4. Rollback Trigger별 대응 절차

### RBT-1: Critical Signal Breach
runtime signal 중 critical 등급 2건 이상 → rollback_required.
대응: 즉시 Monitoring Workbench에서 rollback 실행. Dashboard에서 원인 signal 확인 후 해결.

### RBT-2: Non-Compliant Surge
미준수 케이스 비율 50% 초과 → rollback_recommended.
대응: compliance 스냅샷 확인. 특정 PO/stage에 집중되어 있다면 해당 범위만 보류. 전반적이면 rollback 권고.

### RBT-3: Chain Blocked > 30min
단일 PO가 30분 이상 blocker 상태 → rollback_recommended.
대응: 해당 PO의 blocker 원인 확인. 일시적 문제(네트워크 등)이면 해결 후 계속. 구조적 문제면 rollback.

### RBT-4: Stale Blocking
3개 이상 도메인에서 stale 차단 지속 → rollback_recommended.
대응: event bus health 확인. 구독/발행 문제이면 reconnect 시도. 해결 안 되면 rollback.

### RBT-5: Irreversible Failure
irreversible action 실패 발생 → rollback_required.
대응: 즉시 rollback. 실패 원인은 사후 분석.

### RBT-6: Active Blocker Excess
활성 blocker 10건 초과 → rollback_recommended.
대응: blocker 패턴 분석. 동일 원인이면 해당 원인 해결 후 재활성화. 다양한 원인이면 rollback.

### Rollback 실행 절차
1. Monitoring Workbench dock에서 `Rollback Pilot` 클릭
2. Confirmation dialog에서 rollback 사유 입력
3. 시스템이 파일럿 비활성화 + 감사 스냅샷 캡처
4. Dashboard에 rollback 상태 반영
5. Audit Review에서 rollback 이력 확인 가능

---

## 5. 종료 판단 기준

### Pilot Complete (정상 종료)
다음 조건이 모두 충족되면 파일럿을 완료할 수 있습니다.

- 설정된 기간 도래 또는 PO 수량 상한 도달
- rollback trigger 미작동 (recommendation = none)
- 전체 PO가 정상 폐루프 완료 또는 정상 진행 중
- compliance 미준수 비율 10% 이하
- runtime signal 전체 정상

### Rollback (비정상 종료)
rollback_required 상태이면 파일럿 완료가 차단됩니다. 반드시 rollback을 실행해야 합니다.

### Cancel (취소)
파일럿 시작 전 또는 활성화 직후 취소할 수 있습니다. 진행 중인 PO에 대한 영향을 확인한 후 취소합니다.

---

## 6. 승격 경로

파일럿 결과에 따른 다음 단계입니다.

**pilot_limited → pilot_expanded**: limited 파일럿에서 모든 시나리오가 정상이면, scope를 확장하여 expanded 파일럿을 진행합니다.

**pilot_expanded → GA**: expanded 파일럿에서 충분한 기간 정상 운영이 확인되면, 전체 stage의 visibility를 `ga`로 전환하여 정식 출시합니다.

**rollback → 재평가**: rollback 후 원인 분석 → 수정 → 재검증 → 다시 pilot_limited부터 시작합니다.

---

## 7. RC0 Launch 절차 (Batch 19)

### Launch 사전 조건 5가지

1. **Scope Freeze** — RC0 Scope Freeze가 valid해야 합니다. gate verdict가 go 또는 conditional_go이고, stage/domain/PO/duration/actor가 확정되어야 합니다.

2. **Scenario Freeze** — 6가지 필수 시나리오(정상 폐루프, 공급사 변경, 입고 이상, stale, 다중 actor, 롤백)가 모두 acceptance 검증을 통과해야 합니다.

3. **Signoff Complete** — 4개 필수 역할(approver, operator_owner, rollback_owner, compliance_reviewer)이 모두 서명해야 합니다.

4. **Monitoring Configured** — Day-0 모니터링 13개 포인트가 설정되어야 합니다.

5. **Drill Passed** — 10-step 롤백 리허설이 전체 pass여야 합니다.

### RC0 Launch Workbench

Dock에서 `파일럿 시작` 클릭 시 5가지 사전 조건 전부 충족해야 버튼이 활성화됩니다. scope 변경이 필요하면 `범위 수정 (새 RC0)`로 새 RC0를 만듭니다.

---

## 8. Graduation 판정 절차 (Batch 20)

### 완료 판정 (Completion Evaluation)

파일럿 종료는 기간 만료로 판정하지 않습니다. 11개 기준으로 evidence 기반 판정합니다.

**필수 기준 (required)**: PO 처리량 ≥ 3건, 체인 완료율 ≥ 70%, 블로커율 ≤ 30%, hard blocker ≤ 2건, compliance ≥ 80%, 런타임 평균 ≥ 70, critical breach ≤ 1건, 롤백 트리거 0건, irreversible 실패 0건.

**권장 기준 (recommended)**: stale 차단 ≤ 3건, 런타임 최저 ≥ 50.

### 졸업 경로 (Graduation Path)

완료 판정 + 현재 scope + metrics로 4가지 경로 중 하나가 권고됩니다.

- **내부 유지**: evidence 부족 또는 아직 안정화 필요
- **파일럿 확장**: internal/limited에서 성공 → 범위 확대
- **GA 준비 완료**: limited/expanded에서 risk 0, compliance ≥ 90%, completion ≥ 90%
- **롤백 및 재평가**: rollback 필요 또는 취소 → remediation 후 재시작

### 재시작 절차

1. Remediation 항목 생성 (원인 분석, 재발 방지 계획 등)
2. 각 항목 completed 또는 waived 처리
3. 전부 완료 → restart_ready 상태
4. 새 RC0 생성 → Launch 절차 재진행
