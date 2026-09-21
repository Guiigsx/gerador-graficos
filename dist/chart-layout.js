(function exposeChartLayout(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ChartLayout = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createChartLayout() {
  function textRect({ x, y, width, fontSize, align = "center" }) {
    let left = x - width / 2;
    if (align === "left") left = x;
    if (align === "right") left = x - width;
    return {
      left,
      top: y - fontSize,
      right: left + width,
      bottom: y + fontSize * 0.24
    };
  }

  function rectsOverlap(first, second, padding = 0) {
    return !(
      first.right + padding <= second.left ||
      first.left - padding >= second.right ||
      first.bottom + padding <= second.top ||
      first.top - padding >= second.bottom
    );
  }

  function containsRect(bounds, rect) {
    return rect.left >= bounds.left && rect.right <= bounds.right && rect.top >= bounds.top && rect.bottom <= bounds.bottom;
  }

  function overlapArea(first, second, padding = 0) {
    const width = Math.max(0, Math.min(first.right + padding, second.right) - Math.max(first.left - padding, second.left));
    const height = Math.max(0, Math.min(first.bottom + padding, second.bottom) - Math.max(first.top - padding, second.top));
    return width * height;
  }

  function chooseCandidate({ candidates, labelWidth, fontSize, obstacles = [], bounds, padding = 4 }) {
    const evaluated = candidates.map((candidate, index) => {
      const rect = textRect({ ...candidate, width: labelWidth, fontSize });
      const allowedBounds = candidate.bounds || bounds;
      const inside = !allowedBounds || containsRect(allowedBounds, rect);
      const collisions = obstacles.filter(obstacle => rectsOverlap(rect, obstacle, padding));
      return {
        ...candidate,
        rect,
        index,
        inside,
        collisions,
        score: collisions.reduce((total, obstacle) => total + overlapArea(rect, obstacle, padding), 0)
      };
    });

    const clear = evaluated.find(candidate => candidate.inside && candidate.collisions.length === 0);
    if (clear) return clear;

    return evaluated
      .filter(candidate => candidate.inside)
      .sort((first, second) => first.score - second.score || first.index - second.index)[0] || evaluated[0];
  }

  return { chooseCandidate, containsRect, rectsOverlap, textRect };
});
