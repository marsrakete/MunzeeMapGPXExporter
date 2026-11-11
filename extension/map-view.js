(() => {
  const channel = "munzee-map-gpx-exporter:v2";
  let selectedStart;
  const selectedStops = new Map();
  let selectionNotice;
  let noticeTimeout;

  function announceSelection(message) {
    if (!selectionNotice?.isConnected) {
      selectionNotice = document.createElement("div");
      selectionNotice.setAttribute("role", "status");
      selectionNotice.style.cssText = [
        "position:fixed", "left:16px", "bottom:48px", "z-index:10000",
        "max-width:min(420px,calc(100vw - 32px))", "padding:8px 12px",
        "background:#17382d", "color:white", "border-radius:6px",
        "font:14px system-ui,sans-serif", "pointer-events:none",
      ].join(";");
      document.body.append(selectionNotice);
    }
    selectionNotice.textContent = message;
    selectionNotice.hidden = false;
    clearTimeout(noticeTimeout);
    noticeTimeout = setTimeout(() => { selectionNotice.hidden = true; }, 3500);
  }

  function findMap(canvas) {
    // The current Munzee build mounts react-map-gl with a MapLibre ref.
    // Follow the owning DOM node's React ancestry to that ref only.
    const container = canvas.closest(".maplibregl-map");
    const key = container && Object.keys(container).find(name => name.startsWith("__reactFiber$"));
    if (!key) return null;

    for (let fiber = container[key]; fiber; fiber = fiber.return) {
      const map = fiber.ref?.current;
      if (typeof map?.getCanvas === "function" && map.getCanvas() === canvas &&
          typeof map.queryRenderedFeatures === "function") return map;
    }
    return null;
  }

  function readPin(feature) {
    if (feature.source !== "icons" || feature.geometry?.type !== "Point") return null;
    const { name, url, latitude, longitude } = feature.properties ?? {};
    if (typeof name !== "string" || !name.trim() || typeof url !== "string" ||
        latitude == null || longitude == null || latitude === "" || longitude === "") return null;

    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!Number.isFinite(lat) || Math.abs(lat) > 90 ||
        !Number.isFinite(lon) || Math.abs(lon) > 180) return null;

    const link = new URL(url, location.origin);
    if (!["munzee.com", "www.munzee.com"].includes(link.hostname)) return null;
    const path = link.pathname.match(/^\/m\/([a-z0-9_.~-]+)\/([a-z0-9_.~-]+)\/?$/i);
    if (!path) return null;

    const id = String(feature.properties.munzeeId ?? "");
    return {
      id: /^\d+$/.test(id) ? id : null,
      name: name.trim(),
      lat,
      lon,
      url: location.origin + "/m/" + path[1].toLowerCase() + "/" + path[2] + "/",
    };
  }

  window.addEventListener("click", event => {
    if (!event.isTrusted || event.button !== 0 ||
        !/^\/map(?:\/|$)/.test(location.pathname)) return;
    const canvas = event.target;
    if (!canvas.matches?.("#map-v2-page canvas.maplibregl-canvas")) return;

    try {
      const map = findMap(canvas);
      if (!map?.getLayer("icons")) return;
      const rect = canvas.getBoundingClientRect();
      const point = [event.clientX - rect.left - canvas.clientLeft,
        event.clientY - rect.top - canvas.clientTop];
      // MapLibre returns the topmost rendered symbol first.
      const [feature] = map.queryRenderedFeatures(point, { layers: ["icons"] });
      const pin = feature && readPin(feature);
      if (!pin) return;
      if (!event.shiftKey) {
        selectedStart = pin;
        selectedStops.delete(pin.url);
        announceSelection(`Startpunkt: ${pin.name}`);
      } else if (pin.url === selectedStart?.url) {
        announceSelection(`${pin.name} ist bereits der Startpunkt.`);
      } else if (selectedStops.delete(pin.url)) {
        announceSelection(`Entfernt: ${pin.name} · ${selectedStops.size} weitere Stopps`);
      } else {
        selectedStops.set(pin.url, pin);
        announceSelection(`Aufgenommen: ${pin.name} · ${selectedStops.size} weitere Stopps`);
      }
    } catch {
      // Keep Munzee's normal click behavior if its map implementation changes.
    }
  }, { capture: true });

  function snapshot() {
    const page = document.getElementById("map-v2-page");
    if (!page) return { status: "waiting", pins: [] };
    if (!document.getElementById("user-profile-button")) return { status: "login", pins: [] };
    const canvas = page.querySelector("canvas.maplibregl-canvas");
    if (!canvas) return { status: "waiting", pins: [] };
    const map = findMap(canvas);
    if (!map) return { status: "viewport-error", pins: [] };
    if (map.isMoving()) return { status: "waiting", pins: [] };
    if (!map.getLayer("icons")) return { status: "waiting", pins: [] };

    const pins = [];
    let schemaWarning = false;
    for (const feature of map.queryRenderedFeatures({ layers: ["icons"] })) {
      let pin;
      try { pin = readPin(feature); } catch { pin = null; }
      if (pin) pins.push(pin);
      else schemaWarning = true;
    }
    return { status: "ok", pins, schemaWarning };
  }

  window.addEventListener("message", event => {
    if (event.source !== window || event.origin !== location.origin ||
        event.data?.channel !== channel || event.data.type !== "request" ||
        !/^\/map(?:\/|$)/.test(location.pathname)) return;

    let result;
    try { result = snapshot(); }
    catch { result = { status: "viewport-error", pins: [] }; }
    if (document.getElementById("user-profile-button")) {
      result.selectedStart = selectedStart;
      result.selectedStops = [...selectedStops.values()];
    }
    window.postMessage({ channel, type: "result", id: event.data.id, ...result }, location.origin);
  });
})();
