import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { SeasonMetricChart, SeasonOverviewChart } from "@/components/charts";
import { PageIntro, SectionHeading } from "@/components/site";
import { formatInteger, formatMetres } from "@/lib/format";
import { localizedPath } from "@/lib/i18n";
import { getLocale } from "@/lib/locale-server";
import { getSeasonTrends } from "@/lib/queries";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return locale === "de" ? { title: "Saisons", description: "Steinstossen Saisonstatistiken: Wettkämpfe, Teilnahme, Stösse und Kategorien seit 2004." } : { title: "Seasons", description: "Stone-throwing season statistics: competitions, participation, throws and categories since 2004." };
}

export default async function SeasonsPage() {
  const locale = await getLocale();
  const en = locale === "en";
  const seasons = getSeasonTrends();
  const documented = seasons.filter((season) => season.competitions > 0).reverse();
  const p = (path: string) => localizedPath(locale, path);
  return <>
    <PageIntro eyebrow={en ? "The sport as a whole" : "Der Sport als Ganzes"} title={en ? "Season by season" : "Saison für Saison"} lead={en ? "How does participation grow? How many competitions and throws are documented? And in which categories does performance develop?" : "Wie wächst das Teilnehmerfeld? Wie viele Wettkämpfe und Stösse sind dokumentiert? Und in welchen Kategorien entwickelt sich die Qualität?"}><div className="intro-stat"><strong>{documented.length}</strong><span>{en ? "documented seasons" : "dokumentierte Saisons"}</span></div></PageIntro>
    <section className="section shell section-first"><SectionHeading title={en ? "Participation and competition density" : "Teilnahme und Wettkampfdichte"} description={en ? "Archive coverage grows across the years. Coverage and performance are therefore shown separately." : "Die Archivabdeckung wächst über die Jahre. Deshalb zeigt die Seite Umfang und Leistung getrennt."} /><SeasonOverviewChart data={[...seasons]} locale={locale} /></section>
    <section className="section section-tint"><div className="shell"><SectionHeading title={en ? "Recorded successful throws" : "Erfasste gültige Stösse"} description={en ? "Where individual attempts are missing, only the documented best distance counts as at least one successful throw. See the methodology for details." : "Wo Einzelversuche fehlen, zählt nur die belegte Bestweite als mindestens ein erfolgreicher Stoss. Details stehen in der Methodik."} /><SeasonMetricChart data={[...seasons]} locale={locale} /></div></section>
    <section className="section shell"><SectionHeading title={en ? "Season archive" : "Saisonarchiv"} description={en ? "Each season opens competitions, categories, weights and stone-weight-specific athlete and competition averages." : "Jede Saison öffnet Wettkämpfe, Kategorien, Gewichte sowie gewichtsspezifische Athleten- und Wettkampfdurchschnitte."} />
      <div className="season-grid">{documented.map((season) => <Link href={p(`/saisons/${season.season}`)} className="season-card" key={season.season}><div className="season-year">{season.season}</div><div className="season-card-grid"><span><strong>{season.competitions}</strong> {en ? "competition documents" : "Wettkampfdokumente"}</span><span><strong>{formatInteger(season.athletes, locale)}</strong> {en ? "athletes" : "Athlet:innen"}</span><span><strong>{formatInteger(season.successfulThrows, locale)}</strong> {en ? "recorded throws" : "erfasste Stösse"}</span><span><strong>{formatMetres(season.recordedDistance, locale)}</strong> {en ? "total distance" : "Gesamtdistanz"}</span></div><ArrowRight size={20} /></Link>)}</div>
    </section>
  </>;
}
