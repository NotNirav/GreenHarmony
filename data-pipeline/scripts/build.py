"""GreenHarmony AI data pipeline.

Builds the plant and insights datasets from the curated sources, validates them,
enriches plants from open data sources (GBIF, iNaturalist, OpenPlantDB, optional
Perenual) and exports JSON for the website.

Usage (from data-pipeline/):
    python scripts/build.py                # full build, uses cache, fetches missing
    python scripts/build.py --offline      # only use what is already cached
    python scripts/build.py --refresh gbif # re-fetch one source (gbif|inat|opdb|perenual)

All network responses are cached under cache/ so rebuilds are fast and offline-safe.
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import shutil
import statistics
import sys
import time
import unicodedata
import urllib.parse
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / "sources"
CACHE = ROOT / "cache"
OUTPUT = ROOT / "output"
WEB_DATA = ROOT.parent / "web" / "src" / "data"

USER_AGENT = "GreenHarmonyAI/0.1 (Indradhanu 2026 hackathon prototype)"
OPDB_URL = "https://raw.githubusercontent.com/cwfrazier1/openplantdb/main/data/plants.csv"

# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------
ENUMS = {
    "category": {"herb", "vegetable", "fruit", "flowering", "foliage", "succulent", "climber", "medicinal"},
    "availability": {"everywhere", "common", "specialty"},
    "water": {"low", "medium", "high"},
    "drought_tolerance": {"low", "medium", "high"},
    "humidity": {"low", "medium", "high", "any"},
    "habit": {"upright", "bushy", "trailing", "climber", "rosette", "clumping", "tree", "spreading"},
    "growth_rate": {"slow", "medium", "fast"},
    "lifecycle": {"annual", "biennial", "perennial"},
    "pet_safe": {"yes", "no", "unknown"},
}
LIST_ENUMS = {
    "zones": {"floor", "railing", "wall", "hanging", "rack", "windowsill", "indoor"},
    "benefits": {"food", "herb", "fragrance", "flowers", "pollinator", "medicinal", "air", "privacy",
                 "shade", "sacred", "ornamental"},
    "propagation": {"seed", "cutting", "sapling", "bulb", "division"},
}
INT_FIELDS = {"popularity": (1, 5), "price_inr_min": (0, 5000), "price_inr_max": (0, 10000),
              "temp_min_c": (-10, 30), "temp_max_c": (20, 50), "pot_depth_cm": (5, 80),
              "height_cm": (5, 1000), "spread_cm": (5, 500), "pollinator": (0, 3),
              "maintenance": (1, 5), "days_to_harvest": (0, 2000)}
FLOAT_FIELDS = {"sun_min_hrs": (0, 8), "sun_max_hrs": (0, 8), "min_pot_l": (0.5, 200)}
MONTH_FIELDS = ("plant_months", "peak_months")
REQUIRED = ("id", "common_name", "hindi_name", "botanical_name", "category", "why_popular", "care_tip")

INSIGHT_CATEGORIES = {"watering", "sunlight", "soil", "pests", "seasonal", "climate", "beginner",
                      "culture", "fact", "impact", "food", "space"}
INSIGHT_CONTEXTS = {"loading", "transition", "empty", "tip"}

DEVANAGARI = re.compile(r"[ऀ-ॿ]")


class Report:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []
        self.notes: list[str] = []

    def error(self, msg: str) -> None:
        self.errors.append(msg)

    def warn(self, msg: str) -> None:
        self.warnings.append(msg)


# ---------------------------------------------------------------------------
# Load + normalize
# ---------------------------------------------------------------------------
def split_list(value: str) -> list[str]:
    return [v.strip() for v in value.split(";") if v.strip()]


def load_plants(rep: Report) -> list[dict]:
    with open(SOURCES / "curated_plants.csv", encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))

    plants = []
    for line, row in enumerate(rows, start=2):
        p: dict = {k: (v or "").strip() for k, v in row.items()}
        pid = p.get("id") or f"<line {line}>"

        for field in REQUIRED:
            if not p.get(field):
                rep.error(f"{pid}: missing required field '{field}'")

        for field, allowed in ENUMS.items():
            if p[field] not in allowed:
                rep.error(f"{pid}: {field}='{p[field]}' not in {sorted(allowed)}")

        for field, allowed in LIST_ENUMS.items():
            p[field] = split_list(p[field])
            bad = [v for v in p[field] if v not in allowed]
            if bad:
                rep.error(f"{pid}: {field} has unknown values {bad}")
            if not p[field]:
                rep.error(f"{pid}: {field} is empty")

        for field, (lo, hi) in INT_FIELDS.items():
            try:
                p[field] = int(p[field])
            except ValueError:
                rep.error(f"{pid}: {field}='{p[field]}' is not an integer")
                continue
            if not lo <= p[field] <= hi:
                rep.error(f"{pid}: {field}={p[field]} outside [{lo}, {hi}]")

        for field, (lo, hi) in FLOAT_FIELDS.items():
            try:
                p[field] = float(p[field])
            except ValueError:
                rep.error(f"{pid}: {field}='{p[field]}' is not a number")
                continue
            if not lo <= p[field] <= hi:
                rep.error(f"{pid}: {field}={p[field]} outside [{lo}, {hi}]")

        for field in MONTH_FIELDS:
            try:
                months = sorted({int(m) for m in split_list(p[field])})
            except ValueError:
                rep.error(f"{pid}: {field} has non-numeric months")
                months = []
            if any(m < 1 or m > 12 for m in months):
                rep.error(f"{pid}: {field} has months outside 1-12")
            p[field] = months

        p["indoor_ok"] = p["indoor_ok"] == "yes"
        p["other_names"] = split_list(p.get("other_names") or "")
        for name_field in ("hindi_name", "marathi_name"):
            if p[name_field] and not DEVANAGARI.search(p[name_field]):
                rep.warn(f"{pid}: {name_field} '{p[name_field]}' is not in Devanagari")

        # Cross-field rules
        if isinstance(p["sun_min_hrs"], float) and isinstance(p["sun_max_hrs"], float) \
                and p["sun_min_hrs"] > p["sun_max_hrs"]:
            rep.error(f"{pid}: sun_min_hrs > sun_max_hrs")
        if isinstance(p["temp_min_c"], int) and isinstance(p["temp_max_c"], int) \
                and p["temp_min_c"] >= p["temp_max_c"]:
            rep.error(f"{pid}: temp_min_c >= temp_max_c")
        if isinstance(p["price_inr_min"], int) and isinstance(p["price_inr_max"], int) \
                and p["price_inr_min"] > p["price_inr_max"]:
            rep.error(f"{pid}: price_inr_min > price_inr_max")
        if "food" in p["benefits"] and p["category"] in {"vegetable", "fruit"} and not p["days_to_harvest"]:
            rep.warn(f"{pid}: edible crop without days_to_harvest")
        if p["indoor_ok"] and "indoor" not in p["zones"] and p["sun_min_hrs"] > 4:
            rep.warn(f"{pid}: indoor_ok but needs {p['sun_min_hrs']}h sun")
        if p["habit"] == "climber" and not {"wall", "railing"} & set(p["zones"]) and p["category"] != "foliage":
            rep.warn(f"{pid}: climber without wall/railing zone")

        plants.append(p)

    ids = Counter(p["id"] for p in plants)
    for pid, n in ids.items():
        if n > 1:
            rep.error(f"duplicate plant id '{pid}' ({n} rows)")
        if not re.fullmatch(r"[a-z0-9_]+", pid):
            rep.error(f"plant id '{pid}' must be lowercase snake_case")
    return plants


def load_insights(rep: Report, plant_ids: set[str]) -> list[dict]:
    with open(SOURCES / "insights.csv", encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    insights = []
    for row in rows:
        i = {k: (v or "").strip() for k, v in row.items()}
        iid = i["id"]
        i["contexts"] = split_list(i["contexts"])
        i["months"] = [int(m) for m in split_list(i["months"])]
        i["plant_ids"] = split_list(i["plant_ids"])
        if i["category"] not in INSIGHT_CATEGORIES:
            rep.error(f"insight {iid}: unknown category '{i['category']}'")
        bad = [c for c in i["contexts"] if c not in INSIGHT_CONTEXTS]
        if bad or not i["contexts"]:
            rep.error(f"insight {iid}: bad contexts {i['contexts']}")
        missing = [p for p in i["plant_ids"] if p not in plant_ids]
        if missing:
            rep.error(f"insight {iid}: unknown plant ids {missing}")
        if not i["text"]:
            rep.error(f"insight {iid}: empty text")
        elif len(i["text"]) > 160:
            rep.warn(f"insight {iid}: {len(i['text'])} chars, keep under 160 for one-liners")
        insights.append(i)
    dup = [k for k, n in Counter(i["id"] for i in insights).items() if n > 1]
    for d in dup:
        rep.error(f"duplicate insight id '{d}'")
    return insights


# ---------------------------------------------------------------------------
# Enrichment (cached)
# ---------------------------------------------------------------------------
class Fetcher:
    def __init__(self, offline: bool, refresh: set[str]) -> None:
        self.offline = offline
        self.refresh = refresh
        self.session = requests.Session()
        self.session.headers["User-Agent"] = USER_AGENT
        self.calls = Counter()

    def get_json(self, source: str, key: str, url: str, delay: float = 0.0):
        path = CACHE / source / f"{key}.json"
        if path.exists() and source not in self.refresh:
            return json.loads(path.read_text(encoding="utf-8"))
        if self.offline:
            return None
        for attempt in range(3):
            try:
                time.sleep(delay)
                r = self.session.get(url, timeout=30)
                if r.status_code == 429:
                    time.sleep(5 * (attempt + 1))
                    continue
                r.raise_for_status()
                data = r.json()
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
                self.calls[source] += 1
                return data
            except (requests.RequestException, ValueError) as exc:
                if attempt == 2:
                    print(f"  ! {source} {key}: {exc}", file=sys.stderr)
        return None


def clean_binomial(name: str) -> str:
    """'Capsicum annuum (Grossum Group)' -> 'Capsicum annuum'; keeps var./subsp."""
    name = re.sub(r"\(.*?\)", "", name)
    name = re.sub(r"'.*?'", "", name)
    name = name.replace("×", "x")
    return " ".join(name.split())


def species_key(name: str) -> str:
    parts = clean_binomial(name).lower().replace(" x ", " ").split()
    return " ".join(parts[:2])


def enrich_gbif(plants: list[dict], fx: Fetcher, rep: Report) -> None:
    for p in plants:
        name = clean_binomial(p["botanical_name"])
        url = "https://api.gbif.org/v1/species/match?kingdom=Plantae&name=" + urllib.parse.quote(name)
        data = fx.get_json("gbif", p["id"], url)
        if not data or data.get("matchType") == "NONE":
            rep.warn(f"{p['id']}: no GBIF match for '{name}'")
            p["taxonomy"] = None
            continue
        p["taxonomy"] = {
            "gbif_key": data.get("usageKey"),
            "accepted_name": data.get("species") or data.get("canonicalName"),
            "family": data.get("family"),
            "genus": data.get("genus"),
            "status": data.get("status"),
            "match_type": data.get("matchType"),
            "confidence": data.get("confidence"),
        }
        if data.get("matchType") != "EXACT" or (data.get("confidence") or 0) < 90:
            rep.warn(f"{p['id']}: GBIF {data.get('matchType')} match ({data.get('confidence')}) "
                     f"'{name}' -> '{data.get('scientificName')}'")
        if data.get("status") == "SYNONYM":
            rep.notes.append(f"{p['id']}: '{name}' is a synonym of '{data.get('species')}' in GBIF")


COMMERCIAL_OK = {"cc0", "cc-by", "cc-by-sa"}
NONCOMMERCIAL = {"cc-by-nc", "cc-by-nc-sa"}
LICENSE_URLS = {
    "cc0": "https://creativecommons.org/publicdomain/zero/1.0/",
    "cc-by": "https://creativecommons.org/licenses/by/4.0/",
    "cc-by-sa": "https://creativecommons.org/licenses/by-sa/4.0/",
    "cc-by-nc": "https://creativecommons.org/licenses/by-nc/4.0/",
    "cc-by-nc-sa": "https://creativecommons.org/licenses/by-nc-sa/4.0/",
}


INDIA_PLACE_ID = 6681  # iNaturalist place id for India


def observation_photo(fx: Fetcher, pid: str, taxon_id: int) -> dict | None:
    """Fallback when the taxon's curated photos are all NC-licensed: take the most-faved
    research-grade observation photo with a commercial-friendly licence, preferring India."""
    for scope, extra in (("in", f"&place_id={INDIA_PLACE_ID}"), ("global", "")):
        data = fx.get_json(
            "inat_obs", f"{pid}_{scope}",
            f"https://api.inaturalist.org/v1/observations?taxon_id={taxon_id}&quality_grade=research"
            f"&photo_license=cc0,cc-by,cc-by-sa&order_by=votes&per_page=5{extra}",
            delay=1.0,
        )
        for obs in (data or {}).get("results") or []:
            for ph in obs.get("photos") or []:
                if (ph.get("license_code") or "").lower() in COMMERCIAL_OK:
                    url = ph.get("url", "")
                    return {**ph, "medium_url": url.replace("/square.", "/medium.")}
    return None


def enrich_inat(plants: list[dict], fx: Fetcher, rep: Report) -> None:
    for p in plants:
        name = (p.get("taxonomy") or {}).get("accepted_name") or species_key(p["botanical_name"]).capitalize()
        search = fx.get_json(
            "inat_search", p["id"],
            "https://api.inaturalist.org/v1/taxa?rank=species,variety,subspecies,hybrid&per_page=5&q="
            + urllib.parse.quote(name),
            delay=1.0,
        )
        results = (search or {}).get("results") or []
        match = next((t for t in results if t.get("name", "").lower() == name.lower()), None) \
            or (results[0] if results else None)
        if not match:
            rep.warn(f"{p['id']}: no iNaturalist taxon for '{name}'")
            p["photo"], p["links"] = None, {}
            continue
        detail = fx.get_json("inat_taxon", p["id"],
                             f"https://api.inaturalist.org/v1/taxa/{match['id']}", delay=1.0)
        taxon = ((detail or {}).get("results") or [match])[0]
        photos = [tp.get("photo", {}) for tp in taxon.get("taxon_photos", [])]
        if not photos and taxon.get("default_photo"):
            photos = [taxon["default_photo"]]

        def pick(allowed):
            return next((ph for ph in photos if (ph.get("license_code") or "").lower() in allowed), None)

        photo = pick(COMMERCIAL_OK)
        commercial = True
        if not photo:
            photo = observation_photo(fx, p["id"], taxon["id"])
        if not photo:
            photo, commercial = pick(NONCOMMERCIAL), False
        if photo:
            lic = photo["license_code"].lower()
            medium = photo.get("medium_url") or photo.get("url", "").replace("square", "medium")
            p["photo"] = {
                "url": medium,
                "large_url": medium.replace("/medium.", "/large."),
                "thumb_url": medium.replace("/medium.", "/small."),
                "attribution": photo.get("attribution"),
                "license": lic.upper(),
                "license_url": LICENSE_URLS.get(lic),
                "commercial_ok": commercial,
                "source": "iNaturalist",
                "source_url": f"https://www.inaturalist.org/photos/{photo.get('id')}",
            }
            if not commercial:
                rep.notes.append(f"{p['id']}: only a non-commercial photo licence ({lic}) available")
        else:
            p["photo"] = None
            rep.warn(f"{p['id']}: no openly licensed photo on iNaturalist")
        p["links"] = {
            "inaturalist": f"https://www.inaturalist.org/taxa/{taxon['id']}",
            "wikipedia": taxon.get("wikipedia_url"),
        }
        p["inat_observations"] = taxon.get("observations_count")


WIKI_API = "https://en.wikipedia.org/w/api.php"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"


def prefetch_mediawiki(fx: Fetcher, source: str, api: str, params: str, wanted: dict[str, str]) -> None:
    """Fetch many MediaWiki titles in batches of 40 and write one cache file per key, in the same
    shape a single-title query returns, so the per-plant code path stays simple. One request per
    title gets throttled hard by Wikimedia; batching keeps the first run to a few seconds."""
    todo = {k: t for k, t in wanted.items()
            if not (CACHE / source / f"{k}.json").exists() or source in fx.refresh}
    if not todo or fx.offline:
        return
    items = list(todo.items())
    for start in range(0, len(items), 40):
        chunk = items[start:start + 40]
        titles = "|".join(dict.fromkeys(t for _, t in chunk))
        data = None
        for attempt in range(4):
            try:
                time.sleep(0.5)
                r = fx.session.post(api, data={"action": "query", "format": "json", "titles": titles,
                                               "maxlag": "5", **dict(urllib.parse.parse_qsl(params))}, timeout=60)
                if r.status_code == 429 or "maxlag" in r.text[:200]:
                    time.sleep(5 * (attempt + 1))
                    continue
                r.raise_for_status()
                data = r.json()
                fx.calls[source] += 1
                break
            except (requests.RequestException, ValueError) as exc:
                print(f"  ! {source} batch: {exc}", file=sys.stderr)
        if not data:
            continue
        q = data.get("query") or {}
        alias = {n["from"]: n["to"] for n in q.get("normalized", [])}
        alias.update({n["from"]: n["to"] for n in q.get("redirects", [])})
        by_title = {pg.get("title"): pg for pg in (q.get("pages") or {}).values()}
        for key, title in chunk:
            t = title
            for _ in range(3):  # follow normalized -> redirect chains
                t = alias.get(t, t)
            page = by_title.get(t, {})
            path = CACHE / source / f"{key}.json"
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps({"query": {"pages": {"0": page}}}, ensure_ascii=False), encoding="utf-8")


def _commons_license_ok(short: str) -> tuple[bool, bool]:
    """(open licence?, commercial use ok?) from a Commons LicenseShortName."""
    s = (short or "").lower()
    if "nc" in s.replace("-", " ").split() or "noncommercial" in s:
        return True, False
    return any(k in s for k in ("cc by", "cc-by", "cc0", "public domain", "pd")), True


def _strip_html(s: str) -> str:
    return " ".join(re.sub(r"<[^>]+>", "", s or "").split())


# Old botanical plates and drawings look out of place next to photos.
ILLUSTRATION = re.compile(
    r"k(ö|oe|o)hler|illustration|drawing|plate|tafel|blackwell|thom[eé]|woodvill|woodwill|curtis|sowerby|"
    r"botanical|engraving|lithograph|(?<!\d)1[6-8]\d\d(?!\d)|\.svg$", re.I)


def _commons_photo(fx: Fetcher, key: str, filename: str) -> dict | None:
    """Commons file -> photo record (sized thumbnails + licence + attribution), cached per plant."""
    data = fx.get_json(
        "commons", key,
        COMMONS_API + "?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1280&titles="
        + urllib.parse.quote("File:" + filename),
        delay=0.2,
    )
    pages = ((data or {}).get("query") or {}).get("pages") or {}
    info = next(iter(pages.values()), {}).get("imageinfo", [None])[0] if pages else None
    if not info or not info.get("thumburl"):
        return None
    meta = info.get("extmetadata") or {}
    lic = (meta.get("LicenseShortName") or {}).get("value", "")
    is_open, commercial = _commons_license_ok(lic)
    if not is_open:
        return None
    large = info["thumburl"].split("?")[0]
    # Wikimedia's standard thumbnail steps (250/500/1280) are pre-cached on its CDN.
    sized = lambda w: re.sub(r"/\d+px-", f"/{w}px-", large) if "/thumb/" in large else large
    return {
        "url": sized(500),
        "large_url": large,
        "thumb_url": sized(250),
        "attribution": f"{_strip_html((meta.get('Artist') or {}).get('value', '')) or 'Wikimedia Commons'} ({lic})",
        "license": lic,
        "license_url": (meta.get("LicenseUrl") or {}).get("value"),
        "commercial_ok": commercial,
        "source": "Wikimedia Commons",
        "source_url": info.get("descriptionurl"),
    }


def load_photo_overrides() -> tuple[dict[str, str], dict[str, str]]:
    """sources/photo_overrides.csv -> ({id: commons_file}, {id: wikipedia article title}).
    Use wiki_title to point at the crop/houseplant article (e.g. "Carrot" instead of the wild
    "Daucus carota"), or commons_file to pin an exact image."""
    path = SOURCES / "photo_overrides.csv"
    if not path.exists():
        return {}, {}
    files, titles = {}, {}
    with open(path, encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            pid = (r.get("id") or "").strip()
            if (r.get("commons_file") or "").strip():
                files[pid] = r["commons_file"].strip()
            elif (r.get("wiki_title") or "").strip():
                titles[pid] = r["wiki_title"].strip()
    return files, titles


def enrich_wikimedia(plants: list[dict], fx: Fetcher, rep: Report) -> None:
    """Prefer the Wikipedia lead image (usually the 'how people know it' photo, e.g. a potted
    snake plant rather than its flowers). Manual overrides in sources/photo_overrides.csv win."""
    overrides, title_overrides = load_photo_overrides()
    titles = {}
    for p in plants:
        title = (p.get("links") or {}).get("wikipedia")
        title = urllib.parse.unquote(title.rsplit("/", 1)[-1]) if title else (p.get("taxonomy") or {}).get("accepted_name")
        title = title_overrides.get(p["id"], title)
        if title and p["id"] not in overrides:
            titles[p["id"]] = title.replace("_", " ")
    prefetch_mediawiki(fx, "wiki_pageimage", WIKI_API, "redirects=1&prop=pageimages&piprop=name", titles)

    def page_image(pid: str) -> str | None:
        path = CACHE / "wiki_pageimage" / f"{pid}.json"
        if not path.exists():
            return None
        pages = (json.loads(path.read_text(encoding="utf-8")).get("query") or {}).get("pages") or {}
        return next(iter(pages.values()), {}).get("pageimage") if pages else None

    files = {}
    for p in plants:
        key = p["id"] + "_override" if p["id"] in overrides else p["id"]
        name = overrides.get(p["id"]) or page_image(p["id"])
        if name:
            files[key] = "File:" + name.replace("_", " ")
    prefetch_mediawiki(fx, "commons", COMMONS_API, "prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1280", files)

    used = 0
    for p in plants:
        filename = overrides.get(p["id"])
        if not filename:
            title = titles.get(p["id"])
            if not title:
                continue
            data = fx.get_json(
                "wiki_pageimage", p["id"],
                WIKI_API + "?action=query&format=json&redirects=1&prop=pageimages&piprop=name&titles="
                + urllib.parse.quote(title),
                delay=0.2,
            )
            pages = ((data or {}).get("query") or {}).get("pages") or {}
            filename = next(iter(pages.values()), {}).get("pageimage") if pages else None
        if not filename:
            continue
        if p["id"] not in overrides and ILLUSTRATION.search(filename):
            rep.notes.append(f"{p['id']}: skipped Wikipedia illustration '{filename}' (kept iNaturalist photo)")
            continue
        photo = _commons_photo(fx, p["id"] + ("_override" if p["id"] in overrides else ""), filename)
        if photo:
            p["photo"] = photo
            used += 1
        elif p["id"] in overrides:
            rep.warn(f"{p['id']}: photo override '{filename}' not usable (missing or not openly licensed)")
    rep.notes.append(f"Wikimedia Commons photos used for {used}/{len(plants)} plants "
                     f"({len(overrides)} pinned files, {len(title_overrides)} article overrides)")


def load_opdb(fx: Fetcher) -> dict[str, list[dict]] | None:
    path = CACHE / "openplantdb" / "plants.csv"
    if not path.exists() or "opdb" in fx.refresh:
        if fx.offline:
            return None
        print("  downloading OpenPlantDB (~33 MB)...")
        r = fx.session.get(OPDB_URL, timeout=300)
        r.raise_for_status()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(r.content)
        fx.calls["opdb"] += 1
    index: dict[str, list[dict]] = defaultdict(list)
    with open(path, encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            if row.get("scientific_name"):
                index[species_key(row["scientific_name"])].append(row)
    return index


def _median(rows: list[dict], field: str, scale: float = 1.0):
    vals = []
    for r in rows:
        try:
            vals.append(float(r[field]) * scale)
        except (TypeError, ValueError, KeyError):
            pass
    return round(statistics.median(vals)) if vals else None


def enrich_opdb(plants: list[dict], fx: Fetcher, rep: Report) -> None:
    index = load_opdb(fx)
    if index is None:
        rep.warn("OpenPlantDB not cached and --offline set; skipping trait enrichment")
        return
    matched = 0
    for p in plants:
        rows = index.get(species_key(p["botanical_name"]))
        if not rows:
            p["traits_openplantdb"] = None
            continue
        matched += 1
        traits = {
            "cultivars_known": len(rows),
            "germination_days": _median(rows, "germ_days_max"),
            "maturity_days": _median(rows, "maturity_days_min"),
            "spacing_cm": _median(rows, "spacing_in_min", 2.54),
            "height_cm": _median(rows, "height_in_max", 2.54),
            "sun": Counter(r["sun"] for r in rows if r.get("sun")).most_common(1)[0][0]
            if any(r.get("sun") for r in rows) else None,
            "water": Counter(r["water"] for r in rows if r.get("water")).most_common(1)[0][0]
            if any(r.get("water") for r in rows) else None,
        }
        p["traits_openplantdb"] = traits
        # Cross-check: our harvest days vs OpenPlantDB median maturity (warn on large disagreement).
        # Skip sprout crops (microgreens, wheatgrass): OpenPlantDB times the full-grown crop.
        if p["days_to_harvest"] >= 20 and traits["maturity_days"] and p["category"] == "vegetable":
            ratio = p["days_to_harvest"] / traits["maturity_days"]
            if ratio < 0.4 or ratio > 2.5:
                rep.warn(f"{p['id']}: days_to_harvest {p['days_to_harvest']} vs OpenPlantDB median "
                         f"{traits['maturity_days']} (cultivars={len(rows)})")
    rep.notes.append(f"OpenPlantDB matched {matched}/{len(plants)} species")


def enrich_perenual(plants: list[dict], fx: Fetcher, rep: Report) -> None:
    key = os.environ.get("PERENUAL_KEY")
    if not key:
        rep.notes.append("Perenual skipped (set PERENUAL_KEY to enable; free tier = 100 req/day)")
        return
    for p in plants:
        name = species_key(p["botanical_name"])
        data = fx.get_json("perenual", p["id"],
                           f"https://perenual.com/api/v2/species-list?key={key}&q={urllib.parse.quote(name)}",
                           delay=0.5)
        hit = ((data or {}).get("data") or [None])[0]
        if hit:
            p["perenual"] = {"id": hit.get("id"), "watering": hit.get("watering"),
                             "sunlight": hit.get("sunlight"), "cycle": hit.get("cycle")}


# ---------------------------------------------------------------------------
# Phonetic search keys (so "jaswand" finds जास्वंद and "pudina" finds पुदीना)
# ---------------------------------------------------------------------------
DEVA_CONSONANTS = {
    "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "n", "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "n",
    "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n", "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
    "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m", "य": "y", "र": "r", "ल": "l", "ळ": "l", "व": "v",
    "श": "sh", "ष": "sh", "स": "s", "ह": "h", "क़": "k", "ख़": "kh", "ग़": "g", "ज़": "z", "फ़": "f", "ड़": "d", "ढ़": "dh",
}
DEVA_VOWELS = {"अ": "a", "आ": "aa", "इ": "i", "ई": "ee", "उ": "u", "ऊ": "oo", "ऋ": "ri", "ए": "e", "ऐ": "ai",
               "ओ": "o", "औ": "au", "ऑ": "o", "ॲ": "a"}
DEVA_MATRAS = {"ा": "aa", "ि": "i", "ी": "ee", "ु": "u", "ू": "oo", "ृ": "ri", "े": "e", "ै": "ai", "ो": "o",
               "ौ": "au", "ॉ": "o", "ॅ": "e"}
DEVA_SIGNS = {"ं": "n", "ँ": "n", "ः": "h"}
VIRAMA, NUKTA = "्", "़"


def deva_fold(text: str) -> str:
    """Spelling-tolerant Devanagari: drop nukta and joiners, chandrabindu -> anusvara (web app mirrors this)."""
    s = unicodedata.normalize("NFD", text)
    s = s.replace(NUKTA, "").replace("‍", "").replace("‌", "").replace("ँ", "ं")
    return unicodedata.normalize("NFC", s)


def transliterate(text: str) -> str:
    """Rough Devanagari -> Latin, good enough for phonetic matching (not for display)."""
    text = unicodedata.normalize("NFD", text)
    out, i = [], 0
    while i < len(text):
        ch = text[i]
        if i + 1 < len(text) and text[i + 1] == NUKTA and ch + NUKTA in DEVA_CONSONANTS:
            ch, i = ch + NUKTA, i + 1
        if ch in DEVA_CONSONANTS:
            out.append(DEVA_CONSONANTS[ch])
            nxt = text[i + 1] if i + 1 < len(text) else ""
            if nxt not in DEVA_MATRAS and nxt != VIRAMA:
                out.append("a")
        elif ch in DEVA_VOWELS:
            out.append(DEVA_VOWELS[ch])
        elif ch in DEVA_MATRAS:
            out.append(DEVA_MATRAS[ch])
        elif ch in DEVA_SIGNS:
            # Anusvara before p/ph/b/bh/m is pronounced "m" (कोथिंबीर -> kothimbir).
            nxt = text[i + 1] if i + 1 < len(text) else ""
            out.append("m" if ch == "ं" and nxt in "पफबभम" else DEVA_SIGNS[ch])
        elif ch in (VIRAMA, NUKTA, "‍", "‌"):
            pass
        else:
            out.append(ch)
        i += 1
    return "".join(out)


def fold_vowels(text: str) -> str:
    """Long vowels written short, as most people type them ("aamba" -> "amba", "pudeena" -> "pudina")."""
    s = text.lower()
    for a, b in (("aa", "a"), ("ee", "i"), ("ii", "i"), ("oo", "u"), ("uu", "u")):
        s = s.replace(a, b)
    return s


def roman_simple(text: str) -> str:
    """How people type an Indian name in English letters: तुळस -> "tulas", जुई -> "jui", आंबा -> "amba".
    Drops the silent final 'a' of each word and shortens long vowels."""
    out = []
    for word in unicodedata.normalize("NFD", text).split():
        t = transliterate(word)
        last = word.rstrip(NUKTA)[-1:]
        if last in DEVA_CONSONANTS and t.endswith("a"):
            t = t[:-1]  # the inherent vowel is silent at the end of a word
        out.append(fold_vowels(t))
    return " ".join(out)


def skeleton(text: str) -> str:
    """Consonant skeleton used on both sides of the search (the web app has the same function)."""
    s = text.lower()
    for a, b in (("chh", "c"), ("ch", "c"), ("sh", "s"), ("ph", "f"), ("w", "v"), ("z", "j"), ("q", "k"), ("x", "ks")):
        s = s.replace(a, b)
    s = re.sub(r"[^a-z]", "", s)
    # Merge doubled letters before dropping vowels: "patta" = "pata", but "dudhi" keeps both d's.
    s = re.sub(r"(.)\1+", r"\1", s)
    return re.sub(r"[aeiouh]", "", s)


# ---------------------------------------------------------------------------
# Derived fields
# ---------------------------------------------------------------------------
WATER_FACTOR = {"low": 0.08, "medium": 0.18, "high": 0.3}  # litres per litre of soil per week (hot season)


def derive(p: dict) -> None:
    sun = p["sun_min_hrs"]
    p["sun_class"] = "full_sun" if sun >= 6 else "partial_sun" if sun >= 3 else "shade"
    pot = p["min_pot_l"]
    p["pot_size_class"] = "small" if pot <= 4 else "medium" if pot <= 15 else "large" if pot <= 40 else "xl"
    p["water_l_per_week"] = round(max(0.2, pot * WATER_FACTOR[p["water"]]), 1)

    # Beginner score 0-100: easy care, forgiving watering, sold everywhere, fast feedback.
    score = (5 - p["maintenance"]) * 15
    score += {"high": 20, "medium": 10, "low": 0}[p["drought_tolerance"]]
    score += {"everywhere": 15, "common": 8, "specialty": 0}[p["availability"]]
    score += {"fast": 5, "medium": 3, "slow": 0}[p["growth_rate"]]
    p["beginner_score"] = min(100, score)
    p["beginner_friendly"] = p["beginner_score"] >= 70

    p["edible"] = "food" in p["benefits"] or "herb" in p["benefits"]
    p["space_fit"] = sorted(set(p["zones"]))
    p["slug"] = p["id"].replace("_", "-")

    words = {p["common_name"], p["hindi_name"], p["marathi_name"], p["botanical_name"], p["id"].replace("_", " ")}
    words.update(p["other_names"])
    if p.get("taxonomy"):
        words.add(p["taxonomy"].get("family") or "")
    # Pull out names in brackets, e.g. "Okra (Bhindi)" -> "Bhindi"
    words.update(re.findall(r"\(([^)]+)\)", p["common_name"]))
    words.discard("")
    deva = [w for w in words if DEVANAGARI.search(w)]
    latin = [w for w in words if not DEVANAGARI.search(w)]
    # Exact-match terms: every name, its spelling-tolerant Devanagari, and how it is typed in English
    # letters (full transliteration plus the simple form people actually type: "tulas", "jui", "amba").
    romanised = {transliterate(n) for n in deva} | {roman_simple(n) for n in deva}
    p["search_terms"] = sorted(
        {w.lower() for w in words} | {deva_fold(w) for w in deva} | romanised | {fold_vowels(w) for w in latin}
    )
    # Phonetic keys: consonant skeleton of each word, and of the whole name run together ("ganesh vel" = "ganeshvel").
    keys = set()
    for w in words | romanised:
        t = transliterate(w)
        for part in re.split(r"[\s()·,/-]+", t) + [re.sub(r"[\s()·,/-]+", "", t)]:
            k = skeleton(part)
            if len(k) >= 2:
                keys.add(k)
    p["search_keys"] = sorted(keys)


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------
FIELD_ORDER = [
    "id", "slug", "common_name", "hindi_name", "marathi_name", "botanical_name", "category",
    "availability", "popularity", "price_inr_min", "price_inr_max", "why_popular",
    "sun_min_hrs", "sun_max_hrs", "sun_class", "water", "water_l_per_week", "drought_tolerance",
    "temp_min_c", "temp_max_c", "humidity", "min_pot_l", "pot_size_class", "pot_depth_cm",
    "height_cm", "spread_cm", "habit", "zones", "space_fit", "indoor_ok", "benefits", "edible",
    "pollinator", "maintenance", "beginner_score", "beginner_friendly", "growth_rate", "lifecycle",
    "propagation", "plant_months", "peak_months", "days_to_harvest", "pet_safe", "care_tip", "other_names",
    "price_basis", "price_checks",
    "taxonomy", "traits_openplantdb", "photo", "links", "inat_observations", "perenual", "search_terms", "search_keys",
]


# Slim per-plant record shipped to the browser for the library, search and cards.
INDEX_FIELDS = [
    "id", "slug", "common_name", "hindi_name", "marathi_name", "botanical_name", "category", "availability",
    "popularity", "price_inr_min", "price_inr_max", "sun_class", "water", "zones", "benefits", "edible",
    "pollinator", "beginner_score", "beginner_friendly", "pet_safe", "plant_months", "price_basis", "search_terms", "search_keys",
]


def index_record(p: dict) -> dict:
    rec = {k: p[k] for k in INDEX_FIELDS}
    rec["photo"] = {"url": p["photo"]["url"], "thumb_url": p["photo"]["thumb_url"]} if p.get("photo") else None
    return rec


# Fields the garden planner engine needs (loaded only on /plan and /garden).
ENGINE_FIELDS = [
    "id", "slug", "common_name", "hindi_name", "marathi_name", "botanical_name", "category", "availability",
    "popularity", "price_inr_min", "price_inr_max", "sun_min_hrs", "sun_max_hrs", "water", "water_l_per_week",
    "drought_tolerance", "temp_min_c", "temp_max_c", "humidity", "min_pot_l", "pot_depth_cm", "height_cm",
    "spread_cm", "habit", "zones", "benefits", "edible", "pollinator", "maintenance", "beginner_score",
    "growth_rate", "lifecycle", "propagation", "plant_months", "peak_months", "days_to_harvest", "pet_safe",
    "care_tip", "search_terms", "search_keys",
]


def engine_record(p: dict) -> dict:
    rec = {k: p[k] for k in ENGINE_FIELDS}
    rec["photo"] = {"url": p["photo"]["url"], "thumb_url": p["photo"]["thumb_url"]} if p.get("photo") else None
    return rec


def _percentile(vals: list[float], q: float) -> float | None:
    if not vals:
        return None
    vals = sorted(vals)
    k = (len(vals) - 1) * q
    lo, hi = int(k), min(int(k) + 1, len(vals) - 1)
    return vals[lo] + (vals[hi] - vals[lo]) * (k - lo)


def build_cities(fx: "Fetcher", rep: "Report") -> list[dict]:
    """Monthly climate normals per city from 5 years (2020-2024) of Open-Meteo ERA5 daily history."""
    with open(SOURCES / "cities.csv", encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    cities = []
    for r in rows:
        lat, lon = float(r["lat"]), float(r["lon"])
        url = ("https://archive-api.open-meteo.com/v1/archive"
               f"?latitude={lat}&longitude={lon}&start_date=2020-01-01&end_date=2024-12-31"
               "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,relative_humidity_2m_mean,"
               "wind_speed_10m_max&timezone=Asia%2FKolkata")
        data = fx.get_json("climate", r["id"], url, delay=0.4)
        d = (data or {}).get("daily")
        if not d:
            rep.warn(f"city {r['id']}: no climate data")
            continue
        by_month: dict[int, dict[str, list]] = defaultdict(lambda: defaultdict(list))
        rain_by_year_month: dict[tuple, float] = defaultdict(float)
        for i, day in enumerate(d["time"]):
            y, m = int(day[:4]), int(day[5:7])
            for key, src in (("tmax", "temperature_2m_max"), ("tmin", "temperature_2m_min"),
                             ("rh", "relative_humidity_2m_mean"), ("wind", "wind_speed_10m_max"),
                             ("rain", "precipitation_sum")):
                v = d[src][i]
                if v is not None:
                    by_month[m][key].append(v)
            if d["precipitation_sum"][i] is not None:
                rain_by_year_month[(y, m)] += d["precipitation_sum"][i]
        years = len({k[0] for k in rain_by_year_month}) or 1
        months = []
        for m in range(1, 13):
            b = by_month[m]
            mean = lambda xs: round(sum(xs) / len(xs), 1) if xs else None
            months.append({
                "m": m,
                "tmax": mean(b["tmax"]),
                "tmin": mean(b["tmin"]),
                "tmax_hi": round(_percentile(b["tmax"], 0.95), 1),
                "tmin_lo": round(_percentile(b["tmin"], 0.05), 1),
                "rh": mean(b["rh"]),
                "rain_mm": round(sum(v for (y, mm), v in rain_by_year_month.items() if mm == m) / years),
                "rainy_days": round(sum(1 for v in b["rain"] if v >= 2.5) / years, 1),
                "wind_max": mean(b["wind"]),
            })
        cities.append({
            "id": r["id"], "name": r["name"], "state": r["state"], "lat": lat, "lon": lon,
            "elevation_m": data.get("elevation"),
            "hottest": max(x["tmax_hi"] for x in months),
            "coldest": min(x["tmin_lo"] for x in months),
            "months": months,
        })
    rep.notes.append(f"Climate normals (Open-Meteo ERA5 2020-2024) for {len(cities)} cities")
    return cities


def link_insights(insights: list[dict], plants: list[dict]) -> None:
    """Attach {slug, name} for linked plants so the browser never needs the full plant list for insights."""
    by_id = {p["id"]: p for p in plants}
    for i in insights:
        i["plant_links"] = [{"slug": by_id[pid]["slug"], "name": by_id[pid]["common_name"].split(" (")[0]}
                            for pid in i["plant_ids"]]


def stats_for(plants: list[dict], insights: list[dict]) -> dict:
    return {
        "generated": date.today().isoformat(),
        "plants": len(plants),
        "insights": len(insights),
        "by_category": dict(Counter(p["category"] for p in plants).most_common()),
        "by_availability": dict(Counter(p["availability"] for p in plants).most_common()),
        "by_popularity": {str(k): v for k, v in sorted(Counter(p["popularity"] for p in plants).items(), reverse=True)},
        "beginner_friendly": sum(p["beginner_friendly"] for p in plants),
        "edible": sum(p["edible"] for p in plants),
        "with_photo": sum(1 for p in plants if p.get("photo")),
        "with_gbif": sum(1 for p in plants if p.get("taxonomy")),
        "with_openplantdb": sum(1 for p in plants if p.get("traits_openplantdb")),
        "families": len({(p.get("taxonomy") or {}).get("family") for p in plants} - {None}),
        "insights_by_category": dict(Counter(i["category"] for i in insights).most_common()),
    }


def write_report(rep: Report, stats: dict, calls: Counter) -> None:
    lines = [f"# Validation report ({stats['generated']})", "",
             f"- Plants: **{stats['plants']}** · Insights: **{stats['insights']}**",
             f"- GBIF matched: {stats['with_gbif']} · Photos: {stats['with_photo']} · "
             f"OpenPlantDB traits: {stats['with_openplantdb']} · Families: {stats['families']}",
             f"- Network calls this run: {dict(calls) or 'none (all cached)'}", "",
             f"## Errors ({len(rep.errors)})", *([f"- {e}" for e in rep.errors] or ["- none"]), "",
             f"## Warnings ({len(rep.warnings)})", *([f"- {w}" for w in rep.warnings] or ["- none"]), "",
             f"## Notes ({len(rep.notes)})", *([f"- {n}" for n in rep.notes] or ["- none"]), ""]
    (OUTPUT / "validation_report.md").write_text("\n".join(lines), encoding="utf-8")


def attach_price_checks(plants: list[dict], rep: Report) -> None:
    """sources/price_checks.csv: real prices seen in stores, used to sanity-check our local-nursery ranges.
    Our range is local retail (small plant in a grow bag), so it should sit above wholesale and not
    above what online stores charge with a pot and delivery."""
    by_id = {p["id"]: p for p in plants}
    for p in plants:
        p["price_checks"] = []
        # Seed-grown annual crops and bedding flowers are bought as seedlings (or a seed packet).
        seed_annual = p["propagation"][:1] == ["seed"] and p["lifecycle"] == "annual"
        p["price_basis"] = "seedling" if seed_annual and p["category"] in {"vegetable", "herb", "flowering"} else "plant"
    path = SOURCES / "price_checks.csv"
    if not path.exists():
        return
    with open(path, encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            p = by_id.get(row["id"])
            if not p:
                rep.error(f"price_checks: unknown plant id '{row['id']}'")
                continue
            price = int(row["price_inr"])
            p["price_checks"].append({"channel": row["channel"], "price_inr": price, "source": row["source"], "checked": row["checked"]})
            if row["channel"] == "online" and p["price_inr_max"] > price * 1.1:
                rep.warn(f"{p['id']}: local max Rs {p['price_inr_max']} is above the online price Rs {price}")
            if row["channel"] in {"wholesale", "local"} and p["price_inr_min"] < price * 0.4:
                rep.warn(f"{p['id']}: local min Rs {p['price_inr_min']} is far below the {row['channel']} price Rs {price}")
    checked = sum(1 for p in plants if p["price_checks"])
    rep.notes.append(f"Prices checked against real listings for {checked} plants (sources/price_checks.csv)")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--offline", action="store_true", help="use cached data only")
    ap.add_argument("--refresh", action="append", default=[], help="re-fetch a source")
    ap.add_argument("--skip-enrich", action="store_true", help="validate + export without enrichment")
    args = ap.parse_args()

    rep = Report()
    print("1/5 load + validate")
    plants = load_plants(rep)
    insights = load_insights(rep, {p["id"] for p in plants})
    attach_price_checks(plants, rep)
    if rep.errors:
        print(f"\n{len(rep.errors)} validation error(s):")
        for e in rep.errors:
            print("  -", e)
        return 1

    fx = Fetcher(args.offline, set(args.refresh))
    for p in plants:
        p.setdefault("taxonomy", None)
        p.setdefault("photo", None)
        p.setdefault("links", {})
        p.setdefault("traits_openplantdb", None)
        p.setdefault("perenual", None)
        p.setdefault("inat_observations", None)
    if not args.skip_enrich:
        print("2/5 enrich: GBIF taxonomy")
        enrich_gbif(plants, fx, rep)
        print("3/5 enrich: iNaturalist photos (rate-limited, ~1 req/s on first run)")
        enrich_inat(plants, fx, rep)
        print("   + Wikimedia Commons lead images (preferred over iNaturalist when openly licensed)")
        enrich_wikimedia(plants, fx, rep)
        print("4/5 enrich: OpenPlantDB traits + Perenual (optional)")
        enrich_opdb(plants, fx, rep)
        enrich_perenual(plants, fx, rep)

    print("   + climate normals for Indian cities (Open-Meteo archive)")
    cities = build_cities(fx, rep)

    print("5/5 derive + export")
    for p in plants:
        derive(p)
    plants.sort(key=lambda p: (-p["popularity"], p["common_name"]))
    plants = [{k: p.get(k) for k in FIELD_ORDER} for p in plants]

    OUTPUT.mkdir(exist_ok=True)
    link_insights(insights, plants)
    stats = stats_for(plants, insights)
    index = [index_record(p) for p in plants]
    engine = [engine_record(p) for p in plants]
    for name, data in (("plants.json", plants), ("plants_index.json", index), ("plants_engine.json", engine),
                       ("insights.json", insights), ("stats.json", stats), ("cities.json", cities)):
        (OUTPUT / name).write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    write_report(rep, stats, fx.calls)

    if WEB_DATA.parent.exists():
        WEB_DATA.mkdir(parents=True, exist_ok=True)
        for name in ("plants.json", "plants_index.json", "plants_engine.json", "insights.json", "stats.json",
                     "cities.json"):
            shutil.copy(OUTPUT / name, WEB_DATA / name)
        print(f"  copied to {WEB_DATA.relative_to(ROOT.parent)}")

    print(f"\nDone: {stats['plants']} plants, {stats['insights']} insights, "
          f"{stats['with_photo']} photos, {len(rep.warnings)} warnings -> output/validation_report.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
