import { describe, expect, it } from "vitest";
import * as CFB from "cfb";
import * as XLSX from "xlsx";
import { seedMasterData, type MasterDataState } from "./accessControl";
import {
  buildMasterDataWorkbook,
  buildMasterDataWorkbookBytes,
  generateMasterId,
  parseMasterDataWorkbook,
  validateMasterData
} from "./masterData";

function cloneSeed(): MasterDataState {
  return structuredClone(seedMasterData);
}

function workbookFile(workbook: XLSX.WorkBook, name = "master-data.xlsx") {
  const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return new File([bytes], name);
}

describe("master data validation", () => {
  it("accepts the complete seeded database", () => {
    expect(validateMasterData(cloneSeed())).toHaveLength(0);
  });

  it("rejects case-insensitive duplicate business keys and IDs", () => {
    const masterData = cloneSeed();
    masterData.suppliers.push({ ...masterData.suppliers[0], name: masterData.suppliers[0].name.toUpperCase() });

    const issues = validateMasterData(masterData);
    expect(issues.some((issue) => issue.sheet === "Suppliers" && issue.message === "Duplicate name")).toBe(true);
    expect(issues.some((issue) => issue.sheet === "Suppliers" && issue.message === "Duplicate ID")).toBe(true);
  });

  it("rejects active taxonomy entries linked to inactive categories or process routes", () => {
    const categoryData = cloneSeed();
    const level2 = categoryData.defectLevel2.find((row) => row.status === "Active")!;
    categoryData.defectLevel1.find((row) => row.id === level2.level1Id)!.status = "Inactive";
    expect(validateMasterData(categoryData).some((issue) => issue.message.includes("active category"))).toBe(true);

    const processData = cloneSeed();
    const processLevel2 = processData.defectLevel2.find((row) => row.status === "Active" && row.processIds.length)!;
    processData.processRoutes.find((row) => row.id === processLevel2.processIds[0])!.status = "Inactive";
    expect(validateMasterData(processData).some((issue) => issue.message.includes("not an active process route"))).toBe(true);
  });

  it("generates a collision-safe prefixed ID", () => {
    const masterData = cloneSeed();
    const first = generateMasterId("suppliers", masterData);
    masterData.suppliers.push({ id: first, name: "New supplier", country: "Malaysia", status: "Active" });
    const second = generateMasterId("suppliers", masterData);

    expect(first).toMatch(/^SUP-\d+$/);
    expect(second).not.toBe(first);
  });
});

describe("master data workbook", () => {
  it("round trips the seeded workbook without changes", async () => {
    const masterData = cloneSeed();
    const workbook = await buildMasterDataWorkbook(masterData);
    const preview = await parseMasterDataWorkbook(workbookFile(workbook), masterData);

    expect(preview.issues).toHaveLength(0);
    expect(preview.additions).toBe(0);
    expect(preview.updates).toBe(0);
    expect(preview.unchanged).toBe(Object.values(masterData).reduce((total, rows) => total + rows.length, 0));
    expect(preview.next).toEqual(masterData);
  });

  it("previews recognized updates and collision-safe blank-ID additions", async () => {
    const masterData = cloneSeed();
    const workbook = await buildMasterDataWorkbook(masterData);
    const supplierRows = XLSX.utils.sheet_to_json<Record<string, string>>(workbook.Sheets.Suppliers, { defval: "" });
    supplierRows[0].Country = "Singapore";
    supplierRows.push({ ID: "", Name: "Meridian Materials", Country: "Malaysia", Status: "Active" });
    workbook.Sheets.Suppliers = XLSX.utils.json_to_sheet(supplierRows);

    const preview = await parseMasterDataWorkbook(workbookFile(workbook), masterData);
    const added = preview.next.suppliers.find((row) => row.name === "Meridian Materials")!;

    expect(preview.issues).toHaveLength(0);
    expect(preview.updates).toBe(1);
    expect(preview.additions).toBe(1);
    expect(added.id).toMatch(/^SUP-\d+$/);
    expect(masterData.suppliers.some((row) => row.id === added.id)).toBe(false);
  });

  it("rejects unknown nonblank IDs and missing required sheets", async () => {
    const masterData = cloneSeed();
    const unknownWorkbook = await buildMasterDataWorkbook(masterData);
    const supplierRows = XLSX.utils.sheet_to_json<Record<string, string>>(unknownWorkbook.Sheets.Suppliers, { defval: "" });
    supplierRows.push({ ID: "SUP-UNKNOWN", Name: "Unknown Supplier", Country: "Malaysia", Status: "Active" });
    unknownWorkbook.Sheets.Suppliers = XLSX.utils.json_to_sheet(supplierRows);
    const unknownPreview = await parseMasterDataWorkbook(workbookFile(unknownWorkbook), masterData);
    expect(unknownPreview.issues.some((issue) => issue.message.includes("Unknown ID SUP-UNKNOWN"))).toBe(true);

    const missingWorkbook = await buildMasterDataWorkbook(masterData);
    delete missingWorkbook.Sheets["Defect Level 2"];
    missingWorkbook.SheetNames = missingWorkbook.SheetNames.filter((name) => name !== "Defect Level 2");
    const missingPreview = await parseMasterDataWorkbook(workbookFile(missingWorkbook), masterData);
    expect(missingPreview.issues.some((issue) => issue.sheet === "Defect Level 2" && issue.message === "Required sheet is missing")).toBe(true);
  });

  it("embeds native dropdown validation in the exported XLSX", async () => {
    const bytes = await buildMasterDataWorkbookBytes(cloneSeed());
    const zip = CFB.read(bytes, { type: "array" });
    const partsSheet = CFB.find(zip, "Root Entry/xl/worksheets/sheet3.xml");
    const xml = new TextDecoder().decode(partsSheet?.content as Uint8Array);

    expect(xml).toContain("<dataValidations");
    expect(xml).toContain("<formula1>MasterPartType</formula1>");
    expect(xml).toContain("<formula1>MasterOperation</formula1>");
    expect(xml).toContain("<formula1>MasterStatus</formula1>");
  });
});
