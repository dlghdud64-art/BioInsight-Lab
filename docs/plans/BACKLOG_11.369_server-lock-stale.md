# BACKLOG — §11.369 서버 lock stale (cold-kill 미해제) 근본

- **상태:** 백로그(별도 트랙) · 클라 트랙(§11.369-1)과 분리
- **작성:** 2026-06-07
- **성격:** canonical 보호 영역 — 서버 동시성 lock 본질. 신중 설계 필요.

---

## 근본 문제

`lib/security/mutation-replay-guard.ts` 의 동시성 lock(`ACTIVE_MUTATIONS`, key=`action:targetEntityId`, TTL 5분)은 **프로세스 인메모리**다.

- `beginMutation` 으로 lock 획득 후 람다가 **timeout/OOM/cold-kill** 되면 `completeMutation`/`failMutation`(L309/332)이 실행되지 못해 **그 인스턴스에 ≤5분 stale lock 잔존**.
- per-lambda-memory라 재시도가 같은 인스턴스면 409, 다른 인스턴스면 성공 → **간헐 409**.
- 클라는 stale 여부를 식별할 수 없어(멱등 소유자 토큰 없음) 근본 해소 불가 → 클라는 증상완화만.

## 후보 해법 (택1/조합, 신중 검토)

1. **TTL 단축** — 5분 → 예: 60~90초. 가장 단순하나 정당한 장기 작업의 false-positive 동시성 차단 위험(trade-off).
2. **해제 보장 강화** — route handler `finally`에서 항상 `failMutation`, + 서버측 주기 sweep. cold-kill(프로세스 강제종료)은 finally도 못 도므로 완전 해소는 아님.
3. **멱등 소유자 토큰** — lock에 owner idempotencyKey 저장. 같은 키 재요청은 "내 lock 재진입"으로 통과 허용(중복 실행은 fingerprint가 별도 차단). cold-kill 후 같은 키 재시도 = 즉시 통과. **가장 근본적이나 서버 계약 변경 + 클라 멱등키 전송 필요.**
4. **분산 lock 외부화** — 인메모리 → Redis/DB advisory lock(TTL+소유자). 인스턴스 간 일관성 확보. 비용/인프라 추가.

## 경계

- 이 트랙은 canonical truth(동시성 계약) 변경 → **dry-run → 평이한 한국어 보고 → "진행" 후 apply**(호영님 통제구조).
- 클라 트랙(§11.369-1)은 이 백로그와 독립적으로 선행 가능(증상완화).
- 우선순위: 라이브에서 stale-409 실제 빈도 측정 후 판단(현재 빈도 미측정 — 측정 선행 권장).

## 선행 측정 (권장 first step)
- enforceAction 409 발생 로그/correlationId 집계 → 실제 cold-kill stale 비율 vs 정당 동시성 비율 분리. 빈도 낮으면 클라 증상완화로 충분, 높으면 3/4번 투자.

---

## 결정적 재현 사례 (2026-08-14, §tenant-isolation 4-3 1단계 부수 발견)

**cold-kill 이 아니라 정상 경로에서 난다.**

`PUT /api/quote-lists/[id]` — `enforceAction` 이 lock 을 잡은 뒤,
대상 미발견 시 `enforcement.fail()` 없이 조기 반환한다:

```ts
if (!existing) {
  return NextResponse.json({ error: "Not Found" }, { status: 404 });  // ← lock 미해제
}
```

재현(서버 재시작 직후):
```
1회차  PUT /api/quote-lists/{타인 소유 id}  → 404
2회차  동일 요청                              → 409 "처리 중인 동일 요청이 있습니다"
       이후 재시작 전까지 409 고정
```

→ 후보 해법 **2(해제 보장 강화)** 를 뒷받침한다. cold-kill 전용 문제가 아니라
**조기 반환 경로 전수**가 대상이라는 뜻이다. §enforcement-handle-close-sweep 과 같은 표면.

기록만 — 테넌트 축 아님, 이번 트랙에서 수정하지 않는다.
