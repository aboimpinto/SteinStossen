import "server-only";

import { headers } from "next/headers";

import { defaultLocale, isLocale, type Locale } from "@/lib/i18n";

export async function getLocale(): Promise<Locale> {
  const value = (await headers()).get("x-steinstossen-locale");
  return isLocale(value) ? value : defaultLocale;
}
