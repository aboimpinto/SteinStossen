import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SiteFooter, SiteHeader } from "@/components/site";
import { localeCode } from "@/lib/i18n";
import { getLocale } from "@/lib/locale-server";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return locale === "de"
    ? { title: { default: "Steinstossen · Zeitreihen & Leistung", template: "%s · Steinstossen" }, description: "Athletenprofile, Saisonentwicklung und Wettkampfstatistiken aus dem historischen Schweizer Steinstoss-Archiv." }
    : { title: { default: "Steinstossen · Timelines & performance", template: "%s · Steinstossen" }, description: "Athlete profiles, season development and competition statistics from the historical Swiss stone-throwing archive." };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return <html lang={localeCode(locale)}><body><SiteHeader locale={locale} /><main>{children}</main><SiteFooter locale={locale} /></body></html>;
}
