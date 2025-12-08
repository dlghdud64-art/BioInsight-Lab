// 번역 파일
export type Locale = "ko" | "en";

export const locales: Locale[] = ["ko", "en"];
export const defaultLocale: Locale = "ko";

export const translations = {
  ko: {
    // 공통
    common: {
      search: "검색",
      compare: "비교",
      quote: "견적",
      product: "제품",
      vendor: "공급사",
      price: "가격",
      leadTime: "납기",
      stock: "재고",
      add: "추가",
      remove: "제거",
      save: "저장",
      cancel: "취소",
      confirm: "확인",
      loading: "로딩 중...",
      error: "오류",
      success: "성공",
    },
    // 네비게이션
    nav: {
      home: "홈",
      search: "검색",
      compare: "비교",
      quotes: "견적",
      dashboard: "대시보드",
      signIn: "로그인",
      signOut: "로그아웃",
    },
    // 검색
    search: {
      placeholder: "제품명, 브랜드, 카테고리로 검색...",
      results: "검색 결과",
      noResults: "검색 결과가 없습니다",
      intent: "검색 의도",
      category: "카테고리",
      target: "타깃",
      purpose: "용도",
    },
    // 제품
    product: {
      details: "제품 상세",
      specifications: "스펙",
      description: "설명",
      addToCompare: "비교에 추가",
      addToQuote: "견적에 추가",
      removeFromCompare: "비교에서 제거",
      removeFromQuote: "견적에서 제거",
      minPrice: "최저가",
      inStock: "재고 있음",
      outOfStock: "재고 없음",
      priceInquiry: "가격 문의",
    },
    // 비교
    compare: {
      title: "제품 비교",
      empty: "비교할 제품을 추가해주세요",
      addProducts: "제품 검색하기",
      clearAll: "전체 삭제",
      requestQuote: "견적 요청",
      highlightDifferences: "차이점 하이라이트",
      hideDifferences: "차이점 숨기기",
      priceComparison: "가격 비교",
      leadTimeComparison: "납기 비교",
      specComparison: "상세 스펙 비교",
    },
    // 견적
    quote: {
      title: "견적 요청",
      manage: "견적 요청 관리",
      create: "새 견적 요청",
      list: "견적 목록",
      status: {
        pending: "대기 중",
        sent: "발송 완료",
        responded: "응답 받음",
        completed: "완료",
        cancelled: "취소",
      },
      items: "요청 제품",
      responses: "공급사 응답",
      deliveryDate: "납기 희망일",
      deliveryLocation: "납품 장소",
      message: "요청 메시지",
      specialNotes: "특이사항",
    },
    // 대시보드
    dashboard: {
      title: "대시보드",
      recentQuotes: "최근 견적",
      favorites: "즐겨찾기",
      recentProducts: "최근 본 제품",
    },
    // 홈
    home: {
      title: "바이오·제약 시약·기구·장비를\n빠르게 찾고 비교하세요",
      subtitle: "AI가 제품을 분석하고 최적의 옵션을 추천해드립니다",
      recommendedProducts: "추천 제품",
      viewDetails: "상세보기",
      categories: {
        reagent: "시약",
        tool: "기구",
        equipment: "장비",
      },
    },
  },
  en: {
    // Common
    common: {
      search: "Search",
      compare: "Compare",
      quote: "Quote",
      product: "Product",
      vendor: "Vendor",
      price: "Price",
      leadTime: "Lead Time",
      stock: "Stock",
      add: "Add",
      remove: "Remove",
      save: "Save",
      cancel: "Cancel",
      confirm: "Confirm",
      loading: "Loading...",
      error: "Error",
      success: "Success",
    },
    // Navigation
    nav: {
      home: "Home",
      search: "Search",
      compare: "Compare",
      quotes: "Quotes",
      dashboard: "Dashboard",
      signIn: "Sign In",
      signOut: "Sign Out",
    },
    // Search
    search: {
      placeholder: "Search by product name, brand, category...",
      results: "Search Results",
      noResults: "No search results found",
      intent: "Search Intent",
      category: "Category",
      target: "Target",
      purpose: "Purpose",
    },
    // Product
    product: {
      details: "Product Details",
      specifications: "Specifications",
      description: "Description",
      addToCompare: "Add to Compare",
      addToQuote: "Add to Quote",
      removeFromCompare: "Remove from Compare",
      removeFromQuote: "Remove from Quote",
      minPrice: "Min Price",
      inStock: "In Stock",
      outOfStock: "Out of Stock",
      priceInquiry: "Price Inquiry",
    },
    // Compare
    compare: {
      title: "Product Comparison",
      empty: "Please add products to compare",
      addProducts: "Search Products",
      clearAll: "Clear All",
      requestQuote: "Request Quote",
      highlightDifferences: "Highlight Differences",
      hideDifferences: "Hide Differences",
      priceComparison: "Price Comparison",
      leadTimeComparison: "Lead Time Comparison",
      specComparison: "Detailed Spec Comparison",
    },
    // Quote
    quote: {
      title: "Quote Request",
      manage: "Quote Management",
      create: "New Quote Request",
      list: "Quote List",
      status: {
        pending: "Pending",
        sent: "Sent",
        responded: "Responded",
        completed: "Completed",
        cancelled: "Cancelled",
      },
      items: "Requested Products",
      responses: "Vendor Responses",
      deliveryDate: "Delivery Date",
      deliveryLocation: "Delivery Location",
      message: "Request Message",
      specialNotes: "Special Notes",
    },
    // Dashboard
    dashboard: {
      title: "Dashboard",
      recentQuotes: "Recent Quotes",
      favorites: "Favorites",
      recentProducts: "Recent Products",
    },
    // Home
    home: {
      title: "Find and Compare\nBio & Pharma Reagents, Tools & Equipment Quickly",
      subtitle: "AI analyzes products and recommends the best options for you",
      recommendedProducts: "Recommended Products",
      viewDetails: "View Details",
      categories: {
        reagent: "Reagent",
        tool: "Tool",
        equipment: "Equipment",
      },
    },
  },
} as const;

// 번역 키 타입 (중첩된 키를 점 표기법으로 지원)
export type TranslationKey = 
  | "common.search" | "common.compare" | "common.quote" | "common.product" | "common.vendor" | "common.price" | "common.leadTime" | "common.stock" | "common.add" | "common.remove" | "common.save" | "common.cancel" | "common.confirm" | "common.loading" | "common.error" | "common.success"
  | "nav.home" | "nav.search" | "nav.compare" | "nav.quotes" | "nav.dashboard" | "nav.signIn" | "nav.signOut"
  | "search.placeholder" | "search.results" | "search.noResults" | "search.intent" | "search.category" | "search.target" | "search.purpose"
  | "product.details" | "product.specifications" | "product.description" | "product.addToCompare" | "product.addToQuote" | "product.removeFromCompare" | "product.removeFromQuote" | "product.minPrice" | "product.inStock" | "product.outOfStock" | "product.priceInquiry"
  | "compare.title" | "compare.empty" | "compare.addProducts" | "compare.clearAll" | "compare.requestQuote" | "compare.highlightDifferences" | "compare.hideDifferences" | "compare.priceComparison" | "compare.leadTimeComparison" | "compare.specComparison"
  | "quote.title" | "quote.manage" | "quote.create" | "quote.list" | "quote.status.pending" | "quote.status.sent" | "quote.status.responded" | "quote.status.completed" | "quote.status.cancelled" | "quote.items" | "quote.responses" | "quote.deliveryDate" | "quote.deliveryLocation" | "quote.message" | "quote.specialNotes"
  | "dashboard.title" | "dashboard.recentQuotes" | "dashboard.favorites" | "dashboard.recentProducts"
  | "home.title" | "home.subtitle" | "home.recommendedProducts" | "home.viewDetails" | "home.categories.reagent" | "home.categories.tool" | "home.categories.equipment";



export const locales: Locale[] = ["ko", "en"];
export const defaultLocale: Locale = "ko";