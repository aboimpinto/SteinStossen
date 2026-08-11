import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Database, Mountain, Scale, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

import { LanguageSwitcher } from "@/components/language-switcher";
import { formatInteger, formatSex } from "@/lib/format";
import { localizedPath, type Locale } from "@/lib/i18n";
import type { AthleteListItem } from "@/lib/queries";

export function SiteHeader({ locale }: { locale: Locale }) {
  const copy = locale === "de"
    ? { home: "Steinstossen Zeitreihen Startseite", subtitle: "Zeitreihen & Leistung", athletes: "Athlet:innen", competitions: "Wettkämpfe", seasons: "Saisons", method: "Methodik", nav: "Hauptnavigation" }
    : { home: "Steinstossen timelines home", subtitle: "Timelines & performance", athletes: "Athletes", competitions: "Competitions", seasons: "Seasons", method: "Methodology", nav: "Main navigation" };
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link href={localizedPath(locale)} className="brand" aria-label={copy.home}>
          <span className="brand-mark"><Mountain size={23} strokeWidth={2.2} /></span>
          <span><strong>Steinstossen</strong><small>{copy.subtitle}</small></span>
        </Link>
        <div className="header-navigation">
          <nav aria-label={copy.nav}>
            <Link href={localizedPath(locale, "/athleten")}>{copy.athletes}</Link>
            <Link href={localizedPath(locale, "/wettkaempfe")}>{copy.competitions}</Link>
            <Link href={localizedPath(locale, "/saisons")}>{copy.seasons}</Link>
            <Link href={localizedPath(locale, "/methodik")}>{copy.method}</Link>
          </nav>
          <LanguageSwitcher locale={locale} />
        </div>
      </div>
    </header>
  );
}

export function SiteFooter({ locale }: { locale: Locale }) {
  const copy = locale === "de"
    ? { independent: "Eine unabhängige Datenansicht von Aboim Pinto Consulting. Kein Ersatz für offizielle Ranglisten.", source: "Datenquelle", archive: "steinstossen.ch · PDF-Archiv", principle: "Grundsatz", separate: "Frauen, Männer, Altersklasse, Technik und Steingewicht werden getrennt verglichen." }
    : { independent: "An independent data view by Aboim Pinto Consulting. It does not replace official rankings.", source: "Data source", archive: "steinstossen.ch · PDF archive", principle: "Principle", separate: "Women, men, age groups, techniques and stone weights are compared separately." };
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div>
          <div className="brand footer-brand"><span className="brand-mark"><Mountain size={20} /></span><span><strong>Steinstossen {locale === "de" ? "Zeitreihen" : "Timelines"}</strong></span></div>
          <p>{copy.independent}</p>
        </div>
        <div><strong>{copy.source}</strong><a href="https://steinstossen.ch/reglement-ranglisten/" target="_blank" rel="noreferrer">{copy.archive} <ArrowUpRight size={14} /></a></div>
        <div><strong>{copy.principle}</strong><p>{copy.separate}</p></div>
      </div>
    </footer>
  );
}

export function PageIntro({ eyebrow, title, lead, children }: { eyebrow: string; title: string; lead: string; children?: ReactNode }) {
  return <section className="page-intro"><div className="shell page-intro-grid"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="lead">{lead}</p></div>{children ? <div className="intro-aside">{children}</div> : null}</div></section>;
}

export function SectionHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="section-heading"><div>{eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}<h2>{title}</h2>{description ? <p>{description}</p> : null}</div>{action}</div>;
}

export function MetricCard({ label, value, note, icon }: { label: string; value: string | number; note?: string; icon?: ReactNode }) {
  return <article className="metric-card"><div className="metric-card-top"><span>{label}</span>{icon}</div><strong>{value}</strong>{note ? <p>{note}</p> : null}</article>;
}

export function DataTrustStrip({ locale }: { locale: Locale }) {
  const copy = locale === "de"
    ? ["PDF-Quellen bleiben verlinkt", "Gewichte werden getrennt verglichen", "Fehlende Versuche werden nicht erfunden"]
    : ["PDF sources remain linked", "Stone weights are compared separately", "Missing attempts are never invented"];
  return <div className="trust-strip"><span><Database size={17} /> {copy[0]}</span><span><Scale size={17} /> {copy[1]}</span><span><ShieldCheck size={17} /> {copy[2]}</span></div>;
}

export function AthleteCard({ athlete, locale }: { athlete: AthleteListItem; locale: Locale }) {
  const copy = locale === "de"
    ? { active: "Offizielles Aktivprofil", former: "Ehemaligenprofil", results: "Resultate", competitions: "Wettkämpfe" }
    : { active: "Official active profile", former: "Former athlete profile", results: "Results", competitions: "Competitions" };
  return (
    <Link href={localizedPath(locale, `/athleten/${athlete.slug}`)} className="athlete-card">
      <div className="athlete-portrait">
        {athlete.profileImageUrl ? <Image src={athlete.profileImageUrl} alt="" fill sizes="(max-width: 700px) 45vw, 220px" className="athlete-image" /> : <span>{athlete.displayName.split(" ").slice(0, 2).map((part) => part[0]).join("")}</span>}
        {athlete.officialStatus ? <em>{athlete.officialStatus === "active" ? copy.active : copy.former}</em> : null}
      </div>
      <div className="athlete-card-body">
        <p className="micro-label">{formatSex(athlete.sex, locale)} · {athlete.firstSeason}–{athlete.lastSeason}</p>
        <h3>{athlete.displayName}</h3>
        <div className="athlete-card-stats"><span><strong>{formatInteger(athlete.resultCount, locale)}</strong> {copy.results}</span><span><strong>{formatInteger(athlete.competitions, locale)}</strong> {copy.competitions}</span></div>
      </div>
    </Link>
  );
}

export function CategoryBadge({ children, tone = "stone" }: { children: ReactNode; tone?: "red" | "stone" | "gold" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
