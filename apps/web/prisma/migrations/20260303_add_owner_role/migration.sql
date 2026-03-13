-- AlterEnum: Add OWNER value to OrganizationRole enum
DO $$ BEGIN
  ALTER TYPE "OrganizationRole" ADD VALUE IF NOT EXISTS 'OWNER';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
