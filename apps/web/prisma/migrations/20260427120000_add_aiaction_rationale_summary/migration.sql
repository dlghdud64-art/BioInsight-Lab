-- α-F (ADR-002 §11.25): add RATIONALE_SUMMARY to AiActionType enum.
--
-- New AiActionItem.type for the LLM-backed enrichment of the AI 선택안
-- rationale on /dashboard/purchases. v0 placeholder (`회신 완료` /
-- `회신 대기`) stays as the fallback; this enum value is what
-- buildRationale persists into AiActionItem so the resolver can read
-- it back on subsequent loads.
--
-- Backward compatible: existing rows are unchanged. Lambdas that don't
-- yet know about this enum value won't fail (Postgres enums grow
-- additively), but the resolver branch that consumes it lands in the
-- same commit so the gap is zero in practice.

ALTER TYPE "AiActionType" ADD VALUE IF NOT EXISTS 'RATIONALE_SUMMARY';
