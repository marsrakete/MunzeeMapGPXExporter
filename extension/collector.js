(() => {
  const channel = "munzee-map-gpx-exporter:v2";
  const pending = new Map();

  function uniquePins(pins) {
    const urls = new Set();
    const ids = new Set();
    return pins.filter(pin => {
      if (typeof pin?.name !== "string" || !pin.name.trim() ||
          typeof pin.url !== "string" ||
          !/^https:\/\/www\.munzee\.com\/m\/[a-z0-9_.~-]+\/[a-z0-9_.~-]+\/$/i.test(pin.url) ||
          !Number.isFinite(pin.lat) || Math.abs(pin.lat) > 90 ||
          !Number.isFinite(pin.lon) || Math.abs(pin.lon) > 180) return false;
      if (urls.has(pin.url) || (pin.id && ids.has(pin.id))) return false;
      urls.add(pin.url);
      if (pin.id) ids.add(pin.id);
      return true;
    });
  }

  window.addEventListener("message", event => {
    if (event.source !== window || event.origin !== location.origin ||
        event.data?.channel !== channel || event.data.type !== "result") return;
    const { id, status, pins, schemaWarning, selectedStart, selectedStops } = event.data;
    const request = pending.get(id);
    if (!request || !Array.isArray(pins) ||
        !["ok", "login", "waiting", "viewport-error"].includes(status)) return;

    clearTimeout(request.timeout);
    pending.delete(id);
    const visible = uniquePins(pins);
    const [start] = uniquePins([selectedStart]);
    const selection = Array.isArray(selectedStops) ? selectedStops : [];
    const stops = start ? uniquePins([start, ...selection]).slice(1) : uniquePins(selection);
    request.reply({
      status,
      pins: visible,
      start,
      stops,
      schemaWarning: schemaWarning === true,
    });
  });

  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (message?.type !== channel || sender.id !== chrome.runtime.id ||
        !/^\/map(?:\/|$)/.test(location.pathname)) return;

    const id = crypto.randomUUID();
    const timeout = setTimeout(() => {
      pending.delete(id);
      reply({ status: "viewport-error", pins: [] });
    }, 2000);
    pending.set(id, { timeout, reply });
    window.postMessage({ channel, type: "request", id }, location.origin);
    return true;
  });
})();
