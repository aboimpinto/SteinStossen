import Link from "next/link";
import { ArrowRight, CalendarDays, Database, Footprints, Trophy, UsersRound } from "lucide-react";

import { ParticipationChart, SeasonOverviewChart } from "@/components/charts";
import { AthleteCard, DataTrustStrip, MetricCard, SectionHeading } from "@/components/site";
import { formatInteger } from "@/lib/format";
import { localizedPath } from "@/lib/i18n";
import { getLocale } from "@/lib/locale-server";
import { getCompetitionSeries, getOverview, getSeasonTrends, getTopAthletes } from "@/lib/queries";

export default async function Home() {
  const locale = await getLocale();
  const en = locale === "en";
  const overview = getOverview();
  const seasons = getSeasonTrends();
  const athletes = getTopAthletes(8);
  const series = getCompetitionSeries(8);
  const p = (path: string) => localizedPath(locale, path);

  return (
    <>
      <section className="hero">
        <div className="shell hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">{en ? "Swiss tradition · made readable" : "Schweizer Tradition · neu lesbar"}</p>
            <h1>{en ? "Every throw tells a story of progress." : "Jeder Stoss erzählt eine Entwicklung."}</h1>
            <p className="hero-lead">{en ? "More than twenty years of PDF rankings become a connected view of athletes, seasons and recurring competitions." : "Aus mehr als zwanzig Jahren PDF-Ranglisten entsteht erstmals eine zusammenhängende Sicht auf Athlet:innen, Saisons und wiederkehrende Wettkämpfe."}</p>
            <div className="hero-actions">
              <Link href={p("/athleten")} className="button button-primary">{en ? "Discover athletes" : "Athlet:innen entdecken"} <ArrowRight size={17} /></Link>
              <Link href={p("/saisons")} className="button button-secondary">{en ? "Explore sport development" : "Sportentwicklung ansehen"}</Link>
            </div>
            <DataTrustStrip locale={locale} />
          </div>
          <div className="hero-stone" aria-hidden="true">
            <div className="stone-orbit orbit-one" /><div className="stone-orbit orbit-two" />
            <div className="stone-shape"><span>{en ? "since" : "seit"}</span><strong>{overview.firstSeason}</strong><small>{formatInteger(overview.results, locale)} {en ? "results" : "Resultate"}</small></div>
          </div>
        </div>
      </section>

      <section className="metrics-band"><div className="shell metrics-grid">
        <MetricCard label={en ? "Archived seasons" : "Archivierte Saisons"} value={overview.seasons} note={`${overview.firstSeason} ${en ? "to" : "bis"} ${overview.lastSeason}`} icon={<CalendarDays size={20} />} />
        <MetricCard label={en ? "Athletes identified" : "Athlet:innen erkannt"} value={formatInteger(overview.athletes, locale)} note={`${formatInteger(overview.women, locale)} ${en ? "women" : "Frauen"} · ${formatInteger(overview.men, locale)} ${en ? "men" : "Männer"}*`} icon={<UsersRound size={20} />} />
        <MetricCard label={en ? "Competition documents" : "Wettkampfdokumente"} value={formatInteger(overview.competitions, locale)} note={`${overview.competitionSeries} ${en ? "recurring series" : "wiederkehrende Reihen"}`} icon={<Trophy size={20} />} />
        <MetricCard label={en ? "Recorded successful throws" : "Erfasste gültige Stösse"} value={formatInteger(overview.recordedThrows, locale)} note={`${formatInteger(overview.explicitAttemptResults, locale)} ${en ? "results with attempt data" : "Resultate mit Versuchsdaten"}`} icon={<Footprints size={20} />} />
      </div></section>

      <section className="section shell">
        <SectionHeading eyebrow={en ? "The sport over time" : "Sport im Zeitverlauf"} title={en ? "More than individual rankings" : "Mehr als einzelne Ranglisten"} description={en ? "Participation and competition density per season. 2020 remains visible as a documented archive gap." : "Teilnahme und Wettkampfdichte pro Saison. 2020 bleibt als dokumentierte Archivlücke sichtbar."} action={<Link className="text-link" href={p("/saisons")}>{en ? "All seasons" : "Alle Saisons"} <ArrowRight size={15} /></Link>} />
        <SeasonOverviewChart data={seasons} locale={locale} />
        <p className="chart-caption">{en ? "* Women/men classifications are used only where category or stone weight makes them reliable. Unspecified categories remain separate." : "* Die Frauen-/Männer-Zuordnung wird nur dort verwendet, wo sie aus Kategorie oder Steingewicht verlässlich hervorgeht. Nicht ausgewiesene Kategorien bleiben separat."}</p>
      </section>

      <section className="section section-tint"><div className="shell">
        <SectionHeading eyebrow={en ? "Performance across decades" : "Leistung über Jahrzehnte"} title={en ? "Making women and men visible" : "Frauen und Männer sichtbar machen"} description={en ? "Participation is separated by stated competition category. Performance trends also always compare the same stone weight." : "Die Teilnahme wird nach ausgewiesener Wettkampfkategorie getrennt. Qualitätstrends vergleichen zusätzlich immer dasselbe Steingewicht."} />
        <ParticipationChart data={seasons} locale={locale} />
      </div></section>

      <section className="section shell">
        <SectionHeading eyebrow={en ? "Personal timelines" : "Persönliche Zeitreihen"} title={en ? "Athletes with the longest data trail" : "Athlet:innen mit der längsten Datenspur"} description={en ? "Not only victories: every recorded season contributes to the story of athletic development." : "Nicht nur Siege: Jede erfasste Saison trägt zur Geschichte einer sportlichen Entwicklung bei."} action={<Link className="text-link" href={p("/athleten")}>{en ? "All profiles" : "Alle Profile"} <ArrowRight size={15} /></Link>} />
        <div className="athlete-grid">{athletes.map((athlete) => <AthleteCard athlete={athlete} locale={locale} key={athlete.slug} />)}</div>
      </section>

      <section className="section section-dark"><div className="shell">
        <SectionHeading eyebrow={en ? "Recurring competitions" : "Wiederkehrende Wettkämpfe"} title={en ? "Tradition becomes measurable" : "Tradition wird messbar"} description={en ? "How do participant fields, recorded throws and best distances in the same event develop over time?" : "Wie entwickeln sich Teilnehmerfelder, erfasste Stösse und Bestweiten derselben Veranstaltung über die Jahre?"} action={<Link className="text-link text-link-light" href={p("/wettkaempfe")}>{en ? "All competitions" : "Alle Wettkämpfe"} <ArrowRight size={15} /></Link>} />
        <div className="series-grid">{series.map((item) => <Link href={p(`/wettkaempfe/${item.slug}`)} className="series-card" key={item.slug}><p className="micro-label">{item.firstSeason}–{item.lastSeason}</p><h3>{item.name}</h3><div><span><strong>{item.seasons}</strong> {en ? "seasons" : "Saisons"}</span><span><strong>{formatInteger(item.athletes, locale)}</strong> {en ? "athletes" : "Athlet:innen"}</span><span><strong>{formatInteger(item.recordedThrows, locale)}</strong> {en ? "recorded throws" : "erfasste Stösse"}</span></div><ArrowRight className="series-arrow" size={20} /></Link>)}</div>
      </div></section>

      <section className="section shell provenance-callout">
        <div className="provenance-icon"><Database size={28} /></div>
        <div><p className="eyebrow">{en ? "Traceable, not magical" : "Nachvollziehbar statt magisch"}</p><h2>{en ? "Every value leads back to its source document." : "Jeder Wert führt zurück zum Quelldokument."}</h2><p>{en ? `${formatInteger(overview.sourceDocuments - 3, locale)} result PDFs were imported into the database; ${formatInteger(overview.ocrDocuments, locale)} required OCR. Missing individual attempts are not added. The methodology explains coverage, limitations and identity rules.` : `${formatInteger(overview.sourceDocuments - 3, locale)} Resultat-PDFs wurden vollständig in die Datenbank aufgenommen; ${formatInteger(overview.ocrDocuments, locale)} davon benötigten OCR. Fehlende Einzelversuche werden nicht ergänzt. Die Methodik zeigt Abdeckung, Grenzen und Identitätsregeln offen.`}</p></div>
        <Link href={p("/methodik")} className="button button-secondary">{en ? "Read methodology" : "Methodik lesen"} <ArrowRight size={16} /></Link>
      </section>
    </>
  );
}
