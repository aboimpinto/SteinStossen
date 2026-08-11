import { NextResponse } from "next/server";

import { getOverview } from "@/lib/queries";

export const dynamic = "force-dynamic";

export function GET() {
  const overview = getOverview();
  return NextResponse.json({
    status: "ok",
    service: "steinstossen",
    database: {
      firstSeason: overview.firstSeason,
      lastSeason: overview.lastSeason,
      athletes: overview.athletes,
      results: overview.results,
      sourceDocuments: overview.sourceDocuments,
    },
  });
}
