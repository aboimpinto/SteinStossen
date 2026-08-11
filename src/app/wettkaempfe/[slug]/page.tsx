import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CalendarDays, Footprints, Ruler, UsersRound } from "lucide-react";
import { notFound } from "next/navigation";

import { DimensionTrendExplorer, SeriesOverviewChart } from "@/components/charts";
import { AthleteCard, MetricCard, SectionHeading } from "@/components/site";
import { formatInteger, formatMetres } from "@/lib/format";
import { localizedPath } from "@/lib/i18n";
import { getLocale } from "@/lib/locale-server";
import { getSeries, getSeriesDimensionTrends, getSeriesEditions, getSeriesTopAthletes, getSeriesTrends } from "@/lib/queries";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const locale = await getLocale();
  const { slug } = await params;
  const series = getSeries(slug);
  return series ? { title: series.name, description: locale === "de" ? `${series.name}: Entwicklung von Teilnahme und Leistung über ${series.seasons} Saisons.` : `${series.name}: participation and performance development across ${series.seasons} seasons.` } : { title: locale === "de" ? "Wettkampf nicht gefunden" : "Competition not found" };
}

export default async function CompetitionSeriesPage({ params }: { params: Promise<{ slug: string }> }) {
  const locale = await getLocale();
  const en = locale === "en";
  const { slug } = await params;
  const series = getSeries(slug);
  if (!series) notFound();
  const trends = getSeriesTrends(slug);
  const dimensionTrends = getSeriesDimensionTrends(slug);
  const editions = getSeriesEditions(slug);
  const athletes = getSeriesTopAthletes(slug, 8);
  const recordedThrows = trends.reduce((sum, item) => sum + item.successfulThrows, 0);
  const recordedDistance = trends.reduce((sum, item) => sum + item.recordedDistance, 0);
  const p = (path: string) => localizedPath(locale, path);

  return <>
    <section className="competition-hero"><div className="shell"><p className="eyebrow">{en ? "Competition timeline" : "Wettkampf-Zeitreihe"}</p><h1>{series.name}</h1><p className="lead">{en ? `From ${series.firstSeason} to ${series.lastSeason}: participation and performance in the same tradition across ${series.seasons} documented seasons.` : `Von ${series.firstSeason} bis ${series.lastSeason}: Teilnahme und Leistung derselben Tradition über ${series.seasons} dokumentierte Saisons.`}</p><div className="hero-actions"><Link href={p("/wettkaempfe")} className="button button-secondary">← {en ? "All competitions" : "Alle Wettkämpfe"}</Link></div></div></section>
    <section className="metrics-band profile-metrics"><div className="shell metrics-grid">
      <MetricCard label={en ? "Documented seasons" : "Dokumentierte Saisons"} value={series.seasons} note={`${series.competitionDocuments} ${en ? "source documents" : "Quelldokumente"}`} icon={<CalendarDays size={20} />} />
      <MetricCard label={en ? "Athletes" : "Athlet:innen"} value={formatInteger(series.athletes, locale)} note={en ? "unique identified people" : "eindeutige erkannte Personen"} icon={<UsersRound size={20} />} />
      <MetricCard label={en ? "Recorded successful throws" : "Erfasste gültige Stösse"} value={formatInteger(recordedThrows, locale)} note={en ? "attempts, otherwise at least the best distance" : "Versuche, sonst mindestens die Bestweite"} icon={<Footprints size={20} />} />
      <MetricCard label={en ? "Documented total distance" : "Dokumentierte Gesamtdistanz"} value={formatMetres(recordedDistance, locale)} note={en ? "archive scope, not a performance comparison" : "Archivumfang, kein Qualitätsvergleich"} icon={<Ruler size={20} />} />
    </div></section>
    <section className="section shell"><SectionHeading eyebrow={en ? "Edition by edition" : "Austragung für Austragung"} title={en ? "Participation and data coverage" : "Teilnahme und Datenumfang"} description={en ? "The number of successful throws depends on whether a PDF contains individual attempts or only best distances. Missing coverage is never fabricated." : "Die Zahl gültiger Stösse hängt davon ab, ob ein PDF Einzelversuche oder nur Bestweiten enthält. Diese Abdeckung wird nicht künstlich ergänzt."} /><SeriesOverviewChart data={trends} locale={locale} /></section>
    <section className="section section-tint"><div className="shell"><SectionHeading eyebrow={en ? "Comparable performance" : "Qualität statt Äpfel mit Birnen"} title={en ? "Best distances within the same category" : "Bestweiten innerhalb derselben Kategorie"} description={en ? "Women and men, different stone weights and different techniques are never mixed in one performance timeline." : "Frauen und Männer sowie unterschiedliche Steingewichte und Techniken werden niemals in einer Leistungszeitreihe vermischt."} /><DimensionTrendExplorer data={dimensionTrends} locale={locale} /></div></section>
    <section className="section shell"><SectionHeading eyebrow={en ? "Consistency" : "Konstanz"} title={en ? "Athletes with the most entries in this series" : "Athlet:innen mit den meisten Einträgen in dieser Reihe"} /><div className="athlete-grid">{athletes.map((athlete) => <AthleteCard athlete={athlete} locale={locale} key={athlete.slug} />)}</div></section>
    <section className="section section-dark"><div className="shell"><SectionHeading eyebrow={en ? "Original sources" : "Originalquellen"} title={en ? "Archived editions" : "Archivierte Austragungen"} description={en ? "Every analysis remains traceable to the original ranking PDF." : "Jede Auswertung bleibt bis zum ursprünglichen Ranglisten-PDF nachvollziehbar."} />
      <div className="edition-list">{editions.map((edition) => <article key={edition.slug}><div><strong>{edition.season}</strong><span>{edition.competitionDate ?? (en ? "Date not clearly identified in the PDF" : "Datum im PDF nicht eindeutig erkannt")}</span></div><div><h3>{edition.name}</h3><p>{formatInteger(edition.athletes, locale)} {en ? "athletes" : "Athlet:innen"} · {formatInteger(edition.results, locale)} {en ? "results" : "Resultate"} · {formatInteger(edition.recordedThrows, locale)} {en ? "recorded throws" : "erfasste Stösse"}</p></div><a href={edition.sourceUrl} target="_blank" rel="noreferrer">PDF <ArrowUpRight size={15} /></a></article>)}</div>
      <Link href={p("/saisons")} className="text-link text-link-light">{en ? "View in season context" : "Im Saisonkontext ansehen"} <ArrowRight size={15} /></Link>
    </div></section>
  </>;
}
