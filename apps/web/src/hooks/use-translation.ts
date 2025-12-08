import { useLocaleStore } from "@/lib/store/locale-store";
import { translations, TranslationKey } from "@/lib/i18n/translations";

/**
 * 번역 훅
 * @param key 번역 키 (예: "common.search", "product.details")
 * @returns 번역된 문자열
 */
export function useTranslation() {
  const locale = useLocaleStore((state) => state.locale);

  const t = (key: string): string => {
    const keys = key.split(".");
    let value: any = translations[locale];

    for (const k of keys) {
      if (value && typeof value === "object" && k in value) {
        value = value[k as keyof typeof value];
      } else {
        // 키를 찾을 수 없으면 키 자체를 반환
        console.warn(`Translation key not found: ${key}`);
        return key;
      }
    }

    return typeof value === "string" ? value : key;
  };

  return { t, locale };
}

/**
 * 특정 경로의 번역 객체를 반환
 * @param path 번역 경로 (예: "common", "product")
 */