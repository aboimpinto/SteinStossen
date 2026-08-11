"use client";

import { usePathname } from "next/navigation";

import type { Locale } from "@/lib/i18n";

export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const pathWithoutLocale = pathname.replace(/^\/(de|en)(?=\/|$)/, "") || "/";
  const target = (language: Locale) => `/${language}${pathWithoutLocale === "/" ? "" : pathWithoutLocale}`;

  return (
    <div className="language-switcher" aria-label={locale === "de" ? "Sprache wählen" : "Choose language"}>
      <form action={target("de")} method="get"><button type="submit" aria-current={locale === "de" ? "page" : undefined}>DE</button></form>
      <span aria-hidden="true">/</span>
      <form action={target("en")} method="get"><button type="submit" aria-current={locale === "en" ? "page" : undefined}>EN</button></form>
    </div>
  );
}
