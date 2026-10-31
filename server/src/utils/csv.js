/** Escape a CSV cell and guard spreadsheet applications against formula injection. */
export function csvCell(value) {
  if (value === null || value === undefined) return '""';
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (typeof value === "string" && /^[\s]*[=+@\-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(headers, rows) {
  const lines = [headers.map((item) => csvCell(item.label)).join(",")];
  for (const row of rows) {
    lines.push(headers.map((item) => csvCell(typeof item.value === "function" ? item.value(row) : row[item.value])).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

export function sendCsv(response, filename, csvText) {
  response.setHeader("Content-Type", "text/csv; charset=utf-8");
  response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  response.setHeader("Cache-Control", "no-store");
  return response.status(200).send(`\uFEFF${csvText}`);
}

export function median(values = []) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}
