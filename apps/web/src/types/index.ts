// 제품 관련 타입
export type ProductCategory = "REAGENT" | "TOOL" | "EQUIPMENT" | "RAW_MATERIAL";

export type UserRole = "RESEARCHER" | "BUYER" | "SUPPLIER" | "ADMIN";

export type OrganizationRole = "VIEWER" | "REQUESTER" | "APPROVER" | "ADMIN";

export type QuoteStatus = "PENDING" | "SENT" | "RESPONDED" | "COMPLETED" | "CANCELLED";

export interface Product {
  id: string;
  name: string;
  nameEn?: string;
  description?: string;
  descriptionEn?: string;
  descriptionTranslated?: string;
  category: ProductCategory;
  brand?: string;
  modelNumber?: string;
  catalogNumber?: string;
  lotNumber?: string; // Lot 번호 (배치 번호)
  specifications?: Record<string, unknown>;
  datasheetUrl?: string;
  imageUrl?: string;
  msdsUrl?: string; // MSDS/SDS 문서 URL
  safetyNote?: string; // 안전 취급 요약/주의사항
  // 안전 필드 구조화 (P2)
  hazardCodes?: string[]; // 위험 코드 배열 (예: ["H314", "H290"])
  pictograms?: string[]; // GHS 피크토그램 배열 (예: ["corrosive", "exclamation"])
  storageCondition?: string; // 보관 조건 (예: "2~8°C 냉장 보관")
  ppe?: string[]; // 개인보호장비 배열 (예: ["gloves", "goggles"])
  
  // 원료(원부자재) 전용 필드 (P1)
  coaUrl?: string; // COA (Certificate of Analysis) URL
  specSheetUrl?: string; // Spec Sheet URL
  pharmacopoeia?: string; // 규정/표준 (예: "USP", "EP", "JP", "KP")
  countryOfOrigin?: string; // 원산지
  manufacturer?: string; // 제조사
  expiryDate?: Date; // 유효기간
  
  vendors?: ProductVendor[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Vendor {
  id: string;
  name: string;
  nameEn?: string;
  email?: string;
  phone?: string;
  website?: string;
  country?: string;
  currency?: string;
}

export interface ProductVendor {
  id: string;
  productId: string;
  vendorId: string;
  price?: number;
  currency: string;
  priceInKRW?: number;
  stockStatus?: string;
  leadTime?: number;
  minOrderQty?: number;
  url?: string;
  vendor?: Vendor;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  image?: string;
  role: UserRole;
  organization?: string;
  organizationMembers?: OrganizationMember[];
}

export interface Organization {
  id: string;
  name: string;
  description?: string;
  members?: OrganizationMember[];
}

export interface OrganizationMember {
  id: string;
  userId: string;
  organizationId: string;
  role: OrganizationRole;
  user?: User;
  organization?: Organization;
}

export interface Comparison {
  id: string;
  userId: string;
  name?: string;
  products: ComparisonProduct[];
  createdAt: Date;
}

export interface ComparisonProduct {
  id: string;
  comparisonId: string;
  productId: string;
  order: number;
  product: Product;
}

export interface Quote {
  id: string;
  userId: string;
  organizationId?: string;
  comparisonId?: string;
  title: string;
  message?: string;
  messageEn?: string;
  deliveryDate?: Date;
  deliveryLocation?: string;
  specialNotes?: string;
  status: QuoteStatus;
  items: QuoteItem[];
  responses?: QuoteResponse[];
  createdAt: Date;
}

export interface QuoteItem {
  id: string;
  quoteId: string;
  productId: string;
  quantity: number;
  notes?: string;
  product?: Product;
}

export interface QuoteResponse {
  id: string;
  quoteId: string;
  vendorId: string;
  totalPrice?: number;
  currency: string;
  message?: string;
  validUntil?: Date;
  vendor?: Vendor;
  createdAt: Date;
}

export interface SearchIntent {
  category?: ProductCategory;
  purpose?: string;
  targetExperiment?: string;
  properties?: string[];
  brandPreference?: string[];
  priceRange?: {
    min?: number;
    max?: number;
  };
  suggestedFilters?: string[];
}

export interface ProductRecommendation {
  id: string;
  productId: string;
  recommendedProductId: string;
  score: number;
  reason?: string;
  reasonEn?: string;
  recommendedProduct?: Product;
  feedbacks?: RecommendationFeedback[];
}

export interface RecommendationFeedback {
  id: string;
  userId?: string;
  recommendationId: string;
  isHelpful: boolean;
  reason?: string;
  createdAt: Date;
}

export interface Review {
  id: string;
  userId: string;
  productId: string;
  rating: number;
  title?: string;
  comment?: string;
  pros?: string;
  cons?: string;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    name?: string;
    email?: string;
    image?: string;
  };
}
