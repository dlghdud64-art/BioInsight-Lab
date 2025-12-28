"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { ChevronDown } from "lucide-react";

interface SearchFiltersProps {
  categories: string[];
  selectedCategories: string[];
  onCategoriesChange: (categories: string[]) => void;
  
  inStockOnly: boolean;
  onInStockOnlyChange: (value: boolean) => void;
  
  brands: string[];
  selectedBrands: string[];
  onBrandsChange: (brands: string[]) => void;
  
  purities: string[];
  selectedPurities: string[];
  onPuritiesChange: (purities: string[]) => void;
  
  grades: string[];
  selectedGrades: string[];
  onGradesChange: (grades: string[]) => void;
}

const COMMON_BRANDS = [
  "Thermo Fisher Scientific",
  "Sigma-Aldrich",
  "Corning",
  "BD Biosciences",
  "Bio-Rad",
  "Invitrogen",
];

const COMMON_PURITIES = ["≥99%", "≥98%", "≥95%", "≥90%", "≥85%"];
const COMMON_GRADES = ["ACS Grade", "HPLC", "Molecular Biology", "Cell Culture", "Reagent"];

export function SearchFilters({
  categories,
  selectedCategories,
  onCategoriesChange,
  inStockOnly,
  onInStockOnlyChange,
  brands,
  selectedBrands,
  onBrandsChange,
  purities,
  selectedPurities,
  onPuritiesChange,
  grades,
  selectedGrades,
  onGradesChange,
}: SearchFiltersProps) {
  const [showMoreBrands, setShowMoreBrands] = useState(false);
  const displayedBrands = showMoreBrands ? brands : COMMON_BRANDS.slice(0, 5);

  const handleCategoryToggle = (category: string) => {
    if (selectedCategories.includes(category)) {
      onCategoriesChange(selectedCategories.filter((c) => c !== category));
    } else {
      onCategoriesChange([...selectedCategories, category]);
    }
  };

  const handleBrandToggle = (brand: string) => {
    if (selectedBrands.includes(brand)) {
      onBrandsChange(selectedBrands.filter((b) => b !== brand));
    } else {
      onBrandsChange([...selectedBrands, brand]);
    }
  };

  const handlePurityToggle = (purity: string) => {
    if (selectedPurities.includes(purity)) {
      onPuritiesChange(selectedPurities.filter((p) => p !== purity));
    } else {
      onPuritiesChange([...selectedPurities, purity]);
    }
  };

  const handleGradeToggle = (grade: string) => {
    if (selectedGrades.includes(grade)) {
      onGradesChange(selectedGrades.filter((g) => g !== grade));
    } else {
      onGradesChange([...selectedGrades, grade]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Categories */}
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">카테고리</h3>
        <div className="space-y-2">
          {categories.map((category) => (
            <div key={category} className="flex items-center space-x-2">
              <Checkbox
                id={`category-${category}`}
                checked={selectedCategories.includes(category)}
                onCheckedChange={() => handleCategoryToggle(category)}
              />
              <Label
                htmlFor={`category-${category}`}
                className="text-sm text-slate-700 cursor-pointer"
              >
                {category}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Availability */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900">재고 상태</h3>
          <Switch
            checked={inStockOnly}
            onCheckedChange={onInStockOnlyChange}
          />
        </div>
        <Label htmlFor="in-stock-only" className="text-sm text-slate-600 cursor-pointer">
          재고 있는 제품만 보기
        </Label>
      </div>

      <Separator />

      {/* Brand */}
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">브랜드</h3>
        <div className="space-y-2">
          {displayedBrands.map((brand) => (
            <div key={brand} className="flex items-center space-x-2">
              <Checkbox
                id={`brand-${brand}`}
                checked={selectedBrands.includes(brand)}
                onCheckedChange={() => handleBrandToggle(brand)}
              />
              <Label
                htmlFor={`brand-${brand}`}
                className="text-sm text-slate-700 cursor-pointer"
              >
                {brand}
              </Label>
            </div>
          ))}
          {brands.length > COMMON_BRANDS.length && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMoreBrands(!showMoreBrands)}
              className="text-xs text-slate-600 h-7"
            >
              {showMoreBrands ? "간략히" : "더 보기"}
              <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${showMoreBrands ? "rotate-180" : ""}`} />
            </Button>
          )}
        </div>
      </div>

      <Separator />

      {/* Purity */}
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">순도</h3>
        <div className="space-y-2">
          {COMMON_PURITIES.map((purity) => (
            <div key={purity} className="flex items-center space-x-2">
              <Checkbox
                id={`purity-${purity}`}
                checked={selectedPurities.includes(purity)}
                onCheckedChange={() => handlePurityToggle(purity)}
              />
              <Label
                htmlFor={`purity-${purity}`}
                className="text-sm text-slate-700 cursor-pointer"
              >
                {purity}
              </Label>
            </div>
          ))}
          {purities.length > 0 && (
            <div className="space-y-2 mt-2">
              {purities
                .filter((p) => !COMMON_PURITIES.includes(p))
                .map((purity) => (
                  <div key={purity} className="flex items-center space-x-2">
                    <Checkbox
                      id={`purity-${purity}`}
                      checked={selectedPurities.includes(purity)}
                      onCheckedChange={() => handlePurityToggle(purity)}
                    />
                    <Label
                      htmlFor={`purity-${purity}`}
                      className="text-sm text-slate-700 cursor-pointer"
                    >
                      {purity}
                    </Label>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Grade */}
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">등급</h3>
        <div className="space-y-2">
          {COMMON_GRADES.map((grade) => (
            <div key={grade} className="flex items-center space-x-2">
              <Checkbox
                id={`grade-${grade}`}
                checked={selectedGrades.includes(grade)}
                onCheckedChange={() => handleGradeToggle(grade)}
              />
              <Label
                htmlFor={`grade-${grade}`}
                className="text-sm text-slate-700 cursor-pointer"
              >
                {grade}
              </Label>
            </div>
          ))}
          {grades.length > 0 && (
            <div className="space-y-2 mt-2">
              {grades
                .filter((g) => !COMMON_GRADES.includes(g))
                .map((grade) => (
                  <div key={grade} className="flex items-center space-x-2">
                    <Checkbox
                      id={`grade-${grade}`}
                      checked={selectedGrades.includes(grade)}
                      onCheckedChange={() => handleGradeToggle(grade)}
                    />
                    <Label
                      htmlFor={`grade-${grade}`}
                      className="text-sm text-slate-700 cursor-pointer"
                    >
                      {grade}
                    </Label>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

