import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, CalendarRange, Ruler, Scale, Trophy, Weight } from "lucide-react";
import { notFound } from "next/navigation";

import { AthleteProgressExplorer } from "@/components/charts";
import { CategoryBadge, MetricCard, SectionHeading } from "@/components/site";
import { dimensionLabel, formatInteger, formatMetres, formatSex, formatWeight } from "@/lib/format";
import { localizedPath } from "@/lib/i18n";
import { getLocale } from "@/lib/locale-server";
import { getAthlete, getAthleteDimensions, getAthleteProgress, getAthleteResults } from "@/lib/queries";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const locale = await getLocale();
  const { slug } = await params;
  const athlete = getAthlete(slug);
  if (!athlete) return { title: locale === "de" ? "Profil nicht gefunden" : "Profile not found" };
  return { title: athlete.displayName, description: locale === "de" ? `${athlete.displayName}: Entwicklung und Steinstoss-Resultate von ${athlete.firstSeason} bis ${athlete.lastSeason}.` : `${athlete.displayName}: stone-throwing development and results from ${athlete.firstSeason} to ${athlete.lastSeason}.` };
}

export default async function AthletePage({ params }: { params: Promise<{ slug: string }> }) {
  const locale = await getLocale();
  const en = locale === "en";
  const { slug } = await params;
  const athlete = getAthlete(slug);
  if (!athlete) notFound();
  const dimensions = getAthleteDimensions(slug);
  const progress = getAthleteProgress(slug);
  const results = getAthleteResults(slug, 120);
  const seasons = athlete.lastSeason - athlete.firstSeason + 1;
  const p = (path: string) => localizedPath(locale, path);

  return <>
    <section className="athlete-hero"><div className="shell athlete-hero-grid">
      <div className="athlete-profile-image">{athlete.profileImageUrl ? <Image src={athlete.profileImageUrl} alt={`${en ? "Portrait of" : "Porträt"} ${athlete.displayName}`} fill priority sizes="(max-width: 760px) 90vw, 380px" /> : <span>{athlete.displayName.split(" ").slice(0, 2).map((part) => part[0]).join("")}</span>}</div>
      <div className="athlete-hero-copy"><p className="eyebrow">{en ? "Athlete profile" : "Athletenprofil"} · {formatSex(athlete.sex, locale)}</p><h1>{athlete.displayName}</h1><p className="lead">{en ? `A data trail spanning ${seasons} calendar years—separated by category, technique and stone weight.` : `Eine Datenspur über ${seasons} Kalenderjahre – getrennt nach Kategorie, Technik und Steingewicht.`}</p>
        <div className="profile-facts">
          {athlete.birthYear ? <span><CalendarRange size={17} /> {en ? "Born" : "Jahrgang"} {athlete.birthYear}</span> : null}
          {athlete.heightCm ? <span><Ruler size={17} /> {athlete.heightCm} cm</span> : null}
          {athlete.bodyWeightKg ? <span><Weight size={17} /> {athlete.bodyWeightKg} kg</span> : null}
          {athlete.careerStartYear ? <span><Trophy size={17} /> {en ? "active since" : "aktiv seit"} {athlete.careerStartYear}</span> : null}
        </div>
        {athlete.officialStatus ? <CategoryBadge tone="red">{athlete.officialStatus === "active" ? (en ? "Listed as active on steinstossen.ch" : "Auf steinstossen.ch als aktiv geführt") : (en ? "Official former athlete profile" : "Offizielles Ehemaligenprofil")}</CategoryBadge> : <CategoryBadge>{en ? "Identified in historical rankings" : "Aus historischen Ranglisten erkannt"}</CategoryBadge>}
      </div>
    </div></section>

    <section className="metrics-band profile-metrics"><div className="shell metrics-grid">
      <MetricCard label={en ? "Archived results" : "Archivierte Resultate"} value={formatInteger(athlete.resultCount, locale)} note={en ? "across all comparable categories" : "über alle vergleichbaren Kategorien"} />
      <MetricCard label={en ? "Competition documents" : "Wettkampfdokumente"} value={formatInteger(athlete.competitions, locale)} note={`${athlete.firstSeason} ${en ? "to" : "bis"} ${athlete.lastSeason}`} />
      <MetricCard label={en ? "Discipline variants" : "Disziplinvarianten"} value={dimensions.length} note={en ? "Sex · weight · age group · technique" : "Sex · Gewicht · Altersklasse · Technik"} icon={<Scale size={20} />} />
      <MetricCard label={en ? "Recorded seasons" : "Erfasste Saisons"} value={new Set(progress.map((item) => item.season)).size} note={en ? "Archive gaps remain visible" : "Archivlücken bleiben sichtbar"} />
    </div></section>

    <section className="section shell"><SectionHeading eyebrow={en ? "Personal progression" : "Persönliche Progression"} title={en ? "Season by season" : "Saison für Saison"} description={en ? "Best and average competition-best distances—always within the same category and stone weight." : "Bestleistung und durchschnittliche Wettkampfbestleistung – immer innerhalb derselben Kategorie und desselben Steingewichts."} /><AthleteProgressExplorer dimensions={dimensions} progress={progress} locale={locale} /></section>

    <section className="section section-tint"><div className="shell"><SectionHeading eyebrow={en ? "Discipline profile" : "Disziplinprofil"} title={en ? "Where the data trail lies" : "Wo die Datenspur liegt"} description={en ? "Similar PDF labels are made comparable through sex, age group, weight and technique." : "Ähnliche Beschriftungen aus den PDFs werden über Sex, Altersklasse, Gewicht und Technik vergleichbar gemacht."} />
      <div className="table-wrap"><table><thead><tr>{[en ? "Category" : "Kategorie", en ? "Seasons" : "Saisons", en ? "Results" : "Resultate", en ? "Best distance" : "Bestweite", en ? "Average best" : "Ø Bestweite", en ? "Period" : "Zeitraum"].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{dimensions.map((item) => <tr key={item.key}><td>{dimensionLabel(item, locale)}</td><td>{item.seasons}</td><td>{item.results}</td><td><strong>{formatMetres(item.bestDistance, locale)}</strong></td><td>{formatMetres(item.averageBest, locale)}</td><td>{item.firstSeason}–{item.lastSeason}</td></tr>)}</tbody></table></div>
    </div></section>

    <section className="section shell"><SectionHeading eyebrow={en ? "Source record" : "Quellennachweis"} title={en ? "Latest archived results" : "Die letzten archivierten Resultate"} description={en ? "Every row links to the original PDF. Attempt data means individual throws were explicitly listed in the document." : "Jede Zeile verlinkt das ursprüngliche PDF. Ein Häkchen bei Versuchsdaten bedeutet, dass Einzelstösse explizit im Dokument standen."} />
      <div className="table-wrap result-table"><table><thead><tr>{[en ? "Season" : "Saison", en ? "Competition" : "Wettkampf", en ? "Category" : "Kategorie", en ? "Rank" : "Rang", en ? "Best distance" : "Bestweite", en ? "Attempts" : "Versuche", en ? "Source" : "Quelle"].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{results.map((result, index) => <tr key={`${result.sourceUrl}-${result.sourcePage}-${index}`}>
        <td><Link href={p(`/saisons/${result.season}`)}>{result.season}</Link></td><td><Link href={p(`/wettkaempfe/${result.seriesSlug}`)}>{result.competitionName}</Link></td><td><span>{formatSex(result.sex, locale)} · {formatWeight(result.stoneWeightKg, locale)}</span><small>{result.categoryLabel}</small></td><td>{result.rank ?? "—"}</td><td><strong>{formatMetres(result.bestDistance, locale)}</strong></td><td>{result.explicitAttempts ? `${result.successfulThrows} ${en ? "successful recorded" : "gültig erfasst"}` : (en ? "best only" : "nur Bestweite")}</td><td><a className="source-link" href={result.sourceUrl} target="_blank" rel="noreferrer">PDF {en ? "p." : "S."} {result.sourcePage} <ArrowUpRight size={13} /></a></td>
      </tr>)}</tbody></table></div>
    </section>
  </>;
}
