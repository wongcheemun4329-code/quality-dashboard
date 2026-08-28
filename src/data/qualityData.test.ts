import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import * as CFB from "cfb";
import { seedMasterData } from "./accessControl";
import {
  buildQualityWorkbook,
  buildQualityHeaderWorkbook,
  buildQualityManualWorkbook,
  buildQualityTemplateBytes,
  buildValidationLists,
  cascadeStageFilters,
  aggregateComplaintRejectCategoryLevel2Matrix,
  aggregateComplaintTrendData,
  aggregateCustomerComplaintPerformance,
  aggregatePartTypeTrendData,
  aggregateRejectCategoryLevel2Matrix,
  aggregatePartContributions,
  aggregateTrendData,
  calculateMetrics,
  calculateComplaintMetrics,
  groupComplaintRecords,
  groupComplaintRejectCategories,
  defaultFilters,
  filterInspections,
  filterComplaints,
  getDateRange,
  getTrendGranularity,
  getTrendXAxisInterval,
  getTrendYAxisDomain,
  getPartTypeTrendYAxisDomain,
  getPriorDateRange,
  loadStoredDataset,
  deriveRejectCategoryLevel1,
  deriveRejectCategoryLevel2,
  groupRejectCategories,
  groupRejectCategoryLevel2,
  rejectCategoryLevel2Key,
  parseQualityWorkbook,
  sampleDataset,
  STORAGE_KEY,
  type InspectionRecord
} from "./qualityData";

describe("quality calculations", () => {
  it("aggregates NPI and Production contribution across inspections and complaints", () => {
    const npi = { ...sampleDataset.inspections[0], partNumber: "NPI-1", partName: "NPI sample", partType: "NPI" as const, inspectedQty: 100, firstPassGoodQty: 90, reworkQty: 6, scrapQty: 4, scrapCost: 400, reworkCost: 120 };
    const production = { ...sampleDataset.inspections[1], partNumber: "PROD-1", partName: "Production sample", partType: "Production" as const, inspectedQty: 200, firstPassGoodQty: 190, reworkQty: 7, scrapQty: 3, scrapCost: 300, reworkCost: 90 };
    const complaint = { ...sampleDataset.complaints[0], partNumber: "NPI-1", partType: "NPI" as const, affectedQty: 5, externalFailureCost: 800 };
    const result = aggregatePartContributions([npi, production], [complaint]);
    expect(result.groups.find((group) => group.partType === "NPI")).toMatchObject({ inspectedQty: 100, rejectedQty: 10, failureCost: 1320, complaintAffectedQty: 5, complaintCases: 1 });
    expect(result.groups.find((group) => group.partType === "Production")).toMatchObject({ inspectedQty: 200, rejectedQty: 10, failureCost: 390 });
    expect(result.groups.find((group) => group.partType === "NPI")?.rejectedShare).toBe(50);
    expect(result.parts[0]).toMatchObject({ partNumber: "NPI-1", partType: "NPI", failureCost: 1320 });
  });

  it("builds a header-only workbook for all import sheets", async () => {
    const workbook = await buildQualityHeaderWorkbook();
    expect(workbook.SheetNames).toEqual(["Inspections", "Complaints", "Deliveries", "Targets", "Validation Lists"]);
    expect(workbook.Sheets.Inspections["A1"].v).toBe("ID");
    expect(workbook.Sheets.Inspections["B1"].v).toBe("Date");
    expect(workbook.Sheets.Complaints["A1"].v).toBe("ID");
    expect(workbook.Sheets.Targets["A1"].v).toBe("Operation");
    expect(workbook.Sheets.Deliveries["D1"].v).toBe("Customer");
    expect(workbook.Sheets.Deliveries["E1"].v).toBe("Delivered Qty");
    expect(workbook.Sheets.Inspections["A2"]).toBeUndefined();
    expect(workbook.Sheets.Inspections["L1"].v).toBe("Part Type");
    expect(workbook.Sheets.Complaints["G1"].v).toBe("Part Type");
    expect(workbook.Sheets.Complaints["H1"].v).toBe("Reject Category Level 1");
    expect(workbook.Sheets.Complaints["I1"].v).toBe("Reject Category Level 2");
    expect(workbook.Sheets.Complaints["M1"].v).toBe("External Scrap Cost");
    expect(workbook.Sheets.Complaints["N1"].v).toBe("External Rework Cost");
    expect(workbook.Workbook?.Names?.some((name) => name.Name === "QualityPartType" && name.Ref.includes("Validation Lists"))).toBe(true);
  });

  it("generates customer-level delivery rows in the bundled dataset", () => {
    expect(sampleDataset.deliveries).toHaveLength(12 * 2 * 5);
    expect(new Set(sampleDataset.deliveries.map((row) => row.customer))).toEqual(new Set(["Northstar Robotics", "Helix Automation", "Veridian Medical", "Axiom Energy", "Orion Mobility"]));
  });

  it("generates complaint records with shared Level 1 and Level 2 categories", () => {
    expect(sampleDataset.complaints.length).toBeGreaterThan(0);
    expect(sampleDataset.complaints.every((row) => row.rejectCategoryLevel1 && row.rejectCategoryLevel2)).toBe(true);
    expect(sampleDataset.complaints.every((row) => row.rejectCategoryLevel1 === deriveRejectCategoryLevel1(row.defectCategory))).toBe(true);
    expect(sampleDataset.complaints.every((row) => row.externalScrapCost + row.externalReworkCost === row.externalFailureCost)).toBe(true);
    expect(sampleDataset.complaints.some((row) => row.externalScrapCost > 0 && row.externalReworkCost > 0)).toBe(true);
  });

  it("migrates stored complaint cost components without changing external failure totals", () => {
    const bundled = sampleDataset.complaints[0];
    const { externalScrapCost: _scrap, externalReworkCost: _rework, ...legacyBundled } = bundled;
    const arbitrary = { ...legacyBundled, id: "LEGACY-COMPLAINT", externalFailureCost: 777 };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...sampleDataset, complaints: [legacyBundled, arbitrary] }));
    const loaded = loadStoredDataset();
    expect(loaded.complaints[0]).toMatchObject({ externalFailureCost: bundled.externalFailureCost, externalScrapCost: bundled.externalScrapCost, externalReworkCost: bundled.externalReworkCost });
    expect(loaded.complaints[1]).toMatchObject({ externalFailureCost: 777, externalScrapCost: 777, externalReworkCost: 0 });
    localStorage.removeItem(STORAGE_KEY);
  });

  it("adds native dropdown validation to XLSX header templates", async () => {
    const workbook = await buildQualityHeaderWorkbook(sampleDataset);
    const bytes = await buildQualityTemplateBytes(workbook);
    expect(XLSX.read(bytes, { type: "array" }).SheetNames).toContain("Inspections");
    const zip = CFB.read(bytes, { type: "array" });
    const sheet = CFB.find(zip, "Root Entry/xl/worksheets/sheet1.xml");
    const xml = new TextDecoder().decode(sheet?.content as Uint8Array);
    expect(xml).toContain("<dataValidations count=\"15\">");
    expect(xml).toContain("sqref=\"L2:L1000\"");
    expect(xml).toContain("<formula1>QualityPartType</formula1>");
    const deliverySheet = CFB.find(zip, "Root Entry/xl/worksheets/sheet3.xml");
    const deliveryXml = new TextDecoder().decode(deliverySheet?.content as Uint8Array);
    expect(deliveryXml).toContain("<formula1>QualityCustomer</formula1>");
    const complaintSheet = CFB.find(zip, "Root Entry/xl/worksheets/sheet2.xml");
    const complaintXml = new TextDecoder().decode(complaintSheet?.content as Uint8Array);
    expect(complaintXml).toContain("sqref=\"H2:H1000\"");
    expect(complaintXml).toContain("<formula1>QualityRejectCategoryLevel1</formula1>");
    expect(complaintXml).toContain("sqref=\"I2:I1000\"");
    expect(complaintXml).toContain("<formula1>QualityRejectCategoryLevel2</formula1>");
  });

  it("pre-populates the manual template with Level 1 and Level 2 reference rows", async () => {
    const workbook = await buildQualityManualWorkbook(sampleDataset);
    const inspectionRows = XLSX.utils.sheet_to_json<Record<string, string>>(workbook.Sheets.Inspections, { defval: "" });
    const referenceRows = XLSX.utils.sheet_to_json<Record<string, string>>(workbook.Sheets["Reference Lists"], { defval: "" });
    expect(inspectionRows.length).toBeGreaterThan(20);
    expect(inspectionRows.some((row) => row["Reject Category Level 1"] === "Drawing/specification nonconformance" && row["Reject Category Level 2"] === "Wrong bend angle")).toBe(true);
    expect(referenceRows.some((row) => row["Reference Type"] === "Reject category Level 1" && row.Value === "Other")).toBe(true);
    expect(referenceRows.some((row) => row["Reference Type"] === "Reject category Level 2" && row["Level 1"])).toBe(true);
  });
  it("cascades stage selections through compatible filters", () => {
    const filters = { ...defaultFilters, process: "Welding", workCenter: "Weld Bay", supplier: "Apex Metals" };
    expect(cascadeStageFilters(sampleDataset.inspections, "all", filters, "incoming")).toMatchObject({ stage: "incoming", process: "all", workCenter: "all", supplier: "Apex Metals" });
    expect(cascadeStageFilters(sampleDataset.inspections, "all", filters, "in-process")).toMatchObject({ stage: "in-process", supplier: "all" });
    expect(cascadeStageFilters(sampleDataset.inspections, "all", filters, "outgoing")).toMatchObject({ stage: "outgoing", supplier: "all" });
    expect(cascadeStageFilters(sampleDataset.inspections, "all", filters, "customer-complaint")).toMatchObject({ stage: "customer-complaint", process: "all", workCenter: "all", supplier: "all" });
    expect(cascadeStageFilters(sampleDataset.inspections, "all", filters, "all")).toMatchObject({ stage: "all", process: "all", workCenter: "all", supplier: "all" });
  });
  it("calculates all KPI formulas from normalized quantities", () => {
    const row = { ...sampleDataset.inspections[0], inspectedQty: 100, firstPassGoodQty: 92, reworkQty: 5, scrapQty: 3, scrapCost: 300, reworkCost: 100, inspectionCompletedDate: "2026-08-20" };
    const metrics = calculateMetrics([row], [{ ...sampleDataset.complaints[0], externalFailureCost: 600 }]);
    expect(metrics.fpy).toBe(92);
    expect(metrics.rejectPpm).toBe(80_000);
    expect(metrics.scrapRate).toBe(3);
    expect(metrics.copq).toBe(1_000);
    expect(metrics.rejectionCost).toBe(400);
    expect(metrics.inspectionCompletion).toBe(100);
    expect(metrics.complaintCount).toBe(1);
    expect(metrics.complaintAffectedQty).toBe(sampleDataset.complaints[0].affectedQty);
  });

  it("supports independent stage KPI aggregation and complaint cost context", () => {
    const rows = sampleDataset.inspections.slice(0, 3).map((row, index) => ({
      ...row,
      stage: (["incoming", "in-process", "outgoing"] as const)[index],
      inspectedQty: 100,
      firstPassGoodQty: 95,
      reworkQty: 3,
      scrapQty: 2,
      scrapCost: 50,
      reworkCost: 25
    }));
    const incoming = calculateMetrics(rows.filter((row) => row.stage === "incoming"), []);
    const ipqa = calculateMetrics(rows.filter((row) => row.stage === "in-process"), []);
    const oqa = calculateMetrics(rows.filter((row) => row.stage === "outgoing"), []);
    expect(incoming.fpy).toBe(95);
    expect(ipqa.rejectPpm).toBe(50_000);
    expect(oqa.rejectionCost).toBe(75);

    const complaint = { ...sampleDataset.complaints[0], affectedQty: 7, externalFailureCost: 1_250 };
    const complaintMetrics = calculateMetrics([], [complaint]);
    expect(complaintMetrics.fpy).toBeNull();
    expect(complaintMetrics.rejectPpm).toBeNull();
    expect(complaintMetrics.complaintAffectedQty).toBe(7);
    expect(complaintMetrics.copq).toBe(1_250);
  });

  it("calculates complaint scorecard metrics from delivered quantity", () => {
    const complaint = { ...sampleDataset.complaints[0], affectedQty: 18, externalFailureCost: 1200 };
    const result = calculateComplaintMetrics([complaint], [{ id: "DEL-1", month: "2026-08", operation: complaint.operation, deliveredQty: 12000 }]);
    expect(result.fpy).toBeCloseTo(99.85, 2);
    expect(result.rejectPpm).toBe(1500);
    expect(result.rejectionCost).toBe(1200);
    expect(result.deliveredQty).toBe(12000);
    expect(calculateComplaintMetrics([complaint], []).fpy).toBeNull();
    expect(calculateComplaintMetrics([complaint], []).rejectPpm).toBeNull();
  });

  it("aggregates complaint trend rates from delivered quantities", () => {
    const complaint = { ...sampleDataset.complaints[0], complaintDate: "2026-08-18", affectedQty: 12, externalFailureCost: 1200 };
    const filters = { ...defaultFilters, preset: "7d" as const };
    const trend = aggregateComplaintTrendData([complaint], [{ id: "DEL-1", month: "2026-08", operation: complaint.operation, deliveredQty: 12000 }], "all", filters);
    const august = trend.find((point) => point.key === "2026-08");
    expect(august?.fpy).toBe(99.9);
    expect(august?.rejectPpm).toBe(1000);
    expect(august?.external).toBe(1200);
    expect(august?.rollingQppm).toBe(1000);
  });

  it("aggregates NPI and Production quantities with an FPY line by period", () => {
    const npi = { ...sampleDataset.inspections[0], date: "2026-08-18", partType: "NPI" as const, inspectedQty: 100, firstPassGoodQty: 92, reworkQty: 5, scrapQty: 3 };
    const production = { ...sampleDataset.inspections[1], date: "2026-08-18", partType: "Production" as const, inspectedQty: 200, firstPassGoodQty: 190, reworkQty: 7, scrapQty: 3 };
    const filters = { ...defaultFilters, preset: "7d" as const };
    const trend = aggregatePartTypeTrendData([npi, production], [], [], filters);
    const august = trend.find((point) => point.key === "2026-08-18");
    expect(august).toMatchObject({ npiQuantity: 8, productionQuantity: 10, totalQuantity: 18, fpy: 94 });
    expect(getPartTypeTrendYAxisDomain(trend)).toEqual([0, 30]);
  });

  it("uses complaint affected quantity for the part-type trend", () => {
    const npi = { ...sampleDataset.complaints[0], complaintDate: "2026-08-18", partType: "NPI" as const, affectedQty: 12 };
    const production = { ...sampleDataset.complaints[1], complaintDate: "2026-08-18", partType: "Production" as const, affectedQty: 8 };
    const filters = { ...defaultFilters, preset: "7d" as const, stage: "customer-complaint" as const };
    const trend = aggregatePartTypeTrendData([], [npi, production], [{ id: "DEL-1", month: "2026-08", operation: npi.operation, deliveredQty: 1000 }], filters);
    const august = trend.find((point) => point.key === "2026-08");
    expect(august).toMatchObject({ npiQuantity: 12, productionQuantity: 8, totalQuantity: 20, fpy: 98 });
  });

  it("keeps complaint trend rates unavailable without deliveries", () => {
    const complaint = { ...sampleDataset.complaints[0], complaintDate: "2026-08-18", affectedQty: 12, externalFailureCost: 1200 };
    const trend = aggregateComplaintTrendData([complaint], [], "all", { ...defaultFilters, preset: "7d" as const });
    const august = trend.find((point) => point.key === "2026-08");
    expect(august?.fpy).toBeNull();
    expect(august?.rejectPpm).toBeNull();
    expect(august?.external).toBe(1200);
  });

  it("groups complaint analysis by affected quantity with case and cost context", () => {
    const first = { ...sampleDataset.complaints[0], process: "Laser Cutting", affectedQty: 12, externalFailureCost: 800 };
    const second = { ...sampleDataset.complaints[1], process: "Laser Cutting", affectedQty: 5, externalFailureCost: 300 };
    const groups = groupComplaintRecords([first, second], "process");
    expect(groups[0]).toMatchObject({ name: "Laser Cutting", affectedQty: 17, cases: 2, externalFailureCost: 1100 });
  });

  it("compares each customer's complaint quantity with delivered quantity", () => {
    const first = { ...sampleDataset.complaints[0], customer: "Customer A", complaintDate: "2026-08-18", affectedQty: 12 };
    const second = { ...sampleDataset.complaints[1], customer: "Customer A", complaintDate: "2026-08-19", affectedQty: 8 };
    const result = aggregateCustomerComplaintPerformance(
      [first, second],
      [{ id: "DEL-1", month: "2026-08", operation: first.operation, deliveredQty: 1000 }],
      "all",
      { start: "2026-08-01", end: "2026-08-31" }
    );
    expect(result[0]).toMatchObject({ name: "Customer A", affectedQty: 20, deliveredQty: 1000, complaintPpm: 20_000 });
  });

  it("uses the matching customer's delivery denominator", () => {
    const complaintA = { ...sampleDataset.complaints[0], customer: "Customer A", complaintDate: "2026-08-18", affectedQty: 10 };
    const complaintB = { ...sampleDataset.complaints[1], customer: "Customer B", complaintDate: "2026-08-19", affectedQty: 10 };
    const result = aggregateCustomerComplaintPerformance(
      [complaintA, complaintB],
      [
        { id: "DEL-A", month: "2026-08", operation: complaintA.operation, customer: "Customer A", deliveredQty: 1000 },
        { id: "DEL-B", month: "2026-08", operation: complaintB.operation, customer: "Customer B", deliveredQty: 2000 }
      ],
      "all",
      { start: "2026-08-01", end: "2026-08-31" }
    );
    expect(result.find((row) => row.name === "Customer A")).toMatchObject({ deliveredQty: 1000, complaintPpm: 10_000 });
    expect(result.find((row) => row.name === "Customer B")).toMatchObject({ deliveredQty: 2000, complaintPpm: 5_000 });
  });

  it("leaves customer complaint PPM unavailable without delivered quantity", () => {
    const complaint = { ...sampleDataset.complaints[0], customer: "Customer A", complaintDate: "2026-08-18", affectedQty: 12 };
    const result = aggregateCustomerComplaintPerformance([complaint], [], "all", { start: "2026-08-01", end: "2026-08-31" });
    expect(result[0]?.complaintPpm).toBeNull();
  });

  it("groups incoming Level 1 reject categories into the top six", () => {
    const level1Categories = [
      "Drawing/specification nonconformance",
      "Cosmetic / appearance",
      "Material / component",
      "Functional / performance",
      "Process / workmanship",
      "Missing / incorrect part",
      "Other"
    ] as const;
    const rows = Array.from({ length: 7 }, (_, index) => ({
      ...sampleDataset.inspections[0],
      rejectCategoryLevel1: level1Categories[index],
      reworkQty: index + 1,
      scrapQty: index + 1
    }));
    const categories = groupRejectCategories(rows);
    expect(categories).toHaveLength(6);
    expect(categories[0]).toEqual({ name: "Other", value: 14 });
    expect(categories[5]).toEqual({ name: "Cosmetic / appearance", value: 4 });
  });

  it("respects operation and incoming-stage scope before grouping categories", () => {
    const rows = [
      { ...sampleDataset.inspections[0], operation: "sheet-metal" as const, stage: "incoming" as const, rejectCategoryLevel1: "Cosmetic / appearance" as const, defectCategory: "Sheet defect", reworkQty: 8, scrapQty: 2 },
      { ...sampleDataset.inspections[1], operation: "precision-machining" as const, stage: "incoming" as const, rejectCategoryLevel1: "Functional / performance" as const, defectCategory: "Machining defect", reworkQty: 7, scrapQty: 3 },
      { ...sampleDataset.inspections[2], operation: "sheet-metal" as const, stage: "in-process" as const, rejectCategoryLevel1: "Process / workmanship" as const, defectCategory: "Process defect", reworkQty: 99, scrapQty: 99 }
    ];
    const sheetIncoming = filterInspections(rows, "sheet-metal", { ...defaultFilters, stage: "incoming" });
    const machiningIncoming = filterInspections(rows, "precision-machining", { ...defaultFilters, stage: "incoming" });
    expect(groupRejectCategories(sheetIncoming)).toEqual([{ name: "Cosmetic / appearance", value: 10 }]);
    expect(groupRejectCategories(machiningIncoming)).toEqual([{ name: "Functional / performance", value: 10 }]);
  });

  it("returns no Level 1 categories for empty input", () => {
    expect(groupRejectCategories([])).toEqual([]);
  });

  it("maps detailed defects to universal Level 1 families and process-specific Level 2 examples", () => {
    expect(sampleDataset.inspections[0].rejectCategoryLevel1).toBe("Drawing/specification nonconformance");
    expect(deriveRejectCategoryLevel1("Coating defect")).toBe("Cosmetic / appearance");
    expect(deriveRejectCategoryLevel1("Unknown defect")).toBe("Other");
    expect(deriveRejectCategoryLevel2("Laser Cutting", "Burr / sharp edge")).toBe("Burr / dross");
    expect(deriveRejectCategoryLevel2("MIG/TIG Welding", "Weld porosity")).toBe("Porosity");
    expect(deriveRejectCategoryLevel2("CNC Milling", "Thread failure")).toBe("Hole / thread defect");
  });

  it("groups identical Level 2 reasons across processes into one Pareto bar", () => {
    const rows = [
      { ...sampleDataset.inspections[0], process: "Laser Cutting", rejectCategoryLevel2: "Burr / dross", reworkQty: 4, scrapQty: 2 },
      { ...sampleDataset.inspections[1], process: "CNC Milling", rejectCategoryLevel2: "Burr / dross", reworkQty: 3, scrapQty: 1 },
      { ...sampleDataset.inspections[2], process: "Press Brake", rejectCategoryLevel2: "Wrong bend angle", reworkQty: 1, scrapQty: 1 }
    ];
    expect(groupRejectCategoryLevel2(rows, 10)).toEqual([
      { key: "Burr / dross", name: "Burr / dross", reason: "Burr / dross", value: 10 },
      { key: "Wrong bend angle", name: "Wrong bend angle", reason: "Wrong bend angle", value: 2 }
    ]);
    expect(rejectCategoryLevel2Key("Burr / dross")).toBe("Burr / dross");
  });

  it("filters complaints by the recorded process", () => {
    const process = sampleDataset.complaints[0].process;
    const result = filterComplaints(sampleDataset.complaints, "all", { start: "2025-09-01", end: "2026-08-21" }, { customer: "all", partNumber: "all", defectCategory: "all", process });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((row) => row.process === process)).toBe(true);
  });

  it("returns unavailable rates for zero denominators", () => {
    const metrics = calculateMetrics([], []);
    expect(metrics.fpy).toBeNull();
    expect(metrics.rejectPpm).toBeNull();
    expect(metrics.scrapRate).toBeNull();
    expect(metrics.inspectionCompletion).toBeNull();
  });

  it("uses deterministic current and non-overlapping prior ranges", () => {
    expect(getDateRange("3m")).toEqual({ start: "2026-06-01", end: "2026-08-21" });
    const prior = getPriorDateRange("3m");
    expect(prior.end).toBe("2026-05-31");
    expect(prior.start < prior.end).toBe(true);
  });

  it("supports calendar year and quarter presets", () => {
    expect(getDateRange("year")).toEqual({ start: "2026-01-01", end: "2026-08-21" });
    expect(getDateRange("q1")).toEqual({ start: "2026-01-01", end: "2026-03-31" });
    expect(getDateRange("q3")).toEqual({ start: "2026-07-01", end: "2026-08-21" });
    expect(getDateRange("q4")).toEqual({ start: "2026-10-01", end: "2026-08-21" });
  });

  it("supports last-seven-days and ISO week ranges capped at the dataset end", () => {
    expect(getDateRange("7d")).toEqual({ start: "2026-08-15", end: "2026-08-21" });
    expect(getDateRange({ ...defaultFilters, periodMode: "week-range", weekFrom: "2026-W34", weekTo: "2026-W34" })).toEqual({ start: "2026-08-17", end: "2026-08-21" });
    expect(getDateRange({ ...defaultFilters, periodMode: "day-range", dayFrom: "2026-08-19", dayTo: "2026-08-20" })).toEqual({ start: "2026-08-19", end: "2026-08-20" });
    expect(getDateRange({ ...defaultFilters, periodMode: "month-range", monthFrom: "2026-04", monthTo: "2026-06" })).toEqual({ start: "2026-04-01", end: "2026-06-30" });
  });

  it("supports custom year and quarter ranges with dataset-end capping", () => {
    expect(getDateRange({ ...defaultFilters, periodMode: "year-range", yearFrom: 2025, yearTo: 2026 })).toEqual({ start: "2025-01-01", end: "2026-08-21" });
    expect(getDateRange({ ...defaultFilters, periodMode: "year-range", yearFrom: 2026, yearTo: 2026 })).toEqual({ start: "2026-01-01", end: "2026-08-21" });
    expect(getDateRange({ ...defaultFilters, periodMode: "quarter-range", quarterFrom: "2025-Q2", quarterTo: "2026-Q3" })).toEqual({ start: "2025-04-01", end: "2026-08-21" });
    expect(getDateRange({ ...defaultFilters, periodMode: "quarter-range", quarterFrom: "2026-Q2", quarterTo: "2026-Q2" })).toEqual({ start: "2026-04-01", end: "2026-06-30" });
  });

  it("calculates equivalent prior ranges for custom periods", () => {
    const priorYear = getPriorDateRange({ ...defaultFilters, periodMode: "year-range", yearFrom: 2025, yearTo: 2026 });
    expect(priorYear.end).toBe("2024-12-31");
    const priorQuarter = getPriorDateRange({ ...defaultFilters, periodMode: "quarter-range", quarterFrom: "2026-Q2", quarterTo: "2026-Q2" });
    expect(priorQuarter).toEqual({ start: "2025-12-31", end: "2026-03-31" });
  });

  it("aggregates trend data at the selected year and quarter granularity", () => {
    const rows = sampleDataset.inspections.slice(0, 2).map((row, index) => ({
      ...row,
      date: index === 0 ? "2025-01-15" : "2026-07-15",
      inspectedQty: index === 0 ? 100 : 300,
      firstPassGoodQty: index === 0 ? 50 : 300,
      reworkQty: index === 0 ? 40 : 0,
      scrapQty: index === 0 ? 10 : 0,
      scrapCost: index === 0 ? 100 : 20,
      reworkCost: index === 0 ? 50 : 10
    }));
    const yearFilters = { ...defaultFilters, periodMode: "year-range" as const, yearFrom: 2025, yearTo: 2026 };
    const yearData = aggregateTrendData(rows, [], yearFilters);
    expect(yearData.map((point) => point.label)).toEqual(["2025", "2026"]);
    expect(yearData[0].fpy).toBe(50);
    expect(yearData[0].rejectPpm).toBe(500_000);
    expect(yearData[1].fpy).toBe(100);
    expect(yearData[1].rejectPpm).toBe(0);

    const quarterFilters = { ...defaultFilters, periodMode: "quarter-range" as const, quarterFrom: "2025-Q1" as const, quarterTo: "2026-Q3" as const };
    const quarterData = aggregateTrendData(rows, [], quarterFilters);
    expect(quarterData.map((point) => point.label)).toEqual(["Q1 2025", "Q2 2025", "Q3 2025", "Q4 2025", "Q1 2026", "Q2 2026", "Q3 2026"]);
    expect(quarterData[1].fpy).toBeNull();
    expect(quarterData[6].scrapCost).toBe(20);
    expect(quarterData[6].reworkCost).toBe(10);
    expect(quarterData[6].internal).toBe(30);
  });

  it("maps period filters to day, week, month, and year trend buckets", () => {
    expect(getTrendGranularity({ ...defaultFilters, preset: "7d" })).toBe("day");
    expect(getTrendGranularity({ ...defaultFilters, periodMode: "week-range" })).toBe("week");
    expect(getTrendGranularity({ ...defaultFilters, preset: "12m" })).toBe("month");
    expect(getTrendGranularity({ ...defaultFilters, periodMode: "quarter-range" })).toBe("quarter");
    expect(getTrendGranularity({ ...defaultFilters, periodMode: "year-range" })).toBe("year");
    expect(getTrendGranularity({ ...defaultFilters, periodMode: "day-range" })).toBe("day");
    expect(getTrendGranularity({ ...defaultFilters, periodMode: "month-range" })).toBe("month");

    const dayFilters = { ...defaultFilters, preset: "7d" as const };
    const dayData = aggregateTrendData(sampleDataset.inspections, [], dayFilters);
    expect(dayData.map((point) => point.key)).toEqual(["2026-08-15", "2026-08-16", "2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20", "2026-08-21"]);
    expect(dayData.every((point) => /^\d{4}-\d{2}-\d{2}$/.test(point.key))).toBe(true);

    const weekFilters = { ...defaultFilters, periodMode: "week-range" as const, weekFrom: "2026-W33", weekTo: "2026-W34" };
    const weekData = aggregateTrendData(sampleDataset.inspections, [], weekFilters);
    expect(weekData.map((point) => point.key)).toEqual(["2026-W33", "2026-W34"]);
    expect(weekData.map((point) => point.label)).toEqual(["2026-W33", "2026-W34"]);

    const emptyDayData = aggregateTrendData([], [], dayFilters);
    expect(emptyDayData).toHaveLength(7);
    expect(emptyDayData.every((point) => point.fpy === null && point.rejectPpm === null && point.rollingQppm === null)).toBe(true);
  });

  it("adjusts X-axis tick density for short and long trend ranges", () => {
    expect(getTrendXAxisInterval(7)).toBe(0);
    expect(getTrendXAxisInterval(12)).toBe("preserveStartEnd");
    expect(getTrendXAxisInterval(20)).toBe(1);
    expect(getTrendXAxisInterval(60)).toBe("preserveStartEnd");
  });

  it("uses quarter buckets for quarter presets", () => {
    expect(getTrendGranularity({ ...defaultFilters, periodMode: "preset", preset: "q1" })).toBe("quarter");
    expect(getTrendGranularity({ ...defaultFilters, periodMode: "preset", preset: "q4" })).toBe("quarter");
  });

  it("keeps customer complaint trends monthly for monthly delivery denominators", () => {
    const complaintData = aggregateComplaintTrendData(sampleDataset.complaints, sampleDataset.deliveries, "all", { ...defaultFilters, preset: "7d" });
    expect(complaintData.length).toBe(1);
    expect(complaintData[0].key).toBe("2026-08");
    expect(complaintData[0].label).toBe("Aug 26");
    expect(complaintData[0].externalScrapCost + complaintData[0].externalReworkCost).toBe(complaintData[0].external);
  });

  it("auto-scales acceptance and QPPM trend axes from visible results", () => {
    const points = [
      { key: "2026-01", label: "Jan 26", fpy: 95.4, rejectPpm: 46_000, rollingQppm: 44_000, scrapCost: 0, reworkCost: 0, externalScrapCost: 0, externalReworkCost: 0, internal: 0, external: 0 },
      { key: "2026-02", label: "Feb 26", fpy: 96.2, rejectPpm: 39_000, rollingQppm: 42_000, scrapCost: 0, reworkCost: 0, externalScrapCost: 0, externalReworkCost: 0, internal: 0, external: 0 },
      { key: "2026-03", label: "Mar 26", fpy: null, rejectPpm: null, rollingQppm: null, scrapCost: 0, reworkCost: 0, externalScrapCost: 0, externalReworkCost: 0, internal: 0, external: 0 }
    ];

    const acceptanceDomain = getTrendYAxisDomain(points, "acceptance");
    expect(acceptanceDomain[0]).toBeLessThan(95.4);
    expect(acceptanceDomain[1]).toBeGreaterThan(96.2);
    expect(acceptanceDomain[0]).toBeGreaterThanOrEqual(0);
    expect(acceptanceDomain[1]).toBeLessThanOrEqual(100);

    const qppmDomain = getTrendYAxisDomain(points, "qppm");
    expect(qppmDomain).toEqual([37_000, 48_000]);
  });

  it("keeps flat acceptance results readable and handles empty trend data", () => {
    const flatPoint = [{ key: "2026-01", label: "Jan 26", fpy: 99.9, rejectPpm: 0, rollingQppm: 0, scrapCost: 0, reworkCost: 0, externalScrapCost: 0, externalReworkCost: 0, internal: 0, external: 0 }];
    const flatDomain = getTrendYAxisDomain(flatPoint, "acceptance");
    expect(flatDomain[1] - flatDomain[0]).toBeGreaterThanOrEqual(2);
    expect(flatDomain[1]).toBeLessThanOrEqual(100);
    expect(getTrendYAxisDomain([], "acceptance")).toEqual([0, 100]);
    expect(getTrendYAxisDomain([], "qppm")).toEqual([0, 10_000]);
  });

  it("filters by operation, stage, and search text", () => {
    const row = sampleDataset.inspections.find((item) => item.operation === "sheet-metal" && item.stage === "incoming")!;
    const filters = { ...defaultFilters, stage: "incoming" as const, search: row.workOrder };
    const result = filterInspections(sampleDataset.inspections, "sheet-metal", filters);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((item) => item.operation === "sheet-metal" && item.stage === "incoming" && item.workOrder === row.workOrder)).toBe(true);
  });

  it("filters inspection records by Level 1 without changing the detailed defect field", () => {
    const level1 = sampleDataset.inspections[0].rejectCategoryLevel1;
    const result = filterInspections(sampleDataset.inspections, "all", { ...defaultFilters, rejectCategoryLevel1: level1 });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((item) => item.rejectCategoryLevel1 === level1)).toBe(true);
    expect(result.every((item) => item.defectCategory.length > 0 && item.rejectCategoryLevel2.length > 0)).toBe(true);
  });

  it("filters inspection records by Level 2 independently", () => {
    const reason = sampleDataset.inspections[0].rejectCategoryLevel2;
    const result = filterInspections(sampleDataset.inspections, "all", { ...defaultFilters, rejectCategoryLevel2: reason });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((item) => item.rejectCategoryLevel2 === reason)).toBe(true);
  });

  it("builds a Level 2 period matrix and keeps identical reasons in one row", () => {
    const base = sampleDataset.inspections[0];
    const rows = [
      { ...base, date: "2026-01-10", rejectCategoryLevel2: "Burr", scrapQty: 4, reworkQty: 1 },
      { ...base, date: "2026-02-10", rejectCategoryLevel2: "Burr", scrapQty: 3, reworkQty: 0 },
      { ...base, date: "2026-03-10", rejectCategoryLevel2: "Porosity", scrapQty: 2, reworkQty: 1 }
    ];
    const filters = { ...defaultFilters, periodMode: "month-range" as const, monthFrom: "2026-01", monthTo: "2026-03" };
    const matrix = aggregateRejectCategoryLevel2Matrix(rows, filters, { start: "2026-01-01", end: "2026-03-31" });
    expect(matrix.granularity).toBe("month");
    expect(matrix.columns.map((column) => column.key)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(matrix.rows[0]).toMatchObject({ name: "Burr", total: 8, values: { "2026-01": 5, "2026-02": 3 } });
    const quarterMatrix = aggregateRejectCategoryLevel2Matrix(rows, { ...filters, periodMode: "quarter-range", quarterFrom: "2026-Q1", quarterTo: "2026-Q1" }, { start: "2026-01-01", end: "2026-03-31" });
    expect(quarterMatrix.granularity).toBe("quarter");
    expect(quarterMatrix.columns.map((column) => column.key)).toEqual(["2026-Q1"]);
    expect(quarterMatrix.rows.find((row) => row.name === "Burr")?.values["2026-Q1"]).toBe(8);
  });

  it("aggregates complaint Level 1 and Level 2 by affected quantity", () => {
    const base = sampleDataset.complaints[0];
    const rows = [
      { ...base, complaintDate: "2026-01-10", rejectCategoryLevel1: "Process / workmanship" as const, rejectCategoryLevel2: "Burr", affectedQty: 5 },
      { ...base, complaintDate: "2026-02-10", rejectCategoryLevel1: "Process / workmanship" as const, rejectCategoryLevel2: "Burr", affectedQty: 3 },
      { ...base, complaintDate: "2026-03-10", rejectCategoryLevel1: "Cosmetic / appearance" as const, rejectCategoryLevel2: "Scratch", affectedQty: 4 }
    ];
    expect(groupComplaintRejectCategories(rows)).toEqual(expect.arrayContaining([
      { name: "Process / workmanship", value: 8 },
      { name: "Cosmetic / appearance", value: 4 }
    ]));
    const filters = { ...defaultFilters, periodMode: "month-range" as const, monthFrom: "2026-01", monthTo: "2026-03" };
    const matrix = aggregateComplaintRejectCategoryLevel2Matrix(rows, filters, { start: "2026-01-01", end: "2026-03-31" });
    expect(matrix.columns.map((column) => column.key)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(matrix.rows[0]).toMatchObject({ name: "Burr", total: 8, values: { "2026-01": 5, "2026-02": 3 } });
  });

  it("filters complaints by both shared reject category levels", () => {
    const row = sampleDataset.complaints[0];
    const range = { start: "2025-09-01", end: "2026-08-21" };
    const level1Rows = filterComplaints(sampleDataset.complaints, "all", range, { rejectCategoryLevel1: row.rejectCategoryLevel1 });
    const level2Rows = filterComplaints(sampleDataset.complaints, "all", range, { rejectCategoryLevel2: row.rejectCategoryLevel2 });
    expect(level1Rows.length).toBeGreaterThan(0);
    expect(level1Rows.every((item) => item.rejectCategoryLevel1 === row.rejectCategoryLevel1)).toBe(true);
    expect(level2Rows.length).toBeGreaterThan(0);
    expect(level2Rows.every((item) => item.rejectCategoryLevel2 === row.rejectCategoryLevel2)).toBe(true);
  });

  it("derives Level 1 for legacy records without the new fields", () => {
    const legacyRows = sampleDataset.inspections.map(({ rejectCategoryLevel1: _level1, rejectCategoryLevel2: _level2, ...row }) => row as InspectionRecord);
    const result = filterInspections(legacyRows, "all", { ...defaultFilters, rejectCategoryLevel1: "Cosmetic / appearance" });
    expect(result.length).toBeGreaterThan(0);
    expect(groupRejectCategories(legacyRows).some((item) => item.name === "Cosmetic / appearance")).toBe(true);
  });
});

describe("workbook validation and round trip", () => {
  it("uses only active master records in quality workbook dropdown lists", () => {
    const masterData = structuredClone(seedMasterData);
    masterData.suppliers[0].status = "Inactive";
    masterData.customers[0].status = "Inactive";
    masterData.parts[0].status = "Inactive";
    masterData.processRoutes[0].status = "Inactive";
    masterData.defectLevel1[0].status = "Inactive";
    masterData.defectLevel2[0].status = "Inactive";

    const lists = Object.fromEntries(buildValidationLists(sampleDataset, masterData).map((list) => [list.name, list.values]));
    expect(lists.QualitySupplier).not.toContain(masterData.suppliers[0].name);
    expect(lists.QualitySupplier).toContain(masterData.suppliers[1].name);
    expect(lists.QualityCustomer).not.toContain(masterData.customers[0].name);
    expect(lists.QualityPartNumber).not.toContain(masterData.parts[0].partNumber);
    expect(lists.QualityProcess).not.toContain(masterData.processRoutes[0].process);
    expect(lists.QualityRejectCategoryLevel1).not.toContain(masterData.defectLevel1[0].name);
    expect(lists.QualityRejectCategoryLevel2).not.toContain(masterData.defectLevel2[0].reason);
  });

  it("rejects inactive master references while allowing blank legacy delivery customers", async () => {
    const masterData = structuredClone(seedMasterData);
    const supplier = masterData.suppliers[0];
    const customer = masterData.customers[0];
    const part = masterData.parts.find((row) => row.operation === "sheet-metal" && row.partType === "Production")!;
    const route = masterData.processRoutes.find((row) => row.operation === "sheet-metal")!;
    const level2 = masterData.defectLevel2.find((row) => row.status === "Active" && row.processIds.includes(route.id))!;
    const level1 = masterData.defectLevel1.find((row) => row.id === level2.level1Id)!;
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
      {
        ID: "MASTER-IN-1", Date: "2026-08-20", Operation: "Sheet Metal", Stage: "Incoming", Supplier: supplier.name,
        "Part Number": part.partNumber, "Part Type": part.partType, "Inspected Qty": 10, "First Pass Good Qty": 10,
        "Rework Qty": 0, "Scrap Qty": 0, "Scrap Cost": 0, "Rework Cost": 0
      },
      {
        ID: "MASTER-IP-1", Date: "2026-08-20", Operation: "Sheet Metal", Stage: "In-Process", Process: route.process,
        "Work Center": route.workCenter, Machine: route.machine, "Part Number": part.partNumber, "Part Type": part.partType,
        "Inspected Qty": 10, "First Pass Good Qty": 9, "Rework Qty": 1, "Scrap Qty": 0, "Scrap Cost": 0,
        "Rework Cost": 5, "Reject Category Level 1": level1.name, "Reject Category Level 2": level2.reason
      }
    ]), "Inspections");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{
      ID: "MASTER-COM-1", "Complaint Date": "2026-08-20", Operation: "Sheet Metal", Customer: customer.name,
      Process: route.process, "Part Number": part.partNumber, "Part Type": part.partType, "Defect Category": level2.reason,
      "Reject Category Level 1": level1.name, "Reject Category Level 2": level2.reason, "Affected Qty": 1,
      "External Failure Cost": 25, "External Scrap Cost": 25, "External Rework Cost": 0, Severity: "Minor", Status: "Open"
    }]), "Complaints");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{
      ID: "MASTER-DEL-1", Month: "2026-08", Operation: "Sheet Metal", Customer: "", "Delivered Qty": 100
    }]), "Deliveries");
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });

    const validPreview = await parseQualityWorkbook(new File([bytes], "active-master.xlsx"), masterData);
    expect(validPreview.issues).toHaveLength(0);
    expect(validPreview.dataset.deliveries[0].customer).toBe("");

    supplier.status = "Inactive";
    customer.status = "Inactive";
    part.status = "Inactive";
    route.status = "Inactive";
    level1.status = "Inactive";
    level2.status = "Inactive";
    const invalidPreview = await parseQualityWorkbook(new File([bytes], "inactive-master.xlsx"), masterData);
    expect(invalidPreview.issues.some((issue) => issue.field === "Supplier")).toBe(true);
    expect(invalidPreview.issues.some((issue) => issue.field === "Customer")).toBe(true);
    expect(invalidPreview.issues.some((issue) => issue.field === "Part Number")).toBe(true);
    expect(invalidPreview.issues.some((issue) => issue.field === "Process route" || issue.field === "Process")).toBe(true);
    expect(invalidPreview.issues.some((issue) => issue.field === "Reject Category Level 1")).toBe(true);
    expect(invalidPreview.issues.some((issue) => issue.field === "Reject Category Level 2")).toBe(true);
  });

  it("exports and re-imports the normalized workbook without loss", async () => {
    const source = { ...sampleDataset, inspections: sampleDataset.inspections.slice(0, 4).filter((row) => row.stage !== "incoming"), complaints: sampleDataset.complaints.slice(0, 2) };
    const workbook = await buildQualityWorkbook(source);
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    const preview = await parseQualityWorkbook(new File([bytes], "round-trip.xlsx"));
    expect(preview.issues).toHaveLength(0);
    expect(preview.dataset.inspections).toEqual(source.inspections.map((row) => ({ ...row, supplier: "" })));
    expect(preview.dataset.complaints).toEqual(source.complaints);
    expect(preview.dataset.deliveries).toEqual(source.deliveries);
    expect(preview.dataset.targets).toEqual(source.targets);
  });

  it("marks non-applicable stage fields and blank text values in exports", async () => {
    const incoming = sampleDataset.inspections.find((row) => row.stage === "incoming")!;
    const inProcess = sampleDataset.inspections.find((row) => row.stage === "in-process")!;
    const outgoing = sampleDataset.inspections.find((row) => row.stage === "outgoing")!;
    const workbook = await buildQualityWorkbook({ ...sampleDataset, inspections: [incoming, { ...inProcess, supplier: "", machine: "" }, { ...outgoing, supplier: "" }] });
    const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(workbook.Sheets.Inspections, { defval: "" });
    expect(rows[0]).toMatchObject({ Stage: "Incoming", Process: "N/A", "Work Center": "N/A", Machine: "N/A", Supplier: incoming.supplier, "Work Order": "N/A" });
    expect(rows[1]).toMatchObject({ Stage: "In-Process", Process: inProcess.process, "Work Center": inProcess.workCenter, Machine: "N/A", Supplier: "N/A", "Work Order": inProcess.workOrder });
    expect(rows[2]).toMatchObject({ Stage: "Outgoing", Process: outgoing.process, "Work Center": outgoing.workCenter, Machine: outgoing.machine, Supplier: "N/A", "Work Order": outgoing.workOrder });
  });

  it("blocks invalid quantities and identifies the exact row", async () => {
    const invalid: Partial<InspectionRecord> & Record<string, unknown> = {
      ID: "BAD-1", Date: "2026-08-20", Operation: "Sheet Metal", Stage: "Incoming", Process: "Laser Cutting",
      "Work Center": "Fabrication Cell A", "Part Number": "SM-TEST", "Inspected Qty": 10, "First Pass Good Qty": 8,
      "Rework Qty": 4, "Scrap Qty": 1, "Scrap Cost": 20, "Rework Cost": 10
    };
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([invalid]), "Inspections");
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    const preview = await parseQualityWorkbook(new File([bytes], "invalid.xlsx"));
    expect(preview.dataset.inspections).toHaveLength(0);
    expect(preview.issues.some((issue) => issue.row === 2 && issue.field === "Quantities")).toBe(true);
  });

  it("rejects an invalid Part Type while defaulting omitted legacy values to Production", async () => {
    const inspection = sampleDataset.inspections[0];
    const base = {
      ID: "PART-TYPE-1", Date: inspection.date, Operation: "Sheet Metal", Stage: "Incoming", Process: inspection.process,
      "Work Center": inspection.workCenter, "Part Number": inspection.partNumber, "Inspected Qty": 10,
      "First Pass Good Qty": 8, "Rework Qty": 1, "Scrap Qty": 1, "Scrap Cost": 10, "Rework Cost": 5
    };
    const validBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(validBook, XLSX.utils.json_to_sheet([base]), "Inspections");
    const validBytes = XLSX.write(validBook, { type: "array", bookType: "xlsx" });
    const validPreview = await parseQualityWorkbook(new File([validBytes], "legacy-part-type.xlsx"));
    expect(validPreview.issues).toHaveLength(0);
    expect(validPreview.dataset.inspections[0].partType).toBe("Production");

    const invalidBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(invalidBook, XLSX.utils.json_to_sheet([{ ...base, ID: "PART-TYPE-2", "Part Type": "Pilot" }]), "Inspections");
    const invalidBytes = XLSX.write(invalidBook, { type: "array", bookType: "xlsx" });
    const invalidPreview = await parseQualityWorkbook(new File([invalidBytes], "invalid-part-type.xlsx"));
    expect(invalidPreview.issues.some((issue) => issue.field === "Part Type")).toBe(true);
  });

  it("blocks invalid dates, unreconciled quantities, and duplicate inspection IDs", async () => {
    const inspection = sampleDataset.inspections[0];
    const base = {
      ID: "DUP-1", Date: "2026-02-30", Operation: "Sheet Metal", Stage: "Incoming", Process: inspection.process,
      "Work Center": inspection.workCenter, "Part Number": inspection.partNumber, "Inspected Qty": 10,
      "First Pass Good Qty": 8, "Rework Qty": 1, "Scrap Qty": 0, "Scrap Cost": 10, "Rework Cost": 5
    };
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([base, { ...base, Date: "2026-02-28" }]), "Inspections");
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    const preview = await parseQualityWorkbook(new File([bytes], "integrity.xlsx"));
    expect(preview.issues.some((issue) => issue.row === 2 && issue.field === "Date")).toBe(true);
    expect(preview.issues.some((issue) => issue.row === 2 && issue.field === "Quantities")).toBe(true);
    expect(preview.issues.some((issue) => issue.row === 3 && issue.field === "ID")).toBe(true);
  });

  it("migrates legacy complaint rows without Process to Unassigned", async () => {
    const workbook = XLSX.utils.book_new();
    const inspection = sampleDataset.inspections[0];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{
      ID: inspection.id, Date: inspection.date, Operation: "Sheet Metal", Stage: "Incoming", Process: inspection.process,
      "Work Center": inspection.workCenter, "Part Number": inspection.partNumber, "Inspected Qty": inspection.inspectedQty,
      "First Pass Good Qty": inspection.firstPassGoodQty, "Rework Qty": inspection.reworkQty, "Scrap Qty": inspection.scrapQty,
      "Scrap Cost": inspection.scrapCost, "Rework Cost": inspection.reworkCost
    }]), "Inspections");
    const complaint = sampleDataset.complaints[0];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{
      ID: complaint.id, "Complaint Date": complaint.complaintDate, Operation: "Sheet Metal", Customer: complaint.customer,
      "Part Number": complaint.partNumber, "Defect Category": complaint.defectCategory, "Affected Qty": complaint.affectedQty,
      "External Failure Cost": complaint.externalFailureCost, Severity: complaint.severity, Status: complaint.status
    }]), "Complaints");
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    const preview = await parseQualityWorkbook(new File([bytes], "legacy-complaints.xlsx"));
    expect(preview.issues).toHaveLength(0);
    expect(preview.dataset.complaints[0].process).toBe("Unassigned");
    expect(preview.dataset.complaints[0].externalScrapCost).toBe(complaint.externalFailureCost);
    expect(preview.dataset.complaints[0].externalReworkCost).toBe(0);
    expect(preview.dataset.complaints[0].rejectCategoryLevel1).toBe(deriveRejectCategoryLevel1(complaint.defectCategory));
    expect(preview.dataset.complaints[0].rejectCategoryLevel2).toBe(deriveRejectCategoryLevel2("Unassigned", complaint.defectCategory));
  });

  it("rejects explicit complaint category values outside the shared taxonomy", async () => {
    const complaint = { ...sampleDataset.complaints[0], rejectCategoryLevel1: "Invalid family" as never, rejectCategoryLevel2: "Invalid reason" };
    const workbook = await buildQualityWorkbook({ ...sampleDataset, inspections: [sampleDataset.inspections[0]], complaints: [complaint] });
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    const preview = await parseQualityWorkbook(new File([bytes], "invalid-complaint-categories.xlsx"));
    expect(preview.dataset.complaints).toHaveLength(0);
    expect(preview.issues.some((issue) => issue.field === "Reject Category Level 1")).toBe(true);
    expect(preview.issues.some((issue) => issue.field === "Reject Category Level 2")).toBe(true);
  });

  it("rejects complaint cost components that do not reconcile to external failure cost", async () => {
    const complaint = sampleDataset.complaints[0];
    const workbook = await buildQualityWorkbook({
      ...sampleDataset,
      inspections: [sampleDataset.inspections[0]],
      complaints: [{ ...complaint, externalScrapCost: 100, externalReworkCost: 50, externalFailureCost: 500 }]
    });
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    const preview = await parseQualityWorkbook(new File([bytes], "invalid-external-cost.xlsx"));
    expect(preview.dataset.complaints).toHaveLength(0);
    expect(preview.issues.some((issue) => issue.field === "External Failure Cost")).toBe(true);
  });
});
