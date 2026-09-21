const defaultChart = {
  type: "bar",
  title: "RESISTENCIA INDIVIDUAL A COMPRESSAO - LOTE 5",
  subtitle: "",
  unit: "MPa",
  source: "",
  decimals: 1,
  font: "Inter",
  width: 1600,
  height: 900,
  primaryColor: "#1268d3",
  backgroundColor: "#ffffff",
  textColor: "#0b0f19",
  gridColor: "#d9e2ef",
  averageColor: "#0b0f19",
  referenceColor: "#4d9cff",
  showLegend: true,
  showDataLabels: true,
  showAverage: true,
  averageLabel: "Media do lote",
  showReference: true,
  referenceLabel: "FCK esperado",
  referenceValue: 35,
  yMax: 50,
  rows: [
    { label: "P01", value: 32.5, color: "" },
    { label: "P02", value: 33.4, color: "" },
    { label: "P03", value: 37.2, color: "" },
    { label: "P04", value: 34.9, color: "" },
    { label: "P05", value: 40.4, color: "" },
    { label: "P06", value: 34.7, color: "" }
  ]
};

let chart = clone(defaultChart);
let frameId = 0;
let toastTimer = 0;

const canvas = document.getElementById("chart-canvas");
const context = canvas.getContext("2d");
const { chooseCandidate, rectsOverlap, textRect } = window.ChartLayout;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: chart.decimals,
    maximumFractionDigits: chart.decimals
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function paletteColor(index) {
  const colors = [chart.primaryColor, "#0b0f19", "#4d9cff", "#75b1ff", "#263247", "#8aa8cc", "#315f91", "#b5c9e3"];
  return colors[index % colors.length];
}

function rowColor(row, index) {
  if (row.color) return row.color;
  return ["pie", "doughnut"].includes(chart.type) ? paletteColor(index) : chart.primaryColor;
}

function queueDraw() {
  window.cancelAnimationFrame(frameId);
  document.getElementById("live-status").textContent = "Atualizando...";
  frameId = window.requestAnimationFrame(() => {
    drawChart();
    document.getElementById("live-status").textContent = "Previa atualizada";
  });
}

function bindControls() {
  document.querySelectorAll("[data-field]").forEach(input => {
    const update = () => {
      const field = input.dataset.field;
      if (["decimals", "referenceValue", "yMax"].includes(field)) {
        chart[field] = field === "decimals" ? Math.max(0, Math.min(3, Math.round(parseNumber(input.value)))) : parseNumber(input.value);
      } else {
        chart[field] = input.value;
      }
      queueDraw();
      if (field === "font") loadSelectedFont();
    };
    input.addEventListener("input", update);
    input.addEventListener("change", update);
  });

  document.querySelectorAll("[data-flag]").forEach(input => {
    input.addEventListener("change", () => {
      chart[input.dataset.flag] = input.checked;
      queueDraw();
    });
  });

  document.querySelectorAll("[data-type]").forEach(button => {
    button.addEventListener("click", () => setChartType(button.dataset.type));
  });

  document.getElementById("chart-size").addEventListener("change", event => {
    const [width, height] = event.target.value.split("x").map(Number);
    chart.width = width;
    chart.height = height;
    canvas.width = width;
    canvas.height = height;
    document.getElementById("canvas-size-label").textContent = `${width} × ${height} px`;
    queueDraw();
  });

  document.getElementById("add-row").addEventListener("click", () => {
    const next = chart.rows.length + 1;
    chart.rows.push({ label: `Item ${next}`, value: 0, color: "" });
    renderRows();
    queueDraw();
  });

  document.getElementById("apply-bulk").addEventListener("click", applyBulkData);
  document.getElementById("reset-chart").addEventListener("click", resetChart);
  document.getElementById("download-chart").addEventListener("click", downloadChart);
  document.getElementById("mobile-download").addEventListener("click", downloadChart);
}

function setChartType(type) {
  chart.type = type;
  document.querySelectorAll("[data-type]").forEach(button => {
    const active = button.dataset.type === type;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-checked", String(active));
  });
  document.querySelectorAll(".cartesian-only").forEach(section => {
    section.hidden = ["pie", "doughnut"].includes(type);
  });
  renderRows();
  queueDraw();
}

function renderRows() {
  const list = document.getElementById("data-list");
  list.innerHTML = chart.rows.map((row, index) => `
    <div class="data-row" data-index="${index}">
      <input type="text" value="${escapeHtml(row.label)}" data-row-field="label" aria-label="Rotulo do dado ${index + 1}">
      <input type="text" inputmode="decimal" value="${escapeHtml(String(row.value).replace(".", ","))}" data-row-field="value" aria-label="Valor do dado ${index + 1}">
      <input type="color" value="${rowColor(row, index)}" data-row-field="color" aria-label="Cor do dado ${index + 1}">
      <button class="remove-row" type="button" data-remove-row="${index}" aria-label="Excluir dado ${index + 1}" title="Excluir">×</button>
    </div>
  `).join("");

  list.querySelectorAll("[data-row-field]").forEach(input => {
    const update = () => {
      const row = chart.rows[Number(input.closest(".data-row").dataset.index)];
      const field = input.dataset.rowField;
      row[field] = field === "value" ? parseNumber(input.value) : input.value;
      queueDraw();
    };
    input.addEventListener("input", update);
    input.addEventListener("change", update);
  });

  list.querySelectorAll("[data-remove-row]").forEach(button => {
    button.addEventListener("click", () => {
      if (chart.rows.length === 1) {
        showToast("O grafico precisa ter pelo menos um dado.");
        return;
      }
      chart.rows.splice(Number(button.dataset.removeRow), 1);
      renderRows();
      queueDraw();
    });
  });

  document.getElementById("data-count").textContent = `${chart.rows.length} ${chart.rows.length === 1 ? "item" : "itens"}`;
}

function applyBulkData() {
  const lines = document.getElementById("bulk-data").value.split(/\r?\n/).filter(line => line.trim());
  const rows = lines.map(line => {
    const parts = line.split(/[;\t]/);
    return { label: (parts[0] || "").trim(), value: parseNumber(parts[1]), color: "" };
  }).filter(row => row.label && Number.isFinite(row.value));

  if (!rows.length) {
    showToast("Nao encontrei dados validos para aplicar.");
    return;
  }
  chart.rows = rows;
  renderRows();
  queueDraw();
  showToast(`${rows.length} dados aplicados.`);
}

function resetChart() {
  chart = clone(defaultChart);
  canvas.width = chart.width;
  canvas.height = chart.height;
  document.querySelectorAll("[data-field]").forEach(input => {
    if (Object.hasOwn(chart, input.dataset.field)) input.value = chart[input.dataset.field];
  });
  document.querySelectorAll("[data-flag]").forEach(input => {
    input.checked = Boolean(chart[input.dataset.flag]);
  });
  document.getElementById("chart-size").value = `${chart.width}x${chart.height}`;
  document.getElementById("canvas-size-label").textContent = `${chart.width} × ${chart.height} px`;
  document.getElementById("bulk-data").value = "";
  setChartType(chart.type);
  showToast("Exemplo restaurado.");
}

function downloadChart() {
  drawChart();
  const link = document.createElement("a");
  link.download = `${slugify(chart.title || "grafico")}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
  showToast("PNG gerado com sucesso.");
}

function slugify(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "grafico";
}

function showToast(message) {
  const toast = document.getElementById("toast");
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2400);
}

function drawChart() {
  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);
  context.fillStyle = chart.backgroundColor;
  context.fillRect(0, 0, width, height);
  context.textBaseline = "alphabetic";
  context.lineJoin = "round";
  context.lineCap = "round";

  const rows = chart.rows.map(row => ({ ...row, value: Number(row.value) || 0 }));
  if (!rows.length) return;

  if (chart.type === "horizontalBar") drawHorizontalBars(rows);
  else if (chart.type === "line") drawLine(rows);
  else if (["pie", "doughnut"].includes(chart.type)) drawPie(rows);
  else drawBars(rows);
}

function setFont(size, weight = 400) {
  context.font = `${weight} ${size}px "${chart.font}", Inter, Arial, sans-serif`;
}

function loadSelectedFont() {
  if (!document.fonts?.load) return;
  document.fonts.load(`700 24px "${chart.font}"`).then(queueDraw).catch(() => {});
}

function drawHeader() {
  const width = canvas.width;
  const scale = Math.min(width / 1600, canvas.height / 900);
  let titleSize = Math.max(30, 52 * scale);
  const subtitleSize = Math.max(17, 24 * scale);
  context.fillStyle = chart.textColor;
  context.textAlign = "center";
  setFont(titleSize, 800);
  while (context.measureText(chart.title || "Grafico sem titulo").width > width - 140 * scale && titleSize > 22) {
    titleSize -= 1;
    setFont(titleSize, 800);
  }
  fitText(chart.title || "Grafico sem titulo", width / 2, 66 * scale + titleSize, width - 140 * scale);
  let bottom = 66 * scale + titleSize;
  if (chart.subtitle) {
    setFont(subtitleSize, 400);
    context.globalAlpha = 0.82;
    fitText(chart.subtitle, width / 2, bottom + 38 * scale, width - 160 * scale);
    context.globalAlpha = 1;
    bottom += 38 * scale;
  }
  return { scale, bottom };
}

function fitText(text, x, y, maxWidth) {
  let output = String(text || "");
  if (context.measureText(output).width <= maxWidth) {
    context.fillText(output, x, y);
    return;
  }
  while (output.length > 3 && context.measureText(`${output}...`).width > maxWidth) output = output.slice(0, -1);
  context.fillText(`${output}...`, x, y);
}

function chartMetrics(rows, headerBottom) {
  const scale = Math.min(canvas.width / 1600, canvas.height / 900);
  const legendSpace = chart.showLegend ? 94 * scale : 34 * scale;
  const sourceSpace = chart.source ? 30 * scale : 0;
  return {
    scale,
    left: 118 * scale,
    right: 82 * scale,
    top: headerBottom + 65 * scale,
    bottom: canvas.height - legendSpace - sourceSpace
  };
}

function scaleMax(rows) {
  const maximum = Math.max(...rows.map(row => row.value), chart.showReference ? chart.referenceValue : 0, 1);
  if (chart.yMax > 0 && chart.yMax >= maximum) return chart.yMax;
  const magnitude = Math.pow(10, Math.floor(Math.log10(maximum)));
  const normalized = maximum / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

function niceStep(maximum) {
  const rough = maximum / 6;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const normalized = rough / magnitude;
  return (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
}

function horizontalReferenceGeometry(rows, area, maximum) {
  const plotWidth = canvas.width - area.left - area.right;
  const plotHeight = area.bottom - area.top;
  const average = rows.reduce((total, row) => total + Number(row.value || 0), 0) / rows.length;
  const fontSize = Math.max(13, 21 * area.scale);
  const lines = [];
  if (chart.showAverage) lines.push({ value: average, color: chart.averageColor, label: `${chart.averageLabel}: ${formatNumber(average)} ${chart.unit}`.trim(), dash: [] });
  if (chart.showReference) lines.push({ value: chart.referenceValue, color: chart.referenceColor, label: `${chart.referenceLabel}: ${formatNumber(chart.referenceValue)} ${chart.unit}`.trim(), dash: [16 * area.scale, 12 * area.scale] });

  const horizontalLabels = [];
  setFont(fontSize, 800);
  return lines.map((line, index) => {
    const y = area.bottom - (line.value / maximum) * plotHeight;
    const align = index % 2 === 0 ? "left" : "right";
    const x = align === "left" ? area.left + 10 * area.scale : area.left + plotWidth - 10 * area.scale;
    const width = context.measureText(line.label).width;
    let labelY = y - 12 * area.scale;
    let labelRect = textRect({ x, y: labelY, width, fontSize, align });
    if (labelRect.top < area.top) {
      labelY = y + fontSize + 12 * area.scale;
      labelRect = textRect({ x, y: labelY, width, fontSize, align });
    }
    if (horizontalLabels.some(previous => rectsOverlap(labelRect, previous, 5 * area.scale))) {
      labelY = y + fontSize + 12 * area.scale;
      labelRect = textRect({ x, y: labelY, width, fontSize, align });
    }
    horizontalLabels.push(labelRect);
    return {
      ...line,
      x,
      y,
      align,
      labelY,
      fontSize,
      labelRect,
      lineRect: { left: area.left, top: y - 4 * area.scale, right: area.left + plotWidth, bottom: y + 4 * area.scale }
    };
  });
}

function verticalReferenceGeometry(rows, area, maximum) {
  const plotWidth = canvas.width - area.left - area.right;
  const plotHeight = area.bottom - area.top;
  const average = rows.reduce((total, row) => total + Number(row.value || 0), 0) / rows.length;
  const fontSize = Math.max(13, 20 * area.scale);
  const lines = [];
  if (chart.showAverage) lines.push({ value: average, color: chart.averageColor, label: `${chart.averageLabel}: ${formatNumber(average)}`, dash: [] });
  if (chart.showReference) lines.push({ value: chart.referenceValue, color: chart.referenceColor, label: `${chart.referenceLabel}: ${formatNumber(chart.referenceValue)}`, dash: [16 * area.scale, 12 * area.scale] });

  setFont(fontSize, 800);
  return lines.map((line, index) => {
    const x = area.left + (line.value / maximum) * plotWidth;
    const labelX = x + (index ? -12 : 12) * area.scale;
    const labelWidth = context.measureText(line.label).width;
    const labelAtTop = index % 2 === 0;
    const labelY = labelAtTop ? area.top + 8 * area.scale : area.bottom - 8 * area.scale;
    return {
      ...line,
      x,
      labelX,
      labelY,
      labelAlign: labelAtTop ? "right" : "left",
      fontSize,
      labelRect: {
        left: labelX - fontSize,
        top: labelAtTop ? labelY : Math.max(area.top, labelY - labelWidth),
        right: labelX + fontSize * .3,
        bottom: labelAtTop ? Math.min(area.bottom, labelY + labelWidth) : labelY
      },
      lineRect: { left: x - 4 * area.scale, top: area.top, right: x + 4 * area.scale, bottom: area.top + plotHeight }
    };
  });
}

function referenceObstacles(references) {
  return references.flatMap(reference => [reference.lineRect, reference.labelRect]);
}

function plotBounds(area) {
  return {
    left: area.left,
    top: area.top,
    right: canvas.width - area.right,
    bottom: area.bottom
  };
}

function drawBars(rows) {
  const header = drawHeader();
  const area = chartMetrics(rows, header.bottom);
  const maximum = scaleMax(rows);
  drawYAxis(area, maximum);
  const plotWidth = canvas.width - area.left - area.right;
  const plotHeight = area.bottom - area.top;
  const slot = plotWidth / rows.length;
  const barWidth = Math.min(slot * 0.64, 220 * area.scale);
  const references = horizontalReferenceGeometry(rows, area, maximum);
  const obstacles = referenceObstacles(references);
  const bounds = plotBounds(area);

  rows.forEach((row, index) => {
    const x = area.left + slot * index + (slot - barWidth) / 2;
    const barHeight = Math.max(1, (row.value / maximum) * plotHeight);
    const y = area.bottom - barHeight;
    context.fillStyle = rowColor(row, index);
    roundedRect(x, y, barWidth, barHeight, 9 * area.scale);
    context.fill();

    context.textAlign = "center";
    context.fillStyle = chart.textColor;
    setFont(Math.max(15, 23 * area.scale), 500);
    fitText(row.label, x + barWidth / 2, area.bottom + 39 * area.scale, Math.max(48, slot - 10));

    if (chart.showDataLabels) {
      const fontSize = Math.max(14, 23 * area.scale);
      const label = formatNumber(row.value);
      const center = x + barWidth / 2;
      const barBounds = { left: x + 7 * area.scale, top: y + 6 * area.scale, right: x + barWidth - 7 * area.scale, bottom: area.bottom - 6 * area.scale };
      setFont(fontSize, 800);
      const selected = chooseCandidate({
        candidates: [
          { x: center, y: y + 34 * area.scale, align: "center", onData: true, bounds: barBounds },
          { x: center, y: y - 13 * area.scale, align: "center", onData: false },
          { x: center, y: y + fontSize * 2 + 18 * area.scale, align: "center", onData: true, bounds: barBounds },
          { x: center, y: area.bottom - 18 * area.scale, align: "center", onData: true, bounds: barBounds }
        ],
        labelWidth: context.measureText(label).width,
        fontSize,
        obstacles,
        bounds,
        padding: 5 * area.scale
      });
      context.textAlign = selected.align;
      context.fillStyle = selected.onData ? "#ffffff" : chart.textColor;
      context.fillText(label, selected.x, selected.y);
    }
  });

  drawReferenceLines(references, area);
  drawCartesianFooter(rows, area);
}

function drawHorizontalBars(rows) {
  const header = drawHeader();
  const area = chartMetrics(rows, header.bottom);
  area.left = 190 * area.scale;
  const maximum = scaleMax(rows);
  const plotWidth = canvas.width - area.left - area.right;
  const plotHeight = area.bottom - area.top;
  const slot = plotHeight / rows.length;
  const barHeight = Math.min(slot * .58, 78 * area.scale);
  const references = verticalReferenceGeometry(rows, area, maximum);
  const obstacles = referenceObstacles(references);
  const bounds = plotBounds(area);

  drawXAxis(area, maximum);
  rows.forEach((row, index) => {
    const y = area.top + slot * index + (slot - barHeight) / 2;
    const width = Math.max(1, (row.value / maximum) * plotWidth);
    context.fillStyle = rowColor(row, index);
    roundedRect(area.left, y, width, barHeight, 8 * area.scale);
    context.fill();

    context.textAlign = "right";
    context.fillStyle = chart.textColor;
    setFont(Math.max(14, 22 * area.scale), 500);
    fitText(row.label, area.left - 18 * area.scale, y + barHeight / 2 + 7 * area.scale, area.left - 34 * area.scale);

    if (chart.showDataLabels) {
      const fontSize = Math.max(14, 21 * area.scale);
      const label = formatNumber(row.value);
      const baseline = y + barHeight / 2 + fontSize * .34;
      const barBounds = { left: area.left + 7 * area.scale, top: y + 5 * area.scale, right: area.left + width - 7 * area.scale, bottom: y + barHeight - 5 * area.scale };
      setFont(fontSize, 800);
      const selected = chooseCandidate({
        candidates: [
          { x: area.left + width + 12 * area.scale, y: baseline, align: "left", onData: false },
          { x: area.left + width - 12 * area.scale, y: baseline, align: "right", onData: true, bounds: barBounds },
          { x: area.left + 12 * area.scale, y: baseline, align: "left", onData: true, bounds: barBounds }
        ],
        labelWidth: context.measureText(label).width,
        fontSize,
        obstacles,
        bounds,
        padding: 5 * area.scale
      });
      context.textAlign = selected.align;
      context.fillStyle = selected.onData ? "#ffffff" : chart.textColor;
      context.fillText(label, selected.x, selected.y);
    }
  });

  drawVerticalReferenceLines(references, area);
  drawCartesianFooter(rows, area);
}

function drawLine(rows) {
  const header = drawHeader();
  const area = chartMetrics(rows, header.bottom);
  const maximum = scaleMax(rows);
  drawYAxis(area, maximum);
  const plotWidth = canvas.width - area.left - area.right;
  const plotHeight = area.bottom - area.top;
  const step = rows.length > 1 ? plotWidth / (rows.length - 1) : 0;
  const points = rows.map((row, index) => ({
    x: rows.length === 1 ? area.left + plotWidth / 2 : area.left + index * step,
    y: area.bottom - (row.value / maximum) * plotHeight
  }));
  const references = horizontalReferenceGeometry(rows, area, maximum);
  const labelObstacles = referenceObstacles(references);
  const bounds = plotBounds(area);

  context.beginPath();
  points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
  context.strokeStyle = chart.primaryColor;
  context.lineWidth = 5 * area.scale;
  context.stroke();

  points.forEach((point, index) => {
    context.beginPath();
    context.arc(point.x, point.y, 9 * area.scale, 0, Math.PI * 2);
    context.fillStyle = rowColor(rows[index], index);
    context.fill();
    context.strokeStyle = chart.backgroundColor;
    context.lineWidth = 4 * area.scale;
    context.stroke();

    context.textAlign = "center";
    context.fillStyle = chart.textColor;
    setFont(Math.max(14, 21 * area.scale), 500);
    fitText(rows[index].label, point.x, area.bottom + 39 * area.scale, Math.max(55, step - 12));
    if (chart.showDataLabels) {
      const fontSize = Math.max(14, 21 * area.scale);
      const label = formatNumber(rows[index].value);
      const labelAlign = index === 0 ? "left" : index === rows.length - 1 ? "right" : "center";
      const labelX = point.x + (index === 0 ? 4 * area.scale : index === rows.length - 1 ? -4 * area.scale : 0);
      setFont(fontSize, 800);
      const selected = chooseCandidate({
        candidates: [
          { x: labelX, y: point.y - 20 * area.scale, align: labelAlign },
          { x: labelX, y: point.y + fontSize + 20 * area.scale, align: labelAlign },
          { x: labelX, y: point.y - fontSize - 30 * area.scale, align: labelAlign },
          { x: labelX, y: point.y + fontSize * 2 + 30 * area.scale, align: labelAlign }
        ],
        labelWidth: context.measureText(label).width,
        fontSize,
        obstacles: labelObstacles,
        bounds,
        padding: 5 * area.scale
      });
      context.textAlign = selected.align;
      context.fillStyle = chart.textColor;
      context.fillText(label, selected.x, selected.y);
      labelObstacles.push(selected.rect);
    }
  });

  drawReferenceLines(references, area);
  drawCartesianFooter(rows, area);
}

function drawYAxis(area, maximum) {
  const plotWidth = canvas.width - area.left - area.right;
  const plotHeight = area.bottom - area.top;
  const step = niceStep(maximum);
  context.textAlign = "right";
  context.strokeStyle = chart.gridColor;
  context.lineWidth = Math.max(1, 2 * area.scale);
  context.fillStyle = chart.textColor;
  setFont(Math.max(13, 19 * area.scale), 400);

  for (let value = 0; value <= maximum + step * .01; value += step) {
    const y = area.bottom - (value / maximum) * plotHeight;
    context.beginPath();
    context.moveTo(area.left, y);
    context.lineTo(area.left + plotWidth, y);
    context.stroke();
    context.fillText(formatTick(value), area.left - 15 * area.scale, y + 6 * area.scale);
  }
  context.textAlign = "left";
  setFont(Math.max(13, 20 * area.scale), 600);
  context.fillText(chart.unit || "", area.left - 76 * area.scale, area.top - 20 * area.scale);
}

function drawXAxis(area, maximum) {
  const plotWidth = canvas.width - area.left - area.right;
  const plotHeight = area.bottom - area.top;
  const step = niceStep(maximum);
  context.strokeStyle = chart.gridColor;
  context.lineWidth = Math.max(1, 2 * area.scale);
  context.fillStyle = chart.textColor;
  context.textAlign = "center";
  setFont(Math.max(13, 19 * area.scale), 400);
  for (let value = 0; value <= maximum + step * .01; value += step) {
    const x = area.left + (value / maximum) * plotWidth;
    context.beginPath();
    context.moveTo(x, area.top);
    context.lineTo(x, area.top + plotHeight);
    context.stroke();
    context.fillText(formatTick(value), x, area.bottom + 34 * area.scale);
  }
  context.textAlign = "right";
  setFont(Math.max(13, 20 * area.scale), 600);
  context.fillText(chart.unit || "", canvas.width - area.right, area.bottom + 68 * area.scale);
}

function formatTick(value) {
  return Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function drawReferenceLines(references, area) {
  const plotWidth = canvas.width - area.left - area.right;
  references.forEach(line => {
    context.save();
    context.setLineDash(line.dash);
    context.strokeStyle = line.color;
    context.lineWidth = 4 * area.scale;
    context.beginPath();
    context.moveTo(area.left, line.y);
    context.lineTo(area.left + plotWidth, line.y);
    context.stroke();
    context.restore();
    context.fillStyle = line.color;
    context.textAlign = line.align;
    setFont(line.fontSize, 800);
    context.fillText(line.label, line.x, line.labelY);
  });
}

function drawVerticalReferenceLines(references, area) {
  references.forEach(line => {
    context.save();
    context.setLineDash(line.dash);
    context.strokeStyle = line.color;
    context.lineWidth = 4 * area.scale;
    context.beginPath();
    context.moveTo(line.x, area.top);
    context.lineTo(line.x, area.bottom);
    context.stroke();
    context.restore();
    context.save();
    context.translate(line.labelX, line.labelY);
    context.rotate(-Math.PI / 2);
    context.fillStyle = line.color;
    context.textAlign = line.labelAlign;
    setFont(line.fontSize, 800);
    context.fillText(line.label, 0, 0);
    context.restore();
  });
}

function drawCartesianFooter(rows, area) {
  if (chart.showLegend) {
    const items = [{ color: chart.primaryColor, label: "Dados", line: chart.type === "line" }];
    if (chart.showAverage) items.push({ color: chart.averageColor, label: chart.averageLabel, line: true });
    if (chart.showReference) items.push({ color: chart.referenceColor, label: chart.referenceLabel, line: true, dashed: true });
    drawLegend(items, area.bottom + 74 * area.scale, area.scale);
  }
  drawSource(area.scale);
}

function drawPie(rows) {
  const header = drawHeader();
  const scale = header.scale;
  const total = rows.reduce((sum, row) => sum + Math.max(0, row.value), 0) || 1;
  const availableHeight = canvas.height - header.bottom - 105 * scale;
  const legendWidth = chart.showLegend && canvas.width >= canvas.height ? Math.min(canvas.width * .34, 500 * scale) : 0;
  const radius = Math.min((canvas.width - legendWidth) * .28, availableHeight * .42);
  const centerX = legendWidth ? (canvas.width - legendWidth) / 2 : canvas.width / 2;
  const centerY = header.bottom + availableHeight / 2 + 24 * scale;
  let angle = -Math.PI / 2;

  rows.forEach((row, index) => {
    const slice = Math.max(0, row.value) / total * Math.PI * 2;
    context.beginPath();
    context.moveTo(centerX, centerY);
    context.arc(centerX, centerY, radius, angle, angle + slice);
    context.closePath();
    context.fillStyle = rowColor(row, index);
    context.fill();
    context.strokeStyle = chart.backgroundColor;
    context.lineWidth = 4 * scale;
    context.stroke();

    if (chart.showDataLabels && slice > .22) {
      const middle = angle + slice / 2;
      const labelRadius = radius * .7;
      const x = centerX + Math.cos(middle) * labelRadius;
      const y = centerY + Math.sin(middle) * labelRadius;
      context.fillStyle = "#ffffff";
      context.textAlign = "center";
      setFont(Math.max(14, 22 * scale), 800);
      context.fillText(`${formatNumber(row.value)}`, x, y + 7 * scale);
    }
    angle += slice;
  });

  if (chart.type === "doughnut") {
    context.beginPath();
    context.arc(centerX, centerY, radius * .55, 0, Math.PI * 2);
    context.fillStyle = chart.backgroundColor;
    context.fill();
    context.fillStyle = chart.textColor;
    context.textAlign = "center";
    setFont(Math.max(17, 26 * scale), 500);
    context.fillText("Total", centerX, centerY - 8 * scale);
    setFont(Math.max(22, 40 * scale), 800);
    context.fillText(formatNumber(total), centerX, centerY + 38 * scale);
  }

  if (chart.showLegend) {
    if (legendWidth) drawPieLegend(rows, total, canvas.width - legendWidth + 30 * scale, header.bottom + 70 * scale, legendWidth - 60 * scale, scale);
    else drawLegend(rows.map((row, index) => ({ color: rowColor(row, index), label: row.label })), canvas.height - 68 * scale, scale);
  }
  drawSource(scale);
}

function drawLegend(items, y, scale) {
  context.textAlign = "left";
  setFont(Math.max(13, 19 * scale), 500);
  const gap = 42 * scale;
  const itemWidths = items.map(item => 34 * scale + context.measureText(item.label).width);
  const totalWidth = itemWidths.reduce((sum, width) => sum + width, 0) + gap * (items.length - 1);
  let x = Math.max(28 * scale, (canvas.width - totalWidth) / 2);
  items.forEach((item, index) => {
    context.strokeStyle = item.color;
    context.fillStyle = item.color;
    context.lineWidth = 5 * scale;
    if (item.line) {
      context.save();
      if (item.dashed) context.setLineDash([10 * scale, 8 * scale]);
      context.beginPath();
      context.moveTo(x, y - 6 * scale);
      context.lineTo(x + 24 * scale, y - 6 * scale);
      context.stroke();
      context.restore();
    } else {
      context.fillRect(x, y - 19 * scale, 24 * scale, 19 * scale);
    }
    context.fillStyle = chart.textColor;
    context.fillText(item.label, x + 34 * scale, y);
    x += itemWidths[index] + gap;
  });
}

function drawPieLegend(rows, total, x, y, width, scale) {
  const rowHeight = Math.min(60 * scale, (canvas.height - y - 80 * scale) / Math.max(rows.length, 1));
  rows.forEach((row, index) => {
    const rowY = y + rowHeight * index;
    context.fillStyle = rowColor(row, index);
    context.fillRect(x, rowY - 17 * scale, 22 * scale, 22 * scale);
    context.fillStyle = chart.textColor;
    context.textAlign = "left";
    setFont(Math.max(13, 19 * scale), 650);
    fitText(row.label, x + 34 * scale, rowY, width * .62);
    context.textAlign = "right";
    setFont(Math.max(13, 18 * scale), 500);
    context.fillText(`${((row.value / total) * 100).toFixed(1).replace(".", ",")}%`, x + width, rowY);
  });
}

function drawSource(scale) {
  if (!chart.source) return;
  context.fillStyle = chart.textColor;
  context.globalAlpha = .72;
  context.textAlign = "right";
  setFont(Math.max(12, 16 * scale), 400);
  context.fillText(`Fonte: ${chart.source}`, canvas.width - 48 * scale, canvas.height - 26 * scale);
  context.globalAlpha = 1;
}

function roundedRect(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function registerWebMcpTools() {
  const modelContext = document.modelContext;
  if (!modelContext?.registerTool) return;
  const register = tool => Promise.resolve(modelContext.registerTool(tool)).catch(() => {});

  register({
    name: "read_chart_configuration",
    title: "Ler configuracao do grafico",
    description: "Retorna o tipo, os textos, as cores e os dados visiveis no editor.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute() {
      return clone(chart);
    }
  });

  register({
    name: "replace_chart_data",
    title: "Substituir dados do grafico",
    description: "Substitui todos os rotulos e valores do grafico e atualiza a previa.",
    inputSchema: {
      type: "object",
      properties: {
        rows: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            properties: { label: { type: "string" }, value: { type: "number" }, color: { type: "string" } },
            required: ["label", "value"],
            additionalProperties: false
          }
        }
      },
      required: ["rows"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute(input) {
      if (!input || !Array.isArray(input.rows) || !input.rows.length) throw new Error("Informe pelo menos um dado.");
      chart.rows = input.rows.map(row => ({ label: String(row.label), value: parseNumber(row.value), color: row.color || "" }));
      renderRows();
      queueDraw();
      return { updated: true, count: chart.rows.length };
    }
  });
}

bindControls();
renderRows();
queueDraw();
window.addEventListener("load", queueDraw, { once: true });
registerWebMcpTools();
