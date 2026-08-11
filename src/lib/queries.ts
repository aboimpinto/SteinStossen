import "server-only";

import { queryAll, queryOne } from "./db";

export type Overview = {
  firstSeason: number;
  lastSeason: number;
  seasons: number;
  competitions: number;
  competitionSeries: number;
  athletes: number;
  women: number;
  men: number;
  results: number;
  recordedThrows: number;
  recordedDistance: number;
  explicitAttemptResults: number;
  sourceDocuments: number;
  ocrDocuments: number;
};

export type SeasonTrend = {
  season: number;
  competitions: number;
  athletes: number;
  results: number;
  successfulThrows: number;
  recordedDistance: number;
  averageBest: number;
  women: number;
  men: number;
};

export type AthleteListItem = {
  slug: string;
  displayName: string;
  birthYear: number | null;
  sex: string;
  firstSeason: number;
  lastSeason: number;
  resultCount: number;
  competitions: number;
  personalBests: number;
  officialStatus: string | null;
  profileImageUrl: string | null;
};

export type SeriesListItem = {
  slug: string;
  name: string;
  firstSeason: number;
  lastSeason: number;
  seasons: number;
  competitions: number;
  athletes: number;
  results: number;
  recordedThrows: number;
};

export type Athlete = AthleteListItem & {
  heightCm: number | null;
  bodyWeightKg: number | null;
  careerStartYear: number | null;
};

export type AthleteDimension = {
  key: string;
  sex: string;
  ageGroup: string;
  stoneWeightKg: number | null;
  technique: string;
  results: number;
  seasons: number;
  bestDistance: number;
  averageBest: number;
  firstSeason: number;
  lastSeason: number;
};

export type AthleteProgress = {
  season: number;
  dimensionKey: string;
  sex: string;
  ageGroup: string;
  stoneWeightKg: number | null;
  technique: string;
  bestDistance: number;
  averageBest: number;
  results: number;
};

export type ResultRow = {
  season: number;
  competitionName: string;
  competitionSlug: string;
  seriesName: string;
  seriesSlug: string;
  competitionDate: string | null;
  rank: number | null;
  bestDistance: number;
  categoryLabel: string;
  sex: string;
  ageGroup: string;
  stoneWeightKg: number | null;
  technique: string;
  club: string | null;
  locality: string | null;
  sourceUrl: string;
  sourcePage: number;
  explicitAttempts: number;
  successfulThrows: number;
};

export type Series = {
  slug: string;
  name: string;
  firstSeason: number;
  lastSeason: number;
  seasons: number;
  competitionDocuments: number;
  athletes: number;
  results: number;
};

export type SeriesTrend = {
  season: number;
  competitions: number;
  athletes: number;
  results: number;
  successfulThrows: number;
  recordedDistance: number;
  averageBest: number;
  explicitAttemptResults: number;
};

export type DimensionTrend = {
  season: number;
  dimensionKey: string;
  sex: string;
  ageGroup: string;
  stoneWeightKg: number | null;
  technique: string;
  participants: number;
  bestDistance: number;
  averageBest: number;
};

export type CompetitionEdition = {
  slug: string;
  season: number;
  name: string;
  competitionDate: string | null;
  athletes: number;
  results: number;
  recordedThrows: number;
  sourceUrl: string;
};

export type SeasonSummary = SeasonTrend;

export type SeasonCompetition = {
  slug: string;
  seriesSlug: string;
  name: string;
  seriesName: string;
  competitionDate: string | null;
  athletes: number;
  results: number;
  successfulThrows: number;
  recordedDistance: number;
  sourceUrl: string;
};

export type SeasonDimension = {
  dimensionKey: string;
  sex: string;
  ageGroup: string;
  stoneWeightKg: number | null;
  technique: string;
  participants: number;
  results: number;
  bestDistance: number;
  averageBest: number;
  successfulThrows: number;
};

export type SeasonAthleteAverage = {
  athleteSlug: string;
  athleteName: string;
  dimensionKey: string;
  sex: string;
  stoneWeightKg: number | null;
  technique: string;
  competitions: number;
  bestDistance: number;
  averageBest: number;
};

export function getOverview(): Overview {
  return queryOne<Overview>(`
    SELECT
      MIN(c.season) AS firstSeason,
      MAX(c.season) AS lastSeason,
      COUNT(DISTINCT c.season) AS seasons,
      COUNT(DISTINCT c.id) AS competitions,
      COUNT(DISTINCT c.series_slug) AS competitionSeries,
      COUNT(DISTINCT a.id) AS athletes,
      COUNT(DISTINCT CASE WHEN a.sex = 'female' THEN a.id END) AS women,
      COUNT(DISTINCT CASE WHEN a.sex = 'male' THEN a.id END) AS men,
      COUNT(DISTINCT r.id) AS results,
      COALESCE(SUM(rm.recorded_successful_throws), 0) AS recordedThrows,
      COALESCE(SUM(rm.recorded_successful_distance_m), 0) AS recordedDistance,
      COUNT(DISTINCT CASE WHEN rm.has_explicit_attempts = 1 THEN r.id END) AS explicitAttemptResults,
      (SELECT COUNT(*) FROM source_documents) AS sourceDocuments,
      (SELECT COUNT(*) FROM source_documents WHERE extraction_method LIKE 'ocr%') AS ocrDocuments
    FROM competitions c
    LEFT JOIN results r ON r.competition_id = c.id
    LEFT JOIN result_metrics rm ON rm.id = r.id
    LEFT JOIN athletes a ON a.id = r.athlete_id
  `)!;
}

export function getSeasonTrends(): SeasonTrend[] {
  const rows = queryAll<SeasonTrend>(`
    SELECT
      c.season AS season,
      COUNT(DISTINCT c.id) AS competitions,
      COUNT(DISTINCT r.athlete_id) AS athletes,
      COUNT(DISTINCT r.id) AS results,
      COALESCE(SUM(rm.recorded_successful_throws), 0) AS successfulThrows,
      COALESCE(SUM(rm.recorded_successful_distance_m), 0) AS recordedDistance,
      COALESCE(AVG(CASE WHEN r.quality_status = 'valid' AND r.best_distance_m > 0 THEN r.best_distance_m END), 0) AS averageBest,
      COUNT(DISTINCT CASE WHEN d.sex = 'female' THEN r.athlete_id END) AS women,
      COUNT(DISTINCT CASE WHEN d.sex = 'male' THEN r.athlete_id END) AS men
    FROM competitions c
    LEFT JOIN results r ON r.competition_id = c.id
    LEFT JOIN result_metrics rm ON rm.id = r.id
    LEFT JOIN disciplines d ON d.id = r.discipline_id
    GROUP BY c.season
    ORDER BY c.season
  `);
  if (!rows.length) return [];
  const bySeason = new Map(rows.map((row) => [row.season, row]));
  const filled: SeasonTrend[] = [];
  for (let season = rows[0].season; season <= rows.at(-1)!.season; season += 1) {
    filled.push(
      bySeason.get(season) ?? {
        season,
        competitions: 0,
        athletes: 0,
        results: 0,
        successfulThrows: 0,
        recordedDistance: 0,
        averageBest: 0,
        women: 0,
        men: 0,
      },
    );
  }
  return filled;
}

export function getTopAthletes(limit = 12): AthleteListItem[] {
  return queryAll<AthleteListItem>(`
    SELECT
      a.slug AS slug,
      a.display_name AS displayName,
      a.birth_year AS birthYear,
      a.sex AS sex,
      a.first_season AS firstSeason,
      a.last_season AS lastSeason,
      a.result_count AS resultCount,
      COUNT(DISTINCT r.competition_id) AS competitions,
      COUNT(DISTINCT d.canonical_key) AS personalBests,
      a.official_status AS officialStatus,
      a.profile_image_url AS profileImageUrl
    FROM athletes a
    JOIN results r ON r.athlete_id = a.id
    JOIN disciplines d ON d.id = r.discipline_id
    GROUP BY a.id
    ORDER BY a.result_count DESC, a.display_name
    LIMIT ?
  `, limit);
}

export function searchAthletes(search = "", page = 1, pageSize = 48): {
  athletes: AthleteListItem[];
  total: number;
} {
  const normalizedSearch = `%${search.trim()}%`;
  const offset = Math.max(0, page - 1) * pageSize;
  const total = queryOne<{ total: number }>(
    "SELECT COUNT(*) AS total FROM athletes WHERE display_name LIKE ? COLLATE NOCASE",
    normalizedSearch,
  )?.total ?? 0;
  const athletes = queryAll<AthleteListItem>(`
    SELECT
      a.slug AS slug,
      a.display_name AS displayName,
      a.birth_year AS birthYear,
      a.sex AS sex,
      a.first_season AS firstSeason,
      a.last_season AS lastSeason,
      a.result_count AS resultCount,
      COUNT(DISTINCT r.competition_id) AS competitions,
      COUNT(DISTINCT d.canonical_key) AS personalBests,
      a.official_status AS officialStatus,
      a.profile_image_url AS profileImageUrl
    FROM athletes a
    JOIN results r ON r.athlete_id = a.id
    JOIN disciplines d ON d.id = r.discipline_id
    WHERE a.display_name LIKE ? COLLATE NOCASE
    GROUP BY a.id
    ORDER BY a.result_count DESC, a.display_name
    LIMIT ? OFFSET ?
  `, normalizedSearch, pageSize, offset);
  return { athletes, total };
}

export function getCompetitionSeries(limit?: number): SeriesListItem[] {
  const limitClause = limit ? "LIMIT ?" : "";
  return queryAll<SeriesListItem>(`
    SELECT
      c.series_slug AS slug,
      c.series_name AS name,
      MIN(c.season) AS firstSeason,
      MAX(c.season) AS lastSeason,
      COUNT(DISTINCT c.season) AS seasons,
      COUNT(DISTINCT c.id) AS competitions,
      COUNT(DISTINCT r.athlete_id) AS athletes,
      COUNT(DISTINCT r.id) AS results,
      COALESCE(SUM(rm.recorded_successful_throws), 0) AS recordedThrows
    FROM competitions c
    LEFT JOIN results r ON r.competition_id = c.id
    LEFT JOIN result_metrics rm ON rm.id = r.id
    GROUP BY c.series_slug, c.series_name
    ORDER BY seasons DESC, results DESC, name
    ${limitClause}
  `, ...(limit ? [limit] : []));
}

export function getAthlete(slug: string): Athlete | undefined {
  return queryOne<Athlete>(`
    SELECT
      a.slug AS slug,
      a.display_name AS displayName,
      a.birth_year AS birthYear,
      a.sex AS sex,
      a.first_season AS firstSeason,
      a.last_season AS lastSeason,
      a.result_count AS resultCount,
      COUNT(DISTINCT r.competition_id) AS competitions,
      COUNT(DISTINCT d.canonical_key) AS personalBests,
      a.official_status AS officialStatus,
      a.profile_image_url AS profileImageUrl,
      a.height_cm AS heightCm,
      a.body_weight_kg AS bodyWeightKg,
      a.career_start_year AS careerStartYear
    FROM athletes a
    JOIN results r ON r.athlete_id = a.id
    JOIN disciplines d ON d.id = r.discipline_id
    WHERE a.slug = ?
    GROUP BY a.id
  `, slug);
}

const dimensionKeySql = `
  d.sex || '|' || COALESCE(CAST(d.stone_weight_kg AS TEXT), 'unknown') || '|' ||
  d.age_group || '|' || d.technique
`;

export function getAthleteDimensions(slug: string): AthleteDimension[] {
  return queryAll<AthleteDimension>(`
    SELECT
      ${dimensionKeySql} AS key,
      d.sex AS sex,
      d.age_group AS ageGroup,
      d.stone_weight_kg AS stoneWeightKg,
      d.technique AS technique,
      COUNT(*) AS results,
      COUNT(DISTINCT c.season) AS seasons,
      MAX(r.best_distance_m) AS bestDistance,
      AVG(CASE WHEN r.quality_status = 'valid' AND r.best_distance_m > 0 THEN r.best_distance_m END) AS averageBest,
      MIN(c.season) AS firstSeason,
      MAX(c.season) AS lastSeason
    FROM athletes a
    JOIN results r ON r.athlete_id = a.id
    JOIN competitions c ON c.id = r.competition_id
    JOIN disciplines d ON d.id = r.discipline_id
    WHERE a.slug = ? AND d.participant_type = 'athlete' AND r.quality_status = 'valid'
    GROUP BY key, d.sex, d.age_group, d.stone_weight_kg, d.technique
    ORDER BY results DESC, d.stone_weight_kg
  `, slug);
}

export function getAthleteProgress(slug: string): AthleteProgress[] {
  return queryAll<AthleteProgress>(`
    SELECT
      c.season AS season,
      ${dimensionKeySql} AS dimensionKey,
      d.sex AS sex,
      d.age_group AS ageGroup,
      d.stone_weight_kg AS stoneWeightKg,
      d.technique AS technique,
      MAX(r.best_distance_m) AS bestDistance,
      AVG(CASE WHEN r.quality_status = 'valid' AND r.best_distance_m > 0 THEN r.best_distance_m END) AS averageBest,
      COUNT(*) AS results
    FROM athletes a
    JOIN results r ON r.athlete_id = a.id
    JOIN competitions c ON c.id = r.competition_id
    JOIN disciplines d ON d.id = r.discipline_id
    WHERE a.slug = ? AND d.participant_type = 'athlete' AND r.quality_status = 'valid'
    GROUP BY c.season, dimensionKey, d.sex, d.age_group, d.stone_weight_kg, d.technique
    ORDER BY c.season, dimensionKey
  `, slug);
}

export function getAthleteResults(slug: string, limit = 100): ResultRow[] {
  return queryAll<ResultRow>(`
    SELECT
      c.season AS season,
      c.name AS competitionName,
      c.slug AS competitionSlug,
      c.series_name AS seriesName,
      c.series_slug AS seriesSlug,
      c.competition_date AS competitionDate,
      r.rank AS rank,
      r.best_distance_m AS bestDistance,
      d.label AS categoryLabel,
      d.sex AS sex,
      d.age_group AS ageGroup,
      d.stone_weight_kg AS stoneWeightKg,
      d.technique AS technique,
      r.club AS club,
      r.locality AS locality,
      s.url AS sourceUrl,
      r.source_page AS sourcePage,
      rm.has_explicit_attempts AS explicitAttempts,
      rm.recorded_successful_throws AS successfulThrows
    FROM athletes a
    JOIN results r ON r.athlete_id = a.id
    JOIN result_metrics rm ON rm.id = r.id
    JOIN competitions c ON c.id = r.competition_id
    JOIN disciplines d ON d.id = r.discipline_id
    JOIN source_documents s ON s.id = r.source_document_id
    WHERE a.slug = ?
    ORDER BY c.season DESC, COALESCE(c.competition_date, ''), c.name, r.rank
    LIMIT ?
  `, slug, limit);
}

export function getSeries(slug: string): Series | undefined {
  return queryOne<Series>(`
    SELECT
      c.series_slug AS slug,
      c.series_name AS name,
      MIN(c.season) AS firstSeason,
      MAX(c.season) AS lastSeason,
      COUNT(DISTINCT c.season) AS seasons,
      COUNT(DISTINCT c.id) AS competitionDocuments,
      COUNT(DISTINCT r.athlete_id) AS athletes,
      COUNT(DISTINCT r.id) AS results
    FROM competitions c
    LEFT JOIN results r ON r.competition_id = c.id
    WHERE c.series_slug = ?
    GROUP BY c.series_slug, c.series_name
  `, slug);
}

export function getSeriesTrends(slug: string): SeriesTrend[] {
  return queryAll<SeriesTrend>(`
    SELECT
      c.season AS season,
      COUNT(DISTINCT c.id) AS competitions,
      COUNT(DISTINCT r.athlete_id) AS athletes,
      COUNT(DISTINCT r.id) AS results,
      COALESCE(SUM(rm.recorded_successful_throws), 0) AS successfulThrows,
      COALESCE(SUM(rm.recorded_successful_distance_m), 0) AS recordedDistance,
      COALESCE(AVG(CASE WHEN r.quality_status = 'valid' AND r.best_distance_m > 0 THEN r.best_distance_m END), 0) AS averageBest,
      COUNT(DISTINCT CASE WHEN rm.has_explicit_attempts = 1 THEN r.id END) AS explicitAttemptResults
    FROM competitions c
    LEFT JOIN results r ON r.competition_id = c.id
    LEFT JOIN result_metrics rm ON rm.id = r.id
    WHERE c.series_slug = ?
    GROUP BY c.season
    ORDER BY c.season
  `, slug);
}

export function getSeriesDimensionTrends(slug: string): DimensionTrend[] {
  return queryAll<DimensionTrend>(`
    SELECT
      c.season AS season,
      ${dimensionKeySql} AS dimensionKey,
      d.sex AS sex,
      d.age_group AS ageGroup,
      d.stone_weight_kg AS stoneWeightKg,
      d.technique AS technique,
      COUNT(DISTINCT r.athlete_id) AS participants,
      MAX(r.best_distance_m) AS bestDistance,
      AVG(CASE WHEN r.quality_status = 'valid' AND r.best_distance_m > 0 THEN r.best_distance_m END) AS averageBest
    FROM competitions c
    JOIN results r ON r.competition_id = c.id
    JOIN disciplines d ON d.id = r.discipline_id
    WHERE c.series_slug = ? AND d.participant_type = 'athlete' AND r.quality_status = 'valid'
    GROUP BY c.season, dimensionKey, d.sex, d.age_group, d.stone_weight_kg, d.technique
    ORDER BY c.season, dimensionKey
  `, slug);
}

export function getSeriesEditions(slug: string): CompetitionEdition[] {
  return queryAll<CompetitionEdition>(`
    SELECT
      c.slug AS slug,
      c.season AS season,
      c.name AS name,
      c.competition_date AS competitionDate,
      COUNT(DISTINCT r.athlete_id) AS athletes,
      COUNT(DISTINCT r.id) AS results,
      COALESCE(SUM(rm.recorded_successful_throws), 0) AS recordedThrows,
      s.url AS sourceUrl
    FROM competitions c
    JOIN source_documents s ON s.id = c.source_document_id
    LEFT JOIN results r ON r.competition_id = c.id
    LEFT JOIN result_metrics rm ON rm.id = r.id
    WHERE c.series_slug = ?
    GROUP BY c.id
    ORDER BY c.season DESC, c.name
  `, slug);
}

export function getSeriesTopAthletes(slug: string, limit = 12): AthleteListItem[] {
  return queryAll<AthleteListItem>(`
    SELECT
      a.slug AS slug,
      a.display_name AS displayName,
      a.birth_year AS birthYear,
      a.sex AS sex,
      MIN(c.season) AS firstSeason,
      MAX(c.season) AS lastSeason,
      COUNT(r.id) AS resultCount,
      COUNT(DISTINCT r.competition_id) AS competitions,
      COUNT(DISTINCT d.canonical_key) AS personalBests,
      a.official_status AS officialStatus,
      a.profile_image_url AS profileImageUrl
    FROM competitions c
    JOIN results r ON r.competition_id = c.id
    JOIN athletes a ON a.id = r.athlete_id
    JOIN disciplines d ON d.id = r.discipline_id
    WHERE c.series_slug = ?
    GROUP BY a.id
    ORDER BY resultCount DESC, a.display_name
    LIMIT ?
  `, slug, limit);
}

export function getSeasonSummary(season: number): SeasonSummary | undefined {
  return queryOne<SeasonSummary>(`
    SELECT
      c.season AS season,
      COUNT(DISTINCT c.id) AS competitions,
      COUNT(DISTINCT r.athlete_id) AS athletes,
      COUNT(DISTINCT r.id) AS results,
      COALESCE(SUM(rm.recorded_successful_throws), 0) AS successfulThrows,
      COALESCE(SUM(rm.recorded_successful_distance_m), 0) AS recordedDistance,
      COALESCE(AVG(CASE WHEN r.quality_status = 'valid' AND r.best_distance_m > 0 THEN r.best_distance_m END), 0) AS averageBest,
      COUNT(DISTINCT CASE WHEN d.sex = 'female' THEN r.athlete_id END) AS women,
      COUNT(DISTINCT CASE WHEN d.sex = 'male' THEN r.athlete_id END) AS men
    FROM competitions c
    LEFT JOIN results r ON r.competition_id = c.id
    LEFT JOIN result_metrics rm ON rm.id = r.id
    LEFT JOIN disciplines d ON d.id = r.discipline_id
    WHERE c.season = ?
    GROUP BY c.season
  `, season);
}

export function getSeasonCompetitions(season: number): SeasonCompetition[] {
  return queryAll<SeasonCompetition>(`
    SELECT
      c.slug AS slug,
      c.series_slug AS seriesSlug,
      c.name AS name,
      c.series_name AS seriesName,
      c.competition_date AS competitionDate,
      COUNT(DISTINCT r.athlete_id) AS athletes,
      COUNT(DISTINCT r.id) AS results,
      COALESCE(SUM(rm.recorded_successful_throws), 0) AS successfulThrows,
      COALESCE(SUM(rm.recorded_successful_distance_m), 0) AS recordedDistance,
      s.url AS sourceUrl
    FROM competitions c
    JOIN source_documents s ON s.id = c.source_document_id
    LEFT JOIN results r ON r.competition_id = c.id
    LEFT JOIN result_metrics rm ON rm.id = r.id
    WHERE c.season = ?
    GROUP BY c.id
    ORDER BY COALESCE(c.competition_date, ''), c.name
  `, season);
}

export function getSeasonDimensions(season: number): SeasonDimension[] {
  return queryAll<SeasonDimension>(`
    SELECT
      ${dimensionKeySql} AS dimensionKey,
      d.sex AS sex,
      d.age_group AS ageGroup,
      d.stone_weight_kg AS stoneWeightKg,
      d.technique AS technique,
      COUNT(DISTINCT r.athlete_id) AS participants,
      COUNT(DISTINCT r.id) AS results,
      MAX(r.best_distance_m) AS bestDistance,
      AVG(CASE WHEN r.quality_status = 'valid' AND r.best_distance_m > 0 THEN r.best_distance_m END) AS averageBest,
      COALESCE(SUM(rm.recorded_successful_throws), 0) AS successfulThrows
    FROM competitions c
    JOIN results r ON r.competition_id = c.id
    JOIN result_metrics rm ON rm.id = r.id
    JOIN disciplines d ON d.id = r.discipline_id
    WHERE c.season = ? AND d.participant_type = 'athlete' AND r.quality_status = 'valid'
    GROUP BY dimensionKey, d.sex, d.age_group, d.stone_weight_kg, d.technique
    ORDER BY participants DESC, d.sex, d.stone_weight_kg
  `, season);
}

export function getSeasonAthleteAverages(season: number, limit = 40): SeasonAthleteAverage[] {
  return queryAll<SeasonAthleteAverage>(`
    SELECT
      a.slug AS athleteSlug,
      a.display_name AS athleteName,
      ${dimensionKeySql} AS dimensionKey,
      d.sex AS sex,
      d.stone_weight_kg AS stoneWeightKg,
      d.technique AS technique,
      COUNT(DISTINCT r.competition_id) AS competitions,
      MAX(r.best_distance_m) AS bestDistance,
      AVG(CASE WHEN r.quality_status = 'valid' AND r.best_distance_m > 0 THEN r.best_distance_m END) AS averageBest
    FROM competitions c
    JOIN results r ON r.competition_id = c.id
    JOIN athletes a ON a.id = r.athlete_id
    JOIN disciplines d ON d.id = r.discipline_id
    WHERE c.season = ? AND d.participant_type = 'athlete' AND r.quality_status = 'valid'
    GROUP BY a.id, dimensionKey, d.sex, d.stone_weight_kg, d.technique
    HAVING COUNT(DISTINCT r.competition_id) >= 2
    ORDER BY competitions DESC, averageBest DESC
    LIMIT ?
  `, season, limit);
}
