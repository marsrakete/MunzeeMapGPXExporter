const creator = "Munzee Map GPX Exporter";

function xml(value) {
  const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };
  return value.replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, "")
    .replace(/[&<>]/g, character => entities[character]);
}

function decimal(value) {
  // GPX uses XML Schema decimals and therefore forbids exponent notation.
  return value.toFixed(15).replace(/\.?0+$/, "") || "0";
}

function coordinates({ lat, lon }) {
  // GPX 1.1 excludes +180. The same meridian is represented by -180.
  return `lat="${decimal(lat)}" lon="${decimal(lon === 180 ? -180 : lon)}"`;
}

/**
 * Serializes validated pins as GPX 1.1 waypoints.
 * @param {{name:string,url:string,lat:number,lon:number}[]} pins
 * @param {{lat:number,lon:number}[]} [track] Optional points in visit order.
 * @returns {string} UTF-8 XML.
 */
export function toGpx(pins, track = []) {
  const waypoints = pins.map(pin => `  <wpt ${coordinates(pin)}>
    <name>${xml(pin.name)}</name>
    <desc>${xml(pin.url)}</desc>
  </wpt>`);
  const trackLines = track.length ? [
    "  <trk>",
    "    <name>Munzee-Tour (Luftlinie)</name>",
    "    <trkseg>",
    ...track.map(point => `      <trkpt ${coordinates(point)}/>`),
    "    </trkseg>",
    "  </trk>",
  ] : [];
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="${creator}">`,
    ...waypoints,
    ...trackLines,
    "</gpx>",
    "",
  ].join("\n");
}

function csvText(value) {
  // Treat a pin name as text when the CSV is opened in a spreadsheet.
  const safe = /^(?:\s*[=+@-]|[\t\r\n])/.test(value) ? "'" + value : value;
  return '"' + safe.replaceAll('"', '""') + '"';
}

/**
 * Serializes validated pins as comma-separated UTF-8 records.
 * @param {{name:string,url:string,lat:number,lon:number}[]} pins
 * @returns {string} CSV with a header and CRLF line endings.
 */
export function toCsv(pins) {
  const rows = pins.map(({ name, url, lat, lon }) =>
    [csvText(name), csvText(url), decimal(lat), decimal(lon)].join(",")
  );
  return ["name,url,latitude,longitude", ...rows, ""].join("\r\n");
}
