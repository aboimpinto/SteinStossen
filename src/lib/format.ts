import { localeCode, type Locale } from "@/lib/i18n";

function numberFormatter(locale: Locale, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(localeCode(locale), options);
}

export function formatInteger(value: number | null | undefined, locale: Locale = "de"): string {
  return numberFormatter(locale).format(value ?? 0);
}

export function formatMetres(value: number | null | undefined, locale: Locale = "de"): string {
  return `${numberFormatter(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value ?? 0)} m`;
}

export function formatWeight(value: number | null | undefined, locale: Locale = "de"): string {
  if (value == null) return locale === "de" ? "Gewicht nicht ausgewiesen" : "Weight not specified";
  return `${numberFormatter(locale, { maximumFractionDigits: 1 }).format(value)} kg`;
}

export function formatSex(value: string, locale: Locale = "de"): string {
  const labels = locale === "de"
    ? { female: "Frauen", male: "Männer", mixed: "Gemischt", unknown: "Nicht ausgewiesen" }
    : { female: "Women", male: "Men", mixed: "Mixed", unknown: "Not specified" };
  return labels[value as keyof typeof labels] ?? value;
}

export function formatAgeGroup(value: string, locale: Locale = "de"): string {
  const labels = locale === "de"
    ? { youth: "Nachwuchs", junior: "Junior:innen", open: "Offen", masters: "Senior:innen", team: "Mannschaft", unspecified: "Offene Kategorie" }
    : { youth: "Youth", junior: "Juniors", open: "Open", masters: "Masters", team: "Team", unspecified: "Open category" };
  return labels[value as keyof typeof labels] ?? value;
}

export function formatTechnique(value: string, locale: Locale = "de"): string {
  const labels = locale === "de"
    ? { standing: "aus Stand", "run-up": "mit Anlauf", free: "Stossart frei", "one-handed": "einhändig", unspecified: "Technik nicht ausgewiesen" }
    : { standing: "standing", "run-up": "with run-up", free: "free technique", "one-handed": "one-handed", unspecified: "Technique not specified" };
  return labels[value as keyof typeof labels] ?? value;
}

export function dimensionLabel(
  dimension: { sex: string; stoneWeightKg: number | null; ageGroup?: string; technique?: string },
  locale: Locale = "de",
): string {
  const parts = [formatSex(dimension.sex, locale), formatWeight(dimension.stoneWeightKg, locale)];
  if (dimension.ageGroup && dimension.ageGroup !== "unspecified") parts.push(formatAgeGroup(dimension.ageGroup, locale));
  if (dimension.technique && dimension.technique !== "unspecified") parts.push(formatTechnique(dimension.technique, locale));
  return parts.join(" · ");
}
