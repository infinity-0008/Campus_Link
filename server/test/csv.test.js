import { describe, expect, it } from "vitest";
import { csvCell, median, toCsv } from "../src/utils/csv.js";

describe("CSV utilities", () => {
  it("quotes and escapes embedded quotes", () => {
    expect(csvCell('Campus "North"')).toBe('"Campus ""North"""');
  });

  it("neutralizes spreadsheet formula prefixes", () => {
    expect(csvCell("=HYPERLINK(\"https://bad.example\")")).toBe('"\'=HYPERLINK(""https://bad.example"")"');
  });

  it("calculates odd and even medians", () => {
    expect(median([9, 1, 5])).toBe(5);
    expect(median([8, 2, 4, 6])).toBe(5);
    expect(median([])).toBeNull();
  });

  it("writes a header and rows", () => {
    expect(toCsv([{ label: "Name", value: "name" }], [{ name: "Abhay" }])).toBe('"Name"\r\n"Abhay"\r\n');
  });
});
