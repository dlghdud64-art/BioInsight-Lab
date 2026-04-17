-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('RESEARCHER', 'BUYER', 'SUPPLIER', 'ADMIN');

-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('VIEWER', 'REQUESTER', 'APPROVER', 'ADMIN', 'OWNER');

-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "PurchaseRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'TEAM', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('REAGENT', 'TOOL', 'EQUIPMENT', 'RAW_MATERIAL');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('PENDING', 'PARSED', 'SENT', 'RESPONDED', 'COMPLETED', 'PURCHASED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReceivingStatus" AS ENUM ('PENDING', 'PARTIAL', 'COMPLETED', 'ISSUE');

-- CreateEnum
CREATE TYPE "InspectionResult" AS ENUM ('PASS', 'CAUTION', 'FAIL');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "WorkspacePlan" AS ENUM ('FREE', 'TEAM', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "WorkspaceMemberRole" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM ('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('QUOTE_CREATED', 'QUOTE_UPDATED', 'QUOTE_DELETED', 'QUOTE_SHARED', 'QUOTE_VIEWED', 'QUOTE_STATUS_CHANGED', 'PRODUCT_COMPARED', 'PRODUCT_VIEWED', 'PRODUCT_FAVORITED', 'SEARCH_PERFORMED', 'AI_TASK_CREATED', 'AI_TASK_OPENED', 'QUOTE_DRAFT_GENERATED', 'QUOTE_DRAFT_REVIEWED', 'EMAIL_DRAFT_GENERATED', 'EMAIL_SENT', 'VENDOR_REPLY_LOGGED', 'ORDER_FOLLOWUP_GENERATED', 'ORDER_FOLLOWUP_REVIEWED', 'ORDER_FOLLOWUP_SENT', 'ORDER_STATUS_CHANGE_PROPOSED', 'ORDER_STATUS_CHANGE_APPROVED', 'ORDER_STATUS_CHANGED', 'INVENTORY_RESTOCK_SUGGESTED', 'INVENTORY_RESTOCK_REVIEWED', 'PURCHASE_REQUEST_CREATED', 'PURCHASE_REQUEST_CANCELLED', 'PURCHASE_REQUEST_REVERSED', 'PURCHASE_RECORD_RECLASSIFIED', 'AI_TASK_COMPLETED', 'AI_TASK_FAILED', 'QUOTE_DRAFT_STARTED_FROM_COMPARE', 'COMPARE_INQUIRY_DRAFT_STATUS_CHANGED', 'COMPARE_RESULT_VIEWED', 'COMPARE_SESSION_REOPENED');

-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('USER_LOGIN', 'USER_LOGOUT', 'USER_CREATED', 'USER_UPDATED', 'USER_DELETED', 'PERMISSION_CHANGED', 'SETTINGS_CHANGED', 'DATA_EXPORTED', 'DATA_IMPORTED', 'SSO_CONFIGURED', 'ORGANIZATION_CREATED', 'ORGANIZATION_UPDATED', 'ORGANIZATION_DELETED', 'INGESTION_RECEIVED', 'DOCUMENT_CLASSIFIED', 'EXTRACTION_COMPLETED', 'ENTITY_LINKED', 'VERIFICATION_COMPLETED', 'WORK_QUEUE_TASK_GENERATED');

-- CreateEnum
CREATE TYPE "InboundEmailStatus" AS ENUM ('MATCHED', 'UNMATCHED', 'FAILED');

-- CreateEnum
CREATE TYPE "VendorRequestStatus" AS ENUM ('SENT', 'RESPONDED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('ORDERED', 'CONFIRMED', 'SHIPPING', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "AuditEntityType" AS ENUM ('INVENTORY', 'INVENTORY_RESTOCK', 'INVENTORY_USE', 'BUDGET', 'QUOTE', 'QUOTE_STATUS', 'USER', 'ORGANIZATION', 'SETTINGS', 'INSPECTION', 'AI_ACTION');

-- CreateEnum
CREATE TYPE "IngestionSourceType" AS ENUM ('EMAIL', 'ATTACHMENT', 'UPLOAD', 'SYSTEM');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('VENDOR_QUOTE', 'VENDOR_REPLY', 'INVOICE', 'TRANSACTION_STATEMENT', 'PURCHASE_ORDER_DOCUMENT', 'DELIVERY_UPDATE', 'RECEIVING_DOCUMENT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('AUTO_VERIFIED', 'REVIEW_NEEDED', 'MISMATCH', 'MISSING');

-- CreateEnum
CREATE TYPE "IngestionTaskType" AS ENUM ('PURCHASE_EVIDENCE_REVIEW', 'INVOICE_MISSING', 'DOCUMENT_MISMATCH', 'VENDOR_REPLY_REVIEW', 'DELIVERY_UPDATE_REVIEW');

-- CreateEnum
CREATE TYPE "IngestionAuditAction" AS ENUM ('INGESTION_RECEIVED', 'DOCUMENT_CLASSIFIED', 'EXTRACTION_COMPLETED', 'ENTITY_LINKED', 'VERIFICATION_AUTO_VERIFIED', 'VERIFICATION_REVIEW_REQUESTED', 'VERIFICATION_MISMATCH_DETECTED', 'VERIFICATION_MISSING_DETECTED', 'WORK_QUEUE_TASK_CREATED');

-- CreateEnum
CREATE TYPE "AiActionType" AS ENUM ('QUOTE_DRAFT', 'VENDOR_EMAIL_DRAFT', 'REORDER_SUGGESTION', 'EXPIRY_ALERT', 'FOLLOWUP_DRAFT', 'VENDOR_RESPONSE_PARSED', 'STATUS_CHANGE_SUGGEST', 'COMPARE_DECISION');

-- CreateEnum
CREATE TYPE "AiActionStatus" AS ENUM ('PENDING', 'APPROVED', 'DISMISSED', 'EXPIRED', 'EXECUTING', 'FAILED');

-- CreateEnum
CREATE TYPE "AiActionPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('READY', 'REVIEW_NEEDED', 'IN_PROGRESS', 'WAITING_RESPONSE', 'ACTION_NEEDED', 'COMPLETED', 'FAILED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CanaryStage" AS ENUM ('SHADOW', 'ACTIVE_5', 'ACTIVE_25', 'ACTIVE_50', 'STABLE', 'KILLED');

-- CreateEnum
CREATE TYPE "ProcessingPath" AS ENUM ('AI', 'FALLBACK', 'SHADOW');

-- CreateEnum
CREATE TYPE "FallbackReason" AS ENUM ('NONE', 'TIMEOUT', 'SCHEMA_INVALID', 'LOW_CONFIDENCE', 'PROVIDER_ERROR', 'KILL_SWITCH', 'FEATURE_FLAG_OFF', 'AUTO_VERIFY_BLOCKED');

-- CreateEnum
CREATE TYPE "StabilizationLockTarget" AS ENUM ('CANONICAL_BASELINE', 'AUTHORITY_LINE', 'INCIDENT_STREAM', 'SNAPSHOT_RESTORE');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "organizationType" TEXT,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
    "planExpiresAt" TIMESTAMP(3),
    "maxMembers" INTEGER,
    "maxQuotesPerMonth" INTEGER,
    "maxSharedLinks" INTEGER,
    "logoUrl" TEXT,
    "slug" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Seoul',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "OrganizationRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'RESEARCHER',
    "organization" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "description" TEXT,
    "descriptionEn" TEXT,
    "descriptionTranslated" TEXT,
    "category" "ProductCategory" NOT NULL,
    "brand" TEXT,
    "modelNumber" TEXT,
    "catalogNumber" TEXT,
    "lotNumber" TEXT,
    "specifications" JSONB,
    "datasheetUrl" TEXT,
    "imageUrl" TEXT,
    "embedding" vector(1536),
    "grade" TEXT,
    "specification" TEXT,
    "regulatoryCompliance" TEXT,
    "msdsUrl" TEXT,
    "safetyNote" TEXT,
    "hazardCodes" JSONB,
    "pictograms" JSONB,
    "storageCondition" TEXT,
    "ppe" JSONB,
    "coaUrl" TEXT,
    "specSheetUrl" TEXT,
    "pharmacopoeia" TEXT,
    "countryOfOrigin" TEXT,
    "manufacturer" TEXT,
    "expiryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "country" TEXT DEFAULT 'KR',
    "currency" TEXT DEFAULT 'KRW',
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "premiumExpiresAt" TIMESTAMP(3),
    "leadPricePerQuote" DOUBLE PRECISION DEFAULT 0,
    "totalLeads" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVendor" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "price" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "priceInKRW" DOUBLE PRECISION,
    "stockStatus" TEXT,
    "leadTime" INTEGER,
    "minOrderQty" INTEGER,
    "url" TEXT,
    "isPremiumFeatured" BOOLEAN NOT NULL DEFAULT false,
    "premiumPriority" INTEGER NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comparison" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comparison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComparisonProduct" (
    "id" TEXT NOT NULL,
    "comparisonId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComparisonProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "guestKey" TEXT,
    "organizationId" TEXT,
    "workspaceId" TEXT,
    "comparisonId" TEXT,
    "quoteNumber" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "QuoteStatus" NOT NULL DEFAULT 'PENDING',
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "totalAmount" INTEGER,
    "validUntil" TIMESTAMP(3),
    "vendor" TEXT,
    "confidence" TEXT,
    "extractionMethod" TEXT,
    "pdfFileName" TEXT,
    "rawText" TEXT,
    "templateId" TEXT,
    "templateType" TEXT,
    "exportedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "parentQuoteId" TEXT,
    "isSnapshot" BOOLEAN NOT NULL DEFAULT false,
    "snapshotNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "description" TEXT,
    "columns" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteListItem" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "productId" TEXT,
    "lineNumber" INTEGER,
    "name" TEXT,
    "brand" TEXT,
    "catalogNumber" TEXT,
    "unit" TEXT DEFAULT 'ea',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER,
    "currency" TEXT DEFAULT 'KRW',
    "lineTotal" INTEGER,
    "leadTime" TEXT,
    "position" INTEGER,
    "notes" TEXT,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteListItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteItem" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteResponse" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "totalPrice" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "message" TEXT,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorBillingRecord" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER,
    "description" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorBillingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "query" TEXT NOT NULL,
    "intent" JSONB,
    "category" "ProductCategory",
    "filters" JSONB,
    "resultCount" INTEGER,
    "clickedProductId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductRecommendation" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "recommendedProductId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "reasonEn" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "recommendationId" TEXT NOT NULL,
    "isHelpful" BOOLEAN NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "comment" TEXT,
    "pros" TEXT,
    "cons" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductInventory" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "organizationId" TEXT,
    "productId" TEXT NOT NULL,
    "currentQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT DEFAULT 'ea',
    "safetyStock" DOUBLE PRECISION,
    "minOrderQty" DOUBLE PRECISION,
    "location" TEXT,
    "expiryDate" TIMESTAMP(3),
    "autoReorderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoReorderThreshold" DOUBLE PRECISION,
    "averageDailyUsage" DOUBLE PRECISION,
    "leadTimeDays" INTEGER,
    "lotNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "disposalScheduledAt" TIMESTAMP(3),
    "lastInspectedAt" TIMESTAMP(3),

    CONSTRAINT "ProductInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryUsage" (
    "id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "type" TEXT NOT NULL DEFAULT 'USAGE',
    "lotNumber" TEXT,
    "destination" TEXT,
    "operator" TEXT,
    "usageDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryRestock" (
    "id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "expectedQuantity" DOUBLE PRECISION,
    "unit" TEXT,
    "lotNumber" TEXT,
    "expiryDate" TIMESTAMP(3),
    "receivingStatus" "ReceivingStatus" NOT NULL DEFAULT 'COMPLETED',
    "orderId" TEXT,
    "issueNote" TEXT,
    "notes" TEXT,
    "restockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryRestock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "result" "InspectionResult" NOT NULL,
    "checklist" JSONB NOT NULL,
    "notes" TEXT,
    "inspectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedList" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "snapshot" JSONB NOT NULL,
    "createdBy" TEXT,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharedList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRecord" (
    "id" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "workspaceId" TEXT,
    "quoteId" TEXT,
    "purchasedAt" TIMESTAMP(3) NOT NULL,
    "vendorName" TEXT NOT NULL,
    "category" TEXT,
    "normalizedCategoryId" TEXT,
    "itemName" TEXT NOT NULL,
    "catalogNumber" TEXT,
    "unit" TEXT,
    "qty" INTEGER NOT NULL,
    "unitPrice" INTEGER,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "source" TEXT NOT NULL DEFAULT 'import',
    "followUpStatus" TEXT,
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "teamId" TEXT,
    "scopeKey" TEXT NOT NULL,
    "workspaceId" TEXT,
    "yearMonth" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "workspaceId" TEXT,
    "type" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'PENDING',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "successRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "errorSample" JSONB,
    "result" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" "WorkspacePlan" NOT NULL DEFAULT 'FREE',
    "lastWorkspaceId" TEXT,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "stripeCurrentPeriodEnd" TIMESTAMP(3),
    "billingStatus" "BillingStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMember" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkspaceMemberRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceInvite" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "WorkspaceMemberRole" NOT NULL DEFAULT 'MEMBER',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationInvite" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT,
    "role" "OrganizationRole" NOT NULL DEFAULT 'VIEWER',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedByUserId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "workspaceId" TEXT,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
    "status" TEXT NOT NULL DEFAULT 'active',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "trialEndsAt" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "currentSeats" INTEGER NOT NULL DEFAULT 1,
    "maxSeats" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "stripePaymentMethodId" TEXT,
    "brand" TEXT,
    "last4" TEXT,
    "expMonth" INTEGER,
    "expYear" INTEGER,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "stripeInvoiceId" TEXT,
    "number" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "amountDue" INTEGER NOT NULL,
    "amountPaid" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "description" TEXT,
    "lineItems" JSONB,
    "invoicePdfUrl" TEXT,
    "hostedInvoiceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "organizationId" TEXT,
    "activityType" "ActivityType" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "taskType" TEXT,
    "beforeStatus" TEXT,
    "afterStatus" TEXT,
    "actorRole" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompareSession" (
    "id" TEXT NOT NULL,
    "productIds" JSONB NOT NULL,
    "diffResult" JSONB,
    "aiInsight" JSONB,
    "userId" TEXT,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "decisionState" TEXT,
    "decisionNote" TEXT,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "CompareSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompareInquiryDraft" (
    "id" TEXT NOT NULL,
    "compareSessionId" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "vendorEmail" TEXT,
    "productName" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "inquiryFields" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GENERATED',
    "diffIndex" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompareInquiryDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "eventType" "AuditEventType" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "action" TEXT NOT NULL,
    "changes" JSONB,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteRfqToken" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteRfqToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundEmail" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'sendgrid',
    "messageId" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "text" TEXT,
    "html" TEXT,
    "rawHeaders" JSONB,
    "attachmentsMeta" JSONB,
    "matchedQuoteId" TEXT,
    "status" "InboundEmailStatus" NOT NULL DEFAULT 'UNMATCHED',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboundEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteReply" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "vendorName" TEXT,
    "fromEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bodyText" TEXT,
    "bodyHtml" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteReplyAttachment" (
    "id" TEXT NOT NULL,
    "replyId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT,
    "sizeBytes" INTEGER NOT NULL,
    "bucket" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteReplyAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteVendor" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "email" TEXT,
    "country" TEXT DEFAULT 'KR',
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteVendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteShare" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "shareToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteVendorRequest" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "vendorName" TEXT,
    "vendorEmail" TEXT,
    "message" TEXT,
    "token" TEXT NOT NULL,
    "status" "VendorRequestStatus" NOT NULL DEFAULT 'SENT',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "responseEditCount" INTEGER NOT NULL DEFAULT 0,
    "responseEditLimit" INTEGER NOT NULL DEFAULT 1,
    "snapshot" JSONB NOT NULL,
    "snapshotCreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteVendorRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteVendorResponseItem" (
    "id" TEXT NOT NULL,
    "vendorRequestId" TEXT NOT NULL,
    "quoteItemId" TEXT NOT NULL,
    "unitPrice" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "leadTimeDays" INTEGER,
    "moq" INTEGER,
    "vendorSku" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteVendorResponseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "organizationId" TEXT,
    "orderNumber" TEXT NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'ORDERED',
    "notes" TEXT,
    "shippingAddress" TEXT,
    "expectedDelivery" TIMESTAMP(3),
    "actualDelivery" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "catalogNumber" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL,
    "lineTotal" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBudget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL DEFAULT '연구비',
    "totalAmount" INTEGER NOT NULL,
    "usedAmount" INTEGER NOT NULL DEFAULT 0,
    "remainingAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "fiscalYear" INTEGER,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBudgetTransaction" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "orderId" TEXT,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBudgetTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserInventory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "orderItemId" TEXT,
    "productName" TEXT NOT NULL,
    "brand" TEXT,
    "catalogNumber" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit" TEXT DEFAULT 'ea',
    "location" TEXT NOT NULL DEFAULT '미지정',
    "status" TEXT NOT NULL DEFAULT 'IN_STOCK',
    "notes" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "role" "TeamRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequest" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "approverId" TEXT,
    "teamId" TEXT,
    "status" "PurchaseRequestStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT NOT NULL,
    "message" TEXT,
    "items" JSONB NOT NULL,
    "totalAmount" INTEGER,
    "quoteId" TEXT,
    "orderId" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "brand" TEXT,
    "catalogNumber" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER,
    "notes" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'MANUAL',
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataAuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" "AuditEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "previousData" JSONB,
    "newData" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingInfo" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "businessNumber" TEXT,
    "representativeName" TEXT,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "address" TEXT,
    "taxInvoiceEmail" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceType" "IngestionSourceType" NOT NULL,
    "sourceRef" TEXT,
    "filename" TEXT,
    "mimeType" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaderId" TEXT,
    "documentType" "DocumentType" NOT NULL DEFAULT 'UNKNOWN',
    "classificationConfidence" DOUBLE PRECISION,
    "classifiedAt" TIMESTAMP(3),
    "rawTextRef" TEXT,
    "extractionResult" JSONB,
    "extractedAt" TIMESTAMP(3),
    "linkedEntityType" TEXT,
    "linkedEntityId" TEXT,
    "linkingConfidence" DOUBLE PRECISION,
    "linkedAt" TIMESTAMP(3),
    "verificationStatus" "VerificationStatus",
    "verificationReason" TEXT,
    "mismatchedFields" JSONB,
    "missingFields" JSONB,
    "verifiedAt" TIMESTAMP(3),
    "workQueueTaskId" TEXT,
    "workQueueTaskType" "IngestionTaskType",
    "policyFlags" JSONB,
    "approvalRequired" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngestionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionAuditLog" (
    "id" TEXT NOT NULL,
    "ingestionEntryId" TEXT NOT NULL,
    "action" "IngestionAuditAction" NOT NULL,
    "actorType" TEXT NOT NULL DEFAULT 'SYSTEM',
    "actorId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "confidence" DOUBLE PRECISION,
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestionAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiActionItem" (
    "id" TEXT NOT NULL,
    "type" "AiActionType" NOT NULL,
    "status" "AiActionStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "AiActionPriority" NOT NULL DEFAULT 'MEDIUM',
    "taskStatus" "TaskStatus" NOT NULL DEFAULT 'READY',
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "substatus" TEXT,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "assigneeId" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "description" TEXT,
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "aiModel" TEXT,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),

    CONSTRAINT "AiActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanaryConfig" (
    "id" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "stage" "CanaryStage" NOT NULL DEFAULT 'SHADOW',
    "confidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "autoVerifyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "killSwitchActive" BOOLEAN NOT NULL DEFAULT false,
    "updatedBy" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanaryConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanaryApprovalRecord" (
    "id" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStage" TEXT,
    "toStage" TEXT,
    "performedBy" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CanaryApprovalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiProcessingLog" (
    "id" TEXT NOT NULL,
    "ingestionEntryId" TEXT,
    "organizationId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "processingPath" "ProcessingPath" NOT NULL,
    "fallbackReason" "FallbackReason" NOT NULL DEFAULT 'NONE',
    "confidence" DOUBLE PRECISION,
    "model" TEXT,
    "latencyMs" INTEGER,
    "tokenUsage" INTEGER,
    "comparisonDiff" JSONB,
    "mismatchCategory" TEXT,
    "rollbackTriggered" BOOLEAN NOT NULL DEFAULT false,
    "incidentTriggered" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiProcessingLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StabilizationBaseline" (
    "id" TEXT NOT NULL,
    "baselineSource" TEXT NOT NULL,
    "baselineVersion" TEXT NOT NULL,
    "baselineHash" TEXT NOT NULL,
    "lifecycleState" TEXT NOT NULL,
    "releaseMode" TEXT NOT NULL,
    "baselineStatus" TEXT NOT NULL,
    "activeSnapshotId" TEXT,
    "rollbackSnapshotId" TEXT,
    "freezeReason" TEXT,
    "activePathManifestId" TEXT,
    "policySetVersion" TEXT,
    "routingRuleVersion" TEXT,
    "authorityRegistryVersion" TEXT,
    "stabilizationOnly" BOOLEAN NOT NULL DEFAULT true,
    "featureExpansionAllowed" BOOLEAN NOT NULL DEFAULT false,
    "experimentalPathAllowed" BOOLEAN NOT NULL DEFAULT false,
    "structuralRefactorAllowed" BOOLEAN NOT NULL DEFAULT false,
    "devOnlyPathAllowed" BOOLEAN NOT NULL DEFAULT false,
    "emergencyRollbackAllowed" BOOLEAN NOT NULL DEFAULT true,
    "containmentPriorityEnabled" BOOLEAN NOT NULL DEFAULT true,
    "auditStrictMode" BOOLEAN NOT NULL DEFAULT true,
    "mergeGateStrictMode" BOOLEAN NOT NULL DEFAULT true,
    "canonicalSlot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StabilizationBaseline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StabilizationSnapshot" (
    "id" TEXT NOT NULL,
    "baselineId" TEXT NOT NULL,
    "snapshotType" TEXT NOT NULL,
    "configChecksum" TEXT,
    "flagChecksum" TEXT,
    "routingChecksum" TEXT,
    "authorityChecksum" TEXT,
    "policyChecksum" TEXT,
    "queueTopologyChecksum" TEXT,
    "includedScopes" JSONB NOT NULL,
    "restoreVerificationStatus" TEXT,
    "scopePayload" JSONB,
    "configPayload" JSONB,
    "capturedBy" TEXT,
    "snapshotId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StabilizationSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StabilizationAuthorityLine" (
    "id" TEXT NOT NULL,
    "authorityLineId" TEXT NOT NULL,
    "currentAuthorityId" TEXT NOT NULL,
    "authorityState" TEXT NOT NULL,
    "transferState" TEXT NOT NULL,
    "pendingSuccessorId" TEXT,
    "revokedAuthorityIds" JSONB NOT NULL DEFAULT '[]',
    "registryVersion" TEXT NOT NULL,
    "baselineId" TEXT,
    "correlationId" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StabilizationAuthorityLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StabilizationIncident" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "baselineId" TEXT,
    "snapshotId" TEXT,
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StabilizationIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StabilizationAuditEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "incidentId" TEXT,
    "baselineId" TEXT,
    "snapshotId" TEXT,
    "actor" TEXT,
    "reasonCode" TEXT,
    "severity" TEXT,
    "sourceModule" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "resultStatus" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StabilizationAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanonicalAuditEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventStage" TEXT,
    "correlationId" TEXT NOT NULL,
    "incidentId" TEXT,
    "timelineId" TEXT NOT NULL,
    "baselineId" TEXT,
    "baselineVersion" TEXT,
    "baselineHash" TEXT,
    "lifecycleState" TEXT,
    "releaseMode" TEXT,
    "actor" TEXT,
    "sourceModule" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshotBeforeId" TEXT,
    "snapshotAfterId" TEXT,
    "affectedScopes" JSONB NOT NULL DEFAULT '[]',
    "resultStatus" TEXT NOT NULL,
    "parentEventId" TEXT,

    CONSTRAINT "CanonicalAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StabilizationLock" (
    "id" TEXT NOT NULL,
    "lockKey" TEXT NOT NULL,
    "lockOwner" TEXT NOT NULL,
    "lockToken" TEXT NOT NULL,
    "targetType" "StabilizationLockTarget" NOT NULL,
    "reason" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StabilizationLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StabilizationRecoveryRecord" (
    "id" TEXT NOT NULL,
    "recoveryId" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "incidentId" TEXT,
    "baselineId" TEXT NOT NULL,
    "lifecycleState" TEXT NOT NULL,
    "releaseMode" TEXT NOT NULL,
    "recoveryState" TEXT NOT NULL,
    "recoveryStage" TEXT,
    "lockKey" TEXT,
    "lockToken" TEXT,
    "operatorId" TEXT NOT NULL,
    "overrideUsed" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "signOffMetadata" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "lastHeartbeatAt" TIMESTAMP(3),
    "failureReasonCode" TEXT,
    "stageResults" JSONB,
    "preconditionResults" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StabilizationRecoveryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "triggeredBy" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationAction" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "recipientId" TEXT,
    "recipientEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalBaseline" (
    "id" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "approvalDecidedAt" TEXT NOT NULL,
    "capturedAt" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "vendorId" TEXT NOT NULL,
    "paymentTerms" TEXT,
    "incoterms" TEXT,
    "shippingRegion" TEXT NOT NULL,
    "billToEntity" TEXT NOT NULL,
    "shipToLocation" TEXT NOT NULL,
    "notes" TEXT,
    "lineCount" INTEGER NOT NULL,
    "invalidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalBaseline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundHistory" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "seqIndex" INTEGER NOT NULL,
    "recordType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboundHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "POCandidate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "title" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "expectedDelivery" TIMESTAMP(3),
    "selectionReason" TEXT,
    "blockers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "approvalPolicy" TEXT NOT NULL DEFAULT 'none',
    "approvalStatus" TEXT NOT NULL DEFAULT 'not_required',
    "stage" TEXT NOT NULL DEFAULT 'po_conversion_candidate',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "POCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "POCandidateItem" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "catalogNumber" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL,
    "lineTotal" INTEGER NOT NULL,
    "leadTime" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "POCandidateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewQueueDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewQueueDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernanceEventDedupe" (
    "id" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "signatureKey" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernanceEventDedupe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernanceAuditLog" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "targetEntityType" TEXT NOT NULL,
    "targetEntityId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "snapshotVersion" TEXT NOT NULL DEFAULT 'v0',
    "beforeHash" TEXT NOT NULL,
    "afterHash" TEXT NOT NULL,
    "rationale" TEXT,
    "reasonCode" TEXT NOT NULL,
    "sourceSurface" TEXT NOT NULL,
    "previousEnvelopeHash" TEXT NOT NULL,
    "envelopeHash" TEXT NOT NULL,
    "securityClassification" TEXT NOT NULL DEFAULT 'audit_evidence',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GovernanceAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpendingCategory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpendingCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryBudget" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "warningPercent" INTEGER NOT NULL DEFAULT 70,
    "softLimitPercent" INTEGER NOT NULL DEFAULT 90,
    "hardStopPercent" INTEGER NOT NULL DEFAULT 100,
    "controlRules" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "budgetEventKey" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "sourceEntityType" TEXT NOT NULL,
    "sourceEntityId" TEXT NOT NULL,
    "categoryId" TEXT,
    "yearMonth" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "preCommitted" INTEGER NOT NULL,
    "postCommitted" INTEGER NOT NULL,
    "decisionPayload" JSONB,
    "executedBy" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MutationAuditEvent" (
    "id" TEXT NOT NULL,
    "auditEventKey" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orgId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "requestId" TEXT,
    "orderId" TEXT,
    "purchaseRecordId" TEXT,
    "periodKey" TEXT,
    "normalizedCategoryId" TEXT,
    "amount" INTEGER,
    "thresholds" JSONB,
    "decisionBasis" JSONB,
    "budgetEventKey" TEXT,
    "compensatingForEventId" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MutationAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactInquiry" (
    "id" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "inquiryType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),

    CONSTRAINT "ContactInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_name_idx" ON "Organization"("name");

-- CreateIndex
CREATE INDEX "Organization_plan_idx" ON "Organization"("plan");

-- CreateIndex
CREATE INDEX "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");

-- CreateIndex
CREATE INDEX "OrganizationMember_organizationId_idx" ON "OrganizationMember"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_userId_organizationId_key" ON "OrganizationMember"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Product_category_idx" ON "Product"("category");

-- CreateIndex
CREATE INDEX "Product_brand_idx" ON "Product"("brand");

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE INDEX "Vendor_name_idx" ON "Vendor"("name");

-- CreateIndex
CREATE INDEX "Vendor_isPremium_idx" ON "Vendor"("isPremium");

-- CreateIndex
CREATE INDEX "ProductVendor_productId_idx" ON "ProductVendor"("productId");

-- CreateIndex
CREATE INDEX "ProductVendor_vendorId_idx" ON "ProductVendor"("vendorId");

-- CreateIndex
CREATE INDEX "ProductVendor_priceInKRW_idx" ON "ProductVendor"("priceInKRW");

-- CreateIndex
CREATE INDEX "ProductVendor_isPremiumFeatured_premiumPriority_idx" ON "ProductVendor"("isPremiumFeatured", "premiumPriority");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVendor_productId_vendorId_key" ON "ProductVendor"("productId", "vendorId");

-- CreateIndex
CREATE INDEX "Comparison_userId_idx" ON "Comparison"("userId");

-- CreateIndex
CREATE INDEX "ComparisonProduct_comparisonId_idx" ON "ComparisonProduct"("comparisonId");

-- CreateIndex
CREATE UNIQUE INDEX "ComparisonProduct_comparisonId_productId_key" ON "ComparisonProduct"("comparisonId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_quoteNumber_key" ON "Quote"("quoteNumber");

-- CreateIndex
CREATE INDEX "Quote_userId_idx" ON "Quote"("userId");

-- CreateIndex
CREATE INDEX "Quote_guestKey_idx" ON "Quote"("guestKey");

-- CreateIndex
CREATE INDEX "Quote_organizationId_idx" ON "Quote"("organizationId");

-- CreateIndex
CREATE INDEX "Quote_workspaceId_idx" ON "Quote"("workspaceId");

-- CreateIndex
CREATE INDEX "Quote_templateId_idx" ON "Quote"("templateId");

-- CreateIndex
CREATE INDEX "Quote_parentQuoteId_idx" ON "Quote"("parentQuoteId");

-- CreateIndex
CREATE INDEX "Quote_version_idx" ON "Quote"("version");

-- CreateIndex
CREATE INDEX "QuoteTemplate_organizationId_idx" ON "QuoteTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "QuoteTemplate_userId_idx" ON "QuoteTemplate"("userId");

-- CreateIndex
CREATE INDEX "QuoteTemplate_type_idx" ON "QuoteTemplate"("type");

-- CreateIndex
CREATE INDEX "QuoteListItem_quoteId_idx" ON "QuoteListItem"("quoteId");

-- CreateIndex
CREATE INDEX "QuoteListItem_productId_idx" ON "QuoteListItem"("productId");

-- CreateIndex
CREATE INDEX "QuoteItem_quoteId_idx" ON "QuoteItem"("quoteId");

-- CreateIndex
CREATE INDEX "QuoteItem_productId_idx" ON "QuoteItem"("productId");

-- CreateIndex
CREATE INDEX "QuoteResponse_quoteId_idx" ON "QuoteResponse"("quoteId");

-- CreateIndex
CREATE INDEX "QuoteResponse_vendorId_idx" ON "QuoteResponse"("vendorId");

-- CreateIndex
CREATE INDEX "VendorBillingRecord_vendorId_idx" ON "VendorBillingRecord"("vendorId");

-- CreateIndex
CREATE INDEX "VendorBillingRecord_createdAt_idx" ON "VendorBillingRecord"("createdAt");

-- CreateIndex
CREATE INDEX "Favorite_userId_idx" ON "Favorite"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_productId_key" ON "Favorite"("userId", "productId");

-- CreateIndex
CREATE INDEX "SearchHistory_userId_idx" ON "SearchHistory"("userId");

-- CreateIndex
CREATE INDEX "SearchHistory_createdAt_idx" ON "SearchHistory"("createdAt");

-- CreateIndex
CREATE INDEX "ProductRecommendation_productId_idx" ON "ProductRecommendation"("productId");

-- CreateIndex
CREATE INDEX "ProductRecommendation_score_idx" ON "ProductRecommendation"("score");

-- CreateIndex
CREATE UNIQUE INDEX "ProductRecommendation_productId_recommendedProductId_key" ON "ProductRecommendation"("productId", "recommendedProductId");

-- CreateIndex
CREATE INDEX "RecommendationFeedback_recommendationId_idx" ON "RecommendationFeedback"("recommendationId");

-- CreateIndex
CREATE INDEX "RecommendationFeedback_userId_idx" ON "RecommendationFeedback"("userId");

-- CreateIndex
CREATE INDEX "Review_productId_idx" ON "Review"("productId");

-- CreateIndex
CREATE INDEX "Review_userId_idx" ON "Review"("userId");

-- CreateIndex
CREATE INDEX "Review_rating_idx" ON "Review"("rating");

-- CreateIndex
CREATE INDEX "Review_createdAt_idx" ON "Review"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Review_userId_productId_key" ON "Review"("userId", "productId");

-- CreateIndex
CREATE INDEX "ProductInventory_productId_idx" ON "ProductInventory"("productId");

-- CreateIndex
CREATE INDEX "ProductInventory_userId_idx" ON "ProductInventory"("userId");

-- CreateIndex
CREATE INDEX "ProductInventory_organizationId_idx" ON "ProductInventory"("organizationId");

-- CreateIndex
CREATE INDEX "ProductInventory_currentQuantity_idx" ON "ProductInventory"("currentQuantity");

-- CreateIndex
CREATE UNIQUE INDEX "ProductInventory_userId_productId_key" ON "ProductInventory"("userId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductInventory_organizationId_productId_key" ON "ProductInventory"("organizationId", "productId");

-- CreateIndex
CREATE INDEX "InventoryUsage_inventoryId_idx" ON "InventoryUsage"("inventoryId");

-- CreateIndex
CREATE INDEX "InventoryUsage_userId_idx" ON "InventoryUsage"("userId");

-- CreateIndex
CREATE INDEX "InventoryUsage_usageDate_idx" ON "InventoryUsage"("usageDate");

-- CreateIndex
CREATE INDEX "InventoryUsage_type_idx" ON "InventoryUsage"("type");

-- CreateIndex
CREATE INDEX "InventoryRestock_inventoryId_idx" ON "InventoryRestock"("inventoryId");

-- CreateIndex
CREATE INDEX "InventoryRestock_userId_idx" ON "InventoryRestock"("userId");

-- CreateIndex
CREATE INDEX "InventoryRestock_restockedAt_idx" ON "InventoryRestock"("restockedAt");

-- CreateIndex
CREATE INDEX "InventoryRestock_orderId_idx" ON "InventoryRestock"("orderId");

-- CreateIndex
CREATE INDEX "InventoryRestock_receivingStatus_idx" ON "InventoryRestock"("receivingStatus");

-- CreateIndex
CREATE INDEX "Inspection_inventoryId_idx" ON "Inspection"("inventoryId");

-- CreateIndex
CREATE INDEX "Inspection_userId_idx" ON "Inspection"("userId");

-- CreateIndex
CREATE INDEX "Inspection_organizationId_idx" ON "Inspection"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "SharedList_publicId_key" ON "SharedList"("publicId");

-- CreateIndex
CREATE INDEX "SharedList_publicId_idx" ON "SharedList"("publicId");

-- CreateIndex
CREATE INDEX "SharedList_quoteId_idx" ON "SharedList"("quoteId");

-- CreateIndex
CREATE INDEX "SharedList_isActive_idx" ON "SharedList"("isActive");

-- CreateIndex
CREATE INDEX "PurchaseRecord_scopeKey_purchasedAt_idx" ON "PurchaseRecord"("scopeKey", "purchasedAt");

-- CreateIndex
CREATE INDEX "PurchaseRecord_scopeKey_vendorName_idx" ON "PurchaseRecord"("scopeKey", "vendorName");

-- CreateIndex
CREATE INDEX "PurchaseRecord_scopeKey_category_idx" ON "PurchaseRecord"("scopeKey", "category");

-- CreateIndex
CREATE INDEX "PurchaseRecord_normalizedCategoryId_idx" ON "PurchaseRecord"("normalizedCategoryId");

-- CreateIndex
CREATE INDEX "PurchaseRecord_quoteId_idx" ON "PurchaseRecord"("quoteId");

-- CreateIndex
CREATE INDEX "PurchaseRecord_workspaceId_idx" ON "PurchaseRecord"("workspaceId");

-- CreateIndex
CREATE INDEX "Budget_scopeKey_idx" ON "Budget"("scopeKey");

-- CreateIndex
CREATE INDEX "Budget_yearMonth_idx" ON "Budget"("yearMonth");

-- CreateIndex
CREATE INDEX "Budget_workspaceId_idx" ON "Budget"("workspaceId");

-- CreateIndex
CREATE INDEX "Budget_organizationId_idx" ON "Budget"("organizationId");

-- CreateIndex
CREATE INDEX "Budget_teamId_idx" ON "Budget"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_scopeKey_yearMonth_key" ON "Budget"("scopeKey", "yearMonth");

-- CreateIndex
CREATE INDEX "ImportJob_scopeKey_idx" ON "ImportJob"("scopeKey");

-- CreateIndex
CREATE INDEX "ImportJob_status_idx" ON "ImportJob"("status");

-- CreateIndex
CREATE INDEX "ImportJob_type_idx" ON "ImportJob"("type");

-- CreateIndex
CREATE INDEX "ImportJob_createdAt_idx" ON "ImportJob"("createdAt");

-- CreateIndex
CREATE INDEX "ImportJob_workspaceId_idx" ON "ImportJob"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_stripeCustomerId_key" ON "Workspace"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_stripeSubscriptionId_key" ON "Workspace"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Workspace_slug_idx" ON "Workspace"("slug");

-- CreateIndex
CREATE INDEX "WorkspaceMember_workspaceId_idx" ON "WorkspaceMember"("workspaceId");

-- CreateIndex
CREATE INDEX "WorkspaceMember_userId_idx" ON "WorkspaceMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceInvite_token_key" ON "WorkspaceInvite"("token");

-- CreateIndex
CREATE INDEX "WorkspaceInvite_token_idx" ON "WorkspaceInvite"("token");

-- CreateIndex
CREATE INDEX "WorkspaceInvite_workspaceId_idx" ON "WorkspaceInvite"("workspaceId");

-- CreateIndex
CREATE INDEX "WorkspaceInvite_email_idx" ON "WorkspaceInvite"("email");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationInvite_token_key" ON "OrganizationInvite"("token");

-- CreateIndex
CREATE INDEX "OrganizationInvite_token_idx" ON "OrganizationInvite"("token");

-- CreateIndex
CREATE INDEX "OrganizationInvite_organizationId_idx" ON "OrganizationInvite"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_organizationId_key" ON "Subscription"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_workspaceId_key" ON "Subscription"("workspaceId");

-- CreateIndex
CREATE INDEX "Subscription_organizationId_idx" ON "Subscription"("organizationId");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_workspaceId_idx" ON "Subscription"("workspaceId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_stripeCustomerId_idx" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_stripePaymentMethodId_key" ON "PaymentMethod"("stripePaymentMethodId");

-- CreateIndex
CREATE INDEX "PaymentMethod_subscriptionId_idx" ON "PaymentMethod"("subscriptionId");

-- CreateIndex
CREATE INDEX "PaymentMethod_isDefault_idx" ON "PaymentMethod"("isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_stripeInvoiceId_key" ON "Invoice"("stripeInvoiceId");

-- CreateIndex
CREATE INDEX "Invoice_subscriptionId_idx" ON "Invoice"("subscriptionId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_periodStart_idx" ON "Invoice"("periodStart");

-- CreateIndex
CREATE INDEX "Invoice_stripeInvoiceId_idx" ON "Invoice"("stripeInvoiceId");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_idx" ON "ActivityLog"("userId");

-- CreateIndex
CREATE INDEX "ActivityLog_organizationId_idx" ON "ActivityLog"("organizationId");

-- CreateIndex
CREATE INDEX "ActivityLog_activityType_idx" ON "ActivityLog"("activityType");

-- CreateIndex
CREATE INDEX "ActivityLog_entityType_idx" ON "ActivityLog"("entityType");

-- CreateIndex
CREATE INDEX "ActivityLog_entityId_idx" ON "ActivityLog"("entityId");

-- CreateIndex
CREATE INDEX "ActivityLog_entityType_entityId_idx" ON "ActivityLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_taskType_idx" ON "ActivityLog"("taskType");

-- CreateIndex
CREATE INDEX "CompareSession_userId_idx" ON "CompareSession"("userId");

-- CreateIndex
CREATE INDEX "CompareSession_organizationId_idx" ON "CompareSession"("organizationId");

-- CreateIndex
CREATE INDEX "CompareSession_createdAt_idx" ON "CompareSession"("createdAt");

-- CreateIndex
CREATE INDEX "CompareInquiryDraft_compareSessionId_idx" ON "CompareInquiryDraft"("compareSessionId");

-- CreateIndex
CREATE INDEX "CompareInquiryDraft_userId_idx" ON "CompareInquiryDraft"("userId");

-- CreateIndex
CREATE INDEX "CompareInquiryDraft_status_idx" ON "CompareInquiryDraft"("status");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_idx" ON "AuditLog"("organizationId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_eventType_idx" ON "AuditLog"("eventType");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_idx" ON "AuditLog"("entityType");

-- CreateIndex
CREATE INDEX "AuditLog_entityId_idx" ON "AuditLog"("entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_success_idx" ON "AuditLog"("success");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteRfqToken_quoteId_key" ON "QuoteRfqToken"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteRfqToken_token_key" ON "QuoteRfqToken"("token");

-- CreateIndex
CREATE INDEX "QuoteRfqToken_token_idx" ON "QuoteRfqToken"("token");

-- CreateIndex
CREATE INDEX "QuoteRfqToken_enabled_idx" ON "QuoteRfqToken"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "InboundEmail_messageId_key" ON "InboundEmail"("messageId");

-- CreateIndex
CREATE INDEX "InboundEmail_messageId_idx" ON "InboundEmail"("messageId");

-- CreateIndex
CREATE INDEX "InboundEmail_status_idx" ON "InboundEmail"("status");

-- CreateIndex
CREATE INDEX "InboundEmail_matchedQuoteId_idx" ON "InboundEmail"("matchedQuoteId");

-- CreateIndex
CREATE INDEX "InboundEmail_receivedAt_idx" ON "InboundEmail"("receivedAt");

-- CreateIndex
CREATE INDEX "QuoteReply_quoteId_idx" ON "QuoteReply"("quoteId");

-- CreateIndex
CREATE INDEX "QuoteReply_fromEmail_idx" ON "QuoteReply"("fromEmail");

-- CreateIndex
CREATE INDEX "QuoteReply_receivedAt_idx" ON "QuoteReply"("receivedAt");

-- CreateIndex
CREATE INDEX "QuoteReplyAttachment_replyId_idx" ON "QuoteReplyAttachment"("replyId");

-- CreateIndex
CREATE INDEX "QuoteVendor_quoteId_idx" ON "QuoteVendor"("quoteId");

-- CreateIndex
CREATE INDEX "QuoteVendor_vendorName_idx" ON "QuoteVendor"("vendorName");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteShare_quoteId_key" ON "QuoteShare"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteShare_shareToken_key" ON "QuoteShare"("shareToken");

-- CreateIndex
CREATE INDEX "QuoteShare_shareToken_idx" ON "QuoteShare"("shareToken");

-- CreateIndex
CREATE INDEX "QuoteShare_enabled_idx" ON "QuoteShare"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteVendorRequest_token_key" ON "QuoteVendorRequest"("token");

-- CreateIndex
CREATE INDEX "QuoteVendorRequest_quoteId_idx" ON "QuoteVendorRequest"("quoteId");

-- CreateIndex
CREATE INDEX "QuoteVendorRequest_token_idx" ON "QuoteVendorRequest"("token");

-- CreateIndex
CREATE INDEX "QuoteVendorRequest_status_idx" ON "QuoteVendorRequest"("status");

-- CreateIndex
CREATE INDEX "QuoteVendorRequest_expiresAt_idx" ON "QuoteVendorRequest"("expiresAt");

-- CreateIndex
CREATE INDEX "QuoteVendorResponseItem_vendorRequestId_idx" ON "QuoteVendorResponseItem"("vendorRequestId");

-- CreateIndex
CREATE INDEX "QuoteVendorResponseItem_quoteItemId_idx" ON "QuoteVendorResponseItem"("quoteItemId");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteVendorResponseItem_vendorRequestId_quoteItemId_key" ON "QuoteVendorResponseItem"("vendorRequestId", "quoteItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_quoteId_key" ON "Order"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "Order"("userId");

-- CreateIndex
CREATE INDEX "Order_quoteId_idx" ON "Order"("quoteId");

-- CreateIndex
CREATE INDEX "Order_organizationId_idx" ON "Order"("organizationId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE INDEX "UserBudget_userId_idx" ON "UserBudget"("userId");

-- CreateIndex
CREATE INDEX "UserBudget_organizationId_idx" ON "UserBudget"("organizationId");

-- CreateIndex
CREATE INDEX "UserBudget_isActive_idx" ON "UserBudget"("isActive");

-- CreateIndex
CREATE INDEX "UserBudget_fiscalYear_idx" ON "UserBudget"("fiscalYear");

-- CreateIndex
CREATE UNIQUE INDEX "UserBudgetTransaction_orderId_key" ON "UserBudgetTransaction"("orderId");

-- CreateIndex
CREATE INDEX "UserBudgetTransaction_budgetId_idx" ON "UserBudgetTransaction"("budgetId");

-- CreateIndex
CREATE INDEX "UserBudgetTransaction_orderId_idx" ON "UserBudgetTransaction"("orderId");

-- CreateIndex
CREATE INDEX "UserBudgetTransaction_type_idx" ON "UserBudgetTransaction"("type");

-- CreateIndex
CREATE INDEX "UserBudgetTransaction_createdAt_idx" ON "UserBudgetTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "UserInventory_userId_idx" ON "UserInventory"("userId");

-- CreateIndex
CREATE INDEX "UserInventory_orderId_idx" ON "UserInventory"("orderId");

-- CreateIndex
CREATE INDEX "UserInventory_status_idx" ON "UserInventory"("status");

-- CreateIndex
CREATE INDEX "UserInventory_receivedAt_idx" ON "UserInventory"("receivedAt");

-- CreateIndex
CREATE INDEX "Team_organizationId_idx" ON "Team"("organizationId");

-- CreateIndex
CREATE INDEX "Team_name_idx" ON "Team"("name");

-- CreateIndex
CREATE INDEX "TeamMember_userId_idx" ON "TeamMember"("userId");

-- CreateIndex
CREATE INDEX "TeamMember_teamId_idx" ON "TeamMember"("teamId");

-- CreateIndex
CREATE INDEX "TeamMember_role_idx" ON "TeamMember"("role");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_userId_teamId_key" ON "TeamMember"("userId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequest_orderId_key" ON "PurchaseRequest"("orderId");

-- CreateIndex
CREATE INDEX "PurchaseRequest_requesterId_idx" ON "PurchaseRequest"("requesterId");

-- CreateIndex
CREATE INDEX "PurchaseRequest_approverId_idx" ON "PurchaseRequest"("approverId");

-- CreateIndex
CREATE INDEX "PurchaseRequest_teamId_idx" ON "PurchaseRequest"("teamId");

-- CreateIndex
CREATE INDEX "PurchaseRequest_status_idx" ON "PurchaseRequest"("status");

-- CreateIndex
CREATE INDEX "PurchaseRequest_createdAt_idx" ON "PurchaseRequest"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_userId_key" ON "Cart"("userId");

-- CreateIndex
CREATE INDEX "Cart_userId_idx" ON "Cart"("userId");

-- CreateIndex
CREATE INDEX "CartItem_cartId_idx" ON "CartItem"("cartId");

-- CreateIndex
CREATE INDEX "CartItem_productId_idx" ON "CartItem"("productId");

-- CreateIndex
CREATE INDEX "CartItem_catalogNumber_idx" ON "CartItem"("catalogNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_catalogNumber_key" ON "CartItem"("cartId", "catalogNumber");

-- CreateIndex
CREATE INDEX "DataAuditLog_organizationId_idx" ON "DataAuditLog"("organizationId");

-- CreateIndex
CREATE INDEX "DataAuditLog_userId_idx" ON "DataAuditLog"("userId");

-- CreateIndex
CREATE INDEX "DataAuditLog_entityType_idx" ON "DataAuditLog"("entityType");

-- CreateIndex
CREATE INDEX "DataAuditLog_entityId_idx" ON "DataAuditLog"("entityId");

-- CreateIndex
CREATE INDEX "DataAuditLog_entityType_entityId_idx" ON "DataAuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "DataAuditLog_createdAt_idx" ON "DataAuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingInfo_organizationId_key" ON "BillingInfo"("organizationId");

-- CreateIndex
CREATE INDEX "BillingInfo_organizationId_idx" ON "BillingInfo"("organizationId");

-- CreateIndex
CREATE INDEX "IngestionEntry_organizationId_documentType_idx" ON "IngestionEntry"("organizationId", "documentType");

-- CreateIndex
CREATE INDEX "IngestionEntry_organizationId_verificationStatus_idx" ON "IngestionEntry"("organizationId", "verificationStatus");

-- CreateIndex
CREATE INDEX "IngestionEntry_linkedEntityType_linkedEntityId_idx" ON "IngestionEntry"("linkedEntityType", "linkedEntityId");

-- CreateIndex
CREATE INDEX "IngestionEntry_sourceRef_idx" ON "IngestionEntry"("sourceRef");

-- CreateIndex
CREATE INDEX "IngestionEntry_receivedAt_idx" ON "IngestionEntry"("receivedAt");

-- CreateIndex
CREATE INDEX "IngestionEntry_createdAt_idx" ON "IngestionEntry"("createdAt");

-- CreateIndex
CREATE INDEX "IngestionAuditLog_ingestionEntryId_action_idx" ON "IngestionAuditLog"("ingestionEntryId", "action");

-- CreateIndex
CREATE INDEX "IngestionAuditLog_createdAt_idx" ON "IngestionAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AiActionItem_userId_status_idx" ON "AiActionItem"("userId", "status");

-- CreateIndex
CREATE INDEX "AiActionItem_organizationId_status_idx" ON "AiActionItem"("organizationId", "status");

-- CreateIndex
CREATE INDEX "AiActionItem_organizationId_taskStatus_idx" ON "AiActionItem"("organizationId", "taskStatus");

-- CreateIndex
CREATE INDEX "AiActionItem_taskStatus_priority_idx" ON "AiActionItem"("taskStatus", "priority");

-- CreateIndex
CREATE INDEX "AiActionItem_type_idx" ON "AiActionItem"("type");

-- CreateIndex
CREATE INDEX "AiActionItem_status_idx" ON "AiActionItem"("status");

-- CreateIndex
CREATE INDEX "AiActionItem_createdAt_idx" ON "AiActionItem"("createdAt");

-- CreateIndex
CREATE INDEX "AiActionItem_updatedAt_idx" ON "AiActionItem"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CanaryConfig_documentType_key" ON "CanaryConfig"("documentType");

-- CreateIndex
CREATE INDEX "CanaryConfig_documentType_idx" ON "CanaryConfig"("documentType");

-- CreateIndex
CREATE INDEX "CanaryConfig_stage_idx" ON "CanaryConfig"("stage");

-- CreateIndex
CREATE INDEX "CanaryApprovalRecord_documentType_idx" ON "CanaryApprovalRecord"("documentType");

-- CreateIndex
CREATE INDEX "CanaryApprovalRecord_performedBy_idx" ON "CanaryApprovalRecord"("performedBy");

-- CreateIndex
CREATE INDEX "CanaryApprovalRecord_createdAt_idx" ON "CanaryApprovalRecord"("createdAt");

-- CreateIndex
CREATE INDEX "AiProcessingLog_organizationId_documentType_idx" ON "AiProcessingLog"("organizationId", "documentType");

-- CreateIndex
CREATE INDEX "AiProcessingLog_processingPath_idx" ON "AiProcessingLog"("processingPath");

-- CreateIndex
CREATE INDEX "AiProcessingLog_createdAt_idx" ON "AiProcessingLog"("createdAt");

-- CreateIndex
CREATE INDEX "AiProcessingLog_incidentTriggered_idx" ON "AiProcessingLog"("incidentTriggered");

-- CreateIndex
CREATE UNIQUE INDEX "StabilizationBaseline_canonicalSlot_key" ON "StabilizationBaseline"("canonicalSlot");

-- CreateIndex
CREATE INDEX "StabilizationBaseline_baselineVersion_idx" ON "StabilizationBaseline"("baselineVersion");

-- CreateIndex
CREATE INDEX "StabilizationBaseline_lifecycleState_idx" ON "StabilizationBaseline"("lifecycleState");

-- CreateIndex
CREATE INDEX "StabilizationBaseline_baselineStatus_idx" ON "StabilizationBaseline"("baselineStatus");

-- CreateIndex
CREATE INDEX "StabilizationBaseline_createdAt_idx" ON "StabilizationBaseline"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StabilizationSnapshot_snapshotId_key" ON "StabilizationSnapshot"("snapshotId");

-- CreateIndex
CREATE INDEX "StabilizationSnapshot_baselineId_idx" ON "StabilizationSnapshot"("baselineId");

-- CreateIndex
CREATE INDEX "StabilizationSnapshot_snapshotType_idx" ON "StabilizationSnapshot"("snapshotType");

-- CreateIndex
CREATE INDEX "StabilizationSnapshot_baselineId_snapshotType_idx" ON "StabilizationSnapshot"("baselineId", "snapshotType");

-- CreateIndex
CREATE INDEX "StabilizationSnapshot_createdAt_idx" ON "StabilizationSnapshot"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StabilizationAuthorityLine_authorityLineId_key" ON "StabilizationAuthorityLine"("authorityLineId");

-- CreateIndex
CREATE INDEX "StabilizationAuthorityLine_currentAuthorityId_idx" ON "StabilizationAuthorityLine"("currentAuthorityId");

-- CreateIndex
CREATE INDEX "StabilizationAuthorityLine_authorityState_idx" ON "StabilizationAuthorityLine"("authorityState");

-- CreateIndex
CREATE INDEX "StabilizationAuthorityLine_baselineId_idx" ON "StabilizationAuthorityLine"("baselineId");

-- CreateIndex
CREATE INDEX "StabilizationAuthorityLine_correlationId_idx" ON "StabilizationAuthorityLine"("correlationId");

-- CreateIndex
CREATE INDEX "StabilizationAuthorityLine_createdAt_idx" ON "StabilizationAuthorityLine"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StabilizationIncident_incidentId_key" ON "StabilizationIncident"("incidentId");

-- CreateIndex
CREATE INDEX "StabilizationIncident_incidentId_idx" ON "StabilizationIncident"("incidentId");

-- CreateIndex
CREATE INDEX "StabilizationIncident_correlationId_idx" ON "StabilizationIncident"("correlationId");

-- CreateIndex
CREATE INDEX "StabilizationIncident_baselineId_idx" ON "StabilizationIncident"("baselineId");

-- CreateIndex
CREATE INDEX "StabilizationIncident_severity_idx" ON "StabilizationIncident"("severity");

-- CreateIndex
CREATE INDEX "StabilizationIncident_status_idx" ON "StabilizationIncident"("status");

-- CreateIndex
CREATE INDEX "StabilizationIncident_createdAt_idx" ON "StabilizationIncident"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StabilizationAuditEvent_eventId_key" ON "StabilizationAuditEvent"("eventId");

-- CreateIndex
CREATE INDEX "StabilizationAuditEvent_correlationId_idx" ON "StabilizationAuditEvent"("correlationId");

-- CreateIndex
CREATE INDEX "StabilizationAuditEvent_eventType_idx" ON "StabilizationAuditEvent"("eventType");

-- CreateIndex
CREATE INDEX "StabilizationAuditEvent_incidentId_idx" ON "StabilizationAuditEvent"("incidentId");

-- CreateIndex
CREATE INDEX "StabilizationAuditEvent_baselineId_idx" ON "StabilizationAuditEvent"("baselineId");

-- CreateIndex
CREATE INDEX "StabilizationAuditEvent_occurredAt_idx" ON "StabilizationAuditEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "StabilizationAuditEvent_recordedAt_idx" ON "StabilizationAuditEvent"("recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalAuditEvent_eventId_key" ON "CanonicalAuditEvent"("eventId");

-- CreateIndex
CREATE INDEX "CanonicalAuditEvent_correlationId_idx" ON "CanonicalAuditEvent"("correlationId");

-- CreateIndex
CREATE INDEX "CanonicalAuditEvent_timelineId_idx" ON "CanonicalAuditEvent"("timelineId");

-- CreateIndex
CREATE INDEX "CanonicalAuditEvent_eventType_idx" ON "CanonicalAuditEvent"("eventType");

-- CreateIndex
CREATE INDEX "CanonicalAuditEvent_incidentId_idx" ON "CanonicalAuditEvent"("incidentId");

-- CreateIndex
CREATE INDEX "CanonicalAuditEvent_baselineId_idx" ON "CanonicalAuditEvent"("baselineId");

-- CreateIndex
CREATE INDEX "CanonicalAuditEvent_occurredAt_idx" ON "CanonicalAuditEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "CanonicalAuditEvent_recordedAt_idx" ON "CanonicalAuditEvent"("recordedAt");

-- CreateIndex
CREATE INDEX "CanonicalAuditEvent_parentEventId_idx" ON "CanonicalAuditEvent"("parentEventId");

-- CreateIndex
CREATE UNIQUE INDEX "StabilizationLock_lockKey_key" ON "StabilizationLock"("lockKey");

-- CreateIndex
CREATE INDEX "StabilizationLock_targetType_idx" ON "StabilizationLock"("targetType");

-- CreateIndex
CREATE INDEX "StabilizationLock_expiresAt_idx" ON "StabilizationLock"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "StabilizationRecoveryRecord_recoveryId_key" ON "StabilizationRecoveryRecord"("recoveryId");

-- CreateIndex
CREATE INDEX "StabilizationRecoveryRecord_correlationId_idx" ON "StabilizationRecoveryRecord"("correlationId");

-- CreateIndex
CREATE INDEX "StabilizationRecoveryRecord_recoveryState_idx" ON "StabilizationRecoveryRecord"("recoveryState");

-- CreateIndex
CREATE INDEX "NotificationEvent_entityType_entityId_idx" ON "NotificationEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "NotificationEvent_eventType_idx" ON "NotificationEvent"("eventType");

-- CreateIndex
CREATE INDEX "NotificationEvent_createdAt_idx" ON "NotificationEvent"("createdAt");

-- CreateIndex
CREATE INDEX "NotificationAction_recipientId_status_idx" ON "NotificationAction"("recipientId", "status");

-- CreateIndex
CREATE INDEX "NotificationAction_status_idx" ON "NotificationAction"("status");

-- CreateIndex
CREATE INDEX "NotificationAction_entityType_entityId_idx" ON "NotificationAction"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ApprovalBaseline_poNumber_idx" ON "ApprovalBaseline"("poNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalBaseline_poNumber_approvalDecidedAt_key" ON "ApprovalBaseline"("poNumber", "approvalDecidedAt");

-- CreateIndex
CREATE INDEX "OutboundHistory_poId_idx" ON "OutboundHistory"("poId");

-- CreateIndex
CREATE UNIQUE INDEX "OutboundHistory_poId_seqIndex_key" ON "OutboundHistory"("poId", "seqIndex");

-- CreateIndex
CREATE INDEX "POCandidate_userId_idx" ON "POCandidate"("userId");

-- CreateIndex
CREATE INDEX "POCandidate_organizationId_idx" ON "POCandidate"("organizationId");

-- CreateIndex
CREATE INDEX "POCandidate_stage_idx" ON "POCandidate"("stage");

-- CreateIndex
CREATE INDEX "POCandidateItem_candidateId_idx" ON "POCandidateItem"("candidateId");

-- CreateIndex
CREATE INDEX "ReviewQueueDraft_userId_idx" ON "ReviewQueueDraft"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewQueueDraft_userId_key" ON "ReviewQueueDraft"("userId");

-- CreateIndex
CREATE INDEX "GovernanceEventDedupe_poNumber_idx" ON "GovernanceEventDedupe"("poNumber");

-- CreateIndex
CREATE INDEX "GovernanceEventDedupe_expiresAt_idx" ON "GovernanceEventDedupe"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "GovernanceEventDedupe_poNumber_eventType_signatureKey_key" ON "GovernanceEventDedupe"("poNumber", "eventType", "signatureKey");

-- CreateIndex
CREATE UNIQUE INDEX "GovernanceAuditLog_eventId_key" ON "GovernanceAuditLog"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "GovernanceAuditLog_envelopeHash_key" ON "GovernanceAuditLog"("envelopeHash");

-- CreateIndex
CREATE INDEX "GovernanceAuditLog_correlationId_idx" ON "GovernanceAuditLog"("correlationId");

-- CreateIndex
CREATE INDEX "GovernanceAuditLog_actorUserId_idx" ON "GovernanceAuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "GovernanceAuditLog_actionType_idx" ON "GovernanceAuditLog"("actionType");

-- CreateIndex
CREATE INDEX "GovernanceAuditLog_targetEntityType_targetEntityId_idx" ON "GovernanceAuditLog"("targetEntityType", "targetEntityId");

-- CreateIndex
CREATE INDEX "GovernanceAuditLog_envelopeHash_idx" ON "GovernanceAuditLog"("envelopeHash");

-- CreateIndex
CREATE INDEX "GovernanceAuditLog_occurredAt_idx" ON "GovernanceAuditLog"("occurredAt");

-- CreateIndex
CREATE INDEX "SpendingCategory_organizationId_isActive_idx" ON "SpendingCategory"("organizationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SpendingCategory_organizationId_name_key" ON "SpendingCategory"("organizationId", "name");

-- CreateIndex
CREATE INDEX "CategoryBudget_organizationId_yearMonth_idx" ON "CategoryBudget"("organizationId", "yearMonth");

-- CreateIndex
CREATE INDEX "CategoryBudget_categoryId_idx" ON "CategoryBudget"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryBudget_organizationId_categoryId_yearMonth_key" ON "CategoryBudget"("organizationId", "categoryId", "yearMonth");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetEvent_budgetEventKey_key" ON "BudgetEvent"("budgetEventKey");

-- CreateIndex
CREATE INDEX "BudgetEvent_organizationId_yearMonth_idx" ON "BudgetEvent"("organizationId", "yearMonth");

-- CreateIndex
CREATE INDEX "BudgetEvent_sourceEntityId_idx" ON "BudgetEvent"("sourceEntityId");

-- CreateIndex
CREATE INDEX "BudgetEvent_categoryId_yearMonth_idx" ON "BudgetEvent"("categoryId", "yearMonth");

-- CreateIndex
CREATE UNIQUE INDEX "MutationAuditEvent_auditEventKey_key" ON "MutationAuditEvent"("auditEventKey");

-- CreateIndex
CREATE INDEX "MutationAuditEvent_orgId_occurredAt_idx" ON "MutationAuditEvent"("orgId", "occurredAt");

-- CreateIndex
CREATE INDEX "MutationAuditEvent_entityType_entityId_idx" ON "MutationAuditEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "MutationAuditEvent_actorId_idx" ON "MutationAuditEvent"("actorId");

-- CreateIndex
CREATE INDEX "MutationAuditEvent_action_idx" ON "MutationAuditEvent"("action");

-- CreateIndex
CREATE INDEX "MutationAuditEvent_correlationId_idx" ON "MutationAuditEvent"("correlationId");

-- CreateIndex
CREATE INDEX "MutationAuditEvent_route_idx" ON "MutationAuditEvent"("route");

-- CreateIndex
CREATE UNIQUE INDEX "ContactInquiry_referenceId_key" ON "ContactInquiry"("referenceId");

-- CreateIndex
CREATE INDEX "ContactInquiry_email_idx" ON "ContactInquiry"("email");

-- CreateIndex
CREATE INDEX "ContactInquiry_inquiryType_idx" ON "ContactInquiry"("inquiryType");

-- CreateIndex
CREATE INDEX "ContactInquiry_status_idx" ON "ContactInquiry"("status");

-- CreateIndex
CREATE INDEX "ContactInquiry_createdAt_idx" ON "ContactInquiry"("createdAt");

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVendor" ADD CONSTRAINT "ProductVendor_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVendor" ADD CONSTRAINT "ProductVendor_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comparison" ADD CONSTRAINT "Comparison_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparisonProduct" ADD CONSTRAINT "ComparisonProduct_comparisonId_fkey" FOREIGN KEY ("comparisonId") REFERENCES "Comparison"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparisonProduct" ADD CONSTRAINT "ComparisonProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "QuoteTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_parentQuoteId_fkey" FOREIGN KEY ("parentQuoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteTemplate" ADD CONSTRAINT "QuoteTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteTemplate" ADD CONSTRAINT "QuoteTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteListItem" ADD CONSTRAINT "QuoteListItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteListItem" ADD CONSTRAINT "QuoteListItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteResponse" ADD CONSTRAINT "QuoteResponse_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteResponse" ADD CONSTRAINT "QuoteResponse_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBillingRecord" ADD CONSTRAINT "VendorBillingRecord_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchHistory" ADD CONSTRAINT "SearchHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchHistory" ADD CONSTRAINT "SearchHistory_clickedProductId_fkey" FOREIGN KEY ("clickedProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRecommendation" ADD CONSTRAINT "ProductRecommendation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRecommendation" ADD CONSTRAINT "ProductRecommendation_recommendedProductId_fkey" FOREIGN KEY ("recommendedProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationFeedback" ADD CONSTRAINT "RecommendationFeedback_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "ProductRecommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductInventory" ADD CONSTRAINT "ProductInventory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductInventory" ADD CONSTRAINT "ProductInventory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductInventory" ADD CONSTRAINT "ProductInventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryUsage" ADD CONSTRAINT "InventoryUsage_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "ProductInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryUsage" ADD CONSTRAINT "InventoryUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryRestock" ADD CONSTRAINT "InventoryRestock_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "ProductInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryRestock" ADD CONSTRAINT "InventoryRestock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryRestock" ADD CONSTRAINT "InventoryRestock_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "ProductInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedList" ADD CONSTRAINT "SharedList_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRecord" ADD CONSTRAINT "PurchaseRecord_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRecord" ADD CONSTRAINT "PurchaseRecord_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRecord" ADD CONSTRAINT "PurchaseRecord_normalizedCategoryId_fkey" FOREIGN KEY ("normalizedCategoryId") REFERENCES "SpendingCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceInvite" ADD CONSTRAINT "WorkspaceInvite_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationInvite" ADD CONSTRAINT "OrganizationInvite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompareInquiryDraft" ADD CONSTRAINT "CompareInquiryDraft_compareSessionId_fkey" FOREIGN KEY ("compareSessionId") REFERENCES "CompareSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteRfqToken" ADD CONSTRAINT "QuoteRfqToken_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundEmail" ADD CONSTRAINT "InboundEmail_matchedQuoteId_fkey" FOREIGN KEY ("matchedQuoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteReply" ADD CONSTRAINT "QuoteReply_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteReplyAttachment" ADD CONSTRAINT "QuoteReplyAttachment_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "QuoteReply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteVendor" ADD CONSTRAINT "QuoteVendor_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteShare" ADD CONSTRAINT "QuoteShare_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteVendorRequest" ADD CONSTRAINT "QuoteVendorRequest_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteVendorResponseItem" ADD CONSTRAINT "QuoteVendorResponseItem_vendorRequestId_fkey" FOREIGN KEY ("vendorRequestId") REFERENCES "QuoteVendorRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteVendorResponseItem" ADD CONSTRAINT "QuoteVendorResponseItem_quoteItemId_fkey" FOREIGN KEY ("quoteItemId") REFERENCES "QuoteListItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBudget" ADD CONSTRAINT "UserBudget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBudget" ADD CONSTRAINT "UserBudget_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBudgetTransaction" ADD CONSTRAINT "UserBudgetTransaction_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "UserBudget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBudgetTransaction" ADD CONSTRAINT "UserBudgetTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInventory" ADD CONSTRAINT "UserInventory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataAuditLog" ADD CONSTRAINT "DataAuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataAuditLog" ADD CONSTRAINT "DataAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingInfo" ADD CONSTRAINT "BillingInfo_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionEntry" ADD CONSTRAINT "IngestionEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionEntry" ADD CONSTRAINT "IngestionEntry_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionAuditLog" ADD CONSTRAINT "IngestionAuditLog_ingestionEntryId_fkey" FOREIGN KEY ("ingestionEntryId") REFERENCES "IngestionEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiActionItem" ADD CONSTRAINT "AiActionItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiActionItem" ADD CONSTRAINT "AiActionItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StabilizationSnapshot" ADD CONSTRAINT "StabilizationSnapshot_baselineId_fkey" FOREIGN KEY ("baselineId") REFERENCES "StabilizationBaseline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StabilizationAuthorityLine" ADD CONSTRAINT "StabilizationAuthorityLine_baselineId_fkey" FOREIGN KEY ("baselineId") REFERENCES "StabilizationBaseline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StabilizationIncident" ADD CONSTRAINT "StabilizationIncident_baselineId_fkey" FOREIGN KEY ("baselineId") REFERENCES "StabilizationBaseline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationAction" ADD CONSTRAINT "NotificationAction_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "NotificationEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "POCandidateItem" ADD CONSTRAINT "POCandidateItem_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "POCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpendingCategory" ADD CONSTRAINT "SpendingCategory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryBudget" ADD CONSTRAINT "CategoryBudget_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryBudget" ADD CONSTRAINT "CategoryBudget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "SpendingCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetEvent" ADD CONSTRAINT "BudgetEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

