import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { PageIntro, SectionHeading } from "@/components/site";
import { formatInteger } from "@/lib/format";
import { localizedPath } from "@/lib/i18n";
import { getLocale } from "@/lib/locale-server";
import { getCompetitionSeries } from "@/lib/queries";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return locale === "de" ? { title: "Wettkämpfe", description: "Entwicklung wiederkehrender Steinstoss-Wettkämpfe über alle archivierten Jahre." } : { title: "Competitions", description: "Development of recurring stone-throwing competitions across all archived years." };
}

export default async function CompetitionsPage() {
  const locale = await getLocale();
  const en = locale === "en";
  const series = getCompetitionSeries();
  const longSeries = series.filter((item) => item.seasons >= 3);
  const otherSeries = series.filter((item) => item.seasons < 3);
  const p = (path: string) => localizedPath(locale, path);
  return <>
    <PageIntro eyebrow={en ? "Tradition compared" : "Tradition im Vergleich"} title={en ? "Competitions across the years" : "Wettkämpfe über die Jahre"} lead={en ? "More than one ranking: every competition series shows participation, recorded throws and stone-weight-specific performance across its editions." : "Nicht nur eine Rangliste: Jede Wettkampfserie zeigt Teilnahme, erfasste Stösse und gewichtsspezifische Leistungsentwicklung über ihre Austragungen."}><div className="intro-stat"><strong>{series.length}</strong><span>{en ? "identified competition series" : "erkannte Wettkampfreihen"}</span></div></PageIntro>
    <section className="section shell section-first">
      <SectionHeading title={en ? "Recurring competitions" : "Wiederkehrende Wettkämpfe"} description={en ? "Series with at least three archived seasons. Several PDFs from the same edition may contain different categories." : "Reihen mit mindestens drei archivierten Saisons. Mehrere PDFs derselben Austragung können unterschiedliche Kategorien enthalten."} />
      <div className="competition-list">{longSeries.map((item) => <Link href={p(`/wettkaempfe/${item.slug}`)} className="competition-row" key={item.slug}>
        <div className="competition-years"><strong>{item.firstSeason}</strong><span>{en ? "to" : "bis"}</span><strong>{item.lastSeason}</strong></div><div><p className="micro-label">{item.seasons} {en ? "seasons" : "Saisons"} · {item.competitions} {en ? "source documents" : "Quelldokumente"}</p><h2>{item.name}</h2></div><div className="competition-stats"><span><strong>{formatInteger(item.athletes, locale)}</strong> {en ? "athletes" : "Athlet:innen"}</span><span><strong>{formatInteger(item.results, locale)}</strong> {en ? "results" : "Resultate"}</span><span><strong>{formatInteger(item.recordedThrows, locale)}</strong> {en ? "recorded throws" : "erfasste Stösse"}</span></div><ArrowRight size={22} />
      </Link>)}</div>
    </section>
    <section className="section section-tint"><div className="shell"><SectionHeading title={en ? "Individual and young archive series" : "Einzelne und junge Archivserien"} description={en ? "Events with one or two documented seasons—already searchable and ready for future additions." : "Veranstaltungen mit einer oder zwei dokumentierten Saisons – bereits durchsuchbar und bereit für zukünftige Ergänzungen."} />
      <div className="compact-series-grid">{otherSeries.map((item) => <Link href={p(`/wettkaempfe/${item.slug}`)} key={item.slug}><span>{item.firstSeason}{item.lastSeason !== item.firstSeason ? `–${item.lastSeason}` : ""}</span><strong>{item.name}</strong><small>{formatInteger(item.results, locale)} {en ? "results" : "Resultate"}</small></Link>)}</div>
    </div></section>
  </>;
}
