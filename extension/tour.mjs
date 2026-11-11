const radians = Math.PI / 180;

function unitVector({ lat, lon }) {
  const latitude = lat * radians;
  const longitude = lon * radians;
  return [
    Math.cos(latitude) * Math.cos(longitude),
    Math.cos(latitude) * Math.sin(longitude),
    Math.sin(latitude),
  ];
}

/**
 * Orders pins by nearest neighbor, then shortens the tour with 2-opt.
 * @param {{lat: number, lon: number}[]} pins Validated pins from the current view.
 * @param {number} startIndex Index of the selected start.
 * @param {boolean} roundTrip Whether to return to the selected start.
 * @returns {{lat: number, lon: number}[]} Pins in track order.
 */
export function planTour(pins, startIndex, roundTrip) {
  if (pins.length < 2 || !Number.isInteger(startIndex) || !pins[startIndex]) {
    throw new RangeError("A tour requires at least two pins and a valid start");
  }

  const vectors = pins.map(unitVector);
  function chord(a, b) {
    const [x, y, z] = vectors[a];
    const [u, v, w] = vectors[b];
    return (x - u) ** 2 + (y - v) ** 2 + (z - w) ** 2;
  }
  function distance(a, b) {
    return 2 * Math.asin(Math.min(1, Math.sqrt(chord(a, b)) / 2));
  }

  const remaining = new Set(pins.keys());
  remaining.delete(startIndex);
  let end = startIndex;
  if (!roundTrip) {
    let farthest = -1;
    for (const index of remaining) {
      const separation = chord(startIndex, index);
      if (separation > farthest) {
        end = index;
        farthest = separation;
      }
    }
    remaining.delete(end);
  }

  const order = [startIndex];
  while (remaining.size) {
    let nearest;
    let shortest = Infinity;
    for (const index of remaining) {
      const separation = chord(order.at(-1), index);
      if (separation < shortest) {
        nearest = index;
        shortest = separation;
      }
    }
    order.push(nearest);
    remaining.delete(nearest);
  }
  order.push(end);

  // Keep both endpoints fixed. Limit passes and the search window for dense maps.
  for (let pass = 0; pass < 8; pass++) {
    let improved = false;
    for (let first = 1; first < order.length - 2; first++) {
      const lastCandidate = Math.min(order.length - 2, first + 512);
      for (let last = first + 1; last <= lastCandidate; last++) {
        const before = order[first - 1];
        const after = order[last + 1];
        const oldLength = distance(before, order[first]) + distance(order[last], after);
        const newLength = distance(before, order[last]) + distance(order[first], after);
        if (newLength + 1e-12 >= oldLength) continue;

        for (let left = first, right = last; left < right; left++, right--) {
          [order[left], order[right]] = [order[right], order[left]];
        }
        improved = true;
      }
    }
    if (!improved) break;
  }
  return order.map(index => pins[index]);
}
