# Plant data: where it comes from and why

GreenHarmony is built for **Indian users**. Global plant APIs are US/EU-centric: they use USDA hardiness zones, have no Hindi or Marathi names, follow North-American sowing calendars, and don't know what a Pune nursery actually sells. So the dataset is layered. We own an **India-first curated core**, and open data sources **validate and enrich** it.

## 1. Layers

| Layer | Source | What we take | Access / licence | Status |
|---|---|---|---|---|
| **L0 Core** | `sources/curated_plants.csv` (hand-curated by Team Cultivate) | Indian names (Hindi, Marathi), market availability, popularity + reason, ₹ price band, sun hours, water, drought tolerance, temperature range, humidity, pot size and depth, height and spread, habit, balcony zones, benefits, pollinator value, maintenance, Indian planting and peak months, days to harvest, pet safety, care tip | Our own work | ✅ 400 species (Hindi name for all, Marathi for 253) |
| **L1 Taxonomy** | [GBIF Species Match API](https://www.gbif.org/developer/species) | Accepted name, family, genus, GBIF key, match confidence | Open API, no key | ✅ 400/400 matched |
| **L2 Traits** | [OpenPlantDB](https://github.com/cwfrazier1/openplantdb) | Median germination days, days to maturity, spacing, height and number of known cultivars. Used to cross-check our harvest days | CC0 (26,515 cultivar rows) | ✅ 368/400 matched |
| **L3 Photos** | [Wikimedia Commons](https://commons.wikimedia.org) via the Wikipedia lead image, falling back to [iNaturalist](https://api.inaturalist.org/v1/docs/) | One representative photo per plant (how people know it, e.g. a potted snake plant rather than its flowers), with attribution and licence | Only CC0, CC-BY, CC-BY-SA or public domain. Old botanical drawings are skipped automatically. `sources/photo_overrides.csv` points a plant at a better Wikipedia article (`wiki_title`) or pins an exact Commons file (`commons_file`), hand-picked from a visual review | ✅ 400/400 photos (377 Wikimedia, 23 iNaturalist), all licensed for commercial use (25 pinned, 21 article overrides) |
| L4 Optional | [Perenual API](https://perenual.com/docs/api) | Care-guide extras (watering, sunlight, cycle) | Free key: 100 requests/day, species 1–3000 | ⏸ runs when `PERENUAL_KEY` is set |
| Future | Kew POWO, India Biodiversity Portal, iNaturalist India observations, TRY/BIEN | Native ranges, local biodiversity and pollinator records, functional traits | Mixed | Phase 3+ |

## 2. Which plants, and in what order

Plants are chosen on **market availability first**, then **popularity**. A recommendation is useless if the user can't buy the plant this weekend.

`availability`:
- `everywhere`: sold in almost every local nursery and on Ugaoo or Nurserylive (78 plants)
- `common`: most city nurseries and online stores
- `specialty`: hobby or collector plants that are harder to find

`popularity` (1–5) combines three signals:
1. **Indian nursery bestseller lists.** These include Nurserylive's top plants by review count (Mogra: about 2k reviews, rated 4.7; Rosemary: about 1.6k, rated 4.8; Parijat: about 1.7k; Raat ki Rani: about 1.4k; Money plant; Damask rose), Saharanpur Nursery's top-25 high-demand list, and the balcony collections on Nurserylive and Ugaoo.
2. **Search interest.** Snake plant and money plant are the most-searched houseplants (about 267k and 210k global monthly searches).
3. **Cultural use in Indian homes.** This covers pooja, festivals, the kitchen and Ayurveda.

### Why the top plants are popular

| Plant | Why Indians buy it |
|---|---|
| **Tulsi** | Sacred in almost every Hindu home and the #1 medicinal plant sold in India. Used daily in pooja and kadha |
| **Money plant** | Very hard to kill, grows in a bottle of water, and a Vastu "prosperity" plant |
| **Snake plant** | The most-searched houseplant. Survives AC rooms, dim corners and neglect |
| **Mogra / jasmine** | The best-loved fragrance for gajra and pooja, and a top seller by reviews online |
| **Hibiscus (jaswand)** | Offered to Ganesha and Kali, and blooms year-round in Indian heat |
| **Rose (desi gulab)** | Used for pooja, gulkand and rose water. Fragrant desi varieties sell the most |
| **Marigold (genda)** | Used for every festival toran, and doubles as a natural pest repellent |
| **Curry leaf** | Essential for South and West Indian tadka |
| **Aloe vera** | Used for skin, hair and burns, with near-zero care |
| **Bougainvillea** | The most heat-proof colour in India. Blooms when neglected |
| **Kitchen crops** (tomato, chilli, coriander, mint, methi, palak) | Daily-use items with fast harvests, and the core of the kitchen-garden trend |
| **Lemon, mango (Amrapali), guava** | Top fruit plants on terraces. Dwarf grafted varieties fruit in drums |
| **Areca palm, lucky bamboo, jade** | Living-room and gift plants with Vastu and Feng Shui appeal |

## 3. Schema (core sheet)

| Column | Type | Notes |
|---|---|---|
| `id` | snake_case | Unique and stable. Used in URLs as `slug` |
| `common_name`, `hindi_name`, `marathi_name` | text | The Indian names must be in Devanagari (the build validates this) |
| `botanical_name` | text | Checked against GBIF |
| `category` | enum | herb, vegetable, fruit, flowering, foliage, succulent, climber, medicinal |
| `availability` | enum | everywhere, common, specialty |
| `popularity` | 1–5 | 5 = national bestseller |
| `price_inr_min/max` | ₹ | Typical small nursery plant |
| `why_popular` | text | Shown on the plant page |
| `sun_min_hrs`, `sun_max_hrs` | 0–8 | Hours of direct sun it needs or tolerates |
| `water`, `drought_tolerance` | low, medium, high | |
| `temp_min_c`, `temp_max_c` | °C | Survival range |
| `humidity` | low, medium, high, any | |
| `min_pot_l`, `pot_depth_cm` | number | The smallest container that works well |
| `height_cm`, `spread_cm` | number | Size in a container |
| `habit` | enum | upright, bushy, trailing, climber, rosette, clumping, tree, spreading |
| `zones` | list | floor, railing, wall, hanging, rack, windowsill, indoor. Used by the space mapping |
| `indoor_ok` | yes/no | |
| `benefits` | list | food, herb, fragrance, flowers, pollinator, medicinal, air, privacy, shade, sacred, ornamental |
| `pollinator` | 0–3 | Value to bees and butterflies |
| `maintenance` | 1–5 | 1 = forget about it |
| `growth_rate`, `lifecycle`, `propagation` | enum / list | |
| `plant_months`, `peak_months` | 1–12 lists | **Indian plains** calendar (Pune and central India): when to plant, and when it is harvested or flowers |
| `days_to_harvest` | number | 0 for non-edibles |
| `pet_safe` | yes, no, unknown | Toxic plants are marked `no` |
| `care_tip` | text | The single most useful tip |

**Derived by the build:** `sun_class`, `pot_size_class`, `water_l_per_week` (a summer estimate), `beginner_score` (0–100) and `beginner_friendly`, `edible`, and `search_terms` / `search_keys`. The search fields include romanised Hindi and Marathi plus phonetic skeletons, so "jaswand", "pudina" and "kothimbir" all work.

## 4. Insights dataset

`sources/insights.csv` holds 187 one- or two-line tips with these columns: `id, category, contexts, months, plant_ids, text`.

- **Categories:** watering, sunlight, soil, pests, seasonal, climate, beginner, culture, fact, impact, food, space
- **Contexts** say where a tip may appear: `loading` (loading screens), `transition` (page-change toast), `empty` (empty states) and `tip` (inline cards and tickers)
- **`months`** makes a tip seasonal. It only shows in those months, and it is surfaced first then
- **`plant_ids`** links a tip to plant pages. The build validates these ids

## 5. Data quality rules (enforced by `scripts/build.py`)

- Every enum, range and month is valid, and ids are unique snake_case.
- Cross-field checks: sun min ≤ max, temperature min < max, price min ≤ max, every edible crop has days to harvest, a climber needs a wall or railing zone, and "indoor OK" plants don't need much sun.
- GBIF match must be EXACT with confidence ≥ 90. Anything else is a warning.
- Our harvest days are compared with the OpenPlantDB median. Large disagreements are warnings.
- Photo licences are recorded per image. Non-commercial ones are flagged in the report.
- **Values are guidance for the Indian plains, not lab measurements.** Impact numbers in the app are labelled as model-based estimates.

## 6. Growing the dataset

1. Add rows to `curated_plants.csv`. Check them against at least one Indian nursery listing and one growing guide (an agriculture university, ICAR or NHB).
2. Run `python scripts/build.py` and fix any errors, then review the warnings in `output/validation_report.md`.
3. To scale beyond hand curation, generate draft rows for the next 200 nursery plants (for example with an LLM, using OpenPlantDB and Perenual fields as grounding), then have a person review them before merging. The validator catches format errors, and the reviewer catches horticultural ones.
