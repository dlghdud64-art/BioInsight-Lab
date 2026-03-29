# LabAxis Operator Guide

> 일일 운영자를 위한 워크벤치 사용 가이드.
> 대상: 연구 구매 운영팀 (procurement operator, reviewer, manager).

---

## 1. 일일 운영 흐름

운영자의 하루는 다음 순서로 진행됩니다.

**Dashboard 확인** → Governance Dashboard에서 전체 체인 상태를 확인합니다. KPI, bottleneck, domain별 blocker를 확인하고, 조치가 필요한 PO를 식별합니다.

**Inbox 처리** → Approval Inbox에서 대기 중인 승인 요청을 처리합니다. 우선순위가 자동으로 매겨져 있으므로 상위부터 처리합니다.

**Workbench 작업** → 각 PO의 현재 stage에 맞는 workbench에서 실제 판단과 action을 수행합니다.

**Audit 확인** → 처리한 건들의 감사 로그와 컴플라이언스 상태를 확인합니다.

---

## 2. Workbench 구조 원칙

모든 workbench는 동일한 3-zone 구조를 따릅니다.

**Center** — 판단 영역입니다. 현재 상태, blocker, readiness, delta 요약을 보여줍니다. 여기서 "무엇이 문제이고 다음에 무엇을 해야 하는지"를 파악합니다.

**Rail** — 맥락 영역입니다. 승인 사유, 견적 비교 맥락, 공급사 프로필, snapshot 유효성 설명 등 판단에 필요한 참고 자료를 보여줍니다. Rail은 정보만 제공하며 action을 실행하지 않습니다.

**Dock** — 실행 영역입니다. Send now, Schedule send, Request correction, Reopen 등 실제 action 버튼이 여기에 있습니다. Irreversible action은 확인 dialog가 표시됩니다.

---

## 3. Stale / Blocker / Conditional / No-Go 해석

### Stale 상태
화면에 stale 배너가 표시되면 데이터가 최신이 아닙니다. 다른 사용자가 같은 PO를 수정했거나, 공급사 정보가 변경되었거나, 승인 스냅샷이 무효화되었을 수 있습니다. Refresh를 눌러 최신 상태로 갱신하세요. Stale 상태에서는 Send now 같은 돌이킬 수 없는 action이 잠깁니다.

### Blocker
빨간색으로 표시되는 hard blocker는 해결하기 전까지 다음 단계로 진행할 수 없습니다. 대표적인 blocker는 다음과 같습니다.

- snapshot invalidated: 승인 후 데이터가 변경되었습니다. PO conversion을 다시 열어야 합니다.
- supplier mismatch: 공급사 정보가 발송 준비 시점과 달라졌습니다.
- required terms missing: 결제 조건, 배송 조건 등 필수 상업 조건이 빠져 있습니다.
- billing/shipping incomplete: 청구지 또는 배송지 정보가 불완전합니다.
- required document missing: 필수 첨부 문서가 빠져 있습니다.
- policy hold active: 정책에 의해 보류 상태입니다.

### Conditional (경고)
노란색으로 표시되는 soft warning은 진행은 가능하지만 주의가 필요합니다. 운영자의 판단에 따라 진행하거나, 수정 후 진행할 수 있습니다.

### No-Go (운영 게이트)
Operational Readiness Workbench에서 no_go가 표시되면 파일럿을 켤 수 없습니다. blocker 목록을 확인하고 해결한 후 다시 평가하세요. score가 높아도 blocker가 1건이라도 있으면 go가 나오지 않습니다.

---

## 4. Irreversible Action 원칙

돌이킬 수 없는 action들은 특별한 보호를 받습니다.

- Send now (발송): 실제 공급사에게 PO를 전송합니다. 확인 dialog + role 검증 후 실행됩니다.
- Go 승인: 파일럿 활성화를 최종 승인합니다.
- Rollback 실행: 파일럿을 되돌립니다.

이 action들은 다음 조건이 모두 충족되어야 활성화됩니다: (1) 모든 hard blocker 해소, (2) snapshot validity 통과, (3) 해당 role 보유, (4) 확인 dialog에서 명시적 승인.

---

## 5. Reopen / Retry / Rollback 판단 기준

### Reopen (재개방)
PO conversion이나 dispatch prep 단계에서 문제가 발견되면 이전 단계를 다시 열 수 있습니다. Reopen은 해당 surface만 갱신하며 전체를 초기화하지 않습니다 (targeted invalidation).

### Retry (재시도)
발송 실패, 네트워크 오류 등에서 같은 action을 다시 시도합니다. Idempotency guard가 있어 중복 실행을 방지합니다.

### Rollback (되돌림)
파일럿 중 심각한 문제가 발생하면 rollback을 실행합니다. Rollback trigger가 자동으로 감지하며, 권고 수준에 따라 watch → rollback_recommended → rollback_required로 상승합니다. rollback_required 상태에서는 파일럿 완료가 차단됩니다.

---

## 6. Panel Priority 해석

Dashboard에 여러 패널이 표시될 때, 다음 순서로 주의를 기울이세요.

1. Blocker 패널: 즉시 조치 필요한 항목
2. Bottleneck 패널: 가장 많은 PO가 멈춰 있는 지점
3. KPI 패널: 전체 처리 속도와 건강도
4. Domain 패널: 도메인별 상세 상태

---

## 7. Chain Health 해석

QuoteChainProgressStrip에서 각 stage의 상태를 한눈에 볼 수 있습니다.

- 녹색: 완료 또는 정상 진행
- 노란색: 경고 또는 검토 필요
- 빨간색: 블록됨 또는 실패
- 회색: 아직 도달하지 않음

pilot 모드에서는 일부 stage가 숨겨질 수 있습니다. 이는 해당 stage가 아직 파일럿 범위에 포함되지 않았기 때문입니다.

---

## 8. RC0 Launch 운영 (Batch 19)

파일럿 시작 전에 RC0 Pilot Launch Workbench에서 5가지 사전 조건을 확인합니다.

**Scope Freeze** — stage, domain, PO 한도, 기간, actor 역할이 확정됩니다. 확정 후 변경하려면 새 RC0를 만들어야 합니다.

**Scenario Freeze** — 6가지 검증 시나리오(정상 폐루프, 공급사 변경, 입고 이상, stale/reconnect, 다중 actor, 롤백)가 고정됩니다. 모든 시나리오가 acceptance 검증을 통과해야 합니다.

**Signoff Registry** — 승인자, 운영 오너, 롤백 오너, 컴플라이언스 검토자, 에스컬레이션 담당자 5개 역할을 지정합니다. 4개 필수 역할이 모두 서명해야 launch 가능합니다.

**Rollback Drill** — 10단계 롤백 리허설을 실행합니다. 전체 pass여야 launch 가능합니다. fail/partial이면 이슈를 해결한 후 재실행합니다.

**Day-0 Monitoring** — 13개 모니터링 포인트가 6개 카테고리(runtime signal, chain health, stale, irreversible, rollback, compliance)로 설정됩니다. launch 당일부터 이 기준으로 운영 상태를 추적합니다.

---

## 9. Pilot Graduation 운영 (Batch 20)

파일럿 종료는 기간 만료가 아니라 evidence 기반 판정입니다.

**Completion Evaluation** — 11개 기준(PO 처리량, 체인 완료율, 블로커율, compliance 준수율, 런타임 안정성, 롤백 트리거, irreversible 실패 등)으로 판정합니다. 5가지 판정: 성공적 완료, 조건부 완료, 롤백 필요, 취소, evidence 부족.

**Graduation Path** — 판정 결과에 따라 4가지 경로 중 하나가 권고됩니다: 내부 유지, 파일럿 확장, GA 준비 완료, 롤백 및 재평가. 경로 결정은 현재 scope + metrics + compliance + risk를 종합합니다.

**GA 승인** — irreversible에 준하는 판단입니다. release_manager + compliance_reviewer 역할이 필요하며, blocker가 있으면 GA 승인이 차단됩니다.

**Rollback 후 재시작** — 롤백 후 즉시 재시작은 금지됩니다. remediation 항목(원인 분석, 재발 방지 계획 등)이 모두 완료/면제되어야 restart_ready 상태가 됩니다. 재시작은 새 RC0를 만들어 진행합니다.
