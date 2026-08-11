import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, Footprints, Ruler, UsersRound } from "lucide-react";
import { notFound } from "next/navigation";

import { MetricCard, SectionHeading } from "@/components/site";
import { dimensionLabel, formatInteger, formatMetres } from "@/lib/format";
import { localizedPath } from "@/lib/i18n";
import { getLocale } from "@/lib/locale-server";
import { getSeasonAthleteAverages, getSeasonCompetitions, getSeasonDimensions, getSeasonSummary } from "@/lib/queries";

export async function generateMetadata({ params }: { params: Promise<{ year: string }> }): Promise<Metadata> {
  const locale = await getLocale();
  const { year } = await params;
  return { title: `${locale === "de" ? "Saison" : "Season"} ${year}`, description: locale === "de" ? `Steinstossen-Saison ${year}: Wettkämpfe, Athlet:innen, Stösse und gewichtsspezifische Leistung.` : `Stone-throwing season ${year}: competitions, athletes, throws and stone-weight-specific performance.` };
}

export default async function SeasonPage({ params }: { params: Promise<{ year: string }> }) {
  const locale = await getLocale();
  const en = locale === "en";
  const { year: yearParam } = await params;
  const year = Number(yearParam);
  if (!Number.isInteger(year)) notFound();
  const summary = getSeasonSummary(year);
  if (!summary) notFound();
  const competitions = getSeasonCompetitions(year);
  const dimensions = getSeasonDimensions(year);
  const athleteAverages = getSeasonAthleteAverages(year, 50);
  const p = (path: string) => localizedPath(locale, path);

  return <>
    <section className="season-hero"><div className="shell"><p className="eyebrow">{en ? "Season analysis" : "Saisonanalyse"}</p><h1>{year}</h1><p className="lead">{en ? "One year of stone throwing: coverage, participation and performance—comparable only within the same category and stone weight." : "Ein Jahr Steinstossen: Umfang, Teilnahme und Qualität – vergleichbar nur innerhalb derselben Kategorie und desselben Steingewichts."}</p><div className="season-switch"><Link href={p(`/saisons/${year - 1}`)}>← {year - 1}</Link><Link href={p("/saisons")}>{en ? "All seasons" : "Alle Saisons"}</Link><Link href={p(`/saisons/${year + 1}`)}>{year + 1} →</Link></div></div></section>
    <section className="metrics-band profile-metrics"><div className="shell metrics-grid">
      <MetricCard label={en ? "Competition documents" : "Wettkampfdokumente"} value={summary.competitions} note={en ? "including separately published categories" : "inklusive separat publizierter Kategorien"} icon={<CalendarDays size={20} />} />
      <MetricCard label={en ? "Athletes" : "Athlet:innen"} value={formatInteger(summary.athletes, locale)} note={`${formatInteger(summary.women, locale)} ${en ? "women" : "Frauen"} · ${formatInteger(summary.men, locale)} ${en ? "men" : "Männer"}`} icon={<UsersRound size={20} />} />
      <MetricCard label={en ? "Recorded successful throws" : "Erfasste gültige Stösse"} value={formatInteger(summary.successfulThrows, locale)} note={en ? "explicit attempts or documented best distance" : "explizite Versuche oder belegte Bestweite"} icon={<Footprints size={20} />} />
      <MetricCard label={en ? "Documented distance" : "Dokumentierte Distanz"} value={formatMetres(summary.recordedDistance, locale)} note={en ? "archive scope across all weights" : "Archivumfang über alle Gewichte"} icon={<Ruler size={20} />} />
    </div></section>
    <section className="section shell"><SectionHeading eyebrow={en ? "Stone-weight-specific" : "Gewichtsspezifisch"} title={en ? "Season categories" : "Kategorien der Saison"} description={en ? "Best and average distances are meaningful only within exactly the same dimension." : "Best- und Durchschnittsweiten sind nur innerhalb exakt derselben Dimension aussagekräftig."} />
      <div className="table-wrap"><table><thead><tr>{[en ? "Category" : "Kategorie", en ? "Participants" : "Teilnehmende", en ? "Results" : "Resultate", en ? "Recorded throws" : "Erfasste Stösse", en ? "Best distance" : "Beste Weite", en ? "Average best" : "Ø Bestweite"].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{dimensions.map((item) => <tr key={item.dimensionKey}><td>{dimensionLabel(item, locale)}</td><td>{formatInteger(item.participants, locale)}</td><td>{formatInteger(item.results, locale)}</td><td>{formatInteger(item.successfulThrows, locale)}</td><td><strong>{formatMetres(item.bestDistance, locale)}</strong></td><td>{formatMetres(item.averageBest, locale)}</td></tr>)}</tbody></table></div>
    </section>
    <section className="section section-tint"><div className="shell"><SectionHeading eyebrow={en ? "Consistency" : "Konstanz"} title={en ? "Average by athlete and category" : "Durchschnitt nach Athlet:in und Kategorie"} description={en ? "Only people with at least two competition entries in the same category. Different weights are never averaged." : "Nur Personen mit mindestens zwei Wettkampfeinträgen in derselben Kategorie. Unterschiedliche Gewichte werden nicht gemittelt."} />
      <div className="table-wrap"><table><thead><tr>{[en ? "Athlete" : "Athlet:in", en ? "Category" : "Kategorie", en ? "Competitions" : "Wettkämpfe", en ? "Best distance" : "Bestweite", en ? "Average best" : "Ø Bestweite"].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{athleteAverages.map((item) => <tr key={`${item.athleteSlug}-${item.dimensionKey}`}><td><Link href={p(`/athleten/${item.athleteSlug}`)}><strong>{item.athleteName}</strong></Link></td><td>{dimensionLabel(item, locale)}</td><td>{item.competitions}</td><td>{formatMetres(item.bestDistance, locale)}</td><td>{formatMetres(item.averageBest, locale)}</td></tr>)}</tbody></table></div>
    </div></section>
    <section className="section shell"><SectionHeading eyebrow={en ? "Season calendar" : "Saisonkalender"} title={en ? "Competitions and source documents" : "Wettkämpfe und Quellendokumente"} description={en ? "Averages and totals remain traceable to the original PDF." : "Durchschnitts- und Summenwerte bleiben bis zum Original-PDF nachvollziehbar."} />
      <div className="season-competition-list">{competitions.map((competition) => <article key={competition.slug}><div className="season-competition-date"><strong>{competition.competitionDate?.slice(5).split("-").reverse().join(".") ?? "—"}</strong><span>{competition.competitionDate ? competition.competitionDate.slice(0, 4) : year}</span></div><div><p className="micro-label">{competition.seriesName}</p><h3><Link href={p(`/wettkaempfe/${competition.seriesSlug}`)}>{competition.name}</Link></h3><p>{formatInteger(competition.athletes, locale)} {en ? "athletes" : "Athlet:innen"} · {formatInteger(competition.results, locale)} {en ? "results" : "Resultate"} · {formatInteger(competition.successfulThrows, locale)} {en ? "recorded throws" : "erfasste Stösse"}</p></div><a href={competition.sourceUrl} target="_blank" rel="noreferrer">PDF <ArrowUpRight size={15} /></a></article>)}</div>
    </section>
  </>;
}
