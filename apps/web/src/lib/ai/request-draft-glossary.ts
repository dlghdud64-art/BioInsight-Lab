/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Request Draft AI — Domain Glossary & Module Index
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * ## Domain Glossary
 *
 * **current context**
 *   현재 active supplier draft의 canonical context.
 *   contextHash + draftFingerprint로 식별.
 *   supplier/assembly/draft 상태가 바뀌면 context도 바뀜.
 *
 * **representative**
 *   current contextKey를 대표하는 request_draft suggestion entity.
 *   contextKey당 최대 1개. candidate store의 byContextKey 인덱스로 조회.
 *
 * **active suggestion**
 *   representative 중 현재 surface에 올릴 수 있는 suggestion.
 *   gate visible + status generated + preview > 0 조건 충족해야 함.
 *   activeSuggestionId는 이 결과의 derived mirror.
 *
 * **resolution**
 *   accepted / dismissed / edited / noop 같은 lifecycle 사건 기록.
 *   resolutionLog에 supplier-local로 누적.
 *   동일 contextHash 재노출 차단의 근거.
 *
 * **generation baseline**
 *   regeneration suppression 기준점.
 *   supplier-local로 최신 1개 유지.
 *   source별(accepted/dismissed/edited/noop) threshold 차등 적용.
 *   comparable payload 포함하여 category-aware meaningful change 판단 가능.
 *
 * **surface model**
 *   UI가 직접 소비하는 request_draft suggestion view-model.
 *   suggestion + previewItems + actionability + reviewIntent + statusEcho + density.
 *   component는 이 model만 읽고 렌더. raw store truth 직접 접근 금지.
 *
 * **generation eligibility**
 *   새 suggestion generation이 가능한지 판단하는 canonical selector.
 *   quiet period + meaningful change + baseline distance + cooldown + inflight dedupe.
 *
 * **orchestration**
 *   사건별 후처리 순서를 고정하는 조정층.
 *   새 truth를 만들지 않음. primitive 호출 순서만 정리.
 *
 * ## Naming Conventions
 *
 * - Reducer/Action: domain event 중심
 *   - recordRequestDraftSuggestionAccepted (O)
 *   - setSuggestionData (X)
 *
 * - Selector: 계산 결과 중심
 *   - selectRequestDraftActiveSuggestion (O)
 *   - selectData (X)
 *
 * - UI props: rendering intent 중심
 *   - suggestion, previewItems, actionability (O)
 *   - contextHash, draftFingerprint, requestId (X)
 *
 * - UI labels: supplier request assembly 언어
 *   - 요청 초안 제안 / 적용 / 나중에 / 검토 (O)
 *   - noop / resolved / inflight / hash (X)
 *
 * ## Internal → UI Vocabulary Boundary
 *
 * | Internal (store/util 내부) | UI (surface/label/props) |
 * |---------------------------|-------------------------|
 * | contextHash               | (노출 금지)              |
 * | draftFingerprint           | (노출 금지)              |
 * | requestId                  | (노출 금지)              |
 * | inflight                   | (노출 금지)              |
 * | byContextKey               | (노출 금지)              |
 * | noop                       | (노출 금지)              |
 * | replace/toggle/merge/append| 보강/포함/추가 예정/조정  |
 * | resolution                 | (노출 금지)              |
 * | baseline                   | (노출 금지)              |
 * | representative             | (노출 금지)              |
 *
 * ## Module Map
 *
 * | Module                          | Responsibility                              |
 * |---------------------------------|---------------------------------------------|
 * | request-draft-patch             | SupplierRequestDraft type + field patch      |
 * | request-draft-diff              | canonical diff + effective preview           |
 * | request-draft-action-gate       | unified actionability + gate selector        |
 * | request-draft-status-echo       | supplier-local status chip selector          |
 * | request-draft-header-density    | header spacing based on surface state        |
 * | request-suggestion-store        | suggestion state + resolution log            |
 * | request-candidate-store         | contextKey index + dedupe + cleanup + prune  |
 * | request-active-suggestion-selector | selector chain + surface model            |
 * | request-edit-activity           | supplier-local edit timestamp tracking       |
 * | request-meaningful-change       | category-aware generation value judgment     |
 * | request-generation-eligibility  | unified generation guard                     |
 * | request-generation-cooldown     | time-based suppress layer                    |
 * | request-generation-inflight     | async dedupe + stale result discard          |
 * | request-resolution-baseline     | resolution + baseline recording              |
 * | request-supplier-switch         | per-supplier suggestion re-evaluation        |
 * | request-orchestration           | event-based post-processing order            |
 * | request-draft-glossary          | this file — vocabulary + index               |
 * | context-hash                    | contextHash + fingerprint computation        |
 * | builders                        | deterministic suggestion builders            |
 * | suggestion-engine               | AiSuggestion types + orchestration layer     |
 *
 * ## Layer Separation
 *
 * primitives (selector/util/reducer) = canonical truth
 * orchestration = 사건별 호출 순서
 * surface model = UI-ready composition
 * component = event emit + model render
 */

// Re-export core types for convenience (no logic, types only)
export type { RequestDraftSuggestionSurfaceModel, RequestDraftStatusEcho, RequestDraftHeaderDensity, RequestDraftReviewIntent } from "./request-active-suggestion-selector";
export type { RequestDraftSuggestionActionability } from "./request-draft-action-gate";
export type { EffectivePreviewItem, RequestDraftPatchDiff } from "./request-draft-diff";
export type { SupplierRequestDraft, SupplierDraftPatch } from "./request-draft-patch";
export type { RequestDraftGenerationEligibility } from "./request-generation-eligibility";
export type { RequestDraftGenerationCooldown } from "./request-generation-cooldown";
export type { RequestDraftOrchestrationEvent } from "./request-orchestration";
export type { RequestDraftGenerationBaseline, RequestDraftResolutionStatus } from "./request-resolution-baseline";
export type { MeaningfulChangeCategory, RequestDraftMeaningfulContextChange } from "./request-meaningful-change";
