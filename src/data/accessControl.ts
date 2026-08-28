export type DepartmentId =
  | "quality"
  | "production"
  | "incoming-quality"
  | "engineering"
  | "maintenance"
  | "warehouse"
  | "purchasing"
  | "customer-service"
  | "finance";

export type AccessRole =
  | "platform-admin"
  | "plant-admin"
  | "department-manager"
  | "quality-manager"
  | "data-entry"
  | "reviewer"
  | "viewer"
  | "auditor";

export type UserStatus = "Active" | "Invited" | "Suspended";
export type RecordStatus = "Draft" | "Submitted" | "Under review" | "Approved" | "Rejected" | "Locked";
export type FieldType = "text" | "date" | "number" | "select";

export type Permission =
  | "users.manage"
  | "roles.manage"
  | "raw.create"
  | "raw.edit-own"
  | "raw.review"
  | "raw.approve"
  | "raw.correct"
  | "raw.export"
  | "audit.view";

export type AccessUser = {
  id: string;
  name: string;
  email: string;
  departmentId: DepartmentId;
  plantId: string;
  status: UserStatus;
  roles: AccessRole[];
  /** Allows seeded demo users to exercise every department input module. */
  demoAccess?: boolean;
};

export type Department = { id: DepartmentId; name: string; shortName: string };

export type SupplierRecord = {
  id: string;
  name: string;
  status: "Active" | "Inactive";
  country: string;
};

export type CustomerRecord = {
  id: string;
  name: string;
  status: "Active" | "Inactive";
  country: string;
};

export type MasterStatus = "Active" | "Inactive";
export type MasterOperation = "sheet-metal" | "precision-machining";
export type PartRecord = { id: string; partNumber: string; name: string; partType: "NPI" | "Production"; operation: MasterOperation; status: MasterStatus };
export type ProcessRouteRecord = { id: string; process: string; operation: MasterOperation; workCenter: string; machine: string; status: MasterStatus };
export type DefectLevel1Record = { id: string; name: string; processIds: string[]; status: MasterStatus };
export type DefectLevel2Record = { id: string; reason: string; level1Id: string; processIds: string[]; status: MasterStatus };
export type MasterDataState = {
  suppliers: SupplierRecord[];
  customers: CustomerRecord[];
  parts: PartRecord[];
  processRoutes: ProcessRouteRecord[];
  defectLevel1: DefectLevel1Record[];
  defectLevel2: DefectLevel2Record[];
};

export type DataFieldDefinition = {
  key: string;
  label: string;
  type: FieldType;
  owner: DepartmentId;
  required?: boolean;
  placeholder?: string;
  options?: string[];
};

export type DataModule = {
  id: string;
  label: string;
  departmentId: DepartmentId;
  description: string;
  fields: DataFieldDefinition[];
};

export type RawEntry = {
  id: string;
  moduleId: string;
  departmentId: DepartmentId;
  plantId: string;
  status: RecordStatus;
  fields: Record<string, string>;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  reviewComment?: string;
};

export type AuditEvent = {
  id: string;
  actorId: string;
  action: string;
  target: string;
  detail: string;
  timestamp: string;
};

export type AccessState = {
  users: AccessUser[];
  entries: RawEntry[];
  audit: AuditEvent[];
  currentUserId: string;
  suppliers?: SupplierRecord[];
  customers?: CustomerRecord[];
  masterData: MasterDataState;
  demoMode?: boolean;
};

export const ACCESS_STORAGE_KEY = "manufacturing-quality-access-v1";
export const PLANT_ID = "plant-01";

export const departments: Department[] = [
  { id: "quality", name: "Quality Assurance", shortName: "Quality" },
  { id: "production", name: "Production", shortName: "Production" },
  { id: "incoming-quality", name: "Incoming / Supplier Quality", shortName: "Incoming Quality" },
  { id: "engineering", name: "Engineering / Process", shortName: "Engineering" },
  { id: "maintenance", name: "Maintenance", shortName: "Maintenance" },
  { id: "warehouse", name: "Warehouse / Stores", shortName: "Warehouse" },
  { id: "purchasing", name: "Purchasing / Supply Chain", shortName: "Purchasing" },
  { id: "customer-service", name: "Customer Service / Sales", shortName: "Customer Service" },
  { id: "finance", name: "Finance / Costing", shortName: "Finance" }
];

/** Shared supplier master used by incoming, receiving, and supplier-performance inputs. */
export const supplierDatabase: SupplierRecord[] = [
  { id: "SUP-001", name: "Apex Metals", status: "Active", country: "Malaysia" },
  { id: "SUP-002", name: "Orion Alloys", status: "Active", country: "Malaysia" },
  { id: "SUP-003", name: "Kencana Fasteners", status: "Active", country: "Malaysia" },
  { id: "SUP-004", name: "NexForm Coatings", status: "Active", country: "Malaysia" },
  { id: "SUP-005", name: "Mekong Precision", status: "Active", country: "Vietnam" },
  { id: "SUP-006", name: "Kencana Tooling", status: "Active", country: "Malaysia" }
];

export function activeSupplierNames(suppliers: SupplierRecord[] = supplierDatabase) {
  return suppliers.filter((supplier) => supplier.status === "Active").map((supplier) => supplier.name);
}

const supplierOptions = activeSupplierNames();

/** Shared customer master used by complaint and customer-owned inputs. */
export const customerDatabase: CustomerRecord[] = [
  { id: "CUS-001", name: "Northstar Robotics", status: "Active", country: "United States" },
  { id: "CUS-002", name: "Helix Automation", status: "Active", country: "Germany" },
  { id: "CUS-003", name: "Veridian Medical", status: "Active", country: "Singapore" },
  { id: "CUS-004", name: "Axiom Energy", status: "Active", country: "Malaysia" },
  { id: "CUS-005", name: "Orion Mobility", status: "Active", country: "Japan" }
];

export const partDatabase: PartRecord[] = [
  { id: "PRT-001", partNumber: "SM-4821", name: "Control enclosure", partType: "Production", operation: "sheet-metal", status: "Active" },
  { id: "PRT-002", partNumber: "SM-3904", name: "Mounting panel", partType: "Production", operation: "sheet-metal", status: "Active" },
  { id: "PRT-003", partNumber: "SM-6108", name: "Safety cover", partType: "Production", operation: "sheet-metal", status: "Active" },
  { id: "PRT-004", partNumber: "SM-2241", name: "Prototype bracket", partType: "NPI", operation: "sheet-metal", status: "Active" },
  { id: "PRT-005", partNumber: "SM-2011", name: "Cable tray", partType: "Production", operation: "sheet-metal", status: "Active" },
  { id: "PRT-006", partNumber: "PM-3017", name: "Prototype valve body", partType: "NPI", operation: "precision-machining", status: "Active" },
  { id: "PRT-007", partNumber: "PM-1730", name: "Drive shaft", partType: "Production", operation: "precision-machining", status: "Active" },
  { id: "PRT-008", partNumber: "PM-2248", name: "Bearing housing", partType: "Production", operation: "precision-machining", status: "Active" },
  { id: "PRT-009", partNumber: "PM-1198", name: "Manifold block", partType: "Production", operation: "precision-machining", status: "Active" },
  { id: "PRT-010", partNumber: "PM-4082", name: "Coupling hub", partType: "Production", operation: "precision-machining", status: "Active" }
];

export const processRouteDatabase: ProcessRouteRecord[] = [
  ["Laser Cutting", "sheet-metal", "Cutting Cell", "Fiber Laser 02"], ["Turret Punching", "sheet-metal", "Punch Cell", "Turret 01"],
  ["Press Brake", "sheet-metal", "Forming Cell", "Press Brake 03"], ["Hardware & Nut Installation", "sheet-metal", "Assembly Cell", "Hardware Cell 01"],
  ["Spot Welding", "sheet-metal", "Welding Cell", "Spot Welder 02"], ["MIG/TIG Welding", "sheet-metal", "Welding Cell", "Welding Bay 01"],
  ["Grinding", "sheet-metal", "Finishing Cell", "Grinder 04"], ["Painting", "sheet-metal", "Paint Line", "Paint Booth 01"],
  ["CNC Milling", "precision-machining", "Milling Cell", "VMC 03"], ["CNC Turning", "precision-machining", "Turning Cell", "Lathe 02"],
  ["Welding", "precision-machining", "Welding Cell", "Welding Bay 02"], ["Final Inspection", "precision-machining", "Quality Lab", "CMM 01"],
  ["Pretreatment", "sheet-metal", "Paint Line", "Pretreatment Tank 01"], ["Powder Coating", "sheet-metal", "Paint Line", "Powder Booth 01"]
].map(([process, operation, workCenter, machine], index) => ({ id: `PCR-${String(index + 1).padStart(3, "0")}`, process, operation: operation as MasterOperation, workCenter, machine, status: "Active" }));

const level1Names = ["Drawing/specification nonconformance", "Cosmetic / appearance", "Material / component", "Functional / performance", "Process / workmanship", "Missing / incorrect part", "Other"];
const universalDefectLevel1Database: DefectLevel1Record[] = level1Names.map((name, index) => ({ id: `DF1-${String(index + 1).padStart(3, "0")}`, name, processIds: [], status: "Active" }));
export const defectLevel1Database: DefectLevel1Record[] = [...universalDefectLevel1Database];
const pretreatmentRoute = processRouteDatabase.find((route) => route.process === "Pretreatment")!;
const powderRoute = processRouteDatabase.find((route) => route.process === "Powder Coating")!;
const paintingRoute = processRouteDatabase.find((route) => route.process === "Painting")!;
const focusedLevel1Seeds: DefectLevel1Record[] = [
  { id: "DF1-008", name: "Cleaning & Chemical Treatment", processIds: [pretreatmentRoute.id], status: "Active" },
  { id: "DF1-009", name: "Surface Condition & Corrosion", processIds: [pretreatmentRoute.id], status: "Active" },
  { id: "DF1-010", name: "Appearance & Coverage", processIds: [powderRoute.id, paintingRoute.id], status: "Active" },
  { id: "DF1-011", name: "Adhesion, Cure & Colour", processIds: [powderRoute.id, paintingRoute.id], status: "Active" }
];
defectLevel1Database.push(...focusedLevel1Seeds);
const defectReasons = ["Dimension out of tolerance", "Burr / sharp edge", "Scratch / dent", "Material mismatch", "Functional test failure", "Weld defect", "Paint defect", "Missing hardware", "Wrong part", "Other defect"];
export const defectLevel2Database: DefectLevel2Record[] = defectReasons.map((reason, index) => ({ id: `DF2-${String(index + 1).padStart(3, "0")}`, reason, level1Id: universalDefectLevel1Database[Math.min(index, universalDefectLevel1Database.length - 1)].id, processIds: processRouteDatabase.map((route) => route.id), status: "Active" }));
const focusedLevel2Seeds: DefectLevel2Record[] = [
  ["Poor cleaning", "DF1-008", pretreatmentRoute.id], ["Contamination", "DF1-008", pretreatmentRoute.id], ["Incomplete conversion coating", "DF1-008", pretreatmentRoute.id],
  ["Flash rust", "DF1-009", pretreatmentRoute.id], ["Uneven pretreatment", "DF1-009", pretreatmentRoute.id], ["Surface corrosion", "DF1-009", pretreatmentRoute.id],
  ["Orange peel", "DF1-010", powderRoute.id], ["Runs / sags", "DF1-010", powderRoute.id], ["Thin coating", "DF1-010", powderRoute.id], ["Pinholes", "DF1-010", powderRoute.id],
  ["Poor adhesion", "DF1-011", powderRoute.id], ["Incomplete cure", "DF1-011", powderRoute.id], ["Color mismatch", "DF1-011", powderRoute.id],
  ["Orange peel", "DF1-010", paintingRoute.id], ["Runs / sags", "DF1-010", paintingRoute.id], ["Thin coating", "DF1-010", paintingRoute.id], ["Pinholes", "DF1-010", paintingRoute.id],
  ["Poor adhesion", "DF1-011", paintingRoute.id], ["Incomplete cure", "DF1-011", paintingRoute.id], ["Color mismatch", "DF1-011", paintingRoute.id]
].map(([reason, level1Id, processId], index) => ({ id: `DF2-${String(defectReasons.length + index + 1).padStart(3, "0")}`, reason, level1Id, processIds: [processId], status: "Active" }));
defectLevel2Database.push(...focusedLevel2Seeds);

export const seedMasterData: MasterDataState = { suppliers: supplierDatabase, customers: customerDatabase, parts: partDatabase, processRoutes: processRouteDatabase, defectLevel1: defectLevel1Database, defectLevel2: defectLevel2Database };

export function technicianProcessLabel(process: string) { return process === "Painting" ? "Wet Paint" : process; }
export function isFocusedPaintProcess(process: string) { return ["Pretreatment", "Powder Coating", "Painting"].includes(process); }
export function activeDefectLevel1ForProcess(masterData: MasterDataState, process: string) {
  const routes = masterData.processRoutes.filter((route) => route.status === "Active" && route.process === process);
  const focused = isFocusedPaintProcess(process);
  return masterData.defectLevel1.filter((category) => category.status === "Active" && (focused
    ? category.processIds.some((id) => routes.some((route) => route.id === id))
    : category.processIds.length === 0));
}
export function activeDefectLevel2ForProcessAndLevel1(masterData: MasterDataState, process: string, level1NameOrId?: string) {
  const routes = masterData.processRoutes.filter((route) => route.status === "Active" && route.process === process);
  const level1 = masterData.defectLevel1.find((category) => category.id === level1NameOrId || category.name === level1NameOrId);
  // Focused paint reasons are intentionally gated by the technician's Level 1 choice.
  if (isFocusedPaintProcess(process) && !level1NameOrId) return [];
  return masterData.defectLevel2.filter((reason) => reason.status === "Active"
    && (!level1 || reason.level1Id === level1.id)
    && (!process || reason.processIds.some((id) => routes.some((route) => route.id === id))));
}

export function activeCustomerNames(customers: CustomerRecord[] = customerDatabase) {
  return customers.filter((customer) => customer.status === "Active").map((customer) => customer.name);
}

const customerOptions = activeCustomerNames();

export const roleMeta: Record<AccessRole, { label: string; description: string }> = {
  "platform-admin": { label: "Platform Admin", description: "Global configuration and access" },
  "plant-admin": { label: "Plant Admin", description: "Users and settings for one plant" },
  "department-manager": { label: "Department Manager", description: "Approves department-owned records" },
  "quality-manager": { label: "Quality Manager", description: "Owns quality approvals and NCRs" },
  "data-entry": { label: "Data Entry User", description: "Creates and edits own drafts" },
  reviewer: { label: "Reviewer", description: "Reviews submitted records" },
  viewer: { label: "Viewer", description: "Read-only dashboards and reports" },
  auditor: { label: "Auditor", description: "Read-only access including audit history" }
};

export const rolePermissions: Record<AccessRole, Permission[]> = {
  "platform-admin": ["users.manage", "roles.manage", "raw.create", "raw.edit-own", "raw.review", "raw.approve", "raw.correct", "raw.export", "audit.view"],
  "plant-admin": ["users.manage", "roles.manage", "raw.create", "raw.edit-own", "raw.review", "raw.export", "audit.view"],
  "department-manager": ["raw.create", "raw.edit-own", "raw.review", "raw.approve", "raw.correct", "raw.export"],
  "quality-manager": ["raw.create", "raw.edit-own", "raw.review", "raw.approve", "raw.correct", "raw.export", "audit.view"],
  "data-entry": ["raw.create", "raw.edit-own"],
  reviewer: ["raw.review", "raw.export"],
  viewer: ["raw.export"],
  auditor: ["raw.export", "audit.view"]
};

export const dataModules: DataModule[] = [
  {
    id: "production-output", label: "Production output", departmentId: "production", description: "Work order, process, machine and shift results.",
    fields: [
      { key: "date", label: "Production date", type: "date", owner: "production", required: true },
      { key: "workOrder", label: "Work order", type: "text", owner: "production", required: true, placeholder: "WO-26001" },
      { key: "process", label: "Process", type: "select", owner: "production", required: true, options: ["Laser Cutting", "Turret Punching", "Press Brake", "Hardware & Nut Installation", "Spot Welding", "MIG/TIG Welding", "Grinding", "Polishing", "Pretreatment", "Painting", "Assembly", "Packaging", "CNC Milling", "CNC Turning", "Welding", "Final Inspection"] },
      { key: "machine", label: "Machine", type: "text", owner: "production", required: true, placeholder: "Machine or cell" },
      { key: "outputQty", label: "Output quantity", type: "number", owner: "production", required: true }
    ]
  },
  {
    id: "incoming-inspection", label: "Incoming inspection", departmentId: "incoming-quality", description: "Supplier lots and incoming acceptance decisions.",
    fields: [
      { key: "inspectionDate", label: "Inspection date", type: "date", owner: "incoming-quality", required: true },
      { key: "supplier", label: "Supplier", type: "select", owner: "incoming-quality", required: true, options: supplierOptions },
      { key: "purchaseOrder", label: "Purchase order", type: "text", owner: "purchasing", required: true, placeholder: "PO-0001" },
      { key: "lotNumber", label: "Lot number", type: "text", owner: "warehouse", required: true },
      { key: "result", label: "Result", type: "select", owner: "quality", required: true, options: ["Accepted", "Accepted with deviation", "Rejected"] }
    ]
  },
  {
    id: "process-inspection", label: "In-process inspection", departmentId: "quality", description: "Inspection readings, defects and disposition during production.",
    fields: [
      { key: "inspectionDate", label: "Inspection date", type: "date", owner: "quality", required: true },
      { key: "workOrder", label: "Work order", type: "text", owner: "production", required: true },
      { key: "process", label: "Process", type: "select", owner: "quality", options: ["Laser Cutting", "Turret Punching", "Press Brake", "Hardware & Nut Installation", "Spot Welding", "MIG/TIG Welding", "Grinding", "Pretreatment", "Powder Coating", "Painting", "Assembly", "Packaging", "CNC Milling", "CNC Turning", "Welding", "Final Inspection"] },
      { key: "rejectCategoryLevel1", label: "Reject category Level 1", type: "select", owner: "quality", options: ["Drawing/specification nonconformance", "Cosmetic / appearance", "Material / component", "Functional / performance", "Process / workmanship", "Missing / incorrect part", "Other"] },
      { key: "rejectCategoryLevel2", label: "Reject category Level 2", type: "select", owner: "quality", placeholder: "Process-specific defect reason" },
      { key: "defectCategory", label: "Defect description", type: "text", owner: "quality", placeholder: "Additional defect detail" },
      { key: "partNumber", label: "Part number", type: "text", owner: "engineering", required: true },
      { key: "inspectedQty", label: "Inspected quantity", type: "number", owner: "quality", required: true },
      { key: "disposition", label: "Disposition", type: "select", owner: "quality", options: ["Release", "Rework", "Scrap", "Use as-is approved"] }
    ]
  },
  {
    id: "ncr-corrective-action", label: "NCR / corrective action", departmentId: "quality", description: "Nonconformance, containment, root cause and corrective action.",
    fields: [
      { key: "reportedDate", label: "Reported date", type: "date", owner: "quality", required: true },
      { key: "problemStatement", label: "Problem statement", type: "text", owner: "quality", required: true },
      { key: "rootCause", label: "Root cause", type: "text", owner: "engineering", required: true },
      { key: "actionOwner", label: "Action owner", type: "text", owner: "production", required: true },
      { key: "dueDate", label: "Due date", type: "date", owner: "quality", required: true },
      { key: "severity", label: "Severity", type: "select", owner: "quality", required: true, options: ["Critical", "Major", "Minor"] }
    ]
  },
  {
    id: "maintenance-event", label: "Maintenance event", departmentId: "maintenance", description: "Machine downtime, failure mode and repair history.",
    fields: [
      { key: "eventDate", label: "Event date", type: "date", owner: "maintenance", required: true },
      { key: "machine", label: "Machine", type: "text", owner: "maintenance", required: true },
      { key: "failureMode", label: "Failure mode", type: "text", owner: "maintenance", required: true },
      { key: "downtimeHours", label: "Downtime hours", type: "number", owner: "maintenance", required: true },
      { key: "technician", label: "Technician", type: "text", owner: "maintenance", required: true }
    ]
  },
  {
    id: "material-receipt", label: "Material receipt", departmentId: "warehouse", description: "Received material, lot, quantity and storage location.",
    fields: [
      { key: "receiptDate", label: "Receipt date", type: "date", owner: "warehouse", required: true },
      { key: "supplier", label: "Supplier", type: "select", owner: "purchasing", required: true, options: supplierOptions },
      { key: "material", label: "Material / part", type: "text", owner: "warehouse", required: true },
      { key: "lotNumber", label: "Lot number", type: "text", owner: "warehouse", required: true },
      { key: "quantity", label: "Quantity", type: "number", owner: "warehouse", required: true },
      { key: "location", label: "Storage location", type: "text", owner: "warehouse", required: true }
    ]
  },
  {
    id: "supplier-performance", label: "Supplier performance", departmentId: "purchasing", description: "Supplier delivery, quality and corrective action tracking.",
    fields: [
      { key: "reviewMonth", label: "Review month", type: "date", owner: "purchasing", required: true },
      { key: "supplier", label: "Supplier", type: "select", owner: "purchasing", required: true, options: supplierOptions },
      { key: "deliveryScore", label: "Delivery score", type: "number", owner: "purchasing", required: true },
      { key: "qualityScore", label: "Quality score", type: "number", owner: "incoming-quality", required: true },
      { key: "actionRequired", label: "Action required", type: "select", owner: "purchasing", options: ["No", "Yes"] }
    ]
  },
  {
    id: "customer-complaint", label: "Customer complaint", departmentId: "customer-service", description: "Customer claim, affected quantity and external failure cost.",
    fields: [
      { key: "complaintDate", label: "Complaint date", type: "date", owner: "customer-service", required: true },
      { key: "customer", label: "Customer", type: "select", owner: "customer-service", required: true, options: customerOptions },
      { key: "process", label: "Process", type: "select", owner: "quality", options: ["Laser Cutting", "Turret Punching", "Press Brake", "Hardware & Nut Installation", "Spot Welding", "MIG/TIG Welding", "Grinding", "Pretreatment", "Powder Coating", "Painting", "Assembly", "Packaging", "CNC Milling", "CNC Turning", "Welding", "Final Inspection"] },
      { key: "rejectCategoryLevel1", label: "Reject category Level 1", type: "select", owner: "quality", options: level1Names },
      { key: "rejectCategoryLevel2", label: "Reject category Level 2", type: "select", owner: "quality", options: [] },
      { key: "defectCategory", label: "Defect description", type: "text", owner: "quality", placeholder: "Additional defect detail" },
      { key: "partNumber", label: "Part number", type: "text", owner: "quality", required: true },
      { key: "affectedQty", label: "Affected quantity", type: "number", owner: "customer-service", required: true },
      { key: "externalFailureCost", label: "External failure cost", type: "number", owner: "finance", required: true },
      { key: "externalScrapCost", label: "External scrap cost", type: "number", owner: "finance" },
      { key: "externalReworkCost", label: "External rework cost", type: "number", owner: "finance" },
      { key: "status", label: "Status", type: "select", owner: "customer-service", options: ["Open", "Closed"] }
    ]
  },
  {
    id: "cost-approval", label: "Cost approval", departmentId: "finance", description: "Approved scrap, rework and external failure cost inputs.",
    fields: [
      { key: "period", label: "Cost period", type: "date", owner: "finance", required: true },
      { key: "reference", label: "Reference", type: "text", owner: "finance", required: true },
      { key: "scrapCost", label: "Scrap cost", type: "number", owner: "finance", required: true },
      { key: "reworkCost", label: "Rework cost", type: "number", owner: "finance", required: true },
      { key: "approvedBy", label: "Finance approver", type: "text", owner: "finance", required: true }
    ]
  }
];

const seedUsers: AccessUser[] = [
  { id: "USR-001", name: "Aisha Rahman", email: "aisha.rahman@example.com", departmentId: "quality", plantId: PLANT_ID, status: "Active", roles: ["platform-admin"], demoAccess: true },
  { id: "USR-002", name: "Daniel Lee", email: "daniel.lee@example.com", departmentId: "quality", plantId: PLANT_ID, status: "Active", roles: ["quality-manager"], demoAccess: true },
  { id: "USR-003", name: "Farid Hassan", email: "farid.hassan@example.com", departmentId: "production", plantId: PLANT_ID, status: "Active", roles: ["department-manager"], demoAccess: true },
  { id: "USR-004", name: "Mei Tan", email: "mei.tan@example.com", departmentId: "production", plantId: PLANT_ID, status: "Active", roles: ["data-entry"], demoAccess: true },
  { id: "USR-005", name: "Sarah Lim", email: "sarah.lim@example.com", departmentId: "finance", plantId: PLANT_ID, status: "Active", roles: ["viewer"], demoAccess: true }
];

const seedEntries: RawEntry[] = [
  {
    id: "RAW-0001", moduleId: "process-inspection", departmentId: "quality", plantId: PLANT_ID, status: "Submitted",
    fields: { inspectionDate: "2026-08-21", workOrder: "WO-26840", partNumber: "SM-4821", inspectedQty: "620", defectCategory: "Burr / sharp edge", disposition: "Rework" },
    createdBy: "USR-004", updatedBy: "USR-004", createdAt: "2026-08-21T09:12:00+08:00", updatedAt: "2026-08-21T09:12:00+08:00"
  },
  {
    id: "RAW-0002", moduleId: "maintenance-event", departmentId: "maintenance", plantId: PLANT_ID, status: "Approved",
    fields: { eventDate: "2026-08-20", machine: "Fiber Laser 02", failureMode: "Lens contamination", downtimeHours: "1.5", technician: "Azlan Yusuf" },
    createdBy: "USR-003", updatedBy: "USR-002", createdAt: "2026-08-20T11:06:00+08:00", updatedAt: "2026-08-20T15:26:00+08:00"
  }
];

const seedAudit: AuditEvent[] = [
  { id: "AUD-0001", actorId: "USR-001", action: "User invited", target: "USR-006", detail: "Invited a new Warehouse data entry user", timestamp: "2026-08-21T16:20:00+08:00" },
  { id: "AUD-0002", actorId: "USR-002", action: "Record approved", target: "RAW-0002", detail: "Approved maintenance event after review", timestamp: "2026-08-20T15:26:00+08:00" }
];

export function getDepartment(id: DepartmentId) { return departments.find((department) => department.id === id) ?? departments[0]; }
export function getModule(id: string) { return dataModules.find((module) => module.id === id) ?? dataModules[0]; }
export function getUser(id: string, users: AccessUser[]) { return users.find((user) => user.id === id); }

export function hasPermission(user: AccessUser, permission: Permission) {
  return user.roles.some((role) => rolePermissions[role].includes(permission));
}

export function canCreateModule(user: AccessUser, module: DataModule) {
  if (user.status === "Suspended") return false;
  if (user.demoAccess) return true;
  return hasPermission(user, "raw.create") && (user.roles.includes("platform-admin") || user.roles.includes("plant-admin") || user.departmentId === module.departmentId || module.fields.some((field) => field.owner === user.departmentId));
}

export function canApproveEntry(user: AccessUser, entry: RawEntry) {
  if (entry.createdBy === user.id || !hasPermission(user, "raw.approve")) return false;
  return user.roles.includes("platform-admin") || user.roles.includes("plant-admin") || user.roles.includes("quality-manager") || user.departmentId === entry.departmentId;
}

export function canViewEntry(user: AccessUser, entry: RawEntry) {
  if (entry.plantId !== user.plantId) return false;
  if (user.roles.some((role) => ["platform-admin", "plant-admin", "department-manager", "quality-manager", "viewer", "auditor"].includes(role))) return true;
  return entry.createdBy === user.id || entry.departmentId === user.departmentId;
}

function isoNow() { return new Date().toISOString(); }

export function loadAccessState(): AccessState {
  try {
    const stored = localStorage.getItem(ACCESS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as AccessState;
      if (parsed.users?.length && parsed.entries && parsed.audit && parsed.currentUserId) return migrateStoredAccessState(parsed);
    }
  } catch { /* Use the deterministic demo state when storage is unavailable. */ }
  return createSeedAccessState();
}

const seedUserIds = new Set(seedUsers.map((user) => user.id));

function isLegacyDemoState(state: AccessState) {
  return seedUsers.every((seedUser) => state.users.some((user) => user.id === seedUser.id && user.email === seedUser.email));
}

export function migrateStoredAccessState(state: AccessState): AccessState {
  const demoMode = state.demoMode === true || isLegacyDemoState(state);
  const suppliers = state.suppliers?.length ? state.suppliers : supplierDatabase;
  const customers = state.customers?.length ? state.customers : customerDatabase;
  const mergeSeedRecords = <T extends { id: string }>(existing: T[] | undefined, seeded: T[]) => {
    const rows = (existing?.length ? structuredClone(existing) : []) as T[];
    if (!demoMode && rows.length) return rows;
    const ids = new Set(rows.map((row) => row.id));
    seeded.forEach((row) => { if (!ids.has(row.id)) rows.push(structuredClone(row)); });
    return rows.length ? rows : structuredClone(seeded);
  };
  const storedLevel1 = (state.masterData?.defectLevel1 ?? []).map((row) => ({ ...row, processIds: Array.isArray(row.processIds) ? row.processIds : [] }));
  const masterData: MasterDataState = {
    suppliers: state.masterData?.suppliers?.length ? state.masterData.suppliers : suppliers,
    customers: state.masterData?.customers?.length ? state.masterData.customers : customers,
    parts: state.masterData?.parts?.length ? state.masterData.parts : partDatabase,
    processRoutes: mergeSeedRecords(state.masterData?.processRoutes, processRouteDatabase),
    defectLevel1: mergeSeedRecords(storedLevel1, defectLevel1Database),
    defectLevel2: mergeSeedRecords(state.masterData?.defectLevel2, defectLevel2Database)
  };
  const migrated = {
    ...state,
    demoMode,
    masterData,
    suppliers: masterData.suppliers,
    customers: masterData.customers,
    users: demoMode ? state.users.map((user) => seedUserIds.has(user.id) ? { ...user, demoAccess: true } : user) : state.users
  };
  return migrated;
}

export function persistAccessState(state: AccessState) { localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify(state)); }
export function resetAccessState() { localStorage.removeItem(ACCESS_STORAGE_KEY); }

export function makeAudit(actorId: string, action: string, target: string, detail: string): AuditEvent {
  return { id: `AUD-${Date.now()}`, actorId, action, target, detail, timestamp: isoNow() };
}

export function makeRawEntry(module: DataModule, fields: Record<string, string>, actorId: string): RawEntry {
  const now = isoNow();
  return { id: `RAW-${Date.now()}`, moduleId: module.id, departmentId: module.departmentId, plantId: PLANT_ID, status: "Draft", fields, createdBy: actorId, updatedBy: actorId, createdAt: now, updatedAt: now };
}

export function createSeedAccessState(): AccessState {
  const masterData = structuredClone(seedMasterData);
  return { users: structuredClone(seedUsers), entries: structuredClone(seedEntries), audit: structuredClone(seedAudit), currentUserId: seedUsers[0].id, suppliers: masterData.suppliers, customers: masterData.customers, masterData, demoMode: true };
}

export const seedAccessState: AccessState = createSeedAccessState();
