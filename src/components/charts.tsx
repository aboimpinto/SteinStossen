"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { dimensionLabel } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import type {
  AthleteDimension,
  AthleteProgress,
  DimensionTrend,
  SeasonTrend,
  SeriesTrend,
} from "@/lib/queries";

const COLORS = {
  red: "#c62f32",
  darkRed: "#7d1d20",
  gold: "#c79b55",
  graphite: "#343836",
  moss: "#687469",
  mist: "#d9d8d1",
};

const tooltipStyle = {
  border: "1px solid #d7d4ca",
  borderRadius: "12px",
  background: "rgba(255, 253, 248, 0.98)",
  color: "#242724",
  boxShadow: "0 14px 40px rgba(33, 35, 32, 0.12)",
};

export function SeasonOverviewChart({ data, locale }: { data: SeasonTrend[]; locale: Locale }) {
  const copy = locale === "de" ? { aria: "Entwicklung der Saisons", athletes: "Athlet:innen", competitions: "Wettkämpfe" } : { aria: "Season development", athletes: "Athletes", competitions: "Competitions" };
  return (
    <div className="chart" aria-label={copy.aria}>
      <ResponsiveContainer width="100%" height={380} initialDimension={{ width: 1120, height: 380 }}>
        <ComposedChart data={data} margin={{ top: 16, right: 12, left: 0, bottom: 8 }}>
          <defs>
            <linearGradient id="athleteArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.red} stopOpacity={0.28} />
              <stop offset="95%" stopColor={COLORS.red} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 5" stroke="#dedbd2" vertical={false} />
          <XAxis dataKey="season" tick={{ fill: COLORS.graphite, fontSize: 12 }} />
          <YAxis yAxisId="left" tick={{ fill: COLORS.graphite, fontSize: 12 }} width={42} />
          <YAxis yAxisId="right" orientation="right" tick={{ fill: COLORS.moss, fontSize: 12 }} width={42} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="athletes"
            name={copy.athletes}
            stroke={COLORS.red}
            fill="url(#athleteArea)"
            strokeWidth={2.5}
          />
          <Bar yAxisId="right" dataKey="competitions" name={copy.competitions} fill={COLORS.gold} radius={[5, 5, 0, 0]} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ParticipationChart({ data, locale }: { data: SeasonTrend[]; locale: Locale }) {
  const copy = locale === "de" ? { aria: "Frauen und Männer pro Saison", men: "Männer", women: "Frauen" } : { aria: "Women and men per season", men: "Men", women: "Women" };
  return (
    <div className="chart" aria-label={copy.aria}>
      <ResponsiveContainer width="100%" height={320} initialDimension={{ width: 1120, height: 320 }}>
        <AreaChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 5" stroke="#dedbd2" vertical={false} />
          <XAxis dataKey="season" tick={{ fill: COLORS.graphite, fontSize: 12 }} />
          <YAxis tick={{ fill: COLORS.graphite, fontSize: 12 }} width={42} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          <Area type="monotone" dataKey="men" name={copy.men} stackId="1" stroke={COLORS.graphite} fill="#7f8882" />
          <Area type="monotone" dataKey="women" name={copy.women} stackId="1" stroke={COLORS.red} fill="#dc7778" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AthleteProgressExplorer({ dimensions, progress, locale }: { dimensions: AthleteDimension[]; progress: AthleteProgress[]; locale: Locale }) {
  const copy = locale === "de"
    ? { empty: "Für diese Person wurden keine vergleichbaren Disziplinen erkannt.", category: "Vergleichbare Kategorie", results: "Resultate", period: "Zeitraum", last10: "Letzte 10 Saisons", all: "Alle Saisons", seasonBest: "Saisonbestleistung", average: "Ø Wettkampfbestleistung" }
    : { empty: "No comparable disciplines were identified for this person.", category: "Comparable category", results: "results", period: "Period", last10: "Last 10 seasons", all: "All seasons", seasonBest: "Season best", average: "Average competition best" };
  const [selectedKey, setSelectedKey] = useState(dimensions[0]?.key ?? "");
  const [range, setRange] = useState<"all" | "10">("10");
  const selected = dimensions.find((item) => item.key === selectedKey) ?? dimensions[0];
  const rows = useMemo(() => {
    const filtered = progress.filter((item) => item.dimensionKey === selected?.key);
    if (range === "all" || !filtered.length) return filtered;
    const lastSeason = Math.max(...filtered.map((item) => item.season));
    return filtered.filter((item) => item.season >= lastSeason - 9);
  }, [progress, range, selected]);

  if (!selected) return <p className="empty-state">{copy.empty}</p>;

  return (
    <div>
      <div className="chart-controls">
        <label>
          {copy.category}
          <select value={selected.key} onChange={(event) => setSelectedKey(event.target.value)}>
            {dimensions.map((dimension) => (
              <option value={dimension.key} key={dimension.key}>
                {dimensionLabel(dimension, locale)} · {dimension.results} {copy.results}
              </option>
            ))}
          </select>
        </label>
        <div className="segmented" aria-label={copy.period}>
          <button className={range === "10" ? "active" : ""} onClick={() => setRange("10")} type="button">
            {copy.last10}
          </button>
          <button className={range === "all" ? "active" : ""} onClick={() => setRange("all")} type="button">
            {copy.all}
          </button>
        </div>
      </div>
      <div className="chart">
        <ResponsiveContainer width="100%" height={380} initialDimension={{ width: 1120, height: 380 }}>
          <ComposedChart data={rows} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 5" stroke="#dedbd2" vertical={false} />
            <XAxis dataKey="season" tick={{ fill: COLORS.graphite, fontSize: 12 }} />
            <YAxis
              tick={{ fill: COLORS.graphite, fontSize: 12 }}
              width={48}
              domain={["dataMin - 0.5", "dataMax + 0.5"]}
              unit=" m"
            />
            <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${Number(value).toFixed(2)} m`]} />
            <Legend />
            <Line type="monotone" dataKey="bestDistance" name={copy.seasonBest} stroke={COLORS.red} strokeWidth={3} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="averageBest" name={copy.average} stroke={COLORS.gold} strokeWidth={2} strokeDasharray="6 4" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="chart-caption">
        {locale === "de"
          ? `Nur ${dimensionLabel(selected, locale)} wird miteinander verglichen. Distanzen anderer Steingewichte oder Kategorien werden nicht vermischt.`
          : `Only ${dimensionLabel(selected, locale)} is compared. Distances from other stone weights or categories are never mixed.`}
      </p>
    </div>
  );
}

export function SeriesOverviewChart({ data, locale }: { data: SeriesTrend[]; locale: Locale }) {
  const copy = locale === "de" ? { athletes: "Athlet:innen", throws: "Erfasste gültige Stösse" } : { athletes: "Athletes", throws: "Recorded successful throws" };
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height={360} initialDimension={{ width: 1120, height: 360 }}>
        <ComposedChart data={data} margin={{ top: 16, right: 12, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 5" stroke="#dedbd2" vertical={false} />
          <XAxis dataKey="season" tick={{ fill: COLORS.graphite, fontSize: 12 }} />
          <YAxis yAxisId="people" tick={{ fill: COLORS.graphite, fontSize: 12 }} width={42} />
          <YAxis yAxisId="throws" orientation="right" tick={{ fill: COLORS.moss, fontSize: 12 }} width={48} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          <Bar yAxisId="people" dataKey="athletes" name={copy.athletes} fill={COLORS.red} radius={[5, 5, 0, 0]} />
          <Line yAxisId="throws" type="monotone" dataKey="successfulThrows" name={copy.throws} stroke={COLORS.gold} strokeWidth={2.5} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DimensionTrendExplorer({ data, locale }: { data: DimensionTrend[]; locale: Locale }) {
  const copy = locale === "de"
    ? { empty: "Keine gewichtsspezifische Zeitreihe verfügbar.", category: "Kategorie und Steingewicht", best: "Beste Weite", average: "Ø Bestweite", participants: "Teilnehmende" }
    : { empty: "No stone-weight-specific timeline is available.", category: "Category and stone weight", best: "Best distance", average: "Average best distance", participants: "Participants" };
  const dimensions = useMemo(() => {
    const grouped = new Map<string, { key: string; count: number; sample: DimensionTrend }>();
    data.forEach((item) => {
      const existing = grouped.get(item.dimensionKey);
      if (existing) existing.count += item.participants;
      else grouped.set(item.dimensionKey, { key: item.dimensionKey, count: item.participants, sample: item });
    });
    return [...grouped.values()].sort((a, b) => b.count - a.count);
  }, [data]);
  const [selectedKey, setSelectedKey] = useState(dimensions[0]?.key ?? "");
  const selected = dimensions.find((item) => item.key === selectedKey) ?? dimensions[0];
  const rows = data.filter((item) => item.dimensionKey === selected?.key);

  if (!selected) return <p className="empty-state">{copy.empty}</p>;

  return (
    <div>
      <div className="chart-controls">
        <label>
          {copy.category}
          <select value={selected.key} onChange={(event) => setSelectedKey(event.target.value)}>
            {dimensions.map((dimension) => (
              <option key={dimension.key} value={dimension.key}>
                {dimensionLabel(dimension.sample, locale)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="chart">
        <ResponsiveContainer width="100%" height={360} initialDimension={{ width: 1120, height: 360 }}>
          <ComposedChart data={rows} margin={{ top: 16, right: 12, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 5" stroke="#dedbd2" vertical={false} />
            <XAxis dataKey="season" tick={{ fill: COLORS.graphite, fontSize: 12 }} />
            <YAxis yAxisId="distance" domain={["dataMin - 0.5", "dataMax + 0.5"]} unit=" m" width={48} />
            <YAxis yAxisId="people" orientation="right" width={42} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            <Line yAxisId="distance" type="monotone" dataKey="bestDistance" name={copy.best} stroke={COLORS.red} strokeWidth={3} />
            <Line yAxisId="distance" type="monotone" dataKey="averageBest" name={copy.average} stroke={COLORS.gold} strokeWidth={2} strokeDasharray="6 4" />
            <Bar yAxisId="people" dataKey="participants" name={copy.participants} fill={COLORS.mist} radius={[4, 4, 0, 0]} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="chart-caption">{locale === "de" ? "Qualitätsentwicklung innerhalb von" : "Performance development within"} {dimensionLabel(selected.sample, locale)}.</p>
    </div>
  );
}

export function SeasonMetricChart({ data, locale }: { data: SeasonTrend[]; locale: Locale }) {
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height={350} initialDimension={{ width: 1120, height: 350 }}>
        <BarChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 5" stroke="#dedbd2" vertical={false} />
          <XAxis dataKey="season" tick={{ fill: COLORS.graphite, fontSize: 12 }} />
          <YAxis tick={{ fill: COLORS.graphite, fontSize: 12 }} width={52} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          <Bar dataKey="successfulThrows" name={locale === "de" ? "Erfasste gültige Stösse" : "Recorded successful throws"} fill={COLORS.red} radius={[5, 5, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
