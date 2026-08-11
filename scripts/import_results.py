#!/usr/bin/env python3
"""Build the Steinstossen SQLite database from the federation PDF archive.

The importer is deliberately conservative:
- it keeps every source document and raw result line for auditability;
- it OCRs image-only PDFs when Tesseract is available;
- it never invents attempts that are not present in a PDF;
- it deduplicates athletes by normalized name tokens and separates conflicting birth years;
- it stores sex/category, stone weight, age group, and technique independently.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import contextlib
import dataclasses
import datetime as dt
import hashlib
import html
import json
import os
import re
import shutil
import sqlite3
import subprocess
import tempfile
import time
import unicodedata
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path
from typing import Iterable

try:
    from bs4 import BeautifulSoup
except ImportError as exc:  # pragma: no cover - setup failure
    raise SystemExit("Install scripts/requirements.txt before running the importer") from exc

ARCHIVE_URL = "https://steinstossen.ch/reglement-ranglisten/"
USER_AGENT = "AboimPintoConsulting-Steinstossen-Research/1.0"
ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
PDF_DIR = DATA_DIR / "source-pdfs"
TEXT_DIR = DATA_DIR / "extracted-text"
DB_PATH = DATA_DIR / "steinstossen.sqlite"
MANIFEST_PATH = DATA_DIR / "source-manifest.json"
OFFICIAL_ATHLETES_PATH = DATA_DIR / "official-athletes.json"
REPORT_PATH = DATA_DIR / "import-report.json"

GERMAN_MONTHS = {
    "januar": 1, "februar": 2, "maerz": 3, "märz": 3, "april": 4,
    "mai": 5, "juni": 6, "juli": 7, "august": 8, "september": 9,
    "oktober": 10, "november": 11, "dezember": 12,
    "janvier": 1, "fevrier": 2, "février": 2, "mars": 3, "avril": 4,
    "juin": 6, "juillet": 7, "aout": 8, "août": 8, "septembre": 9,
    "octobre": 10, "novembre": 11, "decembre": 12, "décembre": 12,
}

SERIES_RULES = [
    (r"schweizermeister|\bsm\b", "Schweizermeisterschaften"),
    (r"unspunnen", "Unspunnen"),
    (r"\besaf\b|eidg\.?\s*(?:jubil|schwing)", "ESAF / Eidgenössischer Anlass"),
    (r"fruehjahr|frühjahr|ibach", "Frühjahrsschwinget Ibach"),
    (r"ob.?nid|hergiswil", "Ob- und Nidwaldner Kantonalschwingfest"),
    (r"schwyzer|sz.?kant", "Schwyzer Kantonalschwingfest"),
    (r"urner|ur.?kant|uksf", "Urner Kantonalschwingfest"),
    (r"luzerner|lu.?kant", "Luzerner Kantonalschwingfest"),
    (r"stoos", "Stoosschwinget"),
    (r"schwarzsee", "Schwarzsee-Schwinget"),
    (r"innerschweizer|\bisaf\b", "Innerschweizer Schwingfest"),
    (r"sattelegg", "Sattelegg-Steinstossen"),
    (r"rigi", "Rigi Schwing- und Älplerfest"),
    (r"weissenstein", "Weissensteinschwinget"),
    (r"fricktaler|wittnau", "Fricktaler Steinstossen"),
    (r"ricken", "Rickenschwinget"),
    (r"siebnen", "Siebnen Steinstossen"),
    (r"aarg|ag.?ms", "Aargauer Steinstossmeisterschaft"),
    (r"engelberg|hallen", "Hallen-Steinstossen Engelberg"),
    (r"lueg|lüeg", "Lueg-Steinstossen"),
    (r"waegital|wägital", "Wägital Steinstossen"),
    (r"soerenberg|sörenberg", "Bergschwinget Sörenberg"),
    (r"schaffhauser|sh.?kant", "Schaffhauser Kantonalschwingfest"),
    (r"eschenberg", "Eschenbergschwinget"),
    (r"appenzell", "Appenzell Steinstossen"),
    (r"be.?kant|berner", "Berner Kantonalschwingfest"),
    (r"ruchweid", "Ruchweid Steinstossen"),
]

DISTANCE_RE = re.compile(r"(?<!\d)(\d{1,2}(?:[.,]\d{1,3}))\s*m\b", re.I)
BARE_DISTANCE_RE = re.compile(r"(?<![\d.])(\d{1,2}[.,:]\d{1,3})(?!\d)")
CENTIMETRE_RE = re.compile(r"(?<!\d)(\d{2,3})(?!\d)")
RANK_RE = re.compile(r"^\s*(?P<rank>\d{1,3}[a-z]?|[-–—])(?:[.)])?\s+(?P<body>.+)$", re.I)
RANK_START_RE = re.compile(r"(?<!\S)(\d{1,3}[a-z]?[.)]?)\s{2,}", re.I)
ATTEMPT_RE = re.compile(r"(?<!\d)([1-9])\s*\.?:\s*(\d{1,2}(?:[.,]\d{1,3}))\s*m", re.I)
WEIGHT_RE = re.compile(r"(?<!\d)(\d{1,3}(?:[.,]\d+)?)\s*(?:-\s*)?k[goqe]\b", re.I)
YEAR_RE = re.compile(r"\b(19\d{2}|20\d{2})\b")


@dataclasses.dataclass(frozen=True)
class Source:
    year: int
    title: str
    url: str
    kind: str
    filename: str


@dataclasses.dataclass
class ParsedResult:
    source_url: str
    source_page: int
    competition_name: str
    series_name: str
    season: int
    competition_date: str | None
    category_label: str
    sex: str
    age_group: str
    participant_type: str
    stone_weight_kg: float | None
    technique: str
    rank: int | None
    raw_name: str
    normalized_name: str
    birth_year: int | None
    club: str | None
    locality: str | None
    best_distance_m: float
    attempts: list[tuple[int, float, bool]]
    extraction_method: str
    quality_status: str
    raw_line: str


def normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(value or "")).strip()


def normalize_key(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    value = value.casefold().replace("ß", "ss")
    return re.sub(r"[^a-z0-9]+", " ", value).strip()


def clean_person_name(name: str) -> str:
    value = normalize_space(name)
    value = re.sub(r"^[\W_]+", "", value, flags=re.UNICODE)
    value = re.sub(r"^\d{1,3}\s*[.)*]*\s*(?:Rang\s*)?", "", value, flags=re.I)
    value = re.sub(r"[|{}\[\]_~=]+", " ", value)
    value = re.sub(r"\b\d{1,3}\b", " ", value)
    value = re.sub(r"\s+[.)*/+-]+\s*$", "", value)
    return normalize_space(value.strip(" ,.;:/+-"))


def athlete_token_key(name: str) -> str:
    tokens = normalize_key(name).split()
    # Sort tokens so "Lena Hörler" and "Hörler Lena" resolve to one identity.
    return " ".join(sorted(tokens))


def slugify(value: str) -> str:
    return re.sub(r"-+", "-", normalize_key(value).replace(" ", "-")).strip("-")


def fetch_bytes(url: str, timeout: int = 60) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


def scrape_manifest() -> list[Source]:
    soup = BeautifulSoup(fetch_bytes(ARCHIVE_URL), "html.parser")
    sources: list[Source] = []
    seen: set[str] = set()

    for details in soup.find_all("details"):
        summary = details.find("summary")
        if not summary:
            continue
        year_match = re.search(r"\b(20\d{2})\b", summary.get_text(" ", strip=True))
        if not year_match:
            continue
        year = int(year_match.group(1))
        for anchor in details.find_all("a", href=True):
            url = urllib.parse.urljoin(ARCHIVE_URL, anchor["href"])
            if ".pdf" not in url.lower() or url in seen:
                continue
            seen.add(url)
            title = normalize_space(anchor.get_text(" ", strip=True)) or Path(
                urllib.parse.urlparse(url).path
            ).stem
            haystack = normalize_key(f"{title} {url}")
            kind = "season_standings" if "jahreswertung" in haystack else "results"
            filename = Path(urllib.parse.unquote(urllib.parse.urlparse(url).path)).name
            sources.append(Source(year, title, url, kind, filename))

    sources.sort(key=lambda item: (item.year, item.title, item.url))
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(
        json.dumps([dataclasses.asdict(item) for item in sources], ensure_ascii=False, indent=2)
        + "\n"
    )
    return sources


def scrape_official_athletes() -> dict[str, dict]:
    athletes: dict[str, dict] = {}
    pages = [
        ("active", "https://steinstossen.ch/aktive/"),
        ("former", "https://steinstossen.ch/ehemalige/"),
    ]
    for status, url in pages:
        soup = BeautifulSoup(fetch_bytes(url), "html.parser")
        for item in soup.select(".user-item"):
            name_node = item.select_one(".media .h3")
            if not name_node:
                continue
            name = normalize_space(name_node.get_text(" ", strip=True))
            key = athlete_token_key(name)
            if not key:
                continue
            stats: dict[str, int | None] = {
                "birth_year": None,
                "height_cm": None,
                "body_weight_kg": None,
                "career_start_year": None,
            }
            for stat in item.select(".stats-item"):
                label = normalize_key(stat.get_text(" ", strip=True).split(":", 1)[0])
                span = stat.find("span")
                value_match = re.search(r"\d+(?:[.,]\d+)?", span.get_text(" ", strip=True) if span else "")
                if not value_match:
                    continue
                value = int(float(value_match.group().replace(",", ".")))
                if "jahrgang" in label:
                    stats["birth_year"] = value
                elif "grosse" in label:
                    stats["height_cm"] = value
                elif "gewicht" in label:
                    stats["body_weight_kg"] = value
                elif "beginn" in label:
                    stats["career_start_year"] = value
            image = item.select_one(".media img")
            image_url = None
            if image:
                image_url = image.get("data-src") or image.get("src")
                if image_url and str(image_url).startswith("data:"):
                    image_url = None
            athletes[key] = {
                "name": name,
                "status": status,
                "source_url": url,
                "image_url": image_url,
                **stats,
            }
    OFFICIAL_ATHLETES_PATH.write_text(
        json.dumps(list(athletes.values()), ensure_ascii=False, indent=2) + "\n"
    )
    return athletes


def download_one(source: Source, force: bool = False) -> tuple[Source, Path, str]:
    year_dir = PDF_DIR / str(source.year)
    year_dir.mkdir(parents=True, exist_ok=True)
    safe_name = re.sub(r"[^A-Za-z0-9._-]+", "-", source.filename)
    path = year_dir / safe_name
    if path.exists() and path.stat().st_size > 1000 and not force:
        return source, path, "cached"
    data = fetch_bytes(source.url)
    path.write_bytes(data)
    time.sleep(0.05)
    return source, path, "downloaded"


def download_sources(sources: list[Source], workers: int, force: bool) -> dict[str, Path]:
    paths: dict[str, Path] = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(download_one, source, force) for source in sources]
        for index, future in enumerate(concurrent.futures.as_completed(futures), start=1):
            source, path, state = future.result()
            paths[source.url] = path
            if index % 25 == 0 or index == len(futures):
                print(f"downloaded/cached {index}/{len(futures)} ({state}: {path.name})")
    return paths


def command_output(command: list[str], timeout: int = 180) -> str:
    result = subprocess.run(command, check=True, capture_output=True, text=True, timeout=timeout)
    return result.stdout


def page_count(path: Path) -> int:
    try:
        info = command_output(["pdfinfo", str(path)])
        match = re.search(r"^Pages:\s+(\d+)", info, re.M)
        return int(match.group(1)) if match else 0
    except (subprocess.SubprocessError, FileNotFoundError):
        return 0


def native_pdf_text(path: Path) -> str:
    with tempfile.NamedTemporaryFile(suffix=".txt") as output:
        try:
            subprocess.run(
                ["pdftotext", "-layout", str(path), output.name],
                check=True,
                capture_output=True,
                timeout=180,
            )
        except (subprocess.SubprocessError, FileNotFoundError):
            return ""
        return Path(output.name).read_text(errors="replace")


def text_has_results(text: str) -> bool:
    distance_lines = sum(
        1
        for line in text.splitlines()
        if DISTANCE_RE.search(line) or (RANK_RE.match(line) and BARE_DISTANCE_RE.search(line))
    )
    return len(text.strip()) >= 100 and distance_lines >= 2


def ocr_image_text(path: Path) -> str:
    if not shutil.which("tesseract"):
        return ""
    result = subprocess.run(
        [
            "tesseract", str(path), "stdout", "--psm", "6", "-l", "eng",
            "-c", "preserve_interword_spaces=1",
        ],
        check=True,
        capture_output=True,
        text=True,
        timeout=180,
    )
    return result.stdout


def ocr_pdf_text(path: Path, page_segmentation_mode: int = 6) -> str:
    if not shutil.which("pdftoppm") or not shutil.which("tesseract"):
        return ""
    pages: list[str] = []
    with tempfile.TemporaryDirectory(prefix="steinstossen-ocr-") as tmp:
        prefix = Path(tmp) / "page"
        subprocess.run(
            ["pdftoppm", "-r", "240", "-jpeg", "-jpegopt", "quality=92", str(path), str(prefix)],
            check=True,
            capture_output=True,
            timeout=600,
        )
        for image in sorted(Path(tmp).glob("page-*.jpg")):
            result = subprocess.run(
                [
                    "tesseract", str(image), "stdout", "--psm", str(page_segmentation_mode), "-l", "eng",
                    "-c", "preserve_interword_spaces=1",
                ],
                check=True,
                capture_output=True,
                text=True,
                timeout=180,
            )
            pages.append(result.stdout)
    return "\f".join(pages)


def extract_text(source: Source, path: Path, force: bool = False) -> tuple[str, str, int]:
    output_dir = TEXT_DIR / str(source.year)
    output_dir.mkdir(parents=True, exist_ok=True)
    stem = path.stem
    text_path = output_dir / f"{stem}.txt"
    meta_path = output_dir / f"{stem}.json"
    if text_path.exists() and meta_path.exists() and not force:
        metadata = json.loads(meta_path.read_text())
        return text_path.read_text(errors="replace"), metadata["method"], metadata["pages"]

    image_source = path.suffix.casefold() in {".jpg", ".jpeg", ".png", ".tif", ".tiff"}
    if image_source:
        native = ""
        text = ocr_image_text(path)
        method = "ocr_image" if text_has_results(text) else "ocr_image_unverified"
        pages = 1
    else:
        native = native_pdf_text(path)
        method = "native"
        text = native
        if not text_has_results(native) and source.kind == "results":
            ocr = ocr_pdf_text(path, 6)
            if text_has_results(ocr):
                text = ocr
                method = "ocr"
            else:
                table_ocr = ocr_pdf_text(path, 4)
                if text_has_results(table_ocr):
                    text = table_ocr
                    method = "ocr_table"
                elif len(table_ocr.strip()) > max(len(native.strip()), len(ocr.strip())):
                    text = table_ocr
                    method = "ocr_table_unverified"
                elif len(ocr.strip()) > len(native.strip()):
                    text = ocr
                    method = "ocr_unverified"
        pages = page_count(path)
    text_path.write_text(text)
    meta_path.write_text(json.dumps({"method": method, "pages": pages}, indent=2) + "\n")
    return text, method, pages


def canonical_series(title: str) -> str:
    key = normalize_key(title)
    for pattern, name in SERIES_RULES:
        if re.search(pattern, key, re.I):
            return name
    cleaned = re.sub(r"\b(?:19|20)\d{2}\b|\b\d{2}\b", "", title)
    cleaned = re.sub(r"\b(?:Rangliste|Schlussrangliste|Resultate|Steinstossen)\b", "", cleaned, flags=re.I)
    return normalize_space(cleaned.strip(" -–—")) or title


def parse_date(text: str, season: int) -> str | None:
    sample = text[:5000]
    numeric = re.search(r"\b([0-3]?\d)[./-]([01]?\d)[./-]((?:19|20)\d{2})\b", sample)
    if numeric:
        day, month, year = map(int, numeric.groups())
        with contextlib.suppress(ValueError):
            return dt.date(year, month, day).isoformat()
    named = re.search(
        r"\b([0-3]?\d)\.?\s+(" + "|".join(map(re.escape, GERMAN_MONTHS)) + r")\s+((?:19|20)\d{2})\b",
        sample,
        re.I,
    )
    if named:
        day = int(named.group(1))
        month = GERMAN_MONTHS[named.group(2).casefold()]
        year = int(named.group(3))
        with contextlib.suppress(ValueError):
            return dt.date(year, month, day).isoformat()
    return None


def parse_weight(label: str) -> float | None:
    match = WEIGHT_RE.search(label)
    return float(match.group(1).replace(",", ".")) if match else None


def classify_sex(label: str, weight: float | None = None) -> str:
    value = normalize_key(label)
    female = ("damen", "frau", "madchen", "juniorinnen", "seniorinnen", "weiblich")
    male = ("herren", "mann", "knaben", "junioren", "senioren", "manner", "maennlich", "lanner")
    if any(term in value for term in female) or re.search(r"\b(?:m4|ji6|d6|d12)\b", value):
        return "female"
    if any(term in value for term in male) or re.search(r"\b(?:k8|j10|h12|h18|h40|h73)\b", value):
        return "male"
    if "mixed" in value or "gemischt" in value:
        return "mixed"
    # Historic open lists frequently omit "Herren" but use stones reserved for the
    # men's competition program. Do not infer ambiguous 12.5 kg and lighter classes.
    if weight is not None and weight > 12.5:
        return "male"
    return "unknown"


def classify_age_group(label: str) -> str:
    value = normalize_key(label)
    if "madchen" in value or "knaben" in value or "bis 16" in value:
        return "youth"
    if "junior" in value or "17 19" in value:
        return "junior"
    if "senior" in value or "+40" in label or "ue40" in value:
        return "masters"
    if "offen" in value or "open" in value:
        return "open"
    if "mannschaft" in value or "team" in value:
        return "team"
    return "unspecified"


def classify_technique(label: str) -> str:
    value = normalize_key(label)
    if "stand" in value:
        return "standing"
    if "anlauf" in value:
        return "run-up"
    if "frei" in value:
        return "free"
    if "einh" in value:
        return "one-handed"
    return "unspecified"


def looks_like_category(line: str) -> bool:
    value = normalize_key(line)
    if not value or len(value) > 180:
        return False
    # A weight-only heading such as "67 kg" otherwise resembles rank 67.
    if WEIGHT_RE.search(line) and len(value.split()) <= 12 and not DISTANCE_RE.search(line):
        return True
    if RANK_RE.match(line):
        return False
    if value.startswith(("rang ", "rangliste", "steinstossen 20", "schweizermeister")):
        return False
    keywords = ("kg", "stein", "kategorie", "damen", "herren", "madchen", "knaben", "junior", "senior", "mannschaft")
    return any(keyword in value for keyword in keywords) and (WEIGHT_RE.search(line) is not None or "kategorie" in value)


def clean_category(line: str) -> str:
    line = re.sub(r"^\s*Kategorie\s*:\s*", "", line, flags=re.I)
    line = re.sub(r"\s*\(\d+\)\s*$", "", line)
    return normalize_space(line)


def split_result_segments(line: str) -> list[str]:
    """Split two-column ranking rows without splitting four-digit birth years."""
    starts = [match.start() for match in RANK_START_RE.finditer(line)]
    if len(starts) <= 1:
        return [line]
    return [line[start:end].rstrip() for start, end in zip(starts, starts[1:] + [len(line)])]


def parse_result_line(
    line: str,
    category: str,
    allow_bare_distances: bool,
    record_inline_attempts: bool,
    rank_at_end: bool,
    name_after_distances: bool,
    allow_unranked: bool,
    integer_centimetres: bool,
) -> dict | None:
    if ATTEMPT_RE.search(line):
        return None
    prepared = re.sub(r"^\s*(\d{1,3})[.,]?\s*Rang\s+", r"\1 ", line, flags=re.I)
    if not RANK_RE.match(prepared):
        embedded = re.match(
            r"^\s*(.+?,.+?)\s+(\d{1,3})\s+((?:\d{1,2}[.,:]\d+|0)(?:\s+.*)?)$",
            prepared,
        )
        if embedded:
            prepared = f"{embedded.group(2)} {embedded.group(1)} {embedded.group(3)}"
    if not RANK_RE.match(prepared):
        trailing = re.match(r"^\s*(.+?)\s+(\d{1,3})\.?\s*(?:Rang)?\s*$", prepared, re.I)
        has_measurement = BARE_DISTANCE_RE.search(trailing.group(1)) if trailing else None
        if trailing and (has_measurement or (integer_centimetres and CENTIMETRE_RE.search(trailing.group(1)))):
            prepared = f"{trailing.group(2)} {trailing.group(1)}"
    rank_match = RANK_RE.match(prepared)
    if not rank_match and allow_unranked and BARE_DISTANCE_RE.search(prepared):
        prepared = f"- {prepared}"
        rank_match = RANK_RE.match(prepared)
    if not rank_match:
        return None
    rank_text = rank_match.group("rank")
    body = re.sub(r"^[|+‘'`]+\s*", "", rank_match.group("body"))
    body = re.sub(r"^Rang\s+", "", body, flags=re.I)
    distance_matches = list(DISTANCE_RE.finditer(body))
    bare = False
    if not distance_matches and allow_bare_distances:
        distance_matches = list(BARE_DISTANCE_RE.finditer(body))
        bare = True
    centimetres = False
    if not distance_matches and integer_centimetres:
        distance_matches = list(CENTIMETRE_RE.finditer(body))
        centimetres = True
    distances = [
        (
            match.start(),
            float(match.group(1).replace(",", ".").replace(":", ".")) / (100 if centimetres else 1),
        )
        for match in distance_matches
    ]
    if not distances:
        return None
    first_distance_at = distances[0][0]
    if name_after_distances:
        identity_raw = body[distances[-1][0] + len(distance_matches[-1].group(0)) :].strip()
    else:
        identity_raw = body[:first_distance_at].rstrip(" -–—")
    identity_raw = re.sub(r"^\(\d+\)\s*", "", identity_raw)
    identity = normalize_space(identity_raw)
    if not identity or normalize_key(identity).startswith(("rang ", "name ")):
        return None

    birth_year: int | None = None
    club: str | None = None
    locality: str | None = None
    name = identity
    year_match = YEAR_RE.search(identity_raw)
    if year_match:
        birth_year = int(year_match.group(1))
        prefix_raw = identity_raw[: year_match.start()].strip()
        suffix_raw = identity_raw[year_match.end() :].strip()
        if "," in prefix_raw:
            name, prefix_club = prefix_raw.split(",", 1)
            name = normalize_space(name)
            club = normalize_space(prefix_club) or None
        else:
            prefix_fields = [
                normalize_space(field) for field in re.split(r"\s{2,}", prefix_raw) if normalize_space(field)
            ]
            if len(prefix_fields) >= 3 and len(prefix_fields[0].split()) == 1 and len(prefix_fields[1].split()) == 1:
                name = f"{prefix_fields[0]} {prefix_fields[1]}"
                locality = prefix_fields[2]
            elif len(prefix_fields) >= 2:
                name = prefix_fields[0]
                locality = prefix_fields[1]
            else:
                tokens = normalize_space(prefix_raw).split()
                name = " ".join(tokens[:2])
                locality = " ".join(tokens[2:]) or None
        club = club or normalize_space(suffix_raw) or None
    elif "," in identity:
        name, rest = identity.split(",", 1)
        name = normalize_space(name)
        locality = normalize_space(rest) or None
    else:
        fields = [normalize_space(field) for field in re.split(r"\s{2,}", identity_raw) if normalize_space(field)]
        if fields:
            first = re.sub(r"^\(\d+\)\s*", "", fields[0]).strip()
            if len(fields) >= 3 and len(first.split()) == 1 and len(fields[1].split()) == 1:
                name = f"{first} {fields[1]}"
                locality = fields[2]
            elif len(fields) == 2 and len(first.split()) == 1 and len(fields[1].split()) == 1:
                name = f"{first} {fields[1]}"
            elif len(fields) == 1:
                tokens = first.split()
                organization_at = next(
                    (
                        index for index, token in enumerate(tokens[2:], start=2)
                        if normalize_key(token) in {"stv", "tv", "tsv", "dtv", "ktv", "sv", "ssc", "nt", "team"}
                    ),
                    None,
                )
                if organization_at is not None:
                    name = " ".join(tokens[:organization_at])
                    club = " ".join(tokens[organization_at:]) or None
                else:
                    name_length = 3 if tokens and normalize_key(tokens[0]) in {"de", "von", "van"} else 2
                    name = " ".join(tokens[:name_length])
                    locality = " ".join(tokens[name_length:]) or None
            else:
                name = first
                if len(fields) > 1:
                    locality = fields[1]

    embedded_rank = re.match(r"^(\d{1,3})[.)]?\s+(.+)$", name)
    if embedded_rank:
        rank_text = embedded_rank.group(1)
        name = embedded_rank.group(2)
    name = normalize_space(re.sub(r"\s+(?:Schweizerrekord|Rekord|Unfall)\s*$", "", name, flags=re.I))
    name_key_before_clean = normalize_key(name)
    organization_prefixes = ("stv ", "tv ", "tsv ", "dtv ", "ktv ", "sv ", "team ", "ntv ", "verein ")
    participant_type = (
        "team"
        if any(term in normalize_key(category) for term in ("mannschaft", "team"))
        or name_key_before_clean.startswith(organization_prefixes)
        else "athlete"
    )
    if participant_type == "athlete":
        name = clean_person_name(name)
    name_key = normalize_key(name)
    tokens = name_key.split()
    minimum_tokens = 1 if participant_type == "team" else 2
    if len(tokens) < minimum_tokens or len(tokens) > 7 or len(name) > 90:
        return None
    if participant_type == "athlete" and any(char.isdigit() for char in name):
        return None
    if any(term in name_key for term in ("vorrunde", "final", "rang name", "kategorie", "bestweite", "meter")):
        return None
    if sum(char.isalpha() for char in name) < max(4, len(name) // 2):
        return None
    inline_attempts = []
    if bare and record_inline_attempts and len(distances) >= 2:
        # Only record attempts when the table explicitly labels attempt columns. The
        # final value is normally Bestweite/Final and is therefore a summary.
        inline_attempts = [
            (index, value, value > 0) for index, (_, value) in enumerate(distances[:-1], start=1)
        ]
    numeric_rank = re.match(r"\d+", rank_text)
    return {
        "rank": int(numeric_rank.group()) if numeric_rank else None,
        "raw_name": name,
        "birth_year": birth_year,
        "club": club,
        "locality": locality,
        "best_distance_m": max(value for _, value in distances),
        "participant_type": participant_type,
        "inline_attempts": inline_attempts,
    }


def parse_source(source: Source, text: str, method: str) -> list[ParsedResult]:
    if source.kind != "results":
        return []
    competition_date = parse_date(text, source.year)
    series = canonical_series(source.title)
    results: list[ParsedResult] = []
    title_weight = parse_weight(source.title)
    if title_weight is not None:
        current_category = source.title
    elif "unspunnen" in normalize_key(source.title):
        current_category = "Unspunnenstein 83.5 kg, Stossart frei"
    else:
        current_category = "Kategorie nicht angegeben"
    current_result: ParsedResult | None = None
    bare_distance_mode = parse_weight(current_category) is not None
    inline_attempt_mode = False
    rank_at_end_mode = False
    name_after_distance_mode = False
    unranked_table_mode = False
    integer_centimetre_mode = False

    for page_number, page in enumerate(text.split("\f"), start=1):
        for raw_line in page.splitlines():
            line = raw_line.rstrip()
            line_key = normalize_key(line)
            if "rangliste steinstossen" in line_key:
                bare_distance_mode = True
            if any(header in line_key for header in ("weite", "bestweite", "distanz", "resultat", "ergebniss", "versuch", "wurf")):
                bare_distance_mode = True
            if "geworfene weite" in line_key:
                integer_centimetre_mode = True
                bare_distance_mode = True
            if any(header in line_key for header in ("stoss 1", "stoss1", "1 stoss", "versuch", "wurf 1", "nr 1", "nr. 1")):
                inline_attempt_mode = True
            if "rangierung" in line_key or ("ergebnis" in line_key and line_key.endswith("rang")):
                rank_at_end_mode = True
            if "vorname" in line_key:
                first_name_at = line_key.find("vorname")
                distance_header_at = min(
                    [position for key in ("weite", "finale", "vorrunde", "distanz") if (position := line_key.find(key)) >= 0]
                    or [10_000]
                )
                name_after_distance_mode = distance_header_at < first_name_at
                unranked_table_mode = "rang" not in line_key
            if "rangliste" in line_key and parse_weight(line) is not None:
                current_category = clean_category(line)
                bare_distance_mode = True
                inline_attempt_mode = False
                current_result = None
                continue
            explicit_category = re.search(r"Kategorie\s*:\s*(.+)$", line, re.I)
            if explicit_category:
                candidate = clean_category(explicit_category.group(1))
                current_category = candidate or "Kategorie nicht angegeben"
                bare_distance_mode = parse_weight(current_category) is not None
                inline_attempt_mode = False
                current_result = None
                continue
            if looks_like_category(line):
                current_category = clean_category(line)
                bare_distance_mode = parse_weight(current_category) is not None
                inline_attempt_mode = False
                current_result = None
                continue

            attempts = [
                (int(number), float(distance.replace(",", ".")), float(distance.replace(",", ".")) > 0)
                for number, distance in ATTEMPT_RE.findall(line)
            ]
            if attempts and current_result is not None:
                existing = {number for number, _, _ in current_result.attempts}
                current_result.attempts.extend(item for item in attempts if item[0] not in existing)
                continue

            for segment in split_result_segments(line):
                parsed = parse_result_line(
                    segment,
                    current_category,
                    bare_distance_mode,
                    inline_attempt_mode,
                    rank_at_end_mode,
                    name_after_distance_mode,
                    unranked_table_mode,
                    integer_centimetre_mode,
                )
                if not parsed:
                    continue
                normalized_name = athlete_token_key(parsed["raw_name"])
                if not normalized_name:
                    continue
                stone_weight = parse_weight(current_category)
                result = ParsedResult(
                    source_url=source.url,
                    source_page=page_number,
                    competition_name=source.title,
                    series_name=series,
                    season=source.year,
                    competition_date=competition_date,
                    category_label=current_category,
                    sex=classify_sex(current_category, stone_weight),
                    age_group=classify_age_group(current_category),
                    participant_type=parsed["participant_type"],
                    stone_weight_kg=stone_weight,
                    technique=classify_technique(current_category),
                    rank=parsed["rank"],
                    raw_name=parsed["raw_name"],
                    normalized_name=normalized_name,
                    birth_year=parsed["birth_year"],
                    club=parsed["club"],
                    locality=parsed["locality"],
                    best_distance_m=parsed["best_distance_m"],
                    attempts=parsed["inline_attempts"],
                    extraction_method=method,
                    quality_status=(
                        "no_valid_throw"
                        if parsed["best_distance_m"] <= 0
                        else "outlier"
                        if parsed["participant_type"] == "athlete" and parsed["best_distance_m"] > 16
                        else "valid"
                    ),
                    raw_line=normalize_space(segment),
                )
                results.append(result)
                current_result = result
    return results


SCHEMA = """
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE source_documents (
  id INTEGER PRIMARY KEY,
  season INTEGER NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  document_kind TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  page_count INTEGER NOT NULL DEFAULT 0,
  extraction_method TEXT NOT NULL,
  import_status TEXT NOT NULL,
  parsed_result_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE competitions (
  id INTEGER PRIMARY KEY,
  source_document_id INTEGER NOT NULL UNIQUE REFERENCES source_documents(id),
  season INTEGER NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  series_name TEXT NOT NULL,
  series_slug TEXT NOT NULL,
  competition_date TEXT
);
CREATE INDEX competitions_season_idx ON competitions(season);
CREATE INDEX competitions_series_idx ON competitions(series_slug, season);

CREATE TABLE disciplines (
  id INTEGER PRIMARY KEY,
  canonical_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sex TEXT NOT NULL CHECK (sex IN ('female','male','mixed','unknown')),
  age_group TEXT NOT NULL,
  participant_type TEXT NOT NULL CHECK (participant_type IN ('athlete','team')),
  stone_weight_kg REAL,
  technique TEXT NOT NULL
);

CREATE TABLE athletes (
  id INTEGER PRIMARY KEY,
  canonical_key TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  birth_year INTEGER,
  sex TEXT NOT NULL DEFAULT 'unknown',
  first_season INTEGER NOT NULL,
  last_season INTEGER NOT NULL,
  result_count INTEGER NOT NULL DEFAULT 0,
  official_status TEXT,
  height_cm INTEGER,
  body_weight_kg INTEGER,
  career_start_year INTEGER,
  profile_image_url TEXT
);
CREATE INDEX athletes_name_idx ON athletes(display_name);

CREATE TABLE athlete_aliases (
  id INTEGER PRIMARY KEY,
  athlete_id INTEGER NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  raw_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  occurrence_count INTEGER NOT NULL,
  UNIQUE(athlete_id, raw_name)
);

CREATE TABLE results (
  id INTEGER PRIMARY KEY,
  competition_id INTEGER NOT NULL REFERENCES competitions(id),
  source_document_id INTEGER NOT NULL REFERENCES source_documents(id),
  athlete_id INTEGER REFERENCES athletes(id),
  discipline_id INTEGER NOT NULL REFERENCES disciplines(id),
  participant_name TEXT NOT NULL,
  club TEXT,
  locality TEXT,
  birth_year INTEGER,
  rank INTEGER,
  best_distance_m REAL NOT NULL,
  source_page INTEGER NOT NULL,
  extraction_method TEXT NOT NULL,
  attempt_data_complete INTEGER NOT NULL DEFAULT 0,
  quality_status TEXT NOT NULL CHECK (quality_status IN ('valid','no_valid_throw','outlier')),
  raw_line TEXT NOT NULL,
  UNIQUE(source_document_id, source_page, raw_line)
);
CREATE INDEX results_athlete_idx ON results(athlete_id);
CREATE INDEX results_competition_idx ON results(competition_id);
CREATE INDEX results_discipline_idx ON results(discipline_id);

CREATE TABLE attempts (
  id INTEGER PRIMARY KEY,
  result_id INTEGER NOT NULL REFERENCES results(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  distance_m REAL NOT NULL,
  successful INTEGER NOT NULL CHECK (successful IN (0,1)),
  UNIQUE(result_id, attempt_number)
);

CREATE VIEW result_metrics AS
SELECT
  r.*,
  CASE WHEN r.quality_status != 'valid' THEN 0
       WHEN EXISTS (SELECT 1 FROM attempts a WHERE a.result_id = r.id)
       THEN (SELECT COUNT(*) FROM attempts a WHERE a.result_id = r.id AND a.successful = 1 AND a.distance_m <= 16)
       WHEN r.best_distance_m > 0 THEN 1 ELSE 0 END AS recorded_successful_throws,
  CASE WHEN r.quality_status != 'valid' THEN 0
       WHEN EXISTS (SELECT 1 FROM attempts a WHERE a.result_id = r.id)
       THEN (SELECT COALESCE(SUM(a.distance_m),0) FROM attempts a WHERE a.result_id = r.id AND a.successful = 1 AND a.distance_m <= 16)
       WHEN r.best_distance_m > 0 THEN r.best_distance_m ELSE 0 END AS recorded_successful_distance_m,
  CASE WHEN EXISTS (SELECT 1 FROM attempts a WHERE a.result_id = r.id) THEN 1 ELSE 0 END AS has_explicit_attempts
FROM results r;
"""


def create_database(
    sources: list[Source],
    paths: dict[str, Path],
    extracted: dict[str, tuple[str, str, int]],
    parsed_results: list[ParsedResult],
    official_athletes: dict[str, dict],
) -> dict:
    if DB_PATH.exists():
        DB_PATH.unlink()
    connection = sqlite3.connect(DB_PATH)
    connection.executescript(SCHEMA)

    source_ids: dict[str, int] = {}
    competition_ids: dict[str, int] = {}
    parsed_counts = Counter(result.source_url for result in parsed_results)

    with connection:
        for source in sources:
            path = paths[source.url]
            text, method, pages = extracted[source.url]
            status = "parsed" if parsed_counts[source.url] else (
                "reference_only" if source.kind != "results" else "no_results_detected"
            )
            cursor = connection.execute(
                """INSERT INTO source_documents
                (season,title,url,filename,document_kind,sha256,page_count,extraction_method,import_status,parsed_result_count)
                VALUES (?,?,?,?,?,?,?,?,?,?)""",
                (
                    source.year, source.title, source.url, source.filename, source.kind,
                    hashlib.sha256(path.read_bytes()).hexdigest(), pages, method, status,
                    parsed_counts[source.url],
                ),
            )
            source_ids[source.url] = cursor.lastrowid
            if source.kind == "results":
                slug = f"{source.year}-{slugify(source.title)}-{cursor.lastrowid}"
                series = canonical_series(source.title)
                date = parse_date(text, source.year)
                comp = connection.execute(
                    """INSERT INTO competitions
                    (source_document_id,season,name,slug,series_name,series_slug,competition_date)
                    VALUES (?,?,?,?,?,?,?)""",
                    (cursor.lastrowid, source.year, source.title, slug, series, slugify(series), date),
                )
                competition_ids[source.url] = comp.lastrowid

    individual_results = [
        result
        for result in parsed_results
        if result.participant_type == "athlete" and result.quality_status == "valid"
    ]

    # Merge low-frequency parser aliases that append a locality or club to an already
    # established name. This is intentionally conservative: the base identity must
    # have at least five results and the expanded alias no more than ten.
    key_counts = Counter(result.normalized_name for result in individual_results)
    established = [
        key
        for key, count in key_counts.items()
        if (count >= 5 or key in official_athletes) and len(key.split()) >= 2
    ]
    for result in individual_results:
        current_key = result.normalized_name
        current_tokens = set(current_key.split())
        if key_counts[current_key] > 10 or len(current_tokens) <= 2:
            continue
        candidates = [
            key
            for key in established
            if set(key.split()) < current_tokens and len(current_tokens - set(key.split())) <= 3
        ]
        if candidates:
            result.normalized_name = max(candidates, key=lambda key: (len(key.split()), key_counts[key]))

    grouped: dict[str, list[ParsedResult]] = defaultdict(list)
    for result in individual_results:
        grouped[result.normalized_name].append(result)

    athlete_lookup: dict[tuple[str, int | None], int] = {}
    with connection:
        for token_key, group in sorted(grouped.items()):
            official = official_athletes.get(token_key)
            source_years = sorted({item.birth_year for item in group if item.birth_year})
            known_years = [official["birth_year"]] if official and official.get("birth_year") else source_years
            buckets: dict[int | None, list[ParsedResult]] = defaultdict(list)
            if official and official.get("birth_year"):
                buckets[official["birth_year"]].extend(group)
            elif len(known_years) <= 1:
                for item in group:
                    buckets[known_years[0] if known_years else None].append(item)
            else:
                for item in group:
                    buckets[item.birth_year].append(item)
            for birth_year, bucket in buckets.items():
                names = Counter(item.raw_name for item in bucket)
                display_name = official["name"] if official else names.most_common(1)[0][0]
                seasons = [item.season for item in bucket]
                sexes = Counter(item.sex for item in bucket if item.sex != "unknown")
                sex = sexes.most_common(1)[0][0] if sexes else "unknown"
                canonical_key = f"{token_key}|{birth_year or 'unknown'}" if len(known_years) > 1 else token_key
                base_slug = slugify(display_name)
                athlete_slug = base_slug
                suffix = 2
                while connection.execute("SELECT 1 FROM athletes WHERE slug=?", (athlete_slug,)).fetchone():
                    athlete_slug = f"{base_slug}-{birth_year or suffix}"
                    suffix += 1
                cursor = connection.execute(
                    """INSERT INTO athletes
                    (canonical_key,slug,display_name,birth_year,sex,first_season,last_season,result_count,
                     official_status,height_cm,body_weight_kg,career_start_year,profile_image_url)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (
                        canonical_key, athlete_slug, display_name, birth_year, sex, min(seasons), max(seasons),
                        len(bucket), official.get("status") if official else None,
                        official.get("height_cm") if official else None,
                        official.get("body_weight_kg") if official else None,
                        official.get("career_start_year") if official else None,
                        official.get("image_url") if official else None,
                    ),
                )
                athlete_id = cursor.lastrowid
                for item in bucket:
                    athlete_lookup[(item.normalized_name, item.birth_year if len(known_years) > 1 else None)] = athlete_id
                for raw_name, count in names.items():
                    connection.execute(
                        "INSERT INTO athlete_aliases (athlete_id,raw_name,normalized_name,occurrence_count) VALUES (?,?,?,?)",
                        (athlete_id, raw_name, athlete_token_key(raw_name), count),
                    )

    discipline_ids: dict[str, int] = {}
    with connection:
        for item in parsed_results:
            discipline_key = "|".join(
                [
                    normalize_key(item.category_label), item.sex, item.age_group,
                    item.participant_type, str(item.stone_weight_kg or "unknown"), item.technique,
                ]
            )
            if discipline_key not in discipline_ids:
                cursor = connection.execute(
                    """INSERT INTO disciplines
                    (canonical_key,label,sex,age_group,participant_type,stone_weight_kg,technique)
                    VALUES (?,?,?,?,?,?,?)""",
                    (
                        discipline_key, item.category_label, item.sex, item.age_group,
                        item.participant_type, item.stone_weight_kg, item.technique,
                    ),
                )
                discipline_ids[discipline_key] = cursor.lastrowid
            athlete_id = None
            if item.participant_type == "athlete":
                token_group = grouped[item.normalized_name]
                known_years = {entry.birth_year for entry in token_group if entry.birth_year}
                lookup_year = (
                    item.birth_year
                    if len(known_years) > 1 and item.normalized_name not in official_athletes
                    else None
                )
                athlete_id = athlete_lookup.get((item.normalized_name, lookup_year))
            cursor = connection.execute(
                """INSERT OR IGNORE INTO results
                (competition_id,source_document_id,athlete_id,discipline_id,participant_name,club,locality,
                 birth_year,rank,best_distance_m,source_page,extraction_method,attempt_data_complete,quality_status,raw_line)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    competition_ids[item.source_url], source_ids[item.source_url], athlete_id,
                    discipline_ids[discipline_key], item.raw_name, item.club, item.locality,
                    item.birth_year, item.rank, item.best_distance_m, item.source_page,
                    item.extraction_method, 1 if item.attempts else 0, item.quality_status, item.raw_line,
                ),
            )
            result_id = cursor.lastrowid
            if result_id:
                for attempt_number, distance, successful in item.attempts:
                    connection.execute(
                        "INSERT OR IGNORE INTO attempts (result_id,attempt_number,distance_m,successful) VALUES (?,?,?,?)",
                        (result_id, attempt_number, distance, int(successful)),
                    )

    connection.execute("PRAGMA optimize")
    stats = {
        "generated_at": dt.datetime.now(dt.UTC).isoformat(),
        "archive_url": ARCHIVE_URL,
        "sources": connection.execute("SELECT COUNT(*) FROM source_documents").fetchone()[0],
        "parsed_sources": connection.execute("SELECT COUNT(*) FROM source_documents WHERE import_status='parsed'").fetchone()[0],
        "ocr_sources": connection.execute("SELECT COUNT(*) FROM source_documents WHERE extraction_method LIKE 'ocr%'").fetchone()[0],
        "competitions": connection.execute("SELECT COUNT(*) FROM competitions").fetchone()[0],
        "athletes": connection.execute("SELECT COUNT(*) FROM athletes").fetchone()[0],
        "disciplines": connection.execute("SELECT COUNT(*) FROM disciplines").fetchone()[0],
        "results": connection.execute("SELECT COUNT(*) FROM results").fetchone()[0],
        "attempts": connection.execute("SELECT COUNT(*) FROM attempts").fetchone()[0],
        "results_with_explicit_attempts": connection.execute(
            "SELECT COUNT(DISTINCT result_id) FROM attempts"
        ).fetchone()[0],
        "season_min": connection.execute("SELECT MIN(season) FROM competitions").fetchone()[0],
        "season_max": connection.execute("SELECT MAX(season) FROM competitions").fetchone()[0],
        "unknown_sex_results": connection.execute(
            "SELECT COUNT(*) FROM results r JOIN disciplines d ON d.id=r.discipline_id WHERE d.sex='unknown'"
        ).fetchone()[0],
        "unknown_weight_results": connection.execute(
            "SELECT COUNT(*) FROM results r JOIN disciplines d ON d.id=r.discipline_id WHERE d.stone_weight_kg IS NULL"
        ).fetchone()[0],
        "official_athlete_profiles": connection.execute(
            "SELECT COUNT(*) FROM athletes WHERE official_status IS NOT NULL"
        ).fetchone()[0],
        "excluded_outlier_rows": connection.execute(
            "SELECT COUNT(*) FROM results WHERE quality_status='outlier'"
        ).fetchone()[0],
    }
    connection.close()
    REPORT_PATH.write_text(json.dumps(stats, ensure_ascii=False, indent=2) + "\n")
    return stats


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=6)
    parser.add_argument("--force-download", action="store_true")
    parser.add_argument("--force-extract", action="store_true")
    parser.add_argument("--limit", type=int, help="Process only the first N manifest entries")
    args = parser.parse_args()

    for command in ("pdftotext", "pdfinfo"):
        if not shutil.which(command):
            raise SystemExit(f"Required command not found: {command}")
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    PDF_DIR.mkdir(parents=True, exist_ok=True)
    TEXT_DIR.mkdir(parents=True, exist_ok=True)

    sources = scrape_manifest()
    official_athletes = scrape_official_athletes()
    if args.limit:
        sources = sources[: args.limit]
    print(
        f"manifest: {len(sources)} PDFs from {sources[0].year} to {sources[-1].year}; "
        f"official profiles: {len(official_athletes)}"
    )
    paths = download_sources(sources, max(1, args.workers), args.force_download)

    extracted: dict[str, tuple[str, str, int]] = {}
    parsed: list[ParsedResult] = []
    for index, source in enumerate(sources, start=1):
        text, method, pages = extract_text(source, paths[source.url], args.force_extract)
        extracted[source.url] = (text, method, pages)
        source_results = parse_source(source, text, method)
        parsed.extend(source_results)
        print(
            f"extract {index:03}/{len(sources)} {source.year} {source.title[:45]:45} "
            f"{method:14} pages={pages:2} results={len(source_results):3}"
        )

    stats = create_database(sources, paths, extracted, parsed, official_athletes)
    print(json.dumps(stats, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
