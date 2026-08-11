import type { Metadata } from "next";
import { CheckCircle2, FileSearch, Scale, ShieldAlert } from "lucide-react";

import { MetricCard, PageIntro, SectionHeading } from "@/components/site";
import { formatInteger } from "@/lib/format";
import { getLocale } from "@/lib/locale-server";
import { getOverview } from "@/lib/queries";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return locale === "de" ? { title: "Methodik", description: "Quellen, PDF-Import, OCR, Athleten-Deduplizierung und Grenzen der Steinstoss-Zeitreihen." } : { title: "Methodology", description: "Sources, PDF import, OCR, athlete deduplication and limitations of the stone-throwing timelines." };
}

export default async function MethodPage() {
  const locale = await getLocale();
  const en = locale === "en";
  const overview = getOverview();
  const resultDocuments = overview.sourceDocuments - 3;
  const attemptCoverage = overview.results ? Math.round((overview.explicitAttemptResults / overview.results) * 100) : 0;
  return <>
    <PageIntro eyebrow={en ? "Open data methodology" : "Offene Datenmethodik"} title={en ? "What the numbers say—and what they do not" : "Was die Zahlen sagen – und was nicht"} lead={en ? "Historical PDFs are valuable but inconsistent. This page explains how results are identified, people are merged and gaps are handled." : "Historische PDFs sind wertvoll, aber nicht einheitlich. Diese Seite legt offen, wie Resultate erkannt, Personen zusammengeführt und Lücken behandelt werden."} />
    <section className="metrics-band profile-metrics"><div className="shell metrics-grid">
      <MetricCard label={en ? "Result documents" : "Resultatdokumente"} value={resultDocuments} note={en ? "all with at least one identified result" : "alle mit mindestens einem erkannten Resultat"} />
      <MetricCard label={en ? "OCR documents" : "OCR-Dokumente"} value={overview.ocrDocuments} note={en ? "image PDFs and scanned tables" : "Bild-PDFs und gescannte Tabellen"} />
      <MetricCard label={en ? "Result rows" : "Resultatzeilen"} value={formatInteger(overview.results, locale)} note={en ? "with a link to the source document" : "mit Link zum Quelldokument"} />
      <MetricCard label={en ? "Explicit attempt coverage" : "Explizite Versuchsabdeckung"} value={`${attemptCoverage}%`} note={`${formatInteger(overview.explicitAttemptResults, locale)} ${en ? "results with individual attempts" : "Resultate mit Einzelstössen"}`} />
    </div></section>
    <section className="section shell method-grid">
      <article className="method-card"><FileSearch size={27} /><h2>1. {en ? "Sources" : "Quellen"}</h2><p>{en ? "The source is the ranking archive on steinstossen.ch. 305 result documents from 2004 to 2026 were imported. Three annual standings remain as references but are not counted as individual competitions." : "Die Quelle ist das Ranglistenarchiv auf steinstossen.ch. 305 Resultatdokumente von 2004 bis 2026 wurden importiert. Drei Jahreswertungsdokumente bleiben als Referenz erhalten, werden aber nicht als einzelne Wettkämpfe gezählt."}</p><a href="https://steinstossen.ch/reglement-ranglisten/" target="_blank" rel="noreferrer">{en ? "Open official archive" : "Offizielles Archiv öffnen"} ↗</a></article>
      <article className="method-card"><CheckCircle2 size={27} /><h2>2. {en ? "Extraction" : "Extraktion"}</h2><p>{en ? "Text-based PDFs are read directly. Images and scans are processed with OCR. The source document, page, raw result line and extraction method are stored so every number remains verifiable." : "Textbasierte PDFs werden direkt gelesen. Bilddateien und Scans werden mit OCR verarbeitet. Gespeichert werden Quelldokument, Seite, rohe Resultatzeile und Extraktionsmethode. Damit bleibt jede Zahl prüfbar."}</p></article>
      <article className="method-card"><Scale size={27} /><h2>3. {en ? "Comparability" : "Vergleichbarkeit"}</h2><p>{en ? "Performance is compared only for the same sex or stated category, stone weight, age group and technique. A 6 kg distance is never averaged with a 40 kg distance." : "Leistungswerte werden nur bei gleichem Sex beziehungsweise ausgewiesener Kategorie, Steingewicht, Altersklasse und Technik verglichen. Eine Weite mit 6 kg wird nie mit 40 kg in einer Qualitätskurve gemittelt."}</p></article>
      <article className="method-card"><ShieldAlert size={27} /><h2>4. {en ? "Limitations" : "Grenzen"}</h2><p>{en ? "Not every PDF contains individual attempts. Where only a best distance is published, it counts as at least one documented successful throw. No missing attempts are invented. OCR can alter spellings, and uncertain identities remain separate. Implausible individual distances above 16 m remain in the source audit but are excluded from performance timelines." : "Nicht jedes PDF enthält Einzelversuche. Wo nur eine Bestweite publiziert ist, zählt sie als mindestens ein belegter gültiger Stoss. Die Website erfindet keine weiteren Versuche. OCR kann Schreibweisen verändern; unsichere Identitäten bleiben getrennt. Unplausible individuelle Weiten über 16 m bleiben im Quellenaudit, werden aber aus Leistungszeitreihen ausgeschlossen."}</p></article>
    </section>
    <section className="section section-tint"><div className="shell prose"><SectionHeading eyebrow={en ? "People, not spellings" : "Personen statt Schreibweisen"} title={en ? "How athlete identities are merged" : "Wie Athlet:innen zusammengeführt werden"} />
      <ol>
        <li><strong>{en ? "Normalization:" : "Normalisierung:"}</strong> {en ? "Capitalization, accents, punctuation and name order are normalized for comparison." : "Gross-/Kleinschreibung, Akzente, Satzzeichen und Reihenfolge der Namen werden für den Vergleich normalisiert."}</li>
        <li><strong>{en ? "Official profiles:" : "Offizielle Profile:"}</strong> {en ? "Names and birth years on the current and former athlete pages are the preferred identities for listed people." : "Name und Jahrgang der aktuellen Aktiven- und Ehemaligenseiten gelten für die dort gelisteten Personen als bevorzugte Identität."}</li>
        <li><strong>{en ? "Place and club artefacts:" : "Ort- und Vereinsartefakte:"}</strong> {en ? "Rare variants such as “Hutmacher Urs Weisslingen” are integrated when the extra text is identifiable as a place or club artefact." : "Seltene Varianten wie „Hutmacher Urs Weisslingen“ werden in eine etablierte Identität integriert, wenn der zusätzliche Text als Orts-/Vereinsartefakt erkennbar ist."}</li>
        <li><strong>{en ? "Conservative conflicts:" : "Konservativer Konflikt:"}</strong> {en ? "Different known birth years remain separate unless an official profile resolves the conflict." : "Unterschiedliche bekannte Jahrgänge bleiben getrennt, sofern kein offizielles Profil den Konflikt auflöst."}</li>
        <li><strong>{en ? "Auditability:" : "Auditierbarkeit:"}</strong> {en ? "All raw spellings remain available as aliases or source lines." : "Alle Rohschreibweisen bleiben als Alias oder Quellenzeile erhalten."}</li>
      </ol>
    </div></section>
    <section className="section shell prose"><SectionHeading eyebrow={en ? "Women · men · weight" : "Frauen · Männer · Gewicht"} title={en ? "Categories are part of the data" : "Kategorien sind Teil der Daten"} />
      <p>{en ? "Sex or competition category and stone weight are mandatory analytical dimensions. Where a historical document does not state them reliably, “not specified” appears instead of a guess. Historically male heavy-stone categories above 12.5 kg are classified according to documented competition rules; ambiguous lighter categories remain open without a clear heading." : "Sex beziehungsweise Wettkampfkategorie und Steingewicht sind Pflichtdimensionen der Analyse. Wo ein historisches Dokument diese Information nicht zuverlässig ausweist, erscheint „nicht ausgewiesen“ statt einer Vermutung. Stark männergebundene historische Schwersteine über 12,5 kg werden entsprechend der dokumentierten Wettkampfordnung klassifiziert; ambivalente leichtere Kategorien bleiben ohne eindeutige Überschrift offen."}</p>
      <p>{en ? "Totals across all weights—such as documented total distance—describe only archive coverage. They are not performance comparisons. Performance is always shown for a specific stone weight." : <>Summen über alle Gewichte – zum Beispiel die dokumentierte Gesamtdistanz – beschreiben nur den Umfang des Archivs. Sie sind <strong>kein</strong> Qualitätsvergleich. Qualität wird immer gewichtsspezifisch dargestellt.</>}</p>
      <h2>{en ? "Reproducible import" : "Reproduzierbarer Import"}</h2><pre><code>python3 -m pip install -r scripts/requirements.txt{"\n"}python3 scripts/import_results.py{"\n"}npm run build{"\n"}npm start</code></pre>
      <p>{en ? "PDFs and extracted intermediate text are cached locally. The published SQLite file contains normalized data and source links; re-running the import rebuilds it deterministically." : "PDFs und extrahierte Zwischentexte werden lokal gecacht. Die veröffentlichte SQLite-Datei enthält die normalisierten Daten und Quellenverweise; ein erneuter Import baut sie deterministisch neu auf."}</p>
    </section>
  </>;
}
