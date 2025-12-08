"use client";

import { useLocaleStore } from "@/lib/store/locale-store";
import { locales } from "@/lib/i18n/translations";
import { useTranslation } from "@/hooks/use-translation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe } from "lucide-react";

const localeLabels: Record<string, string> = {
  ko: "한국어",
  en: "English",
};

export function LocaleSwitcher() {
  const { locale, setLocale } = useLocaleStore();
  const { t } = useTranslation();

  return (
    <Select value={locale} onValueChange={(value) => setLocale(value as typeof locale)}>
      <SelectTrigger className="w-[140px]">
        <Globe className="h-4 w-4 mr-2" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {locales.map((loc) => (
          <SelectItem key={loc} value={loc}>
            {localeLabels[loc]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}