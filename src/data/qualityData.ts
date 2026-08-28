import { activeDefectLevel1ForProcess, activeDefectLevel2ForProcessAndLevel1, isFocusedPaintProcess, type MasterDataState } from "./accessControl";

export type OperationKey = "all" | "sheet-metal" | "precision-machining";
export type ProductionOperation = Exclude<OperationKey, "all">;
export type InspectionStage = "incoming" | "in-process" | "outgoing";
export type DashboardStage = InspectionStage | "customer-complaint" | "all";
export type Shift = "Day" | "Night";
export type PartType = "NPI" | "Production";
export type Severity = "Critical" | "Major" | "Minor";
export type RejectCategoryLevel1 = "Drawing/specification nonconformance" | "Cosmetic / appearance" | "Material / component" | "Functional / performance" | "Process / workmanship" | "Missing / incorrect part" | "Other" | "Cleaning & Chemical Treatment" | "Surface Condition & Corrosion" | "Appearance & Coverage" | "Adhesion, Cure & Colour";
export type DatePreset = "7d" | "12m" | "6m" | "3m" | "ytd" | "year" | "q1" | "q2" | "q3" | "q4";
export type PeriodMode = "preset" | "day-range" | "week-range" | "month-range" | "year-range" | "quarter-range";
export type QuarterPeriod = `${number}-Q${1 | 2 | 3 | 4}`;

export type InspectionRecord = {
  id: string;
  date: string;
  operation: ProductionOperation;
  stage: InspectionStage;
  process: string;
  workCenter: string;
  machine: string;
  shift: Shift;
  supplier: string;
  partNumber: string;
  partName: string;
  partType: PartType;
  workOrder: string;
  lotNumber: string;
  inspectedQty: number;
  firstPassGoodQty: number;
  reworkQty: number;
  scrapQty: number;
  scrapCost: number;
  reworkCost: number;
  inspectionDueDate: string;
  inspectionCompletedDate: string;
  defectCategory: string;
  rejectCategoryLevel1: RejectCategoryLevel1;
  rejectCategoryLevel2: string;
  defectCode: string;
  rootCause: string;
  disposition: string;
  severity: Severity;
};

export type ComplaintRecord = {
  id: string;
  complaintDate: string;
  operation: ProductionOperation;
  customer: string;
  process: string;
  partNumber: string;
  partType: PartType;
  defectCategory: string;
  rejectCategoryLevel1: RejectCategoryLevel1;
  rejectCategoryLevel2: string;
  affectedQty: number;
  externalFailureCost: number;
  externalScrapCost: number;
  externalReworkCost: number;
  severity: Severity;
  status: "Open" | "Closed";
};

export type DeliveryRecord = {
  id: string;
  month: string;
  operation: ProductionOperation;
  /** Customer-level delivery rows are used for customer complaint PPM. Empty is a legacy aggregate row. */
  customer?: string;
  deliveredQty: number;
};

export type MetricTargets = {
  fpy: number;
  rejectPpm: number;
  complaintFpy: number;
  complaintRejectPpm: number;
  scrapRate: number;
  copq: number;
  inspectionCompletion: number;
};

export type QualityTargets = Record<OperationKey, MetricTargets>;

export type QualityDataset = {
  inspections: InspectionRecord[];
  complaints: ComplaintRecord[];
  deliveries: DeliveryRecord[];
  targets: QualityTargets;
};

function externalCostBreakdown(row: { externalFailureCost: number; externalScrapCost?: number; externalReworkCost?: number }) {
  const total = Number.isFinite(row.externalFailureCost) ? Math.max(0, row.externalFailureCost) : 0;
  const hasScrap = Number.isFinite(row.externalScrapCost) && Number(row.externalScrapCost) >= 0;
  const hasRework = Number.isFinite(row.externalReworkCost) && Number(row.externalReworkCost) >= 0;
  const scrap = hasScrap ? Number(row.externalScrapCost) : 0;
  const rework = hasRework ? Number(row.externalReworkCost) : 0;
  if (hasScrap && hasRework && Math.abs(scrap + rework - total) <= 0.01) return { scrap, rework };
  if (hasScrap && !hasRework && scrap <= total) return { scrap, rework: total - scrap };
  if (!hasScrap && hasRework && rework <= total) return { scrap: total - rework, rework };
  return { scrap: total, rework: 0 };
}

export type DashboardFilters = {
  preset: DatePreset;
  periodMode: PeriodMode;
  dayFrom: string;
  dayTo: string;
  monthFrom: string;
  monthTo: string;
  yearFrom: number;
  yearTo: number;
  quarterFrom: QuarterPeriod;
  quarterTo: QuarterPeriod;
  weekFrom: string;
  weekTo: string;
  stage: DashboardStage;
  process: string;
  workCenter: string;
  supplier: string;
  customer: string;
  partNumber: string;
  partType: PartType | "all";
  shift: Shift | "all";
  search: string;
  defectCategory: string;
  rejectCategoryLevel1: RejectCategoryLevel1 | "all";
  rejectCategoryLevel2: string | "all";
};

export type ValidationIssue = {
  sheet: "Inspections" | "Complaints" | "Deliveries" | "Targets";
  row: number;
  field: string;
  message: string;
};

export type ImportPreview = {
  dataset: QualityDataset;
  issues: ValidationIssue[];
  fileName: string;
};

export type QualityMetrics = {
  inspectedQty: number;
  firstPassGoodQty: number;
  reworkQty: number;
  scrapQty: number;
  fpy: number | null;
  rejectPpm: number | null;
  scrapRate: number | null;
  copq: number;
  rejectionCost: number;
  inspectionCompletion: number | null;
  complaintCount: number;
  complaintAffectedQty: number;
};

export type ComplaintAnalysisGroup = { name: string; affectedQty: number; cases: number; externalFailureCost: number };

export type ComplaintMetrics = {
  deliveredQty: number;
  affectedQty: number;
  complaintCount: number;
  rejectionCost: number;
  fpy: number | null;
  rejectPpm: number | null;
};

export const DATA_END_DATE = "2026-08-21";
export const STORAGE_KEY = "manufacturing-quality-dataset-v1";

export const operationMeta: Record<OperationKey, { label: string; shortLabel: string }> = {
  all: { label: "All Operations", shortLabel: "ALL" },
  "sheet-metal": { label: "Sheet Metal", shortLabel: "SM" },
  "precision-machining": { label: "Precision Machining", shortLabel: "PM" }
};

export const stageMeta: Record<InspectionStage, { label: string; shortLabel: string }> = {
  incoming: { label: "Incoming", shortLabel: "IQC" },
  "in-process": { label: "In-Process", shortLabel: "IPQC" },
  outgoing: { label: "Outgoing", shortLabel: "OQC" }
};

export const defaultFilters: DashboardFilters = {
  preset: "12m",
  periodMode: "preset",
  dayFrom: DATA_END_DATE,
  dayTo: DATA_END_DATE,
  monthFrom: "2025-09",
  monthTo: "2026-08",
  yearFrom: 2025,
  yearTo: 2026,
  quarterFrom: "2025-Q1",
  quarterTo: "2026-Q3",
  weekFrom: "2026-W34",
  weekTo: "2026-W34",
  stage: "all",
  process: "all",
  workCenter: "all",
  supplier: "all",
  customer: "all",
  partNumber: "all",
  partType: "all",
  shift: "all",
  search: "",
  defectCategory: "all",
  rejectCategoryLevel1: "all",
  rejectCategoryLevel2: "all"
};

export function cascadeStageFilters(rows: InspectionRecord[], operation: OperationKey, filters: DashboardFilters, stage: DashboardFilters["stage"]): DashboardFilters {
  if (stage === "all") return { ...filters, stage, supplier: "all", process: "all", workCenter: "all" };
  const next = {
    ...filters,
    stage,
    supplier: stage === "customer-complaint" || stage === "in-process" || stage === "outgoing" ? "all" : filters.supplier,
    process: stage === "incoming" || stage === "customer-complaint" ? "all" : filters.process,
    workCenter: stage === "incoming" || stage === "customer-complaint" ? "all" : filters.workCenter
  };
  const relations = getFilterRelations(rows, operation, next);
  return { ...next, process: relations.effectiveProcess, workCenter: relations.effectiveWorkCenter };
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).filter(Boolean).sort((left, right) => left.localeCompare(right));
}

export const level2DefectCatalog: Record<string, string[]> = {
  "Laser Cutting": ["Burr / dross", "Incomplete cut", "Heat tint / discoloration", "Wrong profile", "Dimensional error", "Wrong program"],
  "Turret Punching": ["Hole oversize / undersize", "Missing hole", "Burr", "Deformation", "Wrong hole pattern", "Tool mark"],
  "Press Brake": ["Wrong bend angle", "Flange length error", "Springback", "Twist", "Crack", "Wrong bend sequence"],
  "Hardware & Nut Installation": ["Missing hardware", "Wrong hardware", "Loose nut", "Cross-thread", "Misaligned insert", "Pull-out", "Incorrect torque"],
  "Spot Welding": ["Missing weld", "Weak weld", "Misplaced weld", "Expulsion", "Burn-through", "Incorrect nugget size"],
  "MIG/TIG Welding": ["Porosity", "Undercut", "Lack of fusion", "Excessive spatter", "Burn-through", "Incorrect weld size", "Distortion"],
  Grinding: ["Over-grinding", "Under-grinding", "Gouge", "Flatness error", "Sharp edge", "Incorrect edge radius"],
  Polishing: ["Uneven finish", "Swirl marks", "Scratches", "Over-polish", "Dull area", "Gloss mismatch"],
  Pretreatment: ["Poor cleaning", "Contamination", "Flash rust", "Incomplete conversion coating", "Uneven pretreatment"],
  Painting: ["Poor adhesion", "Orange peel", "Runs / sags", "Thin coating", "Thick coating", "Color mismatch", "Pinholes", "Contamination"],
  Assembly: ["Missing component", "Wrong orientation", "Misalignment", "Excessive gap", "Interference", "Incorrect torque", "Wrong revision"],
  Packaging: ["Wrong packaging", "Inadequate protection", "Transit damage", "Missing label", "Wrong quantity", "Moisture / corrosion exposure"],
  "CNC Machining": ["Dimensional error", "Hole / thread defect", "Tool wear", "Chatter", "Burr", "Tool marks", "Wrong program", "Poor surface finish"]
};

const rejectCategoryLevel1Values: RejectCategoryLevel1[] = ["Drawing/specification nonconformance", "Cosmetic / appearance", "Material / component", "Functional / performance", "Process / workmanship", "Missing / incorrect part", "Other"];

function level2ReasonsForProcess(process: string) {
  const catalogProcess = ["CNC Milling", "CNC Turning"].includes(process) ? "CNC Machining"
    : process === "Welding" ? "MIG/TIG Welding"
      : process === "Powder Coating" ? "Painting"
        : process;
  return level2DefectCatalog[catalogProcess] ?? Object.values(level2DefectCatalog).flat();
}

export function deriveRejectCategoryLevel1(defectCategory: string): RejectCategoryLevel1 {
  const category = defectCategory.trim().toLowerCase();
  if (/bend|hole position|dimensional|concentricity|runout|flange length|flatness/.test(category)) return "Drawing/specification nonconformance";
  if (/scratch|dent|coating|tool mark|surface finish|paint|orange peel|gloss/.test(category)) return "Cosmetic / appearance";
  if (/material|alloy|component/.test(category)) return "Material / component";
  if (/thread|fit|function|performance|leak|test failure|torque/.test(category)) return "Functional / performance";
  if (/weld|porosity|burr|spatter|undercut|gouge|grind|polish|pretreatment|workmanship/.test(category)) return "Process / workmanship";
  if (/missing|wrong part|incorrect part|wrong revision|configuration/.test(category)) return "Missing / incorrect part";
  return "Other";
}

export function deriveRejectCategoryLevel2(process: string, defectCategory: string) {
  const category = defectCategory.trim();
  const is = (pattern: RegExp) => pattern.test(category);
  if (process === "Laser Cutting" && category === "Burr / sharp edge") return "Burr / dross";
  if (process === "Laser Cutting" && category === "Hole position drift") return "Wrong profile / dimensional error";
  if (process === "Turret Punching" && category === "Hole position drift") return "Hole position error";
  if (process === "Turret Punching" && category === "Burr / sharp edge") return "Burr";
  if (process === "Press Brake" && category === "Bend angle error") return "Wrong bend angle";
  if (["Welding", "Spot Welding", "MIG/TIG Welding"].includes(process) && category === "Weld porosity") return "Porosity";
  if (["CNC Milling", "CNC Turning", "CNC Machining"].includes(process)) {
    if (/dimensional tolerance|concentricity|runout|hole position/i.test(category)) return "Dimensional error";
    if (/thread failure/i.test(category)) return "Hole / thread defect";
    if (/surface finish/i.test(category)) return "Poor surface finish";
    if (/tool marks/i.test(category)) return "Tool marks";
    if (/burr/i.test(category)) return "Burr";
  }
  if (process === "Grinding" && category === "Scratch / dent") return "Gouge / over-grinding";
  if (process === "Polishing" && category === "Scratch / dent") return "Scratches";
  if (["Painting", "Powder Coating"].includes(process) && category === "Coating defect") return "Poor adhesion / coating defect";
  if (is(/burr|sharp edge/i)) return process === "Laser Cutting" ? "Burr / dross" : "Burr";
  if (is(/hole position|dimensional tolerance|wrong material thickness/i)) return process === "Turret Punching" ? "Wrong hole pattern" : "Dimensional error";
  if (is(/bend angle/i)) return "Wrong bend angle";
  if (is(/coating defect/i)) return "Poor adhesion";
  if (is(/weld porosity|porosity/i)) return "Porosity";
  if (is(/surface finish/i)) return process === "Polishing" ? "Uneven finish" : "Poor surface finish";
  if (is(/scratch|dent/i)) return process === "Grinding" ? "Gouge" : process === "Polishing" ? "Scratches" : "Tool marks";
  return category || "Unspecified defect";
}

export function getFilterRelations(rows: InspectionRecord[], operation: OperationKey, filters: DashboardFilters) {
  const operationRows = rows.filter((row) => operation === "all" || row.operation === operation);
  const stageRows = operationRows.filter((row) => filters.stage === "all" || row.stage === filters.stage);
  const processValues = uniqueSorted(stageRows.map((row) => row.process));
  const processApplicable = filters.stage !== "incoming" && filters.stage !== "customer-complaint";
  const effectiveProcess = processApplicable && (filters.process === "all" || processValues.includes(filters.process)) ? filters.process : "all";
  const workCenterRows = stageRows.filter((row) => effectiveProcess === "all" || row.process === effectiveProcess);
  const workCenterValues = uniqueSorted(workCenterRows.map((row) => row.workCenter));
  const workCenterApplicable = filters.stage !== "incoming" && filters.stage !== "customer-complaint";
  const effectiveWorkCenter = workCenterApplicable && (filters.workCenter === "all" || workCenterValues.includes(filters.workCenter)) ? filters.workCenter : "all";
  return { processValues, workCenterValues, effectiveProcess, effectiveWorkCenter };
}

const operationProfiles: Record<ProductionOperation, {
  processes: Array<{ process: string; workCenter: string; machine: string }>;
  suppliers: string[];
  parts: Array<{ number: string; name: string }>;
  defects: Array<{ category: string; code: string }>;
  scrapUnitCost: number;
  reworkUnitCost: number;
}> = {
  "sheet-metal": {
    processes: [
      { process: "Laser Cutting", workCenter: "Fabrication Cell A", machine: "Fiber Laser 02" },
      { process: "Turret Punching", workCenter: "Fabrication Cell B", machine: "Turret Press 01" },
      { process: "Press Brake", workCenter: "Forming Cell", machine: "Press Brake 07" },
      { process: "Welding", workCenter: "Weld Bay", machine: "MIG Station 04" },
      { process: "Hardware & Nut Installation", workCenter: "Hardware Cell", machine: "Nutsert Press 01" },
      { process: "Spot Welding", workCenter: "Spot Weld Cell", machine: "Spot Welder 02" },
      { process: "MIG/TIG Welding", workCenter: "Weld Bay", machine: "MIG/TIG Station 05" },
      { process: "Grinding", workCenter: "Grinding Cell", machine: "Belt Grinder 03" },
      { process: "Polishing", workCenter: "Polishing Cell", machine: "Polishing Bench 02" },
      { process: "Pretreatment", workCenter: "Pretreatment Line", machine: "Wash Line 01" },
      { process: "Painting", workCenter: "Paint Line", machine: "Paint Booth 02" },
      { process: "Assembly", workCenter: "Assembly Cell", machine: "Assembly Bench 04" },
      { process: "Packaging", workCenter: "Packaging Cell", machine: "Pack Station 01" },
      { process: "Deburring", workCenter: "Finishing Cell", machine: "Deburr Cell 01" },
      { process: "Powder Coating", workCenter: "Coating Line", machine: "Powder Line 02" }
    ],
    suppliers: ["Apex Metals", "Orion Alloys", "Kencana Fasteners", "NexForm Coatings"],
    parts: [
      { number: "SM-4821", name: "Aluminium chassis panel" },
      { number: "SM-3904", name: "Laser-cut mounting bracket" },
      { number: "SM-6108", name: "Powder-coated cover" },
      { number: "SM-2241", name: "Formed electronics tray" },
      { number: "SM-2011", name: "EMI shield enclosure" }
    ],
    defects: [
      { category: "Bend angle error", code: "SM-BEND" },
      { category: "Burr / sharp edge", code: "SM-BURR" },
      { category: "Hole position drift", code: "SM-HOLE" },
      { category: "Weld porosity", code: "SM-WELD" },
      { category: "Scratch / dent", code: "SM-SURF" },
      { category: "Coating defect", code: "SM-COAT" },
      { category: "Wrong material thickness", code: "SM-MATL" }
    ],
    scrapUnitCost: 24,
    reworkUnitCost: 13
  },
  "precision-machining": {
    processes: [
      { process: "CNC Milling", workCenter: "Machining Cell A", machine: "5-Axis Mill 04" },
      { process: "CNC Turning", workCenter: "Machining Cell B", machine: "CNC Lathe 06" },
      { process: "Grinding", workCenter: "Grinding Cell", machine: "Surface Grinder 02" },
      { process: "EDM", workCenter: "EDM Cell", machine: "Wire EDM 03" },
      { process: "Deburring", workCenter: "Secondary Ops", machine: "Deburr Bench 05" },
      { process: "Final Inspection", workCenter: "Metrology Lab", machine: "CMM 02" }
    ],
    suppliers: ["Mekong Precision", "Orion Alloys", "Kencana Tooling", "Apex Metals"],
    parts: [
      { number: "PM-3017", name: "5-axis manifold block" },
      { number: "PM-1730", name: "CNC spacer 12 mm" },
      { number: "PM-2248", name: "Turned stainless bushing" },
      { number: "PM-1198", name: "Threaded actuator collar" },
      { number: "PM-4082", name: "Precision hinge pin" }
    ],
    defects: [
      { category: "Dimensional tolerance", code: "PM-DIM" },
      { category: "Concentricity / runout", code: "PM-RUN" },
      { category: "Thread failure", code: "PM-THRD" },
      { category: "Tool marks", code: "PM-TOOL" },
      { category: "Surface finish", code: "PM-FIN" },
      { category: "Burr / sharp edge", code: "PM-BURR" },
      { category: "Hole position drift", code: "PM-HOLE" }
    ],
    scrapUnitCost: 58,
    reworkUnitCost: 31
  }
};

const rootCauses = ["Tool wear", "Program offset", "Material variation", "Fixture movement", "Handling damage", "Process setup"];
const dispositions = ["Rework", "Scrap", "Use as-is approved", "Supplier return"];
const customers = ["Northstar Robotics", "Helix Automation", "Veridian Medical", "Axiom Energy", "Orion Mobility"];
const npiPartNumbers = new Set(["PM-3017", "SM-2241"]);
const monthStarts = Array.from({ length: 12 }, (_, index) => new Date(2025, 8 + index, 1));

function partTypeFor(partNumber: string): PartType {
  return npiPartNumbers.has(partNumber) ? "NPI" : "Production";
}

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function generateInspections(): InspectionRecord[] {
  const rows: InspectionRecord[] = [];
  const operations: ProductionOperation[] = ["sheet-metal", "precision-machining"];
  let rowIndex = 0;
  monthStarts.forEach((monthStart, monthIndex) => {
    operations.forEach((operation, operationIndex) => {
      const profile = operationProfiles[operation];
      for (let sampleIndex = 0; sampleIndex < 8; sampleIndex += 1) {
        const process = profile.processes[(sampleIndex + monthIndex) % profile.processes.length];
        const part = profile.parts[(sampleIndex * 2 + monthIndex) % profile.parts.length];
        const defect = profile.defects[(sampleIndex + monthIndex * 2 + operationIndex) % profile.defects.length];
        const stage: InspectionStage = sampleIndex % 5 === 0 ? "incoming" : sampleIndex % 5 === 4 ? "outgoing" : "in-process";
        const maxDay = monthIndex === monthStarts.length - 1 ? 21 : 27;
        const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), Math.min(maxDay, 3 + sampleIndex * 3));
        const inspectedQty = 540 + ((monthIndex * 79 + sampleIndex * 137 + operationIndex * 211) % 780);
        const improvement = monthIndex * 0.7;
        const reworkQty = Math.max(3, Math.round(24 + ((sampleIndex * 7 + monthIndex * 3) % 19) - improvement));
        const scrapQty = Math.max(1, Math.round(9 + ((sampleIndex * 5 + operationIndex * 3) % 8) - improvement / 3));
        const firstPassGoodQty = inspectedQty - reworkQty - scrapQty;
        const dueDate = addDays(date, 1);
        const isCompleted = (rowIndex + monthIndex) % 17 !== 0;
        const isLate = (rowIndex + sampleIndex) % 11 === 0;
        rows.push({
          id: `INS-${String(rowIndex + 1).padStart(4, "0")}`,
          date: isoDate(date), operation, stage, process: process.process, workCenter: process.workCenter, machine: process.machine,
          shift: (sampleIndex + monthIndex) % 3 === 0 ? "Night" : "Day",
          supplier: profile.suppliers[(sampleIndex + monthIndex) % profile.suppliers.length], partNumber: part.number, partName: part.name, partType: partTypeFor(part.number),
          workOrder: `WO-${String(26000 + monthIndex * 100 + operationIndex * 40 + sampleIndex).padStart(5, "0")}`,
          lotNumber: `LOT-${isoDate(date).replace(/-/g, "")}-${operationIndex + 1}${sampleIndex + 1}`,
          inspectedQty, firstPassGoodQty, reworkQty, scrapQty, scrapCost: scrapQty * profile.scrapUnitCost,
          reworkCost: reworkQty * profile.reworkUnitCost, inspectionDueDate: isoDate(dueDate),
          inspectionCompletedDate: isCompleted ? isoDate(addDays(dueDate, isLate ? 1 : -1)) : "",
          defectCategory: defect.category, rejectCategoryLevel1: deriveRejectCategoryLevel1(defect.category), rejectCategoryLevel2: deriveRejectCategoryLevel2(process.process, defect.category), defectCode: defect.code, rootCause: rootCauses[(sampleIndex + monthIndex) % rootCauses.length],
          disposition: dispositions[(sampleIndex + operationIndex) % dispositions.length],
          severity: scrapQty >= 14 ? "Critical" : reworkQty >= 28 ? "Major" : "Minor"
        });
        rowIndex += 1;
      }
    });
  });
  return rows;
}

function generateComplaints(): ComplaintRecord[] {
  const rows: ComplaintRecord[] = [];
  let complaintIndex = 0;
  monthStarts.forEach((monthStart, monthIndex) => {
    const count = monthIndex % 4 === 0 ? 3 : monthIndex % 3 === 0 ? 2 : 1;
    for (let index = 0; index < count; index += 1) {
      const operation: ProductionOperation = (monthIndex + index) % 2 === 0 ? "sheet-metal" : "precision-machining";
      const profile = operationProfiles[operation];
      const process = profile.processes[(monthIndex + index) % profile.processes.length];
      const part = profile.parts[(monthIndex + index) % profile.parts.length];
      const defect = profile.defects[(monthIndex * 2 + index) % profile.defects.length];
      const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), Math.min(monthIndex === 11 ? 20 : 24, 8 + index * 6));
      const externalFailureCost = 950 + ((monthIndex * 377 + index * 611) % 4200);
      const externalScrapCost = Math.round(externalFailureCost * (0.55 + ((monthIndex + index) % 3) * 0.1));
      rows.push({
        id: `CCR-${String(complaintIndex + 1).padStart(4, "0")}`, complaintDate: isoDate(date), operation,
        customer: customers[(monthIndex + index * 2) % customers.length], process: process.process, partNumber: part.number, partType: partTypeFor(part.number), defectCategory: defect.category,
        rejectCategoryLevel1: deriveRejectCategoryLevel1(defect.category), rejectCategoryLevel2: deriveRejectCategoryLevel2(process.process, defect.category),
        affectedQty: 2 + ((monthIndex * 3 + index * 5) % 14), externalFailureCost, externalScrapCost, externalReworkCost: externalFailureCost - externalScrapCost,
        severity: index === 0 && monthIndex % 4 === 0 ? "Critical" : monthIndex % 2 === 0 ? "Major" : "Minor",
        status: monthIndex >= 10 && index === 0 ? "Open" : "Closed"
      });
      complaintIndex += 1;
    }
  });
  return rows;
}

function generateDeliveries(): DeliveryRecord[] {
  const rows: DeliveryRecord[] = [];
  const operations: ProductionOperation[] = ["sheet-metal", "precision-machining"];
  let deliveryIndex = 0;
  monthStarts.forEach((monthStart, monthIndex) => operations.forEach((operation, operationIndex) => customers.forEach((customer, customerIndex) => {
    rows.push({
      id: `DEL-${String(deliveryIndex + 1).padStart(4, "0")}`,
      month: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`,
      operation,
      customer,
      deliveredQty: 1800 + ((monthIndex * 613 + operationIndex * 947 + customerIndex * 389) % 900)
    });
    deliveryIndex += 1;
  })));
  return rows;
}

export const defaultTargets: QualityTargets = {
  all: { fpy: 96.5, rejectPpm: 35000, complaintFpy: 99.5, complaintRejectPpm: 5000, scrapRate: 1.1, copq: 145000, inspectionCompletion: 96 },
  "sheet-metal": { fpy: 96, rejectPpm: 39000, complaintFpy: 99.5, complaintRejectPpm: 5000, scrapRate: 1.25, copq: 72000, inspectionCompletion: 95 },
  "precision-machining": { fpy: 97, rejectPpm: 31000, complaintFpy: 99.5, complaintRejectPpm: 5000, scrapRate: 0.95, copq: 80000, inspectionCompletion: 97 }
};

export const sampleDataset: QualityDataset = { inspections: generateInspections(), complaints: generateComplaints(), deliveries: generateDeliveries(), targets: defaultTargets };

type PeriodSelection = Pick<DashboardFilters, "periodMode" | "preset" | "dayFrom" | "dayTo" | "monthFrom" | "monthTo" | "yearFrom" | "yearTo" | "quarterFrom" | "quarterTo" | "weekFrom" | "weekTo">;

function quarterStart(period: QuarterPeriod) {
  const [yearText, quarterText] = period.split("-Q");
  return new Date(Number(yearText), (Number(quarterText) - 1) * 3, 1);
}

function quarterEnd(period: QuarterPeriod) {
  const [yearText, quarterText] = period.split("-Q");
  return new Date(Number(yearText), Number(quarterText) * 3, 0);
}

function weekStart(period: string) {
  const [yearText, weekText] = period.split("-W");
  const year = Number(yearText);
  const week = Number(weekText);
  if (!Number.isFinite(year) || !Number.isFinite(week)) return new Date(Number.NaN);
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  return new Date(year, 0, 4 - jan4Day + 1 + (week - 1) * 7);
}

function weekEnd(period: string) { return addDays(weekStart(period), 6); }

function weekOrdinal(period: string) {
  const [yearText, weekText] = period.split("-W");
  return Number(yearText) * 100 + Number(weekText);
}

function periodSelection(selection: DatePreset | PeriodSelection): PeriodSelection {
  if (typeof selection === "string") return { ...defaultFilters, preset: selection, periodMode: "preset" };
  return selection;
}

export function formatPeriodSelection(selection: PeriodSelection) {
  if (selection.periodMode === "day-range") return `${selection.dayFrom}–${selection.dayTo}`;
  if (selection.periodMode === "week-range") return `${selection.weekFrom}–${selection.weekTo}`;
  if (selection.periodMode === "month-range") return `${selection.monthFrom}–${selection.monthTo}`;
  if (selection.periodMode === "year-range") return `${selection.yearFrom}–${selection.yearTo}`;
  if (selection.periodMode === "quarter-range") return `${selection.quarterFrom.split("-").reverse().join(" ")}–${selection.quarterTo.split("-").reverse().join(" ")}`;
  return selection.preset;
}

export function getDateRange(selection: DatePreset | PeriodSelection, endDate = DATA_END_DATE) {
  const period = periodSelection(selection);
  const end = new Date(`${endDate}T00:00:00`);
  let start: Date;
  if (period.periodMode === "year-range") {
    start = new Date(period.yearFrom, 0, 1);
    end.setTime(new Date(period.yearTo, 11, 31).getTime());
  } else if (period.periodMode === "day-range") {
    start = new Date(`${period.dayFrom}T00:00:00`);
    end.setTime(new Date(`${period.dayTo}T00:00:00`).getTime());
  } else if (period.periodMode === "month-range") {
    const [fromYear, fromMonth] = period.monthFrom.split("-").map(Number);
    const [toYear, toMonth] = period.monthTo.split("-").map(Number);
    start = new Date(fromYear, fromMonth - 1, 1);
    end.setTime(new Date(toYear, toMonth, 0).getTime());
  } else if (period.periodMode === "quarter-range") {
    start = quarterStart(period.quarterFrom);
    end.setTime(quarterEnd(period.quarterTo).getTime());
  } else if (period.periodMode === "week-range") {
    start = weekStart(period.weekFrom);
    end.setTime(weekEnd(period.weekTo).getTime());
  } else if (period.preset === "ytd" || period.preset === "year") start = new Date(end.getFullYear(), 0, 1);
  else if (period.preset.startsWith("q")) {
    const quarter = Number(period.preset.slice(1));
    start = new Date(end.getFullYear(), (quarter - 1) * 3, 1);
    const quarterEnd = new Date(end.getFullYear(), quarter * 3, 0);
    if (quarterEnd < end) end.setTime(quarterEnd.getTime());
  } else {
    if (period.preset === "7d") start = addDays(end, -6);
    else {
      const months = period.preset === "3m" ? 3 : period.preset === "6m" ? 6 : 12;
      start = new Date(end.getFullYear(), end.getMonth() - months + 1, 1);
    }
  }
  if (end > new Date(`${endDate}T00:00:00`)) end.setTime(new Date(`${endDate}T00:00:00`).getTime());
  return { start: isoDate(start), end: isoDate(end) };
}

export function getPriorDateRange(selection: DatePreset | PeriodSelection, endDate = DATA_END_DATE) {
  const current = getDateRange(selection, endDate);
  const start = new Date(`${current.start}T00:00:00`);
  const end = new Date(`${current.end}T00:00:00`);
  const dayCount = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const priorEnd = addDays(start, -1);
  return { start: isoDate(addDays(priorEnd, -dayCount + 1)), end: isoDate(priorEnd) };
}

export type TrendGranularity = "day" | "week" | "month" | "quarter" | "year";
export type TrendPoint = { key: string; label: string; fpy: number | null; rejectPpm: number | null; rollingQppm: number | null; scrapCost: number; reworkCost: number; externalScrapCost: number; externalReworkCost: number; internal: number; external: number };
export type TrendAxisMetric = "acceptance" | "qppm";
export type TrendXAxisInterval = 0 | 1 | "preserveStartEnd";

export function getTrendXAxisInterval(pointCount: number): TrendXAxisInterval {
  if (pointCount <= 7) return 0;
  if (pointCount <= 14) return "preserveStartEnd";
  if (pointCount <= 31) return 1;
  return "preserveStartEnd";
}

/** Returns a padded, data-driven Y-axis domain for the quality trend chart. */
export function getTrendYAxisDomain(points: TrendPoint[], metric: TrendAxisMetric): [number, number] {
  const values = metric === "acceptance"
    ? points.map((point) => point.fpy)
    : points.flatMap((point) => [point.rejectPpm, point.rollingQppm]);
  const finiteValues = values.filter((value): value is number => value !== null && Number.isFinite(value));

  if (!finiteValues.length) return metric === "acceptance" ? [0, 100] : [0, 10_000];

  const min = Math.min(...finiteValues);
  const max = Math.max(...finiteValues);
  const spread = max - min;

  if (metric === "acceptance") {
    const padding = Math.max(1, spread * 0.15);
    let lower = Math.max(0, Math.floor((min - padding) * 10) / 10);
    let upper = Math.min(100, Math.ceil((max + padding) * 10) / 10);
    if (upper - lower < 2) {
      upper = Math.min(100, Math.max(2, Math.ceil((max + 1) * 10) / 10));
      lower = Math.max(0, upper - 2);
    }
    return [lower, upper > lower ? upper : Math.min(100, lower + 2)];
  }

  const step = 1_000;
  const padding = Math.max(step, spread * 0.15);
  const lower = Math.max(0, Math.floor((min - padding) / step) * step);
  const upper = Math.ceil((max + padding) / step) * step;
  return [lower, upper > lower ? upper : lower + step];
}

export function getTrendGranularity(filters: DashboardFilters): TrendGranularity {
  if (filters.periodMode === "year-range") return "year";
  if (filters.periodMode === "day-range") return "day";
  if (filters.periodMode === "week-range") return "week";
  if (filters.periodMode === "month-range") return "month";
  if (filters.periodMode === "preset" && filters.preset === "7d") return "day";
  if (filters.periodMode === "preset" && ["q1", "q2", "q3", "q4"].includes(filters.preset)) return "quarter";
  if (filters.periodMode === "preset" && filters.preset === "year") return "year";
  if (filters.periodMode === "quarter-range") return "quarter";
  return "month";
}

function trendWeekKey(date: string) {
  const cursor = new Date(`${date}T00:00:00Z`);
  const day = cursor.getUTCDay() || 7;
  cursor.setUTCDate(cursor.getUTCDate() + 4 - day);
  const year = cursor.getUTCFullYear();
  const yearStart = Date.UTC(year, 0, 1);
  const week = Math.ceil((((cursor.getTime() - yearStart) / 86_400_000) + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function trendBucketKey(date: string, granularity: TrendGranularity) {
  const year = date.slice(0, 4);
  if (granularity === "day") return date.slice(0, 10);
  if (granularity === "week") return trendWeekKey(date);
  if (granularity === "year") return year;
  const month = Number(date.slice(5, 7));
  if (granularity === "quarter") return `${year}-Q${Math.floor((month - 1) / 3) + 1}`;
  return date.slice(0, 7);
}

function trendBucketLabel(key: string, granularity: TrendGranularity) {
  if (granularity === "day") return new Intl.DateTimeFormat("en-MY", { day: "2-digit", month: "short" }).format(new Date(`${key}T00:00:00`));
  if (granularity === "week") return key;
  if (granularity === "year") return key;
  if (granularity === "quarter") {
    const [year, quarter] = key.split("-");
    return `${quarter} ${year}`;
  }
  return monthLabel(key);
}

function bucketKeysInRange(range: { start: string; end: string }, granularity: TrendGranularity) {
  const start = new Date(`${range.start}T00:00:00`);
  const end = new Date(`${range.end}T00:00:00`);
  if (start > end) return [];
  const keys: string[] = [];
  if (granularity === "year") {
    for (let year = start.getFullYear(); year <= end.getFullYear(); year += 1) keys.push(String(year));
  } else if (granularity === "quarter") {
    let cursor = new Date(start.getFullYear(), Math.floor(start.getMonth() / 3) * 3, 1);
    const last = new Date(end.getFullYear(), Math.floor(end.getMonth() / 3) * 3, 1);
    while (cursor <= last) {
      keys.push(`${cursor.getFullYear()}-Q${Math.floor(cursor.getMonth() / 3) + 1}`);
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 3, 1);
    }
  } else if (granularity === "month") {
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cursor <= last) {
      keys.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
      cursor.setMonth(cursor.getMonth() + 1);
    }
  } else if (granularity === "day") {
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    while (cursor <= end) {
      keys.push(isoDate(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
  } else {
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    cursor.setDate(cursor.getDate() - ((cursor.getDay() || 7) - 1));
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    last.setDate(last.getDate() - ((last.getDay() || 7) - 1));
    while (cursor <= last) {
      keys.push(trendWeekKey(isoDate(cursor)));
      cursor.setDate(cursor.getDate() + 7);
    }
  }
  return keys;
}

export function aggregateTrendData(inspections: InspectionRecord[], complaints: ComplaintRecord[], filters: DashboardFilters, range = getDateRange(filters)): TrendPoint[] {
  const granularity = getTrendGranularity(filters);
  const keys = bucketKeysInRange(range, granularity);
  return keys.map((key, index) => {
    const bucketInspections = inspections.filter((row) => trendBucketKey(row.date, granularity) === key);
    const bucketComplaints = complaints.filter((row) => trendBucketKey(row.complaintDate, granularity) === key);
    const result = calculateMetrics(bucketInspections, bucketComplaints);
    const rollingKeys = keys.slice(Math.max(0, index - 2), index + 1);
    const rollingInspections = inspections.filter((row) => rollingKeys.includes(trendBucketKey(row.date, granularity)));
    const rollingQppm = calculateMetrics(rollingInspections, []).rejectPpm;
    const scrapCost = bucketInspections.reduce((sum, row) => sum + row.scrapCost, 0);
    const reworkCost = bucketInspections.reduce((sum, row) => sum + row.reworkCost, 0);
    const externalCosts = bucketComplaints.reduce((sum, row) => {
      const cost = externalCostBreakdown(row);
      sum.scrap += cost.scrap;
      sum.rework += cost.rework;
      return sum;
    }, { scrap: 0, rework: 0 });
    return {
      key,
      label: trendBucketLabel(key, granularity),
      fpy: result.fpy === null ? null : Number(result.fpy.toFixed(1)),
      rejectPpm: result.rejectPpm === null ? null : Math.round(result.rejectPpm),
      rollingQppm: rollingQppm === null ? null : Math.round(rollingQppm),
      scrapCost,
      reworkCost,
      externalScrapCost: externalCosts.scrap,
      externalReworkCost: externalCosts.rework,
      internal: scrapCost + reworkCost,
      external: externalCosts.scrap + externalCosts.rework
    };
  });
}

export type PartTypeTrendPoint = {
  key: string;
  label: string;
  npiQuantity: number;
  productionQuantity: number;
  totalQuantity: number;
  fpy: number | null;
};

/** Returns a quantity-axis domain for stacked NPI/Production bars. */
export function getPartTypeTrendYAxisDomain(points: PartTypeTrendPoint[]): [number, number] {
  const max = Math.max(0, ...points.map((point) => point.totalQuantity).filter((value) => Number.isFinite(value)));
  if (!max) return [0, 100];
  const step = max >= 1_000 ? 500 : max >= 100 ? 50 : 10;
  const upper = Math.max(step, Math.ceil((max * 1.15) / step) * step);
  return [0, upper];
}

/** Aggregates NPI/Production quantities and the matching FPY line by trend period. */
export function aggregatePartTypeTrendData(
  inspections: InspectionRecord[],
  complaints: ComplaintRecord[],
  deliveries: DeliveryRecord[],
  filters: DashboardFilters,
  range = getDateRange(filters)
): PartTypeTrendPoint[] {
  const complaintView = filters.stage === "customer-complaint";
  const granularity: TrendGranularity = complaintView ? "month" : getTrendGranularity(filters);
  const keys = bucketKeysInRange(range, granularity);
  return keys.map((key) => {
    const bucketInspections = inspections.filter((row) => trendBucketKey(row.date, granularity) === key);
    const bucketComplaints = complaints.filter((row) => trendBucketKey(row.complaintDate, granularity) === key);
    const npiQuantity = complaintView
      ? bucketComplaints.filter((row) => (row.partType || "Production") === "NPI").reduce((sum, row) => sum + row.affectedQty, 0)
      : bucketInspections.filter((row) => (row.partType || "Production") === "NPI").reduce((sum, row) => sum + row.reworkQty + row.scrapQty, 0);
    const productionQuantity = complaintView
      ? bucketComplaints.filter((row) => (row.partType || "Production") === "Production").reduce((sum, row) => sum + row.affectedQty, 0)
      : bucketInspections.filter((row) => (row.partType || "Production") === "Production").reduce((sum, row) => sum + row.reworkQty + row.scrapQty, 0);
    const totalQuantity = npiQuantity + productionQuantity;
    const fpy = complaintView
      ? (() => {
          const deliveredQty = deliveries
            .filter((row) => trendBucketKey(`${row.month}-01`, "month") === key)
            .reduce((sum, row) => sum + row.deliveredQty, 0);
          const affectedQty = bucketComplaints.reduce((sum, row) => sum + row.affectedQty, 0);
          return deliveredQty ? Math.max(0, Number((100 - (affectedQty / deliveredQty) * 100).toFixed(1))) : null;
        })()
      : (() => {
          const result = calculateMetrics(bucketInspections, []);
          return result.fpy === null ? null : Number(result.fpy.toFixed(1));
        })();
    return { key, label: trendBucketLabel(key, granularity), npiQuantity, productionQuantity, totalQuantity, fpy };
  });
}

export function aggregateComplaintTrendData(complaints: ComplaintRecord[], deliveries: DeliveryRecord[], operation: OperationKey, filters: DashboardFilters, range = getDateRange(filters)): TrendPoint[] {
  // Delivery records are monthly, so complaint rates remain monthly even when
  // the inspection trend is shown by day or week.
  const granularity: TrendGranularity = "month";
  const keys = bucketKeysInRange(range, granularity);
  const scopedComplaints = complaints.filter((row) => row.complaintDate >= range.start && row.complaintDate <= range.end && (operation === "all" || row.operation === operation));
  const scopedDeliveries = deliveries.filter((row) => row.month >= range.start.slice(0, 7) && row.month <= range.end.slice(0, 7) && (operation === "all" || row.operation === operation));
  const deliveryBucketKey = (month: string) => trendBucketKey(`${month}-01`, granularity);
  return keys.map((key, index) => {
    const bucketComplaints = scopedComplaints.filter((row) => trendBucketKey(row.complaintDate, granularity) === key);
    const bucketDeliveries = scopedDeliveries.filter((row) => deliveryBucketKey(row.month) === key);
    const affectedQty = bucketComplaints.reduce((sum, row) => sum + row.affectedQty, 0);
    const deliveredQty = bucketDeliveries.reduce((sum, row) => sum + row.deliveredQty, 0);
    const rollingKeys = keys.slice(Math.max(0, index - 2), index + 1);
    const rollingAffectedQty = scopedComplaints.filter((row) => rollingKeys.includes(trendBucketKey(row.complaintDate, granularity))).reduce((sum, row) => sum + row.affectedQty, 0);
    const rollingDeliveredQty = scopedDeliveries.filter((row) => rollingKeys.includes(deliveryBucketKey(row.month))).reduce((sum, row) => sum + row.deliveredQty, 0);
    const externalCosts = bucketComplaints.reduce((sum, row) => {
      const cost = externalCostBreakdown(row);
      sum.scrap += cost.scrap;
      sum.rework += cost.rework;
      return sum;
    }, { scrap: 0, rework: 0 });
    return {
      key,
      label: trendBucketLabel(key, granularity),
      fpy: deliveredQty ? Math.max(0, Number((100 - (affectedQty / deliveredQty) * 100).toFixed(1))) : null,
      rejectPpm: deliveredQty ? Math.round((affectedQty / deliveredQty) * 1_000_000) : null,
      rollingQppm: rollingDeliveredQty ? Math.round((rollingAffectedQty / rollingDeliveredQty) * 1_000_000) : null,
      scrapCost: 0,
      reworkCost: 0,
      externalScrapCost: externalCosts.scrap,
      externalReworkCost: externalCosts.rework,
      internal: 0,
      external: externalCosts.scrap + externalCosts.rework
    };
  });
}

export function filterInspections(rows: InspectionRecord[], operation: OperationKey, filters: DashboardFilters, range = getDateRange(filters)) {
  const search = filters.search.trim().toLowerCase();
  const relations = getFilterRelations(rows, operation, filters);
  return rows.filter((row) => {
    const rowLevel1 = row.rejectCategoryLevel1 || deriveRejectCategoryLevel1(row.defectCategory);
    const rowLevel2 = row.rejectCategoryLevel2 || deriveRejectCategoryLevel2(row.process, row.defectCategory);
    const rowLevel2Key = rejectCategoryLevel2Key(rowLevel2);
    const searchable = `${row.id} ${row.partNumber} ${row.partName} ${row.partType} ${row.workOrder} ${row.lotNumber} ${row.machine} ${rowLevel1} ${rowLevel2} ${row.defectCategory}`.toLowerCase();
    return row.date >= range.start && row.date <= range.end
      && (operation === "all" || row.operation === operation)
      && (filters.stage === "all" || row.stage === filters.stage)
      && (relations.effectiveProcess === "all" || row.process === relations.effectiveProcess)
      && (relations.effectiveWorkCenter === "all" || row.workCenter === relations.effectiveWorkCenter)
      && (filters.stage === "in-process" || filters.stage === "outgoing" || filters.supplier === "all" || row.supplier === filters.supplier)
      && (filters.partNumber === "all" || row.partNumber === filters.partNumber)
      && (filters.partType === "all" || row.partType === filters.partType)
      && (filters.shift === "all" || row.shift === filters.shift)
      && (filters.defectCategory === "all" || row.defectCategory === filters.defectCategory)
      && (filters.rejectCategoryLevel1 === undefined || filters.rejectCategoryLevel1 === "all" || rowLevel1 === filters.rejectCategoryLevel1)
      && (filters.rejectCategoryLevel2 === undefined || filters.rejectCategoryLevel2 === "all" || rowLevel2Key === filters.rejectCategoryLevel2)
      && (!search || searchable.includes(search));
  });
}

export function filterComplaints(rows: ComplaintRecord[], operation: OperationKey, range: { start: string; end: string }, filters?: Partial<Pick<DashboardFilters, "customer" | "partNumber" | "partType" | "defectCategory" | "process" | "rejectCategoryLevel1" | "rejectCategoryLevel2">>) {
  return rows.filter((row) => {
    const level1 = row.rejectCategoryLevel1 || deriveRejectCategoryLevel1(row.defectCategory);
    const level2 = rejectCategoryLevel2Key(row.rejectCategoryLevel2 || deriveRejectCategoryLevel2(row.process, row.defectCategory));
    return row.complaintDate >= range.start && row.complaintDate <= range.end
      && (operation === "all" || row.operation === operation)
      && (!filters?.customer || filters.customer === "all" || row.customer === filters.customer)
      && (!filters?.process || filters.process === "all" || row.process === filters.process)
      && (!filters?.partNumber || filters.partNumber === "all" || row.partNumber === filters.partNumber)
      && (!filters?.partType || filters.partType === "all" || row.partType === filters.partType)
      && (!filters?.defectCategory || filters.defectCategory === "all" || row.defectCategory === filters.defectCategory)
      && (!filters?.rejectCategoryLevel1 || filters.rejectCategoryLevel1 === "all" || level1 === filters.rejectCategoryLevel1)
      && (!filters?.rejectCategoryLevel2 || filters.rejectCategoryLevel2 === "all" || level2 === filters.rejectCategoryLevel2);
  });
}

export function groupComplaintRecords(rows: ComplaintRecord[], key: "defectCategory" | "process" | "partNumber" | "customer"): ComplaintAnalysisGroup[] {
  const groups = new Map<string, ComplaintAnalysisGroup>();
  rows.forEach((row) => {
    const name = row[key] || "Unassigned";
    const current = groups.get(name) ?? { name, affectedQty: 0, cases: 0, externalFailureCost: 0 };
    current.affectedQty += row.affectedQty;
    current.cases += 1;
    current.externalFailureCost += row.externalFailureCost;
    groups.set(name, current);
  });
  return Array.from(groups.values()).sort((left, right) => right.affectedQty - left.affectedQty);
}

/** Groups complaint affected quantity by the shared Level 1 defect family. */
export function groupComplaintRejectCategories(rows: ComplaintRecord[], limit = 6) {
  return groupSum(rows, (row) => row.rejectCategoryLevel1 || deriveRejectCategoryLevel1(row.defectCategory), (row) => row.affectedQty).slice(0, limit);
}

export type CustomerComplaintPerformance = ComplaintAnalysisGroup & {
  deliveredQty: number;
  complaintPpm: number | null;
};

/** Compares each customer's complaint exposure with matching customer deliveries, with a legacy aggregate fallback. */
export function aggregateCustomerComplaintPerformance(
  complaints: ComplaintRecord[],
  deliveries: DeliveryRecord[],
  operation: OperationKey,
  range: { start: string; end: string },
  limit = 6
): CustomerComplaintPerformance[] {
  const scopedComplaints = complaints.filter((row) => row.complaintDate >= range.start && row.complaintDate <= range.end && (operation === "all" || row.operation === operation));
  const scopedDeliveries = deliveries
    .filter((row) => row.month >= range.start.slice(0, 7) && row.month <= range.end.slice(0, 7) && (operation === "all" || row.operation === operation));
  const namedDeliveries = new Map<string, number>();
  scopedDeliveries.forEach((row) => {
    const customer = row.customer?.trim();
    if (customer) namedDeliveries.set(customer, (namedDeliveries.get(customer) ?? 0) + row.deliveredQty);
  });
  const hasCustomerDeliveries = namedDeliveries.size > 0;
  const legacyDeliveredQty = scopedDeliveries.reduce((sum, row) => sum + row.deliveredQty, 0);
  return groupComplaintRecords(scopedComplaints, "customer").slice(0, limit).map((group) => {
    const deliveredQty = hasCustomerDeliveries ? (namedDeliveries.get(group.name) ?? 0) : legacyDeliveredQty;
    return { ...group, deliveredQty, complaintPpm: deliveredQty ? Math.round((group.affectedQty / deliveredQty) * 1_000_000) : null };
  });
}

export type PartContributionMetric = "rejectedQty" | "inspectedQty" | "failureCost";

export type PartContributionRow = {
  partNumber: string;
  partName: string;
  partType: PartType;
  inspectedQty: number;
  rejectedQty: number;
  rejectionRate: number | null;
  internalFailureCost: number;
  complaintAffectedQty: number;
  complaintCases: number;
  externalFailureCost: number;
  failureCost: number;
  inspectedShare: number;
  rejectedShare: number;
  failureCostShare: number;
};

export type PartContributionSummary = Omit<PartContributionRow, "partNumber" | "partName" | "inspectedShare" | "rejectedShare" | "failureCostShare"> & {
  inspectedShare: number;
  rejectedShare: number;
  failureCostShare: number;
};

export type PartContributionAnalysis = {
  groups: PartContributionSummary[];
  parts: PartContributionRow[];
};

/** Combines internal inspection loss and external complaint exposure by part lifecycle. */
export function aggregatePartContributions(inspections: InspectionRecord[], complaints: ComplaintRecord[]): PartContributionAnalysis {
  const parts = new Map<string, PartContributionRow>();
  const getPart = (partNumber: string, partType: PartType, partName = "") => {
    const key = `${partType}:${partNumber}`;
    const current = parts.get(key) ?? {
      partNumber, partName: partName || partNumber, partType, inspectedQty: 0, rejectedQty: 0, rejectionRate: null,
      internalFailureCost: 0, complaintAffectedQty: 0, complaintCases: 0, externalFailureCost: 0, failureCost: 0,
      inspectedShare: 0, rejectedShare: 0, failureCostShare: 0
    };
    if (partName && current.partName === current.partNumber) current.partName = partName;
    parts.set(key, current);
    return current;
  };
  inspections.forEach((row) => {
    const current = getPart(row.partNumber, row.partType || "Production", row.partName);
    current.inspectedQty += row.inspectedQty;
    current.rejectedQty += row.reworkQty + row.scrapQty;
    current.internalFailureCost += row.scrapCost + row.reworkCost;
  });
  complaints.forEach((row) => {
    const current = getPart(row.partNumber, row.partType || "Production");
    current.complaintAffectedQty += row.affectedQty;
    current.complaintCases += 1;
    current.externalFailureCost += row.externalFailureCost;
  });
  const rows = Array.from(parts.values()).map((row) => ({ ...row, failureCost: row.internalFailureCost + row.externalFailureCost }));
  const inspectedTotal = rows.reduce((sum, row) => sum + row.inspectedQty, 0);
  const rejectedTotal = rows.reduce((sum, row) => sum + row.rejectedQty, 0);
  const failureCostTotal = rows.reduce((sum, row) => sum + row.failureCost, 0);
  rows.forEach((row) => {
    row.rejectionRate = row.inspectedQty ? (row.rejectedQty / row.inspectedQty) * 100 : null;
    row.inspectedShare = inspectedTotal ? (row.inspectedQty / inspectedTotal) * 100 : 0;
    row.rejectedShare = rejectedTotal ? (row.rejectedQty / rejectedTotal) * 100 : 0;
    row.failureCostShare = failureCostTotal ? (row.failureCost / failureCostTotal) * 100 : 0;
  });
  const groups = (['NPI', 'Production'] as const).map((partType) => {
    const grouped = rows.filter((row) => row.partType === partType);
    const summary = grouped.reduce((total, row) => ({
      ...total,
      inspectedQty: total.inspectedQty + row.inspectedQty,
      rejectedQty: total.rejectedQty + row.rejectedQty,
      internalFailureCost: total.internalFailureCost + row.internalFailureCost,
      complaintAffectedQty: total.complaintAffectedQty + row.complaintAffectedQty,
      complaintCases: total.complaintCases + row.complaintCases,
      externalFailureCost: total.externalFailureCost + row.externalFailureCost,
      failureCost: total.failureCost + row.failureCost
    }), { partType, inspectedQty: 0, rejectedQty: 0, rejectionRate: null, internalFailureCost: 0, complaintAffectedQty: 0, complaintCases: 0, externalFailureCost: 0, failureCost: 0, inspectedShare: 0, rejectedShare: 0, failureCostShare: 0 } as PartContributionSummary);
    summary.rejectionRate = summary.inspectedQty ? (summary.rejectedQty / summary.inspectedQty) * 100 : null;
    summary.inspectedShare = inspectedTotal ? (summary.inspectedQty / inspectedTotal) * 100 : 0;
    summary.rejectedShare = rejectedTotal ? (summary.rejectedQty / rejectedTotal) * 100 : 0;
    summary.failureCostShare = failureCostTotal ? (summary.failureCost / failureCostTotal) * 100 : 0;
    return summary;
  });
  return { groups, parts: rows.sort((left, right) => right.rejectedQty - left.rejectedQty || right.failureCost - left.failureCost) };
}

export function calculateMetrics(inspections: InspectionRecord[], complaints: ComplaintRecord[]): QualityMetrics {
  const inspectedQty = inspections.reduce((sum, row) => sum + row.inspectedQty, 0);
  const firstPassGoodQty = inspections.reduce((sum, row) => sum + row.firstPassGoodQty, 0);
  const reworkQty = inspections.reduce((sum, row) => sum + row.reworkQty, 0);
  const scrapQty = inspections.reduce((sum, row) => sum + row.scrapQty, 0);
  const internalCost = inspections.reduce((sum, row) => sum + row.scrapCost + row.reworkCost, 0);
  const externalCost = complaints.reduce((sum, row) => sum + row.externalFailureCost, 0);
  const complaintAffectedQty = complaints.reduce((sum, row) => sum + row.affectedQty, 0);
  const completed = inspections.filter((row) => Boolean(row.inspectionCompletedDate)).length;
  return {
    inspectedQty, firstPassGoodQty, reworkQty, scrapQty,
    fpy: inspectedQty ? (firstPassGoodQty / inspectedQty) * 100 : null,
    rejectPpm: inspectedQty ? ((reworkQty + scrapQty) / inspectedQty) * 1_000_000 : null,
    scrapRate: inspectedQty ? (scrapQty / inspectedQty) * 100 : null,
    copq: internalCost + externalCost,
    rejectionCost: internalCost,
    inspectionCompletion: inspections.length ? (completed / inspections.length) * 100 : null,
    complaintCount: complaints.length,
    complaintAffectedQty
  };
}

export function calculateComplaintMetrics(complaints: ComplaintRecord[], deliveries: DeliveryRecord[]): ComplaintMetrics {
  const deliveredQty = deliveries.reduce((sum, row) => sum + row.deliveredQty, 0);
  const affectedQty = complaints.reduce((sum, row) => sum + row.affectedQty, 0);
  return {
    deliveredQty,
    affectedQty,
    complaintCount: complaints.length,
    rejectionCost: complaints.reduce((sum, row) => sum + row.externalFailureCost, 0),
    fpy: deliveredQty ? Math.max(0, 100 - (affectedQty / deliveredQty) * 100) : null,
    rejectPpm: deliveredQty ? (affectedQty / deliveredQty) * 1_000_000 : null
  };
}

export function loadStoredDataset(): QualityDataset {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return sampleDataset;
    const parsed = JSON.parse(stored) as QualityDataset;
    if (!parsed.inspections?.length || !parsed.complaints || !parsed.targets) return sampleDataset;
    const complaints = parsed.complaints.map((row) => {
      const process = row.process || "Unassigned";
      const bundledRow = sampleDataset.complaints.find((candidate) => candidate.id === row.id && candidate.externalFailureCost === row.externalFailureCost);
      const costs = externalCostBreakdown({
        ...row,
        externalScrapCost: Number.isFinite(row.externalScrapCost) ? row.externalScrapCost : bundledRow?.externalScrapCost,
        externalReworkCost: Number.isFinite(row.externalReworkCost) ? row.externalReworkCost : bundledRow?.externalReworkCost
      });
      return {
        ...row,
        process,
        externalScrapCost: costs.scrap,
        externalReworkCost: costs.rework,
        partType: row.partType === "NPI" ? "NPI" : "Production" as PartType,
        rejectCategoryLevel1: row.rejectCategoryLevel1 || deriveRejectCategoryLevel1(row.defectCategory),
        rejectCategoryLevel2: row.rejectCategoryLevel2 || deriveRejectCategoryLevel2(process, row.defectCategory)
      };
    });
    const legacyLevel2Names = new Set(["Burr / sharp edge", "Hole position drift", "Dimensional tolerance", "Wrong material thickness", "Bend angle error", "Coating defect", "Scratch / dent", "Concentricity / runout", "Thread failure", "Surface finish", "Weld porosity"]);
    const inspections = parsed.inspections.map((row) => ({
      ...row,
      partType: row.partType === "NPI" ? "NPI" : "Production" as PartType,
      rejectCategoryLevel1: row.rejectCategoryLevel1 || deriveRejectCategoryLevel1(row.defectCategory),
      rejectCategoryLevel2: !row.rejectCategoryLevel2 || row.rejectCategoryLevel2 === row.defectCategory || legacyLevel2Names.has(row.rejectCategoryLevel2)
        ? deriveRejectCategoryLevel2(row.process, row.defectCategory)
        : row.rejectCategoryLevel2
    }));
    const deliveries = Array.isArray(parsed.deliveries) ? parsed.deliveries.map((row) => ({ ...row, customer: row.customer?.trim() || "" })) : sampleDataset.deliveries;
    return { ...parsed, inspections, complaints, deliveries };
  } catch {
    return sampleDataset;
  }
}

export function persistDataset(dataset: QualityDataset) { localStorage.setItem(STORAGE_KEY, JSON.stringify(dataset)); }
export function clearStoredDataset() { localStorage.removeItem(STORAGE_KEY); }

function normalizeOperation(value: unknown): ProductionOperation | null {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/_/g, "-").replace(/ /g, "-");
  if (normalized === "sheet-metal" || normalized === "sm") return "sheet-metal";
  if (normalized === "precision-machining" || normalized === "machining" || normalized === "pm") return "precision-machining";
  return null;
}

function normalizeStage(value: unknown): InspectionStage | null {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/_/g, "-").replace(/ /g, "-");
  if (normalized === "incoming" || normalized === "iqc") return "incoming";
  if (normalized === "in-process" || normalized === "ipqc" || normalized === "process") return "in-process";
  if (normalized === "outgoing" || normalized === "oqc") return "outgoing";
  return null;
}

function normalizePartType(value: unknown): PartType | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "npi") return "NPI";
  if (normalized === "production" || normalized === "prod") return "Production";
  return null;
}

function numberValue(value: unknown) {
  if (value === "" || value === null || value === undefined) return Number.NaN;
  return Number(String(value).replace(/,/g, ""));
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isValidIsoMonth(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function textValue(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) if (row[key] !== undefined) {
    const value = String(row[key] ?? "").trim();
    return value.toUpperCase() === "N/A" ? "" : value;
  }
  return "";
}

const EXPORT_EMPTY_VALUE = "N/A";

function exportText(value: string | undefined) {
  const normalized = String(value ?? "").trim();
  return normalized || EXPORT_EMPTY_VALUE;
}

function sameMasterValue(left: string | undefined, right: string | undefined) {
  return String(left ?? "").trim().toLocaleLowerCase() === String(right ?? "").trim().toLocaleLowerCase();
}

function activeMasterData(masterData?: MasterDataState) {
  if (!masterData) return null;
  return {
    suppliers: masterData.suppliers.filter((row) => row.status === "Active"),
    customers: masterData.customers.filter((row) => row.status === "Active"),
    parts: masterData.parts.filter((row) => row.status === "Active"),
    processRoutes: masterData.processRoutes.filter((row) => row.status === "Active"),
    defectLevel1: masterData.defectLevel1.filter((row) => row.status === "Active"),
    defectLevel2: masterData.defectLevel2.filter((row) => row.status === "Active")
  };
}

function parseInspections(rows: Array<Record<string, unknown>>, masterData?: MasterDataState) {
  const issues: ValidationIssue[] = [];
  const inspections: InspectionRecord[] = [];
  const seenIds = new Set<string>();
  const active = activeMasterData(masterData);
  rows.forEach((row, index) => {
    const excelRow = index + 2;
    const operation = normalizeOperation(row.Operation ?? row.operation);
    const stage = normalizeStage(row.Stage ?? row.stage);
    const id = textValue(row, "ID", "Id", "id");
    const duplicateId = Boolean(id && seenIds.has(id));
    if (id) seenIds.add(id);
    const date = textValue(row, "Date", "date");
    const process = textValue(row, "Process", "process");
    const workCenter = textValue(row, "Work Center", "workCenter");
    const machine = textValue(row, "Machine", "machine");
    const supplier = textValue(row, "Supplier", "supplier");
    const partNumber = textValue(row, "Part Number", "partNumber");
    const partTypeValue = textValue(row, "Part Type", "partType");
    const partType = partTypeValue ? normalizePartType(partTypeValue) : "Production";
    const inspectedQty = numberValue(row["Inspected Qty"] ?? row.inspectedQty);
    const firstPassGoodQty = numberValue(row["First Pass Good Qty"] ?? row.firstPassGoodQty);
    const reworkQty = numberValue(row["Rework Qty"] ?? row.reworkQty);
    const scrapQty = numberValue(row["Scrap Qty"] ?? row.scrapQty);
    const scrapCost = numberValue(row["Scrap Cost"] ?? row.scrapCost);
    const reworkCost = numberValue(row["Rework Cost"] ?? row.reworkCost);
    const defectCategory = textValue(row, "Defect Category", "defectCategory");
    const level1Value = textValue(row, "Reject Category Level 1", "rejectCategoryLevel1");
    const rejectCategoryLevel1 = level1Value ? level1Value as RejectCategoryLevel1 : deriveRejectCategoryLevel1(defectCategory);
    const level2Value = textValue(row, "Reject Category Level 2", "rejectCategoryLevel2");
    const derivedLevel2 = deriveRejectCategoryLevel2(process, defectCategory);
    const rejectCategoryLevel2 = level2Value || derivedLevel2;
    const requiredText: Array<[string, string]> = [["ID", id], ["Date", date], ["Part Number", partNumber]];
    if (stage && stage !== "incoming") requiredText.push(["Process", process], ["Work Center", workCenter]);
    requiredText.forEach(([field, value]) => { if (!value) issues.push({ sheet: "Inspections", row: excelRow, field, message: "Required value is missing" }); });
    if (!operation) issues.push({ sheet: "Inspections", row: excelRow, field: "Operation", message: "Use Sheet Metal or Precision Machining" });
    if (!stage) issues.push({ sheet: "Inspections", row: excelRow, field: "Stage", message: "Use Incoming, In-Process, or Outgoing" });
    if (partTypeValue && !partType) issues.push({ sheet: "Inspections", row: excelRow, field: "Part Type", message: "Use NPI or Production" });
    if (!isValidIsoDate(date)) issues.push({ sheet: "Inspections", row: excelRow, field: "Date", message: "Use a valid calendar date in YYYY-MM-DD format" });
    if (duplicateId) issues.push({ sheet: "Inspections", row: excelRow, field: "ID", message: "Inspection ID must be unique" });
    if (active && operation && partType) {
      const part = active.parts.find((candidate) => sameMasterValue(candidate.partNumber, partNumber));
      if (!part) issues.push({ sheet: "Inspections", row: excelRow, field: "Part Number", message: "Choose an active part from Database Settings" });
      else {
        if (part.operation !== operation) issues.push({ sheet: "Inspections", row: excelRow, field: "Operation", message: "Operation does not match the selected part" });
        if (part.partType !== partType) issues.push({ sheet: "Inspections", row: excelRow, field: "Part Type", message: "Part type does not match the selected part" });
      }
      if (stage === "incoming" && supplier && !active.suppliers.some((candidate) => sameMasterValue(candidate.name, supplier))) issues.push({ sheet: "Inspections", row: excelRow, field: "Supplier", message: "Choose an active supplier from Database Settings" });
      const route = stage && stage !== "incoming" ? active.processRoutes.find((candidate) => candidate.operation === operation && sameMasterValue(candidate.process, process) && sameMasterValue(candidate.workCenter, workCenter) && (!machine || sameMasterValue(candidate.machine, machine))) : undefined;
      if (stage && stage !== "incoming" && !route) issues.push({ sheet: "Inspections", row: excelRow, field: "Process route", message: "Process, work center, and machine must match an active route" });
      const level1 = level1Value ? active.defectLevel1.find((candidate) => sameMasterValue(candidate.name, level1Value)) : undefined;
      if (level1Value && !level1) issues.push({ sheet: "Inspections", row: excelRow, field: "Reject Category Level 1", message: "Choose an active Level 1 category" });
      if (level1 && process && route && masterData && !activeDefectLevel1ForProcess(masterData, process).some((candidate) => candidate.id === level1.id)) issues.push({ sheet: "Inspections", row: excelRow, field: "Reject Category Level 1", message: "Level 1 category is not available for the selected process" });
      const level2 = level2Value ? active.defectLevel2.find((candidate) => sameMasterValue(candidate.reason, level2Value)) : undefined;
      if (level2Value && !level2) issues.push({ sheet: "Inspections", row: excelRow, field: "Reject Category Level 2", message: "Choose an active Level 2 reason" });
      if (level2 && level1 && level2.level1Id !== level1.id) issues.push({ sheet: "Inspections", row: excelRow, field: "Reject Category Level 2", message: "Level 2 reason is not linked to the selected Level 1 category" });
      if (level2 && route && !level2.processIds.includes(route.id)) issues.push({ sheet: "Inspections", row: excelRow, field: "Reject Category Level 2", message: "Level 2 reason is not linked to the selected process route" });
      if (level2 && level1 && route && masterData && isFocusedPaintProcess(process) && !activeDefectLevel2ForProcessAndLevel1(masterData, process, level1.id).some((candidate) => candidate.id === level2.id)) issues.push({ sheet: "Inspections", row: excelRow, field: "Reject Category Level 2", message: "Level 2 reason is not available for the selected process and Level 1 category" });
    }
    const quantities: Array<[string, number]> = [["Inspected Qty", inspectedQty], ["First Pass Good Qty", firstPassGoodQty], ["Rework Qty", reworkQty], ["Scrap Qty", scrapQty], ["Scrap Cost", scrapCost], ["Rework Cost", reworkCost]];
    quantities.forEach(([field, value]) => { if (!Number.isFinite(value) || value < 0) issues.push({ sheet: "Inspections", row: excelRow, field, message: "Enter a non-negative number" }); });
    if (Number.isFinite(inspectedQty) && Number.isFinite(firstPassGoodQty) && Number.isFinite(reworkQty) && Number.isFinite(scrapQty) && firstPassGoodQty + reworkQty + scrapQty !== inspectedQty) issues.push({ sheet: "Inspections", row: excelRow, field: "Quantities", message: "First-pass good, rework, and scrap must equal inspected quantity" });
    const dueDate = textValue(row, "Inspection Due Date", "inspectionDueDate");
    const completedDate = textValue(row, "Inspection Completed Date", "inspectionCompletedDate");
    if (dueDate && !isValidIsoDate(dueDate)) issues.push({ sheet: "Inspections", row: excelRow, field: "Inspection Due Date", message: "Use a valid calendar date in YYYY-MM-DD format" });
    if (completedDate && !isValidIsoDate(completedDate)) issues.push({ sheet: "Inspections", row: excelRow, field: "Inspection Completed Date", message: "Use a valid calendar date in YYYY-MM-DD format" });
    if (issues.some((issue) => issue.sheet === "Inspections" && issue.row === excelRow)) return;
    inspections.push({
      id, date, operation: operation!, stage: stage!, process, workCenter, machine,
      shift: textValue(row, "Shift", "shift") === "Night" ? "Night" : "Day", supplier,
      partNumber, partName: textValue(row, "Part Name", "partName"), partType: partType!, workOrder: textValue(row, "Work Order", "workOrder"),
      lotNumber: textValue(row, "Lot Number", "lotNumber"), inspectedQty, firstPassGoodQty, reworkQty, scrapQty, scrapCost, reworkCost,
      inspectionDueDate: dueDate, inspectionCompletedDate: completedDate,
      defectCategory, rejectCategoryLevel1, rejectCategoryLevel2, defectCode: textValue(row, "Defect Code", "defectCode"),
      rootCause: textValue(row, "Root Cause", "rootCause"), disposition: textValue(row, "Disposition", "disposition"),
      severity: (["Critical", "Major", "Minor"].includes(textValue(row, "Severity", "severity")) ? textValue(row, "Severity", "severity") : "Minor") as Severity
    });
  });
  return { inspections, issues };
}

function parseComplaints(rows: Array<Record<string, unknown>>, masterData?: MasterDataState) {
  const issues: ValidationIssue[] = [];
  const complaints: ComplaintRecord[] = [];
  const seenIds = new Set<string>();
  const active = activeMasterData(masterData);
  rows.forEach((row, index) => {
    const excelRow = index + 2;
    const id = textValue(row, "ID", "Id", "id");
    const complaintDate = textValue(row, "Complaint Date", "complaintDate");
    const operation = normalizeOperation(row.Operation ?? row.operation);
    const customer = textValue(row, "Customer", "customer");
    const process = textValue(row, "Process", "process") || "Unassigned";
    const partNumber = textValue(row, "Part Number", "partNumber");
    const partTypeValue = textValue(row, "Part Type", "partType");
    const partType = partTypeValue ? normalizePartType(partTypeValue) : "Production";
    const defectCategory = textValue(row, "Defect Category", "defectCategory");
    const level1Value = textValue(row, "Reject Category Level 1", "rejectCategoryLevel1");
    const rejectCategoryLevel1 = level1Value ? level1Value as RejectCategoryLevel1 : deriveRejectCategoryLevel1(defectCategory);
    const level2Value = textValue(row, "Reject Category Level 2", "rejectCategoryLevel2");
    const derivedLevel2 = deriveRejectCategoryLevel2(process, defectCategory);
    const rejectCategoryLevel2 = level2Value || derivedLevel2;
    const affectedQty = numberValue(row["Affected Qty"] ?? row.affectedQty);
    const externalFailureCost = numberValue(row["External Failure Cost"] ?? row.externalFailureCost);
    const externalScrapValue = numberValue(row["External Scrap Cost"] ?? row.externalScrapCost);
    const externalReworkValue = numberValue(row["External Rework Cost"] ?? row.externalReworkCost);
    const hasExternalScrapCost = Number.isFinite(externalScrapValue);
    const hasExternalReworkCost = Number.isFinite(externalReworkValue);
    const externalScrapCost = hasExternalScrapCost ? externalScrapValue : hasExternalReworkCost ? externalFailureCost - externalReworkValue : externalFailureCost;
    const externalReworkCost = hasExternalReworkCost ? externalReworkValue : hasExternalScrapCost ? externalFailureCost - externalScrapValue : 0;
    if (!id || !complaintDate || !operation || !customer || !partNumber) issues.push({ sheet: "Complaints", row: excelRow, field: "Required fields", message: "ID, date, operation, customer, and part number are required" });
    if (complaintDate && !isValidIsoDate(complaintDate)) issues.push({ sheet: "Complaints", row: excelRow, field: "Complaint Date", message: "Use a valid calendar date in YYYY-MM-DD format" });
    if (partTypeValue && !partType) issues.push({ sheet: "Complaints", row: excelRow, field: "Part Type", message: "Use NPI or Production" });
    const knownLevel1Names = masterData ? active?.defectLevel1.map((candidate) => candidate.name) ?? [] : [...rejectCategoryLevel1Values, "Cleaning & Chemical Treatment", "Surface Condition & Corrosion", "Appearance & Coverage", "Adhesion, Cure & Colour"];
    if (level1Value && !knownLevel1Names.some((name) => sameMasterValue(name, level1Value))) issues.push({ sheet: "Complaints", row: excelRow, field: "Reject Category Level 1", message: "Choose an active Level 1 category" });
    // Without master data we can only validate against the legacy process catalog.
    // When master data is supplied, the relationship checks below validate the
    // active reason, its Level 1 link, and its process-route links instead.
    if (!masterData && level2Value && level2Value !== derivedLevel2 && !level2ReasonsForProcess(process).includes(level2Value)) issues.push({ sheet: "Complaints", row: excelRow, field: "Reject Category Level 2", message: "Choose a Level 2 reason for the selected process" });
    const duplicateId = Boolean(id && seenIds.has(id));
    if (id) seenIds.add(id);
    if (duplicateId) issues.push({ sheet: "Complaints", row: excelRow, field: "ID", message: "Complaint ID must be unique" });
    if (active && operation && partType) {
      if (!active.customers.some((candidate) => sameMasterValue(candidate.name, customer))) issues.push({ sheet: "Complaints", row: excelRow, field: "Customer", message: "Choose an active customer from Database Settings" });
      const part = active.parts.find((candidate) => sameMasterValue(candidate.partNumber, partNumber));
      if (!part) issues.push({ sheet: "Complaints", row: excelRow, field: "Part Number", message: "Choose an active part from Database Settings" });
      else {
        if (part.operation !== operation) issues.push({ sheet: "Complaints", row: excelRow, field: "Operation", message: "Operation does not match the selected part" });
        if (part.partType !== partType) issues.push({ sheet: "Complaints", row: excelRow, field: "Part Type", message: "Part type does not match the selected part" });
      }
      const routes = active.processRoutes.filter((candidate) => candidate.operation === operation && sameMasterValue(candidate.process, process));
      if (!routes.length) issues.push({ sheet: "Complaints", row: excelRow, field: "Process", message: "Choose a process from an active route" });
      const level1 = level1Value ? active.defectLevel1.find((candidate) => sameMasterValue(candidate.name, level1Value)) : undefined;
      if (level1Value && !level1) issues.push({ sheet: "Complaints", row: excelRow, field: "Reject Category Level 1", message: "Choose an active Level 1 category" });
      if (level1 && process !== "Unassigned" && routes.length && masterData && !activeDefectLevel1ForProcess(masterData, process).some((candidate) => candidate.id === level1.id)) issues.push({ sheet: "Complaints", row: excelRow, field: "Reject Category Level 1", message: "Level 1 category is not available for the selected process" });
      const level2 = level2Value ? active.defectLevel2.find((candidate) => sameMasterValue(candidate.reason, level2Value)) : undefined;
      if (level2Value && !level2) issues.push({ sheet: "Complaints", row: excelRow, field: "Reject Category Level 2", message: "Choose an active Level 2 reason" });
      if (level2 && level1 && level2.level1Id !== level1.id) issues.push({ sheet: "Complaints", row: excelRow, field: "Reject Category Level 2", message: "Level 2 reason is not linked to the selected Level 1 category" });
      if (level2 && routes.length && !routes.some((route) => level2.processIds.includes(route.id))) issues.push({ sheet: "Complaints", row: excelRow, field: "Reject Category Level 2", message: "Level 2 reason is not linked to the selected process" });
      if (level2 && level1 && process !== "Unassigned" && routes.length && masterData && isFocusedPaintProcess(process) && !activeDefectLevel2ForProcessAndLevel1(masterData, process, level1.id).some((candidate) => candidate.id === level2.id)) issues.push({ sheet: "Complaints", row: excelRow, field: "Reject Category Level 2", message: "Level 2 reason is not available for the selected process and Level 1 category" });
    }
    if (!Number.isFinite(affectedQty) || affectedQty < 0 || !Number.isFinite(externalFailureCost) || externalFailureCost < 0 || externalScrapCost < 0 || externalReworkCost < 0) issues.push({ sheet: "Complaints", row: excelRow, field: "Quantities", message: "Affected quantity and costs must be non-negative numbers" });
    if (Number.isFinite(externalScrapCost) && Number.isFinite(externalReworkCost) && Math.abs(externalScrapCost + externalReworkCost - externalFailureCost) > 0.01) issues.push({ sheet: "Complaints", row: excelRow, field: "External Failure Cost", message: "External scrap and rework costs must equal external failure cost" });
    if (issues.some((issue) => issue.sheet === "Complaints" && issue.row === excelRow)) return;
    complaints.push({
      id, complaintDate, operation: operation!, customer, process, partNumber, partType: partType!, defectCategory, rejectCategoryLevel1, rejectCategoryLevel2,
      affectedQty, externalFailureCost, externalScrapCost, externalReworkCost, severity: (["Critical", "Major", "Minor"].includes(textValue(row, "Severity", "severity")) ? textValue(row, "Severity", "severity") : "Minor") as Severity,
      status: textValue(row, "Status", "status") === "Open" ? "Open" : "Closed"
    });
  });
  return { complaints, issues };
}

function parseDeliveries(rows: Array<Record<string, unknown>>, masterData?: MasterDataState) {
  const issues: ValidationIssue[] = [];
  const deliveries: DeliveryRecord[] = [];
  const seen = new Set<string>();
  const seenIds = new Set<string>();
  const active = activeMasterData(masterData);
  rows.forEach((row, index) => {
    const excelRow = index + 2;
    const id = textValue(row, "ID", "Id", "id");
    const month = textValue(row, "Month", "month");
    const operation = normalizeOperation(row.Operation ?? row.operation);
    const customer = textValue(row, "Customer", "customer");
    const deliveredQty = numberValue(row["Delivered Qty"] ?? row.deliveredQty);
    const key = `${month}|${operation ?? ""}|${customer}`;
    if (!id || !isValidIsoMonth(month) || !operation) issues.push({ sheet: "Deliveries", row: excelRow, field: "Required fields", message: "ID, month (YYYY-MM), and operation are required" });
    const duplicateId = Boolean(id && seenIds.has(id));
    if (id) seenIds.add(id);
    if (duplicateId) issues.push({ sheet: "Deliveries", row: excelRow, field: "ID", message: "Delivery ID must be unique" });
    if (!Number.isFinite(deliveredQty) || deliveredQty < 0) issues.push({ sheet: "Deliveries", row: excelRow, field: "Delivered Qty", message: "Delivered quantity must be a non-negative number" });
    if (active && customer && !active.customers.some((candidate) => sameMasterValue(candidate.name, customer))) issues.push({ sheet: "Deliveries", row: excelRow, field: "Customer", message: "Choose an active customer from Database Settings" });
    if (seen.has(key)) issues.push({ sheet: "Deliveries", row: excelRow, field: "Month, operation, and customer", message: "Only one delivery row is allowed per month, operation, and customer" });
    if (issues.some((issue) => issue.sheet === "Deliveries" && issue.row === excelRow)) return;
    seen.add(key);
    deliveries.push({ id, month, operation: operation!, customer, deliveredQty });
  });
  return { deliveries, issues };
}

function parseTargets(rows: Array<Record<string, unknown>>, fallback: QualityTargets) {
  const targets = structuredClone(fallback);
  const issues: ValidationIssue[] = [];
  rows.forEach((row, index) => {
    const rawOperation = textValue(row, "Operation", "operation").toLowerCase();
    const operation: OperationKey | null = rawOperation === "all operations" || rawOperation === "all" ? "all" : normalizeOperation(rawOperation);
    if (!operation) { issues.push({ sheet: "Targets", row: index + 2, field: "Operation", message: "Unknown operation" }); return; }
    const values = {
      fpy: numberValue(row["Acceptance Rate Target"] ?? row["FPY Target"] ?? row.fpy), rejectPpm: numberValue(row["Reject PPM Target"] ?? row.rejectPpm),
      complaintFpy: numberValue(row["Complaint Acceptance Target"] ?? row.complaintFpy ?? 99.5), complaintRejectPpm: numberValue(row["Complaint Reject PPM Target"] ?? row.complaintRejectPpm ?? 5000),
      scrapRate: numberValue(row["Scrap Rate Target"] ?? row.scrapRate), copq: numberValue(row["COPQ Target"] ?? row.copq),
      inspectionCompletion: numberValue(row["Inspection Completion Target"] ?? row.inspectionCompletion)
    };
    if (Object.values(values).some((value) => !Number.isFinite(value) || value < 0)) { issues.push({ sheet: "Targets", row: index + 2, field: "Targets", message: "All targets must be non-negative numbers" }); return; }
    targets[operation] = values;
  });
  return { targets, issues };
}

type XlsxModule = typeof import("xlsx");
let xlsxLoader: Promise<XlsxModule> | null = null;
async function loadXlsx() { xlsxLoader ??= import("xlsx/xlsx.mjs") as Promise<XlsxModule>; return xlsxLoader; }

export async function parseQualityWorkbook(file: File, masterData?: MasterDataState): Promise<ImportPreview> {
  const XLSX = await loadXlsx();
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
  const inspectionSheetName = workbook.SheetNames.find((name) => name.toLowerCase() === "inspections") ?? (file.name.toLowerCase().endsWith(".csv") ? workbook.SheetNames[0] : undefined);
  const complaintSheetName = workbook.SheetNames.find((name) => name.toLowerCase() === "complaints");
  const deliverySheetName = workbook.SheetNames.find((name) => name.toLowerCase() === "deliveries");
  const targetSheetName = workbook.SheetNames.find((name) => name.toLowerCase() === "targets");
  const missingIssues: ValidationIssue[] = inspectionSheetName ? [] : [{ sheet: "Inspections", row: 1, field: "Sheet", message: "An Inspections sheet is required" }];
  const inspectionRows = inspectionSheetName ? XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[inspectionSheetName], { raw: false, defval: "" }) : [];
  const complaintRows = complaintSheetName ? XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[complaintSheetName], { raw: false, defval: "" }) : [];
  const deliveryRows = deliverySheetName ? XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[deliverySheetName], { raw: false, defval: "" }) : [];
  const targetRows = targetSheetName ? XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[targetSheetName], { raw: false, defval: "" }) : [];
  const parsedInspections = parseInspections(inspectionRows, masterData);
  const parsedComplaints = parseComplaints(complaintRows, masterData);
  const parsedDeliveries = deliverySheetName ? parseDeliveries(deliveryRows, masterData) : { deliveries: [], issues: [] as ValidationIssue[] };
  const parsedTargets = parseTargets(targetRows, defaultTargets);
  return { fileName: file.name, dataset: { inspections: parsedInspections.inspections, complaints: parsedComplaints.complaints, deliveries: parsedDeliveries.deliveries, targets: parsedTargets.targets }, issues: [...missingIssues, ...parsedInspections.issues, ...parsedComplaints.issues, ...parsedDeliveries.issues, ...parsedTargets.issues] };
}

function rowsToSheet(XLSX: XlsxModule, rows: Array<Record<string, string | number>>, widths: number[]) {
  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet["!cols"] = widths.map((wch) => ({ wch }));
  sheet["!autofilter"] = sheet["!ref"] ? { ref: sheet["!ref"] } : undefined;
  return sheet;
}

const inspectionHeaders = ["ID", "Date", "Operation", "Stage", "Process", "Work Center", "Machine", "Shift", "Supplier", "Part Number", "Part Name", "Part Type", "Work Order", "Lot Number", "Inspected Qty", "First Pass Good Qty", "Rework Qty", "Scrap Qty", "Scrap Cost", "Rework Cost", "Inspection Due Date", "Inspection Completed Date", "Reject Category Level 1", "Reject Category Level 2", "Defect Category", "Defect Code", "Root Cause", "Disposition", "Severity"];
const complaintHeaders = ["ID", "Complaint Date", "Operation", "Customer", "Process", "Part Number", "Part Type", "Reject Category Level 1", "Reject Category Level 2", "Defect Category", "Affected Qty", "External Failure Cost", "External Scrap Cost", "External Rework Cost", "Severity", "Status"];
const deliveryHeaders = ["ID", "Month", "Operation", "Customer", "Delivered Qty"];
const targetHeaders = ["Operation", "Acceptance Rate Target", "Reject PPM Target", "Complaint Acceptance Target", "Complaint Reject PPM Target", "Scrap Rate Target", "COPQ Target", "Inspection Completion Target"];

function headerSheet(XLSX: XlsxModule, headers: string[], widths: number[]) {
  const sheet = XLSX.utils.aoa_to_sheet([headers]);
  sheet["!cols"] = widths.map((wch) => ({ wch }));
  sheet["!autofilter"] = sheet["!ref"] ? { ref: sheet["!ref"] } : undefined;
  return sheet;
}

type ValidationList = { name: string; values: string[] };

const validationHeaderNames: Record<string, string> = {
  Operation: "QualityOperation",
  Stage: "QualityStage",
  Process: "QualityProcess",
  "Work Center": "QualityWorkCenter",
  Machine: "QualityMachine",
  Shift: "QualityShift",
  Supplier: "QualitySupplier",
  Customer: "QualityCustomer",
  "Part Number": "QualityPartNumber",
  "Part Name": "QualityPartName",
  "Part Type": "QualityPartType",
  "Reject Category Level 1": "QualityRejectCategoryLevel1",
  "Reject Category Level 2": "QualityRejectCategoryLevel2",
  "Defect Category": "QualityDefectCategory",
  Disposition: "QualityDisposition",
  Severity: "QualitySeverity",
  Status: "QualityComplaintStatus"
};

export function buildValidationLists(dataset: QualityDataset, masterData?: MasterDataState): ValidationList[] {
  const inspectionRows = dataset.inspections;
  const complaintRows = dataset.complaints;
  const active = activeMasterData(masterData);
  const values = (items: string[], fallback: string[] = []) => uniqueValues([...items, ...fallback]);
  return [
    { name: "QualityOperation", values: values([], ["Sheet Metal", "Precision Machining"]) },
    { name: "QualityStage", values: ["Incoming", "In-Process", "Outgoing"] },
    { name: "QualityProcess", values: active ? values(active.processRoutes.map((row) => row.process)) : values([...inspectionRows.map((row) => row.process), ...Object.keys(level2DefectCatalog), ...complaintRows.map((row) => row.process)]) },
    { name: "QualityWorkCenter", values: active ? values(active.processRoutes.map((row) => row.workCenter)) : values(inspectionRows.map((row) => row.workCenter)) },
    { name: "QualityMachine", values: active ? values(active.processRoutes.map((row) => row.machine)) : values(inspectionRows.map((row) => row.machine)) },
    { name: "QualityShift", values: ["Day", "Night"] },
    { name: "QualitySupplier", values: active ? values(active.suppliers.map((row) => row.name)) : values(inspectionRows.map((row) => row.supplier)) },
    { name: "QualityCustomer", values: active ? values(active.customers.map((row) => row.name)) : values(complaintRows.map((row) => row.customer)) },
    { name: "QualityPartNumber", values: active ? values(active.parts.map((row) => row.partNumber)) : values([...inspectionRows.map((row) => row.partNumber), ...complaintRows.map((row) => row.partNumber)]) },
    { name: "QualityPartName", values: active ? values(active.parts.map((row) => row.name)) : values(inspectionRows.map((row) => row.partName)) },
    { name: "QualityPartType", values: ["NPI", "Production"] },
    { name: "QualityRejectCategoryLevel1", values: active ? values(active.defectLevel1.map((row) => row.name)) : rejectCategoryLevel1Values },
    { name: "QualityRejectCategoryLevel2", values: active ? values(active.defectLevel2.map((row) => row.reason)) : values([...Object.values(level2DefectCatalog).flat(), ...inspectionRows.map((row) => row.rejectCategoryLevel2), ...complaintRows.map((row) => row.rejectCategoryLevel2 || deriveRejectCategoryLevel2(row.process, row.defectCategory))]) },
    { name: "QualityDefectCategory", values: active ? values(active.defectLevel2.map((row) => row.reason)) : values([...inspectionRows.map((row) => row.defectCategory), ...complaintRows.map((row) => row.defectCategory)]) },
    { name: "QualityDisposition", values: values(inspectionRows.map((row) => row.disposition)) },
    { name: "QualitySeverity", values: ["Critical", "Major", "Minor"] },
    { name: "QualityComplaintStatus", values: ["Open", "Closed"] }
  ];
}

function addValidationListSheet(XLSX: XlsxModule, workbook: ReturnType<XlsxModule["utils"]["book_new"]>, dataset: QualityDataset, masterData?: MasterDataState) {
  const lists = buildValidationLists(dataset, masterData);
  const rows: Array<Array<string>> = [lists.map((list) => list.name)];
  const maxRows = Math.max(...lists.map((list) => list.values.length));
  for (let index = 0; index < maxRows; index += 1) rows.push(lists.map((list) => list.values[index] ?? ""));
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = lists.map(() => ({ wch: 34 }));
  XLSX.utils.book_append_sheet(workbook, sheet, "Validation Lists");
  workbook.Workbook = {
    ...(workbook.Workbook ?? {}),
    Sheets: workbook.SheetNames.map((name) => ({ name, Hidden: name === "Validation Lists" ? 1 : 0 })),
    Names: lists.map((list, index) => ({ Name: list.name, Ref: `'Validation Lists'!$${encodeColumn(index)}$2:$${encodeColumn(index)}$${list.values.length + 1}` }))
  };
}

function encodeColumn(index: number) {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

export async function buildQualityHeaderWorkbook(dataset: QualityDataset = sampleDataset, masterData?: MasterDataState) {
  const XLSX = await loadXlsx();
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, headerSheet(XLSX, inspectionHeaders, [14, 12, 22, 14, 20, 20, 20, 10, 20, 16, 27, 15, 24, 14, 18, 12, 12, 14, 14, 20, 34, 28, 24, 20, 25, 24, 14, 20]), "Inspections");
  XLSX.utils.book_append_sheet(workbook, headerSheet(XLSX, complaintHeaders, [14, 14, 22, 24, 22, 16, 15, 36, 30, 24, 14, 20, 20, 20, 12, 10]), "Complaints");
  XLSX.utils.book_append_sheet(workbook, headerSheet(XLSX, deliveryHeaders, [14, 12, 22, 24, 16]), "Deliveries");
  XLSX.utils.book_append_sheet(workbook, headerSheet(XLSX, targetHeaders, [24, 14, 20, 24, 28, 20, 16, 28]), "Targets");
  addValidationListSheet(XLSX, workbook, dataset, masterData);
  return workbook;
}

type ManualTemplateRow = Record<string, string | number>;

function uniqueValues(values: string[]) { return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right)); }

function buildManualInspectionRows(dataset: QualityDataset, masterData?: MasterDataState): ManualTemplateRow[] {
  const active = activeMasterData(masterData);
  const processRows = active
    ? active.defectLevel2.flatMap((defect) => defect.processIds.flatMap((processId) => {
      const route = active.processRoutes.find((candidate) => candidate.id === processId);
      const level1 = active.defectLevel1.find((candidate) => candidate.id === defect.level1Id);
      return route && level1 ? [{ process: route.process, reason: defect.reason, level1: level1.name }] : [];
    }))
    : Object.entries(level2DefectCatalog).flatMap(([process, reasons]) => reasons.map((reason) => ({ process, reason, level1: deriveRejectCategoryLevel1(reason) })));
  return processRows.map(({ process, reason, level1 }) => ({
    ID: "", Date: "", Operation: "", Stage: "", Process: process, "Work Center": "", Machine: "", Shift: "", Supplier: "",
    "Part Number": "", "Part Name": "", "Part Type": "", "Work Order": "", "Lot Number": "", "Inspected Qty": "", "First Pass Good Qty": "", "Rework Qty": "", "Scrap Qty": "", "Scrap Cost": "", "Rework Cost": "", "Inspection Due Date": "", "Inspection Completed Date": "",
    "Reject Category Level 1": level1, "Reject Category Level 2": reason, "Defect Category": reason, "Defect Code": "", "Root Cause": "", Disposition: "", Severity: ""
  }));
}

function buildReferenceRows(dataset: QualityDataset, masterData?: MasterDataState): ManualTemplateRow[] {
  const rows: ManualTemplateRow[] = [];
  const active = activeMasterData(masterData);
  const add = (type: string, values: string[], process = "") => values.forEach((value) => rows.push({ "Reference Type": type, Process: process, Value: value }));
  add("Reject category Level 1", active ? active.defectLevel1.map((row) => row.name) : ["Drawing/specification nonconformance", "Cosmetic / appearance", "Material / component", "Functional / performance", "Process / workmanship", "Missing / incorrect part", "Other"]);
  if (active) active.defectLevel2.forEach((defect) => defect.processIds.forEach((processId) => { const route = active.processRoutes.find((candidate) => candidate.id === processId); const level1 = active.defectLevel1.find((candidate) => candidate.id === defect.level1Id); if (route && level1) rows.push({ "Reference Type": "Reject category Level 2", Process: route.process, "Level 1": level1.name, Value: defect.reason }); }));
  else Object.entries(level2DefectCatalog).forEach(([process, reasons]) => reasons.forEach((reason) => rows.push({ "Reference Type": "Reject category Level 2", Process: process, "Level 1": deriveRejectCategoryLevel1(reason), Value: reason })));
  add("Operation", uniqueValues(dataset.inspections.map((row) => operationMeta[row.operation].label)));
  add("Stage", ["Incoming", "In-Process", "Outgoing"]);
  add("Shift", ["Day", "Night"]);
  add("Supplier", uniqueValues(active ? active.suppliers.map((row) => row.name) : dataset.inspections.map((row) => row.supplier)));
  add("Customer", uniqueValues(active ? active.customers.map((row) => row.name) : dataset.complaints.map((row) => row.customer)));
  add("Process", uniqueValues(active ? active.processRoutes.map((row) => row.process) : dataset.inspections.map((row) => row.process)));
  add("Work Center", uniqueValues(active ? active.processRoutes.map((row) => row.workCenter) : dataset.inspections.map((row) => row.workCenter)));
  add("Machine", uniqueValues(active ? active.processRoutes.map((row) => row.machine) : dataset.inspections.map((row) => row.machine)));
  add("Part Number", uniqueValues(active ? active.parts.map((row) => row.partNumber) : dataset.inspections.map((row) => row.partNumber)));
  add("Part Type", ["NPI", "Production"]);
  add("Disposition", uniqueValues(dataset.inspections.map((row) => row.disposition)));
  add("Severity", ["Critical", "Major", "Minor"]);
  return rows;
}

export async function buildQualityManualWorkbook(dataset: QualityDataset, masterData?: MasterDataState) {
  const XLSX = await loadXlsx();
  const workbook = XLSX.utils.book_new();
  const inspections = buildManualInspectionRows(dataset, masterData);
  XLSX.utils.book_append_sheet(workbook, rowsToSheet(XLSX, inspections, [14, 12, 22, 14, 24, 20, 20, 10, 20, 16, 27, 15, 24, 14, 18, 12, 12, 14, 14, 20, 34, 28, 24, 20, 25, 24, 14, 20]), "Inspections");
  XLSX.utils.book_append_sheet(workbook, headerSheet(XLSX, complaintHeaders, [14, 14, 22, 24, 22, 16, 15, 36, 30, 24, 14, 20, 20, 20, 12, 10]), "Complaints");
  XLSX.utils.book_append_sheet(workbook, headerSheet(XLSX, deliveryHeaders, [14, 12, 22, 24, 16]), "Deliveries");
  XLSX.utils.book_append_sheet(workbook, headerSheet(XLSX, targetHeaders, [24, 14, 20, 24, 28, 20, 16, 28]), "Targets");
  XLSX.utils.book_append_sheet(workbook, rowsToSheet(XLSX, buildReferenceRows(dataset, masterData), [28, 24, 36, 34]), "Reference Lists");
  addValidationListSheet(XLSX, workbook, dataset, masterData);
  return workbook;
}

let cfbLoader: Promise<typeof import("cfb")> | null = null;
async function loadCfb() {
  cfbLoader ??= import("cfb");
  return cfbLoader;
}

const validationHeadersBySheet: Record<string, string[]> = {
  Inspections: inspectionHeaders,
  Complaints: complaintHeaders,
  Deliveries: deliveryHeaders,
  Targets: targetHeaders
};

function addValidationXml(xml: string, sheetName: string) {
  const headers = validationHeadersBySheet[sheetName] ?? [];
  const validations = headers.flatMap((header, index) => {
    const name = validationHeaderNames[header];
    if (!name) return [];
    const column = encodeColumn(index);
    return `<dataValidation type="list" allowBlank="1" showErrorMessage="1" errorStyle="stop" errorTitle="Invalid value" error="Choose a value from the dropdown list." sqref="${column}2:${column}1000"><formula1>${name}</formula1></dataValidation>`;
  });
  if (!validations.length || xml.includes("<dataValidations")) return xml;
  const block = `<dataValidations count="${validations.length}">${validations.join("")}</dataValidations>`;
  const ignoredErrorsIndex = xml.indexOf("<ignoredErrors");
  const insertionIndex = ignoredErrorsIndex >= 0 ? ignoredErrorsIndex : xml.indexOf("</worksheet>");
  return insertionIndex >= 0 ? `${xml.slice(0, insertionIndex)}${block}${xml.slice(insertionIndex)}` : xml;
}

export async function buildQualityTemplateBytes(workbook: Awaited<ReturnType<typeof buildQualityHeaderWorkbook>>) {
  const XLSX = await loadXlsx();
  const CFB = await loadCfb();
  const source = XLSX.write(workbook, { type: "array", bookType: "xlsx", compression: true });
  const zip = CFB.read(new Uint8Array(source), { type: "array" });
  workbook.SheetNames.forEach((sheetName, index) => {
    if (!validationHeadersBySheet[sheetName]) return;
    const entry = CFB.find(zip, `Root Entry/xl/worksheets/sheet${index + 1}.xml`);
    if (!entry) return;
    const xml = new TextDecoder().decode(entry.content as Uint8Array);
    entry.content = new TextEncoder().encode(addValidationXml(xml, sheetName));
  });
  return CFB.write(zip, { type: "array", fileType: "zip", compression: true });
}

export async function downloadQualityHeaders(format: "xlsx" | "xls" | "csv", mode: "headers" | "manual" = "headers", dataset: QualityDataset = sampleDataset, masterData?: MasterDataState) {
  const XLSX = await loadXlsx();
  if (format === "csv") {
    const sheet = mode === "manual" ? rowsToSheet(XLSX, buildManualInspectionRows(dataset, masterData), [14, 12, 22, 14, 24, 20, 20, 10, 20, 16, 27, 15, 24, 14, 18, 12, 12, 14, 14, 20, 34, 28, 24, 20, 25, 24, 14, 20]) : headerSheet(XLSX, inspectionHeaders, [14, 12, 22, 14, 20, 20, 20, 10, 20, 16, 27, 15, 24, 14, 18, 12, 12, 14, 14, 20, 34, 28, 24, 20, 25, 24, 14, 20]);
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = mode === "manual" ? "quality-manual-template.csv" : "quality-inspections-headers.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }
  const workbook = mode === "manual" ? await buildQualityManualWorkbook(dataset, masterData) : await buildQualityHeaderWorkbook(dataset, masterData);
  if (format === "xlsx") {
    const bytes = await buildQualityTemplateBytes(workbook);
    const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = mode === "manual" ? "quality-manual-template.xlsx" : "quality-import-headers.xlsx";
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }
  XLSX.writeFile(workbook, mode === "manual" ? `quality-manual-template.${format}` : `quality-import-headers.${format}`, { bookType: format, compression: true });
}

export async function buildQualityWorkbook(dataset: QualityDataset) {
  const XLSX = await loadXlsx();
  const workbook = XLSX.utils.book_new();
  const inspections = dataset.inspections.map((row) => {
    // Keep exported values aligned with the filter panel's stage applicability.
    // N/A is a display placeholder only; import parsing converts it back to an
    // empty value so an exported workbook remains reloadable.
    const incoming = row.stage === "incoming";
    const supplierUnavailable = row.stage === "in-process" || row.stage === "outgoing";
    return {
      ID: exportText(row.id), Date: exportText(row.date), Operation: operationMeta[row.operation].label, Stage: stageMeta[row.stage].label,
      Process: incoming ? EXPORT_EMPTY_VALUE : exportText(row.process), "Work Center": incoming ? EXPORT_EMPTY_VALUE : exportText(row.workCenter), Machine: incoming ? EXPORT_EMPTY_VALUE : exportText(row.machine), Shift: exportText(row.shift), Supplier: supplierUnavailable ? EXPORT_EMPTY_VALUE : exportText(row.supplier),
      "Part Number": exportText(row.partNumber), "Part Name": exportText(row.partName), "Part Type": exportText(row.partType), "Work Order": incoming ? EXPORT_EMPTY_VALUE : exportText(row.workOrder), "Lot Number": exportText(row.lotNumber),
      "Inspected Qty": row.inspectedQty, "First Pass Good Qty": row.firstPassGoodQty, "Rework Qty": row.reworkQty, "Scrap Qty": row.scrapQty,
      "Scrap Cost": row.scrapCost, "Rework Cost": row.reworkCost, "Inspection Due Date": exportText(row.inspectionDueDate),
      "Inspection Completed Date": exportText(row.inspectionCompletedDate), "Reject Category Level 1": exportText(row.rejectCategoryLevel1), "Reject Category Level 2": exportText(row.rejectCategoryLevel2), "Defect Category": exportText(row.defectCategory), "Defect Code": exportText(row.defectCode),
      "Root Cause": exportText(row.rootCause), Disposition: exportText(row.disposition), Severity: exportText(row.severity)
    };
  });
  const complaints = dataset.complaints.map((row) => ({
    ID: exportText(row.id), "Complaint Date": exportText(row.complaintDate), Operation: operationMeta[row.operation].label, Customer: exportText(row.customer), Process: exportText(row.process),
    "Part Number": exportText(row.partNumber), "Part Type": exportText(row.partType), "Reject Category Level 1": exportText(row.rejectCategoryLevel1 || deriveRejectCategoryLevel1(row.defectCategory)), "Reject Category Level 2": exportText(row.rejectCategoryLevel2 || deriveRejectCategoryLevel2(row.process, row.defectCategory)), "Defect Category": exportText(row.defectCategory), "Affected Qty": row.affectedQty,
    "External Failure Cost": row.externalFailureCost, "External Scrap Cost": row.externalScrapCost ?? row.externalFailureCost, "External Rework Cost": row.externalReworkCost ?? 0, Severity: exportText(row.severity), Status: exportText(row.status)
  }));
  const deliveries = dataset.deliveries.map((row) => ({ ID: exportText(row.id), Month: exportText(row.month), Operation: operationMeta[row.operation].label, Customer: exportText(row.customer), "Delivered Qty": row.deliveredQty }));
  const targets = (Object.keys(dataset.targets) as OperationKey[]).map((operation) => ({
    Operation: operationMeta[operation].label, "Acceptance Rate Target": dataset.targets[operation].fpy,
    "Reject PPM Target": dataset.targets[operation].rejectPpm, "Complaint Acceptance Target": dataset.targets[operation].complaintFpy, "Complaint Reject PPM Target": dataset.targets[operation].complaintRejectPpm, "Scrap Rate Target": dataset.targets[operation].scrapRate,
    "COPQ Target": dataset.targets[operation].copq, "Inspection Completion Target": dataset.targets[operation].inspectionCompletion
  }));
  XLSX.utils.book_append_sheet(workbook, rowsToSheet(XLSX, inspections, [14, 12, 22, 14, 20, 20, 20, 10, 20, 16, 27, 15, 24, 14, 18, 12, 12, 14, 14, 20, 34, 28, 24, 20, 25, 24, 14, 20, 22, 14]), "Inspections");
  XLSX.utils.book_append_sheet(workbook, rowsToSheet(XLSX, complaints, [14, 14, 22, 24, 22, 16, 15, 36, 30, 24, 14, 20, 20, 20, 12, 10]), "Complaints");
  XLSX.utils.book_append_sheet(workbook, rowsToSheet(XLSX, deliveries, [14, 12, 22, 24, 16]), "Deliveries");
  XLSX.utils.book_append_sheet(workbook, rowsToSheet(XLSX, targets, [24, 14, 20, 24, 28, 20, 16, 28]), "Targets");
  return workbook;
}

export async function downloadQualityWorkbook(dataset: QualityDataset, filename = "manufacturing-quality-data.xlsx") {
  const XLSX = await loadXlsx();
  const workbook = await buildQualityWorkbook(dataset);
  XLSX.writeFile(workbook, filename, { compression: true });
}

export function groupSum<T>(rows: T[], key: (row: T) => string, value: (row: T) => number) {
  const totals = new Map<string, number>();
  rows.forEach((row) => totals.set(key(row), (totals.get(key(row)) ?? 0) + value(row)));
  return Array.from(totals, ([name, total]) => ({ name, value: total })).sort((a, b) => b.value - a.value);
}

/** Groups rejected inspection quantity by the universal Level 1 defect family. */
export function groupRejectCategories(rows: InspectionRecord[], limit = 6) {
  return groupSum(rows, (row) => row.rejectCategoryLevel1 || deriveRejectCategoryLevel1(row.defectCategory), (row) => row.scrapQty + row.reworkQty).slice(0, limit);
}

export function rejectCategoryLevel2Key(reason: string) {
  return reason.trim() || "Unspecified defect";
}

/** Groups rejected quantity by Level 2 reason across the currently filtered processes. */
export function groupRejectCategoryLevel2(rows: InspectionRecord[], limit = 10) {
  const totals = new Map<string, { key: string; name: string; reason: string; value: number }>();
  rows.forEach((row) => {
    const reason = (row.rejectCategoryLevel2 || deriveRejectCategoryLevel2(row.process, row.defectCategory)).trim() || "Unspecified defect";
    const key = rejectCategoryLevel2Key(reason);
    const current = totals.get(key) ?? { key, name: reason, reason, value: 0 };
    current.value += row.scrapQty + row.reworkQty;
    totals.set(key, current);
  });
  return Array.from(totals.values()).sort((left, right) => right.value - left.value).slice(0, limit);
}

export type RejectCategoryLevel2Matrix = {
  granularity: "month" | "quarter" | "year";
  columns: Array<{ key: string; label: string }>;
  rows: Array<{ key: string; name: string; total: number; values: Record<string, number> }>;
  max: number;
};

/** Builds a period matrix for Level 2 reasons. Day/week selections stay monthly because the matrix is a period monitor. */
export function aggregateRejectCategoryLevel2Matrix(rows: InspectionRecord[], filters: DashboardFilters, range = getDateRange(filters), limit = 10): RejectCategoryLevel2Matrix {
  const selectedGranularity = getTrendGranularity(filters);
  const granularity: RejectCategoryLevel2Matrix["granularity"] = selectedGranularity === "quarter" ? "quarter" : selectedGranularity === "year" ? "year" : "month";
  const keys = bucketKeysInRange(range, granularity);
  const totals = new Map<string, { key: string; name: string; total: number; values: Record<string, number> }>();

  rows.forEach((row) => {
    const reason = (row.rejectCategoryLevel2 || deriveRejectCategoryLevel2(row.process, row.defectCategory)).trim() || "Unspecified defect";
    const key = rejectCategoryLevel2Key(reason);
    const bucket = trendBucketKey(row.date, granularity);
    const current = totals.get(key) ?? { key, name: reason, total: 0, values: {} };
    const quantity = row.scrapQty + row.reworkQty;
    current.total += quantity;
    current.values[bucket] = (current.values[bucket] ?? 0) + quantity;
    totals.set(key, current);
  });

  const matrixRows = Array.from(totals.values()).sort((left, right) => right.total - left.total).slice(0, limit > 0 ? limit : undefined);
  const max = Math.max(0, ...matrixRows.flatMap((row) => keys.map((key) => row.values[key] ?? 0)));
  return {
    granularity,
    columns: keys.map((key) => ({ key, label: trendBucketLabel(key, granularity) })),
    rows: matrixRows,
    max
  };
}

/** Builds the complaint Level 2 period matrix using affected customer quantity. */
export function aggregateComplaintRejectCategoryLevel2Matrix(rows: ComplaintRecord[], filters: DashboardFilters, range = getDateRange(filters), limit = 10): RejectCategoryLevel2Matrix {
  const selectedGranularity = getTrendGranularity(filters);
  const granularity: RejectCategoryLevel2Matrix["granularity"] = selectedGranularity === "quarter" ? "quarter" : selectedGranularity === "year" ? "year" : "month";
  const keys = bucketKeysInRange(range, granularity);
  const totals = new Map<string, { key: string; name: string; total: number; values: Record<string, number> }>();

  rows.forEach((row) => {
    const reason = (row.rejectCategoryLevel2 || deriveRejectCategoryLevel2(row.process, row.defectCategory)).trim() || "Unspecified defect";
    const key = rejectCategoryLevel2Key(reason);
    const bucket = trendBucketKey(row.complaintDate, granularity);
    const current = totals.get(key) ?? { key, name: reason, total: 0, values: {} };
    current.total += row.affectedQty;
    current.values[bucket] = (current.values[bucket] ?? 0) + row.affectedQty;
    totals.set(key, current);
  });

  const matrixRows = Array.from(totals.values()).sort((left, right) => right.total - left.total).slice(0, limit > 0 ? limit : undefined);
  const max = Math.max(0, ...matrixRows.flatMap((row) => keys.map((key) => row.values[key] ?? 0)));
  return {
    granularity,
    columns: keys.map((key) => ({ key, label: trendBucketLabel(key, granularity) })),
    rows: matrixRows,
    max
  };
}

export function monthKey(date: string) { return date.slice(0, 7); }
export function monthLabel(key: string) { return new Intl.DateTimeFormat("en-MY", { month: "short", year: "2-digit" }).format(new Date(`${key}-01T00:00:00`)); }
