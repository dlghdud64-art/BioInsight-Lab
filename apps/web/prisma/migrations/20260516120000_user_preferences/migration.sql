-- §11.230c (a) #user-preferences-server-persist — 호영님 §11.230b 백로그 잔재.
--
-- column prefs (widths/visibility/order) 를 user account 에 영구화 →
-- cross-device sync. JSON shape:
--   { columnPrefs: { quotes: { widths, visibility, order } } }
--
-- forward-compat: nullable add column (기존 row 영향 0).
-- backwards compat: localStorage fallback 유지 (server fetch 실패 시).
-- IF NOT EXISTS (idempotent, 직전 cluster 정합).

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "preferences" JSONB;
