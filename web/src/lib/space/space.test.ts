import { describe, expect, it } from "vitest";
import citiesJson from "@/data/cities.json";
import { sunPosition } from "./solar";
import { floorGrid } from "./sunmap";
import { buildZones } from "./zones";
import { DEFAULT_PROFILE, type City, type SpaceProfile } from "./types";

const cities = citiesJson as unknown as City[];
const pune = cities.find((c) => c.id === "pune")!;
const delhi = cities.find((c) => c.id === "delhi")!;
const balcony = (over: Partial<SpaceProfile>): SpaceProfile => ({ ...DEFAULT_PROFILE, frontView: "open", ...over });
const zoneSun = (p: SpaceProfile, city: City, id: string, month: number) =>
  buildZones(p, city).find((z) => z.id === id)!.sunByMonth[month - 1];

describe("solar position", () => {
  it("puts the June noon sun almost overhead and slightly north in Pune", () => {
    const s = sunPosition(pune.lat, pune.lon, 6, 21, 12.6);
    expect(s.altitude).toBeGreaterThan(83);
    expect(s.azimuth < 90 || s.azimuth > 270).toBe(true); // north of zenith (lat 18.5° < 23.4°)
  });
  it("puts the December noon sun low in the south in Delhi", () => {
    const s = sunPosition(delhi.lat, delhi.lon, 12, 21, 12.3);
    expect(s.altitude).toBeGreaterThan(36);
    expect(s.altitude).toBeLessThan(40);
    expect(Math.abs(s.azimuth - 180)).toBeLessThan(10);
  });
  it("rises in the east in the morning", () => {
    const s = sunPosition(pune.lat, pune.lon, 3, 21, 7.5);
    expect(s.altitude).toBeGreaterThan(0);
    expect(s.azimuth).toBeGreaterThan(80);
    expect(s.azimuth).toBeLessThan(100);
  });
});

describe("balcony sun model", () => {
  it("gives a south-facing balcony far more sun in winter than in summer", () => {
    const p = balcony({ facing: 180 });
    expect(zoneSun(p, pune, "floor_front", 12)).toBeGreaterThan(zoneSun(p, pune, "floor_front", 6) + 3);
  });
  it("gives a north-facing balcony some summer sun but almost none in winter", () => {
    const p = balcony({ facing: 0 });
    expect(zoneSun(p, pune, "railing", 6)).toBeGreaterThan(1);
    expect(zoneSun(p, pune, "railing", 12)).toBeLessThan(0.5);
  });
  it("makes the back of a deep covered balcony darker than the railing", () => {
    const p = balcony({ facing: 90, depth: 2.4, walkway: true });
    expect(zoneSun(p, pune, "floor_back", 5)).toBeLessThan(zoneSun(p, pune, "railing", 5));
  });
  it("loses sun to a tall building close in front", () => {
    const open = balcony({ facing: 90 });
    const blocked = balcony({ facing: 90, frontView: "near", frontHeight: "much_taller" });
    expect(zoneSun(blocked, pune, "floor_front", 3)).toBeLessThan(zoneSun(open, pune, "floor_front", 3) - 1);
  });
  it("shades the floor behind a solid parapet more than behind a grill", () => {
    const grill = balcony({ facing: 90, railing: "grill" });
    const solid = balcony({ facing: 90, railing: "solid" });
    expect(zoneSun(solid, pune, "floor_front", 1)).toBeLessThan(zoneSun(grill, pune, "floor_front", 1));
  });
  it("gives an open terrace the most sun", () => {
    const terrace = balcony({ kind: "terrace", ceiling: null, width: 5, depth: 4, railingHeight: 0.9, railing: "solid" });
    expect(zoneSun(terrace, pune, "floor_front", 3)).toBeGreaterThan(9);
  });
  it("builds a floor heatmap that is brighter at the railing for an east balcony in the morning-sun season", () => {
    const g = floorGrid(balcony({ facing: 90, depth: 1.5 }), pune, 12);
    expect(g.rows).toBeGreaterThan(2);
    expect(g.hours[0][Math.floor(g.cols / 2)]).toBeGreaterThanOrEqual(g.hours[g.rows - 1][Math.floor(g.cols / 2)]);
  });
  it("applies the user's sun calibration", () => {
    const base = zoneSun(balcony({ facing: 90 }), pune, "floor_front", new Date().getMonth() + 1);
    const calibrated = zoneSun(balcony({ facing: 90, sunCalibration: base / 2 }), pune, "floor_front", new Date().getMonth() + 1);
    expect(calibrated).toBeLessThan(base);
  });
});
