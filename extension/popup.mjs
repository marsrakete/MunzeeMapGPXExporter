import { toCsv, toGpx } from "./export.mjs";
import { planTour } from "./tour.mjs";

const channel = "munzee-map-gpx-exporter:v2";
const statusText = {
  inactive: "Öffne die Munzee-Karte in diesem Tab. Lade sie nach der Installation einmal neu.",
  login: "Melde dich auf der Munzee-Seite an und lade die Karte bei Bedarf neu.",
  waiting: "Die Karte ist noch nicht bereit. Warte kurz und übernimm die Pins erneut.",
  empty: "Im aktuellen Kartenausschnitt sind keine exportierbaren Pins sichtbar.",
  viewportError: "Der sichtbare Kartenausschnitt konnte nicht gelesen werden. Lade die Karte neu. Falls die Meldung bleibt, könnte Munzee die Karte geändert haben.",
  schema: "Ein Teil der Kartendaten konnte nicht gelesen werden. Munzee könnte das Format geändert haben.",
  ready: "Vorschau der sichtbaren Pins im aktuellen Kartenausschnitt.",
};

const collect = document.querySelector("#collect");
const status = document.querySelector("#status");
const warning = document.querySelector("#warning");
const preview = document.querySelector("#preview");
const count = document.querySelector("#count");
const emptyCount = document.querySelector("#empty-count");
const list = document.querySelector("#pins");
const template = document.querySelector("#pin-row");
const gpx = document.querySelector("#gpx");
const csv = document.querySelector("#csv");
const tour = document.querySelector("#tour");
const tourMode = document.querySelector("#tour-mode");
const track = document.querySelector("#track");
const trackStart = document.querySelector("#track-start");
const trackSelection = document.querySelector("#track-selection");
const trackCount = document.querySelector("#track-count");
const trackStops = document.querySelector("#track-stops");
let pins = [];
let trackPins = [];

function render(result) {
  pins = result.pins;
  count.textContent = pins.length === 1 ? "1 Munzee gefunden" : `${pins.length} Munzees gefunden`;
  emptyCount.textContent = count.textContent;
  emptyCount.hidden = pins.length > 0;
  preview.hidden = !pins.length;
  gpx.disabled = csv.disabled = !pins.length;
  const { start, stops = [] } = result;
  tour.hidden = tour.disabled = !pins.length && !start && !stops.length;
  trackPins = start ? [start, ...stops] : [];
  track.disabled = trackPins.length < 2;
  trackSelection.hidden = !stops.length;
  trackCount.textContent = stops.length === 1 ? "1 ausgewählter Stopp" : `${stops.length} ausgewählte Stopps`;
  trackStops.replaceChildren(...stops.map(pin => {
    const item = document.createElement("li");
    item.textContent = pin.name;
    return item;
  }));
  if (start) trackStart.textContent = `Startpunkt: ${start.name}`;
  else {
    trackStart.textContent = "Klicke einen Munzee direkt auf der Karte an und öffne die Erweiterung erneut.";
  }

  const rows = document.createDocumentFragment();
  for (const { name, lat, lon } of pins) {
    const row = template.content.cloneNode(true);
    const cells = row.querySelectorAll("td");
    cells[0].textContent = name;
    cells[1].textContent = lat.toFixed(6);
    cells[2].textContent = lon.toFixed(6);
    rows.append(row);
  }
  list.replaceChildren(rows);

  warning.textContent = statusText.schema;
  warning.hidden = !result.schemaWarning;

  if (result.status === "login") status.textContent = statusText.login;
  else if (result.status === "inactive") status.textContent = statusText.inactive;
  else if (result.status === "viewport-error") status.textContent = statusText.viewportError;
  else if (pins.length) status.textContent = statusText.ready;
  else if (result.status === "waiting") status.textContent = statusText.waiting;
  else status.textContent = statusText.empty;
}

async function collectPins() {
  collect.disabled = true;
  gpx.disabled = csv.disabled = true;
  tour.disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const result = await chrome.tabs.sendMessage(tab.id, { type: channel });
    render(result);
  } catch {
    render({ status: "inactive", pins: [] });
  } finally {
    collect.disabled = false;
  }
}

function download(content, type, filename) {
  const file = new Blob([content], { type });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

collect.addEventListener("click", collectPins);
gpx.addEventListener("click", () => download(toGpx(pins), "application/gpx+xml", "munzees.gpx"));
csv.addEventListener("click", () => download(toCsv(pins), "text/csv;charset=utf-8", "munzees.csv"));
track.addEventListener("click", () => {
  if (trackPins.length < 2) return;
  const points = planTour(trackPins, 0, tourMode.value === "round");
  download(toGpx(trackPins, points), "application/gpx+xml", "munzees-track.gpx");
});
collectPins();
