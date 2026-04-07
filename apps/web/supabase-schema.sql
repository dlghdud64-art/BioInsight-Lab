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
  -- 파생 컬럼: 소진율
  burn_rate       NUMERIC GENERATED ALWAYS AS (
    CASE WHEN amount > 0 THEN ROUND((total_spent::NUMERIC / amount) * 100, 1) ELSE 0 END
  ) STORED,
  -- 파생 컬럼: 상태
  status          TEXT GENERATED ALWAYS AS (
    CASE
      WHEN CURRENT_DATE > period_end THEN 'ended'
      WHEN CURRENT_DATE < period_start THEN 'upcoming'
      WHEN amount > 0 AND total_spent > amount THEN 'over'
      WHEN amount > 0 AND (total_spent::NUMERIC / amount) >= 0.8 THEN 'critical'
      WHEN amount > 0 AND (total_spent::NUMERIC / amount) >= 0.6 THEN 'warning'
      ELSE 'safe'
    END
  ) STORED,
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


-- ── 3. updated_at 트리거 ─────────────────────────────────
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
