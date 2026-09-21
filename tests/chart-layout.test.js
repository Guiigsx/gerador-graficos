const test = require("node:test");
const assert = require("node:assert/strict");
const { chooseCandidate, rectsOverlap, textRect } = require("../dist/chart-layout.js");

const plotBounds = { left: 118, top: 170, right: 1518, bottom: 780 };

test("reposiciona o valor da barra quando a linha de referencia o atravessa", () => {
  const fontSize = 23;
  const labelWidth = 48;
  const barTop = 326;
  const lineY = 350;
  const obstacle = { left: plotBounds.left, top: lineY - 4, right: plotBounds.right, bottom: lineY + 4 };
  const preferred = textRect({ x: 720, y: barTop + 34, width: labelWidth, fontSize, align: "center" });

  assert.equal(rectsOverlap(preferred, obstacle, 4), true);

  const chosen = chooseCandidate({
    candidates: [
      { x: 720, y: barTop + 34, align: "center", inside: true },
      { x: 720, y: barTop - 13, align: "center", inside: false },
      { x: 720, y: barTop + 74, align: "center", inside: true }
    ],
    labelWidth,
    fontSize,
    obstacles: [obstacle],
    bounds: plotBounds,
    padding: 4
  });

  assert.notEqual(chosen.index, 0);
  assert.equal(rectsOverlap(chosen.rect, obstacle, 4), false);
});

test("evita o texto da referencia proximo da ultima barra", () => {
  const referenceLabel = { left: 1260, top: 321, right: 1508, bottom: 349 };
  const chosen = chooseCandidate({
    candidates: [
      { x: 1390, y: 344, align: "center" },
      { x: 1390, y: 305, align: "center" },
      { x: 1390, y: 390, align: "center" }
    ],
    labelWidth: 52,
    fontSize: 23,
    obstacles: [referenceLabel],
    bounds: plotBounds,
    padding: 5
  });

  assert.equal(rectsOverlap(chosen.rect, referenceLabel, 5), false);
});

test("move o rotulo de um ponto para baixo quando ha uma linha logo acima", () => {
  const line = { left: plotBounds.left, top: 297, right: plotBounds.right, bottom: 305 };
  const chosen = chooseCandidate({
    candidates: [
      { x: 530, y: 321, align: "center" },
      { x: 530, y: 365, align: "center" }
    ],
    labelWidth: 46,
    fontSize: 21,
    obstacles: [line],
    bounds: plotBounds,
    padding: 4
  });

  assert.equal(chosen.index, 1);
  assert.equal(rectsOverlap(chosen.rect, line, 4), false);
});

test("move o valor para dentro da barra horizontal quando a linha vertical ocupa a saida", () => {
  const verticalLine = { left: 812, top: 170, right: 820, bottom: 780 };
  const barBounds = { left: 190, top: 250, right: 810, bottom: 310 };
  const chosen = chooseCandidate({
    candidates: [
      { x: 822, y: 288, align: "left" },
      { x: 796, y: 288, align: "right", inside: true, bounds: barBounds }
    ],
    labelWidth: 48,
    fontSize: 21,
    obstacles: [verticalLine],
    bounds: plotBounds,
    padding: 4
  });

  assert.equal(chosen.index, 1);
  assert.equal(chosen.inside, true);
});

test("mantem a posicao preferida quando ela esta livre", () => {
  const chosen = chooseCandidate({
    candidates: [
      { x: 500, y: 300, align: "center" },
      { x: 500, y: 350, align: "center" }
    ],
    labelWidth: 60,
    fontSize: 20,
    obstacles: [],
    bounds: plotBounds
  });

  assert.equal(chosen.index, 0);
});

test("reposiciona o ultimo ponto sem ultrapassar a borda direita", () => {
  const referenceLabel = { left: 1260, top: 315, right: plotBounds.right, bottom: 344 };
  const chosen = chooseCandidate({
    candidates: [
      { x: plotBounds.right - 4, y: 338, align: "right" },
      { x: plotBounds.right - 4, y: 382, align: "right" }
    ],
    labelWidth: 48,
    fontSize: 21,
    obstacles: [referenceLabel],
    bounds: plotBounds,
    padding: 4
  });

  assert.equal(chosen.index, 1);
  assert.equal(chosen.rect.right <= plotBounds.right, true);
  assert.equal(rectsOverlap(chosen.rect, referenceLabel, 4), false);
});
