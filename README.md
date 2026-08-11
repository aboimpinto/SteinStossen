# Steinstossen Zeitreihen

Independent performance-data presentation for Swiss stone throwing. It does not
replace `steinstossen.ch` or its official rankings; it turns the existing PDF archive
into athlete, competition-series, and season views.

## What is included

- athlete profiles with all seasons or the last ten seasons;
- progression by sex/category, stone weight, age group, and technique;
- competition-series evolution across years;
- season dashboards covering competitions, participants, recorded successful throws,
  and recorded distance;
- athlete and competition averages within comparable categories;
- source links back to the original PDF and page;
- complete German and English interfaces under `/de` and `/en`;
- server-rendered chart SVGs with responsive browser enhancement;
- explicit visibility of extraction and attempt-data coverage.

The generated database currently covers:

- 305 result documents from 2004 through 2026;
- three annual-standings documents retained as references;
- 94 documents processed with OCR;
- more than 16,000 parsed result rows and 18,000 explicitly listed attempts.

Use `data/import-report.json` for the exact current counts.

## Data principles

- Women, men, mixed/team, and unknown categories remain distinguishable.
- Different stone weights are never mixed in performance-quality trends.
- Age group and throwing technique remain part of the comparison dimension.
- If a PDF lists all attempts, they are imported individually.
- If a PDF only lists the best result, the system records that best result and does not
  invent missing attempts.
- Official current/former athlete profiles provide preferred names and birth years for
  the people listed there.
- Other identities are deduplicated conservatively; uncertain cases remain separate.
- Implausible individual OCR distances above 16 m remain auditable in the database but
  are excluded from athlete identities and performance-quality trends.

See `/methodik` in the application for the public explanation.

## Technology

- Next.js 16 / React 19 / TypeScript
- SQLite read through `better-sqlite3`
- Recharts
- Python import pipeline using `pdftotext`, `pdfinfo`, `pdftoppm`, and Tesseract
- standalone Next.js output and Docker packaging for a small AWS host

## Run the existing database

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. The root redirects to German; use `/en` for English.

Production:

```bash
npm run build
PORT=3210 STEINSTOSSEN_DB_PATH="$PWD/data/steinstossen.sqlite" \
  node .next/standalone/server.js
```

If the standalone folder is copied elsewhere, also copy:

- `.next/static/` to `.next/standalone/.next/static/`;
- `public/` to `.next/standalone/public/`;
- `data/steinstossen.sqlite` to `.next/standalone/data/steinstossen.sqlite`.

The Docker image performs these copies automatically.

## Rebuild the SQLite database

System requirements:

- Python 3;
- Poppler commands `pdftotext`, `pdfinfo`, and `pdftoppm`;
- Tesseract OCR;
- internet access to `steinstossen.ch`.

```bash
python3 -m pip install -r scripts/requirements.txt
npm run data:import
```

The first run downloads the source documents into ignored cache folders. Later runs
reuse the cache and rebuild `data/steinstossen.sqlite` deterministically.

Generated and tracked:

- `data/steinstossen.sqlite`
- `data/source-manifest.json`
- `data/official-athletes.json`
- `data/import-report.json`

Ignored local cache:

- `data/source-pdfs/`
- `data/extracted-text/`

## Verification

```bash
npm run typecheck
npm run lint
npm run build
```

## AWS / Docker

The lowest-friction deployment is a single container with the read-only SQLite file
inside the image:

```bash
docker compose up -d --build
```

The default host port is `3210`. Override it without editing the file:

```bash
STEINSTOSSEN_PORT=8080 docker compose up -d --build
```

For a reverse proxy, route the chosen host/domain to that local port. No database
service, migrations, credentials, or persistent volume are required for this public,
read-only dataset. Publish an updated image whenever the source archive is re-imported.

## Main routes

Every route is available below both `/de` and `/en`:

- `/{locale}` — overview and long-term participation
- `/{locale}/athleten` — athlete search and profiles
- `/{locale}/wettkaempfe` — recurring competition series
- `/{locale}/saisons` — season overview and season detail
- `/{locale}/methodik` — sources, coverage, deduplication, and limitations

Unprefixed routes redirect to the German equivalent. The header language switch keeps
the current page when changing language.
