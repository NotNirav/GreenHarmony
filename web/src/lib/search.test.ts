import { describe, expect, it } from "vitest";
import index from "@/data/plants_index.json";
import engine from "@/data/plants_engine.json";
import { devaFold, searchPlants, skeleton, transliterate, type Searchable } from "./search";

const plants = index as unknown as (Searchable & { hindi_name: string; marathi_name: string })[];
const top = (q: string) => searchPlants(plants, q, 3).map((p) => p.id);

describe("dataset", () => {
  it("has 500 plants with a Hindi name each", () => {
    expect(plants).toHaveLength(500);
    expect(plants.every((p) => /[ऀ-ॿ]/.test(p.hindi_name))).toBe(true);
    expect(new Set(plants.map((p) => p.id)).size).toBe(500);
  });
  it("Marathi names, where present, are Devanagari", () => {
    const withMr = plants.filter((p) => p.marathi_name);
    expect(withMr.length).toBeGreaterThan(300);
    expect(withMr.every((p) => /[ऀ-ॿ]/.test(p.marathi_name))).toBe(true);
  });
  it("engine data carries the same search fields", () => {
    const e = engine as unknown as Searchable[];
    expect(e).toHaveLength(500);
    expect(e.every((p) => p.search_terms.length > 0 && p.search_keys.length > 0)).toBe(true);
  });
});

describe("transliteration (mirrors build.py)", () => {
  it.each([
    ["पुदीना", "pdn"],
    ["पुदिना", "pdn"],
    ["गुड़हल", "gdl"],
    ["गुडहल", "gdl"],
    ["जास्वंद", "jsvnd"],
    ["सोनचाफा", "sncf"],
    ["कोथिंबीर", "ktmbr"],
  ])("%s → %s", (deva, key) => expect(skeleton(transliterate(deva))).toBe(key));
  it("folds nukta and chandrabindu", () => {
    expect(devaFold("गुड़हल")).toBe("गुडहल");
    expect(devaFold("गुलबाँस")).toBe("गुलबांस");
  });
});

describe("search finds plants by any name", () => {
  it.each([
    // English
    ["money plant", "money_plant"],
    ["ivy gourd", "ivy_gourd"],
    // Hindi, typed in Roman script
    ["gudhal", "hibiscus"],
    ["pudina", "mint"],
    ["kathal", "jackfruit"],
    ["kundru", "ivy_gourd"],
    ["chiku", "chikoo"],
    // Hindi in Devanagari, exact and misspelt
    ["गुड़हल", "hibiscus"],
    ["गुडहल", "hibiscus"],
    ["कटहल", "jackfruit"],
    ["मेहंदी", "mehendi"],
    ["रात की रानी", "raat_ki_rani"],
    // Marathi in Devanagari
    ["जास्वंद", "hibiscus"],
    ["तोंडली", "ivy_gourd"],
    ["सोनचाफा", "son_chafa"],
    ["फणस", "jackfruit"],
    ["अळीव", "garden_cress"],
    ["शेवगा", "moringa"],
    ["दूर्वा", "durva"],
    // Marathi, typed in Roman script
    ["jaswand", "hibiscus"],
    ["tondli", "ivy_gourd"],
    ["sonchafa", "son_chafa"],
    ["shevga", "moringa"],
    ["aliv", "garden_cress"],
    ["kadhipatta", "curry_leaf"],
  ])("%s → %s", (q, id) => expect(top(q)).toContain(id));

  it("returns nothing for gibberish and short queries", () => {
    expect(top("zzqx")).toEqual([]);
    expect(top("a")).toEqual([]);
  });
});

// Marathi (and Hindi) names typed in English letters, the way people actually type them.
const MARATHI_ROMAN: [string, string][] = [
  ["tulas", "tulsi"], ["tulshi", "tulsi"], ["pudina", "mint"], ["kothimbir", "coriander"], ["kadhipatta", "curry_leaf"], ["kadipatta", "curry_leaf"],
  ["gavati chaha", "lemongrass"], ["gavti chaha", "lemongrass"], ["panova", "ajwain_leaf"], ["shepu", "dill"], ["korphad", "aloe_vera"], ["gulvel", "giloy"],
  ["adulsa", "adulsa"], ["tomato", "tomato"], ["mirchi", "chilli"], ["dhobli mirchi", "capsicum"], ["vangi", "brinjal"], ["vange", "brinjal"], ["bhendi", "okra"],
  ["palak", "spinach"], ["lal math", "amaranth"], ["mula", "radish"], ["gajar", "carrot"], ["farasbi", "french_beans"], ["vatana", "peas"], ["kobi", "cabbage"],
  ["dudhi", "bottle_gourd"], ["dudhi bhopla", "bottle_gourd"], ["karle", "bitter_gourd"], ["karela", "bitter_gourd"], ["dodka", "ridge_gourd"], ["kakdi", "cucumber"],
  ["shevga", "moringa"], ["shevaga", "moringa"], ["lasun", "garlic"], ["batata", "potato"], ["ale", "ginger"], ["aale", "ginger"], ["halad", "turmeric"], ["mohari", "mustard_greens"], ["ratale", "sweet_potato"],
  ["limbu", "lemon"], ["amba", "mango_dwarf"], ["aamba", "mango_dwarf"], ["peru", "guava"], ["dalimb", "pomegranate"], ["papai", "papaya"], ["papaya", "papaya"], ["tuti", "mulberry"], ["draksha", "grapes"],
  ["sitafal", "sitaphal"], ["awla", "amla"], ["avla", "amla"], ["aavla", "amla"], ["karvand", "karonda"], ["keli", "banana_dwarf"], ["kel", "banana_dwarf"],
  ["jaswand", "hibiscus"], ["jasvand", "hibiscus"], ["mogra", "mogra"], ["jui", "juhi"], ["jai", "chameli"], ["ratrani", "raat_ki_rani"], ["parijatak", "parijat"], ["prajakta", "parijat"],
  ["zendu", "marigold"], ["jhendu", "marigold"], ["bogainvel", "bougainvillea"], ["sadafuli", "periwinkle"], ["chafa", "plumeria"], ["shevanti", "chrysanthemum"], ["terda", "balsam"],
  ["kombda", "celosia"], ["aboli", "crossandra"], ["tagar", "tagar"], ["kanher", "kaner"], ["nishigandh", "tuberose"], ["kamal", "lotus"], ["gokarna", "aparajita"], ["nagvel", "betel_leaf"], ["vida", "betel_leaf"],
  ["kadulimb", "neem_dwarf"], ["kadunimb", "neem_dwarf"], ["vad", "banyan_bonsai"], ["pimpal", "peepal_bonsai"], ["bambu", "bamboo_golden"], ["kardal", "canna"], ["ghol", "purslane"], ["hadga", "agathi"],
  ["sonchafa", "son_chafa"], ["bakul", "bakul"], ["sontakka", "ginger_lily"], ["gulbakshi", "gulbakshi"], ["tamhan", "tamhan"], ["palas", "palash"], ["tondli", "ivy_gourd"], ["padwal", "snake_gourd"],
  ["gavar", "cluster_beans"], ["chavli", "cowpea"], ["val papdi", "lablab"], ["ghevda", "lablab"], ["kartoli", "spiny_gourd"], ["alu", "colocasia"], ["aloo", "colocasia"], ["suran", "elephant_foot_yam"], ["mayalu", "malabar_spinach"],
  ["aliv", "garden_cress"], ["chakvat", "bathua"], ["ambadi", "gongura"], ["ambat chuka", "ambat_chuka"], ["chikoo", "chikoo"], ["chiku", "chikoo"], ["jambhul", "jamun"], ["santra", "orange"], ["mosambi", "mosambi"],
  ["ananas", "pineapple"], ["kalingad", "watermelon"], ["kharbuj", "muskmelon"], ["bor", "ber"], ["fanas", "jackfruit"], ["phanas", "jackfruit"], ["kokum", "kokum"], ["ratamba", "kokum"], ["jamb", "water_apple"],
  ["durva", "durva"], ["mendi", "mehendi"], ["mehendi", "mehendi"], ["lajalu", "lajwanti"], ["rui", "aak"], ["bhuinimb", "kalmegh"], ["maka", "bhringraj"], ["nirgudi", "nirgundi"], ["kandvel", "harjod"],
  ["tulshi", "tulsi"], ["kanda", "onion"], ["kanda paat", "spring_onion"], ["badishep", "fennel"], ["velchi", "cardamom"], ["miri", "black_pepper"], ["tamalpatra", "bay_leaf"], ["vala", "vetiver"], ["marva", "marwa"], ["davna", "davana"],
  ["brahmakamal", "brahma_kamal"], ["brahma kamal", "brahma_kamal"], ["panfuti", "pathharchatta"], ["ganesh vel", "cypress_vine"], ["ganeshvel", "cypress_vine"], ["hirva chafa", "hari_champa"], ["pandhra chafa", "plumeria_white"], ["nalichi bhaji", "water_spinach"],
];

describe("search by Marathi names typed in English", () => {
  it.each(MARATHI_ROMAN)("%s → %s", (q, id) => expect(searchPlants(plants, q, 5).map((p) => p.id)).toContain(id));
});
