import Link from "next/link";

import { localizedPath } from "@/lib/i18n";
import { getLocale } from "@/lib/locale-server";

export default async function NotFound() {
  const locale = await getLocale();
  const en = locale === "en";
  return (
    <section className="page-intro">
      <div className="shell prose">
        <p className="eyebrow">404</p>
        <h1>{en ? "Page not found" : "Seite nicht gefunden"}</h1>
        <p className="lead">{en ? "The requested athlete, competition or season is not available in the archive." : "Die gesuchte Person, der Wettkampf oder die Saison ist im Archiv nicht verfügbar."}</p>
        <div className="hero-actions"><Link className="button button-primary" href={localizedPath(locale)}>{en ? "Return to overview" : "Zur Übersicht"}</Link></div>
      </div>
    </section>
  );
}
