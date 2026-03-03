-- AlterEnum: Add OWNER value to OrganizationRole enum
ALTER TYPE "OrganizationRole" ADD VALUE IF NOT EXISTS 'OWNER';
