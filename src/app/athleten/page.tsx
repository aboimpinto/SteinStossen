import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";

import { AthleteCard, PageIntro, SectionHeading } from "@/components/site";
import { formatInteger } from "@/lib/format";
import { localizedPath } from "@/lib/i18n";
import { getLocale } from "@/lib/locale-server";
import { searchAthletes } from "@/lib/queries";

const PAGE_SIZE = 48;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return locale === "de" ? { title: "Athlet:innen", description: "Steinstoss-Athletenprofile mit Saison- und Langzeitentwicklung." } : { title: "Athletes", description: "Stone-throwing athlete profiles with season and long-term development." };
}

export default async function AthletesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const locale = await getLocale();
  const en = locale === "en";
  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  const page = Math.max(1, Number(params.page) || 1);
  const { athletes, total } = searchAthletes(search, page, PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const base = localizedPath(locale, "/athleten");

  return <>
    <PageIntro eyebrow={en ? "Personal development" : "Persönliche Entwicklung"} title={en ? "Athletes over time" : "Athlet:innen im Zeitverlauf"} lead={en ? "A profile for every person identified in the rankings—regardless of rank, experience or number of seasons." : "Ein Profil für jede in den Ranglisten erkannte Person – unabhängig von Rang, Erfahrung oder Anzahl Saisons."}>
      <div className="intro-stat"><strong>{formatInteger(total, locale)}</strong><span>{search ? (en ? "profiles found" : "gefundene Profile") : (en ? "profiles in the archive" : "Profile im Archiv")}</span></div>
    </PageIntro>
    <section className="section shell section-first">
      <form className="search-form" action={base} method="get"><Search size={20} /><input name="q" defaultValue={search} placeholder={en ? "Search by name, e.g. Hutmacher Urs" : "Name suchen, z. B. Hutmacher Urs"} aria-label={en ? "Search for an athlete" : "Athlet oder Athletin suchen"} /><button className="button button-primary" type="submit">{en ? "Search" : "Suchen"}</button></form>
      <SectionHeading title={search ? (en ? `Results for “${search}”` : `Resultate für „${search}“`) : (en ? "All identified profiles" : "Alle erkannten Profile")} description={en ? "Sorted by the number of archived results. Name variants are merged conservatively; uncertain cases remain separate." : "Sortiert nach Anzahl der archivierten Resultate. Namensvarianten werden konservativ zusammengeführt; unsichere Fälle bleiben getrennt."} />
      {athletes.length ? <div className="athlete-grid">{athletes.map((athlete) => <AthleteCard athlete={athlete} locale={locale} key={athlete.slug} />)}</div> : <div className="empty-state">{en ? "No person with this name was found." : "Keine Person mit diesem Namen gefunden."}</div>}
      {pages > 1 ? <nav className="pagination" aria-label={en ? "Pagination" : "Seitennavigation"}>
        <Link aria-disabled={page <= 1} className={page <= 1 ? "disabled" : ""} href={`${base}?q=${encodeURIComponent(search)}&page=${Math.max(1, page - 1)}`}>{en ? "Previous" : "Zurück"}</Link>
        <span>{en ? `Page ${page} of ${pages}` : `Seite ${page} von ${pages}`}</span>
        <Link aria-disabled={page >= pages} className={page >= pages ? "disabled" : ""} href={`${base}?q=${encodeURIComponent(search)}&page=${Math.min(pages, page + 1)}`}>{en ? "Next" : "Weiter"}</Link>
      </nav> : null}
    </section>
  </>;
}
