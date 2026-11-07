# GreenHarmony AI: Data Pipeline

The data pipeline builds the validated, enriched plant dataset, the monthly climate normals for 70 Indian cities, and the contextual insights library used by the GreenHarmony web application.

```
sources/curated_plants.csv (500 species) ─┐
sources/insights.csv (187 tips) ──────────┤
sources/cities.csv (70 Indian cities) ────┤   scripts/build.py        output/plants.json          (full dataset)
GBIF Species Match API ───────────────────┤ ──────────────────────▶   output/plants_index.json    (slim browser index)
iNaturalist & Wikimedia Commons ──────────┤   validate → enrich       output/plants_engine.json   (planner subset)
OpenPlantDB (CC0 traits) ─────────────────┤   → derive → export       output/cities.json          (ERA5 monthly normals)
(Perenual API - optional) ────────────────┘                           output/insights.json        (contextual tips)
                                                                      output/stats.json
                                                                      output/validation_report.md
                                                                       └─ copied to ../web/src/data/
```

---

## Key Metrics & Dataset Health

- **Plants**: 500 Indian species across 8 categories and 108 botanical families
- **Taxonomy Validation**: 100% matched against GBIF (Global Biodiversity Information Facility)
- **Photos**: 500/500 openly licensed (CC0, CC-BY, CC-BY-SA, Public Domain), verified for commercial use
- **Traits**: 450 species cross-checked against OpenPlantDB (harvest days, spacing, maturity)
- **Indian Cities**: 70 cities with 5 years (2020–2024) of daily ERA5 historical climate normals from Open-Meteo
- **Insights**: 187 actionable gardening tips mapped to seasonal months and UI contexts
- **Bilingual & Phonetic Search Index**: Precomputed Devanagari folding and consonant skeletons for English, Hindi, and Marathi

---

## Prerequisites

- **Python 3.10+**
- Python packages: `requests`

```bash
pip install requests
```

---

## Running the Pipeline

From the `data-pipeline/` directory:

```bash
# Full build: validates sources, enriches from APIs, derives indexes, and copies to web/src/data/
python scripts/build.py

# Offline build: relies strictly on local cache in cache/ (zero network calls)
python scripts/build.py --offline

# Skip enrichment: validates curated sources and re-exports without network lookups
python scripts/build.py --skip-enrich

# Refresh a specific cache source (e.g. gbif, inat, inat_taxon, opdb, perenual)
python scripts/build.py --refresh inat_taxon
```

### Build Performance & Caching
- **First Full Run**: Downloads OpenPlantDB (~33 MB) and queries GBIF / iNaturalist / Wikimedia Commons at 1 request/second to respect rate limits (takes ~8–10 minutes).
- **Subsequent Runs**: Cached under `data-pipeline/cache/`. Incremental rebuild takes **~2 seconds**.
- **Optional Perenual Enrichment**: Set the environment variable `PERENUAL_KEY` to activate supplementary care guide enrichment.

---

## File Structure

```
data-pipeline/
├── cache/                  # Disk cache for external API responses and datasets
├── output/                 # Generated JSON files and validation report
│   ├── cities.json         # 70 Indian cities with monthly climate normals
│   ├── insights.json       # 187 contextual gardening tips
│   ├── plants.json         # Full 500-plant database
│   ├── plants_engine.json  # Compact schema for recommendation engine
│   ├── plants_index.json   # Slim index for client-side search & browsing
│   ├── stats.json          # Aggregate dataset metrics
│   └── validation_report.md # Automated data quality & lint report
├── scripts/
│   └── build.py            # Main pipeline script (validation, enrichment, export)
├── sources/
│   ├── cities.csv          # 70 Indian cities with coordinates
│   ├── curated_plants.csv  # Core hand-curated dataset (500 species)
│   ├── insights.csv        # Hand-curated tips and seasonal guides
│   ├── photo_overrides.csv # Pinned Wikimedia/Wikipedia image titles
│   └── price_checks.csv    # Real Indian nursery price benchmarks
├── DATA_SOURCES.md         # Comprehensive sourcing strategy, schema & rules
└── README.md               # Pipeline documentation
```

See [DATA_SOURCES.md](DATA_SOURCES.md) for the in-depth data sourcing methodology, schema definitions, and strict quality verification rules.
