-- ============================================================
-- Supabase Schema: budgets + comparisons
-- 실행: Supabase Dashboard > SQL Editor 에서 실행
-- ============================================================

-- ── 1. budgets 테이블 ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS budgets (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL,                        -- auth.users.id FK
  organization_id TEXT,                                  -- 조직 스코프 (nullable = 개인)
  name            TEXT NOT NULL,                         -- 예산명
  amount          BIGINT NOT NULL DEFAULT 0,             -- 총 예산 (KRW)
  currency        TEXT NOT NULL DEFAULT 'KRW',
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  target_department TEXT,                                -- 대상 부서/팀
  project_name    TEXT,                                  -- 프로젝트/과제명
  description     TEXT,
  total_spent     BIGINT NOT NULL DEFAULT 0,             -- 집행 총액
  burn_rate       NUMERIC DEFAULT 0,                     -- 소진율 (앱에서 계산)
  status          TEXT DEFAULT 'safe',                   -- 상태 (앱에서 계산)
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_budgets_user ON budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_org ON budgets(organization_id);
CREATE INDEX IF NOT EXISTS idx_budgets_status ON budgets(status);
CREATE INDEX IF NOT EXISTS idx_budgets_period ON budgets(period_start, period_end);

-- RLS 활성화
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

-- 정책: 본인 데이터만 CRUD
CREATE POLICY "Users can view own budgets"
  ON budgets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own budgets"
  ON budgets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own budgets"
  ON budgets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own budgets"
  ON budgets FOR DELETE
  USING (auth.uid() = user_id);


-- ── 2. comparisons 테이블 (소싱 비교함) ─────────────────────
CREATE TABLE IF NOT EXISTS comparisons (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL,                             -- auth.users.id FK
  product_id  TEXT NOT NULL,                              -- 비교 대상 제품 ID
  product_name TEXT,                                      -- 표시용 제품명
  product_brand TEXT,                                     -- 표시용 브랜드
  added_at    TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, product_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_comparisons_user ON comparisons(user_id);

-- RLS 활성화
ALTER TABLE comparisons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own comparisons"
  ON comparisons FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own comparisons"
  ON comparisons FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comparisons"
  ON comparisons FOR DELETE
  USING (auth.uid() = user_id);


-- ── 3. inventory 테이블 (재고 관리) ───────────────────────
CREATE TABLE IF NOT EXISTS inventory (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID NOT NULL,
  product_id        TEXT NOT NULL,                         -- 제품 ID
  product_name      TEXT,                                  -- 제품명 (비정규화)
  quantity          NUMERIC NOT NULL DEFAULT 0,            -- 현재 수량
  reserved_quantity NUMERIC NOT NULL DEFAULT 0,            -- 예약 수량
  unit              TEXT NOT NULL DEFAULT 'EA',            -- 단위
  lot_number        TEXT,                                  -- LOT 번호
  expiry_date       DATE,                                  -- 유효기간
  storage_location  TEXT,                                  -- 보관 위치
  status            TEXT DEFAULT 'in_stock',               -- 상태 (in_stock/low_stock/out_of_stock/expired)
  reorder_point     NUMERIC,                               -- 재주문점
  reorder_quantity  NUMERIC,                               -- 재주문 수량
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_user ON inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory(status);
CREATE INDEX IF NOT EXISTS idx_inventory_lot ON inventory(lot_number);

ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own inventory"
  ON inventory FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own inventory"
  ON inventory FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own inventory"
  ON inventory FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own inventory"
  ON inventory FOR DELETE USING (auth.uid() = user_id);


-- ── 4. order_queue 테이블 (주문 큐) ──────────────────────
CREATE TABLE IF NOT EXISTS order_queue (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID NOT NULL,
  po_number         TEXT NOT NULL,                         -- PO 번호
  product_id        TEXT NOT NULL,
  product_name      TEXT,
  vendor_id         TEXT NOT NULL,
  vendor_name       TEXT,
  quantity          NUMERIC NOT NULL DEFAULT 0,
  unit              TEXT NOT NULL DEFAULT 'EA',
  unit_price        NUMERIC NOT NULL DEFAULT 0,
  total_amount      NUMERIC NOT NULL DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'KRW',
  status            TEXT NOT NULL DEFAULT 'draft',         -- PO 상태
  requested_by      TEXT NOT NULL,
  approved_by       TEXT,
  approved_at       TIMESTAMPTZ,
  approval_comment  TEXT,
  expected_quantity NUMERIC,                                -- 예상 수령 수량
  received_by       TEXT,
  received_at       TIMESTAMPTZ,
  received_quantity NUMERIC,
  -- ── Object Link Graph FK ──
  budget_id         UUID REFERENCES budgets(id) ON DELETE SET NULL,
  budget_name       TEXT,                                  -- 비정규화 (UI 표시용)
  inventory_id      UUID REFERENCES inventory(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_queue_user ON order_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_order_queue_status ON order_queue(status);
CREATE INDEX IF NOT EXISTS idx_order_queue_budget ON order_queue(budget_id);
CREATE INDEX IF NOT EXISTS idx_order_queue_inventory ON order_queue(inventory_id);
CREATE INDEX IF NOT EXISTS idx_order_queue_po ON order_queue(po_number);

ALTER TABLE order_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own orders"
  ON order_queue FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own orders"
  ON order_queue FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own orders"
  ON order_queue FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own orders"
  ON order_queue FOR DELETE USING (auth.uid() = user_id);


-- ── 5. receiving_records 테이블 (입고 기록) ───────────────
CREATE TABLE IF NOT EXISTS receiving_records (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id          UUID REFERENCES order_queue(id) ON DELETE CASCADE,
  product_id        TEXT NOT NULL,
  inventory_id      UUID REFERENCES inventory(id) ON DELETE SET NULL,
  received_quantity NUMERIC NOT NULL,
  unit              TEXT NOT NULL DEFAULT 'EA',
  lot_number        TEXT,
  expiry_date       DATE,
  inspection_result TEXT NOT NULL DEFAULT 'accepted',      -- accepted/accepted_with_note/partial_received/rejected/damaged
  inspection_note   TEXT,
  received_by       TEXT NOT NULL,
  received_at       TIMESTAMPTZ DEFAULT NOW(),
  storage_location  TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receiving_order ON receiving_records(order_id);
CREATE INDEX IF NOT EXISTS idx_receiving_inventory ON receiving_records(inventory_id);

ALTER TABLE receiving_records ENABLE ROW LEVEL SECURITY;

-- receiving_records는 order_queue를 통해 user_id를 확인
CREATE POLICY "Users can view own receiving records"
  ON receiving_records FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM order_queue
    WHERE order_queue.id = receiving_records.order_id
    AND order_queue.user_id = auth.uid()
  ));
CREATE POLICY "Users can insert own receiving records"
  ON receiving_records FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM order_queue
    WHERE order_queue.id = receiving_records.order_id
    AND order_queue.user_id = auth.uid()
  ));


-- ── 6. updated_at 트리거 ─────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER budgets_updated_at
  BEFORE UPDATE ON budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER order_queue_updated_at
  BEFORE UPDATE ON order_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
