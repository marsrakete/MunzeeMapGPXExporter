import assert from "node:assert/strict";
import { test } from "node:test";
import { toGpx } from "../extension/export.mjs";
import { planTour } from "../extension/tour.mjs";

const start = { name: "Start & Ziel", url: "https://www.munzee.com/m/a/1/", lat: 0, lon: 179 };
const nearby = { ...start, name: "Jenseits der Datumsgrenze", lon: -179 };
const middle = { ...start, name: "Mitte", lon: 165 };
const far = { ...start, name: "Fern", lon: 150 };
const pins = [nearby, far, start, middle];

test("open tour starts at the selected pin and ends at the geographically farthest pin", () => {
  assert.deepEqual(planTour(pins, 2, false), [start, nearby, middle, far]);
});

test("round trip visits every pin once before returning to the selected start", () => {
  const track = planTour(pins, 2, true);
  assert.equal(track.length, pins.length + 1);
  assert.equal(track[0], start);
  assert.equal(track.at(-1), start);
  assert.deepEqual(new Set(track.slice(0, -1)), new Set(pins));
});

test("two pins are sufficient, even at identical coordinates", () => {
  const other = { ...start };
  assert.deepEqual(planTour([start, other], 0, false), [start, other]);
  assert.deepEqual(planTour([start, other], 0, true), [start, other, start]);
  assert.throws(() => planTour([start], 0, false), RangeError);
  assert.throws(() => planTour(pins, -1, true), RangeError);
});

test("GPX track preserves the visit order and keeps waypoints", () => {
  const gpx = toGpx(pins, planTour(pins, 2, false));
  const track = gpx.match(/<trkseg>\s*([\s\S]*?)<\/trkseg>/)[1];
  assert.deepEqual([...track.matchAll(/<trkpt lat="0" lon="([^"]+)"\/>/g)].map(match => match[1]),
    ["179", "-179", "165", "150"]);
  assert.equal([...gpx.matchAll(/<wpt /g)].length, pins.length);
  assert.match(gpx, /<name>Start &amp; Ziel<\/name>/);
  assert.doesNotMatch(toGpx(pins), /<trk>/);
});
