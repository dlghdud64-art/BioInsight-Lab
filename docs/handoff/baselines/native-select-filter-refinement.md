# native-select 필터 정제 — 오탐 근거 (2026-08-19)

**규율**: 정제 전후 목록을 파일로 남기고 diff. **빠진 건마다 오탐 근거를 개별 기재.**
그게 없으면 위반 수 감소가 **필터 개선인지 위반 해소인지 구분이 안 된다.**

```
정제 전  13건   native-select-before.txt
정제 후   9건   native-select-after.txt
차이      4건   전부 오탐 — 소스는 한 줄도 안 고쳤다
```

## 빠진 4건 — 개별 근거

| 경로:줄 | 실제 내용 | 오탐 사유 |
|---|---|---|
| `__tests__/organizations/org-list-redesign-p2.test.ts:27` | `expect(PAGE).not.toMatch(/<select\s+id="org-type"/)` | **금지 단언**이다. 게이트가 자기 감시자를 위반으로 신고했다 |
| `components/receiving/__tests__/receiving-post-modal.test.ts:23` | `expect(src).not.toMatch(/<select/)` | 동상 |
| `components/receiving/__tests__/receiving-post-v2.test.ts:33` | `expect(src).not.toMatch(/<select/)` | 동상 |
| `app/dashboard/organizations/page.tsx:409` | `복귀 + 조직 유형 필드만 native <select> 로 swap (전역 영향 0). */}` | **여러 줄 JSX 주석의 끝 줄**. 기존 필터는 줄머리 `//`·`*` 만 걸러 중간·끝 줄을 못 봤다 |

🛑 **셋은 sentinel, 하나는 주석.** 소스 코드의 실제 `<select` 사용은 **한 건도 안 빠졌다.**

## 필터 변경

```
① rg glob 제외   --glob '!**/__tests__/**' · '!**/*.test.ts' · '!**/*.test.tsx'
② 주석 보강      | grep -vF '*/'  |  grep -vF '{/*'
```

⚠️ **수용한 한계**: 실 `<select` 줄에 `*/` 가 함께 오면 이 필터가 놓친다.
   그런 줄은 실측 0건이고, 잡으려면 줄 단위 필터로는 안 되고 상태 기계가 필요하다
   (`__tests__/_helpers/em-dash-scan.ts` 수준). 지금은 **한계를 적고 수용**한다.

## 프로브 (러너 = bash · ripgrep 15.2.0)

```
baseline                              9건
① 일반 .tsx 에 실 위반 주입   → 10건   ✅ 검출력 유지
② __tests__ 에 주입          →  9건   ✅ 정당한 제외
③ JSX 주석에 언급            →  9건   ✅ 정당한 제외
원복                                  9건   ✅
```

## 🛑 내 이전 수치 정정

`2007d9a6` · `4f4cc5bd` 에 **"실 위반 ~8건"** 으로 적었다. 실제는 **9건**이다.
당시 오탐을 "테스트 4 · 주석 1 = 5" 로 셌는데 테스트는 **3건**이었다(13 − 4 = 9).
🛑 `~` 를 붙여 어림수로 적은 것이 검증을 미루게 했다. **세지 않은 수는 적지 않는다.**

## 다음 — 실 위반 9건은 제품 트랙

```
app/_workbench/search/page.tsx:1109
app/dashboard/settings/suppliers/page.tsx:752
app/legal/page.tsx:263
app/pricing/page.tsx:455
app/protocol/bom/page.tsx:890
components/quotes/dispatch/batch-dispatch-sheet.tsx:368
components/quotes/dispatch/batch-reminder-sheet.tsx:375
components/receiving/receiving-desktop-list.tsx:216
components/safety/MsdsBulkRegisterModal.tsx:157
```

§11.75 native `<select>` 금지 위반. **필터 정제(이 트랙)와 분리**해서 착수한다.
