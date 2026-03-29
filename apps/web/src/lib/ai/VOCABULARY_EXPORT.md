# LabAxis Vocabulary Export

> grammar registry 기반 운영 용어집.
> 코드 식별자와 운영자 화면 문구의 1:1 매핑.
> source of truth: `governance-grammar-registry.ts`

---

## 1. Stage (13단계)

| Order | Code | 약어 | 국문 라벨 | Domain | Phase | 가시성 |
|-------|------|------|-----------|--------|-------|--------|
| 0 | quote_review | 검토 | 견적 검토 | quote_chain | sourcing | ga |
| 1 | quote_shortlist | 선정 | 견적 후보 선정 | quote_chain | sourcing | ga |
| 2 | quote_approval | 견적승인 | 견적 승인 | quote_chain | approval | ga |
| 3 | po_conversion | PO전환 | 발주서 전환 | quote_chain | approval | ga |
| 4 | po_approval | PO승인 | 발주서 승인 | quote_chain | approval | ga |
| 5 | po_send_readiness | 발송준비 | 발송 준비 검증 | dispatch_prep | dispatch | ga |
| 6 | po_created | PO생성 | 발주서 생성 완료 | dispatch_prep | dispatch | ga |
| 7 | dispatch_prep | 발송검증 | 발송 전 최종 검증 | dispatch_prep | dispatch | ga |
| 8 | sent | 발송완료 | 공급사 발송 완료 | dispatch_execution | dispatch | ga |
| 9 | supplier_confirmed | 공급확인 | 공급사 확인 | supplier_confirmation | fulfillment | ga |
| 10 | receiving_prep | 입고준비 | 입고 준비 | receiving_prep | fulfillment | ga |
| 11 | stock_release | 릴리즈 | 재고 릴리즈 | stock_release | inventory | ga |
| 12 | reorder_decision | 재주문 | 재주문 판단 | reorder_decision | inventory | ga |

---

## 2. Status (47개, domain별)

### dispatch_prep (7)
| Code | 카테고리 | 국문 | Terminal | Irreversible 허용 |
|------|----------|------|----------|-------------------|
| not_evaluated | not_started | 미평가 | - | - |
| blocked | blocked | 차단됨 | - | - |
| needs_review | in_progress | 검토 필요 | - | - |
| ready_to_send | ready | 발송 가능 | - | O |
| scheduled | waiting | 발송 예약됨 | - | - |
| sent | completed | 발송 완료 | O | - |
| cancelled | cancelled | 취소됨 | O | - |

### dispatch_execution (7)
| Code | 카테고리 | 국문 | Terminal | Irreversible 허용 |
|------|----------|------|----------|-------------------|
| draft_dispatch | not_started | 초안 | - | - |
| scheduled | waiting | 예약됨 | - | - |
| queued_to_send | in_progress | 발송 대기열 | - | - |
| sending | in_progress | 발송 중 | - | - |
| sent | completed | 발송 완료 | O | - |
| send_failed | blocked | 발송 실패 | - | - |
| cancelled | cancelled | 취소됨 | O | - |

### supplier_confirmation (8)
| Code | 카테고리 | 국문 | Terminal | Irreversible 허용 |
|------|----------|------|----------|-------------------|
| awaiting_response | waiting | 응답 대기 | - | - |
| response_received | in_progress | 응답 수신 | - | - |
| confirmed | completed | 확인 완료 | O | - |
| partially_confirmed | in_progress | 부분 확인 | - | - |
| change_requested | blocked | 변경 요청 | - | - |
| rejected | completed | 거부됨 | O | - |
| expired | blocked | 만료됨 | - | - |
| cancelled | cancelled | 취소됨 | O | - |

### receiving_prep (6)
| Code | 카테고리 | 국문 | Terminal | Irreversible 허용 |
|------|----------|------|----------|-------------------|
| not_evaluated | not_started | 미평가 | - | - |
| blocked | blocked | 차단됨 | - | - |
| needs_review | in_progress | 검토 필요 | - | - |
| ready_to_receive | ready | 입고 가능 | - | O |
| scheduled | waiting | 입고 예약됨 | - | - |
| cancelled | cancelled | 취소됨 | O | - |

### receiving_execution (7)
| Code | 카테고리 | 국문 | Terminal | Irreversible 허용 |
|------|----------|------|----------|-------------------|
| awaiting_receipt | waiting | 입고 대기 | - | - |
| receiving_in_progress | in_progress | 입고 진행 중 | - | - |
| partially_received | in_progress | 부분 입고 | - | - |
| received | completed | 입고 완료 | O | - |
| discrepancy | blocked | 불일치 발생 | - | - |
| quarantined | blocked | 격리 보관 | - | - |
| cancelled | cancelled | 취소됨 | O | - |

### stock_release (6)
| Code | 카테고리 | 국문 | Terminal | Irreversible 허용 |
|------|----------|------|----------|-------------------|
| not_evaluated | not_started | 미평가 | - | - |
| evaluating | in_progress | 평가 중 | - | - |
| hold_active | blocked | 보류 활성 | - | - |
| partially_released | in_progress | 부분 릴리즈 | - | O |
| released | completed | 릴리즈 완료 | O | - |
| cancelled | cancelled | 취소됨 | O | - |

### reorder_decision (9)
| Code | 카테고리 | 국문 | Terminal | Irreversible 허용 |
|------|----------|------|----------|-------------------|
| not_evaluated | not_started | 미평가 | - | - |
| evaluating | in_progress | 평가 중 | - | - |
| watch_active | waiting | 모니터링 중 | - | - |
| reorder_recommended | in_progress | 재주문 권고 | - | - |
| reorder_required | blocked | 재주문 필수 | - | O |
| expedite_required | blocked | 긴급 발주 필요 | - | O |
| no_action | completed | 조치 불필요 | O | - |
| procurement_reentry_ready | ready | 구매 재진입 가능 | O | - |
| cancelled | cancelled | 취소됨 | O | - |

---

## 3. Status Category (7)

| Code | 국문 | 의미 |
|------|------|------|
| not_started | 미시작 | 아직 시작 안 됨 |
| in_progress | 진행 중 | 평가/검증/처리 중 |
| waiting | 대기 | 외부 입력 대기 |
| blocked | 차단 | 차단 조건 존재, action 필요 |
| ready | 준비 완료 | 다음 단계 진입 가능 |
| completed | 완료 | 이 단계 종료 |
| cancelled | 취소 | 취소됨 |

---

## 4. Blocker Severity (2)

| Code | 국문 | 색상 | Irreversible 잠금 | 확인 필요 |
|------|------|------|-------------------|----------|
| hard | 차단 | red | O | O |
| soft | 주의 | amber | - | - |

---

## 5. Unified Severity (3)

| Code | 국문 | 색상 | Stale 배너 | 최대 무효화 범위 |
|------|------|------|-----------|-----------------|
| info | 정보 | slate | info | surface_only |
| warning | 주의 | amber | warning | readiness_recompute |
| critical | 심각 | red | blocking | handoff_invalidate |

"error"는 severity가 아닙니다. 시스템 예외는 Error Boundary에서 처리.

---

## 6. Panel (11)

| Panel ID | 국문 | Domain | 우선순위 |
|----------|------|--------|---------|
| send_blocked | 발송 차단 | dispatch_prep | 1 |
| receiving_blocked | 입고 차단 | receiving_prep | 2 |
| stock_release_blocked | 릴리즈 차단 | stock_release | 3 |
| receiving_discrepancy | 입고 불일치 | receiving_execution | 4 |
| reorder_required | 재주문 필요 | reorder_decision | 5 |
| supplier_change_requested | 공급사 변경 요청 | supplier_confirmation | 6 |
| supplier_response_pending | 공급사 응답 대기 | supplier_confirmation | 7 |
| send_scheduled | 발송 예정 | dispatch_prep | 8 |
| reorder_watch | 모니터링 중 | reorder_decision | 9 |
| procurement_reentry | 구매 재진입 대기 | reorder_decision | 10 |
| chain_health | 체인 건강도 | quote_chain | 11 |

---

## 7. Dock Action (주요 26개)

### dispatch_prep
| Action Key | 국문 | 위험도 | Stale 차단 | 확인 필요 |
|-----------|------|--------|-----------|----------|
| send_now | 지금 발송 | irreversible | O | O |
| schedule_send | 발송 예약 | safe | - | - |
| request_correction | 수정 요청 | safe | - | - |
| reopen_po_conversion | PO 전환 재개방 | reversible | O | O |
| cancel_dispatch_prep | 발송 준비 취소 | irreversible | O | O |

### dispatch_execution
| Action Key | 국문 | 위험도 | Stale 차단 | 확인 필요 |
|-----------|------|--------|-----------|----------|
| execute_send | 발송 실행 | irreversible | O | O |
| cancel_send | 발송 취소 | reversible | - | O |
| retry_send | 발송 재시도 | safe | - | - |

### supplier_confirmation
| Action Key | 국문 | 위험도 |
|-----------|------|--------|
| accept_response | 응답 수락 | irreversible |
| reject_response | 응답 거부 | irreversible |
| request_change | 변경 요청 | safe |
| cancel_confirmation | 확인 취소 | irreversible |

### receiving / stock / reorder
| Action Key | 국문 | 위험도 |
|-----------|------|--------|
| confirm_receipt | 입고 확인 | irreversible |
| cancel_receiving | 입고 취소 | irreversible |
| release_stock | 재고 릴리즈 | irreversible |
| partial_release | 부분 릴리즈 | irreversible |
| cancel_release | 릴리즈 취소 | irreversible |
| require_reorder | 재주문 필요 | irreversible |
| require_expedite | 긴급 발주 | irreversible |
| mark_no_action | 조치 불필요 | irreversible |
| procurement_reentry | 구매 재진입 | irreversible |
| cancel_reorder | 재주문 취소 | irreversible |

---

## 8. Governance Domain (8)

| Code | 국문 | 범위 |
|------|------|------|
| quote_chain | 견적 체인 | 견적 검토 → PO 전환 |
| dispatch_prep | 발송 준비 | PO 생성 → 발송 가능 |
| dispatch_execution | 발송 실행 | 발송 예약 → 발송 완료 |
| supplier_confirmation | 공급사 확인 | 발송 완료 → 확인 완료 |
| receiving_prep | 입고 준비 | 확인 완료 → 입고 가능 |
| receiving_execution | 입고 실행 | 입고 시작 → 입고 완료 |
| stock_release | 재고 릴리즈 | 입고 완료 → 릴리즈 완료 |
| reorder_decision | 재주문 판단 | 릴리즈 → 재주문/불필요 |

---

## 9. Phase (5)

| Code | 국문 | 포함 Stage |
|------|------|-----------|
| sourcing | 소싱 | quote_review, quote_shortlist |
| approval | 승인 | quote_approval, po_conversion, po_approval |
| dispatch | 발송 | po_send_readiness, po_created, dispatch_prep, sent |
| fulfillment | 이행 | supplier_confirmed, receiving_prep |
| inventory | 재고 | stock_release, reorder_decision |

---

## 10. Operational Gate Category (7)

| Code | 국문 | 검증 대상 |
|------|------|----------|
| structure_integrity | 구조 무결성 | release readiness + product acceptance |
| runtime_health | 런타임 건강도 | 5 runtime signal |
| mutation_safety | 변경 안전성 | hardening pipeline + irreversible protection |
| pilot_safety | 파일럿 안전성 | checklist + rollback + role gating |
| observability | 관측 가능성 | audit log + compliance + reporting |
| operational_continuity | 운영 연속성 | reconnect + replay + persistence |
| scope_control | 범위 통제 | PO/domain/duration/stage/role 범위 |

---

## 11. Verdict / Scope / Confidence

### Operational Verdict
| Code | 국문 | 의미 |
|------|------|------|
| go | Go | 전체 검증 통과, 활성화 가능 |
| conditional_go | Conditional Go | 조건부 통과, 제한적 활성화 |
| no_go | No-Go | 미통과, blocker 해소 필요 |

### Activation Scope
| Code | 국문 | 의미 |
|------|------|------|
| internal_only | 내부 전용 | gate 통과 전 내부 테스트만 |
| pilot_limited | 제한 파일럿 | PO 10건 이하, 도메인 2개 이하 |
| pilot_expanded | 확장 파일럿 | PO 20~50건, 도메인 3개 이상 |
| hold | 보류 | blocker 미해소, 활성화 불가 |

### Rollback Recommendation
| Code | 국문 | 의미 |
|------|------|------|
| none | 정상 | trigger 미작동 |
| watch | 주시 필요 | warning trigger 작동 |
| rollback_recommended | 롤백 권고 | critical 1건 또는 warning 다수 |
| rollback_required | 롤백 필수 | critical 2건 이상 |

### Rollback Confidence
| Code | 국문 | 조건 |
|------|------|------|
| high | 높음 | role + steps + triggers + fresh signals |
| medium | 보통 | role + triggers 존재 |
| low | 낮음 | 부분적 준비 |
| unknown | 알 수 없음 | pilot plan 없음 |

---

## 12. Naming Rules (불변)

1. status 이름은 "현재 무엇인가"로 — 동사형 금지 (진행상태 예외)
2. action 이름은 "무엇을 하라"로 — 명사형 금지
3. panel 이름은 "무엇이 막혀있다/대기중이다"로 — 과거형 금지
4. severity는 3단계만: info / warning / critical
5. blocker severity는 2단계만: hard / soft

---

## 13. Pilot Lifecycle Actions (11개, Batch 19-20)

### Launch (5)
| Action Key | 국문 | Lifecycle | 위험도 | 확인 필요 |
|-----------|------|-----------|--------|----------|
| launch_pilot | 파일럿 시작 | launch | irreversible | O |
| conduct_drill | 롤백 리허설 실행 | launch | reversible | O |
| modify_scope | 범위 수정 (새 RC0) | launch | reversible | O |
| export_launch_pack | 런치 팩 내보내기 | launch | navigation | - |
| cancel_rc0 | RC0 취소 | launch | irreversible | O |

### Graduation (6)
| Action Key | 국문 | Lifecycle | 위험도 | 확인 필요 |
|-----------|------|-----------|--------|----------|
| mark_completed | 파일럿 완료 확정 | graduation | irreversible | O |
| expand_pilot | 파일럿 확장 | graduation | irreversible | O |
| approve_ga | GA 승인 | graduation | irreversible | O |
| rollback_and_reassess | 롤백 및 재평가 | graduation | irreversible | O |
| cancel_pilot | 파일럿 취소 | graduation | irreversible | O |
| export_graduation_pack | 졸업 팩 내보내기 | graduation | navigation | - |

---

## 14. Completion Verdict (5종, Batch 20)

| Code | 국문 | 색상 | 의미 |
|------|------|------|------|
| completed_successfully | 성공적 완료 | green | required 전부 충족 |
| completed_conditionally | 조건부 완료 | amber | required 70% 이상 |
| rollback_required | 롤백 필요 | red | 트리거 활성 또는 기준 미달 |
| cancelled | 취소됨 | gray | 운영자에 의해 취소 |
| insufficient_evidence | Evidence 부족 | blue | PO 3건 미만 또는 기간 50% 미경과 |

---

## 15. Graduation Path (4종, Batch 20)

| Code | 국문 | 색상 | 의미 |
|------|------|------|------|
| remain_internal_only | 내부 유지 | gray | evidence 부족, 안정화 필요 |
| expand_pilot | 파일럿 확장 | blue | 범위 확대 |
| ready_for_ga | GA 준비 완료 | green | risk 0, compliance ≥ 90%, completion ≥ 90% |
| rollback_and_reassess | 롤백 및 재평가 | red | remediation 후 재시작 |

---

## 16. Restart Status (4종, Batch 20)

| Code | 국문 | 의미 |
|------|------|------|
| rolled_back | 롤백됨 | 파일럿 롤백 완료 |
| reassess_required | 재평가 필요 | remediation 항목 미착수 |
| remediation_in_progress | 개선 진행 중 | remediation 일부 진행 중 |
| restart_ready | 재시작 가능 | 전부 completed/waived → 새 RC0 생성 가능 |
6. 국문 label은 operator 관점 — 개발자 용어 금지
7. terminal status는 domain별 명시적 배열
8. "ready" prefix = "다음 단계 진입 가능" (완료와 구분)
