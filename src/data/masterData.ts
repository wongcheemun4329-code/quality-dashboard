import type { MasterDataState, MasterOperation, MasterStatus } from "./accessControl";

export type MasterSection = keyof MasterDataState;
export type MasterImportIssue = { sheet: string; row: number; field: string; message: string };
export type MasterImportPreview = {
  next: MasterDataState;
  additions: number;
  updates: number;
  unchanged: number;
  issues: MasterImportIssue[];
  bySheet: Record<string, { additions: number; updates: number; unchanged: number; errors: number }>;
};

const sheets = ["Suppliers", "Customers", "Parts", "Process Routes", "Defect Level 1", "Defect Level 2"] as const;
type SheetName = typeof sheets[number];
const sheetSection: Record<SheetName, MasterSection> = { Suppliers: "suppliers", Customers: "customers", Parts: "parts", "Process Routes": "processRoutes", "Defect Level 1": "defectLevel1", "Defect Level 2": "defectLevel2" };
const headers: Record<SheetName, string[]> = {
  Suppliers: ["ID", "Name", "Country", "Status"], Customers: ["ID", "Name", "Country", "Status"],
  Parts: ["ID", "Part Number", "Name", "Part Type", "Operation", "Status"],
  "Process Routes": ["ID", "Process", "Operation", "Work Center", "Machine", "Status"],
  "Defect Level 1": ["ID", "Category Name", "Process IDs", "Status"],
  "Defect Level 2": ["ID", "Reason", "Level 1 ID", "Process IDs", "Status"]
};
const prefixes: Record<MasterSection, string> = { suppliers: "SUP", customers: "CUS", parts: "PRT", processRoutes: "PCR", defectLevel1: "DF1", defectLevel2: "DF2" };

function clean(value: unknown) { return String(value ?? "").trim(); }
function key(value: string) { return value.trim().toLocaleLowerCase(); }
function status(value: string): MasterStatus | null { return value === "Active" || value === "Inactive" ? value : null; }
function operation(value: string): MasterOperation | null { return value === "sheet-metal" || value === "precision-machining" ? value : null; }
function comparable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(comparable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([entryKey, entryValue]) => [entryKey, comparable(entryValue)]));
  return value;
}
function recordsEqual(left: unknown, right: unknown) { return JSON.stringify(comparable(left)) === JSON.stringify(comparable(right)); }
function nextId(section: MasterSection, records: Array<{ id: string }>, reserved: Set<string>) {
  const prefix = prefixes[section];
  let number = Math.max(0, ...records.map((record) => Number(record.id.match(/(\d+)$/)?.[1] ?? 0))) + 1;
  let candidate = `${prefix}-${String(number).padStart(3, "0")}`;
  while (reserved.has(candidate)) candidate = `${prefix}-${String(++number).padStart(3, "0")}`;
  reserved.add(candidate);
  return candidate;
}

export function validateMasterData(masterData: MasterDataState): MasterImportIssue[] {
  const issues: MasterImportIssue[] = [];
  const validateIds = (sheet: string, rows: Array<{ id: string }>) => {
    const seen = new Set<string>();
    rows.forEach((row, index) => {
      const normalized = key(row.id);
      if (!normalized) issues.push({ sheet, row: index + 2, field: "ID", message: "ID is required" });
      else if (seen.has(normalized)) issues.push({ sheet, row: index + 2, field: "ID", message: "Duplicate ID" });
      else seen.add(normalized);
    });
  };
  const duplicate = (sheet: string, rows: Array<{ id: string }>, value: (row: any) => string, label: string) => {
    const seen = new Map<string, string>();
    rows.forEach((row, index) => {
      const normalized = key(value(row));
      if (!normalized) issues.push({ sheet, row: index + 2, field: label, message: `${label} is required` });
      else if (seen.has(normalized)) issues.push({ sheet, row: index + 2, field: label, message: `Duplicate ${label.toLowerCase()}` });
      else seen.set(normalized, row.id);
    });
  };
  duplicate("Suppliers", masterData.suppliers, (row) => row.name, "Name");
  duplicate("Customers", masterData.customers, (row) => row.name, "Name");
  duplicate("Parts", masterData.parts, (row) => row.partNumber, "Part Number");
  duplicate("Process Routes", masterData.processRoutes, (row) => `${row.operation}|${row.process}|${row.workCenter}|${row.machine}`, "Route");
  duplicate("Defect Level 1", masterData.defectLevel1, (row) => row.name, "Category Name");
  duplicate("Defect Level 2", masterData.defectLevel2, (row) => `${row.reason}|${row.level1Id}|${[...row.processIds].sort().join(",")}`, "Taxonomy entry");
  sheets.forEach((sheet) => validateIds(sheet, masterData[sheetSection[sheet]] as Array<{ id: string }>));
  masterData.suppliers.forEach((row, index) => { if (!row.country.trim()) issues.push({ sheet: "Suppliers", row: index + 2, field: "Country", message: "Country is required" }); });
  masterData.customers.forEach((row, index) => { if (!row.country.trim()) issues.push({ sheet: "Customers", row: index + 2, field: "Country", message: "Country is required" }); });
  masterData.parts.forEach((row, index) => {
    if (!row.name.trim()) issues.push({ sheet: "Parts", row: index + 2, field: "Name", message: "Name is required" });
    if (!operation(row.operation)) issues.push({ sheet: "Parts", row: index + 2, field: "Operation", message: "Invalid operation" });
    if (row.partType !== "NPI" && row.partType !== "Production") issues.push({ sheet: "Parts", row: index + 2, field: "Part Type", message: "Part Type must be NPI or Production" });
  });
  masterData.processRoutes.forEach((row, index) => {
    if (!row.process.trim()) issues.push({ sheet: "Process Routes", row: index + 2, field: "Process", message: "Process is required" });
    if (!row.workCenter.trim()) issues.push({ sheet: "Process Routes", row: index + 2, field: "Work Center", message: "Work Center is required" });
    if (!row.machine.trim()) issues.push({ sheet: "Process Routes", row: index + 2, field: "Machine", message: "Machine is required" });
    if (!operation(row.operation)) issues.push({ sheet: "Process Routes", row: index + 2, field: "Operation", message: "Invalid operation" });
  });
  const level1Ids = new Set(masterData.defectLevel1.filter((row) => row.status === "Active").map((row) => row.id));
  const processIds = new Set(masterData.processRoutes.filter((row) => row.status === "Active").map((row) => row.id));
  const allProcessIds = new Set(masterData.processRoutes.map((row) => row.id));
  masterData.defectLevel1.forEach((row, index) => {
    if (!Array.isArray(row.processIds)) issues.push({ sheet: "Defect Level 1", row: index + 2, field: "Process IDs", message: "Process IDs must be a comma-separated list" });
    (row.processIds ?? []).forEach((id) => { if (!allProcessIds.has(id)) issues.push({ sheet: "Defect Level 1", row: index + 2, field: "Process IDs", message: `${id} is not a known process route` }); });
    if (row.status === "Active") (row.processIds ?? []).forEach((id) => { if (!processIds.has(id)) issues.push({ sheet: "Defect Level 1", row: index + 2, field: "Process IDs", message: `${id} is not an active process route` }); });
  });
  masterData.defectLevel2.forEach((row, index) => {
    if (!row.reason.trim()) issues.push({ sheet: "Defect Level 2", row: index + 2, field: "Reason", message: "Reason is required" });
    if (!row.level1Id.trim()) issues.push({ sheet: "Defect Level 2", row: index + 2, field: "Level 1 ID", message: "Level 1 ID is required" });
    if (!row.processIds.length) issues.push({ sheet: "Defect Level 2", row: index + 2, field: "Process IDs", message: "At least one process route is required" });
    if (row.status === "Active" && !level1Ids.has(row.level1Id)) issues.push({ sheet: "Defect Level 2", row: index + 2, field: "Level 1 ID", message: "Active entries must reference an active category" });
    if (row.status === "Active") row.processIds.forEach((id) => { if (!processIds.has(id)) issues.push({ sheet: "Defect Level 2", row: index + 2, field: "Process IDs", message: `${id} is not an active process route` }); });
  });
  return issues;
}

function parseRow(section: MasterSection, row: Record<string, unknown>, id: string) {
  const common = { id, status: (status(clean(row.Status)) ?? clean(row.Status)) as MasterStatus };
  if (section === "suppliers" || section === "customers") return { ...common, name: clean(row.Name), country: clean(row.Country) };
  if (section === "parts") return { ...common, partNumber: clean(row["Part Number"]), name: clean(row.Name), partType: clean(row["Part Type"]) as "NPI" | "Production", operation: clean(row.Operation) as MasterOperation };
  if (section === "processRoutes") return { ...common, process: clean(row.Process), operation: clean(row.Operation) as MasterOperation, workCenter: clean(row["Work Center"]), machine: clean(row.Machine) };
  if (section === "defectLevel1") return { ...common, name: clean(row["Category Name"]), processIds: clean(row["Process IDs"]).split(",").map((value) => value.trim()).filter(Boolean) };
  return { ...common, reason: clean(row.Reason), level1Id: clean(row["Level 1 ID"]), processIds: clean(row["Process IDs"]).split(",").map((value) => value.trim()).filter(Boolean) };
}

export async function parseMasterDataWorkbook(file: File | ArrayBuffer, current: MasterDataState): Promise<MasterImportPreview> {
  const XLSX = await import("xlsx");
  const buffer = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const next = structuredClone(current);
  const issues: MasterImportIssue[] = [];
  const bySheet = Object.fromEntries(sheets.map((name) => [name, { additions: 0, updates: 0, unchanged: 0, errors: 0 }])) as MasterImportPreview["bySheet"];
  for (const sheet of sheets) {
    const worksheet = workbook.Sheets[sheet];
    if (!worksheet) { issues.push({ sheet, row: 1, field: "Sheet", message: "Required sheet is missing" }); bySheet[sheet].errors += 1; continue; }
    const section = sheetSection[sheet];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" });
    const currentRows = next[section] as Array<any>;
    const knownIds = new Set(currentRows.map((row) => row.id));
    const reserved = new Set(knownIds);
    const seenSourceIds = new Set<string>();
    rows.forEach((source, index) => {
      const sourceId = clean(source.ID);
      if (sourceId && !knownIds.has(sourceId)) { issues.push({ sheet, row: index + 2, field: "ID", message: `Unknown ID ${sourceId}` }); bySheet[sheet].errors += 1; return; }
      if (sourceId && seenSourceIds.has(key(sourceId))) { issues.push({ sheet, row: index + 2, field: "ID", message: `ID ${sourceId} appears more than once in this sheet` }); bySheet[sheet].errors += 1; return; }
      if (sourceId) seenSourceIds.add(key(sourceId));
      const id = sourceId || nextId(section, currentRows, reserved);
      const parsed = parseRow(section, source, id) as any;
      if (!status(clean(source.Status))) { issues.push({ sheet, row: index + 2, field: "Status", message: "Status must be Active or Inactive" }); bySheet[sheet].errors += 1; }
      if (section === "parts" && !["NPI", "Production"].includes(parsed.partType)) { issues.push({ sheet, row: index + 2, field: "Part Type", message: "Part Type must be NPI or Production" }); bySheet[sheet].errors += 1; }
      if ((section === "parts" || section === "processRoutes") && !operation(parsed.operation)) { issues.push({ sheet, row: index + 2, field: "Operation", message: "Invalid operation" }); bySheet[sheet].errors += 1; }
      const existingIndex = currentRows.findIndex((row) => row.id === id);
      if (existingIndex < 0) { currentRows.push(parsed); bySheet[sheet].additions += 1; }
      else if (recordsEqual(currentRows[existingIndex], parsed)) bySheet[sheet].unchanged += 1;
      else { currentRows[existingIndex] = parsed; bySheet[sheet].updates += 1; }
    });
  }
  const relationshipIssues = validateMasterData(next);
  issues.push(...relationshipIssues);
  relationshipIssues.forEach((issue) => { if (bySheet[issue.sheet]) bySheet[issue.sheet].errors += 1; });
  return { next, additions: Object.values(bySheet).reduce((sum, row) => sum + row.additions, 0), updates: Object.values(bySheet).reduce((sum, row) => sum + row.updates, 0), unchanged: Object.values(bySheet).reduce((sum, row) => sum + row.unchanged, 0), issues, bySheet };
}

function rowsFor(masterData: MasterDataState, sheet: SheetName) {
  if (sheet === "Suppliers") return masterData.suppliers.map((row) => ({ ID: row.id, Name: row.name, Country: row.country, Status: row.status }));
  if (sheet === "Customers") return masterData.customers.map((row) => ({ ID: row.id, Name: row.name, Country: row.country, Status: row.status }));
  if (sheet === "Parts") return masterData.parts.map((row) => ({ ID: row.id, "Part Number": row.partNumber, Name: row.name, "Part Type": row.partType, Operation: row.operation, Status: row.status }));
  if (sheet === "Process Routes") return masterData.processRoutes.map((row) => ({ ID: row.id, Process: row.process, Operation: row.operation, "Work Center": row.workCenter, Machine: row.machine, Status: row.status }));
  if (sheet === "Defect Level 1") return masterData.defectLevel1.map((row) => ({ ID: row.id, "Category Name": row.name, "Process IDs": row.processIds.join(", "), Status: row.status }));
  return masterData.defectLevel2.map((row) => ({ ID: row.id, Reason: row.reason, "Level 1 ID": row.level1Id, "Process IDs": row.processIds.join(", "), Status: row.status }));
}

export async function buildMasterDataWorkbook(masterData: MasterDataState) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  sheets.forEach((sheet) => {
    const values = rowsFor(masterData, sheet);
    const worksheet = values.length ? XLSX.utils.json_to_sheet(values) : XLSX.utils.aoa_to_sheet([headers[sheet]]);
    worksheet["!cols"] = headers[sheet].map((header) => ({ wch: Math.max(14, header.length + 3) }));
    worksheet["!autofilter"] = { ref: `A1:${String.fromCharCode(64 + headers[sheet].length)}${Math.max(2, values.length + 1)}` };
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet);
  });
  const lists = [["Status", "Operation", "Part Type", "Level 1 ID", "Process ID"], ["Active", "sheet-metal", "NPI", ...[]], ["Inactive", "precision-machining", "Production", ...[]]] as string[][];
  const max = Math.max(masterData.defectLevel1.length, masterData.processRoutes.length, 2);
  for (let index = 0; index < max; index += 1) {
    lists[index + 1] ??= ["", "", "", "", ""];
    lists[index + 1][3] = masterData.defectLevel1[index]?.id ?? "";
    lists[index + 1][4] = masterData.processRoutes[index]?.id ?? "";
  }
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(lists), "Validation Lists");
  workbook.Workbook = {
    ...(workbook.Workbook ?? {}),
    Sheets: workbook.SheetNames.map((name) => ({ name, Hidden: name === "Validation Lists" ? 1 : 0 })),
    Names: [
      { Name: "MasterStatus", Ref: "'Validation Lists'!$A$2:$A$3" },
      { Name: "MasterOperation", Ref: "'Validation Lists'!$B$2:$B$3" },
      { Name: "MasterPartType", Ref: "'Validation Lists'!$C$2:$C$3" },
      { Name: "MasterLevel1Id", Ref: `'Validation Lists'!$D$2:$D$${masterData.defectLevel1.length + 1}` },
      { Name: "MasterProcessId", Ref: `'Validation Lists'!$E$2:$E$${masterData.processRoutes.length + 1}` }
    ]
  };
  return workbook;
}

const validationBySheet: Record<SheetName, Record<string, string>> = {
  Suppliers: { Status: "MasterStatus" }, Customers: { Status: "MasterStatus" },
  Parts: { "Part Type": "MasterPartType", Operation: "MasterOperation", Status: "MasterStatus" },
  "Process Routes": { Operation: "MasterOperation", Status: "MasterStatus" },
  "Defect Level 1": { "Process IDs": "MasterProcessId", Status: "MasterStatus" },
  "Defect Level 2": { "Level 1 ID": "MasterLevel1Id", "Process IDs": "MasterProcessId", Status: "MasterStatus" }
};

function encodeColumn(index: number) {
  let value = index + 1;
  let result = "";
  while (value > 0) { const remainder = (value - 1) % 26; result = String.fromCharCode(65 + remainder) + result; value = Math.floor((value - 1) / 26); }
  return result;
}

function addMasterValidationXml(xml: string, sheet: SheetName) {
  const validations = headers[sheet].flatMap((header, index) => {
    const listName = validationBySheet[sheet][header];
    if (!listName) return [];
    const column = encodeColumn(index);
    return `<dataValidation type="list" allowBlank="0" showErrorMessage="1" errorStyle="stop" errorTitle="Invalid value" error="Choose a value from the dropdown list." sqref="${column}2:${column}1000"><formula1>${listName}</formula1></dataValidation>`;
  });
  if (!validations.length || xml.includes("<dataValidations")) return xml;
  const block = `<dataValidations count="${validations.length}">${validations.join("")}</dataValidations>`;
  const insertionIndex = xml.indexOf("<ignoredErrors") >= 0 ? xml.indexOf("<ignoredErrors") : xml.indexOf("</worksheet>");
  return insertionIndex >= 0 ? `${xml.slice(0, insertionIndex)}${block}${xml.slice(insertionIndex)}` : xml;
}

export async function buildMasterDataWorkbookBytes(masterData: MasterDataState) {
  const XLSX = await import("xlsx");
  const CFB = await import("cfb");
  const workbook = await buildMasterDataWorkbook(masterData);
  const source = XLSX.write(workbook, { type: "array", bookType: "xlsx", compression: true });
  const zip = CFB.read(new Uint8Array(source), { type: "array" });
  sheets.forEach((sheet, index) => {
    const entry = CFB.find(zip, `Root Entry/xl/worksheets/sheet${index + 1}.xml`);
    if (!entry) return;
    const xml = new TextDecoder().decode(entry.content as Uint8Array);
    entry.content = new TextEncoder().encode(addMasterValidationXml(xml, sheet));
  });
  return CFB.write(zip, { type: "array", fileType: "zip", compression: true });
}

export async function downloadMasterDataWorkbook(masterData: MasterDataState) {
  const bytes = await buildMasterDataWorkbookBytes(masterData);
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "quality-master-data.xlsx";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function generateMasterId(section: MasterSection, masterData: MasterDataState) {
  return nextId(section, masterData[section] as Array<{ id: string }>, new Set((masterData[section] as Array<{ id: string }>).map((row) => row.id)));
}
