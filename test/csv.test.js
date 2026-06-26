import { describe, it, expect } from "vitest";
import { parseCsv, csvToObjects } from "../src/lib/csv.js";

// The parser is hand-rolled (no CSV dependency), so prove the RFC-4180 edge
// cases that a naive split(",") would get wrong.
describe("parseCsv (RFC-4180 edge cases)", () => {
  it("parses simple rows", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("keeps commas inside quoted fields", () => {
    expect(parseCsv('sku,name\nX1,"Formal Pret, Heavy"')).toEqual([
      ["sku", "name"],
      ["X1", "Formal Pret, Heavy"],
    ]);
  });

  it("unescapes doubled quotes inside a quoted field", () => {
    expect(parseCsv('a\n"He said ""hi"""')).toEqual([["a"], ['He said "hi"']]);
  });

  it("keeps newlines inside quoted fields", () => {
    expect(parseCsv('a,b\n"line1\nline2",y')).toEqual([
      ["a", "b"],
      ["line1\nline2", "y"],
    ]);
  });

  it("handles CRLF and a trailing newline", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("csvToObjects", () => {
  it("maps trimmed header → trimmed cells and drops blank lines", () => {
    const text = "sku, template ,garmentType\n A1 ,Lawn,two_piece\n\nA2,Lawn,one_piece\n";
    const { header, records } = csvToObjects(text);
    expect(header).toEqual(["sku", "template", "garmentType"]);
    expect(records).toEqual([
      { sku: "A1", template: "Lawn", garmentType: "two_piece" },
      { sku: "A2", template: "Lawn", garmentType: "one_piece" },
    ]);
  });
});
